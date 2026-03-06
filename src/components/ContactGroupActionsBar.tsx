/**
 * ContactGroupActionsBar — Bulk action buttons for contact groups
 *
 * Displays 4 action buttons when a group or smart section is selected:
 * 1. Foto sturen — opens PhotoRecipientModal with group members pre-selected
 * 2. Groepsbericht — navigates to group chat
 * 3. Groepsmail — navigates to mail compose
 * 4. Bel iemand — shows contact picker for 1-on-1 call
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - Large icons with text labels
 * - Haptic feedback on every action
 * - Clear visual grouping
 *
 * @see .claude/plans/CONTACT_GROUPS.md (Fase 3)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { HapticTouchable } from './HapticTouchable';
import { Icon } from './Icon';

// ============================================================
// Types
// ============================================================

export interface ContactGroupActionsBarProps {
  /** Number of contacts in the selected group/section */
  memberCount: number;
  /** Group/section display label (for accessibility) */
  groupLabel: string;
  /** Callback: send photo to group members */
  onSendPhoto: () => void;
  /** Callback: send group message */
  onSendMessage: () => void;
  /** Callback: send group mail */
  onSendMail: () => void;
  /** Callback: call a group member (shows picker) */
  onCallMember: () => void;
  /** Module accent color */
  accentColor?: string;
}

// ============================================================
// Component
// ============================================================

export function ContactGroupActionsBar({
  memberCount,
  groupLabel,
  onSendPhoto,
  onSendMessage,
  onSendMail,
  onCallMember,
  accentColor,
}: ContactGroupActionsBarProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const resolvedAccent = accentColor || themeColors.primary;

  const actions = [
    {
      key: 'photo',
      icon: 'camera' as const,
      label: t('contacts.groups.groupActions.sendPhoto', 'Foto'),
      onPress: onSendPhoto,
    },
    {
      key: 'message',
      icon: 'chatbubble' as const,
      label: t('contacts.groups.groupActions.sendMessage', 'Bericht'),
      onPress: onSendMessage,
    },
    {
      key: 'mail',
      icon: 'mail' as const,
      label: t('contacts.groups.groupActions.sendMail', 'Mail'),
      onPress: onSendMail,
    },
    {
      key: 'call',
      icon: 'call' as const,
      label: t('contacts.groups.groupActions.callMember', 'Bellen'),
      onPress: onCallMember,
    },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeColors.surface,
          borderTopColor: themeColors.divider,
        },
      ]}
      accessibilityRole="toolbar"
      accessibilityLabel={t(
        'contacts.groups.groupActionsToolbar',
        'Groepsacties voor {{group}}, {{count}} leden',
        { group: groupLabel, count: memberCount },
      )}
    >
      {/* Member count indicator */}
      <Text
        style={[styles.memberCount, { color: themeColors.textSecondary }]}
        accessibilityRole="text"
      >
        {t('contacts.groups.memberCount', '{{count}} leden', { count: memberCount })}
      </Text>

      {/* Action buttons row */}
      <View style={styles.actionsRow}>
        {actions.map((action) => (
          <HapticTouchable
            key={action.key}
            style={[
              styles.actionButton,
              { backgroundColor: `${resolvedAccent}15` },
            ]}
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${action.label} — ${groupLabel}`}
          >
            <Icon name={action.icon} size={24} color={resolvedAccent} />
            <Text
              style={[styles.actionLabel, { color: themeColors.textPrimary }]}
              numberOfLines={1}
            >
              {action.label}
            </Text>
          </HapticTouchable>
        ))}
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  memberCount: {
    ...typography.label,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  actionLabel: {
    ...typography.label,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ContactGroupActionsBar;
