/**
 * CommEazy Push Gateway
 *
 * Receives XEP-0357 push notifications from Prosody mod_cloud_notify
 * and forwards them to:
 * - iOS: Direct APNs (sandbox for dev, production for release)
 * - Android: Firebase Cloud Messaging
 *
 * Usage:
 *   npm install
 *   npm start
 *
 * Configure Prosody to point to this gateway:
 *   push_notification_service = "http://localhost:3030/push"
 */

const express = require('express');
const bodyParser = require('body-parser');
const xml2js = require('xml2js');
const admin = require('firebase-admin');
const http2 = require('http2');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3030;

// Environment: 'development' uses APNs sandbox, 'production' uses APNs production
const ENVIRONMENT = process.env.NODE_ENV || 'development';

// APNs Configuration
const APNS_KEY_ID = 'X2VDC95JA5';
const APNS_TEAM_ID = 'LKVEVZHQV2';
const APNS_BUNDLE_ID = 'org.reactjs.native.example.CommEazyTemp';
const APNS_HOST = ENVIRONMENT === 'production'
  ? 'api.push.apple.com'
  : 'api.sandbox.push.apple.com';

// Load APNs auth key
const apnsKeyPath = path.join(__dirname, `AuthKey_${APNS_KEY_ID}.p8`);
let apnsPrivateKey = null;

if (fs.existsSync(apnsKeyPath)) {
  apnsPrivateKey = fs.readFileSync(apnsKeyPath, 'utf8');
  console.log(`[APNs] Auth key loaded from ${apnsKeyPath}`);
  console.log(`[APNs] Environment: ${ENVIRONMENT} (${APNS_HOST})`);
} else {
  console.warn(`[APNs] Auth key not found at ${apnsKeyPath}`);
  console.warn('[APNs] iOS push notifications will use FCM fallback');
}

// Initialize Firebase Admin SDK
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('ERROR: serviceAccountKey.json not found!');
  console.error('Download it from Firebase Console > Project Settings > Service accounts');
  console.error('Save it as: ' + serviceAccountPath);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Parse XML body from Prosody
app.use(bodyParser.text({ type: 'application/xml' }));
app.use(bodyParser.text({ type: 'text/xml' }));
app.use(bodyParser.json());

// Generate JWT token for APNs
function generateApnsToken() {
  return jwt.sign(
    {
      iss: APNS_TEAM_ID,
      iat: Math.floor(Date.now() / 1000),
    },
    apnsPrivateKey,
    {
      algorithm: 'ES256',
      header: {
        alg: 'ES256',
        kid: APNS_KEY_ID,
      },
    }
  );
}

// Send push via direct APNs (for iOS)
async function sendApnsPush(deviceToken, payload) {
  return new Promise((resolve, reject) => {
    const token = generateApnsToken();

    const client = http2.connect(`https://${APNS_HOST}`);

    client.on('error', (err) => {
      console.error('[APNs] Connection error:', err);
      reject(err);
    });

    const headers = {
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'authorization': `bearer ${token}`,
      'apns-topic': APNS_BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': '0',
    };

    const req = client.request(headers);
    let responseData = '';

    req.on('response', (headers) => {
      const status = headers[':status'];
      if (status === 200) {
        resolve({ success: true, apnsId: headers['apns-id'] });
      }
    });

    req.on('data', (chunk) => {
      responseData += chunk;
    });

    req.on('end', () => {
      client.close();
      if (responseData) {
        try {
          const parsed = JSON.parse(responseData);
          reject(new Error(parsed.reason || 'APNs error'));
        } catch (e) {
          // Not JSON, might be success
        }
      }
    });

    req.on('error', (err) => {
      client.close();
      reject(err);
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

// Send push via FCM (for Android, or iOS fallback)
async function sendFcmPush(fcmToken, title, body, data, badge) {
  const message = {
    token: fcmToken,
    notification: {
      title,
      body,
    },
    data: data || {},
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          badge: badge || 1,
        },
      },
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'messages',
      },
    },
  };

  return admin.messaging().send(message);
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'commeazy-push-gateway',
    environment: ENVIRONMENT,
    apnsEnabled: !!apnsPrivateKey,
    apnsHost: APNS_HOST,
  });
});

/**
 * Handle XEP-0357 push notification from Prosody
 */
