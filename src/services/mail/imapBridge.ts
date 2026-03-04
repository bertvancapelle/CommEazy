/**
 * IMAP Bridge — React Native NativeModules wrapper for MailModule (IMAP)
 *
 * Wraps the native MailModule's IMAP methods with full TypeScript typing.
 * All methods are Promise-based and map directly to native Swift methods.
 *
 * @see ios/MailModule.swift
 * @see ios/MailModule.m
 * @see src/types/mail.ts
 * @see src/services/mail/oauth2Service.ts — Token refresh (Fase 6.4)
 */

import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  type EmitterSubscription,
} from 'react-native';
import type {
  IMAPConfig,
  MailboxInfo,
  MailHeader,
  MailBody,
  AttachmentData,
  ConnectionTestResult,
  MailAttachmentProgress,
  MailErrorCode,
} from '@/types/mail';

// ============================================================
// Native Module Interface
// ============================================================

/**
 * Raw NativeModules.MailModule interface.
 * Method signatures match the ObjC bridge (MailModule.m).
 */
interface NativeMailModule {
  connectIMAP(
    host: string,
    port: number,
    username: string,
    password: string | null,
    accessToken: string | null,
  ): Promise<boolean>;

  disconnect(): Promise<boolean>;

  listMailboxes(): Promise<MailboxInfo[]>;

  fetchHeaders(
    folderName: string,
    limit: number,
  ): Promise<MailHeader[]>;

  fetchMessageBody(
    uid: number,
    folderName: string,
  ): Promise<MailBody>;

  fetchAttachmentData(
    uid: number,
    folderName: string,
    partIndex: number,
  ): Promise<AttachmentData>;

  searchMessages(
    folderName: string,
    query: string,
  ): Promise<number[]>;

  fetchHeadersByUIDs(
    folderName: string,
    uids: number[],
  ): Promise<MailHeader[]>;

  markAsRead(
    uid: number,
    folderName: string,
  ): Promise<boolean>;

  markAsFlagged(
    uid: number,
    folderName: string,
    flagged: boolean,
  ): Promise<boolean>;

  deleteMessage(
    uid: number,
    folderName: string,
  ): Promise<boolean>;

  moveMessage(
    uid: number,
    fromFolder: string,
    toFolder: string,
  ): Promise<boolean>;

  testConnection(
    imapHost: string,
    imapPort: number,
    smtpHost: string,
    smtpPort: number,
    username: string,
    password: string | null,
    accessToken: string | null,
  ): Promise<ConnectionTestResult>;
}

// ============================================================
// Module Reference
// ============================================================

const MailNativeModule: NativeMailModule | null =
  Platform.OS === 'ios' ? NativeModules.MailModule : null;

let eventEmitter: NativeEventEmitter | null = null;

function getModule(): NativeMailModule {
  if (!MailNativeModule) {
    throw new Error('[imapBridge] MailModule is only available on iOS');
  }
  return MailNativeModule;
}

function getEventEmitter(): NativeEventEmitter {
  if (!eventEmitter) {
    eventEmitter = new NativeEventEmitter(NativeModules.MailModule);
  }
  return eventEmitter;
}

// ============================================================
// IMAP Bridge API
// ============================================================

/**
 * Connect and authenticate to an IMAP server.
 *
 * @param config - IMAP server configuration
 * @throws MailError with code AUTH_FAILED, CONNECTION_FAILED, TIMEOUT, etc.
 */
export async function connectIMAP(config: IMAPConfig): Promise<boolean> {
  return getModule().connectIMAP(
    config.host,
    config.port,
    config.username,
    config.password ?? null,
    config.accessToken ?? null,
  );
}

/**
 * Disconnect from the current IMAP server.
 */
export async function disconnect(): Promise<boolean> {
  return getModule().disconnect();
}

/**
 * List all mailboxes (folders) on the connected server.
 *
 * @returns Array of mailbox info objects
 * @throws MailError with code NOT_CONNECTED if not connected
 */
export async function listMailboxes(): Promise<MailboxInfo[]> {
  return getModule().listMailboxes();
}

/**
 * Fetch message headers from a mailbox.
 *
 * @param folderName - Mailbox name (e.g., "INBOX")
 * @param limit - Maximum number of messages to fetch
 * @returns Array of mail headers (newest first based on sequence numbers)
 */
export async function fetchHeaders(
  folderName: string,
  limit: number,
): Promise<MailHeader[]> {
  return getModule().fetchHeaders(folderName, limit);
}

/**
 * Fetch the full body of a message by UID.
 *
 * @param uid - Message UID
 * @param folderName - Mailbox name
 * @returns Message body with HTML/plain text and attachment metadata
 */
export async function fetchMessageBody(
  uid: number,
  folderName: string,
): Promise<MailBody> {
  return getModule().fetchMessageBody(uid, folderName);
}

/**
 * Fetch attachment data by UID and part index.
 *
 * @param uid - Message UID
 * @param folderName - Mailbox name
 * @param partIndex - Attachment part index (from MailAttachmentMeta.index)
 * @returns Attachment data (base64 or file path)
 */
export async function fetchAttachmentData(
  uid: number,
  folderName: string,
  partIndex: number,
): Promise<AttachmentData> {
  return getModule().fetchAttachmentData(uid, folderName, partIndex);
}

/**
 * Search messages on the IMAP server.
 *
 * @param folderName - Mailbox name
 * @param query - Search query string
 * @returns Array of matching message UIDs
 */
export async function searchMessages(
  folderName: string,
  query: string,
): Promise<number[]> {
  return getModule().searchMessages(folderName, query);
}

