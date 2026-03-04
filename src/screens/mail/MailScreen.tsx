/**
 * MailScreen — Main entry point for the E-mail module
 *
 * Placeholder screen that will show:
 * - Onboarding wizard (first-time setup)
 * - Inbox/folder list (after setup)
 *
 * OAuth2 and full mail functionality will be added in later phases.
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { ModuleHeader, Icon } from '@/components';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { MailWelcomeModal } from './MailWelcomeModal';
import { MailOnboardingScreen } from './MailOnboardingScreen';

// AsyncStorage key for tracking onboarding completion
const MAIL_ONBOARDING_COMPLETE_KEY = 'mail_onboarding_complete';
const MAIL_WELCOME_SHOWN_KEY = 'mail_welcome_shown';

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

export function MailScreen() {
  const { t } = useTranslation();
  const moduleColor = useModuleColor('mail');
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check onboarding state on mount
  useEffect(() => {
    const checkState = async () => {
      try {
        const [welcomeShown, onboardingDone] = await Promise.all([
          AsyncStorage.getItem(MAIL_WELCOME_SHOWN_KEY),
          AsyncStorage.getItem(MAIL_ONBOARDING_COMPLETE_KEY),
        ]);

        if (onboardingDone === 'true') {
          setOnboardingComplete(true);
        } else if (welcomeShown !== 'true') {
          setShowWelcome(true);
        } else {
          setShowOnboarding(true);
        }
      } catch (error) {
        console.error('[MailScreen] Failed to check onboarding state:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkState();
  }, []);

  // Handle welcome modal dismiss
  const handleWelcomeDismiss = useCallback(() => {
    setShowWelcome(false);
    setShowOnboarding(true);
    AsyncStorage.setItem(MAIL_WELCOME_SHOWN_KEY, 'true').catch(console.error);
  }, []);

  // Handle onboarding complete
  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    setOnboardingComplete(true);
    AsyncStorage.setItem(MAIL_ONBOARDING_COMPLETE_KEY, 'true').catch(console.error);
  }, []);

  // Handle onboarding close/skip — user wants to exit wizard
  const handleOnboardingClose = useCallback(() => {
    setShowOnboarding(false);
    // Don't mark as complete — user can re-enter later
    // Reset welcome shown so next visit shows welcome modal again
    AsyncStorage.removeItem(MAIL_WELCOME_SHOWN_KEY).catch(console.error);
  }, []);

  // Handle add another account — restart wizard
  const handleAddAnother = useCallback(() => {
    // Just keep showing onboarding (wizard resets itself internally)
  }, []);

  // Handle start setup — user wants to (re)start onboarding from placeholder
  const handleStartSetup = useCallback(() => {
    triggerHaptic();
    setShowOnboarding(true);
    AsyncStorage.setItem(MAIL_WELCOME_SHOWN_KEY, 'true').catch(console.error);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ModuleHeader
          moduleId="mail"
          icon="mail"
          title={t('navigation.mail')}
        />
      </View>
    );
  }

  // Show onboarding flow if not yet completed
  if (showOnboarding) {
    return (
      <MailOnboardingScreen
        onComplete={handleOnboardingComplete}
        onAddAnother={handleAddAnother}
        onClose={handleOnboardingClose}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ModuleHeader
        moduleId="mail"
        icon="mail"
        title={t('navigation.mail')}
      />

      {/* Welcome modal for first-time users */}
      <MailWelcomeModal
        visible={showWelcome}
        onDismiss={handleWelcomeDismiss}
      />

      {/* Placeholder content — will be replaced with inbox in later phases */}
      {onboardingComplete ? (
        <View style={styles.placeholderContent}>
          <Text style={styles.placeholderText}>
            {t('modules.mail.setupComplete')}
          </Text>
        </View>
      ) : (
        <View style={styles.placeholderContent}>
          <Icon name="mail" size={48} color={themeColors.textSecondary} />
          <Text style={[styles.notConfiguredTitle, { color: themeColors.textPrimary }]}>
            {t('modules.mail.notConfigured.title')}
          </Text>
          <Text style={[styles.notConfiguredHint, { color: themeColors.textSecondary }]}>
            {t('modules.mail.notConfigured.hint')}
          </Text>
          <TouchableOpacity
            style={[styles.setupButton, { backgroundColor: accentColor.primary }]}
            onPress={handleStartSetup}
            onLongPress={() => {}}
            delayLongPress={300}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('modules.mail.notConfigured.setupButton')}
          >
            <Text style={styles.setupButtonText}>
              {t('modules.mail.notConfigured.setupButton')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  placeholderContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  placeholderText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  notConfiguredTitle: {
    ...typography.h3,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  notConfiguredHint: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  setupButton: {
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  setupButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
