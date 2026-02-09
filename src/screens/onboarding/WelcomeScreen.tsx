/**
 * Welcome Screen
 *
 * Shows app branding and privacy explanation.
 * Follows GDPR requirement: privacy info before data collection.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing } from '@/theme';
import { Button, ProgressIndicator } from '@/components';
import type { OnboardingStackParams } from '@/navigation';

type Props = NativeStackScreenProps<OnboardingStackParams, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();

  const handleContinue = () => {
    navigation.navigate('PhoneVerification');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ProgressIndicator currentStep={1} totalSteps={5} />

      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.logo}>💬</Text>
          <Text style={styles.title}>{t('onboarding.welcome')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>
        </View>

        <View style={styles.privacyBox}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={styles.privacyText}>{t('onboarding.privacyIntro')}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title={t('onboarding.continue')}
          onPress={handleContinue}
          accessibilityHint={t('accessibility.continueToPhoneVerification')}
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
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  privacyBox: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
  },
  privacyIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  privacyText: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 28,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
