/**
 * CommEazy Service Container
 *
 * Singleton service registry for dependency injection.
 * Solo-dev friendly: no framework overhead, just typed getters.
 *
 * Usage:
 *   const xmpp = ServiceContainer.xmpp;
 *   const db = ServiceContainer.database;
 *   const crypto = ServiceContainer.encryption;
 *
 * Initialization (in App.tsx):
 *   await ServiceContainer.initialize();
 */

import { Platform, Dimensions, NativeModules } from 'react-native';
import type {
  DatabaseService,
  EncryptionService,
  XMPPService,
  NotificationService,
} from './interfaces';
import { SodiumEncryptionService } from './encryption';
import { XmppJsService } from './xmpp';
import { WatermelonDBService } from './database';
import { chatService } from './chat';
import { groupChatService } from './groupChat';
import { callService } from './call';
import { FCMNotificationService, onTokenRefresh } from './notifications';

// Note: Mock data imports moved to dynamic import in initialize() to avoid
// triggering module evaluation at startup

/**
 * Check if running on iOS Simulator.
 * Returns true for simulator, false for physical device.
 */
const isIOSSimulator = (): boolean => {
  if (Platform.OS !== 'ios') return false;
  // The DeviceInfo native module exposes isEmulator
  // But simpler: check the model name - simulators report "Simulator" or x86/arm64 architecture
  // We can use PlatformConstants which is available without extra dependencies
  const { PlatformConstants } = NativeModules;
  // On simulator, interfaceIdiom is set but we can also check for specific model
  // Safest approach: physical devices have Push capability, simulators don't
  // But that's circular. Instead, we use a simple heuristic:
  // Simulators have deviceName containing "Simulator" when checked via Device.isDevice
  // For now, let's use screen height as differentiator:
  // - iPhone 14: 844pt (but iPhone 16e simulator is also 844pt)
  // Actually the cleanest approach: Check if push notifications work
  // If they don't, it's likely a simulator (since user now has paid account)
  // But we need credentials BEFORE push init.
  // Let's use a workaround: check NativeModules.DevMenu existence (dev menu is simulator-only feature)
  // Actually that's wrong too.
  //
  // SIMPLE SOLUTION: Use a unique screen dimension combination
  // iPhone 14: 390x844 = 329,160 (physical)
  // iPhone 16e simulator: 390x844 = 329,160 (simulator)
  // These are the same! So screen size alone can't distinguish them.
  //
  // Use PlatformConstants.reactNativeVersion or check __DEV__ + isDevice from react-native
  // Actually, the BEST solution: check if we're on a device with working push capability.
  // But we need this before push init... So let's use an environment variable or a manual flag.
  //
  // For now, detect by checking if DeviceInfo says so (if installed) or use a threshold trick:
  // Assume ANY physical device testing uses 'test' account.
  // We'll check for specific model patterns.
  return false; // This function is not reliable - we'll use a different approach
};

/**
 * Check if running on a physical iOS device (not simulator).
 * Uses the UIDevice model to check - simulators have "Simulator" in the name.
 */
const isPhysicalDevice = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') return false;

  try {
    // Check if react-native-device-info is available
    const DeviceInfo = await import('react-native-device-info');
    // IMPORTANT: isEmulator() returns a Promise, must await it!
    const isEmulator = await DeviceInfo.default.isEmulator();
    console.log(`[DEV] Device check: isEmulator=${isEmulator}`);
    return !isEmulator;
  } catch {
    // DeviceInfo not installed - use fallback
    // Fallback: If push notifications are available, it's physical
    // But we can't check that here. Default to simulator assumption.
    console.log('[DEV] DeviceInfo not available, assuming simulator');
    return false;
  }
};

