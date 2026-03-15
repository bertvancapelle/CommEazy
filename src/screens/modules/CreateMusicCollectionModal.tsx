/**
 * CreateMusicCollectionModal — Modal for creating a new music collection
 *
 * Simplified version of CreateGroupModal:
 * - Name input only (no emoji, no member selection)
 * - PanelAwareModal bottom sheet
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - Large text labels
 * - Simple single-step flow
 * - Haptic feedback
 *
 * @see CreateGroupModal.tsx (reference pattern)
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { PanelAwareModal, HapticTouchable, Icon } from '@/components';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { VoiceTextInput } from '@/components/VoiceTextInput';
import { useFeedback } from '@/hooks/useFeedback';

// ============================================================
// Types
// ============================================================

export interface CreateMusicCollectionModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

// ============================================================
// Component
// ============================================================

export function CreateMusicCollectionModal({
  visible,
  onClose,
  onCreate,
}: CreateMusicCollectionModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();

  const [collectionName, setCollectionName] = useState('');

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setCollectionName('');
    onClose();
  }, [onClose]);

  const handleCreate = useCallback(() => {
    if (collectionName.trim().length === 0) return;
    void triggerFeedback('success');
    onCreate(collectionName.trim());
    setCollectionName('');
  }, [collectionName, onCreate, triggerFeedback]);

  const isValid = collectionName.trim().length > 0;

  return (
    <PanelAwareModal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <LiquidGlassView moduleId="appleMusic" style={styles.modal} cornerRadius={borderRadius.lg}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: themeColors.divider }]}>
            <HapticTouchable
              style={styles.closeButton}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Icon name="close" size={24} color={themeColors.textSecondary} />
            </HapticTouchable>

            <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
              {t('appleMusic.collections.createCollection', 'Nieuwe verzameling')}
            </Text>

            <HapticTouchable
              style={[
                styles.createButton,
                {
                  backgroundColor: isValid ? themeColors.primary : themeColors.border,
                },
              ]}
              onPress={handleCreate}
              disabled={!isValid}
              accessibilityRole="button"
              accessibilityLabel={t('common.create', 'Aanmaken')}
              accessibilityState={{ disabled: !isValid }}
            >
              <Text
                style={[
                  styles.createButtonText,
                  { color: isValid ? themeColors.textOnPrimary : themeColors.textTertiary },
                ]}
              >
                {t('common.create', 'Aanmaken')}
              </Text>
            </HapticTouchable>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <VoiceTextInput
              voiceId="collection-name"
              label={t('appleMusic.collections.collectionName', 'Naam')}
              value={collectionName}
              onChangeText={setCollectionName}
              placeholder={t('appleMusic.collections.collectionNamePlaceholder', 'bijv. Feestje, Relaxen...')}
              maxLength={50}
              autoFocus
            />

            {/* Bottom spacing */}
            <View style={{ height: spacing.xl }} />
          </View>
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
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    minHeight: touchTargets.minimum,
  },
  closeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h3,
    flex: 1,
    textAlign: 'center',
  },
  createButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    ...typography.button,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
});
