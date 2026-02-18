/**
 * FCM Notification Service
 *
 * Handles push notifications using Firebase Cloud Messaging.
 * Supports both foreground and background message handling.
 *
 * Required for:
 * - Receiving messages when app is in background
 * - VoIP push for incoming video/voice calls
 * - New message notifications
 *
 * IMPORTANT: This service requires:
 * 1. Push Notifications capability in Xcode
 * 2. Background Modes > Remote notifications
 * 3. Valid APNs key uploaded to Firebase Console
 */

import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';
import type {
  NotificationService,
  NotificationData,
  Unsubscribe,
} from './interfaces';

// Notification handler type
type NotificationHandler = (data: NotificationData) => void;

/**
 * Parse FCM message into NotificationData
 */
const parseNotificationData = (
  message: FirebaseMessagingTypes.RemoteMessage
): NotificationData | null => {
  const { data } = message;

  if (!data) {
    console.warn('[FCM] Received message without data payload');
    return null;
  }

  // CommEazy notification format
  const type = data.type as NotificationData['type'];
  if (!type || !['message', 'call', 'group_invite'].includes(type)) {
    console.warn('[FCM] Unknown notification type:', type);
    return null;
  }

  return {
    type,
    chatId: data.chatId ?? '',
    senderJid: data.senderJid ?? '',
    senderName: data.senderName ?? '',
  };
};

/**
 * FCM-based NotificationService implementation
 */
export class FCMNotificationService implements NotificationService {
  private handlers: Set<NotificationHandler> = new Set();
  private foregroundUnsubscribe: (() => void) | null = null;
  private initialized = false;
  private apnsToken: string | null = null;

  /**
   * Initialize the notification service.
   * - Requests permission (iOS)
   * - Registers for remote notifications
   * - Sets up message handlers
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[FCM] Already initialized');
      return;
    }

    console.log('[FCM] Initializing notification service...');

    // Request permission
    const permissionGranted = await this.requestPermission();
    if (!permissionGranted) {
      console.warn('[FCM] Notification permission denied');
      // Continue anyway - user can enable later in settings
    }

    // Note: We don't call registerDeviceForRemoteMessages() manually because:
    // 1. Firebase auto-registers by default (firebase.json setting)
    // 2. Manual registration requires valid aps-environment entitlement + provisioning
    // 3. In development without proper provisioning, this causes errors
    // The token will be available when the device is properly registered via auto-registration

    // Setup foreground message handler
    this.foregroundUnsubscribe = messaging().onMessage(async (message) => {
      console.log('[FCM] Foreground message received:', message.messageId);
      this.handleMessage(message);
    });

    // Setup notification opened handler (when user taps notification)
    messaging().onNotificationOpenedApp((message) => {
      console.log('[FCM] Notification opened app:', message.messageId);
      this.handleMessage(message);
    });

    // Check if app was opened from notification (cold start)
    const initialMessage = await messaging().getInitialNotification();
    if (initialMessage) {
      console.log('[FCM] App opened from notification:', initialMessage.messageId);
      this.handleMessage(initialMessage);
    }

    // Get the FCM token (for development logging only)
    // In dev mode without proper provisioning, this will fail silently
    try {
      const token = await this.getToken();
      if (__DEV__ && token) {
        // SECURITY: Only log truncated token (first 20 chars)
        console.log('[FCM] Device token (truncated):', token.substring(0, 20) + '...');
      }
    } catch (error) {
      // In dev mode, token retrieval often fails due to missing provisioning
      // This is expected and not an error - push notifications just won't work locally
      if (__DEV__) {
        console.debug('[FCM] Token not available in dev mode (expected without provisioning)');
      } else {
        console.warn('[FCM] Failed to get token:', error);
      }
    }

    this.initialized = true;
    console.log('[FCM] Notification service initialized');
  }

  /**
   * Request notification permission from the user.
   * iOS: Shows system permission dialog
   * Android 13+: Shows POST_NOTIFICATIONS permission dialog
   */
  private async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      console.log('[FCM] iOS permission status:', authStatus, 'enabled:', enabled);
      return enabled;
    }

    // Android 13+ requires POST_NOTIFICATIONS permission
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        const enabled = granted === PermissionsAndroid.RESULTS.GRANTED;
        console.log('[FCM] Android permission:', granted, 'enabled:', enabled);
        return enabled;
      } catch (error) {
        console.warn('[FCM] Android permission request failed:', error);
        return false;
      }
    }

    // Android < 13 doesn't need runtime permission
    return true;
  }

  /**
   * Get the FCM device token.
   * This token is used to send push notifications to this device.
   * Should be sent to Prosody for mod_cloud_notify.
   *
   * Note: In development without proper provisioning, this will throw.
   * The caller should handle this gracefully.
   */
  async getToken(): Promise<string> {
    // Don't wrap in try/catch here - let caller handle the error
    // This avoids double-logging errors
    const token = await messaging().getToken();
    return token;
  }

  /**
   * Get the APNs device token (iOS only).
   * This is the raw hex token that can be used for direct APNs push.
   * Returns null on Android or if not available.
   */
  async getApnsToken(): Promise<string | null> {
    if (Platform.OS !== 'ios') {
      return null;
    }

    try {
      // Firebase exposes the APNs token via getAPNSToken
      const token = await messaging().getAPNSToken();
      if (token) {
        this.apnsToken = token;
        console.log('[FCM] APNs token:', token.substring(0, 20) + '...');
      }
      return token;
    } catch (error) {
      console.warn('[FCM] Failed to get APNs token:', error);
      return null;
    }
  }

  /**
   * Subscribe to notification events.
   * Handler is called when a notification is received (foreground or tap).
   */
  onNotification(handler: NotificationHandler): Unsubscribe {
    this.handlers.add(handler);

    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Handle incoming FCM message
   */
  private handleMessage(message: FirebaseMessagingTypes.RemoteMessage): void {
    const data = parseNotificationData(message);
    if (!data) return;

    console.log('[FCM] Handling notification:', data.type, 'from:', data.senderName);

    // Notify all handlers
    this.handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error('[FCM] Handler error:', error);
      }
    });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.foregroundUnsubscribe) {
      this.foregroundUnsubscribe();
      this.foregroundUnsubscribe = null;
    }
    this.handlers.clear();
    this.initialized = false;
    console.log('[FCM] Notification service destroyed');
  }
}

/**
 * Background message handler
 *
 * IMPORTANT: This must be registered in index.js, BEFORE AppRegistry.registerComponent
 * because it needs to be available even when the app is not running.
 *
 * Usage in index.js:
 *   import { setBackgroundMessageHandler } from '@/services/notifications';
 *   setBackgroundMessageHandler();
 */
export const setBackgroundMessageHandler = (): void => {
  messaging().setBackgroundMessageHandler(async (message) => {
    console.log('[FCM] Background message received:', message.messageId);

    // Parse the notification data
    const data = parseNotificationData(message);
    if (!data) return;

    console.log('[FCM] Background notification:', data.type, 'from:', data.senderName);

    // For background messages, we can:
    // 1. Show a local notification (if silent push)
    // 2. Update local database
    // 3. Trigger sync
    //
    // The actual message content comes via XMPP when app opens,
    // so we just need to wake the user with a notification.
    //
    // TODO: When app wakes up, reconnect XMPP and fetch pending messages
  });

  console.log('[FCM] Background message handler registered');
};

/**
 * Token refresh handler
 *
 * Called when the FCM token changes. The new token should be sent to Prosody.
 */
export const onTokenRefresh = (callback: (token: string) => void): Unsubscribe => {
  return messaging().onTokenRefresh(callback);
};
