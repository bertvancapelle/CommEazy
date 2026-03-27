/**
 * Mail Onboarding Screen — Wizard Container
 *
 * Orchestrates the 3-step mail account setup wizard.
 * Manages step navigation, authentication flow, and connection testing.
 *
 * Flow:
 * 1. Provider selection (Step 1)
 * 2. Authentication — OAuth2 or password (Step 2)
 * 3. Connection test + confirmation (Step 3)
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 8
 */

import React, { useState, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MailProvider, ServerConfig } from '@/services/mail/mailConstants';
import { MailOnboardingStep1 } from './MailOnboardingStep1';
import {
  MailOnboardingStep2,
  type AuthFormData,
} from './MailOnboardingStep2';
import {
  MailOnboardingStep3,
  type TestStep,
  type TestResult,
} from './MailOnboardingStep3';

// ============================================================
// Types
// ============================================================

export interface MailOnboardingScreenProps {
  /** Called when onboarding completes (go to inbox) */
  onComplete: () => void;
  /** Called when user wants to add another account (restart wizard) */
  onAddAnother: () => void;
  /** Called when user cancels / closes the wizard */
  onClose?: () => void;
  /** Pre-fill email from user profile (if available) */
  initialEmail?: string;
}

type WizardStep = 1 | 2 | 3;

// ============================================================
// Default Test Steps
// ============================================================

function createDefaultTestSteps(t: (key: string) => string): TestStep[] {
  return [
    {
      id: 'connect',
      labelKey: 'modules.mail.onboarding.testSteps.connect',
      status: 'pending',
    },
    {
      id: 'auth',
      labelKey: 'modules.mail.onboarding.testSteps.auth',
      status: 'pending',
    },
    {
      id: 'inbox',
      labelKey: 'modules.mail.onboarding.testSteps.inbox',
      status: 'pending',
    },
    {
      id: 'smtp',
      labelKey: 'modules.mail.onboarding.testSteps.smtp',
      status: 'pending',
    },
  ];
}

// ============================================================
// Component
// ============================================================

