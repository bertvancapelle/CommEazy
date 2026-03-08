/**
 * PlaylistBrowserModal — Browse and import Apple Music playlists
 *
 * Shows a list of playlists from the user's Apple Music library.
 * User taps a playlist to import it as a MusicCollection (one-time snapshot).
 *
 * Already imported playlists show "✓ Geïmporteerd" badge.
 * Track count shown per playlist.
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - Large text and artwork
 * - Clear import status indicators
 * - Haptic feedback on all interactions
 * - Loading and error states with human-friendly messages
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { PanelAwareModal, HapticTouchable, Icon, LoadingView } from '@/components';
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
  /** Called when user taps a playlist to import (parent handles actual import) */
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

  // Set of already-imported playlist IDs
  const importedPlaylistIds = useMemo(() => {
    return new Set(
      collections
        .filter(c => c.sourcePlaylistId)
        .map(c => c.sourcePlaylistId!),
    );
  }, [collections]);

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
    }
  }, [visible]);

  // Handle import tap
  const handleImport = useCallback((playlist: AppleMusicPlaylist) => {
    if (isImporting) return; // Block concurrent imports
    if (importedPlaylistIds.has(playlist.id)) return; // Already imported

    void triggerFeedback('success');

    // Close modal — floating indicator tracks progress
    onClose();

    // Notify parent to start the import (parent handles the actual import flow)
    onImportStarted?.(playlist.id, playlist.name);
  }, [isImporting, importedPlaylistIds, triggerFeedback, onClose, onImportStarted]);

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
            {t('appleMusic.import.browserDescription', 'Tik op een afspeellijst om deze te importeren. Je nummers worden opgeslagen als favorieten.')}
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
            <ScrollView
              style={styles.playlistList}
              contentContainerStyle={styles.playlistListContent}
            >
              {playlists.map((playlist) => {
                const isImported = importedPlaylistIds.has(playlist.id);

                return (
                  <HapticTouchable
                    key={playlist.id}
                    style={[
                      styles.playlistRow,
                      {
                        backgroundColor: themeColors.surface,
                        borderColor: themeColors.border,
                        opacity: isImporting && !isImported ? 0.5 : 1,
                      },
                    ]}
                    onPress={() => handleImport(playlist)}
                    hapticDisabled={isImported || isImporting}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isImported
                        ? t('appleMusic.import.alreadyImported', '{{name}} — al geïmporteerd', { name: playlist.name })
                        : t('appleMusic.import.tapToImport', '{{name}} — tik om te importeren', { name: playlist.name })
                    }
                    accessibilityState={{ disabled: isImported || isImporting }}
                  >
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

                    {/* Import status */}
                    {isImported ? (
                      <View style={[styles.importedBadge, { backgroundColor: '#1B5E20' }]}>
                        <Icon name="checkmark" size={16} color="#FFFFFF" />
                        <Text style={styles.importedBadgeText}>
                          {t('appleMusic.import.imported', 'Geïmporteerd')}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.importArrow}>
                        <Icon name="download" size={22} color={accentColor} />
                      </View>
                    )}
                  </HapticTouchable>
                );
              })}
            </ScrollView>
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
  playlistList: {
    flex: 1,
  },
  playlistListContent: {
    paddingHorizontal: spacing.lg,
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
  importArrow: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
