/**
 * Direct APNs Test Script
 *
 * Tests push notifications directly via APNs, bypassing Firebase.
 * This helps diagnose if the issue is with Firebase or APNs configuration.
 */

const http2 = require('http2');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// Configuration
const KEY_ID = 'X2VDC95JA5';
const TEAM_ID = 'LKVEVZHQV2';
const BUNDLE_ID = 'org.reactjs.native.example.CommEazyTemp';
const DEVICE_TOKEN = 'a4b490c22c4de9f5b48faa6a1d1b040f59cacf213dac55a81c725f93691979a9';

// APNs sandbox (development) endpoint
const APNS_HOST = 'api.sandbox.push.apple.com';

// Load the APNs auth key
const keyPath = path.join(__dirname, `AuthKey_${KEY_ID}.p8`);
if (!fs.existsSync(keyPath)) {
  console.error(`ERROR: APNs key not found at ${keyPath}`);
  process.exit(1);
}

const privateKey = fs.readFileSync(keyPath, 'utf8');

// Generate JWT token for APNs
function generateToken() {
  const token = jwt.sign(
    {
      iss: TEAM_ID,
      iat: Math.floor(Date.now() / 1000),
    },
    privateKey,
    {
      algorithm: 'ES256',
      header: {
        alg: 'ES256',
        kid: KEY_ID,
      },
    }
  );
  return token;
}

// Send push notification
async function sendPush() {
  console.log('\n====================================');
  console.log('Direct APNs Push Test');
  console.log('====================================');
  console.log(`Host: ${APNS_HOST}`);
  console.log(`Bundle ID: ${BUNDLE_ID}`);
  console.log(`Device Token: ${DEVICE_TOKEN.substring(0, 20)}...`);
  console.log('====================================\n');

  const token = generateToken();
  console.log('JWT Token generated successfully');

  const payload = JSON.stringify({
    aps: {
      alert: {
        title: 'CommEazy',
        body: 'Je hebt een nieuw bericht!',
      },
      sound: 'default',
      badge: 9,
      'content-available': 1,
      'mutable-content': 1,
    },
  });

  console.log('Payload:', payload);
  console.log('\nConnecting to APNs...');

  return new Promise((resolve, reject) => {
    const client = http2.connect(`https://${APNS_HOST}`);

    client.on('error', (err) => {
      console.error('Connection error:', err);
      reject(err);
    });

    const headers = {
      ':method': 'POST',
      ':path': `/3/device/${DEVICE_TOKEN}`,
      'authorization': `bearer ${token}`,
      'apns-topic': BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': '0',
      'apns-collapse-id': 'commeazy-test-' + Date.now(),
    };

    console.log('Sending request...');
    const req = client.request(headers);

    let responseData = '';

    req.on('response', (headers) => {
      const status = headers[':status'];
      console.log(`\nResponse Status: ${status}`);

      if (status === 200) {
        console.log('SUCCESS! Push notification sent to APNs!');
        console.log('APNs ID:', headers['apns-id']);
      } else {
        console.log('FAILED! APNs returned an error.');
      }
    });

    req.on('data', (chunk) => {
      responseData += chunk;
    });

    req.on('end', () => {
      if (responseData) {
        console.log('Response body:', responseData);
        try {
          const parsed = JSON.parse(responseData);
          console.log('Error reason:', parsed.reason);
        } catch (e) {
          // Not JSON
        }
      }
      client.close();
      resolve();
    });

    req.on('error', (err) => {
      console.error('Request error:', err);
      client.close();
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

// Run the test
sendPush()
  .then(() => {
    console.log('\nTest completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nTest failed:', err);
    process.exit(1);
  });
