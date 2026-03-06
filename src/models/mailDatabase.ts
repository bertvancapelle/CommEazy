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

const MAIL_DB_VERSION = 2;
const MAIL_DB_NAME = 'mail_cache';

/** Whether FTS5 is available in the current SQLite build */
let _fts5Available = false;

/**
 * Check if FTS5 full-text search is available.
 * Returns false if op-sqlite was not compiled with FTS5 support.
 */
export function isFts5Available(): boolean {
  return _fts5Available;
}

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
 * All operations are async because op-sqlite v9+ uses async APIs.
 */
export interface MailDatabaseConnection {
  /** Execute a SQL statement (no results) */
  execute(sql: string, params?: unknown[]): Promise<void>;

  /** Execute a SQL query and return rows */
  executeQuery<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;

  /** Execute multiple statements in a transaction */
  transaction(fn: (tx: MailDatabaseTransaction) => Promise<void>): Promise<void>;

  /** Close the database connection */
  close(): void;
}

/**
 * Transaction interface for executing queries within a transaction.
 */
export interface MailDatabaseTransaction {
  execute(sql: string, params?: unknown[]): Promise<void>;
  executeQuery<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
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
  let opSqlite: { open: (options: Record<string, string>) => Record<string, unknown> };
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
  const openOptions: Record<string, string> = { name: MAIL_DB_NAME };
  if (encryptionKey) {
    openOptions.encryptionKey = encryptionKey;
  }
  const db = open(openOptions);

  // Sanitize bind parameters: op-sqlite rejects `undefined`, convert to `null`
  function sanitizeParams(params?: unknown[]): unknown[] | undefined {
    if (!params) return params;
    return params.map(p => (p === undefined ? null : p));
  }

  // Wrapper implementing our async interface
  const connection: MailDatabaseConnection = {
    async execute(sql: string, params?: unknown[]) {
      await db.execute(sql, sanitizeParams(params));
    },

    async executeQuery<T = Record<string, unknown>>(
      sql: string,
      params?: unknown[],
    ): Promise<T[]> {
      const result = await db.execute(sql, sanitizeParams(params));
      return (result.rows ?? []) as T[];
    },

    async transaction(fn: (tx: MailDatabaseTransaction) => Promise<void>) {
      await db.transaction(async (nativeTx: { execute: (sql: string, params?: unknown[]) => Promise<{ rows?: unknown[] }> }) => {
        const tx: MailDatabaseTransaction = {
          async execute(sql: string, params?: unknown[]) {
            await nativeTx.execute(sql, sanitizeParams(params));
          },
          async executeQuery<T = Record<string, unknown>>(
            sql: string,
            params?: unknown[],
          ): Promise<T[]> {
            const result = await nativeTx.execute(sql, sanitizeParams(params));
            return (result.rows ?? []) as T[];
          },
        };
        await fn(tx);
      });
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
export async function initializeMailSchema(db: MailDatabaseConnection): Promise<void> {
  // Enable WAL mode for better concurrent read/write performance
  await db.execute('PRAGMA journal_mode = WAL;');

  // Core tables — these MUST succeed
  await db.transaction(async (tx) => {
    await tx.execute(SCHEMA_SQL.createHeaders);
    await tx.execute(SCHEMA_SQL.createBodies);
    await tx.execute(SCHEMA_SQL.createMeta);

    // Create indexes
    await tx.execute(SCHEMA_SQL.createHeaderIndex);
    await tx.execute(SCHEMA_SQL.createHeaderUidIndex);

    // Set schema version
    await tx.execute(
      'INSERT OR REPLACE INTO mail_meta (key, value) VALUES (?, ?)',
      ['schema_version', String(MAIL_DB_VERSION)],
    );
  });

  // Schema migrations
  try {
    const versionRows = await db.executeQuery<{ value: string }>(
      "SELECT value FROM mail_meta WHERE key = 'schema_version'",
    );
    const currentVersion = versionRows.length > 0 ? parseInt(versionRows[0].value, 10) : 1;

    if (currentVersion < 2) {
      // V2: Add attachments_json column to mail_bodies for attachment metadata caching
      try {
        await db.execute('ALTER TABLE mail_bodies ADD COLUMN attachments_json TEXT');
        console.debug('[mailDatabase] Migration v2: added attachments_json column');
      } catch {
        // Column may already exist if migration was partially applied
      }
      await db.execute(
        "INSERT OR REPLACE INTO mail_meta (key, value) VALUES ('schema_version', '2')",
      );
    }
  } catch {
    console.debug('[mailDatabase] Migration check skipped (meta table may not exist yet)');
  }

  // FTS5 — optional, may not be compiled into op-sqlite
  try {
    await db.execute(SCHEMA_SQL.createFTS);
    _fts5Available = true;
    console.debug('[mailDatabase] FTS5 search available');
  } catch (ftsErr) {
    _fts5Available = false;
    console.debug('[mailDatabase] FTS5 not available (search disabled) —',
      ftsErr instanceof Error ? ftsErr.message : String(ftsErr));
  }

  console.debug('[mailDatabase] Schema initialized (version ' + MAIL_DB_VERSION + ')');
}

/**
 * Drop all mail cache data (for "Clear Cache" in settings).
 *
 * @param db - Database connection
 */
export async function clearMailDatabase(db: MailDatabaseConnection): Promise<void> {
  await db.transaction(async (tx) => {
    if (_fts5Available) {
      await tx.execute('DELETE FROM mail_fts');
    }
    await tx.execute('DELETE FROM mail_bodies');
    await tx.execute('DELETE FROM mail_headers');
    await tx.execute('DELETE FROM mail_meta WHERE key != ?', ['schema_version']);
  });

  console.debug('[mailDatabase] Mail cache cleared');
}

export { MAIL_DB_VERSION, MAIL_DB_NAME };
