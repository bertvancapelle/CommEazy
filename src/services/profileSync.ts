/**
 * ProfileSync Service — Hybrid Push/Pull Profile Synchronization
 *
 * Ensures profile changes propagate between contacts via XMPP,
 * encrypted per-contact with NaCl crypto_box.
 *
 * Three sync modes:
 * - PUSH: User saves profile → broadcast to all consented contacts
 * - PULL (single): Opening chat/contact → version-check the contact
 * - PULL (bulk): XMPP reconnect → check all contacts' versions
 *
 * All sync is invisible — no UI, no spinners, fire-and-forget.
 *
 * @see CONTACT_DATA_SHARING.md for consent model
 * @see interfaces.ts for Contact, UserProfile, SharedDataConsent types
 */

import {
  crypto_box_easy,
  crypto_box_open_easy,
  crypto_box_NONCEBYTES,
  randombytes_buf,
  to_base64,
  from_base64,
  base64_variants,
  to_string,
} from 'react-native-libsodium';

import type {
  Contact,
  UserProfile,
  Unsubscribe,
} from './interfaces';

// from_string is not exported by react-native-libsodium native build
// Manual UTF-8 encoding since TextEncoder is not available in React Native
const from_string = (str: string): Uint8Array => {
  const utf8: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charCode = str.charCodeAt(i);
    if (charCode < 0x80) {
      utf8.push(charCode);
    } else if (charCode < 0x800) {
      utf8.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    } else if (charCode >= 0xd800 && charCode < 0xdc00) {
      // Surrogate pair
      i++;
      const low = str.charCodeAt(i);
      charCode = 0x10000 + ((charCode - 0xd800) << 10) + (low - 0xdc00);
      utf8.push(
        0xf0 | (charCode >> 18),
        0x80 | ((charCode >> 12) & 0x3f),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f),
      );
    } else {
      utf8.push(
        0xe0 | (charCode >> 12),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f),
      );
    }
  }
  return new Uint8Array(utf8);
};

// ============================================================
// Types
// ============================================================

/** Profile data that gets encrypted and synced between contacts */
export interface ProfileSyncPayload {
  version: number;
  firstName: string;
  lastName: string;
  landlineNumber?: string;
  mobileNumber?: string;
  email?: string;
  address?: {
    street?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  };
  birthDate?: string;
  weddingDate?: string;
}

/** XMPP stanza types for profile sync */
export type ProfileStanzaType = 'update' | 'version-check' | 'version-response';

/** Incoming profile sync message (parsed from XMPP stanza) */
export interface ProfileSyncMessage {
  type: ProfileStanzaType;
  /** Encrypted payload (base64) — present for 'update' type */
  payload?: string;
  /** Nonce for decryption (base64) — present for 'update' type */
  nonce?: string;
  /** Profile version number — present for 'version-check' and 'version-response' */
  version?: number;
}

/**
 * Service dependencies — injected via initialize().
 * Using callbacks to avoid circular dependency with container.
 */
export interface ProfileSyncDeps {
  getDatabase: () => {
    getUserProfile: () => Promise<UserProfile | null>;
    getContactsOnce: () => Promise<Contact[]>;
    getContact: (jid: string) => Promise<Contact | null>;
    getConsentForContact: (contactJid: string) => Promise<{ isSharingEnabled: boolean } | null>;
    getSharedWithContacts: () => Promise<{ contactJid: string }[]>;
  };
  getEncryption: () => {
    getPublicKey: () => Promise<string>;
  };
  getPrivateKey: () => Uint8Array | null;
  sendProfileStanza: (to: string, message: ProfileSyncMessage) => Promise<void>;
  onProfileSync: (handler: (from: string, message: ProfileSyncMessage) => void) => Unsubscribe;
  updateContactProfile: (jid: string, data: ProfileSyncPayload) => Promise<void>;
}

// ============================================================
// ProfileSyncService
// ============================================================

