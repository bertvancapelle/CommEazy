/**
 * Mail Cache — SQLite query layer for cached mail headers and bodies
 *
 * Provides CRUD operations on the local mail SQLite database,
 * including FTS5 full-text search indexing.
 *
 * All operations are async because op-sqlite v9+ uses async APIs.
 *
 * @see src/models/mailDatabase.ts — Database setup
 * @see src/types/mail.ts — Type definitions
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 5.5
 */

import type {
  MailDatabaseConnection,
} from '@/models/mailDatabase';
import {
  openMailDatabase,
  initializeMailSchema,
  isFts5Available,
} from '@/models/mailDatabase';
import type {
  MailHeader,
  CachedMailHeader,
  CachedMailBody,
} from '@/types/mail';
import { parseEmailAddress } from '@/types/mail';

// ============================================================
// Singleton Instance
// ============================================================

let dbInstance: MailDatabaseConnection | null = null;
let dbInitialized = false;

/**
 * Get or create the mail cache database connection.
 * Initializes schema on first call.
 *
 * @param encryptionKey - Optional SQLCipher encryption key (hex string)
 * @returns Database connection
 */
export async function getMailCacheDb(encryptionKey?: string): Promise<MailDatabaseConnection> {
  if (!dbInstance) {
    dbInstance = openMailDatabase(encryptionKey);
  }
  if (!dbInitialized) {
    await initializeMailSchema(dbInstance);
    dbInitialized = true;
  }
  return dbInstance;
}

/**
 * Close the mail cache database connection.
 * Call this on app shutdown or when clearing cache.
 */
export function closeMailCacheDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbInitialized = false;
  }
}

// ============================================================
// Header Operations
// ============================================================

/**
 * Insert or update mail headers in the cache.
 * Also updates the FTS5 index for full-text search.
 *
 * @param db - Database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 * @param headers - Array of mail headers from the server
 */
