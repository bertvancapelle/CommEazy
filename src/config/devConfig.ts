/**
 * Development Configuration
 *
 * Central place to toggle between mock mode and production mode.
 * This makes it easy to switch for testing.
 *
 * PRIVACY ARCHITECTURE: JIDs are UUID-based (production-parity).
 * Names and emails are PROFILE DATA — no PII in JIDs.
 *
 * USAGE:
 * - Set USE_REAL_SERVICES = true for device-to-device testing
 * - Set USE_REAL_SERVICES = false for UI-only development
 *
 * REQUIREMENTS for USE_REAL_SERVICES = true:
 * 1. Prosody XMPP server must be running: sudo prosodyctl start
 * 2. Both devices must be on the same network
 * 3. Test accounts must exist in Prosody (UUID-based):
 *    - e5f6a7b8-c9d0-4e5f-2a6b-3c4d5e6f7a8b@commeazy.local (iPhone 14, Bert)
 *    - b8c9d0e1-f2a3-4b8c-5d9e-6f7a8b9c0d1e@commeazy.local (iPhone 12, Jeanine)
 *    - d0e1f2a3-b4c5-4d0e-7f1a-8b9c0d1e2f3a@commeazy.local (iPad, Pipo)
 *    - f6a7b8c9-d0e1-4f6a-3b7c-4d5e6f7a8b9c@commeazy.local (iPhone 17 Pro sim)
 *    - a7b8c9d0-e1f2-4a7b-4c8d-5e6f7a8b9c0d@commeazy.local (iPhone 16e sim)
 *    - c9d0e1f2-a3b4-4c9d-6e0f-7a8b9c0d1e2f@commeazy.local (iPad sim)
 */

// ============================================================
// MAIN TOGGLE - Change this to switch modes
// ============================================================

/**
 * When true:
 * - Uses real XMPP connection to Prosody
 * - Uses real E2E encryption (libsodium)
 * - Messages are sent between devices
 *
 * When false:
 * - Uses plaintext mode (no encryption)
 * - Mock data is used as fallback
 * - Good for UI development without server
 */
export const USE_REAL_SERVICES = true;

// ============================================================
// Derived settings (don't change these directly)
// ============================================================

/** Use plaintext mode (bypass encryption) */
export const USE_PLAINTEXT_MODE = !USE_REAL_SERVICES;

/** Seed mock data even when using real services (useful for contacts) */
export const SEED_MOCK_DATA = true;

/** Connect to XMPP server */
export const CONNECT_XMPP = USE_REAL_SERVICES;

/** Enable verbose logging */
export const VERBOSE_LOGGING = true;

// ============================================================
// Server configuration
// ============================================================

/** Prosody XMPP server hostname */
export const XMPP_HOST = 'commeazy.local';

/** Prosody XMPP server port (client-to-server) */
export const XMPP_PORT = 5222;

/** MUC (Multi-User Chat) domain for group chats */
export const MUC_DOMAIN = `muc.${XMPP_HOST}`;

// ============================================================
// Test accounts (UUID-based JIDs — production-parity)
// ============================================================

export const TEST_ACCOUNTS = {
  // Physical device: iPhone 14 (Bert)
  bert: {
    jid: 'e5f6a7b8-c9d0-4e5f-2a6b-3c4d5e6f7a8b@commeazy.local',
    password: 'test123',
    name: 'Bert',
  },
  // Physical device: iPhone 12 (Jeanine)
  jeanine: {
    jid: 'b8c9d0e1-f2a3-4b8c-5d9e-6f7a8b9c0d1e@commeazy.local',
    password: 'test123',
    name: 'Jeanine',
  },
  // Physical device: iPad (Pipo)
  pipo: {
    jid: 'd0e1f2a3-b4c5-4d0e-7f1a-8b9c0d1e2f3a@commeazy.local',
    password: 'test123',
    name: 'Pipo',
  },
  // Simulator: iPhone 17 Pro
  sim1: {
    jid: 'f6a7b8c9-d0e1-4f6a-3b7c-4d5e6f7a8b9c@commeazy.local',
    password: 'test123',
    name: 'Sim1',
  },
  // Simulator: iPhone 16e
  sim2: {
    jid: 'a7b8c9d0-e1f2-4a7b-4c8d-5e6f7a8b9c0d@commeazy.local',
    password: 'test123',
    name: 'Sim2',
  },
  // Simulator: iPad
  simipad: {
    jid: 'c9d0e1f2-a3b4-4c9d-6e0f-7a8b9c0d1e2f@commeazy.local',
    password: 'test123',
    name: 'SimiPad',
  },
} as const;

// ============================================================
// External API Keys (Development only)
// ============================================================

/**
 * OpenWeatherMap API key for radar tiles
 * Free tier: 1,000,000 calls/month
 * Get yours at: https://openweathermap.org/api
 */
export const OWM_API_KEY = 'f9df16dd02ba0817ebd46cf773c7b6b9';

/**
 * KNMI Data Platform API key for radar forecast (Netherlands)
 * 2 hour forecast, 5 minute intervals, 1km resolution
 * Register at: https://developer.dataplatform.knmi.nl/register
 *
 * Note: KNMI requires API key as Authorization header, so we use a local proxy.
 */
export const KNMI_API_KEY = 'eyJvcmciOiI1ZTU1NGUxOTI3NGE5NjAwMDEyYTNlYjEiLCJpZCI6ImE2MjI1YjEzY2FjMzQ2ZTVhNWQ1YzRjMGUyZWY0NWNkIiwiaCI6Im11cm11cjEyOCJ9';

/**
 * KNMI Proxy URL (local development server)
 *
 * The proxy adds the Authorization header that WebView/Leaflet cannot add.
 * Start with: ./scripts/knmi-proxy-start.sh
 * Stop with:  ./scripts/knmi-proxy-stop.sh
 *
 * Set to null to disable KNMI and use RainViewer instead.
 *
 * NOTE: Currently disabled because the KNMI API key above doesn't have
 * WMS access. You need to request WMS access at:
 * https://dataplatform.knmi.nl/dataset/radar-reflectivity-composites-2-0
 *
 * When you have a valid key, set this to: 'http://10.10.15.75:3001/knmi-wms'
 */
export const KNMI_PROXY_URL: string | null = null;

// ============================================================
// Helper to log current config
// ============================================================

export const logDevConfig = (): void => {
  if (!__DEV__) return;

  console.log('\n====== CommEazy Dev Config ======');
  console.log(`  USE_REAL_SERVICES: ${USE_REAL_SERVICES}`);
  console.log(`  USE_PLAINTEXT_MODE: ${USE_PLAINTEXT_MODE}`);
  console.log(`  SEED_MOCK_DATA: ${SEED_MOCK_DATA}`);
  console.log(`  CONNECT_XMPP: ${CONNECT_XMPP}`);
  console.log(`  XMPP_HOST: ${XMPP_HOST}`);
  console.log('==================================\n');
};
