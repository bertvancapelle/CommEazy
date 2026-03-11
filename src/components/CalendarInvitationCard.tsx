/**
 * CalendarInvitationCard — Displays a parsed ICS calendar invitation in mail
 *
 * Shows event details (title, date, time, location, organizer) with an
 * "Add to Agenda" button that pre-fills the AgendaItemFormScreen.
 *
 * Senior-inclusive: 60pt+ touch targets, 18pt+ text, clear visual hierarchy.
 *
 * @see services/mail/icsParser.ts for ICS parsing logic
 * @see screens/modules/AgendaItemFormScreen.tsx for form pre-fill
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { HapticTouchable } from '@/components/HapticTouchable';
import { Icon } from '@/components/Icon';
import { typography, spacing, borderRadius, touchTargets } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import type { ParsedCalendarEvent } from '@/services/mail/icsParser';

// ============================================================
// Types
// ============================================================

export interface CalendarInvitationCardProps {
  /** Parsed ICS event data */
  event: ParsedCalendarEvent;
  /** Callback to add event to agenda (navigates to form with pre-filled data) */
  onAddToAgenda: (event: ParsedCalendarEvent) => void;
}

// ============================================================
// Helpers
// ============================================================

function getLocaleString(lang: string): string {
  const map: Record<string, string> = {
    nl: 'nl-NL', de: 'de-DE', fr: 'fr-FR', es: 'es-ES',
    it: 'it-IT', no: 'nb-NO', sv: 'sv-SE', da: 'da-DK',
    'pt-BR': 'pt-BR', pt: 'pt-PT', pl: 'pl-PL',
    'en-GB': 'en-GB',
  };
  return map[lang] ?? 'en-US';
}

function formatEventDate(date: Date, isAllDay: boolean, locale: string): string {
  const dateStr = date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  if (isAllDay) return dateStr;
  const timeStr = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${dateStr}, ${timeStr}`;
}

function formatEndTime(date: Date, locale: string): string {
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// ============================================================
// Component
// ============================================================

export function CalendarInvitationCard({
  event,
  onAddToAgenda,
}: CalendarInvitationCardProps) {
  const { t, i18n } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor('agenda');
  const { accentColor } = useAccentColor();
  const locale = getLocaleString(i18n.language);
  const [isAdded, setIsAdded] = useState(false);

  const handleAdd = useCallback(() => {
    if (!isAdded) {
      onAddToAgenda(event);
      setIsAdded(true);
    }
  }, [onAddToAgenda, event, isAdded]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: themeColors.surface,
          borderColor: moduleColor,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={t('modules.mail.ics.cardAccessibility', { title: event.summary })}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: moduleColor }]}>
        <Text style={styles.headerIcon}>📅</Text>
        <Text style={styles.headerTitle}>
          {t('modules.mail.ics.calendarInvitation')}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Title */}
        <Text
          style={[styles.eventTitle, { color: themeColors.textPrimary }]}
          numberOfLines={3}
        >
          {event.summary}
        </Text>

        {/* Date & Time */}
        <View style={styles.detailRow}>
          <Icon name="calendar" size={20} color={moduleColor} />
          <Text style={[styles.detailText, { color: themeColors.textPrimary }]}>
            {formatEventDate(event.dtstart, event.isAllDay, locale)}
            {event.dtend && !event.isAllDay && (
              ` – ${formatEndTime(event.dtend, locale)}`
            )}
          </Text>
        </View>

        {/* All-day indicator */}
        {event.isAllDay && (
          <View style={styles.detailRow}>
            <Icon name="time" size={20} color={moduleColor} />
            <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
              {t('modules.mail.ics.allDay')}
            </Text>
          </View>
        )}

        {/* Location */}
        {event.location && (
          <View style={styles.detailRow}>
            <Icon name="location" size={20} color={moduleColor} />
            <Text
              style={[styles.detailText, { color: themeColors.textPrimary }]}
              numberOfLines={2}
            >
              {event.location}
            </Text>
          </View>
        )}

        {/* Organizer */}
        {event.organizer && (
          <View style={styles.detailRow}>
            <Icon name="person" size={20} color={moduleColor} />
            <Text
              style={[styles.detailText, { color: themeColors.textSecondary }]}
              numberOfLines={1}
            >
              {event.organizer}
            </Text>
          </View>
        )}

        {/* Description preview */}
        {event.description && (
          <View style={styles.detailRow}>
            <Icon name="note" size={20} color={moduleColor} />
            <Text
              style={[styles.detailText, { color: themeColors.textSecondary }]}
              numberOfLines={3}
            >
              {event.description}
            </Text>
          </View>
        )}

        {/* Recurring indicator */}
        {event.rruleFreq && (
          <View style={styles.detailRow}>
            <Icon name="refresh" size={20} color={moduleColor} />
            <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
              {t(`modules.mail.ics.recurring.${event.rruleFreq.toLowerCase()}`, event.rruleFreq)}
            </Text>
          </View>
        )}
      </View>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        <HapticTouchable
          style={[
            styles.addButton,
            {
              backgroundColor: isAdded ? themeColors.success : accentColor.primary,
            },
          ]}
          onPress={handleAdd}
          hapticDisabled={isAdded}
          accessibilityRole="button"
          accessibilityLabel={
            isAdded
              ? t('modules.mail.ics.addedToAgenda')
              : t('modules.mail.ics.addToAgenda')
          }
          accessibilityState={{ disabled: isAdded }}
        >
          <Icon
            name={isAdded ? 'check' : 'calendar'}
            size={20}
            color="white"
          />
          <Text style={styles.addButtonText}>
            {isAdded
              ? t('modules.mail.ics.addedToAgenda')
              : t('modules.mail.ics.addToAgenda')}
          </Text>
        </HapticTouchable>
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    borderWidth: 2,
    overflow: 'hidden',
    marginVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  headerIcon: {
    fontSize: 20,
  },
  headerTitle: {
    ...typography.body,
    fontWeight: '700',
    color: 'white',
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  eventTitle: {
    ...typography.h3,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  detailText: {
    ...typography.body,
    flex: 1,
  },
  actionContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  addButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: 'white',
  },
});