export async function upsertHeaders(
  db: MailDatabaseConnection,
  accountId: string,
  folder: string,
  headers: MailHeader[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const header of headers) {
      // Parse the from string into name + address
      // Sanitize all values: op-sqlite rejects `undefined`, must be `null` or a concrete value
      const fromStr = header.from ?? '';
      const parsed = parseEmailAddress(fromStr);
      const subjectStr = header.subject ?? '';
      const dateStr = header.date ?? '';
      const toStr = JSON.stringify(header.to ?? []);
      const seqNum = header.sequenceNumber ?? 0;

      await tx.execute(
        `INSERT OR REPLACE INTO mail_headers
         (uid, account_id, folder, from_raw, from_name, from_address,
          to_addresses, subject, date_iso, has_attachment, is_read,
          is_flagged, sequence_number, is_local)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          header.uid,
          accountId,
          folder,
          fromStr,
          parsed.name ?? null,
          parsed.address ?? null,
          toStr,
          subjectStr,
          dateStr,
          header.hasAttachment ? 1 : 0,
          header.isRead ? 1 : 0,
          header.isFlagged ? 1 : 0,
          seqNum,
        ],
      );

      // Update FTS index (only if FTS5 is available)
      if (isFts5Available()) {
        await tx.execute(
          'DELETE FROM mail_fts WHERE uid = ? AND account_id = ?',
          [header.uid, accountId],
        );
        await tx.execute(
          `INSERT INTO mail_fts (uid, account_id, subject, from_address, plain_text)
           VALUES (?, ?, ?, ?, '')`,
          [header.uid, accountId, subjectStr, parsed.address ?? ''],
        );
      }
    }
  });
}

/**
 * Get cached headers for a folder, ordered by date descending.
 *
 * @param db - Database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 * @param limit - Maximum number of headers to return
 * @param offset - Number of headers to skip (for pagination)
 * @returns Array of cached mail headers
 */
export async function getHeaders(
  db: MailDatabaseConnection,
  accountId: string,
  folder: string,
  limit: number,
  offset: number = 0,
): Promise<CachedMailHeader[]> {
  const rows = await db.executeQuery<RawHeaderRow>(
    `SELECT * FROM mail_headers
     WHERE account_id = ? AND folder = ?
     ORDER BY date_iso DESC
     LIMIT ? OFFSET ?`,
    [accountId, folder, limit, offset],
  );

  return rows.map(rowToCachedHeader);
}

/**
 * Get a single cached header by UID.
 *
 * @param db - Database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 * @param uid - Message UID
 * @returns Cached header or null if not found
 */
export async function getHeaderByUid(
  db: MailDatabaseConnection,
  accountId: string,
  folder: string,
  uid: number,
): Promise<CachedMailHeader | null> {
  const rows = await db.executeQuery<RawHeaderRow>(
    `SELECT * FROM mail_headers
     WHERE uid = ? AND account_id = ? AND folder = ?
     LIMIT 1`,
    [uid, accountId, folder],
  );

  return rows.length > 0 ? rowToCachedHeader(rows[0]) : null;
}

/**
 * Get the highest UID in the cache for a folder.
 * Used for incremental sync.
 *
 * @param db - Database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 * @returns Highest UID or 0 if no headers cached
 */
export async function getHighestUid(
  db: MailDatabaseConnection,
  accountId: string,
  folder: string,
): Promise<number> {
  const rows = await db.executeQuery<{ max_uid: number | null }>(
    `SELECT MAX(uid) as max_uid FROM mail_headers
     WHERE account_id = ? AND folder = ?`,
    [accountId, folder],
  );

  return rows[0]?.max_uid ?? 0;
}

/**
 * Get the lowest UID in the cache for a folder.
 * Used as sync boundary.
 *
 * @param db - Database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 * @returns Lowest UID or 0 if no headers cached
 */
export async function getLowestUid(
  db: MailDatabaseConnection,
  accountId: string,
  folder: string,
): Promise<number> {
  const rows = await db.executeQuery<{ min_uid: number | null }>(
    `SELECT MIN(uid) as min_uid FROM mail_headers
     WHERE account_id = ? AND folder = ?`,
    [accountId, folder],
  );

  return rows[0]?.min_uid ?? 0;
}

/**
 * Get total number of cached headers for a folder.
 *
 * @param db - Database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 * @returns Number of cached headers
 */
export async function getHeaderCount(
  db: MailDatabaseConnection,
  accountId: string,
  folder: string,
): Promise<number> {
  const rows = await db.executeQuery<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM mail_headers
     WHERE account_id = ? AND folder = ?`,
    [accountId, folder],
  );

  return rows[0]?.cnt ?? 0;
}

/**
 * Update read status for a cached header.
 *
 * @param db - Database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 * @param uid - Message UID
 * @param isRead - New read status
 */
export async function updateReadStatus(
  db: MailDatabaseConnection,
  accountId: string,
  folder: string,
  uid: number,
  isRead: boolean,
): Promise<void> {
  await db.execute(
    `UPDATE mail_headers SET is_read = ?
     WHERE uid = ? AND account_id = ? AND folder = ?`,
    [isRead ? 1 : 0, uid, accountId, folder],
  );
}

/**
 * Update flagged status for a cached header.
 *
 * @param db - Database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 * @param uid - Message UID
 * @param isFlagged - New flagged status
 */
export async function updateFlaggedStatus(
  db: MailDatabaseConnection,
  accountId: string,
  folder: string,
  uid: number,
  isFlagged: boolean,
): Promise<void> {
  await db.execute(
    `UPDATE mail_headers SET is_flagged = ?
     WHERE uid = ? AND account_id = ? AND folder = ?`,
    [isFlagged ? 1 : 0, uid, accountId, folder],
  );
}

/**
 * Delete a cached header and its body.
 *
 * @param db - Database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 * @param uid - Message UID
 */
export async function deleteHeader(
  db: MailDatabaseConnection,
  accountId: string,
  folder: string,
  uid: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    if (isFts5Available()) {
      await tx.execute(
        'DELETE FROM mail_fts WHERE uid = ? AND account_id = ?',
        [uid, accountId],
      );
    }
    await tx.execute(
      'DELETE FROM mail_bodies WHERE uid = ? AND account_id = ?',
      [uid, accountId],
    );
    await tx.execute(
      'DELETE FROM mail_headers WHERE uid = ? AND account_id = ? AND folder = ?',
      [uid, accountId, folder],
    );
  });
}

