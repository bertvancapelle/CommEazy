/**
 * ErrorView Component
 *
 * Senior-inclusive error display that ALWAYS shows:
 * - Icon (visual indicator, not just color)
 * - Human-friendly title
 * - Helpful explanation
 * - Recovery action button
 *
 * This enforces UI Principle #5: Error Display Pattern.
 *
 * NEVER use Alert.alert for errors - always use this component.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { Button } from './Button';

interface ErrorViewProps {
  /** Error title - defaults to generic error */
  title?: string;
  /** Helpful message explaining what to do */
  message?: string;
  /** Retry button handler - if not provided, no retry button shown */
  onRetry?: () => void;
  /** Custom retry button text */
  retryText?: string;
  /** Error type for styling */
  type?: 'error' | 'warning' | 'info';
  /** Whether to show fullscreen centered */
  fullscreen?: boolean;
}

export function ErrorView({
  title,
  message,
  onRetry,
  retryText,
  type = 'error',
  fullscreen = false,
}: ErrorViewProps) {
  const { t } = useTranslation();

  const icon = type === 'error' ? '⚠️' : type === 'warning' ? '⚡' : 'ℹ️';
  const displayTitle = title ?? t('errors.genericTitle');
  const displayMessage = message ?? t('errors.genericMessage');
  const displayRetry = retryText ?? t('common.tryAgain');

  const iconColor = type === 'error'
    ? colors.error
    : type === 'warning'
    ? colors.warning
    : colors.info;

  return (
    <View
      style={[styles.container, fullscreen && styles.fullscreen]}
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
