/**
 * AppleMusicSettingsScreen — Apple Music import management
 *
 * Shows imported playlists (with name + import date) and
 * allows importing not-yet-imported playlists via checkboxes.
 *
 * After the first import in the Music module, further imports
 * are managed here in Settings.
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - Clear labels and import status
 * - Haptic feedback on all interactions
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useMusicCollections } from '@/hooks/useMusicCollections';
import { useAppleMusicContextSafe } from '@/contexts/AppleMusicContext';
import { usePlaylistImportContext } from '@/contexts/PlaylistImportContext';
import { Icon, HapticTouchable, LoadingView , ScrollViewWithIndicator} from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import type { AppleMusicPlaylist } from '@/contexts/AppleMusicContext';

// ============================================================
// Component
// ============================================================

export function AppleMusicSettingsScreen() {
  const { t } = useTranslation();
  const themeColors = useColors();
  const isFocused = useIsFocused();
  const musicCollections = useMusicCollections();
  const appleMusicCtx = useAppleMusicContextSafe();
  const playlistImportCtx = usePlaylistImportContext();
  const { triggerFeedback } = useFeedback();

  // State for Apple Music library playlists
  const [libraryPlaylists, setLibraryPlaylists] = useState<AppleMusicPlaylist[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [hasLoadedPlaylists, setHasLoadedPlaylists] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Imported collections (those with sourcePlaylistId)
  const importedCollections = useMemo(() => {
    return musicCollections.collections
      .filter(c => !!c.sourcePlaylistId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [musicCollections.collections]);

  // Set of imported playlist IDs for quick lookup
  const importedPlaylistIds = useMemo(() => {
    return new Set(importedCollections.map(c => c.sourcePlaylistId!));
  }, [importedCollections]);

  // Not-yet-imported playlists
  const unimportedPlaylists = useMemo(() => {
    return libraryPlaylists.filter(p => !importedPlaylistIds.has(p.id));
  }, [libraryPlaylists, importedPlaylistIds]);

  // Load library playlists when screen is focused
  useEffect(() => {
    if (!isFocused || hasLoadedPlaylists || !appleMusicCtx) return;

    const fetchPlaylists = async () => {
      setIsLoadingPlaylists(true);
      setLoadError(null);
      try {
        const response = await appleMusicCtx.getLibraryPlaylists(200, 0);
        setLibraryPlaylists(response.items);
        setHasLoadedPlaylists(true);
      } catch (err) {
        console.error('[AppleMusicSettingsScreen] Failed to load playlists');
        setLoadError(t('appleMusicSettings.loadError'));
      } finally {
        setIsLoadingPlaylists(false);
      }
    };

    fetchPlaylists();
  }, [isFocused, hasLoadedPlaylists, appleMusicCtx, t]);

  // Reset loaded state when navigating away
  useEffect(() => {
    if (!isFocused) {
      setHasLoadedPlaylists(false);
      setSelectedIds(new Set());
    }
  }, [isFocused]);

  // Toggle selection
  const handleToggleSelect = useCallback((playlistId: string) => {
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
  }, [triggerFeedback]);

  // Select all unimported
  const handleSelectAll = useCallback(() => {
    void triggerFeedback('tap');
    if (selectedIds.size === unimportedPlaylists.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unimportedPlaylists.map(p => p.id)));
    }
  }, [triggerFeedback, selectedIds.size, unimportedPlaylists]);

  // Import selected playlists
  const handleImportSelected = useCallback(async () => {
    if (selectedIds.size === 0 || !appleMusicCtx) return;

    void triggerFeedback('success');

    const batch = libraryPlaylists
      .filter(p => selectedIds.has(p.id))
      .map(p => ({ id: p.id, name: p.name }));

    playlistImportCtx.setImporting(true);

    let totalSongsAdded = 0;
    let totalFailures = 0;

    for (let i = 0; i < batch.length; i++) {
      const { id: playlistId, name: playlistName } = batch[i];

      playlistImportCtx.updateProgress({
        current: i + 1,
        total: batch.length,
        currentName: playlistName,
      });

      try {
        const result = await musicCollections.startSingleImport(
          playlistId,
          playlistName,
          appleMusicCtx.getPlaylistDetails,
        );
        totalSongsAdded += result.songsAdded;
        totalFailures += result.failures;
      } catch (error) {
        console.error('[AppleMusicSettingsScreen] Import failed for', playlistName);
        totalFailures += 1;
      }
    }

    playlistImportCtx.setImportResult({
      result: {
        collectionsCreated: batch.length,
        songsAdded: totalSongsAdded,
        failures: totalFailures,
      },
      playlistName: batch.length === 1
        ? batch[0].name
        : `${batch.length} afspeellijsten`,
    });

    playlistImportCtx.setImporting(false);
    playlistImportCtx.updateProgress(null);

    // Reset selection and reload
    setSelectedIds(new Set());
    setHasLoadedPlaylists(false);
  }, [selectedIds, appleMusicCtx, triggerFeedback, libraryPlaylists, playlistImportCtx, musicCollections]);

  // Format date for imported playlists
  const formatImportDate = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  // Handle retry
  const handleRetry = useCallback(() => {
    setHasLoadedPlaylists(false);
    setLoadError(null);
  }, []);

  return (
    <ScrollViewWithIndicator
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Section: Imported playlists */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
          {t('appleMusicSettings.importedSectionTitle')}
        </Text>

        {importedCollections.length === 0 ? (
          <View style={[styles.emptyRow, { borderTopColor: themeColors.border }]}>
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              {t('appleMusicSettings.noImportedCollections')}
            </Text>
          </View>
        ) : (
          importedCollections.map((collection) => (
            <View
              key={collection.id}
              style={[styles.importedRow, { borderTopColor: themeColors.border }]}
            >
              <View style={[styles.importedCheckmark, { backgroundColor: '#1B5E20' }]}>
                <Icon name="checkmark" size={14} color="#FFFFFF" />
              </View>
              <View style={styles.importedInfo}>
                <Text
                  style={[styles.importedName, { color: themeColors.textPrimary }]}
                  numberOfLines={1}
                >
                  {collection.name}
                </Text>
                <Text style={[styles.importedDate, { color: themeColors.textSecondary }]}>
                  {t('appleMusicSettings.importedOn', {
                    date: formatImportDate(collection.createdAt),
                  })}
                </Text>
              </View>
              <Text style={[styles.importedSongCount, { color: themeColors.textSecondary }]}>
                {t('appleMusic.import.trackCount', {
                  count: collection.songCatalogIds.length,
                })}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Section: Not-yet-imported playlists */}
      {appleMusicCtx && (
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
            {t('appleMusicSettings.unimportedSectionTitle')}
          </Text>

          {isLoadingPlaylists && (
            <View style={styles.loadingContainer}>
              <LoadingView />
            </View>
          )}

          {loadError && (
            <View style={[styles.errorRow, { borderTopColor: themeColors.border }]}>
              <Text style={[styles.errorText, { color: themeColors.textPrimary }]}>
                {loadError}
              </Text>
              <HapticTouchable
                style={[styles.retryButton, { backgroundColor: themeColors.textSecondary }]}
                onPress={handleRetry}
                accessibilityRole="button"
                accessibilityLabel={t('common.tryAgain')}
              >
                <Text style={styles.retryButtonText}>
                  {t('common.tryAgain')}
                </Text>
              </HapticTouchable>
            </View>
          )}

          {!isLoadingPlaylists && !loadError && hasLoadedPlaylists && unimportedPlaylists.length === 0 && (
            <View style={[styles.emptyRow, { borderTopColor: themeColors.border }]}>
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                {t('appleMusicSettings.allImported')}
              </Text>
            </View>
          )}

          {!isLoadingPlaylists && !loadError && unimportedPlaylists.length > 0 && (
            <>
              {/* Select all */}
              <HapticTouchable
                style={[styles.selectAllRow, { borderTopColor: themeColors.border }]}
                onPress={handleSelectAll}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selectedIds.size === unimportedPlaylists.length }}
                accessibilityLabel={
                  selectedIds.size === unimportedPlaylists.length
                    ? t('appleMusic.import.deselectAll')
                    : t('appleMusic.import.selectAll')
                }
              >
                <View style={[
                  styles.checkbox,
                  {
                    borderColor: selectedIds.size === unimportedPlaylists.length
                      ? themeColors.textPrimary
                      : themeColors.border,
                    backgroundColor: selectedIds.size === unimportedPlaylists.length
                      ? themeColors.textPrimary
                      : 'transparent',
                  },
                ]}>
                  {selectedIds.size === unimportedPlaylists.length && (
                    <Icon name="checkmark" size={14} color={themeColors.background} />
                  )}
                </View>
                <Text style={[styles.selectAllText, { color: themeColors.textPrimary }]}>
                  {selectedIds.size === unimportedPlaylists.length
                    ? t('appleMusic.import.deselectAll')
                    : t('appleMusic.import.selectAll')
                  }
                </Text>
                {selectedIds.size > 0 && (
                  <Text style={[styles.selectionCounter, { color: themeColors.textSecondary }]}>
                    {t('appleMusic.import.selectedCount', {
                      selected: selectedIds.size,
                      total: unimportedPlaylists.length,
                    })}
                  </Text>
                )}
              </HapticTouchable>

              {/* Unimported playlist list */}
              {unimportedPlaylists.map((playlist) => {
                const isSelected = selectedIds.has(playlist.id);

                return (
                  <HapticTouchable
                    key={playlist.id}
                    style={[styles.playlistRow, { borderTopColor: themeColors.border }]}
                    onPress={() => handleToggleSelect(playlist.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={playlist.name}
                  >
                    <View style={[
                      styles.checkbox,
                      {
                        borderColor: isSelected ? themeColors.textPrimary : themeColors.border,
                        backgroundColor: isSelected ? themeColors.textPrimary : 'transparent',
                      },
                    ]}>
                      {isSelected && (
                        <Icon name="checkmark" size={14} color={themeColors.background} />
                      )}
                    </View>

                    {/* Artwork */}
                    <View style={[styles.playlistArtwork, { backgroundColor: themeColors.border + '40' }]}>
                      {playlist.artworkUrl ? (
                        <Image
                          source={{ uri: playlist.artworkUrl.replace('{w}', '80').replace('{h}', '80') }}
                          style={styles.playlistArtworkImage}
                        />
                      ) : (
                        <Icon name="musical-notes" size={20} color={themeColors.textSecondary} />
                      )}
                    </View>

                    <View style={styles.playlistInfo}>
                      <Text
                        style={[styles.playlistName, { color: themeColors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {playlist.name}
                      </Text>
                      {playlist.trackCount != null && playlist.trackCount > 0 && (
                        <Text style={[styles.playlistTrackCount, { color: themeColors.textSecondary }]}>
                          {t('appleMusic.import.trackCount', { count: playlist.trackCount })}
                        </Text>
                      )}
                    </View>
                  </HapticTouchable>
                );
              })}

              {/* Import button */}
              {selectedIds.size > 0 && (
                <View style={styles.importButtonContainer}>
                  <HapticTouchable
                    style={[styles.importButton, { backgroundColor: themeColors.textPrimary }]}
                    onPress={handleImportSelected}
                    accessibilityRole="button"
                    accessibilityLabel={t('appleMusic.import.importSelected', { count: selectedIds.size })}
                  >
                    <Icon name="download" size={20} color={themeColors.background} />
                    <Text style={[styles.importButtonText, { color: themeColors.background }]}>
                      {selectedIds.size === 1
                        ? t('appleMusic.import.importOne')
                        : t('appleMusic.import.importMultiple', { count: selectedIds.size })
                      }
                    </Text>
                  </HapticTouchable>
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* Footer note */}
      <Text style={[styles.footerNote, { color: themeColors.textTertiary }]}>
        {t('appleMusicSettings.importFooterNote')}
      </Text>
    </ScrollViewWithIndicator>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  emptyRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
  importedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    minHeight: touchTargets.minimum,
  },
  importedCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  importedInfo: {
    flex: 1,
  },
  importedName: {
    ...typography.body,
    fontWeight: '600',
  },
  importedDate: {
    ...typography.small,
    marginTop: 2,
  },
  importedSongCount: {
    ...typography.small,
  },
  loadingContainer: {
    paddingVertical: spacing.lg,
  },
  errorRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    alignItems: 'center',
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
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTargets.minimum,
    borderTopWidth: 1,
  },
  selectAllText: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
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
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTargets.minimum,
    borderTopWidth: 1,
  },
  playlistArtwork: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  playlistArtworkImage: {
    width: 40,
    height: 40,
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    ...typography.body,
    fontWeight: '600',
  },
  playlistTrackCount: {
    ...typography.small,
    marginTop: 2,
  },
  importButtonContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
    fontWeight: '700',
  },
  footerNote: {
    ...typography.small,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 20,
  },
});
