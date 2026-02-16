/**
 * Development Configuration
 *
 * Central place to toggle between mock mode and production mode.
 * This makes it easy to switch for testing.
 *
 * USAGE:
 * - Set USE_REAL_SERVICES = true for device-to-device testing
 * - Set USE_REAL_SERVICES = false for UI-only development
 *
 * REQUIREMENTS for USE_REAL_SERVICES = true:
 * 1. Prosody XMPP server must be running: sudo prosodyctl start
 * 2. Both devices must be on the same network
 * 3. Test accounts must exist in Prosody:
 *    - ik@commeazy.local (iPhone 17 Pro simulator)
 *    - oma@commeazy.local (iPhone 16e simulator)
 *    - test@commeazy.local (iPhone 14 physical)
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
// Test accounts
// ============================================================

export const TEST_ACCOUNTS = {
  // Large simulator (iPhone 17 Pro)
  ik: {
    jid: 'ik@commeazy.local',
    password: 'test123',
    name: 'Ik',
  },
  // Small simulator (iPhone 16e)
  oma: {
    jid: 'oma@commeazy.local',
    password: 'test123',
    name: 'Oma',
  },
  // Physical device (iPhone 14)
  test: {
    jid: 'test@commeazy.local',
    password: 'test123',
    name: 'Test',
  },
} as const;

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
