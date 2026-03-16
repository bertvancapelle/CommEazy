// ============================================================
// CommEazy Invitation Relay
// Version: 1.0.0
//
// Encrypted "mailbox" server for contact invitation exchange.
// Stores encrypted blobs that only the sender and recipient can read.
//
// Endpoints:
//   POST   /api/v1/invitations              — Upload invitation blob
//   GET    /api/v1/invitations/:code         — Download invitation blob
//   PUT    /api/v1/invitations/:code/response — Upload response blob
//   GET    /api/v1/invitations/:code/response — Download response blob
//   DELETE /api/v1/invitations/:code         — Delete invitation
//
// Zero-server-storage compliance:
//   - Server stores ONLY encrypted blobs (AES-256-GCM)
//   - Server CANNOT read blob contents
//   - Decryption key derived from invitation code (shared out-of-band)
//   - Blobs auto-deleted after 7 days
//   - Response blobs deleted immediately after retrieval
//
// Port 5283 chosen to sit alongside Prosody (5280) and Push Gateway (5282).
// ============================================================

require('dotenv').config();

const express = require('express');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const path = require('path');

// --- Configuration ---
const PORT = parseInt(process.env.PORT || '5283', 10);
const HOST = process.env.HOST || '127.0.0.1';
const BLOB_TTL_DAYS = parseInt(process.env.BLOB_TTL_DAYS || '7', 10);
const MAX_BLOB_SIZE = parseInt(process.env.MAX_BLOB_SIZE || '4096', 10);
const CLEANUP_INTERVAL_MS = parseInt(process.env.CLEANUP_INTERVAL_MS || '3600000', 10);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'invitations.db');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// --- Logger ---
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const log = {
  debug: (...args) => LOG_LEVELS[LOG_LEVEL] <= 0 && console.log('[DEBUG]', new Date().toISOString(), ...args),
  info:  (...args) => LOG_LEVELS[LOG_LEVEL] <= 1 && console.log('[INFO]', new Date().toISOString(), ...args),
  warn:  (...args) => LOG_LEVELS[LOG_LEVEL] <= 2 && console.warn('[WARN]', new Date().toISOString(), ...args),
  error: (...args) => LOG_LEVELS[LOG_LEVEL] <= 3 && console.error('[ERROR]', new Date().toISOString(), ...args),
};

// --- Database Setup ---
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS invitations (
    code TEXT PRIMARY KEY,
    encrypted_blob TEXT NOT NULL,
    nonce TEXT NOT NULL,
    creator_uuid TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS responses (
    code TEXT PRIMARY KEY REFERENCES invitations(code) ON DELETE CASCADE,
    encrypted_blob TEXT NOT NULL,
    nonce TEXT NOT NULL,
    responder_uuid TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_invitations_expires ON invitations(expires_at);
`);

// Prepared statements
const stmts = {
  insertInvitation: db.prepare(`
    INSERT INTO invitations (code, encrypted_blob, nonce, creator_uuid, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `),
  getInvitation: db.prepare(`
    SELECT encrypted_blob, nonce, creator_uuid, created_at, expires_at
    FROM invitations WHERE code = ? AND expires_at > strftime('%s', 'now')
  `),
  deleteInvitation: db.prepare(`
    DELETE FROM invitations WHERE code = ?
  `),
  insertResponse: db.prepare(`
    INSERT INTO responses (code, encrypted_blob, nonce, responder_uuid)
    VALUES (?, ?, ?, ?)
  `),
  getResponse: db.prepare(`
    SELECT encrypted_blob, nonce, responder_uuid, created_at
    FROM responses WHERE code = ?
  `),
  deleteResponse: db.prepare(`
    DELETE FROM responses WHERE code = ?
  `),
  cleanupExpired: db.prepare(`
    DELETE FROM invitations WHERE expires_at <= strftime('%s', 'now')
  `),
  countActive: db.prepare(`
    SELECT COUNT(*) as count FROM invitations WHERE expires_at > strftime('%s', 'now')
  `),
};

// --- Metrics ---
const metrics = {
  invitationsCreated: 0,
  invitationsRetrieved: 0,
  responsesCreated: 0,
  responsesRetrieved: 0,
  invitationsExpired: 0,
  startTime: Date.now(),
};

// --- Express App ---
const app = express();
app.use(express.json({ limit: `${MAX_BLOB_SIZE + 512}` }));

// Rate limiting (60 req/min — same as API Gateway)
app.use(rateLimit({
  windowMs: 60000,
  max: 60,
  message: { error: 'RATE_LIMITED', message: 'Too many requests' },
}));

// --- Health Check ---
app.get('/health', (req, res) => {
  const active = stmts.countActive.get();
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
    activeInvitations: active.count,
    version: '1.0.0',
  });
});

// --- Metrics ---
app.get('/metrics', (req, res) => {
  res.type('text/plain').send([
    `# HELP relay_invitations_created_total Total invitations created`,
    `# TYPE relay_invitations_created_total counter`,
    `relay_invitations_created_total ${metrics.invitationsCreated}`,
    `relay_invitations_retrieved_total ${metrics.invitationsRetrieved}`,
    `relay_responses_created_total ${metrics.responsesCreated}`,
    `relay_responses_retrieved_total ${metrics.responsesRetrieved}`,
    `relay_invitations_expired_total ${metrics.invitationsExpired}`,
    `# HELP relay_uptime_seconds Relay uptime`,
    `# TYPE relay_uptime_seconds gauge`,
    `relay_uptime_seconds ${Math.floor((Date.now() - metrics.startTime) / 1000)}`,
  ].join('\n') + '\n');
});

