/**
 * IMAP Service — Sync strategy for mail headers
 *
 * Manages initial and incremental synchronization of mail headers
 * between the IMAP server and the local SQLite cache.
 *
 * Sync Strategy:
 * - initialSync: Fetch latest N headers, populate cache
 * - incrementalSync: Fetch only new messages (UID > highest cached)
 * - getMessages: Read from local cache (offline-first)
 *
 * @see src/services/mail/imapBridge.ts — Native module wrapper
 * @see src/services/mail/mailCache.ts — Cache operations
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 5.3
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IMAPConfig, MailHeader, CachedMailHeader, MailBody, MailSyncState } from '@/types/mail';
import * as imapBridge from './imapBridge';
import * as mailCache from './mailCache';
import type { MailDatabaseConnection } from '@/models/mailDatabase';

// ============================================================
// Constants
// ============================================================

/** Default number of messages to fetch on initial sync */
const DEFAULT_INITIAL_LIMIT = 200;

/** AsyncStorage key prefix for sync state */
const SYNC_STATE_KEY_PREFIX = '@commeazy/mail_sync_';

// ============================================================
// Sync State Persistence
// ============================================================

/**
 * Build the AsyncStorage key for a sync state.
 */
function syncStateKey(accountId: string, folder: string): string {
  return `${SYNC_STATE_KEY_PREFIX}${accountId}_${folder}`;
}

/**
 * Load sync state from AsyncStorage.
 */
async function loadSyncState(
  accountId: string,
  folder: string,
): Promise<MailSyncState | null> {
  const json = await AsyncStorage.getItem(syncStateKey(accountId, folder));
  if (!json) return null;

  try {
    return JSON.parse(json) as MailSyncState;
  } catch {
    return null;
  }
}

/**
 * Save sync state to AsyncStorage.
 */
async function saveSyncState(state: MailSyncState): Promise<void> {
  await AsyncStorage.setItem(
    syncStateKey(state.accountId, state.folder),
    JSON.stringify(state),
  );
}

// ============================================================
// Initial Sync
// ============================================================

/**
 * Perform initial sync: connect, fetch latest headers, populate cache.
 *
 * This should be called when:
 * - User first configures a mail account
 * - Cache is cleared
 * - No sync state exists for the folder
 *
 * @param config - IMAP server configuration
 * @param db - Mail cache database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name (default: "INBOX")
 * @param limit - Maximum number of headers to fetch (default: 200)
 */
export async function initialSync(
  config: IMAPConfig,
  db: MailDatabaseConnection,
  accountId: string,
  folder: string = 'INBOX',
  limit: number = DEFAULT_INITIAL_LIMIT,
): Promise<void> {
  console.debug('[imapService] Starting initial sync for', folder);

  // Connect to IMAP
  await imapBridge.connectIMAP(config);

  try {
    // Fetch headers from server
    const headers = await imapBridge.fetchHeaders(folder, limit);

    if (headers.length === 0) {
      console.debug('[imapService] No messages found in', folder);
      await imapBridge.disconnect();
      return;
    }

    // Store headers in cache
    mailCache.upsertHeaders(db, accountId, folder, headers);

    // Compute sync boundaries
    const highestUid = Math.max(...headers.map(h => h.uid));
    const lowestUid = Math.min(...headers.map(h => h.uid));

    // Save sync state
    await saveSyncState({
      accountId,
      folder,
      highestUid,
      lowestUid,
      lastSyncAt: new Date().toISOString(),
    });

    console.debug(
      '[imapService] Initial sync complete:',
      headers.length, 'headers cached',
      '(UID range:', lowestUid, '-', highestUid, ')',
    );
  } finally {
    // Always disconnect
    await imapBridge.disconnect();
  }
}

// ============================================================
// Incremental Sync
// ============================================================

/**
 * Perform incremental sync: fetch only new messages since last sync.
 *
 * Uses UID-based comparison: fetches messages with UID > highest cached UID.
 * Falls back to initial sync if no sync state exists.
 *
 * @param config - IMAP server configuration
 * @param db - Mail cache database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name (default: "INBOX")
 * @returns Number of new messages fetched
 */
export async function incrementalSync(
  config: IMAPConfig,
  db: MailDatabaseConnection,
  accountId: string,
  folder: string = 'INBOX',
): Promise<number> {
  // Check if we have a previous sync state
  const syncState = await loadSyncState(accountId, folder);

  if (!syncState) {
    // No previous sync — do initial sync instead
    console.debug('[imapService] No sync state found, falling back to initial sync');
    await initialSync(config, db, accountId, folder);
    return mailCache.getHeaderCount(db, accountId, folder);
  }

  console.debug('[imapService] Starting incremental sync for', folder, 'from UID', syncState.highestUid);

  // Connect to IMAP
  await imapBridge.connectIMAP(config);

  try {
    // Fetch all headers (we'll filter client-side for new UIDs)
    // Native fetchHeaders returns the most recent N messages by sequence number.
    // For incremental sync, we fetch a reasonable batch and filter.
    const batchSize = 100;
    const headers = await imapBridge.fetchHeaders(folder, batchSize);

    // Filter to only new messages (UID > highest synced)
    const newHeaders = headers.filter(h => h.uid > syncState.highestUid);

    if (newHeaders.length === 0) {
      console.debug('[imapService] No new messages found');

      // Update sync timestamp even if no new messages
      await saveSyncState({
        ...syncState,
        lastSyncAt: new Date().toISOString(),
      });

      return 0;
    }

    // Store new headers in cache
    mailCache.upsertHeaders(db, accountId, folder, newHeaders);

    // Update sync state
    const newHighestUid = Math.max(
      syncState.highestUid,
      ...newHeaders.map(h => h.uid),
    );

    await saveSyncState({
      ...syncState,
      highestUid: newHighestUid,
      lastSyncAt: new Date().toISOString(),
    });

    console.debug(
      '[imapService] Incremental sync complete:',
      newHeaders.length, 'new headers cached',
    );

    return newHeaders.length;
  } finally {
    await imapBridge.disconnect();
  }
}

