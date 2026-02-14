/**
 * Completion Screen
 *
 * Celebrates successful onboarding.
 * Senior-inclusive: clear acknowledgment, no rush.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  AccessibilityInfo,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing } from '@/theme';
import { Button, ProgressIndicator } from '@/components';
import type { OnboardingStackParams } from '@/navigation';

type Props = NativeStackScreenProps<OnboardingStackParams, 'Completion'>;

export function CompletionScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { name } = route.params;

  useEffect(() => {
    // Announce completion to screen readers
    AccessibilityInfo.announceForAccessibility(t('onboarding.allSet'));
  }, [t]);

  const handleStart = () => {
    // Navigate to main app by resetting the root stack
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      })
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ProgressIndicator currentStep={6} totalSteps={6} />

      <View style={styles.content}>
        <View style={styles.celebration}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>{t('onboarding.allSet')}</Text>
          <Text style={styles.message}>
            {t('onboarding.welcomeUser', { name })}
          </Text>
          <Text style={styles.subtitle}>{t('onboarding.allSetMessage')}</Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipText}>{t('onboarding.firstTip')}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title={t('onboarding.startMessaging')}
          onPress={handleStart}
          accessibilityLabel={t('onboarding.startMessaging')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  celebration: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  emoji: {
    fontSize: 72,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    ...typography.h3,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  tipBox: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  tipText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
