/**
 * DeviceChoiceScreen
 *
 * First screen after language selection. Allows user to choose between:
 * 1. New Account - Continue with phone verification (existing flow)
 * 2. Link Device - Scan QR from existing device (tablets without phone number)
 *
 * Senior-inclusive design: Large buttons, clear icons, simple choice.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing, touchTargets } from '@/theme';
import { ProgressIndicator } from '@/components';
import type { OnboardingStackParams } from '@/navigation';

type Props = NativeStackScreenProps<OnboardingStackParams, 'DeviceChoice'>;

export function DeviceChoiceScreen({ navigation }: Props) {
  const { t } = useTranslation();

  const handleNewAccount = () => {
    navigation.navigate('PhoneVerification');
  };

  const handleLinkDevice = () => {
    navigation.navigate('DeviceLinkScan');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ProgressIndicator currentStep={2} totalSteps={5} />

        <View style={styles.header}>
          <Text style={styles.title}>{t('deviceLink.choiceTitle')}</Text>
          <Text style={styles.subtitle}>{t('deviceLink.choiceSubtitle')}</Text>
        </View>

        <View style={styles.options}>
          {/* New Account Option */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={handleNewAccount}
            accessibilityRole="button"
            accessibilityLabel={t('deviceLink.newAccount')}
            accessibilityHint={t('deviceLink.newAccountHint')}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>📱</Text>
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>{t('deviceLink.newAccount')}</Text>
              <Text style={styles.optionDescription}>
                {t('deviceLink.newAccountDescription')}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          {/* Link Device Option */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={handleLinkDevice}
            accessibilityRole="button"
            accessibilityLabel={t('deviceLink.linkDevice')}
            accessibilityHint={t('deviceLink.linkDeviceHint')}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🔗</Text>
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>{t('deviceLink.linkDevice')}</Text>
              <Text style={styles.optionDescription}>
                {t('deviceLink.linkDeviceDescription')}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('deviceLink.securityNote')}</Text>
        </View>
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
    paddingTop: spacing.md,
  },
  header: {
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  options: {
    gap: spacing.lg,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    minHeight: touchTargets.comfortable,
    ...Platform.select({
      ios: {
        shadowColor: colors.textPrimary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  icon: {
    fontSize: 28,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  optionDescription: {
    ...typography.body,
    color: colors.textSecondary,
  },
  chevron: {
    ...typography.h1,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
  },
  footer: {
    marginTop: 'auto',
    paddingVertical: spacing.xl,
  },
  footerText: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
