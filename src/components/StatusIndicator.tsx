/**
 * StatusIndicator Component
 *
 * Senior-inclusive status display that ALWAYS shows:
 * - Color (visual cue)
 * - Icon (for color blindness support)
 * - Text label (for clarity)
 *
 * This enforces UI Principle #3: Contrast & Kleur.
 *
 * NEVER use color alone as indicator - always use this component.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, borderRadius } from '@/theme';

export type StatusType =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'online'
  | 'offline'
  | 'away';

interface StatusIndicatorProps {
  /** Status type */
  status: StatusType;
  /** Optional custom label - defaults to translated status */
  label?: string;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Show only icon + dot (compact mode) */
  compact?: boolean;
}

const STATUS_CONFIG: Record<StatusType, { icon: string; color: string; labelKey: string }> = {
  success: { icon: '✓', color: colors.success, labelKey: 'status.success' },
  error: { icon: '✗', color: colors.error, labelKey: 'status.error' },
  warning: { icon: '⚠', color: colors.warning, labelKey: 'status.warning' },
  info: { icon: 'ℹ', color: colors.info, labelKey: 'status.info' },
  pending: { icon: '○', color: colors.statusPending, labelKey: 'status.pending' },
  sent: { icon: '✓', color: colors.statusSent, labelKey: 'status.sent' },
  delivered: { icon: '✓✓', color: colors.statusDelivered, labelKey: 'status.delivered' },
  read: { icon: '✓✓', color: colors.primary, labelKey: 'status.read' },
  online: { icon: '●', color: colors.presenceAvailable, labelKey: 'status.online' },
  offline: { icon: '○', color: colors.presenceOffline, labelKey: 'status.offline' },
  away: { icon: '◐', color: colors.presenceAway, labelKey: 'status.away' },
};

export function StatusIndicator({
  status,
  label,
  size = 'medium',
  compact = false,
}: StatusIndicatorProps) {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status];
  const displayLabel = label ?? t(config.labelKey);

  const iconSize = size === 'small' ? 12 : size === 'large' ? 20 : 16;
  const textStyle = size === 'small' ? typography.small : size === 'large' ? typography.body : typography.label;

  return (
    <View
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel={displayLabel}
    >
      {/* Color dot - visual cue */}
      <View
        style={[
          styles.dot,
          {
            backgroundColor: config.color,
            width: iconSize,
            height: iconSize,
          },
        ]}
      />

      {/* Icon - for color blindness */}
      <Text
        style={[
          styles.icon,
          { color: config.color, fontSize: iconSize },
        ]}
      >
        {config.icon}
      </Text>

      {/* Text label - for clarity */}
      {!compact && (
        <Text style={[styles.label, textStyle, { color: config.color }]}>
          {displayLabel}
        </Text>
      )}
    </View>
  );
}

/**
 * MessageStatus - specialized for chat message status
 * Shows just the checkmarks with accessible label
 */
interface MessageStatusProps {
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export function MessageStatus({ status }: MessageStatusProps) {
  const { t } = useTranslation();

  const config: Record<string, { icon: string; color: string; label: string }> = {
    pending: { icon: '○', color: colors.statusPending, label: t('status.pending') },
    sent: { icon: '✓', color: colors.statusSent, label: t('status.sent') },
    delivered: { icon: '✓✓', color: colors.statusDelivered, label: t('status.delivered') },
    read: { icon: '✓✓', color: colors.primary, label: t('status.read') },
    failed: { icon: '!', color: colors.error, label: t('status.failed') },
  };

  const { icon, color, label } = config[status];

  return (
    <Text
      style={[styles.messageStatus, { color }]}
      accessibilityLabel={label}
    >
      {icon}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    borderRadius: borderRadius.full,
  },
  icon: {
    fontWeight: '600',
  },
  label: {
    fontWeight: '500',
  },
  messageStatus: {
    ...typography.small,
    fontWeight: '600',
  },
});