// ============================================================
// Body Operations
// ============================================================

/**
 * Insert or update a mail body in the cache.
 * Also updates the FTS5 index with the plain text body.
 *
 * @param db - Database connection
 * @param accountId - Account identifier
 * @param uid - Message UID
 * @param html - HTML body content
 * @param plainText - Plain text body content
 */
export async function upsertBody(
  db: MailDatabaseConnection,
  accountId: string,
  uid: number,
  html?: string,
  plainText?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(
      `INSERT OR REPLACE INTO mail_bodies (uid, account_id, html, plain_text)
       VALUES (?, ?, ?, ?)`,
      [uid, accountId, html ?? null, plainText ?? null],
    );

    // Update FTS index with body text (only if FTS5 is available)
    if (plainText && isFts5Available()) {
      // Truncate plain text for FTS to avoid huge index entries
      const truncatedText = plainText.substring(0, 10000);

      // Get existing FTS row to preserve subject/from_address
      const existing = await tx.executeQuery<{ subject: string; from_address: string }>(
        'SELECT subject, from_address FROM mail_fts WHERE uid = ? AND account_id = ?',
        [uid, accountId],
      );

      if (existing.length > 0) {
        // Update existing FTS entry with body text
        await tx.execute(
          'DELETE FROM mail_fts WHERE uid = ? AND account_id = ?',
          [uid, accountId],
        );
        await tx.execute(
          `INSERT INTO mail_fts (uid, account_id, subject, from_address, plain_text)
           VALUES (?, ?, ?, ?, ?)`,
          [uid, accountId, existing[0].subject, existing[0].from_address, truncatedText],
        );
      }
    }
  });
}

/**
 * Get a cached mail body by UID.
 *
 * @param db - Database connection
 * @param accountId - Account identifier
 * @param uid - Message UID
 * @returns Cached body or null if not cached
 */
export async function getBody(
  db: MailDatabaseConnection,
  accountId: string,
  uid: number,
): Promise<CachedMailBody | null> {
  const rows = await db.executeQuery<{
    uid: number;
    account_id: string;
    html: string | null;
    plain_text: string | null;
  }>(
    'SELECT * FROM mail_bodies WHERE uid = ? AND account_id = ? LIMIT 1',
    [uid, accountId],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    uid: row.uid,
    accountId: row.account_id,
    html: row.html ?? undefined,
    plainText: row.plain_text ?? undefined,
  };
}

/**
 * Check if a body is cached for a given UID.
 *
 * @param db - Database connection
 * @param accountId - Account identifier
 * @param uid - Message UID
 * @returns Whether the body is cached
 */
export async function hasBody(
  db: MailDatabaseConnection,
  accountId: string,
  uid: number,
): Promise<boolean> {
  const rows = await db.executeQuery<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM mail_bodies WHERE uid = ? AND account_id = ?',
    [uid, accountId],
  );

  return (rows[0]?.cnt ?? 0) > 0;
}

// ============================================================
// FTS5 Search
// ============================================================

/**
 * Search the local mail cache using FTS5 full-text search.
 *
 * @param db - Database connection
 * @param accountId - Account identifier
 * @param query - Search query string
 * @param limit - Maximum number of results
 * @returns Array of matching UIDs with relevance ranking
 */
