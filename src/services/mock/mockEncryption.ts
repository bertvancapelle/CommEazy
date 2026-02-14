/**
 * Mock Encryption Data
 *
 * Mock QR code data and verification for testing the device linking
 * and contact verification flows without real cryptographic operations.
 *
 * Only loaded in __DEV__ mode.
 */

import { MOCK_CONTACTS, getMockContactByJid } from './mockContacts';
import { MOCK_CURRENT_USER } from './mockChats';

// ============================================================
// QR Code Data Format
// ============================================================

/**
 * QR code data structure for CommEazy
 * Contains: version, jid, publicKey, timestamp, signature
 */
export interface MockQRCodeData {
  version: number;
  jid: string;
  publicKey: string;
  name: string;
  timestamp: number;
  signature: string; // Mock signature for verification
}

// ============================================================
// Mock QR Code Generation
// ============================================================

/**
 * Generate mock QR data for the current user (to show in "My QR Code")
 */
export const generateMockMyQRData = (): string => {
  // Generate a simple mock public key without btoa (not available in React Native)
  const mockPublicKey = 'MOCK_PUBLIC_KEY_' + MOCK_CURRENT_USER.jid.replace(/[@.]/g, '_').slice(0, 20);

  const qrData: MockQRCodeData = {
    version: 1,
    jid: MOCK_CURRENT_USER.jid,
    publicKey: mockPublicKey,
    name: MOCK_CURRENT_USER.name,
    timestamp: Date.now(),
    signature: 'MOCK_SIG_' + Date.now().toString(36),
  };

  return JSON.stringify(qrData);
};

/**
 * Generate mock QR data for a specific contact (for testing scan flow)
 */
export const generateMockContactQRData = (jid: string): string | null => {
  const contact = getMockContactByJid(jid);
  if (!contact) return null;

  const qrData: MockQRCodeData = {
    version: 1,
    jid: contact.jid,
    publicKey: contact.publicKey,
    name: contact.name,
    timestamp: Date.now(),
    signature: 'MOCK_SIG_' + contact.jid.split('@')[0],
  };

  return JSON.stringify(qrData);
};

// ============================================================
// Mock QR Code Verification
// ============================================================

export interface MockVerificationResult {
  success: boolean;
  contact?: {
    jid: string;
    name: string;
    publicKey: string;
  };
  error?: string;
}

/**
 * Parse and verify mock QR data
 * Returns the contact info if valid, or an error message
 */
export const verifyMockQRData = (qrData: string): MockVerificationResult => {
  try {
    const data = JSON.parse(qrData) as MockQRCodeData;

    // Check version
    if (data.version !== 1) {
      return {
        success: false,
        error: 'Onbekende QR-code versie',
      };
    }

    // Check required fields
    if (!data.jid || !data.publicKey || !data.name) {
      return {
        success: false,
        error: 'Ongeldige QR-code data',
      };
    }

    // Check timestamp (QR code expires after 10 minutes)
    const tenMinutesMs = 10 * 60 * 1000;
    if (Date.now() - data.timestamp > tenMinutesMs) {
      return {
        success: false,
        error: 'QR-code is verlopen. Vraag een nieuwe aan.',
      };
    }

    // Mock signature verification (always passes for mock data)
    if (!data.signature.startsWith('MOCK_SIG_')) {
      return {
        success: false,
        error: 'QR-code handtekening ongeldig',
      };
    }

    // Success!
    return {
      success: true,
      contact: {
        jid: data.jid,
        name: data.name,
        publicKey: data.publicKey,
      },
    };
  } catch {
    return {
      success: false,
      error: 'Kan QR-code niet lezen',
    };
  }
};

// ============================================================
// Mock Device Linking
// ============================================================

export interface MockDeviceLinkQRData {
  version: number;
  type: 'device_link';
  deviceId: string;
  deviceName: string;
  connectionKey: string;
  timestamp: number;
  expiresAt: number;
}

/**
 * Generate mock QR data for device linking (existing device shows this)
 */
export const generateMockDeviceLinkQR = (deviceName: string): string => {
  const now = Date.now();
  const expiresIn = 5 * 60 * 1000; // 5 minutes

  const qrData: MockDeviceLinkQRData = {
    version: 1,
    type: 'device_link',
    deviceId: 'device_' + Math.random().toString(36).slice(2, 10),
    deviceName,
    connectionKey: 'connkey_' + Math.random().toString(36).slice(2, 18),
    timestamp: now,
    expiresAt: now + expiresIn,
  };

  return JSON.stringify(qrData);
};

export interface MockDeviceLinkResult {
  success: boolean;
  deviceInfo?: {
    deviceId: string;
    deviceName: string;
  };
  error?: string;
}

/**
 * Parse and verify device link QR data
 */
export const verifyMockDeviceLinkQR = (qrData: string): MockDeviceLinkResult => {
  try {
    const data = JSON.parse(qrData) as MockDeviceLinkQRData;

    if (data.version !== 1 || data.type !== 'device_link') {
      return {
        success: false,
        error: 'Dit is geen geldig apparaat-koppel QR-code',
      };
    }

    if (Date.now() > data.expiresAt) {
      return {
        success: false,
        error: 'QR-code is verlopen. Genereer een nieuwe op het andere apparaat.',
      };
    }

    if (!data.deviceId || !data.connectionKey) {
      return {
        success: false,
        error: 'Ongeldige QR-code data',
      };
    }

    return {
      success: true,
      deviceInfo: {
        deviceId: data.deviceId,
        deviceName: data.deviceName,
      },
    };
  } catch {
    return {
      success: false,
      error: 'Kan QR-code niet lezen',
    };
  }
};

// ============================================================
// Pre-generated QR codes for testing (lazy evaluation)
// ============================================================

// QR data that can be used for testing in development
// Using getters to avoid execution at module load time
export const MOCK_TEST_QR_CODES = {
  // Valid QR code for Oma Jansen
  get OMA_JANSEN() {
    return generateMockContactQRData('oma.jansen@commeazy.local');
  },

  // Valid QR code for Papa
  get PAPA() {
    return generateMockContactQRData('papa@commeazy.local');
  },

  // Valid QR code for unverified contact (Tante Maria)
  get TANTE_MARIA() {
    return generateMockContactQRData('tante.maria@commeazy.local');
  },

  // Device link QR code
  get DEVICE_LINK() {
    return generateMockDeviceLinkQR("Jan's iPhone");
  },

  // Invalid QR codes for error testing
  get INVALID_VERSION() {
    return JSON.stringify({ version: 99, jid: 'test@test.com' });
  },
  get EXPIRED() {
    return JSON.stringify({
      version: 1,
      jid: 'expired@test.com',
      publicKey: 'key',
      name: 'Expired',
      timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago
      signature: 'MOCK_SIG_expired',
    });
  },
  MALFORMED: 'not-valid-json-{{{',
};

// Helper to get test QR data for development UI
export const getTestQRCodeForScanning = (
  scenario: 'success' | 'unverified' | 'expired' | 'invalid' | 'device_link'
): string => {
  switch (scenario) {
    case 'success':
      return MOCK_TEST_QR_CODES.OMA_JANSEN ?? '';
    case 'unverified':
      return MOCK_TEST_QR_CODES.TANTE_MARIA ?? '';
    case 'expired':
      return MOCK_TEST_QR_CODES.EXPIRED;
    case 'invalid':
      return MOCK_TEST_QR_CODES.MALFORMED;
    case 'device_link':
      return MOCK_TEST_QR_CODES.DEVICE_LINK;
    default:
      return '';
  }
};
