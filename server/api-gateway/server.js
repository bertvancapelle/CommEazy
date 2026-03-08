// ============================================================
// CommEazy API Gateway
// Version: 1.0.0
//
// Central access point for all CommEazy server-side services.
// Validates JWT tokens and routes requests to backend services.
//
// Architecture:
//   Internet → API Gateway (:8443) → Backend Services
//     ├── Invitation Relay (:5283)
//     ├── Push Gateway (:5282)
//     └── Prosody HTTP APIs (:5280)
//
// XMPP WebSocket goes DIRECTLY to Prosody, NOT through this gateway.
//
// Port 8443 chosen as standard HTTPS alternative port.
// ============================================================

require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { jwtAuth, generateAccessToken, generateRefreshToken } = require('./middleware/jwtAuth');
const { apiRateLimiter } = require('./middleware/rateLimit');
const { verifyAppleAttestation, verifyAppleAssertion, hasAttestation } = require('./middleware/attestation');

// --- Configuration ---
const PORT = parseInt(process.env.PORT || '8443', 10);
const HOST = process.env.HOST || '0.0.0.0';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const PUSH_GATEWAY_URL = process.env.PUSH_GATEWAY_URL || 'http://127.0.0.1:5282';
const INVITATION_RELAY_URL = process.env.INVITATION_RELAY_URL || 'http://127.0.0.1:5283';
const PROSODY_HTTP_URL = process.env.PROSODY_HTTP_URL || 'http://127.0.0.1:5280';

// --- Logger ---
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const log = {
  debug: (...args) => LOG_LEVELS[LOG_LEVEL] <= 0 && console.log('[DEBUG]', new Date().toISOString(), ...args),
  info:  (...args) => LOG_LEVELS[LOG_LEVEL] <= 1 && console.log('[INFO]', new Date().toISOString(), ...args),
  warn:  (...args) => LOG_LEVELS[LOG_LEVEL] <= 2 && console.warn('[WARN]', new Date().toISOString(), ...args),
  error: (...args) => LOG_LEVELS[LOG_LEVEL] <= 3 && console.error('[ERROR]', new Date().toISOString(), ...args),
};

// --- Validate required env vars ---
if (!process.env.JWT_SECRET) {
  log.error('JWT_SECRET is required. Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

// --- Metrics ---
const metrics = {
  attestations: 0,
  attestationsFailed: 0,
  tokensIssued: 0,
  tokensRefreshed: 0,
  requestsProxied: 0,
  startTime: Date.now(),
};

// --- Express App ---
const app = express();
app.use(express.json({ limit: '16kb' }));
app.use(apiRateLimiter);

// --- Health Check (unauthenticated) ---
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
    version: '1.0.0',
  });
});

// --- Metrics (unauthenticated, localhost only) ---
app.get('/metrics', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
    return res.status(403).send('Forbidden');
  }

  res.type('text/plain').send([
    `# HELP gateway_attestations_total Total attestation attempts`,
    `# TYPE gateway_attestations_total counter`,
    `gateway_attestations_total ${metrics.attestations}`,
    `gateway_attestations_failed_total ${metrics.attestationsFailed}`,
    `# HELP gateway_tokens_issued_total Total tokens issued`,
    `# TYPE gateway_tokens_issued_total counter`,
    `gateway_tokens_issued_total ${metrics.tokensIssued}`,
    `gateway_tokens_refreshed_total ${metrics.tokensRefreshed}`,
    `# HELP gateway_requests_proxied_total Total requests proxied`,
    `# TYPE gateway_requests_proxied_total counter`,
    `gateway_requests_proxied_total ${metrics.requestsProxied}`,
    `# HELP gateway_uptime_seconds Gateway uptime`,
    `# TYPE gateway_uptime_seconds gauge`,
    `gateway_uptime_seconds ${Math.floor((Date.now() - metrics.startTime) / 1000)}`,
  ].join('\n') + '\n');
});

// ============================================================
// Attestation Endpoints (unauthenticated — these issue tokens)
// ============================================================

/**
 * POST /api/v1/attest/ios
 *
 * iOS App Attest flow:
 * 1. Client generates key via DCAppAttestService.generateKey()
 * 2. Client attests key via DCAppAttestService.attestKey()
 * 3. Client sends attestation + keyId to this endpoint
 * 4. Server verifies Apple certificate chain
 * 5. Server issues JWT access + refresh tokens
 */