export async function searchLocal(
  db: MailDatabaseConnection,
  accountId: string,
  query: string,
  limit: number = 100,
): Promise<number[]> {
  if (!query.trim()) return [];

  // FTS5 not available — fall back to LIKE search on headers
  if (!isFts5Available()) {
    const likeQuery = `%${query.trim()}%`;
    const rows = await db.executeQuery<{ uid: number }>(
      `SELECT uid FROM mail_headers
       WHERE account_id = ? AND (subject LIKE ? OR from_raw LIKE ?)
       ORDER BY date_iso DESC
       LIMIT ?`,
      [accountId, likeQuery, likeQuery, limit],
    );
    return rows.map(r => r.uid);
  }

  // Escape the query for FTS5 (wrap each word in quotes for safety)
  const sanitized = query
    .trim()
    .split(/\s+/)
    .map(word => `"${word.replace(/"/g, '')}"`)
    .join(' ');

  const rows = await db.executeQuery<{ uid: number }>(
    `SELECT uid FROM mail_fts
     WHERE account_id = ? AND mail_fts MATCH ?
     ORDER BY rank
     LIMIT ?`,
    [accountId, sanitized, limit],
  );

  return rows.map(r => r.uid);
}

// ============================================================
// Cleanup
// ============================================================

/**
 * Delete all cached data for an account.
 *
 * @param db - Database connection
 * @param accountId - Account identifier
 */
export async function deleteAccountData(
  db: MailDatabaseConnection,
  accountId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    if (isFts5Available()) {
      await tx.execute('DELETE FROM mail_fts WHERE account_id = ?', [accountId]);
    }
    await tx.execute('DELETE FROM mail_bodies WHERE account_id = ?', [accountId]);
    await tx.execute('DELETE FROM mail_headers WHERE account_id = ?', [accountId]);
  });

  console.debug('[mailCache] Cleared all data for account:', accountId);
}

/**
 * Delete all cached data for a specific folder.
 *
 * @param db - Database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 */
export async function deleteFolderData(
  db: MailDatabaseConnection,
  accountId: string,
  folder: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Get UIDs in this folder for FTS + body cleanup
    const uids = await tx.executeQuery<{ uid: number }>(
      'SELECT uid FROM mail_headers WHERE account_id = ? AND folder = ?',
      [accountId, folder],
    );

    for (const { uid } of uids) {
      if (isFts5Available()) {
        await tx.execute('DELETE FROM mail_fts WHERE uid = ? AND account_id = ?', [uid, accountId]);
      }
      await tx.execute('DELETE FROM mail_bodies WHERE uid = ? AND account_id = ?', [uid, accountId]);
    }

    await tx.execute(
      'DELETE FROM mail_headers WHERE account_id = ? AND folder = ?',
      [accountId, folder],
    );
  });
}

// ============================================================
// Internal Helpers
// ============================================================

/** Raw row shape from SQLite query */
interface RawHeaderRow {
  uid: number;
  account_id: string;
  folder: string;
  from_raw: string | null;
  from_name: string | null;
  from_address: string | null;
  to_addresses: string | null;
  subject: string | null;
  date_iso: string | null;
  has_attachment: number;
  is_read: number;
  is_flagged: number;
  sequence_number: number;
  is_local: number;
}

/** Convert a raw SQLite row to a CachedMailHeader */
function rowToCachedHeader(row: RawHeaderRow): CachedMailHeader {
  let toArray: string[] = [];
  try {
    toArray = row.to_addresses ? JSON.parse(row.to_addresses) : [];
  } catch {
    toArray = [];
  }

  return {
    uid: row.uid,
    accountId: row.account_id,
    folder: row.folder,
    from: row.from_raw ?? '',
    fromName: row.from_name ?? undefined,
    fromAddress: row.from_address ?? undefined,
    to: toArray,
    subject: row.subject ?? '',
    date: row.date_iso ?? '',
    hasAttachment: row.has_attachment === 1,
    isRead: row.is_read === 1,
    isFlagged: row.is_flagged === 1,
    sequenceNumber: row.sequence_number,
    isLocal: row.is_local === 1,
  };
}
