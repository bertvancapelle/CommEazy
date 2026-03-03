/**
 * Mail Onboarding Step 1 — Provider Selection
 *
 * Displays all known mail providers as large touchable cards.
 * OAuth2 providers first (easiest for seniors), then password-based,
 * then custom provider last.
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 8
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { Icon } from '@/components';
import { ProgressIndicator } from '@/components';
import { getSelectableProviders, type MailProvider } from '@/services/mail/mailConstants';

// ============================================================
// Types
// ============================================================

export interface MailOnboardingStep1Props {
  /** Called when a provider is selected */
  onSelect: (provider: MailProvider) => void;
  /** Current step for ProgressIndicator */
  currentStep?: number;
  /** Total steps for ProgressIndicator */
  totalSteps?: number;
}

// ============================================================
// Haptic Helper
// ============================================================

const triggerHaptic = () => {
  const options = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };
  const hapticType = Platform.select({
    ios: 'impactMedium',
    android: 'effectClick',
    default: 'impactMedium',
  }) as string;
  ReactNativeHapticFeedback.trigger(hapticType, options);
};

// ============================================================
// Provider Icons (emoji fallback for familiar branding)
// ============================================================

const PROVIDER_EMOJI: Record<string, string> = {
  gmail: '📧',
  outlook: '📬',
  kpn: '📮',
  ziggo: '📪',
  xs4all: '📨',
  yahoo: '📧',
  icloud: '☁️',
  gmx: '📧',
  webde: '📧',
  protonmail: '🔒',
  custom: '⚙️',
};

// ============================================================
// Component
// ============================================================

export function MailOnboardingStep1({
  onSelect,
  currentStep = 1,
  totalSteps = 3,
}: MailOnboardingStep1Props) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const providers = getSelectableProviders();

  const handleProviderPress = (provider: MailProvider) => {
    triggerHaptic();
    onSelect(provider);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ProgressIndicator currentStep={currentStep} totalSteps={totalSteps} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text
            style={[styles.title, { color: themeColors.textPrimary }]}
            accessibilityRole="header"
          >
            {t('modules.mail.onboarding.chooseProvider')}
          </Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            {t('modules.mail.onboarding.chooseProviderHint')}
          </Text>
        </View>

        <View style={styles.providerList}>
          {providers.map((provider) => (
            <TouchableOpacity
              key={provider.id}
              style={[
                styles.providerCard,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border,
                },
              ]}
              onPress={() => handleProviderPress(provider)}
              onLongPress={() => {}}
              delayLongPress={300}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={provider.name}
              accessibilityHint={t('modules.mail.onboarding.selectProviderHint', {
                provider: provider.name,
              })}
            >
              <Text style={styles.providerEmoji}>
                {PROVIDER_EMOJI[provider.id] || '📧'}
              </Text>
              <View style={styles.providerInfo}>
                <Text
                  style={[styles.providerName, { color: themeColors.textPrimary }]}
                  numberOfLines={1}
                >
                  {provider.name}
                </Text>
                {provider.authType === 'oauth2' && (
                  <Text style={[styles.providerBadge, { color: accentColor.primary }]}>
                    {t('modules.mail.onboarding.easyLogin')}
                  </Text>
                )}
              </View>
              <Icon name="chevron-right" size={24} color={themeColors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
  },
  providerList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  providerEmoji: {
    fontSize: 28,
    width: 44,
    textAlign: 'center',
  },
  providerInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  providerName: {
    ...typography.body,
    fontWeight: '600',
  },
  providerBadge: {
    ...typography.small,
    fontWeight: '600',
    marginTop: 2,
  },
});
