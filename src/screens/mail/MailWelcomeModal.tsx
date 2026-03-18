/**
 * Mail Welcome Modal — First-time use introduction
 *
 * Shown when the user opens the mail module for the first time.
 * Displays numbered steps explaining the setup process.
 * Uses AsyncStorage key: `mail_welcome_shown`.
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 8
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { Button, Icon, PanelAwareModal } from '@/components';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { ModalLayout } from '@/components/ModalLayout';

// ============================================================
// Constants
// ============================================================

const WELCOME_SHOWN_KEY = '@commeazy/mail_welcome_shown';

// ============================================================
// Types
// ============================================================

export interface MailWelcomeModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when modal is dismissed */
  onDismiss: () => void;
}

// ============================================================
// Hook: useMailWelcome
// ============================================================

/**
 * Check if the mail welcome modal should be shown.
 *
 * @returns [shouldShow, markAsShown]
 */
export function useMailWelcome(): [boolean, () => Promise<void>] {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(WELCOME_SHOWN_KEY).then((value) => {
      if (!value) {
        setShouldShow(true);
      }
    });
  }, []);

  const markAsShown = useCallback(async () => {
    await AsyncStorage.setItem(WELCOME_SHOWN_KEY, 'true');
    setShouldShow(false);
  }, []);

  return [shouldShow, markAsShown];
}

// ============================================================
// Welcome Steps Data
// ============================================================

interface WelcomeStep {
  icon: string;
  titleKey: string;
  descriptionKey: string;
}

const WELCOME_STEPS: WelcomeStep[] = [
  {
    icon: '1️⃣',
    titleKey: 'modules.mail.welcome.step1Title',
    descriptionKey: 'modules.mail.welcome.step1Description',
  },
  {
    icon: '2️⃣',
    titleKey: 'modules.mail.welcome.step2Title',
    descriptionKey: 'modules.mail.welcome.step2Description',
  },
  {
    icon: '3️⃣',
    titleKey: 'modules.mail.welcome.step3Title',
    descriptionKey: 'modules.mail.welcome.step3Description',
  },
];

// ============================================================
// Component
// ============================================================

export function MailWelcomeModal({ visible, onDismiss }: MailWelcomeModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const { triggerHaptic } = useFeedback();

  const handleDismiss = useCallback(() => {
    triggerHaptic('tap');
    onDismiss();
  }, [onDismiss]);

  return (
    <PanelAwareModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <LiquidGlassView
          moduleId="mail"
          style={[
            styles.card,
            {
              shadowColor: '#000',
            },
          ]}
          cornerRadius={borderRadius.lg}
        >
          <ModalLayout
            headerBlock={
              <View style={styles.header}>
                <Icon name="mail" size={40} color={accentColor.primary} />
                <Text style={[styles.title, { color: themeColors.textPrimary }]}>
                  {t('modules.mail.welcome.title')}
                </Text>
                <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
                  {t('modules.mail.welcome.subtitle')}
                </Text>
              </View>
            }
            contentBlock={
              <>
                {/* Steps */}
                <View style={styles.stepsContainer}>
                  {WELCOME_STEPS.map((step, index) => (
                    <View key={index} style={styles.stepRow}>
                      <Text style={styles.stepEmoji}>{step.icon}</Text>
                      <View style={styles.stepContent}>
                        <Text style={[styles.stepTitle, { color: themeColors.textPrimary }]}>
                          {t(step.titleKey)}
                        </Text>
                        <Text style={[styles.stepDescription, { color: themeColors.textSecondary }]}>
                          {t(step.descriptionKey)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Privacy note */}
                <View style={[styles.privacyNote, { backgroundColor: accentColor.light }]}>
                  <Icon name="lock" size={18} color={accentColor.primary} />
                  <Text style={[styles.privacyText, { color: themeColors.textPrimary }]}>
                    {t('modules.mail.welcome.privacyNote')}
                  </Text>
                </View>
              </>
            }
            footerBlock={
              <Button
                title={t('modules.mail.welcome.understood')}
                onPress={handleDismiss}
                accessibilityLabel={t('modules.mail.welcome.understood')}
              />
            }
          />
        </LiquidGlassView>
      </View>
    </PanelAwareModal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.h2,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  stepsContainer: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stepEmoji: {
    fontSize: 24,
    width: 36,
    textAlign: 'center',
    marginTop: 2,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  stepDescription: {
    ...typography.small,
    marginTop: 2,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  privacyText: {
    ...typography.small,
    flex: 1,
  },
});
