/**
 * Mail Onboarding Step 3 — Test + Confirmation (Combined)
 *
 * Two phases in one screen:
 * - Phase A: Automatic connection test with step-by-step progress
 * - Phase B: Result display (success with options, or error with retry)
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 8
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { Button, Icon, ProgressIndicator , ScrollViewWithIndicator } from '@/components';
import type { MailProvider } from '@/services/mail/mailConstants';

// ============================================================
// Types
// ============================================================

/** Individual test step status */
export type TestStepStatus = 'pending' | 'running' | 'success' | 'error';

/** A single test step */
export interface TestStep {
  id: string;
  labelKey: string;
  status: TestStepStatus;
  errorMessage?: string;
}

/** Overall test result */
export type TestResult = 'testing' | 'success' | 'error';

export interface MailOnboardingStep3Props {
  /** Selected provider */
  provider: MailProvider;
  /** Email address (for display in success message) */
  email: string;
  /** Array of test steps with current status */
  testSteps: TestStep[];
  /** Overall test result */
  testResult: TestResult;
  /** Number of inbox messages found (shown on success) */
  inboxCount?: number;
  /** Called when user wants to add another account */
  onAddAnother: () => void;
  /** Called when user wants to go to inbox */
  onGoToInbox: () => void;
  /** Called when user wants to retry / adjust settings */
  onRetry: () => void;
  /** Current step for ProgressIndicator */
  currentStep?: number;
  /** Total steps for ProgressIndicator */
  totalSteps?: number;
}

// ============================================================
// Component
// ============================================================

export function MailOnboardingStep3({
  provider,
  email,
  testSteps,
  testResult,
  inboxCount,
  onAddAnother,
  onGoToInbox,
  onRetry,
  currentStep = 3,
  totalSteps = 3,
}: MailOnboardingStep3Props) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const { triggerHaptic } = useFeedback();
  const hasTriggeredHaptic = useRef(false);

  // Trigger haptic on result
  useEffect(() => {
    if (hasTriggeredHaptic.current) return;
    if (testResult === 'success') {
      hasTriggeredHaptic.current = true;
      triggerHaptic('success');
    } else if (testResult === 'error') {
      hasTriggeredHaptic.current = true;
      triggerHaptic('error');
    }
  }, [testResult]);

  // ============================================================
  // Render: Test Step Item
  // ============================================================

  const renderTestStep = (step: TestStep, index: number) => {
    let statusIcon: React.ReactNode;

    switch (step.status) {
      case 'pending':
        statusIcon = (
          <View style={[stepStyles.dot, { backgroundColor: themeColors.border }]} />
        );
        break;
      case 'running':
        statusIcon = (
          <ActivityIndicator size="small" color={accentColor.primary} />
        );
        break;
      case 'success':
        statusIcon = (
          <Icon name="check" size={20} color={themeColors.success} />
        );
        break;
      case 'error':
        statusIcon = (
          <Icon name="x" size={20} color={themeColors.error} />
        );
        break;
    }

    return (
      <View
        key={step.id}
        style={stepStyles.container}
        accessibilityLabel={`${t(step.labelKey)}: ${t(`modules.mail.onboarding.testStatus.${step.status}`)}`}
      >
        <View style={stepStyles.iconContainer}>
          {statusIcon}
        </View>
        <View style={stepStyles.content}>
          <Text
            style={[
              stepStyles.label,
              {
                color: step.status === 'pending'
                  ? themeColors.textSecondary
                  : themeColors.textPrimary,
              },
            ]}
          >
            {t(step.labelKey)}
          </Text>
          {step.status === 'error' && step.errorMessage && (
            <Text style={[stepStyles.errorMessage, { color: themeColors.error }]}>
              {step.errorMessage}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // ============================================================
  // Render: Success View
  // ============================================================

  const renderSuccess = () => (
    <View style={styles.resultContainer}>
      <View
        style={[styles.successIcon, { backgroundColor: `${themeColors.success}20` }]}
      >
        <Icon name="check" size={48} color={themeColors.success} />
      </View>

      <Text style={[styles.resultTitle, { color: themeColors.textPrimary }]}>
        {t('modules.mail.onboarding.testSuccess')}
      </Text>

      <Text style={[styles.resultMessage, { color: themeColors.textSecondary }]}>
        {t('modules.mail.onboarding.accountLinked', { email })}
      </Text>

      {inboxCount !== undefined && inboxCount > 0 && (
        <Text style={[styles.inboxInfo, { color: themeColors.textSecondary }]}>
          {t('modules.mail.onboarding.inboxCount', { count: inboxCount })}
        </Text>
      )}

      <View style={styles.actionButtons}>
        <Button
          title={t('modules.mail.onboarding.goToInbox')}
          onPress={() => {
            triggerHaptic('tap');
            onGoToInbox();
          }}
        />
        <Button
          title={t('modules.mail.onboarding.addAnotherAccount')}
          onPress={() => {
            triggerHaptic('tap');
            onAddAnother();
          }}
          variant="secondary"
        />
      </View>
    </View>
  );

  // ============================================================
  // Render: Error View
  // ============================================================

  const renderError = () => {
    // Find the first error step for the message
    const errorStep = testSteps.find(s => s.status === 'error');

    return (
      <View style={styles.resultContainer}>
        <View
          style={[styles.errorIcon, { backgroundColor: `${themeColors.error}20` }]}
        >
          <Icon name="warning" size={48} color={themeColors.error} />
        </View>

        <Text style={[styles.resultTitle, { color: themeColors.textPrimary }]}>
          {t('modules.mail.onboarding.testFailed')}
        </Text>

        <Text style={[styles.resultMessage, { color: themeColors.textSecondary }]}>
          {errorStep?.errorMessage || t('modules.mail.onboarding.testFailedGeneric')}
        </Text>

        <View style={styles.actionButtons}>
          <Button
            title={t('modules.mail.onboarding.adjustSettings')}
            onPress={() => {
              triggerHaptic('tap');
              onRetry();
            }}
          />
        </View>
      </View>
    );
  };

  // ============================================================
  // Main Render
  // ============================================================

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ProgressIndicator currentStep={currentStep} totalSteps={totalSteps} />

      <ScrollViewWithIndicator
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text
            style={[styles.title, { color: themeColors.textPrimary }]}
            accessibilityRole="header"
          >
            {testResult === 'testing'
              ? t('modules.mail.onboarding.testingConnection')
              : testResult === 'success'
                ? t('modules.mail.onboarding.testSuccess')
                : t('modules.mail.onboarding.testFailed')}
          </Text>
        </View>

        {/* Test Steps */}
        <View style={styles.stepsContainer}>
          {testSteps.map(renderTestStep)}
        </View>

        {/* Result */}
        {testResult === 'success' && renderSuccess()}
        {testResult === 'error' && renderError()}
      </ScrollViewWithIndicator>
    </SafeAreaView>
  );
}

// ============================================================
// Test Step Styles
// ============================================================

const stepStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: touchTargets.minimum,
    paddingVertical: spacing.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  content: {
    flex: 1,
    marginLeft: spacing.sm,
    justifyContent: 'center',
  },
  label: {
    ...typography.body,
  },
  errorMessage: {
    ...typography.small,
    marginTop: 2,
  },
});

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
  },
  stepsContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  // Result views
  resultContainer: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  resultTitle: {
    ...typography.h3,
    textAlign: 'center',
  },
  resultMessage: {
    ...typography.body,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  inboxInfo: {
    ...typography.body,
    textAlign: 'center',
  },
  actionButtons: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
