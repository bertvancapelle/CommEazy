/**
 * SendConfirmationOverlay — Fullscreen success overlay after sending mail
 *
 * Shows a green checkmark with "Mail verstuurd!" text.
 * Auto-dismisses after 2 seconds, or immediately on tap.
 * Provides haptic success feedback on mount.
 *
 * Senior-inclusive design:
 * - Large checkmark icon (64pt)
 * - Clear text (typography.h2)
 * - Hint text explaining auto-dismiss
 * - Tap anywhere to dismiss immediately
 * - Haptic success feedback
 *
 * @see .claude/plans/MAIL_MODULE_IMPROVEMENTS.md (Fase 2.1)
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { typography, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useFeedback } from '@/hooks/useFeedback';
import { HapticTouchable, Icon } from '@/components';
import { LiquidGlassView } from '@/components/LiquidGlassView';

interface SendConfirmationOverlayProps {
  /** Called when the overlay should be dismissed (tap or auto-timeout) */
  onDismiss: () => void;
}

export function SendConfirmationOverlay({ onDismiss }: SendConfirmationOverlayProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { triggerHaptic } = useFeedback();

  // Haptic success feedback on mount
  useEffect(() => {
    triggerHaptic('success');
  }, [triggerHaptic]);

  // Auto-dismiss after 2 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <LiquidGlassView moduleId="mail" style={styles.overlay} cornerRadius={0}>
      <HapticTouchable
        style={styles.overlayTouchable}
        onPress={onDismiss}
        activeOpacity={1}
        hapticDisabled
        accessibilityRole="button"
        accessibilityLabel={t('modules.mail.compose.sentSuccess')}
        accessibilityHint={t('modules.mail.compose.sentSuccessHint')}
      >
        <View style={styles.content}>
        <View style={[styles.checkCircle, { backgroundColor: themeColors.success }]}>
          <Icon name="check" size={36} color="white" />
        </View>
        <Text style={[styles.title, { color: themeColors.textPrimary }]}>
          {t('modules.mail.compose.sentSuccess')}
        </Text>
        <Text style={[styles.hint, { color: themeColors.textSecondary }]}>
          {t('modules.mail.compose.sentSuccessHint')}
        </Text>
        </View>
      </HapticTouchable>
    </LiquidGlassView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  overlayTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.body,
    textAlign: 'center',
  },
});
