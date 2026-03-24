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
import { getContactDisplayName } from './interfaces';
import { SodiumEncryptionService } from './encryption';
import { XmppJsService } from './xmpp';
import { WatermelonDBService } from './database';
import { chatService } from './chat';
import { groupChatService } from './groupChat';
import { callService } from './call';
import { FCMNotificationService, onTokenRefresh } from './notifications';
import { registerForVoIPPush, getVoIPToken, onVoIPPush } from './voipPushService';
import { ProfileSyncService } from './profileSync';

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

// Dev mode credentials (matching Prosody accounts — UUID-based JIDs)
/**
 * Get development user credentials based on device detection.
 *
 * PRIVACY ARCHITECTURE: JIDs are UUID-based (production-parity).
 * Names are profile data only — no PII in XMPP identifiers.
 *
 * UUID → Device mapping:
 * - e5f6a7b8-...@commeazy.local → iPhone 14 (Bert)
 * - b8c9d0e1-...@commeazy.local → iPhone 12 (Jeanine)
 * - d0e1f2a3-...@commeazy.local → iPad (Pipo)
 * - f6a7b8c9-...@commeazy.local → iPhone 17 Pro sim
 * - a7b8c9d0-...@commeazy.local → iPhone 16e sim
 * - c9d0e1f2-...@commeazy.local → iPad sim
 */