app.post('/push', async (req, res) => {
  console.log('[Push Gateway] Received push request');
  console.log('[Push Gateway] Content-Type:', req.headers['content-type']);

  try {
    let token;
    let apnsToken;
    let platform = 'unknown';
    let senderJid = 'unknown';
    let messageCount = 1;

    // Parse based on content type
    if (req.headers['content-type']?.includes('xml')) {
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(req.body);

      // Token format: "platform:token" or "apns:hextoken|fcm:fcmtoken"
      const rawToken = result?.push?.node || result?.push?.$?.node;

      // Parse token - check if it contains platform prefix
      if (rawToken?.includes('|')) {
        // Both tokens provided: "apns:xxx|fcm:yyy"
        const parts = rawToken.split('|');
        for (const part of parts) {
          if (part.startsWith('apns:')) {
            apnsToken = part.substring(5);
            platform = 'ios';
          } else if (part.startsWith('fcm:')) {
            token = part.substring(4);
          }
        }
      } else if (rawToken?.startsWith('apns:')) {
        apnsToken = rawToken.substring(5);
        platform = 'ios';
      } else if (rawToken?.startsWith('fcm:')) {
        token = rawToken.substring(4);
        platform = 'android';
      } else {
        // Legacy: assume FCM token
        token = rawToken;
      }

      // Extract sender info
      const fields = result?.push?.notification?.x?.field;
      if (Array.isArray(fields)) {
        for (const field of fields) {
          if (field?.$?.var === 'last-message-sender') {
            senderJid = field?.value || 'unknown';
          }
          if (field?.$?.var === 'message-count') {
            messageCount = parseInt(field?.value, 10) || 1;
          }
        }
      }
    } else if (req.body?.token) {
      token = req.body.token;
      apnsToken = req.body.apnsToken;
      platform = req.body.platform || 'unknown';
      senderJid = req.body.sender || 'unknown';
      messageCount = req.body.count || 1;
    }

    const title = 'Nieuw bericht';
    const body = `Je hebt ${messageCount} ${messageCount === 1 ? 'nieuw bericht' : 'nieuwe berichten'}`;

    console.log(`[Push Gateway] Platform: ${platform}, Sender: ${senderJid}, Count: ${messageCount}`);

    // Send via APNs for iOS (if we have the key and token)
    if (apnsToken && apnsPrivateKey) {
      console.log(`[Push Gateway] Sending via APNs to: ${apnsToken.substring(0, 20)}...`);

      const apnsPayload = {
        aps: {
          alert: { title, body },
          sound: 'default',
          badge: messageCount,
        },
        senderJid,
      };

      try {
        const result = await sendApnsPush(apnsToken, apnsPayload);
        console.log('[Push Gateway] APNs sent successfully:', result.apnsId);
        return res.json({ success: true, method: 'apns', apnsId: result.apnsId });
      } catch (apnsError) {
        console.error('[Push Gateway] APNs failed, trying FCM fallback:', apnsError.message);
        // Fall through to FCM
      }
    }

    // Send via FCM (for Android or iOS fallback)
    if (token) {
      console.log(`[Push Gateway] Sending via FCM to: ${token.substring(0, 20)}...`);

      const response = await sendFcmPush(token, title, body, {
        type: 'message',
        senderJid,
        messageCount: String(messageCount),
      }, messageCount);

      console.log('[Push Gateway] FCM sent successfully:', response);
      return res.json({ success: true, method: 'fcm', messageId: response });
    }

    console.error('[Push Gateway] No valid token found');
    return res.status(400).json({ error: 'No valid token found' });

  } catch (error) {
    console.error('[Push Gateway] Error:', error);

    if (error.code === 'messaging/registration-token-not-registered') {
      return res.status(410).json({ error: 'Token expired' });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * Test endpoint for iOS APNs (direct)
 * POST /test-apns
 * { "token": "apns-device-token-hex" }
 */
app.post('/test-apns', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  if (!apnsPrivateKey) {
    return res.status(500).json({ error: 'APNs not configured' });
  }

  console.log(`[Push Gateway] APNs test push to: ${token.substring(0, 20)}...`);

  try {
    const payload = {
      aps: {
        alert: {
          title: 'CommEazy',
          body: 'Push notificatie test!',
        },
        sound: 'default',
        badge: 1,
      },
    };

    const result = await sendApnsPush(token, payload);
    console.log('[Push Gateway] APNs test sent:', result.apnsId);
    res.json({ success: true, method: 'apns', apnsId: result.apnsId });
  } catch (error) {
    console.error('[Push Gateway] APNs test error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test endpoint for FCM (Firebase)
 * POST /test-fcm
 * { "token": "fcm-token" }
 */
app.post('/test-fcm', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  console.log(`[Push Gateway] FCM test push to: ${token.substring(0, 20)}...`);

  try {
    const response = await sendFcmPush(token, 'CommEazy', 'Push notificatie test!', { type: 'test' }, 1);
    console.log('[Push Gateway] FCM test sent:', response);
    res.json({ success: true, method: 'fcm', messageId: response });
  } catch (error) {
    console.error('[Push Gateway] FCM test error:', error);
    res.status(500).json({ error: error.message, code: error.code });
  }
});

/**
 * Legacy test endpoint (uses FCM)
 * POST /test-push
 * { "token": "fcm-token" }
 */
app.post('/test-push', async (req, res) => {
  // Redirect to FCM test
  req.url = '/test-fcm';
  return app._router.handle(req, res);
});

app.listen(PORT, () => {
  console.log(`\n====================================`);
  console.log(`CommEazy Push Gateway running on port ${PORT}`);
  console.log(`====================================`);
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`APNs: ${apnsPrivateKey ? 'enabled' : 'disabled'} (${APNS_HOST})`);
  console.log(`FCM: enabled`);
  console.log(`====================================`);
  console.log(`Health:     http://localhost:${PORT}/health`);
  console.log(`Push:       http://localhost:${PORT}/push`);
  console.log(`Test APNs:  http://localhost:${PORT}/test-apns`);
  console.log(`Test FCM:   http://localhost:${PORT}/test-fcm`);
  console.log(`====================================\n`);
});
