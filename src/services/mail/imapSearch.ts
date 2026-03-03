/**
 * IMAP Search — Combined local FTS5 + remote IMAP search
 *
 * Search strategy:
 * 1. FTS5 query on local SQLite cache (instant, offline)
 * 2. Parallel IMAP SEARCH on server (covers unsynced messages)
 * 3. Combine and deduplicate results by UID
 * 4. Server-only results marked with source: 'server_only'
 *
 * @see src/services/mail/mailCache.ts — Local FTS5 search
 * @see src/services/mail/imapBridge.ts — Remote IMAP search
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 5.4
 */

import type { IMAPConfig, MailSearchResult, CachedMailHeader } from '@/types/mail';
import type { MailDatabaseConnection } from '@/models/mailDatabase';
import * as imapBridge from './imapBridge';
import * as mailCache from './mailCache';

// ============================================================
// Combined Search
// ============================================================

/**
 * Search mail messages using combined local + remote search.
 *
 * Runs local FTS5 search and remote IMAP SEARCH in parallel,
 * then merges and deduplicates the results.
 *
 * Local results have full header data available immediately.
 * Server-only results need their body fetched on-demand when opened.
 *
 * @param config - IMAP configuration (for remote search)
 * @param db - Mail cache database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 * @param query - Search query string
 * @param limit - Maximum results (default: 100)
 * @returns Combined, deduplicated search results
 */
export async function search(
  config: IMAPConfig,
  db: MailDatabaseConnection,
  accountId: string,
  folder: string,
  query: string,
  limit: number = 100,
): Promise<MailSearchResult[]> {
  if (!query.trim()) return [];

  // Phase 1 & 2: Run local and remote search in parallel
  const [localUids, remoteUids] = await Promise.all([
    searchLocal(db, accountId, query, limit),
    searchRemote(config, folder, query).catch(err => {
      // Remote search failure is non-fatal — return local results only
      console.warn('[imapSearch] Remote search failed, using local results only:', err);
      return [] as number[];
    }),
  ]);

  // Phase 3: Combine and deduplicate
  return combineResults(db, accountId, folder, localUids, remoteUids);
}

/**
 * Search only the local cache (offline).
 * Useful when there's no network connectivity.
 *
 * @param db - Mail cache database connection
 * @param accountId - Account identifier
 * @param query - Search query string
 * @param limit - Maximum results
 * @returns Array of matching UIDs
 */
export function searchLocal(
  db: MailDatabaseConnection,
  accountId: string,
  query: string,
  limit: number = 100,
): number[] {
  return mailCache.searchLocal(db, accountId, query, limit);
}

// ============================================================
// Remote Search
// ============================================================

/**
 * Search on the IMAP server.
 * Connects, searches, and disconnects.
 *
 * @param config - IMAP configuration
 * @param folder - Mailbox folder name
 * @param query - Search query string
 * @returns Array of matching UIDs from the server
 */
async function searchRemote(
  config: IMAPConfig,
  folder: string,
  query: string,
): Promise<number[]> {
  await imapBridge.connectIMAP(config);

  try {
    const uids = await imapBridge.searchMessages(folder, query);
    return uids;
  } finally {
    await imapBridge.disconnect();
  }
}

// ============================================================
// Result Combining
// ============================================================

/**
 * Combine local and remote search results, deduplicating by UID.
 *
 * - Local matches: return with full CachedMailHeader data
 * - Server-only matches (UID found remotely but not cached): marked as 'server_only'
 * - Sorted by UID descending (newer messages first, since UIDs are monotonically increasing)
 *
 * @param db - Database connection
 * @param accountId - Account identifier
 * @param folder - Mailbox folder name
 * @param localUids - UIDs from local FTS5 search
 * @param remoteUids - UIDs from remote IMAP search
 * @returns Merged search results
 */
function combineResults(
  db: MailDatabaseConnection,
  accountId: string,
  folder: string,
  localUids: number[],
  remoteUids: number[],
): MailSearchResult[] {
  // Build a set of all unique UIDs
  const allUids = new Set<number>([...localUids, ...remoteUids]);
  const localUidSet = new Set<number>(localUids);

  const results: MailSearchResult[] = [];

  for (const uid of allUids) {
    if (localUidSet.has(uid)) {
      // Available locally — get cached header
      const header = mailCache.getHeaderByUid(db, accountId, folder, uid);
      results.push({
        uid,
        source: 'local',
        header: header ?? undefined,
      });
    } else {
      // Server-only — header will be fetched on-demand
      results.push({
        uid,
        source: 'server_only',
      });
    }
  }

  // Sort by UID descending (newer messages typically have higher UIDs)
  results.sort((a, b) => b.uid - a.uid);

  return results;
}