export class ProfileSyncService {
  private deps: ProfileSyncDeps | null = null;
  private unsubscribeXmpp: Unsubscribe | null = null;

  /**
   * Initialize the service with dependencies and start listening
   * for incoming profile sync messages.
   */
  initialize(deps: ProfileSyncDeps): void {
    this.deps = deps;

    // Register XMPP handler for incoming profile sync messages
    this.unsubscribeXmpp = deps.onProfileSync((from, message) => {
      void this.handleIncoming(from, message);
    });

    console.info('[ProfileSync] Initialized');
  }

  /**
   * Cleanup: unsubscribe from XMPP handler.
   */
  destroy(): void {
    if (this.unsubscribeXmpp) {
      this.unsubscribeXmpp();
      this.unsubscribeXmpp = null;
    }
    this.deps = null;
  }

  // ============================================================
  // PUSH: Broadcast profile update to all consented contacts
  // ============================================================

  /**
   * Broadcast current user's profile to all contacts who have
   * consent to receive it. Fire-and-forget — errors are logged,
   * never thrown to caller.
   */
  async broadcastProfileUpdate(): Promise<void> {
    if (!this.deps) return;

    try {
      const db = this.deps.getDatabase();
      const profile = await db.getUserProfile();
      if (!profile) {
        console.warn('[ProfileSync] No user profile found, skipping broadcast');
        return;
      }

      // Build payload from shareable profile fields
      const payload: ProfileSyncPayload = {
        version: profile.profileVersion ?? 1,
        firstName: profile.firstName,
        lastName: profile.lastName,
        landlineNumber: profile.landlineNumber,
        mobileNumber: profile.mobileNumber,
        email: profile.email,
        address: (profile.addressStreet || profile.addressPostalCode || profile.addressCity || profile.addressCountry)
          ? {
            street: profile.addressStreet,
            postalCode: profile.addressPostalCode,
            city: profile.addressCity,
            country: profile.addressCountry,
          }
          : undefined,
        birthDate: profile.birthDate,
        weddingDate: profile.weddingDate,
      };

      // Get all contacts where sharing is enabled
      const consented = await db.getSharedWithContacts();
      if (consented.length === 0) {
        if (__DEV__) {
          console.debug('[ProfileSync] No consented contacts, skipping broadcast');
        }
        return;
      }

      // Resolve contact public keys and encrypt per-contact
      const privateKey = this.deps.getPrivateKey();
      if (!privateKey) {
        console.warn('[ProfileSync] No private key available, skipping broadcast');
        return;
      }

      const jsonPayload = JSON.stringify(payload);
      const plaintextBytes = from_string(jsonPayload);

      let sent = 0;
      for (const consent of consented) {
        try {
          const contact = await db.getContact(consent.contactJid);
          if (!contact || !contact.publicKey) continue;

          const recipientPk = from_base64(contact.publicKey, base64_variants.ORIGINAL);
          const nonce = randombytes_buf(crypto_box_NONCEBYTES);
          const ciphertext = crypto_box_easy(plaintextBytes, nonce, recipientPk, privateKey);

          await this.deps.sendProfileStanza(contact.jid, {
            type: 'update',
            payload: to_base64(ciphertext, base64_variants.ORIGINAL),
            nonce: to_base64(nonce, base64_variants.ORIGINAL),
          });
          sent++;
        } catch (contactError) {
          // Log per-contact errors but continue with others
          console.warn('[ProfileSync] Failed to send to contact:', contactError);
        }
      }

      if (__DEV__) {
        console.debug(`[ProfileSync] Broadcast sent to ${sent}/${consented.length} contacts`);
      }
    } catch (error) {
      console.error('[ProfileSync] Broadcast failed:', error);
    }
  }

  // ============================================================
  // PULL (single): Version-check a specific contact
  // ============================================================

