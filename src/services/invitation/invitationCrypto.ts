/**
 * Invitation Crypto — Encrypt/decrypt invitation payloads
 *
 * Uses NaCl secretbox (XSalsa20-Poly1305) for symmetric encryption.
 *
 * Key derivation:
 * - V2 (current): Argon2id — memory-hard, ~250ms per attempt (brute-force resistant)
 * - V1 (legacy fallback): BLAKE2b — single-pass hash (for old CE-XXXX-XXXX codes)
 *
 * The invitation code serves as a shared secret:
 * - Sender generates the code and encrypts their contact data
 * - Code is shared out-of-band (SMS, email, WhatsApp)
 * - Recipient uses the code to decrypt the invitation
 *
 * Rate limiting: max 5 decryption attempts per 60 seconds (client-side)
 *
 * @see TRUST_AND_ATTESTATION_PLAN.md section 2.2
 */

import {
  crypto_secretbox_easy,
  crypto_secretbox_open_easy,
  crypto_secretbox_NONCEBYTES,
  crypto_secretbox_KEYBYTES,
  crypto_generichash,
  crypto_pwhash,
  crypto_pwhash_OPSLIMIT_MODERATE,
  crypto_pwhash_MEMLIMIT_MODERATE,
  crypto_pwhash_ALG_ARGON2ID13,
  randombytes_buf,
  to_base64,
  from_base64,
  to_string,
  base64_variants,
  ready as sodiumReady,
} from 'react-native-libsodium';

const LOG_PREFIX = '[invitationCrypto]';

// Rate limiter: max 5 decryption attempts per 60 seconds
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const decryptAttemptTimestamps: number[] = [];

// Manual UTF-8 encoding (TextEncoder not available in React Native)
function stringToBytes(str: string): Uint8Array {
  const utf8: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charCode = str.charCodeAt(i);
    if (charCode < 0x80) {
      utf8.push(charCode);
    } else if (charCode < 0x800) {
      utf8.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    } else if (charCode < 0xd800 || charCode >= 0xe000) {
      utf8.push(
        0xe0 | (charCode >> 12),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f),
      );
    } else {
      // Surrogate pair
      i++;
      charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      utf8.push(
        0xf0 | (charCode >> 18),
        0x80 | ((charCode >> 12) & 0x3f),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f),
      );
    }
  }
  return new Uint8Array(utf8);
}

/** Invitation payload structure */
export interface InvitationPayload {
  uuid: string;
  publicKey: string;
  displayName: string;
  jid: string;
}

/**
 * Check if decryption is rate-limited.
 * Returns true if the client has exceeded the max attempts within the window.
 * Screens should check this BEFORE calling decryptInvitation().
 */
export function isDecryptRateLimited(): boolean {
  const now = Date.now();
  // Remove expired timestamps
  while (decryptAttemptTimestamps.length > 0 && decryptAttemptTimestamps[0]! < now - RATE_LIMIT_WINDOW_MS) {
    decryptAttemptTimestamps.shift();
  }
  return decryptAttemptTimestamps.length >= RATE_LIMIT_MAX;
}

/**
 * Record a decryption attempt for rate limiting.
 */
function recordDecryptAttempt(): void {
  const now = Date.now();
  // Clean up expired timestamps
  while (decryptAttemptTimestamps.length > 0 && decryptAttemptTimestamps[0]! < now - RATE_LIMIT_WINDOW_MS) {
    decryptAttemptTimestamps.shift();
  }
  decryptAttemptTimestamps.push(now);
}

/**
 * Derive a 32-byte encryption key from an invitation code using Argon2id (V2).
 *
 * Argon2id is memory-hard (~250ms, 64MB RAM per attempt), making
 * brute-force attacks on the invitation code computationally expensive.
 *
 * The salt is derived deterministically from the code itself, so both
 * sender and recipient derive the same key without exchanging a salt.
 */
