/**
 * LocalNotificationService — Generieke lokale notificatie service
 *
 * Gestandaardiseerde service voor ALLE lokale notificaties in CommEazy.
 * Gebruikt @notifee/react-native voor cross-platform lokale notificatie scheduling.
 *
 * Verantwoordelijkheden:
 * - Kanaal management (Android)
 * - Notificatie scheduling (timestamp-based triggers)
 * - Actionable notifications (knoppen in notificatie)
 * - Notificatie cancel/update
 * - Event handling (tap, actie knoppen)
 * - Permission management
 *
 * Gebruik:
 *   import { localNotificationService } from '@/services/localNotifications';
 *
 *   // Schedule een notificatie
 *   await localNotificationService.schedule({
 *     id: 'agenda-123-reminder',
 *     channelId: 'agenda',
 *     title: 'Doktersafspraak',
 *     body: 'Over 1 uur — 11:00',
 *     triggerTimestamp: Date.now() + 3600000,
 *     data: { type: 'agenda', itemId: '123' },
 *   });
 *
 *   // Cancel een notificatie
 *   await localNotificationService.cancel('agenda-123-reminder');
 *
 * @see hooks/useAgendaNotifications.ts voor agenda-specifieke scheduling logica
 */

import { Platform } from 'react-native';

// ============================================================
// Types
// ============================================================

/** Notification channel definition (Android requirement, iOS ignores) */
export interface NotificationChannel {
  id: string;
  name: string;
  description?: string;
  /** Sound enabled (default: true) */
  sound?: boolean;
  /** Vibration enabled (default: true) */
  vibration?: boolean;
  /** Badge count on app icon (default: true) */
  badge?: boolean;
}

/** Action button on a notification */
export interface NotificationAction {
  /** Unique action ID (e.g., 'medication-taken', 'snooze') */
  id: string;
  /** Display label */
  title: string;
  /** Dismiss notification after action (default: true) */
  autoDismiss?: boolean;
}

/** Schedule request for a local notification */
export interface ScheduleRequest {
  /** Unique notification ID — used for cancel/update */
  id: string;
  /** Channel ID (must be registered first) */
  channelId: string;
  /** Notification title */
  title: string;
  /** Notification body text */
  body: string;
  /** Timestamp when notification should fire (ms since epoch) */
  triggerTimestamp: number;
  /** Custom data payload (delivered to event handlers) */
  data?: Record<string, string>;
  /** Action buttons (max 3 for iOS, 3 for Android) */
  actions?: NotificationAction[];
  /** Category ID for grouping actions (iOS) */
  categoryId?: string;
}

/** Display request for an immediate notification */
export interface DisplayRequest {
  /** Unique notification ID */
  id: string;
  /** Channel ID */
  channelId: string;
  /** Notification title */
  title: string;
  /** Notification body text */
  body: string;
  /** Custom data payload */
  data?: Record<string, string>;
  /** Action buttons */
  actions?: NotificationAction[];
  /** Category ID */
  categoryId?: string;
}

/** Event types emitted by the service */
export type NotificationEventType = 'press' | 'action' | 'dismissed';

/** Notification event payload */
export interface NotificationEvent {
  type: NotificationEventType;
  /** Notification ID */
  notificationId: string;
  /** Action ID (only for 'action' type) */
  actionId?: string;
  /** Custom data from the notification */
  data: Record<string, string>;
}

/** Event handler function */
export type NotificationEventHandler = (event: NotificationEvent) => void;

/** Unsubscribe function */
type Unsubscribe = () => void;

// ============================================================
// Predefined Channels
// ============================================================

/** Standard notification channels for CommEazy */
export const NOTIFICATION_CHANNELS: Record<string, NotificationChannel> = {
  agenda: {
    id: 'agenda',
    name: 'Agenda Herinneringen',
    description: 'Herinneringen voor afspraken en medicijnen',
    sound: true,
    vibration: true,
    badge: true,
  },
  medication: {
    id: 'medication',
    name: 'Medicijn Herinneringen',
    description: 'Herinneringen om medicijnen in te nemen',
    sound: true,
    vibration: true,
    badge: true,
  },
  general: {
    id: 'general',
    name: 'Algemeen',
    description: 'Algemene meldingen',
    sound: true,
    vibration: true,
    badge: true,
  },
};

