/**
 * CommEazy Encryption Service — libsodium implementation
 *
 * Dual-path encryption:
 * - ≤8 members: encrypt-to-all (individual crypto_box per recipient)
 * - >8 members: shared-key (AES secretbox + key wrapping)
 *
 * Threshold validated by PoC benchmark:
 * - Text: encrypt-to-all faster up to ~20 members
 * - Photos: shared-key saves 85-97% bandwidth above 3 members
 * - Threshold 8 balances simplicity (text) with efficiency (media)
 *
 * @see cross-cutting/TECH_COMPARISON.md
 * @see poc-encryption-benchmark.js for benchmark data
 */

import {
  crypto_box_keypair,
  crypto_box_easy,
  crypto_box_open_easy,
  crypto_box_NONCEBYTES,
  crypto_secretbox_easy,
  crypto_secretbox_open_easy,
  crypto_secretbox_NONCEBYTES,
  crypto_pwhash,
  crypto_pwhash_OPSLIMIT_MODERATE,
  crypto_pwhash_MEMLIMIT_MODERATE,
  crypto_pwhash_ALG_ARGON2ID13,
  crypto_generichash,
  crypto_scalarmult_base,
  randombytes_buf,
  to_base64,
  from_base64,
  base64_variants,
  to_hex,
  to_string,
  memzero,
  ready as sodiumReady,
} from 'react-native-libsodium';

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
import * as Keychain from 'react-native-keychain';
import type {
  EncryptionService,
  EncryptedPayload,
  EncryptedBackup,
  KeyPair,
  Recipient,
} from './interfaces';
import { AppError } from './interfaces';

const ENCRYPTION_THRESHOLD = 8;
const BACKUP_VERSION = 1;

// Keychain service identifiers
const KEY_SERVICE = 'com.commeazy.keys';
const KEY_ACCOUNT_PUBLIC = 'publicKey';
const KEY_ACCOUNT_PRIVATE = 'privateKey';

export class SodiumEncryptionService implements EncryptionService {
  private publicKey: Uint8Array | null = null;
  private privateKey: Uint8Array | null = null;
  private initialized = false;
  private myJid: string | null = null;

  /**
   * Set the current user's JID.
   * Required for decrypt operations in group chats.
   */
  setMyJid(jid: string): void {
    this.myJid = jid;
  }

  async initialize(): Promise<void> {
    await sodiumReady;

    // Try to load existing keys from Keychain
    const stored = await this.loadKeysFromKeychain();
    if (stored) {
      this.publicKey = stored.publicKey;
      this.privateKey = stored.privateKey;
    }

    this.initialized = true;
  }

  async generateKeyPair(): Promise<KeyPair> {
    this.ensureInitialized();

    const kp = crypto_box_keypair();
    this.publicKey = kp.publicKey;
    this.privateKey = kp.privateKey;

    // Store in Keychain (hardware-backed on iOS/Android)
    // Use ORIGINAL variant for consistent encoding across all services
    await Keychain.setGenericPassword(
      KEY_ACCOUNT_PUBLIC,
      to_base64(kp.publicKey, base64_variants.ORIGINAL),
      { service: `${KEY_SERVICE}.public` },
    );
    await Keychain.setGenericPassword(
      KEY_ACCOUNT_PRIVATE,
      to_base64(kp.privateKey, base64_variants.ORIGINAL),
      { service: `${KEY_SERVICE}.private`, accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY },
    );

    return {
      publicKey: to_base64(kp.publicKey, base64_variants.ORIGINAL),
      privateKey: to_base64(kp.privateKey, base64_variants.ORIGINAL),
    };
  }

  async getPublicKey(): Promise<string> {
    this.ensureInitialized();
    if (!this.publicKey) throw new Error('No key pair generated');
    return to_base64(this.publicKey, base64_variants.ORIGINAL);
  }

