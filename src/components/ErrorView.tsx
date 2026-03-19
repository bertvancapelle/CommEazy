/**
 * ErrorView Component — Unified Notification Pattern
 *
 * Senior-inclusive display for ALL in-app notifications:
 * - Error (⚠️) — failures with optional retry
 * - Warning (⚡) — recoverable issues
 * - Info (ℹ️) — neutral information
 * - Success (✅) — confirmations of completed actions
 *
 * ALWAYS shows:
 * - Icon (visual indicator, not just color)
 * - Human-friendly title
 * - Helpful explanation
 * - Optional action button (retry, dismiss, etc.)
 *
 * This enforces UI Principle #5: Unified Notification Pattern.
 *
 * NEVER use Alert.alert for errors/success/info — always use this component.
 * Alert.alert is ONLY allowed for confirmation dialogs (2+ buttons).
 *
 * @see .claude/skills/ui-designer/SKILL.md Section 16
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { Button } from './Button';

interface ErrorViewProps {
  /** Notification title - defaults to generic error */
  title?: string;
  /** Helpful message explaining what happened or what to do */
  message?: string;
  /** Retry button handler - if not provided, no retry button shown */
  onRetry?: () => void;
  /** Custom retry button text */
  retryText?: string;
  /** Notification type for icon and styling */
  type?: 'error' | 'warning' | 'info' | 'success';
  /** Whether to show fullscreen centered */
  fullscreen?: boolean;
  /** Transparent background (use inside LiquidGlassView modals) */
  transparent?: boolean;
  /** Auto-dismiss after N milliseconds (recommended: 3000 for success/info) */
  autoDismiss?: number;
  /** Callback when notification is dismissed (auto or manual) */
  onDismiss?: () => void;
}

export function ErrorView({
  title,
  message,
  onRetry,
  retryText,
  type = 'error',
  fullscreen = false,
  transparent = false,
  autoDismiss,
  onDismiss,
}: ErrorViewProps) {
  const { t } = useTranslation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss timer
  useEffect(() => {
    if (autoDismiss && autoDismiss > 0 && onDismiss) {
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, autoDismiss);

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }
  }, [autoDismiss, onDismiss]);

  const icon = type === 'error'
    ? '⚠️'
    : type === 'warning'
    ? '⚡'
    : type === 'success'
    ? '✅'
    : 'ℹ️';

  const displayTitle = title ?? t('errors.genericTitle');
  const displayMessage = message ?? t('errors.genericMessage');
  const displayRetry = retryText ?? t('common.tryAgain');

  const iconColor = type === 'error'
    ? colors.error
    : type === 'warning'
    ? colors.warning
    : type === 'success'
    ? colors.success
    : colors.info;

  return (
    <View
      style={[styles.container, fullscreen && styles.fullscreen, transparent && { backgroundColor: 'transparent' }]}
      accessibilityRole="alert"
      accessibilityLabel={`${displayTitle}. ${displayMessage}`}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>

      <Text style={styles.title}>{displayTitle}</Text>
      <Text style={styles.message}>{displayMessage}</Text>

      {onRetry && (
        <View style={styles.buttonContainer}>
          <Button
            title={displayRetry}
            onPress={onRetry}
            variant="primary"
            accessibilityLabel={displayRetry}
            accessibilityHint={t('errors.retryHint')}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  fullscreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
  buttonContainer: {
    marginTop: spacing.lg,
    minWidth: 200,
  },
});