async function deriveKeyV2(code: string): Promise<Uint8Array> {
  const normalized = code.replace(/-/g, '').toUpperCase();

  // Deterministic salt: BLAKE2b hash of code-specific input, truncated to 16 bytes
  const saltInput = stringToBytes(`commeazy-invitation-salt-v2:${normalized}`);
  const salt = crypto_generichash(16, saltInput);

  // Argon2id key derivation (same parameters as encryption.ts backup KDF)
  return crypto_pwhash(
    crypto_secretbox_KEYBYTES,
    normalized,
    salt,
    crypto_pwhash_OPSLIMIT_MODERATE,
    crypto_pwhash_MEMLIMIT_MODERATE,
    crypto_pwhash_ALG_ARGON2ID13,
  );
}

/**
 * Derive a 32-byte encryption key using the legacy V1 method (BLAKE2b).
 * Only used as fallback for decrypting old CE-XXXX-XXXX invitation codes.
 */
async function deriveKeyV1(code: string): Promise<Uint8Array> {
  const normalized = code.replace(/-/g, '').toUpperCase();
  const input = stringToBytes(`commeazy-invitation-v1:${normalized}`);
  return crypto_generichash(crypto_secretbox_KEYBYTES, input);
}

/**
 * Derive a 32-byte encryption key from an invitation code.
 * Uses Argon2id (V2) for new codes, BLAKE2b (V1) for legacy codes.
 *
 * For encryption: always uses V2.
 */
export async function deriveKeyFromCode(code: string): Promise<Uint8Array> {
  await sodiumReady;
  return deriveKeyV2(code);
}

/**
 * Encrypt contact data for the invitation relay.
 *
 * @param payload - Contact data to encrypt
 * @param code - Invitation code (used to derive encryption key)
 * @returns Object with encrypted blob and nonce (both base64)
 */
export async function encryptInvitation(
  payload: InvitationPayload,
  code: string,
): Promise<{ encrypted: string; nonce: string }> {
  await sodiumReady;

  const key = await deriveKeyFromCode(code);
  const nonce = randombytes_buf(crypto_secretbox_NONCEBYTES);
  const message = stringToBytes(JSON.stringify(payload));
  const encrypted = crypto_secretbox_easy(message, nonce, key);

  return {
    encrypted: to_base64(encrypted, base64_variants.ORIGINAL),
    nonce: to_base64(nonce, base64_variants.ORIGINAL),
  };
}

/**
 * Decrypt invitation data received from the relay.
 *
 * Tries Argon2id (V2) first, then falls back to BLAKE2b (V1) for
 * backward compatibility with older invitation codes.
 *
 * Rate-limited: check isDecryptRateLimited() before calling.
 * If rate-limited, this function returns null immediately.
 *
 * @param encrypted - Base64-encoded encrypted blob
 * @param nonce - Base64-encoded nonce
 * @param code - Invitation code (used to derive decryption key)
 * @returns Decrypted payload, or null if decryption fails or rate-limited
 */
export async function decryptInvitation(
  encrypted: string,
  nonce: string,
  code: string,
): Promise<InvitationPayload | null> {
  await sodiumReady;

  // Rate limit check
  if (isDecryptRateLimited()) {
    console.warn(LOG_PREFIX, 'Rate limited — too many decryption attempts');
    return null;
  }

  recordDecryptAttempt();

  const encryptedBytes = from_base64(encrypted, base64_variants.ORIGINAL);
  const nonceBytes = from_base64(nonce, base64_variants.ORIGINAL);

  // Try V2 (Argon2id) first
  try {
    const keyV2 = await deriveKeyV2(code);
    const decrypted = crypto_secretbox_open_easy(encryptedBytes, nonceBytes, keyV2);
    if (decrypted) {
      const json = to_string(decrypted);
      return JSON.parse(json) as InvitationPayload;
    }
  } catch {
    // V2 failed — try V1 fallback
  }

  // Fallback: try V1 (BLAKE2b) for legacy codes
  try {
    const keyV1 = await deriveKeyV1(code);
    const decrypted = crypto_secretbox_open_easy(encryptedBytes, nonceBytes, keyV1);
    if (decrypted) {
      if (__DEV__) {
        console.info(LOG_PREFIX, 'Decrypted with V1 fallback (legacy code)');
      }
      const json = to_string(decrypted);
      return JSON.parse(json) as InvitationPayload;
    }
  } catch {
    // V1 also failed
  }

  console.warn(LOG_PREFIX, 'Decryption failed — wrong code?');
  return null;
}
