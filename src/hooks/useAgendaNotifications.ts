/**
 * useAgendaNotifications — Agenda-specifieke notificatie scheduling
 *
 * Scheduling engine die agenda items omzet naar lokale notificaties:
 * - Bij mount: schedult notificaties voor komende 30 dagen
 * - Bij item create/update/delete: herplant notificaties
 * - Medicijnen: actionable notifications (Ingenomen / Later herinneren)
 * - "Later herinneren": max 3x, +15 minuten per keer
 * - Rolling 30-dagen window (iOS limiet: 64 pending notifications)
 *
 * Gebruikt de generieke LocalNotificationService voor het daadwerkelijke
 * schedulen — deze hook bevat alleen de agenda-specifieke logica.
 *
 * @see services/localNotifications.ts voor de generieke service
 * @see contexts/AgendaContext.tsx voor data access
 */

import { useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  localNotificationService,
  NOTIFICATION_CATEGORIES,
  type NotificationEvent,
} from '@/services/localNotifications';
import { useAgendaContext } from '@/contexts/AgendaContext';
import type { TimelineItem } from '@/contexts/AgendaContext';
import {
  reminderOffsetToMs,
  getCategoryIcon,
  type ReminderOffset,
} from '@/constants/agendaCategories';

// ============================================================
// Constants
// ============================================================

/** Maximum lookahead for scheduling (30 days) */
const SCHEDULE_WINDOW_DAYS = 30;

/** Maximum snooze attempts for medication */
const MAX_SNOOZE_COUNT = 3;

/** Snooze interval in milliseconds (15 minutes) */
const SNOOZE_INTERVAL_MS = 15 * 60 * 1000;

/** Notification ID prefix for agenda items */
const AGENDA_PREFIX = 'agenda-';

/** Notification ID prefix for contact dates */
const CONTACT_PREFIX = 'contact-';

// Snooze counts are tracked in-memory only (reset daily at midnight)

// ============================================================
// Helper Functions
// ============================================================

/**
 * Generate a unique notification ID for an agenda occurrence.
 *
 * Format: agenda-{itemId}-{dateKey}-{time}
 * Examples:
 *   'agenda-abc123-2026-03-08-11:00'
 *   'agenda-abc123-2026-03-08-09:00' (medication first dose)
 *   'agenda-abc123-2026-03-08-21:00' (medication second dose)
 *   'contact-john-birthday-2026-03-15'
 */
function makeNotificationId(
  source: 'manual' | 'contact',
  itemId: string,
  dateKey: string,
  time?: string,
): string {
  const prefix = source === 'manual' ? AGENDA_PREFIX : CONTACT_PREFIX;
  const timeSuffix = time ? `-${time}` : '';
  return `${prefix}${itemId}-${dateKey}${timeSuffix}`;
}