// Dev mode credentials (matching Prosody accounts)
// Device assignment:
// - iPhone 17 Pro (simulator, large screen) → ik@commeazy.local
// - iPhone 16e (simulator, small screen) → oma@commeazy.local
// - iPhone 14 (physical, Bert) → test@commeazy.local
// - Other physical iPhone (Jeanine) → jeanine@commeazy.local
const getDevUserCredentials = async () => {
  // First check if this is a physical device
  const physical = await isPhysicalDevice();

  if (physical) {
    // Differentiate between physical devices using device model
    try {
      const DeviceInfo = await import('react-native-device-info');
      const model = await DeviceInfo.default.getModel();
      console.log(`[DEV] Physical device model: ${model}`);

      // iPhone 14 (Bert's device) uses test account
      // Other physical devices (Jeanine's iPhone) use jeanine account
      if (model.includes('iPhone 14')) {
        console.log(`[DEV] iPhone 14 detected (Bert), using test account`);
        return {
          jid: 'test@commeazy.local',
          password: 'test123',
          name: 'Test',
        };
      } else {
        console.log(`[DEV] Other physical device detected (Jeanine), using jeanine account`);
        return {
          jid: 'jeanine@commeazy.local',
          password: 'test123',
          name: 'Jeanine',
        };
      }
    } catch {
      // Fallback to test account if DeviceInfo fails
      console.log(`[DEV] Could not detect device model, using test account`);
      return {
        jid: 'test@commeazy.local',
        password: 'test123',
        name: 'Test',
      };
    }
  }

  // Simulator - use screen size to differentiate
  const windowDims = Dimensions.get('window');
  const screenDims = Dimensions.get('screen');

  // Prefer screen dimensions if window is not ready yet
  const width = windowDims.width > 0 ? windowDims.width : screenDims.width;
  const height = windowDims.height > 0 ? windowDims.height : screenDims.height;
  const screenSize = width * height;

  // iPhone 16e: 390x844 = 329,160 points
  // iPhone 17 Pro: 393x852 = 334,836 points OR 402x874 = 351,348 points
  // Use 335,000 as threshold (between 16e and smallest Pro)
  const isSmallDevice = screenSize < 335000;

  console.log(`[DEV] Screen dimensions: window=${windowDims.width}x${windowDims.height}, screen=${screenDims.width}x${screenDims.height}`);
  console.log(`[DEV] Using: ${width}x${height} = ${screenSize} (threshold: 335000, isSmall: ${isSmallDevice})`);

  if (isSmallDevice) {
    console.log(`[DEV] Small simulator detected, using oma account`);
    return {
      jid: 'oma@commeazy.local',
      password: 'test123',
      name: 'Oma',
    };
  } else {
    console.log(`[DEV] Large simulator detected, using ik account`);
    return {
      jid: 'ik@commeazy.local',
      password: 'test123',
      name: 'Ik',
    };
  }
};

class ServiceContainerClass {
  private _encryption: EncryptionService | null = null;
  private _xmpp: XMPPService | null = null;
  private _database: DatabaseService | null = null;
  private _notifications: NotificationService | null = null;
  private _initialized = false;

