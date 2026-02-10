/**
 * CommEazy Device Linking Service
 *
 * Enables tablets (iPad, Android tablets) to link to an existing account
 * without requiring a phone number. The primary device shows a QR code
 * that the tablet scans to securely transfer encryption keys.
 *
 * Flow:
 * 1. Primary device generates temporary QR with session ID + public key
 * 2. Tablet scans QR, establishes encrypted channel
 * 3. Primary device exports encrypted key bundle (protected by PIN)
 * 4. Tablet imports keys and syncs profile
 *
 * ⚠️ PRODUCTION REQUIREMENTS - MUST BE IMPLEMENTED BEFORE RELEASE:
 * ─────────────────────────────────────────────────────────────────
 * 1. QR Code Rendering:
 *    - Install: npm install react-native-qrcode-svg react-native-svg
 *    - Replace QR placeholder in DeviceLinkShowQRScreen with actual QRCode component
 *
 * 2. QR Code Scanning:
 *    - Install: npm install react-native-camera OR expo-camera
 *    - iOS: Add NSCameraUsageDescription to Info.plist
 *    - Android: Add CAMERA permission to AndroidManifest.xml
 *    - Replace camera placeholder in DeviceLinkScanScreen with actual scanner
 *
 * 3. Realtime Key Transfer (WebSocket/P2P):
 *    - Implement secure WebSocket connection between devices
 *    - OR use peer-to-peer via WebRTC data channel
 *    - OR use Firebase Realtime Database with short-lived tokens
 *    - Ensure encrypted channel for key bundle transfer
 *
 * DO NOT SHIP TO PRODUCTION WITHOUT THESE IMPLEMENTATIONS!
 * ─────────────────────────────────────────────────────────────────
 */

import sodium from 'libsodium-wrappers';
import type { KeyPair, UserProfile } from './interfaces';

// QR data version for future compatibility
const QR_VERSION = 1;

// Session timeout (5 minutes)
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

export interface DeviceLinkQRData {
  version: number;
  sessionId: string;
  publicKey: string;  // Ephemeral key for secure transfer
  deviceName: string;
  timestamp: number;
}

export interface DeviceLinkBundle {
  encryptedKeys: string;     // Encrypted with ephemeral shared secret
  nonce: string;
  profile: {
    jid: string;
    name: string;
    phoneNumber: string;
    language: string;
  };
}

export interface DeviceLinkSession {
  sessionId: string;
  ephemeralKeyPair: KeyPair;
  createdAt: number;
  status: 'pending' | 'connected' | 'completed' | 'expired';
}

export class DeviceLinkService {
  private currentSession: DeviceLinkSession | null = null;

  /**
   * Initialize sodium (call before any other methods)
   */
  async initialize(): Promise<void> {
    await sodium.ready;
  }

  /**
   * Generate QR code data for device linking (called on primary device)
   */
  async generateLinkQR(deviceName: string): Promise<string> {
    await sodium.ready;

    // Generate ephemeral key pair for this session
    const ephemeralKp = sodium.crypto_box_keypair();

    // Create unique session ID
    const sessionIdBytes = sodium.randombytes_buf(16);
    const sessionId = sodium.to_hex(sessionIdBytes);

    // Store session
    this.currentSession = {
      sessionId,
      ephemeralKeyPair: {
        publicKey: sodium.to_base64(ephemeralKp.publicKey),
        privateKey: sodium.to_base64(ephemeralKp.privateKey),
      },
      createdAt: Date.now(),
      status: 'pending',
    };

    // Create QR data
    const qrData: DeviceLinkQRData = {
      version: QR_VERSION,
      sessionId,
      publicKey: sodium.to_base64(ephemeralKp.publicKey),
      deviceName,
      timestamp: Date.now(),
    };

    return JSON.stringify(qrData);
  }

