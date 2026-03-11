/**
 * PlaylistBrowserModal — Browse and import Apple Music playlists
 *
 * Shows a list of playlists from the user's Apple Music library.
 * User selects one or more playlists via checkboxes, then taps "Importeer"
 * to import them sequentially as MusicCollections (one-time snapshot).
 *
 * Already imported playlists show "✓ Geïmporteerd" badge and are not selectable.
 * Track count shown per playlist.
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - Large text and artwork
 * - Clear import status indicators
 * - Counter shows "X van Y geselecteerd"
 * - Haptic feedback on all interactions
 * - Loading and error states with human-friendly messages
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { PanelAwareModal, HapticTouchable, Icon, LoadingView , ScrollViewWithIndicator } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import type { AppleMusicPlaylist } from '@/contexts/AppleMusicContext';
import type { MusicCollection } from '@/services/music';
import type { LibraryPaginatedResponse } from '@/contexts/appleMusicContextTypes';

// ============================================================
// Types
// ============================================================

export interface PlaylistBrowserModalProps {
  visible: boolean;
  onClose: () => void;
  /** Fetch playlists from Apple Music library */
  getLibraryPlaylists: (limit?: number, offset?: number) => Promise<LibraryPaginatedResponse<AppleMusicPlaylist>>;
  /** All existing collections (to check import status) */
  collections: MusicCollection[];
  /** Whether an import is currently in progress */
  isImporting: boolean;
  /** Accent color for the module */
  accentColor: string;
  /** Called with array of selected playlists to import (parent handles actual import) */
  onImportBatch?: (playlists: Array<{ id: string; name: string }>) => void;
  /** @deprecated Use onImportBatch instead. Called when user taps a single playlist. */
  onImportStarted?: (playlistId: string, playlistName: string) => void;
}

// ============================================================
// Component
// ============================================================

