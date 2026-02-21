/**
 * KNMI WMS Proxy Server
 *
 * Local proxy that adds the Authorization header to KNMI WMS tile requests.
 * Required because WebView/Leaflet cannot add custom headers to tile requests.
 *
 * Usage:
 *   cd server/knmi-proxy
 *   npm install
 *   npm start
 *
 * The proxy runs on port 3001 and forwards requests to KNMI with auth header.
 *
 * Endpoints:
 *   GET /knmi-wms?url=<encoded_knmi_url>
 *   GET /health
 *
 * @see https://developer.dataplatform.knmi.nl/wms
 */

const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const url = require('url');

// ============================================================
// Configuration
// ============================================================

const PORT = 3001;
const HOST = '0.0.0.0'; // Listen on all interfaces (for LAN access)

// KNMI API Key (same as in devConfig.ts)
const KNMI_API_KEY = 'eyJvcmciOiI1ZTU1NGUxOTI3NGE5NjAwMDEyYTNlYjEiLCJpZCI6ImE2MjI1YjEzY2FjMzQ2ZTVhNWQ1YzRjMGUyZWY0NWNkIiwiaCI6Im11cm11cjEyOCJ9';

// ============================================================
// Server Setup
// ============================================================

const app = express();

// Enable CORS for all origins (needed for WebView access)
app.use(cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'knmi-proxy',
    timestamp: new Date().toISOString(),
  });
});

// KNMI WMS proxy endpoint
app.get('/knmi-wms', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({
      error: 'Missing url parameter',
      usage: '/knmi-wms?url=<encoded_knmi_url>',
    });
  }

  try {
    // Parse the target URL
    const parsedUrl = new url.URL(targetUrl);

    // Verify it's a KNMI URL (security check)
    if (!parsedUrl.hostname.endsWith('knmi.nl')) {
      return res.status(403).json({
        error: 'Only KNMI URLs are allowed',
        hostname: parsedUrl.hostname,
      });
    }

    // Forward request to KNMI with Authorization header
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'Authorization': KNMI_API_KEY,
        'Accept': 'image/png,image/*,*/*',
        'User-Agent': 'CommEazy-KNMI-Proxy/1.0',
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      // Forward status code
      res.status(proxyRes.statusCode);

      // Forward relevant headers
      const contentType = proxyRes.headers['content-type'];
      if (contentType) {
        res.set('Content-Type', contentType);
      }

      // Cache tiles for 5 minutes (radar data updates every 5 min)
      res.set('Cache-Control', 'public, max-age=300');

      // Pipe the response body
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (error) => {
      console.error('[KNMI Proxy] Request error:', error.message);
      res.status(502).json({
        error: 'Proxy request failed',
        message: error.message,
      });
    });

    // Set timeout
    proxyReq.setTimeout(10000, () => {
      proxyReq.destroy();
      res.status(504).json({
        error: 'Proxy request timeout',
      });
    });

    proxyReq.end();

  } catch (error) {
    console.error('[KNMI Proxy] Error:', error.message);
    res.status(500).json({
      error: 'Internal proxy error',
      message: error.message,
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    endpoints: ['/health', '/knmi-wms?url=...'],
  });
});

// ============================================================
// Start Server
// ============================================================

const server = app.listen(PORT, HOST, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║               KNMI WMS Proxy Server                      ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Status:    Running                                      ║`);
  console.log(`║  Port:      ${PORT}                                         ║`);
  console.log(`║  Host:      ${HOST}                                       ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  Endpoints:                                              ║');
  console.log('║    GET /health        - Health check                     ║');
  console.log('║    GET /knmi-wms?url= - Proxy KNMI WMS requests          ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  Usage in app:                                           ║');
  console.log(`║    http://10.10.15.75:${PORT}/knmi-wms?url=<knmi_url>       ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Press Ctrl+C to stop the server');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[KNMI Proxy] Shutting down...');
  server.close(() => {
    console.log('[KNMI Proxy] Server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n[KNMI Proxy] Received SIGTERM, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
