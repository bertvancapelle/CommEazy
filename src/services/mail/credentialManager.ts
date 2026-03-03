/**
 * Credential Manager — Secure storage for mail account credentials
 *
 * Stores IMAP/SMTP passwords and OAuth2 tokens in Keychain (iOS)
 * and Keystore (Android). NEVER in AsyncStorage, SQLite, or logs.
 *
 * Security requirements:
 * - iOS: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
 *   (credentials are NOT included in iCloud backup — zero-server-storage)
 * - OAuth2 refresh tokens also stored in Keychain
 * - PII (email, passwords) NEVER logged
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 6.3
 */

import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  StoredCredentials,
  MailAccount,
  IMAPConfig,
  SMTPConfig,
} from '@/types/mail';

// ============================================================
// Constants
// ============================================================

/** Keychain service prefix for mail credentials */
const MAIL_KEYCHAIN_SERVICE = 'com.commeazy.mail';

/** AsyncStorage key prefix for account metadata (non-sensitive) */
const ACCOUNTS_STORAGE_KEY = '@commeazy/mail_accounts';

// ============================================================
// Credential Storage (Keychain — SECURE)
// ============================================================

/**
 * Save credentials securely in Keychain.
 *
 * Uses `WHEN_UNLOCKED_THIS_DEVICE_ONLY` accessible level to ensure:
 * - Credentials are NOT included in iCloud backup
 * - Credentials are only accessible when device is unlocked
 * - Credentials are tied to this specific device
 *
 * @param accountId - Unique account identifier
 * @param credentials - Full credential object to store
 */
