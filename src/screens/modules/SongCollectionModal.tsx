/**
 * SongCollectionModal — Modal for assigning a song to lists
 *
 * Triggered by tapping the heart icon on a song item in search/detail context.
 *
 * Shows a list of all lists with checkboxes:
 * - ☑ (in list) — tap to remove
 * - ☐ (not in list) — tap to add
 * - "+ Nieuwe lijst" section with inline TextInput for creating new lists
 * - "Opslaan" button at the bottom to close
 *
 * Auto-favorite: when a song is added to any list, it's automatically
 * saved as a MusicFavorite (idempotent).
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - Clear check/uncheck indicators
 * - Haptic feedback
 * - Inline list creation (no navigation away)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
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
  /** Extra song data for auto-favorite */
  songArtistName?: string;
  songArtworkUrl?: string | null;
  songAlbumTitle?: string;
  /** All available collections */
  collections: MusicCollection[];
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback to add song to a collection */
  onAddToCollection: (collectionId: string, catalogId: string) => void;
  /** Callback to remove song from a collection */
  onRemoveFromCollection: (collectionId: string, catalogId: string) => void;
  /** Inline creation: creates list and returns it */
  onCreateCollectionInline: (name: string) => Promise<MusicCollection | undefined>;
  /** Auto-favorite callback: called when song is added to any list */
  onAutoFavorite: (song: {
    catalogId: string;
    title: string;
    artistName: string;
    artworkUrl: string | null;
    albumTitle?: string;
  }) => void;
}

// ============================================================
// Component
// ============================================================

export function SongCollectionModal({
  visible,
  songCatalogId,
  songTitle,
  songArtistName = '',
  songArtworkUrl = null,
  songAlbumTitle = '',
  collections,
  onClose,
  onAddToCollection,
  onRemoveFromCollection,
  onCreateCollectionInline,
  onAutoFavorite,
}: SongCollectionModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();

  // Track which collections contain this song (local state for immediate UI feedback)
  const [membershipMap, setMembershipMap] = useState<Record<string, boolean>>({});

  // Inline creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Rebuild membership map when collections or song changes
  useEffect(() => {
    if (!songCatalogId) return;

    const map: Record<string, boolean> = {};
    for (const collection of collections) {
      map[collection.id] = collection.songCatalogIds.includes(songCatalogId);
    }
    setMembershipMap(map);
  }, [collections, songCatalogId]);

  // Show create form by default when there are no lists
  useEffect(() => {
    if (visible && collections.length === 0) {
      setShowCreateForm(true);
    }
  }, [visible, collections.length]);

  // Reset inline creation state when modal closes
  useEffect(() => {
    if (!visible) {
      setShowCreateForm(false);
      setNewListName('');
      setIsCreating(false);
    }
  }, [visible]);

  const autoFavorite = useCallback(() => {
    if (!songCatalogId) return;
    onAutoFavorite({
      catalogId: songCatalogId,
      title: songTitle,
      artistName: songArtistName,
      artworkUrl: songArtworkUrl ?? null,
      albumTitle: songAlbumTitle,
    });
  }, [songCatalogId, songTitle, songArtistName, songArtworkUrl, songAlbumTitle, onAutoFavorite]);

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
      // Auto-favorite when adding to a list
      autoFavorite();
    }
  }, [songCatalogId, membershipMap, triggerFeedback, onAddToCollection, onRemoveFromCollection, autoFavorite]);

  const handleCreateAndAdd = useCallback(async () => {
    if (!songCatalogId || !newListName.trim()) return;

    setIsCreating(true);
    void triggerFeedback('tap');

    try {
      const created = await onCreateCollectionInline(newListName.trim());
      if (created) {
        // Add song to the newly created list
        onAddToCollection(created.id, songCatalogId);
        setMembershipMap(prev => ({ ...prev, [created.id]: true }));
        // Auto-favorite
        autoFavorite();
        // Reset create form
        setNewListName('');
        setShowCreateForm(false);
      }
    } finally {
      setIsCreating(false);
    }
  }, [songCatalogId, newListName, triggerFeedback, onCreateCollectionInline, onAddToCollection, autoFavorite]);

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
                {t('appleMusic.collections.addToCollection', 'Toevoegen aan...')}
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
            keyboardShouldPersistTaps="handled"
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
                  {t('appleMusic.collections.noListsYet', 'Je hebt nog geen lijsten')}
                </Text>
              </View>
            )}

            {/* "+ Nieuwe lijst" section */}
            {!showCreateForm ? (
              <HapticTouchable
                style={[
                  styles.createRow,
                  { borderBottomColor: themeColors.divider },
                ]}
                onPress={() => {
                  void triggerFeedback('tap');
                  setShowCreateForm(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('appleMusic.collections.createCollection', 'Nieuwe lijst')}
              >
                <View style={[styles.createIcon, { backgroundColor: `${themeColors.primary}20` }]}>
                  <Icon name="add" size={20} color={themeColors.primary} />
                </View>
                <Text style={[styles.createText, { color: themeColors.primary }]}>
                  {t('appleMusic.collections.createCollection', 'Nieuwe lijst')}
                </Text>
              </HapticTouchable>
            ) : (
              <View style={[styles.createForm, { borderBottomColor: themeColors.divider }]}>
                <TextInput
                  style={[
                    styles.createInput,
                    {
                      color: themeColors.textPrimary,
                      borderColor: themeColors.border,
                      backgroundColor: themeColors.surface,
                    },
                  ]}
                  placeholder={t('appleMusic.collections.newListName', 'Naam van nieuwe lijst')}
                  placeholderTextColor={themeColors.textSecondary}
                  value={newListName}
                  onChangeText={setNewListName}
                  autoFocus
                  maxLength={50}
                  returnKeyType="done"
                  onSubmitEditing={handleCreateAndAdd}
                />
                <HapticTouchable
                  style={[
                    styles.createAndAddButton,
                    {
                      backgroundColor: newListName.trim() ? themeColors.primary : themeColors.border,
                    },
                  ]}
                  onPress={handleCreateAndAdd}
                  disabled={!newListName.trim() || isCreating}
                  accessibilityRole="button"
                  accessibilityLabel={t('appleMusic.collections.createAndAdd', 'Maak aan + voeg toe')}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color={themeColors.textOnPrimary} />
                  ) : (
                    <Text
                      style={[
                        styles.createAndAddText,
                        { color: newListName.trim() ? themeColors.textOnPrimary : themeColors.textSecondary },
                      ]}
                    >
                      {t('appleMusic.collections.createAndAdd', 'Maak aan + voeg toe')}
                    </Text>
                  )}
                </HapticTouchable>
              </View>
            )}

            {/* Bottom spacing */}
            <View style={{ height: spacing.md }} />
          </ScrollView>

          {/* Save/Close button */}
          <View style={[styles.footer, { borderTopColor: themeColors.divider }]}>
            <HapticTouchable
              style={[styles.saveButton, { backgroundColor: themeColors.primary }]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('appleMusic.collections.save', 'Opslaan')}
            >
              <Text style={[styles.saveButtonText, { color: themeColors.textOnPrimary }]}>
                {t('appleMusic.collections.save', 'Opslaan')}
              </Text>
            </HapticTouchable>
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
  createForm: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  createInput: {
    ...typography.body,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTargets.minimum,
  },
  createAndAddButton: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createAndAddText: {
    ...typography.body,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  saveButton: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    ...typography.body,
    fontWeight: '700',
  },
});