const getDevUserCredentials = async () => {
  // First check if this is a physical device
  const physical = await isPhysicalDevice();

  if (physical) {
    // Differentiate between physical devices using device model
    try {
      const DeviceInfo = await import('react-native-device-info');
      const model = await DeviceInfo.default.getModel();
      console.log(`[DEV] Physical device model: ${model}`);

      // iPhone 14 (Bert's device)
      if (model.includes('iPhone 14')) {
        console.log(`[DEV] iPhone 14 detected (Bert)`);
        return {
          jid: 'e5f6a7b8-c9d0-4e5f-2a6b-3c4d5e6f7a8b@commeazy.local',
          password: 'test123',
          name: 'Bert',
        };
      } else if (model.includes('iPad')) {
        console.log(`[DEV] Physical iPad detected (Pipo)`);
        return {
          jid: 'd0e1f2a3-b4c5-4d0e-7f1a-8b9c0d1e2f3a@commeazy.local',
          password: 'test123',
          name: 'Pipo',
        };
      } else {
        // Other physical iPhones (Jeanine's iPhone 12)
        console.log(`[DEV] Other physical device detected (Jeanine)`);
        return {
          jid: 'b8c9d0e1-f2a3-4b8c-5d9e-6f7a8b9c0d1e@commeazy.local',
          password: 'test123',
          name: 'Jeanine',
        };
      }
    } catch {
      // Fallback to bert account if DeviceInfo fails
      console.log(`[DEV] Could not detect device model, using bert account`);
      return {
        jid: 'e5f6a7b8-c9d0-4e5f-2a6b-3c4d5e6f7a8b@commeazy.local',
        password: 'test123',
        name: 'Bert',
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

  // iPad detection: iPads have much larger screens
  // iPad mini: 744x1133 = ~843,000 points
  // iPad Air/Pro 11": 820x1180 = ~968,000 points
  // iPad Pro 12.9": 1024x1366 = ~1,400,000 points
  // Use 600,000 as threshold (well above any iPhone, well below any iPad)
  const isIPad = screenSize > 600000;

  // iPhone 16e: 390x844 = 329,160 points
  // iPhone 17 Pro: 393x852 = 334,836 points OR 402x874 = 351,348 points
  // Use 335,000 as threshold (between 16e and smallest Pro)
  const isSmallDevice = screenSize < 335000;

  console.log(`[DEV] Screen dimensions: window=${windowDims.width}x${windowDims.height}, screen=${screenDims.width}x${screenDims.height}`);
  console.log(`[DEV] Using: ${width}x${height} = ${screenSize} (isIPad: ${isIPad}, isSmall: ${isSmallDevice})`);

  if (isIPad) {
    console.log(`[DEV] iPad simulator detected`);
    return {
      jid: 'c9d0e1f2-a3b4-4c9d-6e0f-7a8b9c0d1e2f@commeazy.local',
      password: 'test123',
      name: 'SimiPad',
    };
  } else if (isSmallDevice) {
    console.log(`[DEV] Small simulator detected (iPhone 16e)`);
    return {
      jid: 'a7b8c9d0-e1f2-4a7b-4c8d-5e6f7a8b9c0d@commeazy.local',
      password: 'test123',
      name: 'Sim2',
    };
  } else {
    console.log(`[DEV] Large simulator detected (iPhone 17 Pro)`);
    return {
      jid: 'f6a7b8c9-d0e1-4f6a-3b7c-4d5e6f7a8b9c@commeazy.local',
      password: 'test123',
      name: 'Sim1',
    };
  }
};

class ServiceContainerClass {
  private _encryption: EncryptionService | null = null;
  private _xmpp: XMPPService | null = null;
  private _database: DatabaseService | null = null;
  private _notifications: NotificationService | null = null;
  private _profileSync: ProfileSyncService | null = null;
  private _profileSyncStatusUnsub: (() => void) | null = null;
  private _initialized = false;
  private _voipPushUnsubscribe: (() => void) | null = null;

  /** Stored credentials for reconnection after background/foreground transitions */
  private _credentials: { jid: string; password: string } | null = null;

  /** Get stored credentials for reconnection */
  get credentials(): { jid: string; password: string } | null {
    return this._credentials;
  }

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

    // 2. Database (encrypted with key from Keychain)
    this._database = new WatermelonDBService();
    const { getDatabaseKey } = await import('./keyManager');
    const dbKeyHex = await getDatabaseKey();
    await this._database.initialize(dbKeyHex);

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
        console.info('[ServiceContainer] FCM token refreshed:', newToken.substring(0, 20) + '...');
        // Re-register push notifications with new token
        if (this._xmpp && this._xmpp.getConnectionStatus() === 'connected') {
          try {
            // For iOS, also get the APNs and VoIP tokens
            const apnsToken = this._notifications?.getApnsToken
              ? await this._notifications.getApnsToken()
              : null;
            const voipToken = await getVoIPToken();
            await this._xmpp.enablePushNotifications(newToken, apnsToken ?? undefined, voipToken ?? undefined);
            console.info('[ServiceContainer] Push notifications re-registered with new token');
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

      // Store credentials immediately so foreground handler can reconnect
      // (AppState listener may fire before XMPP connect completes)
      this._credentials = { jid: devUser.jid, password: devUser.password };

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

            // Register FCM/APNs push immediately (fast, non-blocking)
            await this._xmpp.enablePushNotifications(fcmToken, apnsToken ?? undefined, undefined);
            console.info('[ServiceContainer] Push notifications registered with Prosody');

            // Register VoIP push DEFERRED (non-blocking) — PushKit token can take 10-30s
            // on first registration. Don't block startup for this.
            const xmppRef = this._xmpp;
            registerForVoIPPush().then(async (voipToken) => {
              if (voipToken) {
                try {
                  await xmppRef.enablePushNotifications(fcmToken, apnsToken ?? undefined, voipToken);
                  console.info('[ServiceContainer] VoIP push registered (deferred, incoming calls ready)');
                } catch (err) {
                  console.warn('[ServiceContainer] Deferred VoIP push registration failed:', err);
                }
              } else {
                console.debug('[ServiceContainer] No VoIP token received (calls still work via regular push)');
              }
            }).catch((err) => {
              console.debug('[ServiceContainer] VoIP push registration error (non-fatal):', err);
            });

            // 6b-2. Listen for incoming VoIP pushes (iOS only)
            // Native layer already shows CallKit UI immediately (Apple requirement).
            // This JS handler ensures XMPP is connected to receive the call signaling.
            this._voipPushUnsubscribe = onVoIPPush((payload) => {
              console.info('[ServiceContainer] VoIP push received in JS layer');
              // Ensure XMPP is connected — the app may have been woken from killed state
              if (this._xmpp && this._xmpp.getConnectionStatus() !== 'connected' && this._credentials) {
                console.info('[ServiceContainer] Reconnecting XMPP after VoIP push wake...');
                this._xmpp.connect(this._credentials.jid, this._credentials.password).catch((err) => {
                  console.error('[ServiceContainer] XMPP reconnect after VoIP push failed:', err);
                });
              }
            });
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
          console.info('[ServiceContainer] Skipping push registration (not available)');
        }

        // 6c. Subscribe to database contacts' presence
        // This sends presence subscription requests so we receive their online status
        if (this._database) {
          try {
            const dbContacts = await this._database.getContacts();
            console.log(`[ServiceContainer] Subscribing to ${dbContacts.length} contacts' presence`);
            for (const contact of dbContacts) {
              try {
                await this._xmpp.subscribeToPresence(contact.jid);
                console.debug('[ServiceContainer] Subscribed to presence of contact');
              } catch (subError) {
                console.warn(`[ServiceContainer] Failed to subscribe to ${contact.jid}:`, subError);
              }
            }
          } catch (dbError) {
            console.warn('[ServiceContainer] Failed to load contacts for presence subscription:', dbError);
          }
        }

        // 6d. Initialize ProfileSync service (needs XMPP + DB + Encryption)
        this._profileSync = new ProfileSyncService();
        const xmppService = this._xmpp as XmppJsService;
        const dbService = this._database as WatermelonDBService;
        const encryptionImpl = this._encryption as SodiumEncryptionService;
        this._profileSync.initialize({
          getDatabase: () => dbService,
          getEncryption: () => encryptionImpl,
          getPrivateKey: () => (encryptionImpl as unknown as { privateKey: Uint8Array | null }).privateKey,
          sendProfileStanza: (to, message) => xmppService.sendProfileStanza(to, message),
          onProfileSync: (handler) => xmppService.onProfileSync(handler),
          updateContactProfile: (jid, data) => dbService.updateContactProfile(jid, data),
        });
        // Subscribe to connection status for bulk profile checks on reconnect
        const statusUnsub = xmppService.observeConnectionStatus().subscribe((status) => {
          if (status === 'connected' && this._profileSync) {
            console.info('[ProfileSync] XMPP connected — running bulk version check');
            void this._profileSync.bulkCheckContacts();
          }
        });
        // Store unsubscribe so it gets cleaned up on destroy
        // (ProfileSync.destroy() handles its own XMPP handler; this is separate)
        this._profileSyncStatusUnsub = statusUnsub;

        console.log('[ServiceContainer] ProfileSyncService initialized');
      } catch (xmppError) {
        // XMPP connection is optional in dev
        console.warn('[ServiceContainer] XMPP connection failed:', xmppError);
      }

      // 7. Setup deterministic test keys for E2E encryption testing
      try {
        await this.setupTestDeviceEncryption(devUser.jid);
      } catch (error) {
        console.warn('[DEV] Failed to setup test device encryption:', error);
      }
    }
  }

  /**
   * Setup deterministic test keys for E2E encryption between test devices.
   *
   * This enables encrypted messaging between all test devices (UUID-based JIDs):
   * - Physical: e5f6a7b8-...@commeazy.local (Bert), b8c9d0e1-...@commeazy.local (Jeanine), d0e1f2a3-...@commeazy.local (Pipo)
   * - Simulator: f6a7b8c9-...@commeazy.local (Sim1), a7b8c9d0-...@commeazy.local (Sim2), c9d0e1f2-...@commeazy.local (SimiPad)
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
      const { getTestKeypairForJid, getOtherDevicesPublicKeys } = await import('./testKeys');

      // Get the deterministic test keypair for this device
      const myKeypair = await getTestKeypairForJid(myJid);
      if (!myKeypair) {
        console.log('[ServiceContainer] Not a test device JID, skipping test key setup');
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
        return;
      }

      // Create or update all other device contacts with their public keys
      const { TEST_ACCOUNTS } = await import('@/config/devConfig');

      // Build JID → account info lookup (including test dates in March/April)
      const jidToAccount = new Map<string, {
        firstName: string;
        lastName: string;
        birthDate?: string;
        weddingDate?: string;
        deathDate?: string;
      }>();
      const testDates: Record<string, { birthDate?: string; weddingDate?: string; deathDate?: string }> = {
        [TEST_ACCOUNTS.jeanine.jid]: { birthDate: '1962-03-15', weddingDate: '1985-04-22' },
        [TEST_ACCOUNTS.pipo.jid]: { birthDate: '1955-04-03' },
        [TEST_ACCOUNTS.sim1.jid]: { birthDate: '1990-03-28', weddingDate: '2018-04-08' },
        [TEST_ACCOUNTS.sim2.jid]: { birthDate: '1948-04-10', weddingDate: '1972-03-01' },
        [TEST_ACCOUNTS.simipad.jid]: { birthDate: '1935-03-05', deathDate: '2020-04-12' },
      };
      for (const account of Object.values(TEST_ACCOUNTS)) {
        jidToAccount.set(account.jid, {
          firstName: account.firstName,
          lastName: account.lastName,
          ...testDates[account.jid],
        });
      }

      let updatedCount = 0;
      let createdCount = 0;
      for (const [otherJid, publicKey] of Object.entries(otherDevicesKeys)) {
        const otherContact = await this._database.getContact(otherJid);

        if (otherContact) {
          // Update existing contact with public key + test dates
          const accountInfo = jidToAccount.get(otherJid);
          const updatedContact = {
            ...otherContact,
            publicKey,
            birthDate: accountInfo?.birthDate ?? otherContact.birthDate,
            weddingDate: accountInfo?.weddingDate ?? otherContact.weddingDate,
            deathDate: accountInfo?.deathDate ?? otherContact.deathDate,
          };
          await this._database.saveContact(updatedContact);
          console.log(`[ServiceContainer] Updated ${otherJid} with public key: ${publicKey.substring(0, 20)}...`);
          updatedCount++;
        } else {
          // Create new contact with firstName + lastName from TEST_ACCOUNTS
          const accountInfo = jidToAccount.get(otherJid);
          const userUuid = otherJid.split('@')[0] ?? otherJid;
          const newContact = {
            userUuid,
            jid: otherJid,
            firstName: accountInfo?.firstName ?? 'Unknown',
            lastName: accountInfo?.lastName ?? '',
            publicKey,
            verified: false,
            lastSeen: Date.now(),
            trustLevel: 2, // Connected (test device)
            birthDate: accountInfo?.birthDate,
            weddingDate: accountInfo?.weddingDate,
            deathDate: accountInfo?.deathDate,
          };
          await this._database.saveContact(newContact);
          console.log(`[ServiceContainer] Created contact ${newContact.firstName} ${newContact.lastName} (${otherJid})`);
          createdCount++;
        }
      }

      console.log(`[ServiceContainer] Test device contacts: ${createdCount} created, ${updatedCount} updated`);

      // Auto-create own UserProfile for test device (so ProfileSettings works without onboarding)
      const existingProfile = await this._database.getUserProfile();
      if (!existingProfile) {
        const myAccount = jidToAccount.get(myJid);
        const myUuid = myJid.split('@')[0] ?? myJid;
        await this._database.saveUserProfile({
          userUuid: myUuid,
          jid: myJid,
          firstName: myAccount?.firstName ?? 'Test',
          lastName: myAccount?.lastName ?? 'User',
          publicKey: myKeypair.publicKey,
          language: 'nl',
          subscriptionTier: 'free',
        });
        console.log(`[ServiceContainer] Auto-created UserProfile for ${myAccount?.firstName ?? myJid}`);
      } else {
        console.log('[ServiceContainer] UserProfile already exists, skipping auto-create');
      }

      // Auto-create SharedDataConsent for all other test devices (enables profile sync testing)
      for (const otherJid of Object.keys(otherDevicesKeys)) {
        const existingConsent = await this._database.getConsentForContact(otherJid);
        if (!existingConsent) {
          await this._database.setConsentForContact(otherJid, true);
          console.log(`[ServiceContainer] Auto-created consent for ${otherJid.split('@')[0]}`);
        }
      }
      console.log('[ServiceContainer] Test device consent records created for profile sync');
    } catch (error) {
      console.error('[ServiceContainer] Failed to setup test device encryption:', error);
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
    const { from_base64, base64_variants } = await import('react-native-libsodium');

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
    // CRITICAL: Must use base64_variants.ORIGINAL to match the encoding from testKeys.ts
    const encryptionImpl = this._encryption as unknown as { publicKey: Uint8Array | null; privateKey: Uint8Array | null };
    encryptionImpl.publicKey = from_base64(keypair.publicKey, base64_variants.ORIGINAL);
    encryptionImpl.privateKey = from_base64(keypair.privateKey, base64_variants.ORIGINAL);

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

  get profileSync(): ProfileSyncService | null {
    return this._profileSync;
  }

  get isPushAvailable(): boolean {
    return this._notifications !== null;
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  /** Reset all services (for testing) */
  async reset(): Promise<void> {
    if (this._profileSyncStatusUnsub) this._profileSyncStatusUnsub();
    if (this._profileSync) this._profileSync.destroy();
    if (this._xmpp) await (this._xmpp as XmppJsService).disconnect();
    this._encryption = null;
    this._xmpp = null;
    this._database = null;
    this._notifications = null;
    this._profileSync = null;
    this._profileSyncStatusUnsub = null;
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
