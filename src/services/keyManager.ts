/**
 * CommEazy Key Manager — Database encryption key management
 *
 * Manages the 256-bit database encryption key:
 * - Generates a random key on first launch via libsodium
 * - Stores it in iOS Keychain (accessible: AFTER_FIRST_UNLOCK — survives iCloud Backup)
 * - Retrieves it on subsequent launches
 *
 * Fase 4 fundament: rotateKey() stub for future key rotation.
 *
 * @see TESTFLIGHT_SECURITY_HARDENING.md Item 1.1
 */

import * as Keychain from 'react-native-keychain';
import { randombytes_buf, to_hex, ready as sodiumReady } from 'react-native-libsodium';

const DB_KEY_SERVICE = 'com.commeazy.database.key';
const DB_KEY_ACCOUNT = 'databaseEncryptionKey';

/**
 * Get the database encryption key from Keychain.
 * If no key exists (first launch), generates a new random 256-bit key
 * and stores it in Keychain.
 *
 * @returns hex-encoded 256-bit key string for SQLCipher
 */
export async function getDatabaseKey(): Promise<string> {
  // Ensure libsodium is ready
  await sodiumReady;

  // Try to load existing key from Keychain
  try {
    const result = await Keychain.getGenericPassword({ service: DB_KEY_SERVICE });
    if (result && result.password) {
      console.debug('[KeyManager] Database key loaded from Keychain');
      return result.password;
    }
  } catch {
    // No stored key — will generate below
  }

  // No key found — generate new random 256-bit key
  console.info('[KeyManager] No database key found, generating new random key');
  const keyBytes = randombytes_buf(32);
  const keyHex = to_hex(keyBytes);

  // Store in Keychain with AFTER_FIRST_UNLOCK accessibility
  // This allows the key to be accessed after the first unlock (including background),
  // and survives iCloud Backup/Restore (critical for data recovery).
  await Keychain.setGenericPassword(DB_KEY_ACCOUNT, keyHex, {
    service: DB_KEY_SERVICE,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
  });

  console.info('[KeyManager] Database key generated and stored in Keychain');
  return keyHex;
}

/**
 * Check if a database encryption key exists in Keychain.
 */
export async function hasDatabaseKey(): Promise<boolean> {
  try {
    const result = await Keychain.getGenericPassword({ service: DB_KEY_SERVICE });
    return !!(result && result.password);
  } catch {
    return false;
  }
}

/**
 * Rotate the database encryption key.
 *
 * TODO: Implement key rotation (Fase 4 — evaluate during TestFlight).
 * Steps:
 * 1. Generate new random key
 * 2. Re-encrypt database with new key (SQLCipher PRAGMA rekey)
 * 3. Store new key in Keychain
 * 4. Delete old key
 *
 * @throws Error — Not yet implemented
 */
export async function rotateKey(): Promise<void> {
  // TODO: implement key rotation (Fase 4)
  throw new Error('Key rotation not yet implemented — see TESTFLIGHT_SECURITY_HARDENING.md Fase 4.4');
}
