/**
 * CommEazy App Configuration
 *
 * Environment-specific values.
 * NEVER commit production secrets — use env variables or Keychain.
 */

export const config = {
  // XMPP Server
  xmpp: {
    domain: 'commeazy.nl',
    websocketUrl: 'wss://commeazy.nl:5281/xmpp-websocket',
    mucDomain: 'muc.commeazy.nl',
    /** Prosody requires no MAM, no offline storage */
    verifyZeroStorage: true,
  },

  // WebRTC / TURN
  webrtc: {
    stunServers: ['stun:stun.commeazy.nl:3478'],
    turnServers: [{
      urls: 'turn:turn.commeazy.nl:3478',
      // Credentials loaded from Keychain at runtime
      username: '',
      credential: '',
    }],
  },

  // Encryption
  encryption: {
    /** Dual-path threshold: ≤8 encrypt-to-all, >8 shared-key */
    groupThreshold: 8,
    /** Outbox message expiry */
    outboxExpiryDays: 7,
    /** Key backup derivation */
    argon2Iterations: 3, // crypto_pwhash_OPSLIMIT_MODERATE
  },

  // Performance targets (Quality Gate 5)
  performance: {
    coldStartMaxMs: 3000,
    targetFps: 60,
    maxMemoryMB: 200,
    maxBundleSizeMB: { ios: 25, android: 20 },
  },

  // Senior UX constraints (Quality Gate 2)
  seniorUX: {
    minBodyFontPt: 18,
    minTouchTargetPt: 60,
    maxStepsPerFlow: 3,
    maxNavigationLevels: 2,
    contrastRatioMinBody: 7.0,    // WCAG AAA
    contrastRatioMinLarge: 4.5,   // WCAG AAA large text
  },

  // Supported languages
  i18n: {
    supported: ['nl', 'en', 'de', 'fr', 'es', 'it', 'pl', 'no', 'sv', 'da'] as const,
    default: 'en' as const,
  },

  // Store compliance
  store: {
    ios: {
      minimumVersion: '15.0',
      privacyManifestRequired: true,
      encryptionExportCompliance: true,
    },
    android: {
      minSdk: 24,
      targetSdk: 34,
      dataSafetyRequired: true,
    },
  },
} as const;

export type AppConfig = typeof config;

// Re-export dev config for easy access
export * from './devConfig';