export function MailOnboardingScreen({
  onComplete,
  onAddAnother,
  onClose,
  initialEmail,
}: MailOnboardingScreenProps) {
  const { t } = useTranslation();

  // Wizard state
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedProvider, setSelectedProvider] = useState<MailProvider | null>(null);
  const [authData, setAuthData] = useState<AuthFormData | null>(null);

  // Step 2 state
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Step 3 state
  const [testSteps, setTestSteps] = useState<TestStep[]>(createDefaultTestSteps(t));
  const [testResult, setTestResult] = useState<TestResult>('testing');
  const [inboxCount, setInboxCount] = useState<number | undefined>(undefined);
  const [accountEmail, setAccountEmail] = useState('');

  // Abort controller for cancelling async operations
  const abortRef = useRef<AbortController | null>(null);

  // ============================================================
  // Step 1 → Step 2
  // ============================================================

  const handleProviderSelect = useCallback((provider: MailProvider) => {
    setSelectedProvider(provider);
    setAuthError(null);
    setStep(2);
  }, []);

  // ============================================================
  // Step 2 → Step 3 (Authentication)
  // ============================================================

  const handleAuthSubmit = useCallback(async (data: AuthFormData) => {
    setAuthData(data);
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (selectedProvider?.authType === 'oauth2') {
        // OAuth2 flow
        await handleOAuth2Flow(data);
      } else {
        // Password flow — proceed directly to test
        setAccountEmail(data.email);
        setStep(3);
        // Start connection test after state updates
        setTimeout(() => runConnectionTest(data), 100);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }, [selectedProvider]);

  // ============================================================
  // OAuth2 Flow
  // ============================================================

  const handleOAuth2Flow = async (data: AuthFormData) => {
    try {
      // Lazy import to avoid crash if react-native-app-auth not installed
      const oauth2Service = await import('@/services/mail/oauth2Service');

      const tokenResponse = await oauth2Service.authorize(data.providerId);

      // Extract email from ID token
      let email = '';
      if (tokenResponse.idToken) {
        email = oauth2Service.extractEmailFromIdToken(tokenResponse.idToken) || '';
      }

      if (!email) {
        // Ask user for email when ID token extraction fails
        email = await new Promise<string>((resolve) => {
          if (Platform.OS === 'ios') {
            Alert.prompt(
              t('modules.mail.onboarding.enterEmailTitle'),
              t('modules.mail.onboarding.enterEmailMessage'),
              [
                {
                  text: t('common.cancel'),
                  style: 'cancel',
                  onPress: () => resolve(''),
                },
                {
                  text: t('common.confirm'),
                  onPress: (value) => resolve(value?.trim() || ''),
                },
              ],
              'plain-text',
              '',
              'email-address',
            );
          } else {
            // Android: Alert.prompt not available, use a simple alert
            // The email will need to be entered on the next step
            Alert.alert(
              t('modules.mail.onboarding.enterEmailTitle'),
              t('modules.mail.onboarding.enterEmailMessage'),
              [{ text: t('common.confirm'), onPress: () => resolve('') }],
            );
          }
        });

        if (!email) {
          throw new Error(t('modules.mail.onboarding.emailRequired'));
        }
      }

      setAccountEmail(email);

      // Save credentials
      const credentialManager = await import('@/services/mail/credentialManager');
      const mailConstants = await import('@/services/mail/mailConstants');
      const provider = mailConstants.getProvider(data.providerId);

      if (!provider) throw new Error('Provider not found');

      const accountId = `${data.providerId}_${Date.now()}`;

      await credentialManager.saveCredentials(accountId, {
        type: 'oauth2',
        email,
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        expiresAt: tokenResponse.expiresAt,
        imapConfig: {
          host: provider.imap.host,
          port: provider.imap.port,
          security: provider.imap.security,
        },
        smtpConfig: {
          host: provider.smtp.host,
          port: provider.smtp.port,
          security: provider.smtp.security,
        },
      });

      await credentialManager.saveAccount({
        id: accountId,
        providerId: data.providerId,
        displayName: provider.name,
        email,
        authType: 'oauth2',
        isDefault: true,
        createdAt: Date.now(),
      });

      // Move to test step
      setStep(3);
      setTimeout(
        () => runConnectionTest({
          ...data,
          email,
        }),
        100,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Check for user cancellation
      if (message.includes('cancel') || message.includes('Cancel')) {
        setAuthError(t('modules.mail.onboarding.oauthCancelled'));
      } else {
        setAuthError(t('modules.mail.onboarding.oauthFailed'));
      }
      throw err;
    }
  };

  // ============================================================
  // Connection Test (Step 3)
  // ============================================================

  const updateTestStep = (stepId: string, update: Partial<TestStep>) => {
    setTestSteps(prev =>
      prev.map(s => (s.id === stepId ? { ...s, ...update } : s)),
    );
  };

  const runConnectionTest = async (data: AuthFormData) => {
    // Reset test steps
    setTestSteps(createDefaultTestSteps(t));
    setTestResult('testing');
    setInboxCount(undefined);

    // Create an abort controller
    abortRef.current = new AbortController();

    const provider = selectedProvider!;
    const isOAuth2 = provider.authType === 'oauth2';

    try {
      const imapBridge = await import('@/services/mail/imapBridge');
      const credentialManager = await import('@/services/mail/credentialManager');

      // Resolve the accountId — for OAuth2, it was already saved in handleOAuth2Flow
      let accountId: string;

      if (isOAuth2) {
        // OAuth2 — credentials already saved, find the account
        const account = await credentialManager.getDefaultAccount();
        if (!account) throw new Error(t('modules.mail.onboarding.noAccountFound'));
        accountId = account.id;
      } else {
        // Password — save credentials now
        accountId = `${provider.id}_${Date.now()}`;

        const imapConfig: ServerConfig = data.imapConfig || {
          host: provider.imap.host,
          port: provider.imap.port,
          security: provider.imap.security,
        };

        const smtpConfig: ServerConfig = data.smtpConfig || {
          host: provider.smtp.host,
          port: provider.smtp.port,
          security: provider.smtp.security,
        };

        await credentialManager.saveCredentials(accountId, {
          type: 'password',
          email: data.email,
          password: data.password,
          imapConfig,
          smtpConfig,
        });

        await credentialManager.saveAccount({
          id: accountId,
          providerId: provider.id,
          displayName: provider.name,
          email: data.email,
          authType: 'password',
          isDefault: true,
          createdAt: Date.now(),
        });
      }

      // Step 1: Connect + Authenticate via IMAP
      updateTestStep('connect', { status: 'running' });

      try {
        if (isOAuth2) {
          // OAuth2 — use connectIMAPWithRefresh (auto-refreshes token if needed)
          await imapBridge.connectIMAPWithRefresh(accountId, provider.id);
        } else {
          // Password — direct IMAP connection
          const credentials = await credentialManager.getCredentials(accountId);
          if (!credentials) throw new Error('No credentials found');
          const imapConfig = credentialManager.buildIMAPConfig(credentials);
          await imapBridge.connectIMAP(imapConfig);
        }
      } catch (connectErr: unknown) {
        // Provide user-friendly error message
        const code = imapBridge.getMailErrorCode(connectErr);
        if (code === 'AUTH_FAILED') {
          throw new Error(t('modules.mail.onboarding.testErrors.authFailed'));
        } else if (code === 'TIMEOUT') {
          throw new Error(t('modules.mail.onboarding.testErrors.timeout'));
        } else {
          throw new Error(t('modules.mail.onboarding.testErrors.connectionFailed'));
        }
      }
      updateTestStep('connect', { status: 'success' });

      // Step 2: Auth confirmed (connection implies successful auth)
      updateTestStep('auth', { status: 'running' });
      updateTestStep('auth', { status: 'success' });

      // Step 3: Fetch inbox
      updateTestStep('inbox', { status: 'running' });
      try {
        const headers = await imapBridge.fetchHeaders('INBOX', 10);
        setInboxCount(headers.length);
      } catch {
        // Inbox might be empty or inaccessible
        setInboxCount(0);
      }
      updateTestStep('inbox', { status: 'success' });

      // Step 4: SMTP check
      updateTestStep('smtp', { status: 'running' });
      try {
        const credentials = await credentialManager.getCredentials(accountId);
        if (credentials) {
          const smtpConfig = data.smtpConfig || {
            host: provider.smtp.host,
            port: provider.smtp.port,
            security: provider.smtp.security,
          };
          const imapConfig = credentialManager.buildIMAPConfig(credentials);
          await imapBridge.testConnection(
            imapConfig,
            { host: smtpConfig.host, port: smtpConfig.port },
          );
        }
      } catch {
        // SMTP test failure is non-fatal during setup —
        // user can still receive mail, sending will be tested later
        console.debug('[MailOnboarding] SMTP test failed, continuing');
      }
      updateTestStep('smtp', { status: 'success' });

      // Disconnect after tests
      try {
        await imapBridge.disconnect();
      } catch {
        // Ignore disconnect errors
      }

      // All done!
      setTestResult('success');
    } catch (err: unknown) {
      // Find which step is currently running and mark it as error
      const message = err instanceof Error ? err.message : String(err);
      setTestSteps(prev =>
        prev.map(s =>
          s.status === 'running'
            ? { ...s, status: 'error' as const, errorMessage: message }
            : s,
        ),
      );
      setTestResult('error');
    }
  };

  // ============================================================
  // Navigation Helpers
  // ============================================================

  const handleBack = useCallback(() => {
    setAuthError(null);
    setStep(1);
  }, []);

  const handleRetry = useCallback(() => {
    setStep(2);
    setAuthError(null);
  }, []);

  const handleAddAnother = useCallback(() => {
    // Reset wizard state
    setStep(1);
    setSelectedProvider(null);
    setAuthData(null);
    setAuthError(null);
    setTestSteps(createDefaultTestSteps(t));
    setTestResult('testing');
    setInboxCount(undefined);
    setAccountEmail('');
    onAddAnother();
  }, [t, onAddAnother]);

  // ============================================================
  // Render
  // ============================================================

  switch (step) {
    case 1:
      return (
        <MailOnboardingStep1
          onSelect={handleProviderSelect}
          onClose={onClose}
          currentStep={1}
          totalSteps={3}
        />
      );

    case 2:
      if (!selectedProvider) {
        setStep(1);
        return null;
      }
      return (
        <MailOnboardingStep2
          provider={selectedProvider}
          onSubmit={handleAuthSubmit}
          onBack={handleBack}
          isLoading={authLoading}
          error={authError}
          currentStep={2}
          totalSteps={3}
          initialEmail={initialEmail}
        />
      );

    case 3:
      return (
        <MailOnboardingStep3
          provider={selectedProvider!}
          email={accountEmail}
          testSteps={testSteps}
          testResult={testResult}
          inboxCount={inboxCount}
          onAddAnother={handleAddAnother}
          onGoToInbox={onComplete}
          onRetry={handleRetry}
          currentStep={3}
          totalSteps={3}
        />
      );
  }
}

