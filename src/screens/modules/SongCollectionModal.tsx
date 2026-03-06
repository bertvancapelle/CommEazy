/**
 * SongCollectionModal — Modal for assigning a song to collections
 *
 * Triggered by tapping the folder icon on a song item.
 *
 * Shows a list of all collections with checkboxes:
 * - ☑ (in collection) — tap to remove
 * - ☐ (not in collection) — tap to add
 * - "Nieuwe verzameling" at the bottom — creates new collection and adds song
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - Clear check/uncheck indicators
 * - Haptic feedback
 * - Simple single-purpose modal
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { PanelAwareModal, HapticTouchable, Icon } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import type { MusicCollection } from '@/services/music';

// ============================================================
// Types
// ============================================================

export interface SongCollectionModalProps {
  visible: boolean;
  /** The catalog ID of the song being managed */
  songCatalogId: string | null;
  /** Song title for display */
  songTitle: string;
  /** All available collections */
  collections: MusicCollection[];
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback to add song to a collection */
  onAddToCollection: (collectionId: string, catalogId: string) => void;
  /** Callback to remove song from a collection */
  onRemoveFromCollection: (collectionId: string, catalogId: string) => void;
  /** Callback to create a new collection (opens CreateMusicCollectionModal) */
  onCreateCollection: () => void;
}

// ============================================================
// Component
// ============================================================

export function SongCollectionModal({
  visible,
  songCatalogId,
  songTitle,
  collections,
  onClose,
  onAddToCollection,
  onRemoveFromCollection,
  onCreateCollection,
}: SongCollectionModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();

  // Track which collections contain this song (local state for immediate UI feedback)
  const [membershipMap, setMembershipMap] = useState<Record<string, boolean>>({});

  // Rebuild membership map when collections or song changes
  useEffect(() => {
    if (!songCatalogId) return;

    const map: Record<string, boolean> = {};
    for (const collection of collections) {
      map[collection.id] = collection.songCatalogIds.includes(songCatalogId);
    }
    setMembershipMap(map);
  }, [collections, songCatalogId]);

  const handleToggle = useCallback((collectionId: string) => {
    if (!songCatalogId) return;

    const isCurrentlyMember = membershipMap[collectionId] ?? false;

    void triggerFeedback('tap');

    if (isCurrentlyMember) {
      onRemoveFromCollection(collectionId, songCatalogId);
      setMembershipMap(prev => ({ ...prev, [collectionId]: false }));
    } else {
      onAddToCollection(collectionId, songCatalogId);
      setMembershipMap(prev => ({ ...prev, [collectionId]: true }));
    }
  }, [songCatalogId, membershipMap, triggerFeedback, onAddToCollection, onRemoveFromCollection]);

  const handleCreateNew = useCallback(() => {
    void triggerFeedback('tap');
    onClose();
    // Small delay to let this modal close before opening create modal
    setTimeout(onCreateCollection, 300);
  }, [triggerFeedback, onClose, onCreateCollection]);

  if (!songCatalogId) return null;

  return (
    <PanelAwareModal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modal, { backgroundColor: themeColors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: themeColors.divider }]}>
            <HapticTouchable
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close', 'Sluiten')}
            >
              <Icon name="close" size={24} color={themeColors.textSecondary} />
            </HapticTouchable>

            <View style={styles.headerCenter}>
              <Text
                style={[styles.headerTitle, { color: themeColors.textPrimary }]}
                numberOfLines={1}
              >
                {t('appleMusic.collections.addToCollection', 'Toevoegen aan verzameling')}
              </Text>
              <Text
                style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}
                numberOfLines={1}
              >
                {songTitle}
              </Text>
            </View>

            {/* Spacer to balance header */}
            <View style={styles.closeButton} />
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Collection list */}
            {collections.length > 0 ? (
              collections.map(collection => {
                const isMember = membershipMap[collection.id] ?? false;

                return (
                  <HapticTouchable
                    key={collection.id}
                    style={[
                      styles.collectionRow,
                      {
                        backgroundColor: isMember
                          ? `${themeColors.primary}10`
                          : themeColors.surface,
                        borderBottomColor: themeColors.divider,
                      },
                    ]}
                    onPress={() => handleToggle(collection.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isMember }}
                    accessibilityLabel={`${collection.name}, ${collection.songCatalogIds.length} ${t('appleMusic.collections.songs', 'nummers')}`}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: isMember ? themeColors.primary : 'transparent',
                          borderColor: isMember ? themeColors.primary : themeColors.border,
                        },
                      ]}
                    >
                      {isMember && (
                        <Icon name="checkmark" size={16} color={themeColors.textOnPrimary} />
                      )}
                    </View>
                    <View style={styles.collectionInfo}>
                      <Text
                        style={[styles.collectionName, { color: themeColors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {collection.name}
                      </Text>
                      <Text style={[styles.collectionCount, { color: themeColors.textSecondary }]}>
                        {t('appleMusic.collections.songCount', '{{count}} nummers', {
                          count: collection.songCatalogIds.length,
                        })}
                      </Text>
                    </View>
                  </HapticTouchable>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                  {t('appleMusic.collections.noCollections', 'Je hebt nog geen verzamelingen. Maak er een aan!')}
                </Text>
              </View>
            )}

            {/* "Nieuwe verzameling" button */}
            <HapticTouchable
              style={[
                styles.createRow,
                { borderBottomColor: themeColors.divider },
              ]}
              onPress={handleCreateNew}
              accessibilityRole="button"
              accessibilityLabel={t('appleMusic.collections.createCollection', 'Nieuwe verzameling')}
            >
              <View style={[styles.createIcon, { backgroundColor: `${themeColors.primary}20` }]}>
                <Icon name="add" size={20} color={themeColors.primary} />
              </View>
              <Text style={[styles.createText, { color: themeColors.primary }]}>
                {t('appleMusic.collections.createCollection', 'Nieuwe verzameling')}
              </Text>
            </HapticTouchable>

            {/* Bottom spacing */}
            <View style={{ height: spacing.xl }} />
          </ScrollView>
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
    maxHeight: '70%',
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  headerSubtitle: {
    ...typography.label,
    marginTop: 2,
  },
  content: {
    paddingTop: spacing.sm,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTargets.minimum,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collectionInfo: {
    flex: 1,
  },
  collectionName: {
    ...typography.body,
  },
  collectionCount: {
    ...typography.label,
    marginTop: 2,
  },
  emptyState: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTargets.minimum,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  createIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createText: {
    ...typography.body,
    fontWeight: '600',
  },
});
