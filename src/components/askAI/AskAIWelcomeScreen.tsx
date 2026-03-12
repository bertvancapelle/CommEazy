/**
 * AskAIWelcomeScreen — First-time setup screen for Ask AI module
 *
 * Shows a friendly welcome message and Google Sign-In button.
 * Only shown when the user hasn't linked a Google account yet.
 *
 * @see .claude/plans/VRAAG_HET_AI_MODULE.md
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';

import {
  colors,
  typography,
  spacing,
  borderRadius,
  touchTargets,
} from '@/theme';
import { Icon } from '@/components/Icon';
import { useAskAI } from '@/contexts/AskAIContext';

export function AskAIWelcomeScreen() {
  const { t } = useTranslation();
  const { linkGoogleAccount, isLinking, error } = useAskAI();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Robot/AI icon */}
        <View style={styles.iconContainer}>
          <Icon name="chatbubble" size={48} color={colors.textPrimary} />
        </View>

        <Text style={styles.title}>
          {t('modules.askAI.welcome.title')}
        </Text>

        <Text style={styles.description}>
          {t('modules.askAI.welcome.description')}
        </Text>

        <Text style={styles.loginPrompt}>
          {t('modules.askAI.welcome.loginPrompt')}
        </Text>

        {/* Google Sign-In button */}
        <HapticTouchable hapticDisabled
          style={[styles.loginButton, isLinking && styles.loginButtonDisabled]}
          onPress={linkGoogleAccount}
          disabled={isLinking}
          accessibilityRole="button"
          accessibilityLabel={t('modules.askAI.welcome.loginButton')}
          accessibilityState={{ disabled: isLinking }}
        >
          {isLinking ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Icon name="globe" size={24} color="#FFFFFF" />
              <Text style={styles.loginButtonText}>
                {t('modules.askAI.welcome.loginButton')}
              </Text>
            </>
          )}
        </HapticTouchable>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Icon name="warning" size={20} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Privacy notice */}
        <Text style={styles.privacyText}>
          {t('modules.askAI.welcome.loginHelp')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  loginPrompt: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4', // Google blue
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    minHeight: touchTargets.minimum,
    minWidth: 240,
    gap: spacing.sm,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    flex: 1,
  },
  privacyText: {
    ...typography.small,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