  /**
   * Check if a contact's profile is up-to-date by comparing versions.
   * Sends a version-check stanza. The contact will respond with their
   * current version, and we pull the full profile if needed.
   */
  async checkContact(contactJid: string): Promise<void> {
    if (!this.deps) return;

    try {
      const db = this.deps.getDatabase();
      const contact = await db.getContact(contactJid);
      if (!contact) return;

      // Send version-check with our known version of their profile
      await this.deps.sendProfileStanza(contactJid, {
        type: 'version-check',
        version: contact.profileVersion ?? 0,
      });

      if (__DEV__) {
        console.debug(`[ProfileSync] Version check sent to ${contactJid.split('@')[0]}, known v${contact.profileVersion ?? 0}`);
      }
    } catch (error) {
      // Fire-and-forget — never break the calling flow
      console.warn('[ProfileSync] Version check failed:', error);
    }
  }

  // ============================================================
  // PULL (bulk): Check all contacts on reconnect
  // ============================================================

  /**
   * Check all contacts' profile versions. Called on XMPP reconnect.
   * Sends version-check to each contact — they respond individually.
   */
  async bulkCheckContacts(): Promise<void> {
    if (!this.deps) return;

    try {
      const db = this.deps.getDatabase();
      const contacts = await db.getContactsOnce();

      let checked = 0;
      for (const contact of contacts) {
        try {
          await this.deps.sendProfileStanza(contact.jid, {
            type: 'version-check',
            version: contact.profileVersion ?? 0,
          });
          checked++;
        } catch {
          // Skip failed contacts
        }
      }

      if (__DEV__) {
        console.debug(`[ProfileSync] Bulk check sent to ${checked}/${contacts.length} contacts`);
      }
    } catch (error) {
      console.warn('[ProfileSync] Bulk check failed:', error);
    }
  }

  // ============================================================
  // Incoming message handler (router)
  // ============================================================

  private async handleIncoming(from: string, message: ProfileSyncMessage): Promise<void> {
    if (!this.deps) return;

    try {
      switch (message.type) {
        case 'update':
          await this.handleProfileUpdate(from, message);
          break;
        case 'version-check':
          await this.handleVersionCheck(from, message);
          break;
        case 'version-response':
          await this.handleVersionResponse(from, message);
          break;
        default:
          if (__DEV__) {
            console.warn(`[ProfileSync] Unknown message type from ${from.split('@')[0]}`);
          }
      }
    } catch (error) {
      console.error('[ProfileSync] Handler error:', error);
    }
  }

  // ============================================================
  // Handle incoming profile update (push from contact)
  // ============================================================

  private async handleProfileUpdate(from: string, message: ProfileSyncMessage): Promise<void> {
    if (!this.deps) return;
    if (!message.payload || !message.nonce) {
      console.warn('[ProfileSync] Update missing payload/nonce');
      return;
    }

    const db = this.deps.getDatabase();
    const contact = await db.getContact(from);
    if (!contact || !contact.publicKey) {
      if (__DEV__) {
        console.debug(`[ProfileSync] Update from unknown contact ${from.split('@')[0]}, ignoring`);
      }
      return;
    }

    // Decrypt the profile payload
    const privateKey = this.deps.getPrivateKey();
    if (!privateKey) return;

    try {
      const senderPk = from_base64(contact.publicKey, base64_variants.ORIGINAL);
      const nonce = from_base64(message.nonce, base64_variants.ORIGINAL);
      const ciphertext = from_base64(message.payload, base64_variants.ORIGINAL);

      const plaintext = crypto_box_open_easy(ciphertext, nonce, senderPk, privateKey);
      const payload = JSON.parse(to_string(plaintext)) as ProfileSyncPayload;

      // Only update if incoming version is newer
      if (payload.version <= (contact.profileVersion ?? 0)) {
        if (__DEV__) {
          console.debug(`[ProfileSync] Ignoring stale update from ${from.split('@')[0]} (v${payload.version} ≤ v${contact.profileVersion ?? 0})`);
        }
        return;
      }

      // Save updated contact profile
      await this.deps.updateContactProfile(from, payload);

      if (__DEV__) {
        console.debug(`[ProfileSync] Updated ${from.split('@')[0]} to v${payload.version}`);
      }
    } catch (error) {
      // Decryption failure — log but don't break
      console.error('[ProfileSync] Failed to decrypt profile update:', error);
    }
  }

