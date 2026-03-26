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
import { View, StyleSheet, Text, Alert, NativeModules, Keyboard } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { ModuleHeader, Icon, HapticTouchable, LoadingView, Button, TextInput, PanelAwareModal, ErrorView } from '@/components';
import { ModalLayout } from '@/components/ModalLayout';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { useFeedback } from '@/hooks/useFeedback';
import { ServiceContainer } from '@/services/container';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import type { MailAccount, CachedMailHeader, MailBody } from '@/types/mail';
import { MailWelcomeModal } from './MailWelcomeModal';
import { MailOnboardingScreen } from './MailOnboardingScreen';
import { MailInboxScreen } from './MailInboxScreen';
import { MailDetailScreen } from './MailDetailScreen';
import { MailComposeScreen, type ComposeMode } from './MailComposeScreen';
import { loadDraft, deleteDraft, hasDraft } from '@/services/mail/draftService';
import type { MailRecipient } from '@/types/mail';

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
  | { type: 'compose'; mode: ComposeMode; originalHeader?: CachedMailHeader; originalBody?: MailBody | null; restoredDraft?: { to: MailRecipient[]; cc: MailRecipient[]; bcc: MailRecipient[]; subject: string; body: string } };

// ============================================================
// Component
// ============================================================

export function MailScreen() {
  const { t } = useTranslation();
  const moduleColor = useModuleColor('mail');
  const themeColors = useColors();
  const { accentColor } = useAccentColor();

  const { triggerFeedback } = useFeedback();

  // Onboarding state
  const [showWelcome, setShowWelcome] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Email required modal state
  const [showEmailRequired, setShowEmailRequired] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Account state
  const [account, setAccount] = useState<MailAccount | null>(null);

  // Internal navigation
  const [currentView, setCurrentView] = useState<MailView>({ type: 'inbox' });

  // Draft indicator
  const [draftAvailable, setDraftAvailable] = useState(false);

  // ============================================================
  // Init — Check Onboarding State + Load Account
  // ============================================================

  // Sync i18n notification strings to native module for background fetch
  const syncNotificationStrings = useCallback(() => {
    try {
      NativeModules.MailBackgroundFetchModule?.configureNotificationStrings(
        t('modules.mail.notifications.newMailTitle'),
        t('modules.mail.notifications.newMailBodySingular'),
        t('modules.mail.notifications.newMailBodyPlural'),
      );
    } catch {
      console.debug('[MailScreen] Failed to sync notification strings');
    }
  }, [t]);

  useEffect(() => {
    const checkState = async () => {
      try {
        const [welcomeShown, onboardingDone] = await Promise.all([
          AsyncStorage.getItem(MAIL_WELCOME_SHOWN_KEY),
          AsyncStorage.getItem(MAIL_ONBOARDING_COMPLETE_KEY),
        ]);

        if (onboardingDone === 'true') {
          setOnboardingComplete(true);
          await loadAccount();
          // Sync i18n strings to native for background notifications
          syncNotificationStrings();
        } else {
          // Check if an account already exists (e.g. configured via Settings)
          const credentialManager = await import('@/services/mail/credentialManager');
          const existingAccount = await credentialManager.getDefaultAccount();
          if (existingAccount) {
            // Account exists — mark onboarding as complete and load
            setAccount(existingAccount);
            setOnboardingComplete(true);
            AsyncStorage.setItem(MAIL_ONBOARDING_COMPLETE_KEY, 'true').catch(console.error);
            AsyncStorage.setItem(MAIL_WELCOME_SHOWN_KEY, 'true').catch(console.error);
            // Sync i18n strings to native for background notifications
            syncNotificationStrings();
          } else if (welcomeShown !== 'true') {
            // Check if user has an email in their profile
            const profile = await ServiceContainer.database.getUserProfile();
            if (profile?.email?.trim()) {
              setShowWelcome(true);
            } else {
              setShowEmailRequired(true);
            }
          } else {
            setShowOnboarding(true);
          }
        }
      } catch (error) {
        console.error('[MailScreen] Failed to check onboarding state:', error);
      } finally {
        setIsLoading(false);
      }

      // Check for saved draft (for compose button badge)
      hasDraft().then(setDraftAvailable).catch(() => {});
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

  const handleStartSetup = useCallback(async () => {
    // Check if user has an email before starting setup
    const profile = await ServiceContainer.database.getUserProfile();
    if (profile?.email?.trim()) {
      setShowOnboarding(true);
      AsyncStorage.setItem(MAIL_WELCOME_SHOWN_KEY, 'true').catch(console.error);
    } else {
      setShowEmailRequired(true);
    }
  }, []);

  // ============================================================
  // Email Required Modal Handlers
  // ============================================================

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleEmailCancel = useCallback(() => {
    setShowEmailRequired(false);
    setEmailInput('');
    setEmailError(null);
  }, []);

  const handleEmailContinue = useCallback(async () => {
    Keyboard.dismiss();
    const trimmed = emailInput.trim();
    if (!trimmed) {
      setEmailError(t('modules.mail.emailRequired.errorEmpty'));
      void triggerFeedback('warning');
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError(t('modules.mail.emailRequired.errorInvalid'));
      void triggerFeedback('warning');
      return;
    }

    setIsSavingEmail(true);
    try {
      const profile = await ServiceContainer.database.getUserProfile();
      if (profile) {
        await ServiceContainer.database.saveUserProfile({
          ...profile,
          email: trimmed,
        });
      }
      setShowEmailRequired(false);
      setEmailInput('');
      setEmailError(null);
      // Now proceed to welcome modal
      setShowWelcome(true);
    } catch (error) {
      console.error('[MailScreen] Failed to save email:', (error as Error).message);
      setEmailError(t('errors.genericError'));
    } finally {
      setIsSavingEmail(false);
    }
  }, [emailInput, t, triggerFeedback]);

  // ============================================================
  // Mail Navigation Handlers
  // ============================================================

  const handleOpenMail = useCallback((header: CachedMailHeader) => {
    setCurrentView({ type: 'detail', header });
  }, []);

  const handleCompose = useCallback(async () => {
    try {
      const draft = await loadDraft();
      if (draft) {
        // Ask user if they want to continue their draft
        Alert.alert(
          t('modules.mail.compose.draftFound'),
          t('modules.mail.compose.draftFoundMessage'),
          [
            {
              text: t('modules.mail.compose.draftDiscard'),
              style: 'destructive',
              onPress: () => {
                deleteDraft().catch(() => {});
                setDraftAvailable(false);
                setCurrentView({ type: 'compose', mode: 'new' });
              },
            },
            {
              text: t('modules.mail.compose.draftRestore'),
              onPress: () => {
                setDraftAvailable(false);
                setCurrentView({
                  type: 'compose',
                  mode: draft.mode,
                  restoredDraft: {
                    to: draft.to,
                    cc: draft.cc,
                    bcc: draft.bcc,
                    subject: draft.subject,
                    body: draft.body,
                  },
                });
              },
            },
          ],
        );
        return;
      }
    } catch {
      // Non-critical — proceed with empty compose
    }
    setCurrentView({ type: 'compose', mode: 'new' });
  }, [t]);

  const handleReply = useCallback((header: CachedMailHeader) => {
    setCurrentView({ type: 'compose', mode: 'reply', originalHeader: header });
  }, []);

  const handleReplyAll = useCallback((header: CachedMailHeader) => {
    setCurrentView({ type: 'compose', mode: 'replyAll', originalHeader: header });
  }, []);

  const handleForward = useCallback((header: CachedMailHeader, body: MailBody | null) => {
    setCurrentView({ type: 'compose', mode: 'forward', originalHeader: header, originalBody: body });
  }, []);

  const handleBackToInbox = useCallback(() => {
    setCurrentView({ type: 'inbox' });
    // Check if a draft was saved when leaving compose
    hasDraft().then(setDraftAvailable).catch(() => {});
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
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ModuleHeader
          moduleId="mail"
          icon="mail"
          title={t('navigation.mail')}
        />
        <LoadingView fullscreen />
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
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ModuleHeader
          moduleId="mail"
          icon="mail"
          title={t('navigation.mail')}
        />

        <MailWelcomeModal
          visible={showWelcome}
          onDismiss={handleWelcomeDismiss}
        />

        {/* Email Required Modal — shown before welcome when no email in profile */}
        <PanelAwareModal
          visible={showEmailRequired}
          transparent
          animationType="fade"
          onRequestClose={handleEmailCancel}
        >
          <View style={styles.overlay}>
            <View style={[styles.emailCard, { backgroundColor: themeColors.surface, shadowColor: '#000' }]}>
              <ModalLayout
                headerBlock={
                  <View style={styles.emailHeader}>
                    <Icon name="mail" size={40} color={accentColor.primary} />
                    <Text style={[styles.emailTitle, { color: themeColors.textPrimary }]}>
                      {t('modules.mail.emailRequired.title')}
                    </Text>
                    <Text style={[styles.emailSubtitle, { color: themeColors.textSecondary }]}>
                      {t('modules.mail.emailRequired.subtitle')}
                    </Text>
                  </View>
                }
                contentBlock={
                  <View style={styles.emailContent}>
                    {emailError && (
                      <ErrorView
                        type="error"
                        title={emailError}
                        message=""
                        onDismiss={() => setEmailError(null)}
                      />
                    )}
                    <TextInput
                      label={t('modules.mail.emailRequired.label')}
                      value={emailInput}
                      onChangeText={(text) => {
                        setEmailInput(text);
                        if (emailError) setEmailError(null);
                      }}
                      placeholder={t('modules.mail.emailRequired.placeholder')}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleEmailContinue}
                      accessibilityLabel={t('modules.mail.emailRequired.label')}
                    />
                  </View>
                }
                footerBlock={
                  <View style={styles.emailButtons}>
                    <Button
                      title={t('common.cancel')}
                      onPress={handleEmailCancel}
                      variant="secondary"
                    />
                    <Button
                      title={t('modules.mail.emailRequired.continue')}
                      onPress={handleEmailContinue}
                      disabled={!emailInput.trim() || isSavingEmail}
                      loading={isSavingEmail}
                    />
                  </View>
                }
              />
            </View>
          </View>
        </PanelAwareModal>

        <View style={styles.placeholderContent}>
          <Icon name="mail" size={48} color={themeColors.textSecondary} />
          <Text style={[styles.notConfiguredTitle, { color: themeColors.textPrimary }]}>
            {t('modules.mail.notConfigured.title')}
          </Text>
          <Text style={[styles.notConfiguredHint, { color: themeColors.textSecondary }]}>
            {t('modules.mail.notConfigured.hint')}
          </Text>
          <HapticTouchable
            style={[styles.setupButton, { backgroundColor: accentColor.primary }]}
            onPress={handleStartSetup}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('modules.mail.notConfigured.setupButton')}
          >
            <Text style={styles.setupButtonText}>
              {t('modules.mail.notConfigured.setupButton')}
            </Text>
          </HapticTouchable>
        </View>
      </View>
    );
  }

  // ============================================================
  // Render — Compose View (replaces everything)
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
        restoredDraft={currentView.restoredDraft}
      />
    );
  }

  // ============================================================
  // Render — Inbox (always mounted) + Detail (overlay)
  // Keep MailInboxScreen mounted so search state persists
  // ============================================================

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Inbox — hidden when detail is visible, but stays mounted */}
      <View style={[
        styles.container,
        currentView.type === 'detail' && styles.hidden,
      ]}>
        <ModuleHeader
          moduleId="mail"
          icon="mail"
          title={t('navigation.mail')}
        />
        <MailInboxScreen
          account={account}
          onOpenMail={handleOpenMail}
          onCompose={handleCompose}
          hasDraft={draftAvailable}
        />
      </View>

      {/* Detail — rendered on top when active */}
      {currentView.type === 'detail' && (
        <View style={StyleSheet.absoluteFill}>
          <MailDetailScreen
            header={currentView.header}
            account={account}
            onBack={handleBackToInbox}
            onReply={handleReply}
            onReplyAll={handleReplyAll}
            onForward={handleForward}
            onDeleted={handleMailDeleted}
          />
        </View>
      )}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hidden: {
    display: 'none',
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
    color: 'white',
    fontWeight: '700',
  },
  // Email Required Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  emailCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  emailHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  emailTitle: {
    ...typography.h3,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emailSubtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  emailContent: {
    marginBottom: spacing.lg,
  },
  emailButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