app.post('/api/v1/attest/ios', async (req, res) => {
  metrics.attestations++;
  const { keyId, attestation, clientDataHash, userUuid, appVersion } = req.body;

  if (!keyId || !attestation || !clientDataHash || !userUuid) {
    return res.status(400).json({
      error: 'MISSING_FIELDS',
      message: 'keyId, attestation, clientDataHash, and userUuid are required',
    });
  }

  // Verify attestation with Apple
  const result = await verifyAppleAttestation(keyId, attestation, clientDataHash);

  if (!result.valid) {
    metrics.attestationsFailed++;
    log.warn('iOS attestation failed', { error: result.error });
    return res.status(403).json({
      error: 'ATTESTATION_FAILED',
      message: result.error,
    });
  }

  // Hash device identifier (keyId is device-specific)
  const deviceId = crypto.createHash('sha256').update(keyId).digest('hex').slice(0, 16);

  // Issue tokens
  const tokenPayload = {
    userUuid,
    platform: 'ios',
    appVersion: appVersion || '1.0.0',
    deviceId,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  metrics.tokensIssued++;
  log.info('iOS attestation successful, tokens issued', { device: deviceId });

  res.json({
    accessToken,
    refreshToken,
    expiresIn: 86400, // 24h in seconds
  });
});

/**
 * POST /api/v1/attest/android
 *
 * Android Play Integrity flow (placeholder — Android development pending).
 */
app.post('/api/v1/attest/android', async (req, res) => {
  metrics.attestations++;
  const { integrityToken, userUuid, appVersion } = req.body;

  if (!integrityToken || !userUuid) {
    return res.status(400).json({
      error: 'MISSING_FIELDS',
      message: 'integrityToken and userUuid are required',
    });
  }

  // TODO: Verify Google Play Integrity token
  // For now, accept in development mode
  const deviceId = crypto.createHash('sha256').update(integrityToken).digest('hex').slice(0, 16);

  const tokenPayload = {
    userUuid,
    platform: 'android',
    appVersion: appVersion || '1.0.0',
    deviceId,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  metrics.tokensIssued++;
  log.info('Android attestation (dev mode), tokens issued', { device: deviceId });

  res.json({
    accessToken,
    refreshToken,
    expiresIn: 86400,
  });
});

/**
 * POST /api/v1/token/refresh
 *
 * Exchange a valid refresh token for a new access token.
 */
app.post('/api/v1/token/refresh', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      error: 'MISSING_TOKEN',
      message: 'refreshToken is required',
    });
  }

  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET, {
      issuer: 'commeazy-gateway',
      algorithms: ['HS256'],
    });

    if (decoded.type !== 'refresh') {
      return res.status(400).json({
        error: 'INVALID_TOKEN_TYPE',
        message: 'Expected refresh token',
      });
    }

    const accessToken = generateAccessToken({
      userUuid: decoded.sub,
      platform: decoded.platform || 'ios',
      appVersion: '1.0.0',
      deviceId: decoded.device_id,
    });

    metrics.tokensRefreshed++;
    res.json({
      accessToken,
      expiresIn: 86400,
    });
  } catch (err) {
    return res.status(401).json({
      error: 'INVALID_REFRESH_TOKEN',
      message: 'Refresh token is invalid or expired',
    });
  }
});

// ============================================================
// Proxy Routes (authenticated via JWT)
// ============================================================

// Invitation Relay — /api/v1/invitations/*
app.use(
  '/api/v1/invitations',
  jwtAuth,
  (req, res, next) => {
    metrics.requestsProxied++;
    next();
  },
  createProxyMiddleware({
    target: INVITATION_RELAY_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/invitations': '/api/v1/invitations' },
    on: {
      proxyReq: (proxyReq, req) => {
        // Forward user UUID from JWT to backend
        if (req.user) {
          proxyReq.setHeader('X-User-UUID', req.user.sub);
        }
      },
      error: (err, req, res) => {
        log.error('Proxy error (invitation-relay)', { error: err.message });
        res.status(502).json({ error: 'SERVICE_UNAVAILABLE', message: 'Invitation service temporarily unavailable' });
      },
    },
  }),
);

// Push Gateway — /api/v1/push/*
app.use(
  '/api/v1/push',
  jwtAuth,
  (req, res, next) => {
    metrics.requestsProxied++;
    next();
  },
  createProxyMiddleware({
    target: PUSH_GATEWAY_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/push': '' },
    on: {
      error: (err, req, res) => {
        log.error('Proxy error (push-gateway)', { error: err.message });
        res.status(502).json({ error: 'SERVICE_UNAVAILABLE', message: 'Push service temporarily unavailable' });
      },
    },
  }),
);

// Prosody HTTP APIs — /api/v1/prosody/*
app.use(
  '/api/v1/prosody',
  jwtAuth,
  (req, res, next) => {
    metrics.requestsProxied++;
    next();
  },
  createProxyMiddleware({
    target: PROSODY_HTTP_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/prosody': '' },
    on: {
      error: (err, req, res) => {
        log.error('Proxy error (prosody)', { error: err.message });
        res.status(502).json({ error: 'SERVICE_UNAVAILABLE', message: 'XMPP service temporarily unavailable' });
      },
    },
  }),
);

// ============================================================
// 404 Handler
// ============================================================

app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` });
});

// ============================================================
// Start Server
// ============================================================

app.listen(PORT, HOST, () => {
  log.info(`API Gateway listening on ${HOST}:${PORT}`);
  log.info(`Proxying to:`);
  log.info(`  Invitation Relay: ${INVITATION_RELAY_URL}`);
  log.info(`  Push Gateway:     ${PUSH_GATEWAY_URL}`);
  log.info(`  Prosody HTTP:     ${PROSODY_HTTP_URL}`);
});
