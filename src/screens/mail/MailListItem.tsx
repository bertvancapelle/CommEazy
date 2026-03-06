/**
 * MailListItem — Single mail message row in the inbox list
 *
 * Displays sender, subject, date, and status indicators
 * (unread, flagged, attachment). Senior-inclusive design with
 * large touch targets and clear typography.
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { Icon } from '@/components';
import type { CachedMailHeader } from '@/types/mail';
import { parseEmailAddress } from '@/types/mail';

// ============================================================
// Types
// ============================================================

export interface MailListItemProps {
  /** Cached mail header data */
  header: CachedMailHeader;
  /** Called when the item is pressed */
  onPress: (header: CachedMailHeader) => void;
  /** Called when flag is toggled */
  onToggleFlag?: (header: CachedMailHeader) => void;
}

// ============================================================
// Date Formatting
// ============================================================

function formatMailDate(isoDate: string, t: (key: string) => string): string {
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffDays = Math.floor((today.getTime() - messageDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Today — show time
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return t('modules.mail.inbox.yesterday');
    } else if (diffDays < 7) {
      // This week — show day name
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      // Older — show date
      return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    }
  } catch {
    return '';
  }
}

// ============================================================
// Component
// ============================================================

export function MailListItem({ header, onPress, onToggleFlag }: MailListItemProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const { triggerHaptic } = useFeedback();

  // Parse sender name
  const senderDisplay = header.fromName || (() => {
    const parsed = parseEmailAddress(header.from);
    return parsed.name || parsed.address || t('modules.mail.inbox.unknownSender');
  })();

  const dateDisplay = formatMailDate(header.date, t);

  const handlePress = useCallback(() => {
    triggerHaptic('tap');
    onPress(header);
  }, [header, onPress]);

  const handleFlagToggle = useCallback(() => {
    triggerHaptic('tap');
    onToggleFlag?.(header);
  }, [header, onToggleFlag]);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: header.isRead
            ? themeColors.background
            : themeColors.surface,
        },
      ]}
      onPress={handlePress}
      onLongPress={() => {}}
      delayLongPress={300}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${header.isRead ? '' : t('modules.mail.inbox.unread') + ', '}${senderDisplay}, ${header.subject || t('modules.mail.inbox.noSubject')}`}
      accessibilityHint={t('modules.mail.inbox.openMailHint')}
    >
      {/* Unread indicator */}
      <View style={styles.unreadDotContainer}>
        {!header.isRead && (
          <View style={[styles.unreadDot, { backgroundColor: accentColor.primary }]} />
        )}
      </View>

      {/* Main content */}
      <View style={styles.content}>
        {/* Top row: Sender + Date */}
        <View style={styles.topRow}>
          <Text
            style={[
              styles.sender,
              { color: themeColors.textPrimary },
              !header.isRead && styles.senderUnread,
            ]}
            numberOfLines={1}
          >
            {senderDisplay}
          </Text>
          <Text style={[styles.date, { color: themeColors.textSecondary }]}>
            {dateDisplay}
          </Text>
        </View>

        {/* Bottom row: Subject + indicators */}
        <View style={styles.bottomRow}>
          <Text
            style={[
              styles.subject,
              { color: themeColors.textSecondary },
              !header.isRead && styles.subjectUnread,
            ]}
            numberOfLines={1}
          >
            {header.subject || t('modules.mail.inbox.noSubject')}
          </Text>

          {/* Status indicators */}
          <View style={styles.indicators}>
            {header.hasAttachment && (
              <Icon name="attach" size={16} color={themeColors.textSecondary} />
            )}
            {header.isFlagged && (
              <TouchableOpacity
                onPress={handleFlagToggle}
                onLongPress={() => {}}
                delayLongPress={300}
                hitSlop={{ top: 18, bottom: 18, left: 18, right: 18 }}
                accessibilityRole="button"
                accessibilityLabel={t('modules.mail.inbox.unflag')}
              >
                <Icon name="star" size={24} color={accentColor.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Chevron */}
      <Icon name="chevron-right" size={20} color={themeColors.textSecondary} />
    </TouchableOpacity>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.comfortable,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    paddingLeft: spacing.xs,
  },
  unreadDotContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  content: {
    flex: 1,
    marginRight: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sender: {
    ...typography.body,
    flex: 1,
    marginRight: spacing.sm,
  },
  senderUnread: {
    fontWeight: '700',
  },
  date: {
    ...typography.small,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subject: {
    ...typography.body,
    flex: 1,
    marginRight: spacing.sm,
  },
  subjectUnread: {
    fontWeight: '600',
    color: undefined, // Will be overridden by inline style
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
