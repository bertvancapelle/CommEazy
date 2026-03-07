/**
 * PlaylistImportModal — Welcome modal for importing Apple Music playlists
 *
 * Shown on first use of Apple Music module (when playlists exist).
 *
 * Welcome-only modal: Shows playlist count + "Overnemen" / "Overslaan" buttons.
 * After the user makes a choice, the modal closes immediately.
 * Import progress is tracked by the FloatingImportIndicator overlay.
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - Large clear text
 * - Simple two-button choice
 * - Haptic feedback
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { PanelAwareModal, HapticTouchable, Icon } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';

// ============================================================
// Types
// ============================================================

export interface PlaylistImportModalProps {
  visible: boolean;
  /** Number of playlists found in Apple Music */
  playlistCount: number;
  /** User taps "Overnemen" (import all) */
  onImport: () => void;
  /** User taps "Overslaan" (skip import) */
  onSkip: () => void;
}

// ============================================================
// Component
// ============================================================

export function PlaylistImportModal({
  visible,
  playlistCount,
  onImport,
  onSkip,
}: PlaylistImportModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();

  const handleImport = useCallback(() => {
    void triggerFeedback('success');
    onImport();
  }, [triggerFeedback, onImport]);

  const handleSkip = useCallback(() => {
    void triggerFeedback('tap');
    onSkip();
  }, [triggerFeedback, onSkip]);

  return (
    <PanelAwareModal
      visible={visible}
      animationType="slide"
      onRequestClose={onSkip}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modal, { backgroundColor: themeColors.background }]}>
          <View style={styles.content}>
            <Icon name="musical-notes" size={48} color={themeColors.primary} />
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {t('appleMusic.import.welcomeTitle', 'Welkom bij Apple Muziek')}
            </Text>
            <Text style={[styles.description, { color: themeColors.textSecondary }]}>
              {t('appleMusic.import.welcomeDescription',
                'We vonden {{count}} afspeellijsten in je Apple Music bibliotheek. Wil je ze overnemen zodat je ze hier ook kunt gebruiken?',
                { count: playlistCount })}
            </Text>

            {/* Import button (primary) */}
            <HapticTouchable
              style={[styles.primaryButton, { backgroundColor: themeColors.primary }]}
              onPress={handleImport}
              accessibilityRole="button"
              accessibilityLabel={t('appleMusic.import.importAll', 'Alles overnemen')}
            >
              <Icon name="download" size={22} color={themeColors.textOnPrimary} />
              <Text style={[styles.primaryButtonText, { color: themeColors.textOnPrimary }]}>
                {t('appleMusic.import.importAll', 'Alles overnemen')}
              </Text>
            </HapticTouchable>

            {/* Skip button (secondary) */}
            <HapticTouchable
              style={[styles.secondaryButton, { borderColor: themeColors.border }]}
              onPress={handleSkip}
              accessibilityRole="button"
              accessibilityLabel={t('appleMusic.import.skip', 'Overslaan')}
            >
              <Text style={[styles.secondaryButtonText, { color: themeColors.textSecondary }]}>
                {t('appleMusic.import.skip', 'Overslaan')}
              </Text>
            </HapticTouchable>

            {/* Bottom spacing */}
            <View style={{ height: spacing.xl }} />
          </View>
        </View>
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
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 26,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  primaryButtonText: {
    ...typography.button,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    ...typography.button,
  },
});
