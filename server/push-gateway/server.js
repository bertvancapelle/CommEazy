// ============================================================
// CommEazy Push Gateway
// Version: 1.0.0
//
// Single process with two independent handlers:
// - VoIP Handler: APNs VoIP Push (PushKit → CallKit)
// - FCM Handler: Firebase Cloud Messaging (message notifications)
//
// Co-located with Prosody on same VM. Listens on localhost:5282.
// Receives HTTP POST from Prosody mod_cloud_notify (XEP-0357).
//
// Port 5282 chosen to avoid conflict with Prosody HTTPS (5281).
// ============================================================

require('dotenv').config();

const express = require('express');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

// --- Configuration ---
const PORT = process.env.PORT || 5282;
const HOST = process.env.HOST || '127.0.0.1';
const PUSH_SECRET = process.env.PUSH_SECRET;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Simple logger
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const log = {
  debug: (...args) => LOG_LEVELS[LOG_LEVEL] <= 0 && console.log('[DEBUG]', new Date().toISOString(), ...args),
  info:  (...args) => LOG_LEVELS[LOG_LEVEL] <= 1 && console.log('[INFO]', new Date().toISOString(), ...args),
  warn:  (...args) => LOG_LEVELS[LOG_LEVEL] <= 2 && console.warn('[WARN]', new Date().toISOString(), ...args),
  error: (...args) => LOG_LEVELS[LOG_LEVEL] <= 3 && console.error('[ERROR]', new Date().toISOString(), ...args),
};

// --- Validate required environment variables ---
if (!PUSH_SECRET) {
  log.error('PUSH_SECRET is required');
  process.exit(1);
}

// --- APNs Client (VoIP Push via apns2) ---
// apns2 is ESM-only, so we lazy-load it
let apnsClient = null;
let ApnsNotification = null;

async function initApns() {
  try {
    const apnsKeyPath = process.env.APNS_KEY_PATH;
    if (apnsKeyPath && fs.existsSync(apnsKeyPath)) {
      const { ApnsClient, Notification } = await import('apns2');
      ApnsNotification = Notification;
      apnsClient = new ApnsClient({
        team: process.env.APNS_TEAM_ID,
        keyId: process.env.APNS_KEY_ID,
        signingKey: fs.readFileSync(apnsKeyPath),
        defaultTopic: `${process.env.APNS_BUNDLE_ID}.voip`,
        host: process.env.APNS_ENVIRONMENT === 'production'
          ? 'api.push.apple.com'
          : 'api.sandbox.push.apple.com',
      });
      log.info('APNs client initialized (apns2)');
    } else {
      log.warn('APNs key not found, VoIP push disabled');
    }
  } catch (err) {
    log.error('APNs client initialization failed:', err.message);
    // Gateway continues — FCM still works
  }
}

// --- FCM Provider (Message Push) ---
let fcmInitialized = false;
try {
  const gcredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gcredPath && fs.existsSync(gcredPath)) {
    admin.initializeApp({
      credential: admin.credential.cert(
        JSON.parse(fs.readFileSync(gcredPath, 'utf8'))
      ),
    });
    fcmInitialized = true;
    log.info('FCM provider initialized');
  } else {
    log.warn('Google credentials not found, FCM push disabled');
  }
} catch (err) {
  log.error('FCM provider initialization failed:', err.message);
  // Gateway continues — APNs still works
}

// --- Metrics ---
const metrics = {
  voipSent: 0,
  voipFailed: 0,
  fcmSent: 0,
  fcmFailed: 0,
  startTime: Date.now(),
};

// --- Express App ---
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting (100 req/s — Prosody typically sends ~10-50 req/s)
app.use(rateLimit({
  windowMs: 1000,
  max: 100,
  message: 'Rate limit exceeded',
}));

// --- Health Check ---
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
    apns: apnsClient ? 'connected' : 'unavailable',
    fcm: fcmInitialized ? 'initialized' : 'unavailable',
    version: '1.0.0',
  });
});