/** Notification action categories (for iOS action grouping) */
export const NOTIFICATION_CATEGORIES = {
  MEDICATION_REMINDER: 'medication-reminder',
  AGENDA_REMINDER: 'agenda-reminder',
} as const;

/** Predefined actions for medication notifications */
export const MEDICATION_ACTIONS: NotificationAction[] = [
  {
    id: 'medication-taken',
    title: '', // Set dynamically from i18n
    autoDismiss: true,
  },
  {
    id: 'medication-snooze',
    title: '', // Set dynamically from i18n
    autoDismiss: true,
  },
];

// ============================================================
// Service Implementation
// ============================================================

class LocalNotificationService {
  private _initialized = false;
  private _eventHandlers: Map<string, NotificationEventHandler[]> = new Map();
  private _notifee: typeof import('@notifee/react-native').default | null = null;
  private _foregroundUnsubscribe: Unsubscribe | null = null;

  /**
   * Initialize the service.
   * Must be called once at app startup (App.tsx or ServiceContainer).
   * Creates default channels and sets up event listeners.
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;

    try {
      const notifeeModule = await import('@notifee/react-native');
      this._notifee = notifeeModule.default;

      // Create default channels (Android — iOS ignores this)
      await this._createDefaultChannels();

      // Set up iOS notification categories with actions
      await this._setupCategories();

      // Set up foreground event handler
      this._foregroundUnsubscribe = this._notifee.onForegroundEvent(
        ({ type, detail }) => {
          this._handleEvent(type, detail);
        },
      );

      this._initialized = true;
      console.info('[LocalNotifications] Service initialized');
    } catch (error) {
      console.warn(
        '[LocalNotifications] Failed to initialize:',
        error instanceof Error ? error.message : error,
      );
      // App continues without local notifications
    }
  }

  /**
   * Register a background event handler.
   * MUST be called in index.js (before AppRegistry.registerComponent).
   *
   * Usage in index.js:
   *   import { localNotificationService } from '@/services/localNotifications';
   *   localNotificationService.registerBackgroundHandler();
   */
  registerBackgroundHandler(): void {
    // Dynamic import to avoid issues if notifee not installed
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const notifee = require('@notifee/react-native').default;
      notifee.onBackgroundEvent(async ({ type, detail }: { type: number; detail: any }) => {
        this._handleEvent(type, detail);
      });
      console.debug('[LocalNotifications] Background handler registered');
    } catch (error) {
      console.warn(
        '[LocalNotifications] Background handler registration failed:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Request notification permissions from the user.
   * Returns true if granted, false if denied.
   */
  async requestPermission(): Promise<boolean> {
    if (!this._notifee) return false;

    try {
      const notifeeModule = await import('@notifee/react-native');
      const { AuthorizationStatus } = notifeeModule;
      const settings = await this._notifee.requestPermission();

      const granted =
        settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
        settings.authorizationStatus === AuthorizationStatus.PROVISIONAL;

      console.info('[LocalNotifications] Permission:', granted ? 'granted' : 'denied');
      return granted;
    } catch (error) {
      console.warn('[LocalNotifications] Permission request failed:', error);
      return false;
    }
  }

  /**
   * Check current notification permission status.
   */
  async checkPermission(): Promise<boolean> {
    if (!this._notifee) return false;

    try {
      const notifeeModule = await import('@notifee/react-native');
      const { AuthorizationStatus } = notifeeModule;
      const settings = await this._notifee.getNotificationSettings();

      return (
        settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
        settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
      );
    } catch {
      return false;
    }
  }

  /**
   * Schedule a notification for a future timestamp.
   * If a notification with the same ID already exists, it will be replaced.
   */
  async schedule(request: ScheduleRequest): Promise<void> {
    if (!this._notifee) {
      console.debug('[LocalNotifications] Not initialized, skipping schedule');
      return;
    }

    // Don't schedule notifications in the past
    if (request.triggerTimestamp <= Date.now()) {
      console.debug('[LocalNotifications] Skipping past notification:', request.id);
      return;
    }

    try {
      const notifeeModule = await import('@notifee/react-native');
      const { TriggerType, AndroidImportance } = notifeeModule;

      await this._notifee.createTriggerNotification(
        {
          id: request.id,
          title: request.title,
          body: request.body,
          data: request.data,
          android: {
            channelId: request.channelId,
            smallIcon: 'ic_launcher',
            importance: AndroidImportance.HIGH,
            pressAction: { id: 'default' },
            actions: request.actions?.map(a => ({
              title: a.title,
              pressAction: { id: a.id },
            })),
          },
          ios: {
            categoryId: request.categoryId,
            sound: 'default',
          },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: request.triggerTimestamp,
        },
      );

      console.debug(
        '[LocalNotifications] Scheduled:',
        request.id,
        'at',
        new Date(request.triggerTimestamp).toISOString(),
      );
    } catch (error) {
      console.warn(
        '[LocalNotifications] Schedule failed:',
        request.id,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Display a notification immediately.
   */
  async display(request: DisplayRequest): Promise<void> {
    if (!this._notifee) return;

    try {
      const notifeeModule = await import('@notifee/react-native');
      const { AndroidImportance } = notifeeModule;

      await this._notifee.displayNotification({
        id: request.id,
        title: request.title,
        body: request.body,
        data: request.data,
        android: {
          channelId: request.channelId,
          smallIcon: 'ic_launcher',
          importance: AndroidImportance.HIGH,
          pressAction: { id: 'default' },
          actions: request.actions?.map(a => ({
            title: a.title,
            pressAction: { id: a.id },
          })),
        },
        ios: {
          categoryId: request.categoryId,
          sound: 'default',
        },
      });
    } catch (error) {
      console.warn('[LocalNotifications] Display failed:', error);
    }
  }

  /**
   * Cancel a scheduled notification by ID.
   */
  async cancel(notificationId: string): Promise<void> {
    if (!this._notifee) return;

    try {
      await this._notifee.cancelNotification(notificationId);
      console.debug('[LocalNotifications] Cancelled:', notificationId);
    } catch (error) {
      console.debug('[LocalNotifications] Cancel failed (may not exist):', notificationId);
    }
  }

  /**
   * Cancel multiple notifications by ID prefix.
   * Useful for cancelling all notifications for a specific agenda item.
   *
   * Example: cancelByPrefix('agenda-item-123') cancels:
   *   'agenda-item-123-reminder'
   *   'agenda-item-123-09:00'
   *   'agenda-item-123-21:00'
   */
  async cancelByPrefix(prefix: string): Promise<void> {
    if (!this._notifee) return;

    try {
      const triggers = await this._notifee.getTriggerNotificationIds();
      const toCancel = triggers.filter(id => id.startsWith(prefix));

      await Promise.all(toCancel.map(id => this._notifee!.cancelNotification(id)));

      if (toCancel.length > 0) {
        console.debug(
          '[LocalNotifications] Cancelled',
          toCancel.length,
          'notifications with prefix:',
          prefix,
        );
      }
    } catch (error) {
      console.warn('[LocalNotifications] cancelByPrefix failed:', error);
    }
  }

  /**
   * Cancel ALL scheduled notifications.
   * Use with caution — affects all modules.
   */
  async cancelAll(): Promise<void> {
    if (!this._notifee) return;

    try {
      await this._notifee.cancelAllNotifications();
      console.info('[LocalNotifications] All notifications cancelled');
    } catch (error) {
      console.warn('[LocalNotifications] cancelAll failed:', error);
    }
  }

  /**
   * Get all currently scheduled notification IDs.
   */
  async getScheduledIds(): Promise<string[]> {
    if (!this._notifee) return [];

    try {
      return await this._notifee.getTriggerNotificationIds();
    } catch {
      return [];
    }
  }

  /**
   * Get count of scheduled notifications.
   * iOS has a limit of 64 pending local notifications.
   */
  async getScheduledCount(): Promise<number> {
    const ids = await this.getScheduledIds();
    return ids.length;
  }

  /**
   * Subscribe to notification events (tap, action button press, dismiss).
   * Returns an unsubscribe function.
   *
   * @param type - Event type to listen for ('press' | 'action' | 'dismissed'), or '*' for all
   * @param handler - Event handler function
   */
  onEvent(type: NotificationEventType | '*', handler: NotificationEventHandler): Unsubscribe {
    const key = type;
    const handlers = this._eventHandlers.get(key) || [];
    handlers.push(handler);
    this._eventHandlers.set(key, handlers);

    return () => {
      const current = this._eventHandlers.get(key) || [];
      this._eventHandlers.set(
        key,
        current.filter(h => h !== handler),
      );
    };
  }

  /**
   * Update channel settings (e.g., from user preferences).
   */
  async updateChannel(channel: NotificationChannel): Promise<void> {
    if (!this._notifee) return;

    try {
      const notifeeModule = await import('@notifee/react-native');
      const { AndroidImportance } = notifeeModule;

      await this._notifee.createChannel({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        sound: channel.sound !== false ? 'default' : undefined,
        vibration: channel.vibration !== false,
        badge: channel.badge !== false,
        importance: AndroidImportance.HIGH,
      });
    } catch (error) {
      console.warn('[LocalNotifications] updateChannel failed:', error);
    }
  }

  /**
   * Cleanup: unsubscribe event listeners.
   */
  destroy(): void {
    if (this._foregroundUnsubscribe) {
      this._foregroundUnsubscribe();
      this._foregroundUnsubscribe = null;
    }
    this._eventHandlers.clear();
    this._initialized = false;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private async _createDefaultChannels(): Promise<void> {
    if (!this._notifee) return;

    const notifeeModule = await import('@notifee/react-native');
    const { AndroidImportance } = notifeeModule;

    for (const channel of Object.values(NOTIFICATION_CHANNELS)) {
      await this._notifee.createChannel({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        sound: channel.sound !== false ? 'default' : undefined,
        vibration: channel.vibration !== false,
        badge: channel.badge !== false,
        importance: AndroidImportance.HIGH,
      });
    }
  }

  private async _setupCategories(): Promise<void> {
    if (!this._notifee || Platform.OS !== 'ios') return;

    try {
      await this._notifee.setNotificationCategories([
        {
          id: NOTIFICATION_CATEGORIES.MEDICATION_REMINDER,
          actions: [
            {
              id: 'medication-taken',
              title: '✅ Ingenomen', // Fallback — updated at schedule time via i18n
            },
            {
              id: 'medication-snooze',
              title: '⏰ Later', // Fallback — updated at schedule time via i18n
            },
          ],
        },
        {
          id: NOTIFICATION_CATEGORIES.AGENDA_REMINDER,
          actions: [
            {
              id: 'agenda-open',
              title: '📅 Bekijken', // Fallback
            },
          ],
        },
      ]);
    } catch (error) {
      console.warn('[LocalNotifications] Category setup failed:', error);
    }
  }

  private _handleEvent(type: number, detail: any): void {
    // Notifee event types: 1=DISMISSED, 2=DELIVERED, 3=ACTION_PRESS, 4=PRESS (tap)
    // Map to our event types
    let eventType: NotificationEventType;

    switch (type) {
      case 4: // PRESS (tap on notification)
        eventType = 'press';
        break;
      case 3: // ACTION_PRESS (tap on action button)
        eventType = 'action';
        break;
      case 1: // DISMISSED
        eventType = 'dismissed';
        break;
      default:
        return; // Ignore DELIVERED and unknown types
    }

    const notification = detail?.notification;
    if (!notification) return;

    const event: NotificationEvent = {
      type: eventType,
      notificationId: notification.id || '',
      actionId: detail?.pressAction?.id,
      data: (notification.data as Record<string, string>) || {},
    };

    // Emit to specific type handlers
    const typeHandlers = this._eventHandlers.get(eventType) || [];
    typeHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.warn('[LocalNotifications] Event handler error:', error);
      }
    });

    // Emit to wildcard handlers
    const wildcardHandlers = this._eventHandlers.get('*') || [];
    wildcardHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.warn('[LocalNotifications] Wildcard handler error:', error);
      }
    });
  }
}

// ============================================================
// Singleton Export
// ============================================================

/** Singleton instance — import this in your modules */
export const localNotificationService = new LocalNotificationService();