/**
 * Fetch headers for specific UIDs (used to get details for search results).
 *
 * @param folderName - Mailbox name
 * @param uids - Array of message UIDs to fetch
 * @returns Array of mail headers for the requested UIDs
 */
export async function fetchHeadersByUIDs(
  folderName: string,
  uids: number[],
): Promise<MailHeader[]> {
  if (uids.length === 0) return [];
  return getModule().fetchHeadersByUIDs(folderName, uids);
}

/**
 * Mark a message as read (set \\Seen flag).
 *
 * @param uid - Message UID
 * @param folderName - Mailbox name
 */
export async function markAsRead(
  uid: number,
  folderName: string,
): Promise<boolean> {
  return getModule().markAsRead(uid, folderName);
}

/**
 * Set or clear the \\Flagged flag on a message.
 *
 * @param uid - Message UID
 * @param folderName - Mailbox name
 * @param flagged - Whether to set (true) or clear (false) the flag
 */
export async function markAsFlagged(
  uid: number,
  folderName: string,
  flagged: boolean,
): Promise<boolean> {
  return getModule().markAsFlagged(uid, folderName, flagged);
}

/**
 * Delete a message (set \\Deleted flag and expunge).
 *
 * @param uid - Message UID
 * @param folderName - Mailbox name
 */
export async function deleteMessage(
  uid: number,
  folderName: string,
): Promise<boolean> {
  return getModule().deleteMessage(uid, folderName);
}

/**
 * Move a message from one folder to another.
 *
 * @param uid - Message UID
 * @param fromFolder - Source mailbox name
 * @param toFolder - Destination mailbox name
 */
export async function moveMessage(
  uid: number,
  fromFolder: string,
  toFolder: string,
): Promise<boolean> {
  return getModule().moveMessage(uid, fromFolder, toFolder);
}

/**
 * Test IMAP and SMTP connection with given credentials.
 *
 * @param imapConfig - IMAP configuration
 * @param smtpConfig - SMTP configuration
 * @returns Test results including inbox message count
 */
export async function testConnection(
  imapConfig: IMAPConfig,
  smtpConfig: { host: string; port: number },
): Promise<ConnectionTestResult> {
  return getModule().testConnection(
    imapConfig.host,
    imapConfig.port,
    smtpConfig.host,
    smtpConfig.port,
    imapConfig.username,
    imapConfig.password ?? null,
    imapConfig.accessToken ?? null,
  );
}

// ============================================================
// Event Subscriptions
// ============================================================

/**
 * Subscribe to attachment download progress events.
 *
 * @param callback - Called with progress updates during attachment downloads
 * @returns Subscription that should be removed when no longer needed
 */
export function onAttachmentProgress(
  callback: (event: MailAttachmentProgress) => void,
): EmitterSubscription {
  return getEventEmitter().addListener('MailAttachmentProgress', callback);
}

// ============================================================
// Token Refresh Interceptor (Fase 6.4)
// ============================================================

/**
 * Connect to IMAP with automatic OAuth2 token refresh.
 *
 * For OAuth2 accounts, checks if the access token is expired or
 * about to expire (within 60s). If so, refreshes the token before
 * connecting. Falls back to standard connectIMAP for password accounts.
 *
 * @param accountId - Account identifier (for Keychain lookup)
 * @param providerId - Provider identifier (for OAuth2 config)
 * @returns true on success
 * @throws On auth failure or token refresh failure
 */
export async function connectIMAPWithRefresh(
  accountId: string,
  providerId: string,
): Promise<boolean> {
  // Lazy import to avoid circular dependency
  const credentialManager = await import('./credentialManager');
  const oauth2Service = await import('./oauth2Service');

  console.debug('[imapBridge] connectIMAPWithRefresh — loading credentials for account:', accountId);
  const credentials = await credentialManager.getCredentials(accountId);
  if (!credentials) {
    console.debug('[imapBridge] No credentials found in Keychain for account');
    throw new Error('[imapBridge] No credentials found for account');
  }

  console.debug('[imapBridge] Credentials found — type:', credentials.type, 'host:', credentials.imapConfig?.host, 'port:', credentials.imapConfig?.port);

  let imapConfig = credentialManager.buildIMAPConfig(credentials);

  // For OAuth2 accounts, ensure token is valid
  if (credentials.type === 'oauth2') {
    console.debug('[imapBridge] OAuth2 account — checking token validity...');
    try {
      const { accessToken, refreshed } = await oauth2Service.ensureValidToken(
        accountId,
        providerId,
      );
      console.debug('[imapBridge] Token status — refreshed:', refreshed, 'tokenLength:', accessToken?.length ?? 0);

      if (refreshed) {
        // Use the fresh token
        imapConfig = { ...imapConfig, accessToken };
      }
    } catch (tokenErr) {
      const tokenMsg = tokenErr instanceof Error ? tokenErr.message : String(tokenErr);
      console.debug('[imapBridge] Token refresh FAILED:', tokenMsg);
      throw tokenErr;
    }
  } else {
    console.debug('[imapBridge] Password account — no token refresh needed');
  }

  console.debug('[imapBridge] Calling native connectIMAP — host:', imapConfig.host, 'port:', imapConfig.port, 'hasPassword:', !!imapConfig.password, 'hasToken:', !!imapConfig.accessToken);
  const result = await connectIMAP(imapConfig);
  console.debug('[imapBridge] Native connectIMAP returned:', result);
  return result;
}

// ============================================================
// Error Utilities
// ============================================================

/**
 * Extract a typed error code from a native module rejection.
 *
 * @param error - Error thrown by native module
 * @returns Typed error code or 'UNKNOWN_ERROR'
 */
export function getMailErrorCode(error: unknown): MailErrorCode {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: MailErrorCode }).code;
  }
  return 'UNKNOWN_ERROR';
}
