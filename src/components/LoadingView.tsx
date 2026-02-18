/**
 * LoadingView Component
 *
 * Senior-inclusive loading indicator that ALWAYS shows spinner + text.
 * This enforces UI Principle #6: Loading States.
 *
 * NEVER use ActivityIndicator alone - always use this component.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing } from '@/theme';
import { useAccentColor } from '@/hooks/useAccentColor';

interface LoadingViewProps {
  /** Loading message - defaults to translated "Loading..." */
  message?: string;
  /** Size of spinner */
  size?: 'small' | 'large';
  /** Whether to show fullscreen centered */
  fullscreen?: boolean;
}

export function LoadingView({
  message,
  size = 'large',
  fullscreen = false,
}: LoadingViewProps) {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  const displayMessage = message ?? t('common.loading');

  return (
    <View
      style={[styles.container, fullscreen && styles.fullscreen]}
      accessibilityRole="progressbar"
      accessibilityLabel={displayMessage}
      accessibilityState={{ busy: true }}
    >
      <ActivityIndicator
        size={size}
        color={accentColor.primary}
      />
      <Text style={styles.message}>{displayMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  fullscreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