export async function saveCredentials(
  accountId: string,
  credentials: StoredCredentials,
): Promise<void> {
  const service = `${MAIL_KEYCHAIN_SERVICE}.${accountId}`;

  // Serialize credentials as JSON (stored as password field in Keychain)
  const serialized = JSON.stringify(credentials);

  await Keychain.setGenericPassword(
    accountId, // username
    serialized, // password (contains the full credential object)
    {
      service,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
}

/**
 * Retrieve credentials from Keychain.
 *
 * @param accountId - Unique account identifier
 * @returns Stored credentials, or null if not found
 */
export async function getCredentials(
  accountId: string,
): Promise<StoredCredentials | null> {
  const service = `${MAIL_KEYCHAIN_SERVICE}.${accountId}`;

  try {
    const result = await Keychain.getGenericPassword({ service });
    if (!result || !result.password) {
      return null;
    }

    return JSON.parse(result.password) as StoredCredentials;
  } catch {
    // Keychain access failure or JSON parse error
    return null;
  }
}

/**
 * Delete credentials from Keychain.
 *
 * @param accountId - Unique account identifier
 */
export async function deleteCredentials(
  accountId: string,
): Promise<void> {
  const service = `${MAIL_KEYCHAIN_SERVICE}.${accountId}`;

  try {
    await Keychain.resetGenericPassword({ service });
  } catch {
    // Ignore if already deleted
  }
}

/**
 * Update only the OAuth2 tokens in stored credentials.
 * Used by the token refresh interceptor.
 *
 * @param accountId - Account identifier
 * @param accessToken - New access token
 * @param refreshToken - New refresh token (if provided)
 * @param expiresAt - Token expiration timestamp (ms)
 */
export async function updateOAuth2Tokens(
  accountId: string,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: number,
): Promise<void> {
  const existing = await getCredentials(accountId);
  if (!existing || existing.type !== 'oauth2') {
    return;
  }

  const updated: StoredCredentials = {
    ...existing,
    accessToken,
    refreshToken: refreshToken ?? existing.refreshToken,
    expiresAt: expiresAt ?? existing.expiresAt,
  };

  await saveCredentials(accountId, updated);
}

// ============================================================
// Account Metadata Storage (AsyncStorage — NON-SENSITIVE)
// ============================================================

/**
 * Save account metadata to AsyncStorage.
 * This stores ONLY non-sensitive data (display name, provider ID, etc.).
 * Credentials are stored separately in Keychain.
 *
 * @param account - Account metadata (no passwords/tokens)
 */
export async function saveAccount(account: MailAccount): Promise<void> {
  const accounts = await getAllAccounts();

  // Replace existing or add new
  const index = accounts.findIndex(a => a.id === account.id);
  if (index >= 0) {
    accounts[index] = account;
  } else {
    accounts.push(account);
  }

  await AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}

/**
 * Get all saved mail account metadata.
 *
 * @returns Array of account metadata
 */
export async function getAllAccounts(): Promise<MailAccount[]> {
  try {
    const json = await AsyncStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!json) return [];
    return JSON.parse(json) as MailAccount[];
  } catch {
    return [];
  }
}

/**
 * Get a specific account by ID.
 *
 * @param accountId - Account identifier
 * @returns Account metadata or null
 */
export async function getAccount(
  accountId: string,
): Promise<MailAccount | null> {
  const accounts = await getAllAccounts();
  return accounts.find(a => a.id === accountId) ?? null;
}

/**
 * Get the default send account.
 *
 * @returns Default account or the first account, or null
 */
export async function getDefaultAccount(): Promise<MailAccount | null> {
  const accounts = await getAllAccounts();
  return accounts.find(a => a.isDefault) ?? accounts[0] ?? null;
}

/**
 * Delete an account and its credentials.
 * Removes both the metadata from AsyncStorage and credentials from Keychain.
 *
 * @param accountId - Account identifier
 */
export async function deleteAccount(accountId: string): Promise<void> {
  // Delete credentials from Keychain
  await deleteCredentials(accountId);

  // Remove from accounts list
  const accounts = await getAllAccounts();
  const filtered = accounts.filter(a => a.id !== accountId);

  // If the deleted account was default, make the first remaining account default
  if (filtered.length > 0 && !filtered.some(a => a.isDefault)) {
    filtered[0].isDefault = true;
  }

  await AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Set an account as the default send account.
 *
 * @param accountId - Account to set as default
 */
export async function setDefaultAccount(accountId: string): Promise<void> {
  const accounts = await getAllAccounts();

  for (const account of accounts) {
    account.isDefault = account.id === accountId;
  }

  await AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}

// ============================================================
// Config Helpers
// ============================================================

/**
 * Build an IMAPConfig from stored credentials.
 * Populates authentication fields based on credential type.
 *
 * @param credentials - Stored credentials
 * @returns Ready-to-use IMAP configuration
 */
export function buildIMAPConfig(credentials: StoredCredentials): IMAPConfig {
  return {
    host: credentials.imapConfig.host,
    port: credentials.imapConfig.port,
    security: credentials.imapConfig.security,
    username: credentials.email,
    password: credentials.type === 'password' ? credentials.password : undefined,
    accessToken: credentials.type === 'oauth2' ? credentials.accessToken : undefined,
  };
}

/**
 * Build an SMTPConfig from stored credentials.
 * Populates authentication fields based on credential type.
 *
 * @param credentials - Stored credentials
 * @returns Ready-to-use SMTP configuration
 */
export function buildSMTPConfig(credentials: StoredCredentials): SMTPConfig {
  return {
    host: credentials.smtpConfig.host,
    port: credentials.smtpConfig.port,
    security: credentials.smtpConfig.security,
    username: credentials.email,
    password: credentials.type === 'password' ? credentials.password : undefined,
    accessToken: credentials.type === 'oauth2' ? credentials.accessToken : undefined,
  };
}

/**
 * Check if OAuth2 credentials need token refresh.
 * Returns true if the access token expires within 60 seconds.
 *
 * @param credentials - Stored credentials
 * @returns Whether a token refresh is needed
 */
export function needsTokenRefresh(credentials: StoredCredentials): boolean {
  if (credentials.type !== 'oauth2') return false;
  if (!credentials.expiresAt) return true;

  // Refresh if expiring within 60 seconds
  return credentials.expiresAt < Date.now() + 60_000;
}

// ============================================================
// Cleanup
// ============================================================

/**
 * Delete all mail accounts and credentials.
 * Used for full app reset or account data wipe.
 */
export async function deleteAllAccounts(): Promise<void> {
  const accounts = await getAllAccounts();

  // Delete all credentials from Keychain
  for (const account of accounts) {
    await deleteCredentials(account.id);
  }

  // Clear account list
  await AsyncStorage.removeItem(ACCOUNTS_STORAGE_KEY);
}