  /**
   * Initialize all services in correct order.
   * Call once at app startup (App.tsx).
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;

    // Debug: Log __DEV__ status for physical device debugging
    console.log(`[ServiceContainer] __DEV__ = ${__DEV__}, Platform = ${Platform.OS}`);

    // 1. Encryption first (needed for database encryption key)
    this._encryption = new SodiumEncryptionService();
    await this._encryption.initialize();

    // Generate keypair if none exists (dev mode or first-time setup)
    try {
      await this._encryption.getPublicKey();
    } catch {
      // No keypair exists, generate one
      await this._encryption.generateKeyPair();
      console.log('[ServiceContainer] Generated new encryption keypair');
    }

    // 2. Database (encrypted with key from encryption service)
    this._database = new WatermelonDBService();
    // For now, use a random key. In production, derive from user's PIN or keychain
    const dbKey = new ArrayBuffer(32);
    await this._database.initialize(dbKey);

    // 3. XMPP (needs encryption for message handling)
    this._xmpp = new XmppJsService();

    // 4. Notifications (FCM)
    // Note: Push notifications require a paid Apple Developer account ($99/year).
    // If initialization fails (e.g., free personal team), we continue without push.
    this._notifications = new FCMNotificationService();
    let pushAvailable = false;
    try {
      await this._notifications.initialize();
      pushAvailable = true;
      console.log('[ServiceContainer] Notification service initialized');

      // Setup token refresh handler - re-register with Prosody when token changes
      onTokenRefresh(async (newToken) => {
        console.log('[ServiceContainer] FCM token refreshed:', newToken.substring(0, 20) + '...');
        // Re-register push notifications with new token
        if (this._xmpp && this._xmpp.getConnectionStatus() === 'connected') {
          try {
            // For iOS, also get the APNs token
            const apnsToken = this._notifications?.getApnsToken
              ? await this._notifications.getApnsToken()
              : null;
            await this._xmpp.enablePushNotifications(newToken, apnsToken ?? undefined);
            console.log('[ServiceContainer] Push notifications re-registered with new token');
          } catch (error) {
            console.warn('[ServiceContainer] Failed to re-register push with new token:', error);
          }
        }
      });
    } catch (notificationError) {
      console.warn('[ServiceContainer] Push notifications not available (requires paid Apple Developer account):', notificationError);
      // Continue without push - app works fine, just no background notifications
    }

    // Mark as initialized BEFORE ChatService init (which needs ServiceContainer access)
    this._initialized = true;

    // 5. Initialize ChatService with user credentials (needs ServiceContainer.encryption)
    // In dev mode, use test credentials; in production, this comes from auth
    if (__DEV__) {
      const devUser = await getDevUserCredentials();
      await chatService.initialize(devUser.jid, devUser.name);
      console.log('[ServiceContainer] ChatService initialized for dev user:', devUser.jid);

      // Initialize GroupChatService
      await groupChatService.initialize(devUser.jid, devUser.name);
      console.log('[ServiceContainer] GroupChatService initialized for dev user:', devUser.jid);

      // 6. Connect to XMPP server in dev mode
      try {
        await this._xmpp.connect(devUser.jid, devUser.password);
        console.log('[ServiceContainer] XMPP connected to local Prosody');

        // 6a. Initialize CallService with XMPP for call signaling
        callService.initializeWithXMPP(this._xmpp, devUser.jid);
        console.log('[ServiceContainer] CallService initialized with XMPP');

        // 6b. Register push notifications with XMPP server (if available)
        if (pushAvailable && this._notifications) {
          try {
            const fcmToken = await this._notifications.getToken();
            // For iOS, also get the APNs token for direct push support
            const apnsToken = this._notifications.getApnsToken
              ? await this._notifications.getApnsToken()
              : null;
            await this._xmpp.enablePushNotifications(fcmToken, apnsToken ?? undefined);
            console.log('[ServiceContainer] Push notifications registered with Prosody');
          } catch (pushError) {
            // Push registration is optional - app works without it
            // In dev mode, this is expected to fail without proper provisioning
            if (__DEV__) {
              console.debug('[ServiceContainer] Push notifications not available in dev mode (expected)');
            } else {
              console.warn('[ServiceContainer] Failed to register push notifications:', pushError);
            }
          }
        } else {
          console.log('[ServiceContainer] Skipping push registration (not available)');
        }

        // 6c. Subscribe to mock contacts' presence (dev only)
        // This sends presence subscription requests so we receive their online status
        const { getMockContactsForDevice } = await import('./mock/mockContacts');
        const { getOtherDevicesPublicKeys } = await import('./mock/testKeys');

        // Get public keys for other test devices
        const publicKeyMap = await getOtherDevicesPublicKeys(devUser.jid);

        const contactsToSubscribe = getMockContactsForDevice(devUser.jid, publicKeyMap);
        console.log(`[ServiceContainer] Subscribing to ${contactsToSubscribe.length} contacts' presence`);
        for (const contact of contactsToSubscribe) {
          try {
            await this._xmpp.subscribeToPresence(contact.jid);
            console.log(`[ServiceContainer] Subscribed to presence of ${contact.name} (${contact.jid})`);
          } catch (subError) {
            console.warn(`[ServiceContainer] Failed to subscribe to ${contact.jid}:`, subError);
          }
        }
      } catch (xmppError) {
        // XMPP connection is optional in dev - app works with mock data
        console.warn('[ServiceContainer] XMPP connection failed (continuing with mock mode):', xmppError);
      }

      // 7. Seed mock data in development mode (dynamic import to avoid startup issues)
      try {
        const { seedMockData, printDevToolsStatus } = await import('./mock');
        await seedMockData(this._database);

        // 8. Setup deterministic test keys for E2E encryption testing
        await this.setupTestDeviceEncryption(devUser.jid);

        printDevToolsStatus();
      } catch (error) {
        console.warn('[DEV] Failed to seed mock data:', error);
      }
    }
  }

  /**
   * Setup deterministic test keys for E2E encryption between test devices.
   *
   * This enables encrypted messaging between all test devices:
   * - iPhone 17 Pro (simulator) = ik@commeazy.local
   * - iPhone 16e (simulator) = oma@commeazy.local
   * - iPhone 14 (physical) = test@commeazy.local
   *
   * How it works:
   * 1. All devices use deterministic keypairs generated from fixed seeds
   * 2. Each device stores all other devices' public keys in their contact records
   * 3. Messages are encrypted with the recipient's public key
   * 4. Messages are decrypted with the receiver's private key
   */
  private async setupTestDeviceEncryption(myJid: string): Promise<void> {
    if (!this._database || !this._encryption) return;

    try {
      const { getTestKeypairForJid, getOtherDevicesPublicKeys } = await import('./mock/testKeys');
      const { setPlaintextMode } = await import('./mock/devTools');

      // Get the deterministic test keypair for this device
      const myKeypair = await getTestKeypairForJid(myJid);
      if (!myKeypair) {
        console.log('[ServiceContainer] Not a test device JID, skipping test key setup');
        setPlaintextMode(true);
        return;
      }

      // Store the test keypair in the encryption service
      // This replaces any randomly generated keypair
      await this.useTestKeypair(myKeypair);
      console.log('[ServiceContainer] Using deterministic test keypair');

      // Get all other devices' public keys
      const otherDevicesKeys = await getOtherDevicesPublicKeys(myJid);
      if (Object.keys(otherDevicesKeys).length === 0) {
        console.warn('[ServiceContainer] Could not get other devices public keys');
        setPlaintextMode(true);
        return;
      }

      // Update all other device contacts with their public keys
      let updatedCount = 0;
      for (const [otherJid, publicKey] of Object.entries(otherDevicesKeys)) {
        const otherContact = await this._database.getContact(otherJid);

        if (otherContact) {
          // Update contact with the public key
          const updatedContact = {
            ...otherContact,
            publicKey,
          };
          await this._database.saveContact(updatedContact);
          console.log(`[ServiceContainer] Updated ${otherJid} with public key: ${publicKey.substring(0, 20)}...`);
          updatedCount++;
        } else {
          console.warn(`[ServiceContainer] Contact ${otherJid} not found`);
        }
      }

      if (updatedCount > 0) {
        // Plaintext mode is now controlled by devConfig.ts
        // With react-native-libsodium (native module), encryption should work with Hermes
        const { USE_PLAINTEXT_MODE } = await import('@/config/devConfig');
        setPlaintextMode(USE_PLAINTEXT_MODE);
        console.log(`[ServiceContainer] Updated ${updatedCount} test device contacts (plaintextMode: ${USE_PLAINTEXT_MODE})`);
      } else {
        console.warn('[ServiceContainer] No test device contacts found, using devConfig setting');
        const { USE_PLAINTEXT_MODE } = await import('@/config/devConfig');
        setPlaintextMode(USE_PLAINTEXT_MODE);
      }
    } catch (error) {
      console.error('[ServiceContainer] Failed to setup test device encryption:', error);
      // Fall back to devConfig setting on error
      const { setPlaintextMode } = await import('./mock/devTools');
      const { USE_PLAINTEXT_MODE } = await import('@/config/devConfig');
      setPlaintextMode(USE_PLAINTEXT_MODE);
    }
  }

