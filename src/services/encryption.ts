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

import sodium from 'libsodium-wrappers';
import * as Keychain from 'react-native-keychain';
import type {
  EncryptionService,
  EncryptedPayload,
  EncryptedBackup,
  KeyPair,
  Recipient,
} from './interfaces';

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

  async initialize(): Promise<void> {
    await sodium.ready;

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

    const kp = sodium.crypto_box_keypair();
    this.publicKey = kp.publicKey;
    this.privateKey = kp.privateKey;

    // Store in Keychain (hardware-backed on iOS/Android)
    await Keychain.setGenericPassword(
      KEY_ACCOUNT_PUBLIC,
      sodium.to_base64(kp.publicKey),
      { service: `${KEY_SERVICE}.public` },
    );
    await Keychain.setGenericPassword(
      KEY_ACCOUNT_PRIVATE,
      sodium.to_base64(kp.privateKey),
      { service: `${KEY_SERVICE}.private`, accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY },
    );

    return {
      publicKey: sodium.to_base64(kp.publicKey),
      privateKey: sodium.to_base64(kp.privateKey),
    };
  }

  async getPublicKey(): Promise<string> {
    this.ensureInitialized();
    if (!this.publicKey) throw new Error('No key pair generated');
    return sodium.to_base64(this.publicKey);
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

    const data = typeof plaintext === 'string'
      ? sodium.from_string(plaintext)
      : plaintext;

    // Select encryption mode
    if (recipients.length === 1) {
      return this.encryptDirect(data, recipients[0]);
    }

    if (recipients.length <= ENCRYPTION_THRESHOLD) {
      return this.encryptToAll(data, recipients);
    }

    return this.encryptSharedKey(data, recipients);
  }

  async decrypt(
    payload: EncryptedPayload,
    senderPublicKey: Uint8Array,
  ): Promise<string> {
    this.ensureKeys();

    switch (payload.mode) {
      case '1on1':
        return this.decryptDirect(payload, senderPublicKey);
      case 'encrypt-to-all':
        return this.decryptFromAll(payload, senderPublicKey);
      case 'shared-key':
        return this.decryptSharedKey(payload, senderPublicKey);
      default:
        throw new Error(`Unknown encryption mode: ${payload.mode}`);
    }
  }

  async generateQRData(): Promise<string> {
    this.ensureKeys();
    // QR contains: base64 public key + fingerprint
    const fingerprint = sodium.crypto_generichash(16, this.publicKey!, null);
    return JSON.stringify({
      pk: sodium.to_base64(this.publicKey!),
      fp: sodium.to_hex(fingerprint),
      v: 1,
    });
  }

  verifyQRData(qrData: string, expectedPublicKey: string): boolean {
    try {
      const parsed = JSON.parse(qrData) as { pk: string; fp: string; v: number };
      if (parsed.pk !== expectedPublicKey) return false;

      const pk = sodium.from_base64(parsed.pk);
      const expectedFingerprint = sodium.to_hex(sodium.crypto_generichash(16, pk, null));
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

    const salt = sodium.randombytes_buf(16);
    const derivedKey = sodium.crypto_pwhash(
      32,
      pin,
      salt,
      sodium.crypto_pwhash_OPSLIMIT_MODERATE,
      sodium.crypto_pwhash_MEMLIMIT_MODERATE,
      sodium.crypto_pwhash_ALG_ARGON2ID13,
    );

    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const encrypted = sodium.crypto_secretbox_easy(this.privateKey!, nonce, derivedKey);

    // Zero derived key from memory
    sodium.memzero(derivedKey);

    return {
      salt: sodium.to_base64(salt),
      iv: sodium.to_base64(nonce),
      encrypted: sodium.to_base64(encrypted),
      version: BACKUP_VERSION,
    };
  }

  async restoreBackup(pin: string, backup: EncryptedBackup): Promise<KeyPair> {
    const salt = sodium.from_base64(backup.salt);
    const nonce = sodium.from_base64(backup.iv);
    const encrypted = sodium.from_base64(backup.encrypted);

    const derivedKey = sodium.crypto_pwhash(
      32,
      pin,
      salt,
      sodium.crypto_pwhash_OPSLIMIT_MODERATE,
      sodium.crypto_pwhash_MEMLIMIT_MODERATE,
      sodium.crypto_pwhash_ALG_ARGON2ID13,
    );

    try {
      const privateKey = sodium.crypto_secretbox_open_easy(encrypted, nonce, derivedKey);
      const publicKey = sodium.crypto_scalarmult_base(privateKey);

      this.privateKey = privateKey;
      this.publicKey = publicKey;

      // Store restored keys
      await Keychain.setGenericPassword(
        KEY_ACCOUNT_PUBLIC,
        sodium.to_base64(publicKey),
        { service: `${KEY_SERVICE}.public` },
      );
      await Keychain.setGenericPassword(
        KEY_ACCOUNT_PRIVATE,
        sodium.to_base64(privateKey),
        { service: `${KEY_SERVICE}.private` },
      );

      return {
        publicKey: sodium.to_base64(publicKey),
        privateKey: sodium.to_base64(privateKey),
      };
    } finally {
      sodium.memzero(derivedKey);
    }
  }

  // ============================================================
  // Private — Encryption Modes
  // ============================================================

  /** 1-on-1: single crypto_box */
  private encryptDirect(data: Uint8Array, recipient: Recipient): EncryptedPayload {
    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
    const ciphertext = sodium.crypto_box_easy(data, nonce, recipient.publicKey, this.privateKey!);

    return {
      mode: '1on1',
      data: sodium.to_base64(ciphertext),
      metadata: {
        nonce: sodium.to_base64(nonce),
        to: recipient.jid,
      },
    };
  }

  /** ≤8 members: individual crypto_box per recipient */
  private encryptToAll(data: Uint8Array, recipients: Recipient[]): EncryptedPayload {
    const envelopes: Record<string, { nonce: string; ciphertext: string }> = {};

    for (const recipient of recipients) {
      const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
      const ciphertext = sodium.crypto_box_easy(data, nonce, recipient.publicKey, this.privateKey!);
      envelopes[recipient.jid] = {
        nonce: sodium.to_base64(nonce),
        ciphertext: sodium.to_base64(ciphertext),
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
    const messageKey = sodium.randombytes_buf(32);
    const contentNonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

    // Encrypt content once with message key
    const encryptedContent = sodium.crypto_secretbox_easy(data, contentNonce, messageKey);

    // Wrap message key for each recipient
    const wrappedKeys: Record<string, { nonce: string; key: string }> = {};
    for (const recipient of recipients) {
      const keyNonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
      const wrappedKey = sodium.crypto_box_easy(messageKey, keyNonce, recipient.publicKey, this.privateKey!);
      wrappedKeys[recipient.jid] = {
        nonce: sodium.to_base64(keyNonce),
        key: sodium.to_base64(wrappedKey),
      };
    }

    // CRITICAL: Zero message key from memory
    sodium.memzero(messageKey);

    return {
      mode: 'shared-key',
      data: JSON.stringify({
        content: sodium.to_base64(encryptedContent),
        contentNonce: sodium.to_base64(contentNonce),
        keys: wrappedKeys,
      }),
      metadata: {},
    };
  }

  // ============================================================
  // Private — Decryption
  // ============================================================

  private decryptDirect(payload: EncryptedPayload, senderPk: Uint8Array): string {
    const nonce = sodium.from_base64(payload.metadata.nonce);
    const ciphertext = sodium.from_base64(payload.data);
    const plaintext = sodium.crypto_box_open_easy(ciphertext, nonce, senderPk, this.privateKey!);
    return sodium.to_string(plaintext);
  }

  private decryptFromAll(payload: EncryptedPayload, senderPk: Uint8Array): string {
    const envelopes = JSON.parse(payload.data) as Record<string, { nonce: string; ciphertext: string }>;
    const myJid = this.getMyJid();
    const envelope = envelopes[myJid];

    if (!envelope) {
      throw new Error('No envelope for this recipient');
    }

    const nonce = sodium.from_base64(envelope.nonce);
    const ciphertext = sodium.from_base64(envelope.ciphertext);
    const plaintext = sodium.crypto_box_open_easy(ciphertext, nonce, senderPk, this.privateKey!);
    return sodium.to_string(plaintext);
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
    const keyNonce = sodium.from_base64(myWrappedKey.nonce);
    const wrappedKey = sodium.from_base64(myWrappedKey.key);
    const messageKey = sodium.crypto_box_open_easy(wrappedKey, keyNonce, senderPk, this.privateKey!);

    // Decrypt content
    const contentNonce = sodium.from_base64(parsed.contentNonce);
    const encryptedContent = sodium.from_base64(parsed.content);

    try {
      const plaintext = sodium.crypto_secretbox_open_easy(encryptedContent, contentNonce, messageKey);
      return sodium.to_string(plaintext);
    } finally {
      sodium.memzero(messageKey);
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
        return {
          publicKey: sodium.from_base64(pubResult.password),
          privateKey: sodium.from_base64(privResult.password),
        };
      }
    } catch {
      // No stored keys
    }
    return null;
  }

  private getMyJid(): string {
    // TODO: inject from auth context
    throw new Error('getMyJid not yet implemented — wire up auth context');
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
