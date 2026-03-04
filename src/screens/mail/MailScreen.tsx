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
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { colors, typography, spacing } from '@/theme';
import { ModuleHeader } from '@/components';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { MailWelcomeModal } from './MailWelcomeModal';
import { MailOnboardingScreen } from './MailOnboardingScreen';

// AsyncStorage key for tracking onboarding completion
const MAIL_ONBOARDING_COMPLETE_KEY = 'mail_onboarding_complete';
const MAIL_WELCOME_SHOWN_KEY = 'mail_welcome_shown';

export function MailScreen() {
  const { t } = useTranslation();
  const moduleColor = useModuleColor('mail');
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
      <MailOnboardingScreen onComplete={handleOnboardingComplete} />
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
      {onboardingComplete && (
        <View style={styles.placeholderContent}>
          <Text style={styles.placeholderText}>
            {t('modules.mail.onboarding.setupComplete')}
          </Text>
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
});