// ============================================================
// Flag Sync
// ============================================================

/**
 * Sync flag changes (read, flagged) to the server and update cache.
 *
 * @param config - IMAP server configuration
 * @param db - Mail cache database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 * @param uid - Message UID
 * @param flag - Flag to change
 * @param value - New flag value
 */
export async function syncFlag(
  config: IMAPConfig,
  db: MailDatabaseConnection,
  accountId: string,
  folder: string,
  uid: number,
  flag: 'read' | 'flagged',
  value: boolean,
): Promise<void> {
  // Update cache immediately (optimistic)
  if (flag === 'read') {
    mailCache.updateReadStatus(db, accountId, folder, uid, value);
  } else {
    mailCache.updateFlaggedStatus(db, accountId, folder, uid, value);
  }

  // Sync to server
  await imapBridge.connectIMAP(config);

  try {
    if (flag === 'read') {
      await imapBridge.markAsRead(uid, folder);
    } else {
      await imapBridge.markAsFlagged(uid, folder, value);
    }
  } finally {
    await imapBridge.disconnect();
  }
}

// ============================================================
// Message Body
// ============================================================

/**
 * Fetch a message body, using cache when available.
 *
 * @param config - IMAP server configuration
 * @param db - Mail cache database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 * @param uid - Message UID
 * @returns Message body (from cache or server)
 */
export async function fetchBody(
  config: IMAPConfig,
  db: MailDatabaseConnection,
  accountId: string,
  folder: string,
  uid: number,
): Promise<MailBody> {
  // Check cache first
  const cached = mailCache.getBody(db, accountId, uid);
  if (cached) {
    return {
      html: cached.html,
      plainText: cached.plainText,
      attachments: [], // Attachment meta is not cached in bodies table
    };
  }

  // Fetch from server
  await imapBridge.connectIMAP(config);

  try {
    const body = await imapBridge.fetchMessageBody(uid, folder);

    // Cache the body
    mailCache.upsertBody(db, accountId, uid, body.html, body.plainText);

    return body;
  } finally {
    await imapBridge.disconnect();
  }
}

// ============================================================
// Delete Message
// ============================================================

/**
 * Delete a message from server and cache.
 *
 * @param config - IMAP server configuration
 * @param db - Mail cache database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 * @param uid - Message UID
 */
export async function deleteMessage(
  config: IMAPConfig,
  db: MailDatabaseConnection,
  accountId: string,
  folder: string,
  uid: number,
): Promise<void> {
  // Delete from cache immediately (optimistic)
  mailCache.deleteHeader(db, accountId, folder, uid);

  // Delete from server
  await imapBridge.connectIMAP(config);

  try {
    await imapBridge.deleteMessage(uid, folder);
  } finally {
    await imapBridge.disconnect();
  }
}

// ============================================================
// Move Message
// ============================================================

/**
 * Move a message to another folder on server and update cache.
 *
 * @param config - IMAP server configuration
 * @param db - Mail cache database connection
 * @param accountId - Account identifier
 * @param fromFolder - Source mailbox
 * @param toFolder - Destination mailbox
 * @param uid - Message UID
 */
export async function moveMessage(
  config: IMAPConfig,
  db: MailDatabaseConnection,
  accountId: string,
  fromFolder: string,
  toFolder: string,
  uid: number,
): Promise<void> {
  // Remove from cache (source folder)
  mailCache.deleteHeader(db, accountId, fromFolder, uid);

  // Move on server
  await imapBridge.connectIMAP(config);

  try {
    await imapBridge.moveMessage(uid, fromFolder, toFolder);
  } finally {
    await imapBridge.disconnect();
  }
}

// ============================================================
// Local Cache Access (Offline-first)
// ============================================================

/**
 * Get messages from the local cache.
 * No network calls — fully offline.
 *
 * @param db - Mail cache database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 * @param limit - Maximum number of messages
 * @param offset - Pagination offset
 * @returns Array of cached mail headers
 */
export function getMessages(
  db: MailDatabaseConnection,
  accountId: string,
  folder: string,
  limit: number,
  offset: number = 0,
): CachedMailHeader[] {
  return mailCache.getHeaders(db, accountId, folder, limit, offset);
}

/**
 * Get sync state for a folder.
 *
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 * @returns Sync state or null
 */
export async function getSyncState(
  accountId: string,
  folder: string,
): Promise<MailSyncState | null> {
  return loadSyncState(accountId, folder);
}

/**
 * Clear sync state for an account (used when removing account).
 *
 * @param accountId - Account identifier
 */
export async function clearSyncState(accountId: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const syncKeys = keys.filter(k => k.startsWith(`${SYNC_STATE_KEY_PREFIX}${accountId}_`));
  if (syncKeys.length > 0) {
    await AsyncStorage.multiRemove(syncKeys);
  }
}
