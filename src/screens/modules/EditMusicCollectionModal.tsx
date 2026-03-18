/**
 * EditMusicCollectionModal — Modal for managing an existing music collection
 *
 * Triggered by long-press on a collection chip.
 *
 * Actions:
 * - Rename collection
 * - Delete collection (with Alert.alert confirmation)
 *
 * Simplified version of EditGroupModal — no emoji, no member management.
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - Large clear action buttons
 * - Confirmation before destructive action
 * - Haptic feedback
 *
 * @see EditGroupModal.tsx (reference pattern)
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { PanelAwareModal, HapticTouchable, Icon } from '@/components';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { ModalLayout } from '@/components/ModalLayout';
import { VoiceTextInput } from '@/components/VoiceTextInput';
import { useFeedback } from '@/hooks/useFeedback';
import type { MusicCollection } from '@/services/music';

// ============================================================
// Types
// ============================================================

export interface EditMusicCollectionModalProps {
  visible: boolean;
  collection: MusicCollection | null;
  onClose: () => void;
  onRename: (collectionId: string, newName: string) => void;
  onDelete: (collectionId: string) => void;
}

// ============================================================
// Component
// ============================================================

export function EditMusicCollectionModal({
  visible,
  collection,
  onClose,
  onRename,
  onDelete,
}: EditMusicCollectionModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();

  const [editName, setEditName] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Sync state when collection changes
  React.useEffect(() => {
    if (collection) {
      setEditName(collection.name);
      setHasChanges(false);
    }
  }, [collection]);

  const handleSave = useCallback(() => {
    if (!collection) return;

    if (editName.trim() !== collection.name && editName.trim().length > 0) {
      onRename(collection.id, editName.trim());
    }

    void triggerFeedback('success');
    onClose();
  }, [collection, editName, onRename, triggerFeedback, onClose]);

  const handleDelete = useCallback(() => {
    if (!collection) return;

    void triggerFeedback('warning');
    Alert.alert(
      t('appleMusic.collections.deleteCollection', 'Verzameling verwijderen'),
      t('appleMusic.collections.deleteCollectionConfirm',
        'Weet je zeker dat je de verzameling \'{{name}}\' wilt verwijderen? De nummers blijven in je favorieten.',
        { name: collection.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Verwijderen'),
          style: 'destructive',
          onPress: () => {
            onDelete(collection.id);
            onClose();
          },
        },
      ],
    );
  }, [collection, t, triggerFeedback, onDelete, onClose]);

  const handleNameChange = useCallback((text: string) => {
    setEditName(text);
    setHasChanges(true);
  }, []);

  const isValid = editName.trim().length > 0;

  if (!collection) return null;

  return (
    <PanelAwareModal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <LiquidGlassView moduleId="appleMusic" style={styles.modal} cornerRadius={borderRadius.lg}>
          <ModalLayout
            headerBlock={
              <View style={[styles.header, { borderBottomColor: themeColors.divider }]}>
                <HapticTouchable
                  style={styles.closeButton}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.cancel')}
                >
                  <Icon name="close" size={24} color={themeColors.textSecondary} />
                </HapticTouchable>

                <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
                  {collection.name}
                </Text>

                <HapticTouchable
                  style={[
                    styles.saveButton,
                    {
                      backgroundColor: hasChanges && isValid
                        ? themeColors.primary
                        : themeColors.border,
                    },
                  ]}
                  onPress={handleSave}
                  disabled={!hasChanges || !isValid}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.save', 'Opslaan')}
                  accessibilityState={{ disabled: !hasChanges || !isValid }}
                >
                  <Text
                    style={[
                      styles.saveButtonText,
                      {
                        color: hasChanges && isValid
                          ? themeColors.textOnPrimary
                          : themeColors.textTertiary,
                      },
                    ]}
                  >
                    {t('common.save', 'Opslaan')}
                  </Text>
                </HapticTouchable>
              </View>
            }
            contentBlock={
              <View style={styles.content}>
                {/* Collection name edit */}
                <VoiceTextInput
                  voiceId="edit-collection-name"
                  label={t('appleMusic.collections.rename', 'Hernoemen')}
                  value={editName}
                  onChangeText={handleNameChange}
                  maxLength={50}
                />

                {/* Song count info */}
                <Text style={[styles.songCount, { color: themeColors.textSecondary }]}>
                  {t('appleMusic.collections.songCount', '{{count}} nummers', {
                    count: collection.songCatalogIds.length,
                  })}
                </Text>

                {/* Delete collection button */}
                <View style={styles.deleteSection}>
                  <HapticTouchable
                    style={[styles.deleteButton, { borderColor: themeColors.error }]}
                    onPress={handleDelete}
                    accessibilityRole="button"
                    accessibilityLabel={t('appleMusic.collections.deleteCollection', 'Verzameling verwijderen')}
                  >
                    <Icon name="trash" size={20} color={themeColors.error} />
                    <Text style={[styles.deleteButtonText, { color: themeColors.error }]}>
                      {t('appleMusic.collections.deleteCollection', 'Verzameling verwijderen')}
                    </Text>
                  </HapticTouchable>
                </View>

                {/* Bottom spacing */}
                <View style={{ height: spacing.xl }} />
              </View>
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
  saveButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    ...typography.button,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  songCount: {
    ...typography.body,
    marginTop: spacing.md,
  },
  deleteSection: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    minHeight: touchTargets.minimum,
  },
  deleteButtonText: {
    ...typography.button,
  },
});