export function PlaylistBrowserModal({
  visible,
  onClose,
  getLibraryPlaylists,
  collections,
  isImporting,
  accentColor,
  onImportBatch,
  onImportStarted,
}: PlaylistBrowserModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();

  // State
  const [playlists, setPlaylists] = useState<AppleMusicPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Set of already-imported playlist IDs
  const importedPlaylistIds = useMemo(() => {
    return new Set(
      collections
        .filter(c => c.sourcePlaylistId)
        .map(c => c.sourcePlaylistId!),
    );
  }, [collections]);

  // Count of importable (not yet imported) playlists
  const importableCount = useMemo(() => {
    return playlists.filter(p => !importedPlaylistIds.has(p.id)).length;
  }, [playlists, importedPlaylistIds]);

  // Fetch playlists when modal opens
  useEffect(() => {
    if (!visible || hasLoaded) return;

    const fetchPlaylists = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch all playlists (up to 200)
        const response = await getLibraryPlaylists(200, 0);
        setPlaylists(response.items);
        setHasLoaded(true);
      } catch (err) {
        console.error('[PlaylistBrowserModal] Failed to load playlists', err);
        setError(t('appleMusic.import.loadError', 'Kon afspeellijsten niet laden'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlaylists();
  }, [visible, hasLoaded, getLibraryPlaylists, t]);

  // Reset when modal closes
  useEffect(() => {
    if (!visible) {
      setHasLoaded(false);
      setPlaylists([]);
      setError(null);
      setSelectedIds(new Set());
    }
  }, [visible]);

  // Toggle selection of a playlist
  const handleToggleSelect = useCallback((playlistId: string) => {
    if (isImporting) return;
    if (importedPlaylistIds.has(playlistId)) return;

    void triggerFeedback('tap');

    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(playlistId)) {
        next.delete(playlistId);
      } else {
        next.add(playlistId);
      }
      return next;
    });
  }, [isImporting, importedPlaylistIds, triggerFeedback]);

  // Select all importable playlists
  const handleSelectAll = useCallback(() => {
    if (isImporting) return;
    void triggerFeedback('tap');

    if (selectedIds.size === importableCount) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all importable
      const allImportable = new Set(
        playlists
          .filter(p => !importedPlaylistIds.has(p.id))
          .map(p => p.id),
      );
      setSelectedIds(allImportable);
    }
  }, [isImporting, triggerFeedback, selectedIds.size, importableCount, playlists, importedPlaylistIds]);

  // Handle import of selected playlists
  const handleImportSelected = useCallback(() => {
    if (selectedIds.size === 0 || isImporting) return;

    void triggerFeedback('success');

    // Build ordered list of selected playlists
    const batch = playlists
      .filter(p => selectedIds.has(p.id))
      .map(p => ({ id: p.id, name: p.name }));

    // Close modal — floating indicator tracks progress
    onClose();

    if (onImportBatch) {
      onImportBatch(batch);
    } else if (onImportStarted && batch.length > 0) {
      // Fallback: import first one via legacy prop
      onImportStarted(batch[0].id, batch[0].name);
    }
  }, [selectedIds, isImporting, triggerFeedback, playlists, onClose, onImportBatch, onImportStarted]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setHasLoaded(false);
    setError(null);
  }, []);

  return (
    <PanelAwareModal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modal, { backgroundColor: themeColors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {t('appleMusic.import.browserTitle', 'Afspeellijsten importeren')}
            </Text>
            <HapticTouchable
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close', 'Sluiten')}
            >
              <Icon name="close" size={24} color={themeColors.textSecondary} />
            </HapticTouchable>
          </View>

          {/* Description */}
          <Text style={[styles.description, { color: themeColors.textSecondary }]}>
            {t('appleMusic.import.browserDescription', 'Selecteer de afspeellijsten die je wilt importeren. Je nummers worden opgeslagen als favorieten.')}
          </Text>

          {/* Content */}
          {isLoading && (
            <LoadingView />
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Icon name="warning" size={32} color={themeColors.error || '#D32F2F'} />
              <Text style={[styles.errorText, { color: themeColors.textPrimary }]}>
                {error}
              </Text>
              <HapticTouchable
                style={[styles.retryButton, { backgroundColor: accentColor }]}
                onPress={handleRetry}
                accessibilityRole="button"
                accessibilityLabel={t('common.tryAgain', 'Probeer opnieuw')}
              >
                <Text style={styles.retryButtonText}>
                  {t('common.tryAgain', 'Probeer opnieuw')}
                </Text>
              </HapticTouchable>
            </View>
          )}

          {!isLoading && !error && playlists.length === 0 && hasLoaded && (
            <View style={styles.emptyContainer}>
              <Icon name="musical-notes" size={48} color={themeColors.textSecondary} />
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                {t('appleMusic.import.noPlaylists', 'Geen afspeellijsten gevonden in je Apple Music bibliotheek.')}
              </Text>
            </View>
          )}

          {!isLoading && !error && playlists.length > 0 && (
            <>
              {/* Select all + counter bar */}
              <View style={[styles.selectionBar, { borderBottomColor: themeColors.border }]}>
                {importableCount > 0 && (
                  <HapticTouchable
                    style={styles.selectAllButton}
                    onPress={handleSelectAll}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selectedIds.size === importableCount }}
                    accessibilityLabel={
                      selectedIds.size === importableCount
                        ? t('appleMusic.import.deselectAll', 'Alles deselecteren')
                        : t('appleMusic.import.selectAll', 'Alles selecteren')
                    }
                  >
                    <View style={[
                      styles.checkbox,
                      {
                        borderColor: selectedIds.size === importableCount ? accentColor : themeColors.border,
                        backgroundColor: selectedIds.size === importableCount ? accentColor : 'transparent',
                      },
                    ]}>
                      {selectedIds.size === importableCount && (
                        <Icon name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>
                    <Text style={[styles.selectAllText, { color: themeColors.textPrimary }]}>
                      {selectedIds.size === importableCount
                        ? t('appleMusic.import.deselectAll', 'Alles deselecteren')
                        : t('appleMusic.import.selectAll', 'Alles selecteren')
                      }
                    </Text>
                  </HapticTouchable>
                )}
                {selectedIds.size > 0 && (
                  <Text style={[styles.selectionCounter, { color: themeColors.textSecondary }]}>
                    {t('appleMusic.import.selectedCount', '{{selected}} van {{total}} geselecteerd', {
                      selected: selectedIds.size,
                      total: importableCount,
                    })}
                  </Text>
                )}
              </View>

              <ScrollViewWithIndicator
                style={styles.playlistList}
                contentContainerStyle={styles.playlistListContent}
              >
                {playlists.map((playlist) => {
                  const isImported = importedPlaylistIds.has(playlist.id);
                  const isSelected = selectedIds.has(playlist.id);

                  return (
                    <HapticTouchable
                      key={playlist.id}
                      style={[
                        styles.playlistRow,
                        {
                          backgroundColor: isSelected
                            ? accentColor + '15'
                            : themeColors.surface,
                          borderColor: isSelected ? accentColor : themeColors.border,
                          opacity: isImporting && !isImported ? 0.5 : 1,
                        },
                      ]}
                      onPress={() => handleToggleSelect(playlist.id)}
                      hapticDisabled={isImported || isImporting}
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: isImported || isSelected,
                        disabled: isImported || isImporting,
                      }}
                      accessibilityLabel={
                        isImported
                          ? t('appleMusic.import.alreadyImported', '{{name}} — al geïmporteerd', { name: playlist.name })
                          : isSelected
                            ? t('appleMusic.import.selectedPlaylist', '{{name}} — geselecteerd', { name: playlist.name })
                            : t('appleMusic.import.tapToSelect', '{{name}} — tik om te selecteren', { name: playlist.name })
                      }
                    >
                      {/* Checkbox or imported badge */}
                      {isImported ? (
                        <View style={[styles.importedCheckbox, { backgroundColor: '#1B5E20' }]}>
                          <Icon name="checkmark" size={16} color="#FFFFFF" />
                        </View>
                      ) : (
                        <View style={[
                          styles.checkbox,
                          {
                            borderColor: isSelected ? accentColor : themeColors.border,
                            backgroundColor: isSelected ? accentColor : 'transparent',
                          },
                        ]}>
                          {isSelected && (
                            <Icon name="checkmark" size={16} color="#FFFFFF" />
                          )}
                        </View>
                      )}

                      {/* Artwork */}
                      <View style={[styles.playlistArtwork, { backgroundColor: accentColor + '20' }]}>
                        {playlist.artworkUrl ? (
                          <Image
                            source={{ uri: playlist.artworkUrl.replace('{w}', '120').replace('{h}', '120') }}
                            style={styles.playlistArtworkImage}
                          />
                        ) : (
                          <Icon name="musical-notes" size={28} color={accentColor} />
                        )}
                      </View>

                      {/* Name + info */}
                      <View style={styles.playlistInfo}>
                        <Text
                          style={[styles.playlistName, { color: themeColors.textPrimary }]}
                          numberOfLines={2}
                        >
                          {playlist.name}
                        </Text>
                        {playlist.curatorName ? (
                          <Text
                            style={[styles.playlistCurator, { color: themeColors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {playlist.curatorName}
                          </Text>
                        ) : null}
                        {playlist.trackCount != null && playlist.trackCount > 0 ? (
                          <Text
                            style={[styles.playlistTrackCount, { color: themeColors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {t('appleMusic.import.trackCount', '{{count}} nummers', { count: playlist.trackCount })}
                          </Text>
                        ) : null}
                      </View>

                      {/* Imported badge text */}
                      {isImported && (
                        <View style={[styles.importedBadge, { backgroundColor: '#1B5E20' }]}>
                          <Text style={styles.importedBadgeText}>
                            {t('appleMusic.import.imported', 'Geïmporteerd')}
                          </Text>
                        </View>
                      )}
                    </HapticTouchable>
                  );
                })}
              </ScrollViewWithIndicator>

              {/* Import button — fixed at bottom */}
              {selectedIds.size > 0 && (
                <View style={[styles.importButtonContainer, { borderTopColor: themeColors.border }]}>
                  <HapticTouchable
                    style={[styles.importButton, { backgroundColor: accentColor }]}
                    onPress={handleImportSelected}
                    hapticDisabled={isImporting}
                    accessibilityRole="button"
                    accessibilityLabel={t('appleMusic.import.importSelected', 'Importeer {{count}} afspeellijsten', { count: selectedIds.size })}
                  >
                    <Icon name="download" size={22} color="#FFFFFF" />
                    <Text style={styles.importButtonText}>
                      {selectedIds.size === 1
                        ? t('appleMusic.import.importOne', 'Importeer 1 afspeellijst')
                        : t('appleMusic.import.importMultiple', 'Importeer {{count}} afspeellijsten', { count: selectedIds.size })
                      }
                    </Text>
                  </HapticTouchable>
                </View>
              )}
            </>
          )}
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
    height: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    ...typography.h3,
    fontWeight: '700',
    flex: 1,
  },
  closeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    ...typography.body,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    lineHeight: 24,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    gap: spacing.sm,
  },
  selectAllText: {
    ...typography.body,
    fontWeight: '600',
  },
  selectionCounter: {
    ...typography.small,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  importedCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistList: {
    flex: 1,
  },
  playlistListContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.comfortable,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  playlistArtwork: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  playlistArtworkImage: {
    width: 56,
    height: 56,
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    ...typography.body,
    fontWeight: '600',
  },
  playlistCurator: {
    ...typography.small,
    marginTop: 2,
  },
  playlistTrackCount: {
    ...typography.small,
    marginTop: 2,
  },
  importedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  importedBadgeText: {
    ...typography.small,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  importButtonContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  importButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  errorContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorText: {
    ...typography.body,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 24,
  },
});