/** Parse a date + time string into a timestamp */
function parseDateTime(dateTimestamp: number, time: string | null): number {
  if (!time) return dateTimestamp;

  const d = new Date(dateTimestamp);
  const [hours, minutes] = time.split(':').map(Number);
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

/** Format a date key from timestamp */
function toDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ============================================================
// Hook
// ============================================================

export interface UseAgendaNotificationsReturn {
  /** Manually trigger a full reschedule */
  rescheduleAll: () => Promise<void>;
  /** Schedule notifications for a single new/updated item */
  scheduleForItem: (item: TimelineItem) => Promise<void>;
  /** Cancel all notifications for an item */
  cancelForItem: (itemId: string, source: 'manual' | 'contact') => Promise<void>;
  /** Handle medication snooze (called from notification action) */
  handleMedicationSnooze: (
    itemId: string,
    date: string,
    time: string,
  ) => Promise<void>;
}

export function useAgendaNotifications(): UseAgendaNotificationsReturn {
  const { t } = useTranslation();
  const { timelineDays } = useAgendaContext();
  const isSchedulingRef = useRef(false);
  const lastScheduleRef = useRef<number>(0);
  const snoozeCounts = useRef<Map<string, number>>(new Map());

  // ============================================================
  // Schedule for a single timeline item
  // ============================================================

  const scheduleForItem = useCallback(
    async (item: TimelineItem): Promise<void> => {
      const now = Date.now();
      const endWindow = now + SCHEDULE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

      // Skip hidden items
      if (item.isHidden) return;

      // Determine the times to schedule notifications for
      const times: string[] =
        item.isMedication && item.times.length > 0
          ? item.times
          : item.time
            ? [item.time]
            : [];

      // For all-day items (no time), schedule at 08:00
      if (times.length === 0) {
        const triggerTs = parseDateTime(item.date, '08:00');
        const offsetMs = reminderOffsetToMs(item.reminderOffset);
        const notifyAt = triggerTs - offsetMs;

        if (notifyAt > now && notifyAt <= endWindow) {
          const dateKey = toDateKey(item.date);
          const notifId = makeNotificationId(item.source, item.id, dateKey);
          const icon = getCategoryIcon(item.category);

          await localNotificationService.schedule({
            id: notifId,
            channelId: 'agenda',
            title: `📅 ${t('modules.agenda.title')}`,
            body: `${icon} ${item.title}`,
            triggerTimestamp: notifyAt,
            data: {
              type: 'agenda',
              itemId: item.modelId || item.id,
              source: item.source,
              category: item.category,
            },
            categoryId: NOTIFICATION_CATEGORIES.AGENDA_REMINDER,
          });
        }
        return;
      }

      // For items with specific times
      for (const time of times) {
        const triggerTs = parseDateTime(item.date, time);
        const offsetMs = reminderOffsetToMs(item.reminderOffset);
        const notifyAt = triggerTs - offsetMs;

        if (notifyAt <= now || notifyAt > endWindow) continue;

        const dateKey = toDateKey(item.date);
        const notifId = makeNotificationId(item.source, item.id, dateKey, time);
        const icon = getCategoryIcon(item.category);

        // Medication: add action buttons
        if (item.isMedication) {
          const bodyText = `${icon} ${item.title}\n${t('notifications.agenda.medicationTime')} — ${time}`;

          await localNotificationService.schedule({
            id: notifId,
            channelId: 'medication',
            title: `📅 ${t('modules.agenda.title')}`,
            body: bodyText,
            triggerTimestamp: notifyAt,
            data: {
              type: 'agenda-medication',
              itemId: item.modelId || item.id,
              source: item.source,
              category: item.category,
              date: dateKey,
              time: time,
            },
            categoryId: NOTIFICATION_CATEGORIES.MEDICATION_REMINDER,
            actions: [
              {
                id: 'medication-taken',
                title: `✅ ${t('notifications.agenda.medicationTaken')}`,
                autoDismiss: true,
              },
              {
                id: 'medication-snooze',
                title: `⏰ ${t('notifications.agenda.medicationSnooze')}`,
                autoDismiss: true,
              },
            ],
          });
        } else {
          // Regular agenda item
          const reminderLabel = getReminderLabel(item.reminderOffset, t);
          const bodyText = `${icon} ${item.title}\n${reminderLabel} — ${time}`;

          await localNotificationService.schedule({
            id: notifId,
            channelId: 'agenda',
            title: `📅 ${t('modules.agenda.title')}`,
            body: bodyText,
            triggerTimestamp: notifyAt,
            data: {
              type: 'agenda',
              itemId: item.modelId || item.id,
              source: item.source,
              category: item.category,
            },
            categoryId: NOTIFICATION_CATEGORIES.AGENDA_REMINDER,
          });
        }
      }
    },
    [t],
  );

  // ============================================================
  // Cancel notifications for an item
  // ============================================================

  const cancelForItem = useCallback(
    async (itemId: string, source: 'manual' | 'contact'): Promise<void> => {
      const prefix = source === 'manual' ? AGENDA_PREFIX : CONTACT_PREFIX;
      await localNotificationService.cancelByPrefix(`${prefix}${itemId}`);
    },
    [],
  );

  // ============================================================
  // Full reschedule (all items for next 30 days)
  // ============================================================

  const rescheduleAll = useCallback(async (): Promise<void> => {
    // Prevent concurrent scheduling
    if (isSchedulingRef.current) return;
    isSchedulingRef.current = true;

    try {
      // Cancel all existing agenda notifications
      const scheduledIds = await localNotificationService.getScheduledIds();
      const agendaIds = scheduledIds.filter(
        id => id.startsWith(AGENDA_PREFIX) || id.startsWith(CONTACT_PREFIX),
      );
      await Promise.all(
        agendaIds.map(id => localNotificationService.cancel(id)),
      );

      // Flatten all timeline items from all days
      const allItems: TimelineItem[] = [];
      for (const day of timelineDays) {
        for (const item of day.items) {
          allItems.push(item);
        }
      }

      // Schedule notifications for each item
      let scheduledCount = 0;
      for (const item of allItems) {
        await scheduleForItem(item);
        scheduledCount++;
      }

      const totalScheduled = await localNotificationService.getScheduledCount();
      console.info(
        '[AgendaNotifications] Rescheduled:',
        scheduledCount,
        'items,',
        totalScheduled,
        'notifications pending',
      );

      lastScheduleRef.current = Date.now();
    } catch (error) {
      console.warn(
        '[AgendaNotifications] Reschedule failed:',
        error instanceof Error ? error.message : error,
      );
    } finally {
      isSchedulingRef.current = false;
    }
  }, [timelineDays, scheduleForItem]);

  // ============================================================
  // Medication snooze handler
  // ============================================================

  const handleMedicationSnooze = useCallback(
    async (itemId: string, date: string, time: string): Promise<void> => {
      const snoozeKey = `${itemId}-${date}-${time}`;
      const currentCount = snoozeCounts.current.get(snoozeKey) || 0;

      if (currentCount >= MAX_SNOOZE_COUNT) {
        console.info(
          '[AgendaNotifications] Max snooze reached for:',
          snoozeKey,
        );
        return;
      }

      // Schedule snooze notification (+15 minutes from now)
      const snoozeAt = Date.now() + SNOOZE_INTERVAL_MS;
      const snoozeNotifId = `${AGENDA_PREFIX}${itemId}-${date}-${time}-snooze-${currentCount + 1}`;

      await localNotificationService.schedule({
        id: snoozeNotifId,
        channelId: 'medication',
        title: `📅 ${t('modules.agenda.title')}`,
        body: `💊 ${t('notifications.agenda.medicationSnoozeReminder')}\n${t('notifications.agenda.snoozeAttempt', { current: currentCount + 1, max: MAX_SNOOZE_COUNT })}`,
        triggerTimestamp: snoozeAt,
        data: {
          type: 'agenda-medication',
          itemId,
          source: 'manual',
          category: 'medication',
          date,
          time,
          snoozeCount: String(currentCount + 1),
        },
        categoryId: NOTIFICATION_CATEGORIES.MEDICATION_REMINDER,
        actions: [
          {
            id: 'medication-taken',
            title: `✅ ${t('notifications.agenda.medicationTaken')}`,
            autoDismiss: true,
          },
          ...(currentCount + 1 < MAX_SNOOZE_COUNT
            ? [
                {
                  id: 'medication-snooze',
                  title: `⏰ ${t('notifications.agenda.medicationSnooze')}`,
                  autoDismiss: true,
                },
              ]
            : []),
        ],
      });

      snoozeCounts.current.set(snoozeKey, currentCount + 1);

      console.info(
        '[AgendaNotifications] Snoozed medication:',
        snoozeKey,
        `(${currentCount + 1}/${MAX_SNOOZE_COUNT})`,
      );
    },
    [t],
  );

  // ============================================================
  // Event handling (notification taps and action buttons)
  // ============================================================

  useEffect(() => {
    const unsubscribe = localNotificationService.onEvent('action', (event: NotificationEvent) => {
      const { actionId, data } = event;

      // Only handle agenda-related actions
      if (data.type !== 'agenda-medication' && data.type !== 'agenda') return;

      if (actionId === 'medication-snooze' && data.itemId && data.date && data.time) {
        handleMedicationSnooze(data.itemId, data.date, data.time);
      }

      // 'medication-taken' is handled by the AgendaContext listener
      // (logMedication is called from the screen that opens on tap)
    });

    return unsubscribe;
  }, [handleMedicationSnooze]);

  // ============================================================
  // Auto-reschedule on app foreground + timeline changes
  // ============================================================

  useEffect(() => {
    // Reschedule when timeline data changes
    // Debounce: skip if last schedule was <5 seconds ago
    const timeSinceLastSchedule = Date.now() - lastScheduleRef.current;
    if (timeSinceLastSchedule > 5000 && timelineDays.length > 0) {
      rescheduleAll();
    }
  }, [timelineDays, rescheduleAll]);

  useEffect(() => {
    // Reschedule when app comes to foreground
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const timeSinceLastSchedule = Date.now() - lastScheduleRef.current;
        // Only reschedule if >1 hour since last schedule
        if (timeSinceLastSchedule > 60 * 60 * 1000) {
          rescheduleAll();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [rescheduleAll]);

  // Reset daily snooze counts at midnight
  useEffect(() => {
    const checkMidnight = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        snoozeCounts.current.clear();
        console.debug('[AgendaNotifications] Daily snooze counts reset');
      }
    }, 60 * 1000); // Check every minute

    return () => clearInterval(checkMidnight);
  }, []);

  return {
    rescheduleAll,
    scheduleForItem,
    cancelForItem,
    handleMedicationSnooze,
  };
}

// ============================================================
// Helpers
// ============================================================

/** Get human-readable reminder label */
function getReminderLabel(offset: ReminderOffset, t: (key: string) => string): string {
  switch (offset) {
    case 'at_time':
      return t('notifications.agenda.atTime');
    case '15_min_before':
      return t('notifications.agenda.15minBefore');
    case '30_min_before':
      return t('notifications.agenda.30minBefore');
    case '1_hour_before':
      return t('notifications.agenda.1hourBefore');
    case '1_day_before':
      return t('notifications.agenda.1dayBefore');
  }
}