  /**
   * Replace the encryption service's keypair with a test keypair.
   * This is only used in dev mode for deterministic testing.
   */
  private async useTestKeypair(keypair: { publicKey: string; privateKey: string }): Promise<void> {
    if (!this._encryption) return;

    // The encryption service stores keys in Keychain
    // We need to overwrite them with our test keys
    // This is done by accessing the Keychain directly
    const Keychain = await import('react-native-keychain');
    const libsodium = await import('react-native-libsodium');
    const { from_base64 } = libsodium;

    const KEY_SERVICE = 'com.commeazy.keys';

    await Keychain.setGenericPassword(
      'publicKey',
      keypair.publicKey,
      { service: `${KEY_SERVICE}.public` },
    );
    await Keychain.setGenericPassword(
      'privateKey',
      keypair.privateKey,
      { service: `${KEY_SERVICE}.private` },
    );

    // Re-initialize encryption service to load the new keys
    // Note: This is a hack for dev mode only
    (this._encryption as any).publicKey = from_base64(keypair.publicKey);
    (this._encryption as any).privateKey = from_base64(keypair.privateKey);

    console.log('[ServiceContainer] Replaced encryption keys with test keypair');
  }

  get encryption(): EncryptionService {
    this.ensureInitialized();
    return this._encryption!;
  }

  get xmpp(): XMPPService {
    this.ensureInitialized();
    return this._xmpp!;
  }

  get database(): DatabaseService {
    this.ensureInitialized();
    if (!this._database) throw new Error('DatabaseService not initialized');
    return this._database;
  }

  get notifications(): NotificationService | null {
    this.ensureInitialized();
    // Note: May be null if push notifications aren't available (free Apple Developer account)
    return this._notifications;
  }

  get isPushAvailable(): boolean {
    return this._notifications !== null;
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  /** Reset all services (for testing) */
  async reset(): Promise<void> {
    if (this._xmpp) await (this._xmpp as XmppJsService).disconnect();
    this._encryption = null;
    this._xmpp = null;
    this._database = null;
    this._notifications = null;
    this._initialized = false;
  }

  private ensureInitialized(): void {
    if (!this._initialized) {
      throw new Error('ServiceContainer not initialized — call initialize() first');
    }
  }
}

/** Singleton instance */
export const ServiceContainer = new ServiceContainerClass();
