/**
 * CommEazy Secure Storage — Keychain/Keystore abstraction
 *
 * Unified API for storing sensitive data in the platform's secure enclave:
 * - iOS: Keychain Services
 * - Android: Android Keystore (via react-native-keychain)
 *
 * All tokens, secrets, and credentials MUST use this service instead of AsyncStorage.
 * AsyncStorage is NOT encrypted and data is accessible to jailbroken devices.
 *
 * Accessibility levels:
 * - WHEN_UNLOCKED: Tokens that should only be readable when device is unlocked
 * - AFTER_FIRST_UNLOCK: Data that needs background access (e.g., push token refresh)
 *
 * @see TESTFLIGHT_SECURITY_HARDENING.md Item 2.1
 */

import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVICE_PREFIX = 'com.commeazy.secure';

/**
 * Store a value securely in Keychain.
 *
 * @param key - Logical key name (will be prefixed with service identifier)
 * @param value - String value to store
 * @param accessible - When the value should be accessible (default: WHEN_UNLOCKED)
 */
export async function secureSet(
  key: string,
  value: string,
  accessible: Keychain.ACCESSIBLE = Keychain.ACCESSIBLE.WHEN_UNLOCKED,
): Promise<void> {
  await Keychain.setGenericPassword(
    key,
    value,
    {
      service: `${SERVICE_PREFIX}.${key}`,
      accessible,
    },
  );
}

/**
 * Retrieve a value from Keychain.
 *
 * @param key - Logical key name
 * @returns The stored value, or null if not found
 */
export async function secureGet(key: string): Promise<string | null> {
  try {
    const result = await Keychain.getGenericPassword({
      service: `${SERVICE_PREFIX}.${key}`,
    });
    if (result && result.password) {
      return result.password;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Remove a value from Keychain.
 *
 * @param key - Logical key name
 */
export async function secureRemove(key: string): Promise<void> {
  try {
    await Keychain.resetGenericPassword({
      service: `${SERVICE_PREFIX}.${key}`,
    });
  } catch {
    // Ignore — key may not exist
  }
}

/**
 * Migrate a value from AsyncStorage to Keychain.
 * Reads from AsyncStorage, writes to Keychain, then deletes from AsyncStorage.
 *
 * @param asyncStorageKey - The key in AsyncStorage
 * @param secureKey - The new key in Keychain
 * @param accessible - When the value should be accessible
 * @returns true if migration occurred, false if nothing to migrate
 */
export async function migrateFromAsyncStorage(
  asyncStorageKey: string,
  secureKey: string,
  accessible: Keychain.ACCESSIBLE = Keychain.ACCESSIBLE.WHEN_UNLOCKED,
): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(asyncStorageKey);
    if (value !== null) {
      await secureSet(secureKey, value, accessible);
      await AsyncStorage.removeItem(asyncStorageKey);
      console.info(`[SecureStorage] Migrated ${asyncStorageKey} to Keychain`);
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`[SecureStorage] Migration failed for ${asyncStorageKey}:`, (error as Error).message);
    return false;
  }
}