  // ============================================================
  // Handle version-check request (pull request from contact)
  // ============================================================

  private async handleVersionCheck(from: string, message: ProfileSyncMessage): Promise<void> {
    if (!this.deps) return;

    const db = this.deps.getDatabase();

    // Check consent: do we share our profile with this contact?
    const consent = await db.getConsentForContact(from);
    if (!consent || !consent.isSharingEnabled) {
      // No consent — respond with version 0 (indicates "not sharing")
      await this.deps.sendProfileStanza(from, {
        type: 'version-response',
        version: 0,
      });
      return;
    }

    const profile = await db.getUserProfile();
    if (!profile) return;

    const myVersion = profile.profileVersion ?? 1;
    const theirKnownVersion = message.version ?? 0;

    if (theirKnownVersion >= myVersion) {
      // Contact already has our latest version — respond with version only
      await this.deps.sendProfileStanza(from, {
        type: 'version-response',
        version: myVersion,
      });
      return;
    }

    // Contact has an outdated version — send full profile update
    const contact = await db.getContact(from);
    if (!contact || !contact.publicKey) return;

    const privateKey = this.deps.getPrivateKey();
    if (!privateKey) return;

    const payload: ProfileSyncPayload = {
      version: myVersion,
      firstName: profile.firstName,
      lastName: profile.lastName,
      landlineNumber: profile.landlineNumber,
      mobileNumber: profile.mobileNumber,
      email: profile.email,
      address: (profile.addressStreet || profile.addressPostalCode || profile.addressCity || profile.addressCountry)
        ? {
          street: profile.addressStreet,
          postalCode: profile.addressPostalCode,
          city: profile.addressCity,
          country: profile.addressCountry,
        }
        : undefined,
      birthDate: profile.birthDate,
      weddingDate: profile.weddingDate,
    };

    try {
      const recipientPk = from_base64(contact.publicKey, base64_variants.ORIGINAL);
      const nonce = randombytes_buf(crypto_box_NONCEBYTES);
      const jsonPayload = JSON.stringify(payload);
      const plaintextBytes = from_string(jsonPayload);
      const ciphertext = crypto_box_easy(plaintextBytes, nonce, recipientPk, privateKey);

      await this.deps.sendProfileStanza(from, {
        type: 'update',
        payload: to_base64(ciphertext, base64_variants.ORIGINAL),
        nonce: to_base64(nonce, base64_variants.ORIGINAL),
      });

      if (__DEV__) {
        console.debug(`[ProfileSync] Sent profile v${myVersion} to ${from.split('@')[0]} (they had v${theirKnownVersion})`);
      }
    } catch (error) {
      console.error('[ProfileSync] Failed to encrypt profile response:', error);
    }
  }

  // ============================================================
  // Handle version-response (pull response from contact)
  // ============================================================

  private async handleVersionResponse(from: string, message: ProfileSyncMessage): Promise<void> {
    if (!this.deps) return;

    const remoteVersion = message.version ?? 0;
    if (remoteVersion === 0) {
      // Contact is not sharing — nothing to do
      return;
    }

    const db = this.deps.getDatabase();
    const contact = await db.getContact(from);
    if (!contact) return;

    const localVersion = contact.profileVersion ?? 0;

    if (remoteVersion > localVersion) {
      // Contact has a newer version but only sent version number.
      // This means they should have also sent a full update (handled in handleVersionCheck).
      // If not, we can request it explicitly by sending another version-check with 0.
      if (__DEV__) {
        console.debug(`[ProfileSync] ${from.split('@')[0]} has v${remoteVersion}, we have v${localVersion} — expecting full update`);
      }
    }
  }
}