// ============================================================
// Invitation Endpoints
// ============================================================

/**
 * POST /api/v1/invitations
 * Upload an encrypted invitation blob.
 *
 * Body: { code, encrypted, nonce }
 * Header: X-User-UUID (set by API Gateway)
 */
app.post('/api/v1/invitations', (req, res) => {
  const { code, encrypted, nonce } = req.body;
  const creatorUuid = req.headers['x-user-uuid'];

  if (!code || !encrypted || !nonce) {
    return res.status(400).json({
      error: 'MISSING_FIELDS',
      message: 'code, encrypted, and nonce are required',
    });
  }

  // Validate code format: CE-XXXX-XXXX (legacy) or CE-XXXX-XXXX-XXXX (new)
  if (!/^CE-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}(-[2-9A-HJ-KM-NP-Z]{4})?$/.test(code)) {
    return res.status(400).json({
      error: 'INVALID_CODE',
      message: 'Code must match format CE-XXXX-XXXX or CE-XXXX-XXXX-XXXX',
    });
  }

  // Validate blob size
  if (encrypted.length > MAX_BLOB_SIZE) {
    return res.status(400).json({
      error: 'BLOB_TOO_LARGE',
      message: `Encrypted blob exceeds maximum size of ${MAX_BLOB_SIZE} bytes`,
    });
  }

  // Check for duplicate code
  const existing = stmts.getInvitation.get(code);
  if (existing) {
    return res.status(409).json({
      error: 'CODE_EXISTS',
      message: 'An invitation with this code already exists',
    });
  }

  // Calculate expiry
  const expiresAt = Math.floor(Date.now() / 1000) + (BLOB_TTL_DAYS * 24 * 60 * 60);

  try {
    stmts.insertInvitation.run(code, encrypted, nonce, creatorUuid || 'unknown', expiresAt);
    metrics.invitationsCreated++;
    log.info('Invitation created', { code: code.slice(0, 7) + '...' });

    res.status(201).json({
      code,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      ttlDays: BLOB_TTL_DAYS,
    });
  } catch (err) {
    log.error('Failed to create invitation', { error: err.message });
    res.status(500).json({ error: 'INTERNAL', message: 'Failed to store invitation' });
  }
});

/**
 * GET /api/v1/invitations/:code
 * Download an encrypted invitation blob.
 */
app.get('/api/v1/invitations/:code', (req, res) => {
  const { code } = req.params;

  // Validate code format
  if (!/^CE-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}(-[2-9A-HJ-KM-NP-Z]{4})?$/.test(code)) {
    return res.status(400).json({
      error: 'INVALID_CODE',
      message: 'Code must match format CE-XXXX-XXXX or CE-XXXX-XXXX-XXXX',
    });
  }

  const invitation = stmts.getInvitation.get(code);
  if (!invitation) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Invitation not found or expired',
    });
  }

  metrics.invitationsRetrieved++;
  log.info('Invitation retrieved', { code: code.slice(0, 7) + '...' });

  res.json({
    encrypted: invitation.encrypted_blob,
    nonce: invitation.nonce,
    createdAt: new Date(invitation.created_at * 1000).toISOString(),
    expiresAt: new Date(invitation.expires_at * 1000).toISOString(),
  });
});

/**
 * PUT /api/v1/invitations/:code/response
 * Upload a response blob (from the invitation acceptor).
 */
