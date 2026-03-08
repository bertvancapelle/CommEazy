/**
 * AgendaItemBubble — Shared agenda item display in chat
 *
 * Renders a structured agenda item card inside a chat bubble.
 * Shows: icon, title, date, time, category, repeat info.
 * Includes "Add to my agenda" button for the recipient.
 *
 * @see contexts/AgendaContext.tsx for createItem (add to agenda)
 * @see services/chat.ts for incoming message handling
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { HapticTouchable } from '@/components/HapticTouchable';
import { Icon } from '@/components/Icon';
import { typography, spacing, borderRadius, touchTargets, colors } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';

// ============================================================
// Types
// ============================================================

/** Structured agenda item payload received via XMPP */
export interface AgendaItemPayload {
  type: 'agenda_item';
  category: string;
  icon: string;
  title: string;
  date: string;       // "YYYY-MM-DD"
  time: string | null; // "HH:MM" or null
  times?: string[];    // Multiple times (medication)
  repeat: string | null;
  endDate: string | null;
  reminderOffset: string;
  isMedication: boolean;
}

export interface AgendaItemBubbleProps {
  /** The parsed agenda item data */
  payload: AgendaItemPayload;
  /** Whether this is the sender's own message */
  isOwn: boolean;
  /** Message timestamp */
  timestamp: number;
  /** Callback to add item to own agenda */
  onAddToAgenda?: (payload: AgendaItemPayload) => void;
}

// ============================================================
// Helpers
// ============================================================

function formatDateDisplay(dateStr: string, locale: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}

function getLocaleString(lang: string): string {
  const map: Record<string, string> = {
    nl: 'nl-NL', de: 'de-DE', fr: 'fr-FR', es: 'es-ES',
    it: 'it-IT', no: 'nb-NO', sv: 'sv-SE', da: 'da-DK',
    'pt-BR': 'pt-BR', pt: 'pt-PT', pl: 'pl-PL',
    'en-GB': 'en-GB',
  };
  return map[lang] ?? 'en-US';
}

// ============================================================
// Component
// ============================================================

export function AgendaItemBubble({
  payload,
  isOwn,
  timestamp,
  onAddToAgenda,
}: AgendaItemBubbleProps) {
  const { t, i18n } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor('agenda');
  const locale = getLocaleString(i18n.language);
  const [isAdded, setIsAdded] = useState(false);

  const handleAdd = useCallback(() => {
    if (onAddToAgenda && !isAdded) {
      onAddToAgenda(payload);
      setIsAdded(true);
    }
  }, [onAddToAgenda, payload, isAdded]);

  const timeText = payload.times && payload.times.length > 1
    ? payload.times.join(', ')
    : payload.time ?? t('modules.agenda.detail.allDay');

  const repeatKey = payload.repeat
    ? `modules.agenda.repeat.${payload.repeat}`
    : null;

  const timeDisplay = new Date(timestamp).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View
      style={[
        styles.container,
        isOwn ? styles.ownContainer : styles.otherContainer,
      ]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: isOwn ? themeColors.primary : themeColors.surface,
            borderColor: moduleColor,
          },
        ]}
        accessibilityRole="summary"
        accessibilityLabel={`${t('modules.agenda.chat.agendaItem')}: ${payload.title}, ${formatDateDisplay(payload.date, locale)}`}
      >
        {/* Header strip */}
        <View style={[styles.headerStrip, { backgroundColor: moduleColor }]}>
          <Text style={styles.headerIcon}>{payload.icon}</Text>
          <Text style={styles.headerLabel} numberOfLines={1}>
            {t('modules.agenda.chat.agendaItem')}
          </Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text
            style={[
              styles.title,
              { color: isOwn ? colors.textOnPrimary : themeColors.textPrimary },
            ]}
            numberOfLines={2}
          >
            {payload.title}
          </Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailEmoji}>📅</Text>
            <Text
              style={[
                styles.detailText,
                { color: isOwn ? colors.textOnPrimary : themeColors.textSecondary },
              ]}
            >
              {formatDateDisplay(payload.date, locale)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailEmoji}>🕐</Text>
            <Text
              style={[
                styles.detailText,
                { color: isOwn ? colors.textOnPrimary : themeColors.textSecondary },
              ]}
            >
              {timeText}
            </Text>
          </View>

          {repeatKey && (
            <View style={styles.detailRow}>
              <Text style={styles.detailEmoji}>🔁</Text>
              <Text
                style={[
                  styles.detailText,
                  { color: isOwn ? colors.textOnPrimary : themeColors.textSecondary },
                ]}
              >
                {t(repeatKey)}
              </Text>
            </View>
          )}

          {payload.isMedication && (
            <View style={styles.detailRow}>
              <Text style={styles.detailEmoji}>💊</Text>
              <Text
                style={[
                  styles.detailText,
                  { color: isOwn ? colors.textOnPrimary : themeColors.textSecondary },
                ]}
              >
                {t('modules.agenda.categories.medication')}
              </Text>
            </View>
          )}
        </View>

        {/* Add to agenda button (only for receiver) */}
        {!isOwn && onAddToAgenda && (
          <HapticTouchable
            style={[
              styles.addButton,
              {
                backgroundColor: isAdded
                  ? (themeColors.success ?? '#4CAF50')
                  : moduleColor,
              },
            ]}
            onPress={handleAdd}
            hapticDisabled={isAdded}
            accessibilityRole="button"
            accessibilityLabel={
              isAdded
                ? t('modules.agenda.chat.addedToAgenda')
                : t('modules.agenda.chat.addToAgenda')
            }
          >
            <Icon
              name={isAdded ? 'check' : 'plus'}
              size={18}
              color={colors.textOnPrimary}
            />
            <Text style={styles.addButtonText}>
              {isAdded
                ? t('modules.agenda.chat.addedToAgenda')
                : t('modules.agenda.chat.addToAgenda')}
            </Text>
          </HapticTouchable>
        )}

        {/* Timestamp */}
        <Text
          style={[
            styles.timestamp,
            { color: isOwn ? 'rgba(255,255,255,0.7)' : themeColors.textTertiary },
          ]}
        >
          {timeDisplay}
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  ownContainer: {
    alignItems: 'flex-end',
  },
  otherContainer: {
    alignItems: 'flex-start',
  },

  card: {
    maxWidth: '85%',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    overflow: 'hidden',
  },

  headerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  headerIcon: {
    fontSize: 16,
  },
  headerLabel: {
    ...typography.label,
    color: colors.textOnPrimary,
    fontWeight: '700',
    flex: 1,
  },

  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailEmoji: {
    fontSize: 14,
    width: 20,
    textAlign: 'center',
  },
  detailText: {
    ...typography.label,
    flex: 1,
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  addButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },

  timestamp: {
    ...typography.label,
    fontSize: 12,
    textAlign: 'right',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
});
