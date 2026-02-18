/**
 * CommEazy Progress Indicator
 *
 * Shows "Stap X van Y" / "Step X of Y" progress for onboarding.
 * Senior-friendly: clear visual progress, accessible.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing } from '@/theme';
import { useAccentColor } from '@/hooks/useAccentColor';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressIndicator({ currentStep, totalSteps }: ProgressIndicatorProps) {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();

  return (
    <View style={styles.container}>
      <View style={styles.dotsContainer}>
        {Array.from({ length: totalSteps }, (_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index < currentStep ? { backgroundColor: accentColor.primary } : styles.dotPending,
              index === currentStep - 1 && { backgroundColor: accentColor.primary, width: 24 },
            ]}
            accessibilityElementsHidden
          />
        ))}
      </View>
      <Text
        style={styles.text}
        accessibilityLabel={t('onboarding.stepProgress', { current: currentStep, total: totalSteps })}
      >
        {t('onboarding.stepOf', { current: currentStep, total: totalSteps })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotPending: {
    backgroundColor: colors.divider,
  },
  text: {
    ...typography.small,
    color: colors.textTertiary,
  },
});