app.put('/api/v1/invitations/:code/response', (req, res) => {
  const { code } = req.params;
  const { encrypted, nonce } = req.body;
  const responderUuid = req.headers['x-user-uuid'];

  // Validate code format
  if (!/^CE-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}(-[2-9A-HJ-KM-NP-Z]{4})?$/.test(code)) {
    return res.status(400).json({
      error: 'INVALID_CODE',
      message: 'Code must match format CE-XXXX-XXXX or CE-XXXX-XXXX-XXXX',
    });
  }

  if (!encrypted || !nonce) {
    return res.status(400).json({
      error: 'MISSING_FIELDS',
      message: 'encrypted and nonce are required',
    });
  }

  // Verify the invitation exists
  const invitation = stmts.getInvitation.get(code);
  if (!invitation) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Invitation not found or expired',
    });
  }

  // Check for existing response
  const existingResponse = stmts.getResponse.get(code);
  if (existingResponse) {
    return res.status(409).json({
      error: 'RESPONSE_EXISTS',
      message: 'A response already exists for this invitation',
    });
  }

  // Validate blob size
  if (encrypted.length > MAX_BLOB_SIZE) {
    return res.status(400).json({
      error: 'BLOB_TOO_LARGE',
      message: `Response blob exceeds maximum size of ${MAX_BLOB_SIZE} bytes`,
    });
  }

  try {
    stmts.insertResponse.run(code, encrypted, nonce, responderUuid || 'unknown');
    metrics.responsesCreated++;
    log.info('Response created', { code: code.slice(0, 7) + '...' });

    res.status(201).json({ status: 'ok' });
  } catch (err) {
    log.error('Failed to create response', { error: err.message });
    res.status(500).json({ error: 'INTERNAL', message: 'Failed to store response' });
  }
});

/**
 * GET /api/v1/invitations/:code/response
 * Download the response blob.
 * Response is deleted after retrieval (one-time read).
 */
app.get('/api/v1/invitations/:code/response', (req, res) => {
  const { code } = req.params;

  // Validate code format
  if (!/^CE-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}(-[2-9A-HJ-KM-NP-Z]{4})?$/.test(code)) {
    return res.status(400).json({
      error: 'INVALID_CODE',
      message: 'Code must match format CE-XXXX-XXXX or CE-XXXX-XXXX-XXXX',
    });
  }

  const response = stmts.getResponse.get(code);
  if (!response) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: 'No response found for this invitation',
    });
  }

  // Delete response after retrieval (one-time read)
  stmts.deleteResponse.run(code);

  // Also delete the invitation — exchange complete
  stmts.deleteInvitation.run(code);

  metrics.responsesRetrieved++;
  log.info('Response retrieved and cleaned up', { code: code.slice(0, 7) + '...' });

  res.json({
    encrypted: response.encrypted_blob,
    nonce: response.nonce,
    createdAt: new Date(response.created_at * 1000).toISOString(),
  });
});

/**
 * DELETE /api/v1/invitations/:code
 * Manually delete an invitation (e.g., cancelled by sender).
 */
app.delete('/api/v1/invitations/:code', (req, res) => {
  const { code } = req.params;
  const userUuid = req.headers['x-user-uuid'];

  // Validate code format
  if (!/^CE-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}(-[2-9A-HJ-KM-NP-Z]{4})?$/.test(code)) {
    return res.status(400).json({
      error: 'INVALID_CODE',
      message: 'Code must match format CE-XXXX-XXXX or CE-XXXX-XXXX-XXXX',
    });
  }

  // Verify ownership
  const invitation = stmts.getInvitation.get(code);
  if (!invitation) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Invitation not found',
    });
  }

  if (invitation.creator_uuid !== userUuid) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Only the creator can delete this invitation',
    });
  }

  stmts.deleteInvitation.run(code);
  log.info('Invitation deleted by creator', { code: code.slice(0, 7) + '...' });

  res.json({ status: 'deleted' });
});

// ============================================================
// TTL Cleanup
// ============================================================

function runCleanup() {
  try {
    const result = stmts.cleanupExpired.run();
    if (result.changes > 0) {
      metrics.invitationsExpired += result.changes;
      log.info('Cleaned up expired invitations', { count: result.changes });
    }
  } catch (err) {
    log.error('Cleanup failed', { error: err.message });
  }
}

// Run cleanup periodically
setInterval(runCleanup, CLEANUP_INTERVAL_MS);

// Run cleanup on startup
runCleanup();

// ============================================================
// Start Server
// ============================================================

app.listen(PORT, HOST, () => {
  log.info(`Invitation Relay listening on ${HOST}:${PORT}`);
  log.info(`Blob TTL: ${BLOB_TTL_DAYS} days`);
  log.info(`Max blob size: ${MAX_BLOB_SIZE} bytes`);
  log.info(`Cleanup interval: ${CLEANUP_INTERVAL_MS / 1000}s`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  log.info('Shutting down...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log.info('Shutting down...');
  db.close();
  process.exit(0);
});