// --- Prometheus Metrics ---
app.get('/metrics', (req, res) => {
  res.type('text/plain').send([
    `# HELP push_voip_sent_total Total VoIP pushes sent`,
    `# TYPE push_voip_sent_total counter`,
    `push_voip_sent_total ${metrics.voipSent}`,
    `# HELP push_voip_failed_total Total VoIP pushes failed`,
    `# TYPE push_voip_failed_total counter`,
    `push_voip_failed_total ${metrics.voipFailed}`,
    `# HELP push_fcm_sent_total Total FCM pushes sent`,
    `# TYPE push_fcm_sent_total counter`,
    `push_fcm_sent_total ${metrics.fcmSent}`,
    `# HELP push_fcm_failed_total Total FCM pushes failed`,
    `# TYPE push_fcm_failed_total counter`,
    `push_fcm_failed_total ${metrics.fcmFailed}`,
    `# HELP push_gateway_uptime_seconds Gateway uptime in seconds`,
    `# TYPE push_gateway_uptime_seconds gauge`,
    `push_gateway_uptime_seconds ${Math.floor((Date.now() - metrics.startTime) / 1000)}`,
  ].join('\n') + '\n');
});

// --- Push Endpoint ---
// Receives POST from Prosody mod_push_http with:
//   node:    device token (VoIP hex token or FCM token)
//   secret:  shared secret for authentication
//   type:    "call", "message", or "wake" (content type)
//   service: "voip" or "fcm" (transport type, derived from push registration JID)
app.post('/push', async (req, res) => {
  const { node, secret, type, service } = req.body;

  // Validate shared secret
  if (secret !== PUSH_SECRET) {
    log.warn('Invalid push secret from', req.ip);
    return res.status(403).send('Forbidden');
  }

  if (!node) {
    return res.status(400).send('Missing device token (node)');
  }

  // Token suffix for logging (no PII)
  const tokenSuffix = node.slice(-6);

  // --- VoIP Handler: APNs VoIP push for incoming calls ---
  // Only fires when: service=voip (PushKit token) AND type=call
  if (service === 'voip' && type === 'call' && apnsClient && ApnsNotification) {
    try {
      const notification = new ApnsNotification(node, {
        aps: {},  // VoIP pushes use empty aps
        type: 'incoming-call',  // Custom payload — no PII
      });
      notification.pushType = 'voip';
      notification.priority = 10;  // Immediate
      notification.expiration = Math.floor(Date.now() / 1000) + 30;  // 30s

      await apnsClient.send(notification);
      log.info('VoIP push sent', { token: tokenSuffix });
      metrics.voipSent++;
    } catch (err) {
      log.error('VoIP push error', { token: tokenSuffix, error: err.message });
      metrics.voipFailed++;
    }
  }

  // --- FCM Handler: Firebase push for message notifications ---
  // Only fires when: service=fcm (FCM token) AND type=message
  if (service === 'fcm' && type === 'message' && fcmInitialized) {
    try {
      await admin.messaging().send({
        token: node,
        data: { type: 'new-message' },  // No PII — app fetches content via XMPP
        android: {
          priority: 'high',
          ttl: 60000,  // 60s
        },
      });
      log.info('FCM push sent', { token: tokenSuffix });
      metrics.fcmSent++;
    } catch (err) {
      log.error('FCM push error', { token: tokenSuffix, error: err.message });
      metrics.fcmFailed++;
    }
  }

  // Log skipped pushes at debug level for troubleshooting
  if (service === 'voip' && type !== 'call') {
    log.debug('Skipped VoIP push (type=%s, not call)', type);
  }
  if (service === 'fcm' && type !== 'message') {
    log.debug('Skipped FCM push (type=%s, not message)', type);
  }

  res.status(200).send('OK');
});

// --- Start Server ---
async function start() {
  await initApns();
  app.listen(PORT, HOST, () => {
    log.info(`Push Gateway listening on ${HOST}:${PORT}`);
    log.info(`APNs: ${apnsClient ? 'ready' : 'UNAVAILABLE'}`);
    log.info(`FCM: ${fcmInitialized ? 'ready' : 'UNAVAILABLE'}`);
  });
}

start().catch((err) => {
  log.error('Failed to start gateway:', err.message);
  process.exit(1);
});
