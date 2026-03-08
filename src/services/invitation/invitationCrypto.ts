/**
 * Invitation Crypto — Encrypt/decrypt invitation payloads
 *
 * Uses NaCl secretbox (XSalsa20-Poly1305) for symmetric encryption.
 * Key is derived from the invitation code using SHA-256.
 *
 * The invitation code (CE-XXXX-XXXX) serves as a shared secret:
 * - Sender generates the code and encrypts their contact data
 * - Code is shared out-of-band (SMS, email, WhatsApp)
 * - Recipient uses the code to decrypt the invitation
 *
 * @see TRUST_AND_ATTESTATION_PLAN.md section 2.2
 */

import {
  crypto_secretbox_easy,
  crypto_secretbox_open_easy,
  crypto_secretbox_NONCEBYTES,
  crypto_secretbox_KEYBYTES,
  crypto_generichash,
  randombytes_buf,
  to_base64,
  from_base64,
  to_string,
  base64_variants,
  ready as sodiumReady,
} from 'react-native-libsodium';

const LOG_PREFIX = '[invitationCrypto]';

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
 * Derive a 32-byte encryption key from an invitation code.
 * Uses crypto_generichash (BLAKE2b) for key derivation.
 */
export async function deriveKeyFromCode(code: string): Promise<Uint8Array> {
  await sodiumReady;

  // Normalize: remove dashes, uppercase
  const normalized = code.replace(/-/g, '').toUpperCase();
  const input = stringToBytes(`commeazy-invitation-v1:${normalized}`);

  // BLAKE2b hash produces exactly 32 bytes (crypto_secretbox key size)
  return crypto_generichash(crypto_secretbox_KEYBYTES, input);
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
 * @param encrypted - Base64-encoded encrypted blob
 * @param nonce - Base64-encoded nonce
 * @param code - Invitation code (used to derive decryption key)
 * @returns Decrypted payload, or null if decryption fails
 */
export async function decryptInvitation(
  encrypted: string,
  nonce: string,
  code: string,
): Promise<InvitationPayload | null> {
  await sodiumReady;

  try {
    const key = await deriveKeyFromCode(code);
    const encryptedBytes = from_base64(encrypted, base64_variants.ORIGINAL);
    const nonceBytes = from_base64(nonce, base64_variants.ORIGINAL);

    const decrypted = crypto_secretbox_open_easy(encryptedBytes, nonceBytes, key);
    if (!decrypted) {
      console.warn(LOG_PREFIX, 'Decryption returned null — wrong code?');
      return null;
    }

    const json = to_string(decrypted);
    return JSON.parse(json) as InvitationPayload;
  } catch {
    console.warn(LOG_PREFIX, 'Decryption failed');
    return null;
  }
}