  /**
   * Parse scanned QR code (called on tablet)
   */
  parseScannedQR(qrString: string): DeviceLinkQRData | null {
    try {
      const data = JSON.parse(qrString) as DeviceLinkQRData;

      // Validate structure
      if (
        typeof data.version !== 'number' ||
        typeof data.sessionId !== 'string' ||
        typeof data.publicKey !== 'string' ||
        typeof data.timestamp !== 'number'
      ) {
        return null;
      }

      // Check if expired
      if (Date.now() - data.timestamp > SESSION_TIMEOUT_MS) {
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }

  /**
   * Create encrypted bundle with account keys (called on primary device)
   * @param userKeys - User's actual encryption keys to transfer
   * @param profile - User profile data
   * @param tabletPublicKey - Tablet's ephemeral public key (from connection)
   */
  async createKeyBundle(
    userKeys: KeyPair,
    profile: UserProfile,
    tabletPublicKey: string,
  ): Promise<DeviceLinkBundle> {
    await sodium.ready;

    if (!this.currentSession) {
      throw new Error('No active linking session');
    }

    // Derive shared secret using ephemeral keys
    const tabletPk = sodium.from_base64(tabletPublicKey);
    const myPrivateKey = sodium.from_base64(this.currentSession.ephemeralKeyPair.privateKey);

    // Create payload with user's actual keys
    const payload = JSON.stringify({
      publicKey: userKeys.publicKey,
      privateKey: userKeys.privateKey,
    });

    // Encrypt with shared secret
    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
    const encrypted = sodium.crypto_box_easy(
      sodium.from_string(payload),
      nonce,
      tabletPk,
      myPrivateKey,
    );

    this.currentSession.status = 'completed';

    return {
      encryptedKeys: sodium.to_base64(encrypted),
      nonce: sodium.to_base64(nonce),
      profile: {
        jid: profile.jid,
        name: profile.name,
        phoneNumber: profile.phoneNumber,
        language: profile.language,
      },
    };
  }

  /**
   * Decrypt and import keys from bundle (called on tablet)
   * @param bundle - Encrypted bundle from primary device
   * @param primaryPublicKey - Primary device's ephemeral public key (from QR)
   * @param myEphemeralPrivateKey - Tablet's ephemeral private key
   */
  async importKeyBundle(
    bundle: DeviceLinkBundle,
    primaryPublicKey: string,
    myEphemeralPrivateKey: string,
  ): Promise<KeyPair> {
    await sodium.ready;

    const primaryPk = sodium.from_base64(primaryPublicKey);
    const myPrivateKey = sodium.from_base64(myEphemeralPrivateKey);
    const nonce = sodium.from_base64(bundle.nonce);
    const encrypted = sodium.from_base64(bundle.encryptedKeys);

    // Decrypt the bundle
    const decrypted = sodium.crypto_box_open_easy(
      encrypted,
      nonce,
      primaryPk,
      myPrivateKey,
    );

    const keys = JSON.parse(sodium.to_string(decrypted)) as KeyPair;

    // Zero the ephemeral private key from memory
    sodium.memzero(myPrivateKey);

    return keys;
  }

  /**
   * Generate ephemeral key pair for tablet side
   */
  async generateTabletEphemeralKeys(): Promise<KeyPair> {
    await sodium.ready;
    const kp = sodium.crypto_box_keypair();
    return {
      publicKey: sodium.to_base64(kp.publicKey),
      privateKey: sodium.to_base64(kp.privateKey),
    };
  }

  /**
   * Check if current session is still valid
   */
  isSessionValid(): boolean {
    if (!this.currentSession) return false;
    if (this.currentSession.status === 'expired') return false;
    if (this.currentSession.status === 'completed') return false;

    const elapsed = Date.now() - this.currentSession.createdAt;
    if (elapsed > SESSION_TIMEOUT_MS) {
      this.currentSession.status = 'expired';
      return false;
    }

    return true;
  }

  /**
   * Get current session (for UI state)
   */
  getCurrentSession(): DeviceLinkSession | null {
    return this.currentSession;
  }

  /**
   * Cancel current linking session
   */
  cancelSession(): void {
    if (this.currentSession) {
      // Zero ephemeral private key
      try {
        const privateKeyBytes = sodium.from_base64(
          this.currentSession.ephemeralKeyPair.privateKey
        );
        sodium.memzero(privateKeyBytes);
      } catch {
        // Ignore if already zeroed
      }
      this.currentSession = null;
    }
  }
}

// Singleton instance
export const deviceLinkService = new DeviceLinkService();