  /**
   * Encrypt content for recipients.
   * Automatically selects encryption mode based on recipient count.
   *
   * @param plaintext - Content to encrypt (string for text, Uint8Array for media)
   * @param recipients - Array of {jid, publicKey} pairs
   */
  async encrypt(
    plaintext: string | Uint8Array,
    recipients: Recipient[],
  ): Promise<EncryptedPayload> {
    this.ensureKeys();

    // Validate recipients (E202: Key not found)
    if (recipients.length === 0) {
      throw new AppError('E202', 'encryption', () => {}, {
        reason: 'no_recipients',
      });
    }

    const data = typeof plaintext === 'string'
      ? from_string(plaintext)
      : plaintext;

    try {
      // Select encryption mode
      if (recipients.length === 1) {
        return this.encryptDirect(data, recipients[0]);
      }

      if (recipients.length <= ENCRYPTION_THRESHOLD) {
        return this.encryptToAll(data, recipients);
      }

      return this.encryptSharedKey(data, recipients);
    } catch (error) {
      // E200: Encryption failed - NEVER fall back to plaintext
      console.error('Encryption failed:', error);
      throw new AppError('E200', 'encryption', () => {}, {
        reason: 'encrypt_failed',
        // NEVER include key material in error context
      });
    }
  }

  async decrypt(
    payload: EncryptedPayload,
    senderPublicKey: Uint8Array,
  ): Promise<string> {
    this.ensureKeys();

    try {
      switch (payload.mode) {
        case '1on1':
          return this.decryptDirect(payload, senderPublicKey);
        case 'encrypt-to-all':
          return this.decryptFromAll(payload, senderPublicKey);
        case 'shared-key':
          return this.decryptSharedKey(payload, senderPublicKey);
        default:
          throw new AppError('E201', 'encryption', () => {}, {
            reason: 'unknown_mode',
          });
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      // E201: Decryption failed
      throw new AppError('E201', 'encryption', () => {}, {
        reason: 'decrypt_failed',
        // NEVER include key material in error context
      });
    }
  }

  async generateQRData(): Promise<string> {
    this.ensureKeys();
    // QR contains: base64 public key + fingerprint
    const fingerprint = crypto_generichash(16, this.publicKey!, null);
    return JSON.stringify({
      pk: to_base64(this.publicKey!, base64_variants.ORIGINAL),
      fp: to_hex(fingerprint),
      v: 1,
    });
  }

  verifyQRData(qrData: string, expectedPublicKey: string): boolean {
    try {
      const parsed = JSON.parse(qrData) as { pk: string; fp: string; v: number };
      if (parsed.pk !== expectedPublicKey) return false;

      const pk = from_base64(parsed.pk, base64_variants.ORIGINAL);
      const expectedFingerprint = to_hex(crypto_generichash(16, pk, null));
      return parsed.fp === expectedFingerprint;
    } catch {
      return false;
    }
  }

  /**
   * Create encrypted backup of private key, protected by PIN.
   * Uses PBKDF2 key derivation — secure for backup purposes.
   */
  async createBackup(pin: string): Promise<EncryptedBackup> {
    this.ensureKeys();

    const salt = randombytes_buf(16);
    const derivedKey = crypto_pwhash(
      32,
      pin,
      salt,
      crypto_pwhash_OPSLIMIT_MODERATE,
      crypto_pwhash_MEMLIMIT_MODERATE,
      crypto_pwhash_ALG_ARGON2ID13,
    );

    const nonce = randombytes_buf(crypto_secretbox_NONCEBYTES);
    const encrypted = crypto_secretbox_easy(this.privateKey!, nonce, derivedKey);

    // Zero derived key from memory
    memzero(derivedKey);

    return {
      salt: to_base64(salt, base64_variants.ORIGINAL),
      iv: to_base64(nonce, base64_variants.ORIGINAL),
      encrypted: to_base64(encrypted, base64_variants.ORIGINAL),
      version: BACKUP_VERSION,
    };
  }

  async restoreBackup(pin: string, backup: EncryptedBackup): Promise<KeyPair> {
    let derivedKey: Uint8Array | null = null;

    try {
      // Backup data uses ORIGINAL variant
      const salt = from_base64(backup.salt, base64_variants.ORIGINAL);
      const nonce = from_base64(backup.iv, base64_variants.ORIGINAL);
      const encrypted = from_base64(backup.encrypted, base64_variants.ORIGINAL);

      derivedKey = crypto_pwhash(
        32,
        pin,
        salt,
        crypto_pwhash_OPSLIMIT_MODERATE,
        crypto_pwhash_MEMLIMIT_MODERATE,
        crypto_pwhash_ALG_ARGON2ID13,
      );

      const privateKey = crypto_secretbox_open_easy(encrypted, nonce, derivedKey);
      const publicKey = crypto_scalarmult_base(privateKey);

      this.privateKey = privateKey;
      this.publicKey = publicKey;

      // Store restored keys with ORIGINAL variant
      await Keychain.setGenericPassword(
        KEY_ACCOUNT_PUBLIC,
        to_base64(publicKey, base64_variants.ORIGINAL),
        { service: `${KEY_SERVICE}.public` },
      );
      await Keychain.setGenericPassword(
        KEY_ACCOUNT_PRIVATE,
        to_base64(privateKey, base64_variants.ORIGINAL),
        { service: `${KEY_SERVICE}.private` },
      );

      return {
        publicKey: to_base64(publicKey, base64_variants.ORIGINAL),
        privateKey: to_base64(privateKey, base64_variants.ORIGINAL),
      };
    } catch (error) {
      // E201: Decryption failed (wrong PIN or tampered backup)
      throw new AppError('E201', 'encryption', () => {}, {
        reason: 'backup_restore_failed',
        // NEVER include PIN or key material in error context
      });
    } finally {
      if (derivedKey) {
        memzero(derivedKey);
      }
    }
  }

  // ============================================================
  // Private — Encryption Modes
  // ============================================================

  /** 1-on-1: single crypto_box */
  private encryptDirect(data: Uint8Array, recipient: Recipient): EncryptedPayload {
    const nonce = randombytes_buf(crypto_box_NONCEBYTES);
    const ciphertext = crypto_box_easy(data, nonce, recipient.publicKey, this.privateKey!);

    return {
      mode: '1on1',
      data: to_base64(ciphertext, base64_variants.ORIGINAL),
      metadata: {
        nonce: to_base64(nonce, base64_variants.ORIGINAL),
        to: recipient.jid,
      },
    };
  }

  /** ≤8 members: individual crypto_box per recipient */
  private encryptToAll(data: Uint8Array, recipients: Recipient[]): EncryptedPayload {
    const envelopes: Record<string, { nonce: string; ciphertext: string }> = {};

    for (const recipient of recipients) {
      const nonce = randombytes_buf(crypto_box_NONCEBYTES);
      const ciphertext = crypto_box_easy(data, nonce, recipient.publicKey, this.privateKey!);
      envelopes[recipient.jid] = {
        nonce: to_base64(nonce, base64_variants.ORIGINAL),
        ciphertext: to_base64(ciphertext, base64_variants.ORIGINAL),
      };
    }

    return {
      mode: 'encrypt-to-all',
      data: JSON.stringify(envelopes),
      metadata: {},
    };
  }

  /** >8 members: secretbox content + crypto_box key wrapping */
  private encryptSharedKey(data: Uint8Array, recipients: Recipient[]): EncryptedPayload {
    // Generate random message key
    const messageKey = randombytes_buf(32);
    const contentNonce = randombytes_buf(crypto_secretbox_NONCEBYTES);

    // Encrypt content once with message key
    const encryptedContent = crypto_secretbox_easy(data, contentNonce, messageKey);

    // Wrap message key for each recipient
    const wrappedKeys: Record<string, { nonce: string; key: string }> = {};
    for (const recipient of recipients) {
      const keyNonce = randombytes_buf(crypto_box_NONCEBYTES);
      const wrappedKey = crypto_box_easy(messageKey, keyNonce, recipient.publicKey, this.privateKey!);
      wrappedKeys[recipient.jid] = {
        nonce: to_base64(keyNonce, base64_variants.ORIGINAL),
        key: to_base64(wrappedKey, base64_variants.ORIGINAL),
      };
    }

    // CRITICAL: Zero message key from memory
    memzero(messageKey);

    return {
      mode: 'shared-key',
      data: JSON.stringify({
        content: to_base64(encryptedContent, base64_variants.ORIGINAL),
        contentNonce: to_base64(contentNonce, base64_variants.ORIGINAL),
        keys: wrappedKeys,
      }),
      metadata: {},
    };
  }

  // ============================================================
  // Private — Decryption
  // ============================================================

  private decryptDirect(payload: EncryptedPayload, senderPk: Uint8Array): string {
    const nonce = from_base64(payload.metadata.nonce, base64_variants.ORIGINAL);
    const ciphertext = from_base64(payload.data, base64_variants.ORIGINAL);
    const plaintext = crypto_box_open_easy(ciphertext, nonce, senderPk, this.privateKey!);
    return to_string(plaintext);
  }

  private decryptFromAll(payload: EncryptedPayload, senderPk: Uint8Array): string {
    const envelopes = JSON.parse(payload.data) as Record<string, { nonce: string; ciphertext: string }>;
    const myJid = this.getMyJid();
    const envelope = envelopes[myJid];

    if (!envelope) {
      throw new Error('No envelope for this recipient');
    }

    const nonce = from_base64(envelope.nonce, base64_variants.ORIGINAL);
    const ciphertext = from_base64(envelope.ciphertext, base64_variants.ORIGINAL);
    const plaintext = crypto_box_open_easy(ciphertext, nonce, senderPk, this.privateKey!);
    return to_string(plaintext);
  }

  private decryptSharedKey(payload: EncryptedPayload, senderPk: Uint8Array): string {
    const parsed = JSON.parse(payload.data) as {
      content: string;
      contentNonce: string;
      keys: Record<string, { nonce: string; key: string }>;
    };

    const myJid = this.getMyJid();
    const myWrappedKey = parsed.keys[myJid];

    if (!myWrappedKey) {
      throw new Error('No key envelope for this recipient');
    }

    // Unwrap message key
    const keyNonce = from_base64(myWrappedKey.nonce, base64_variants.ORIGINAL);
    const wrappedKey = from_base64(myWrappedKey.key, base64_variants.ORIGINAL);
    const messageKey = crypto_box_open_easy(wrappedKey, keyNonce, senderPk, this.privateKey!);

    // Decrypt content
    const contentNonce = from_base64(parsed.contentNonce, base64_variants.ORIGINAL);
    const encryptedContent = from_base64(parsed.content, base64_variants.ORIGINAL);

    try {
      const plaintext = crypto_secretbox_open_easy(encryptedContent, contentNonce, messageKey);
      return to_string(plaintext);
    } finally {
      memzero(messageKey);
    }
  }

  // ============================================================
  // Private — Helpers
  // ============================================================

  private async loadKeysFromKeychain(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array } | null> {
    try {
      const pubResult = await Keychain.getGenericPassword({ service: `${KEY_SERVICE}.public` });
      const privResult = await Keychain.getGenericPassword({ service: `${KEY_SERVICE}.private` });

      if (pubResult && privResult) {
        // Use ORIGINAL variant to match the encoding used in testKeys.ts and container.ts
        return {
          publicKey: from_base64(pubResult.password, base64_variants.ORIGINAL),
          privateKey: from_base64(privResult.password, base64_variants.ORIGINAL),
        };
      }
    } catch {
      // No stored keys
    }
    return null;
  }

  private getMyJid(): string {
    if (!this.myJid) {
      throw new AppError('E202', 'encryption', () => {}, {
        reason: 'jid_not_set',
      });
    }
    return this.myJid;
  }

  private ensureInitialized(): void {
    if (!this.initialized) throw new Error('EncryptionService not initialized');
  }

  private ensureKeys(): void {
    this.ensureInitialized();
    if (!this.publicKey || !this.privateKey) {
      throw new Error('No key pair — generate or restore first');
    }
  }
}
