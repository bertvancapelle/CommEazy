/**
 * Mail Database Setup — Separate SQLite database for mail cache + FTS5
 *
 * Uses op-sqlite for direct SQLite access with FTS5 support.
 * This is a SEPARATE database from the main WatermelonDB database.
 *
 * Why separate?
 * - WatermelonDB does not support FTS5 virtual tables
 * - Mail cache can be cleared independently without affecting chat data
 * - Full-text search on subject, sender, and body content
 *
 * Dependencies:
 * - op-sqlite (must be installed: npm install @op-engineering/op-sqlite)
 *
 * @see src/services/mail/mailCache.ts — Query layer
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 5.5
 */

// ============================================================
// Database Schema Version
// ============================================================

const MAIL_DB_VERSION = 1;
const MAIL_DB_NAME = 'mail_cache';

// ============================================================
// Schema SQL
// ============================================================

/**
 * SQL statements to create the mail cache schema.
 */
const SCHEMA_SQL = {
  /**
   * mail_headers — Cached email headers for offline access.
   * Primary key is (uid, account_id, folder) to handle multi-account.
   */
  createHeaders: `
    CREATE TABLE IF NOT EXISTS mail_headers (
      uid INTEGER NOT NULL,
      account_id TEXT NOT NULL,
      folder TEXT NOT NULL,
      from_raw TEXT,
      from_name TEXT,
      from_address TEXT,
      to_addresses TEXT,
      subject TEXT,
      date_iso TEXT,
      has_attachment INTEGER DEFAULT 0,
      is_read INTEGER DEFAULT 0,
      is_flagged INTEGER DEFAULT 0,
      sequence_number INTEGER DEFAULT 0,
      is_local INTEGER DEFAULT 0,
      PRIMARY KEY (uid, account_id, folder)
    );
  `,

  /**
   * mail_bodies — Cached email bodies (lazy-loaded).
   */
  createBodies: `
    CREATE TABLE IF NOT EXISTS mail_bodies (
      uid INTEGER NOT NULL,
      account_id TEXT NOT NULL,
      html TEXT,
      plain_text TEXT,
      PRIMARY KEY (uid, account_id)
    );
  `,

  /**
   * mail_fts — FTS5 virtual table for full-text search.
   * Indexes subject, sender address, and plain text body.
   * Content table is NOT used (external content) to avoid sync complexity.
   */
  createFTS: `
    CREATE VIRTUAL TABLE IF NOT EXISTS mail_fts USING fts5(
      uid UNINDEXED,
      account_id UNINDEXED,
      subject,
      from_address,
      plain_text,
      tokenize='unicode61'
    );
  `,

  /**
   * Index for efficient queries by account + folder + date.
   */
  createHeaderIndex: `
    CREATE INDEX IF NOT EXISTS idx_headers_account_folder_date
    ON mail_headers (account_id, folder, date_iso DESC);
  `,

  /**
   * Index for UID-based lookups within account/folder.
   */
  createHeaderUidIndex: `
    CREATE INDEX IF NOT EXISTS idx_headers_account_folder_uid
    ON mail_headers (account_id, folder, uid DESC);
  `,

  /**
   * Schema version tracking table.
   */
  createMeta: `
    CREATE TABLE IF NOT EXISTS mail_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `,
} as const;

// ============================================================
// Database Interface
// ============================================================

/**
 * Minimal interface for SQLite database operations.
 * This abstracts the actual SQLite library (op-sqlite, quick-sqlite, etc.)
 * so the implementation can be swapped without changing the cache layer.
 */
export interface MailDatabaseConnection {
  /** Execute a SQL statement (no results) */
  execute(sql: string, params?: unknown[]): void;

  /** Execute a SQL query and return rows */
  executeQuery<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): T[];

  /** Execute multiple statements in a transaction */
  transaction(fn: () => void): void;

  /** Close the database connection */
  close(): void;
}

// ============================================================
// Database Factory
// ============================================================

/**
 * Open or create the mail cache database.
 *
 * NOTE: This function requires op-sqlite to be installed.
 * If op-sqlite is not available, it will throw with instructions.
 *
 * @param encryptionKey - Hex string for SQLCipher encryption (optional during dev)
 * @returns Database connection wrapper
 */
export function openMailDatabase(encryptionKey?: string): MailDatabaseConnection {
  // Dynamic import to avoid crash if op-sqlite is not yet installed
  let opSqlite: any;
  try {
    opSqlite = require('@op-engineering/op-sqlite');
  } catch {
    throw new Error(
      '[mailDatabase] op-sqlite is not installed. ' +
      'Run: npm install @op-engineering/op-sqlite && cd ios && pod install',
    );
  }

  const { open } = opSqlite;

  // Open database with optional encryption
  const db = open({
    name: MAIL_DB_NAME,
    encryptionKey: encryptionKey || undefined,
  });

  // Enable WAL mode for better concurrent read/write performance
  db.execute('PRAGMA journal_mode = WAL;');

  // Wrapper implementing our interface
  const connection: MailDatabaseConnection = {
    execute(sql: string, params?: unknown[]) {
      db.execute(sql, params);
    },

    executeQuery<T = Record<string, unknown>>(
      sql: string,
      params?: unknown[],
    ): T[] {
      const result = db.execute(sql, params);
      return (result.rows?._array ?? result.rows ?? []) as T[];
    },

    transaction(fn: () => void) {
      db.transaction(fn);
    },

    close() {
      db.close();
    },
  };

  return connection;
}

/**
 * Initialize the mail database schema.
 * Creates tables, indexes, and FTS5 virtual table if they don't exist.
 *
 * @param db - Database connection
 */
export function initializeMailSchema(db: MailDatabaseConnection): void {
  db.transaction(() => {
    // Create tables
    db.execute(SCHEMA_SQL.createHeaders);
    db.execute(SCHEMA_SQL.createBodies);
    db.execute(SCHEMA_SQL.createFTS);
    db.execute(SCHEMA_SQL.createMeta);

    // Create indexes
    db.execute(SCHEMA_SQL.createHeaderIndex);
    db.execute(SCHEMA_SQL.createHeaderUidIndex);

    // Set schema version
    db.execute(
      'INSERT OR REPLACE INTO mail_meta (key, value) VALUES (?, ?)',
      ['schema_version', String(MAIL_DB_VERSION)],
    );
  });

  console.debug('[mailDatabase] Schema initialized (version ' + MAIL_DB_VERSION + ')');
}

/**
 * Drop all mail cache data (for "Clear Cache" in settings).
 *
 * @param db - Database connection
 */
export function clearMailDatabase(db: MailDatabaseConnection): void {
  db.transaction(() => {
    db.execute('DELETE FROM mail_fts');
    db.execute('DELETE FROM mail_bodies');
    db.execute('DELETE FROM mail_headers');
    db.execute('DELETE FROM mail_meta WHERE key != ?', ['schema_version']);
  });

  console.debug('[mailDatabase] Mail cache cleared');
}

export { MAIL_DB_VERSION, MAIL_DB_NAME };
