/**
 * MailScreen — Main entry point for the E-mail module
 *
 * Manages internal navigation between:
 * - Onboarding wizard (first-time setup)
 * - Inbox / folder list (after setup)
 * - Message detail view
 * - Compose screen (new, reply, forward)
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { ModuleHeader, Icon } from '@/components';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import type { MailAccount, CachedMailHeader, MailBody } from '@/types/mail';
import { MailWelcomeModal } from './MailWelcomeModal';
import { MailOnboardingScreen } from './MailOnboardingScreen';
import { MailInboxScreen } from './MailInboxScreen';
import { MailDetailScreen } from './MailDetailScreen';
import { MailComposeScreen, type ComposeMode } from './MailComposeScreen';

// ============================================================
// Constants
// ============================================================

const MAIL_ONBOARDING_COMPLETE_KEY = 'mail_onboarding_complete';
const MAIL_WELCOME_SHOWN_KEY = 'mail_welcome_shown';

// ============================================================
// Internal Navigation Types
// ============================================================

type MailView =
  | { type: 'inbox' }
  | { type: 'detail'; header: CachedMailHeader }
  | { type: 'compose'; mode: ComposeMode; originalHeader?: CachedMailHeader; originalBody?: MailBody | null };

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
// Component
// ============================================================

export function MailScreen() {
  const { t } = useTranslation();
  const moduleColor = useModuleColor('mail');
  const themeColors = useColors();
  const { accentColor } = useAccentColor();

  // Onboarding state
  const [showWelcome, setShowWelcome] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Account state
  const [account, setAccount] = useState<MailAccount | null>(null);

  // Internal navigation
  const [currentView, setCurrentView] = useState<MailView>({ type: 'inbox' });

  // ============================================================
  // Init — Check Onboarding State + Load Account
  // ============================================================

  useEffect(() => {
    const checkState = async () => {
      try {
        const [welcomeShown, onboardingDone] = await Promise.all([
          AsyncStorage.getItem(MAIL_WELCOME_SHOWN_KEY),
          AsyncStorage.getItem(MAIL_ONBOARDING_COMPLETE_KEY),
        ]);

        if (onboardingDone === 'true') {
          setOnboardingComplete(true);
          // Load the default account
          await loadAccount();
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

  // ============================================================
  // Load Account
  // ============================================================

  const loadAccount = useCallback(async () => {
    try {
      const credentialManager = await import('@/services/mail/credentialManager');
      const defaultAccount = await credentialManager.getDefaultAccount();
      if (defaultAccount) {
        setAccount(defaultAccount);
      }
    } catch {
      console.debug('[MailScreen] Failed to load account');
    }
  }, []);

  // ============================================================
  // Onboarding Handlers
  // ============================================================

  const handleWelcomeDismiss = useCallback(() => {
    setShowWelcome(false);
    setShowOnboarding(true);
    AsyncStorage.setItem(MAIL_WELCOME_SHOWN_KEY, 'true').catch(console.error);
  }, []);

  const handleOnboardingComplete = useCallback(async () => {
    // Load the account FIRST, then update UI state
    // This prevents briefly showing the "not configured" placeholder
    await loadAccount();
    AsyncStorage.setItem(MAIL_ONBOARDING_COMPLETE_KEY, 'true').catch(console.error);
    setOnboardingComplete(true);
    setShowOnboarding(false);
  }, [loadAccount]);

  const handleOnboardingClose = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  const handleStartSetup = useCallback(() => {
    triggerHaptic();
    setShowOnboarding(true);
    AsyncStorage.setItem(MAIL_WELCOME_SHOWN_KEY, 'true').catch(console.error);
  }, []);

  // ============================================================
  // Mail Navigation Handlers
  // ============================================================

  const handleOpenMail = useCallback((header: CachedMailHeader) => {
    setCurrentView({ type: 'detail', header });
  }, []);

  const handleCompose = useCallback(() => {
    setCurrentView({ type: 'compose', mode: 'new' });
  }, []);

  const handleReply = useCallback((header: CachedMailHeader) => {
    setCurrentView({ type: 'compose', mode: 'reply', originalHeader: header });
  }, []);

  const handleForward = useCallback((header: CachedMailHeader, body: MailBody | null) => {
    setCurrentView({ type: 'compose', mode: 'forward', originalHeader: header, originalBody: body });
  }, []);

  const handleBackToInbox = useCallback(() => {
    setCurrentView({ type: 'inbox' });
  }, []);

  const handleMailDeleted = useCallback((_uid: number) => {
    // Return to inbox — the inbox will refresh automatically
    setCurrentView({ type: 'inbox' });
  }, []);

  const handleSent = useCallback(() => {
    // Return to inbox after sending
    setCurrentView({ type: 'inbox' });
  }, []);

  // ============================================================
  // Render — Loading
  // ============================================================

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ModuleHeader
          moduleId="mail"
          icon="mail"
          title={t('navigation.mail')}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accentColor.primary} />
        </View>
      </View>
    );
  }

  // ============================================================
  // Render — Onboarding
  // ============================================================

  if (showOnboarding) {
    return (
      <MailOnboardingScreen
        onComplete={handleOnboardingComplete}
        onAddAnother={() => {}}
        onClose={handleOnboardingClose}
      />
    );
  }

  // ============================================================
  // Render — Not Configured (no account yet)
  // ============================================================

  if (!onboardingComplete || !account) {
    return (
      <View style={styles.container}>
        <ModuleHeader
          moduleId="mail"
          icon="mail"
          title={t('navigation.mail')}
        />

        <MailWelcomeModal
          visible={showWelcome}
          onDismiss={handleWelcomeDismiss}
        />

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
      </View>
    );
  }

  // ============================================================
  // Render — Mail Detail View
  // ============================================================

  if (currentView.type === 'detail') {
    return (
      <MailDetailScreen
        header={currentView.header}
        account={account}
        onBack={handleBackToInbox}
        onReply={handleReply}
        onForward={handleForward}
        onDeleted={handleMailDeleted}
      />
    );
  }

  // ============================================================
  // Render — Compose View
  // ============================================================

  if (currentView.type === 'compose') {
    return (
      <MailComposeScreen
        account={account}
        mode={currentView.mode}
        originalHeader={currentView.originalHeader}
        originalBody={currentView.originalBody}
        onClose={handleBackToInbox}
        onSent={handleSent}
      />
    );
  }

  // ============================================================
  // Render — Inbox View (default)
  // ============================================================

  return (
    <View style={styles.container}>
      <ModuleHeader
        moduleId="mail"
        icon="mail"
        title={t('navigation.mail')}
      />

      <MailInboxScreen
        account={account}
        onOpenMail={handleOpenMail}
        onCompose={handleCompose}
      />
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
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
