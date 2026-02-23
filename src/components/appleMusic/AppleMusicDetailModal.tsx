/**
 * AppleMusicDetailModal — Full-screen modal for Apple Music content details
 *
 * Shows details for:
 * - Artist: artwork, name, top songs, albums
 * - Album: artwork, title, artist, track list
 * - Playlist: artwork, name, curator, track list
 *
 * Senior-inclusive design:
 * - Large touch targets (60pt+)
 * - Clear close button
 * - Loading states
 * - Error handling
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, IconButton, VoiceFocusable } from '@/components';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useFeedback } from '@/hooks/useFeedback';
import {
  useAppleMusicContext,
  type AppleMusicSong,
  type AppleMusicAlbum,
  type AppleMusicArtist,
  type AppleMusicPlaylist,
  type AlbumDetails,
  type ArtistDetails,
  type PlaylistDetails,
} from '@/contexts/AppleMusicContext';

// ============================================================
// Types
// ============================================================

type DetailType = 'artist' | 'album' | 'playlist';

interface AppleMusicDetailModalProps {
  visible: boolean;
  type: DetailType;
  id: string;
  onClose: () => void;
  // Initial data from search results (shown while loading full details)
  initialData?: AppleMusicArtist | AppleMusicAlbum | AppleMusicPlaylist;
}

// ============================================================
// Component
// ============================================================

export function AppleMusicDetailModal({
  visible,
  type,
  id,
  onClose,
  initialData,
}: AppleMusicDetailModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const themeColors = useColors();
  const appleMusicColor = useModuleColor('appleMusic');
  const { triggerFeedback } = useFeedback();

  const {
    getAlbumDetails,
    getArtistDetails,
    getPlaylistDetails,
    playSong,
    playAlbum,
    playPlaylist,
  } = useAppleMusicContext();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [albumDetails, setAlbumDetails] = useState<AlbumDetails | null>(null);
  const [artistDetails, setArtistDetails] = useState<ArtistDetails | null>(null);
  const [playlistDetails, setPlaylistDetails] = useState<PlaylistDetails | null>(null);

  // ============================================================
  // Load Details
  // ============================================================

  useEffect(() => {
    if (!visible || !id) return;

    const loadDetails = async () => {
      setIsLoading(true);
      setError(null);

      try {
        switch (type) {
          case 'artist':
            const artist = await getArtistDetails(id);
            setArtistDetails(artist);
            break;
          case 'album':
            const album = await getAlbumDetails(id);
            setAlbumDetails(album);
            break;
          case 'playlist':
            const playlist = await getPlaylistDetails(id);
            setPlaylistDetails(playlist);
            break;
        }
      } catch (err) {
        console.error('[AppleMusicDetailModal] Load error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load details');
      } finally {
        setIsLoading(false);
      }
    };

    loadDetails();
  }, [visible, type, id, getAlbumDetails, getArtistDetails, getPlaylistDetails]);

  // Clear state when modal closes
  useEffect(() => {
    if (!visible) {
      setAlbumDetails(null);
      setArtistDetails(null);
      setPlaylistDetails(null);
      setError(null);
    }
  }, [visible]);

  // ============================================================
  // Handlers
  // ============================================================

  const handlePlaySong = useCallback(async (song: AppleMusicSong) => {
    triggerFeedback('tap');
    try {
      await playSong(song.id, song.artworkUrl);
    } catch (err) {
      console.error('[AppleMusicDetailModal] Play song error:', err);
    }
  }, [playSong, triggerFeedback]);

  const handlePlayAll = useCallback(async (startIndex: number = 0) => {
    triggerFeedback('tap');
    try {
      if (type === 'album' && albumDetails) {
        await playAlbum(albumDetails.id, startIndex);
      } else if (type === 'playlist' && playlistDetails) {
        await playPlaylist(playlistDetails.id, startIndex);
      }
    } catch (err) {
      console.error('[AppleMusicDetailModal] Play all error:', err);
    }
  }, [type, albumDetails, playlistDetails, playAlbum, playPlaylist, triggerFeedback]);

  const handleAlbumPress = useCallback((album: AppleMusicAlbum) => {
    // Could open nested album detail, but for simplicity we'll just log
    console.log('[AppleMusicDetailModal] Album pressed:', album.id, album.title);
  }, []);

  // ============================================================
  // Render Helpers
  // ============================================================

  const renderSongItem = (song: AppleMusicSong, index: number, showTrackNumber: boolean = false) => (
    <VoiceFocusable
      key={song.id}
      id={song.id}
      label={`${song.title} ${song.artistName}`}
      index={index}
      onSelect={() => handlePlaySong(song)}
    >
      <TouchableOpacity
        style={[styles.songItem, { backgroundColor: themeColors.surface }]}
        onPress={() => handlePlaySong(song)}
        onLongPress={() => {}}
        delayLongPress={300}
        accessibilityRole="button"
        accessibilityLabel={`${song.title} ${t('common.by')} ${song.artistName}`}
      >
        {showTrackNumber ? (
          <View style={styles.trackNumberContainer}>
            <Text style={[styles.trackNumber, { color: themeColors.textSecondary }]}>
              {song.trackNumber}
            </Text>
          </View>
        ) : (
          song.artworkUrl && song.artworkUrl.startsWith('http') ? (
            <Image
              source={{ uri: song.artworkUrl.replace('{w}', '50').replace('{h}', '50') }}
              style={styles.songArtwork}
            />
          ) : (
            <View style={[styles.songArtwork, styles.songArtworkPlaceholder, { backgroundColor: themeColors.border }]}>
              <Icon name="appleMusic" size={20} color={themeColors.textSecondary} />
            </View>
          )
        )}
        <View style={styles.songInfo}>
          <Text style={[styles.songTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={[styles.songArtist, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {song.artistName}
          </Text>
        </View>
        <IconButton
          icon="play"
          size={36}
          onPress={() => handlePlaySong(song)}
          accessibilityLabel={t('modules.appleMusic.play', { title: song.title })}
        />
      </TouchableOpacity>
    </VoiceFocusable>
  );

  const renderAlbumItem = (album: AppleMusicAlbum, index: number) => (
    <TouchableOpacity
      key={album.id}
      style={[styles.albumGridItem, { backgroundColor: themeColors.surface }]}
      onPress={() => handleAlbumPress(album)}
      accessibilityRole="button"
      accessibilityLabel={`${album.title} ${t('common.by')} ${album.artistName}`}
    >
      {album.artworkUrl && album.artworkUrl.startsWith('http') ? (
        <Image
          source={{ uri: album.artworkUrl.replace('{w}', '120').replace('{h}', '120') }}
          style={styles.albumGridArtwork}
        />
      ) : (
        <View style={[styles.albumGridArtwork, styles.songArtworkPlaceholder, { backgroundColor: themeColors.border }]}>
          <Icon name="appleMusic" size={32} color={themeColors.textSecondary} />
        </View>
      )}
      <Text style={[styles.albumGridTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
        {album.title}
      </Text>
      <Text style={[styles.albumGridYear, { color: themeColors.textSecondary }]} numberOfLines={1}>
        {album.releaseDate?.substring(0, 4) || ''}
      </Text>
    </TouchableOpacity>
  );

  // ============================================================
  // Render Content
  // ============================================================

  const renderArtistContent = () => {
    if (!artistDetails) return null;

    return (
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {/* Artist Header */}
        <View style={styles.header}>
          {artistDetails.artworkUrl && artistDetails.artworkUrl.startsWith('http') ? (
            <Image
              source={{ uri: artistDetails.artworkUrl.replace('{w}', '200').replace('{h}', '200') }}
              style={[styles.artistArtwork]}
            />
          ) : (
            <View style={[styles.artistArtwork, styles.songArtworkPlaceholder, { backgroundColor: themeColors.border }]}>
              <Icon name="contacts" size={64} color={themeColors.textSecondary} />
            </View>
          )}
          <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
            {artistDetails.name}
          </Text>
        </View>

        {/* Top Songs */}
        {artistDetails.topSongs.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
              {t('modules.appleMusic.detail.topSongs')}
            </Text>
            {artistDetails.topSongs.map((song, index) => renderSongItem(song, index))}
          </View>
        )}

        {/* Albums */}
        {artistDetails.albums.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
              {t('modules.appleMusic.detail.albums')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumsRow}>
              {artistDetails.albums.map((album, index) => renderAlbumItem(album, index))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderAlbumContent = () => {
    if (!albumDetails) return null;

    return (
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {/* Album Header */}
        <View style={styles.header}>
          {albumDetails.artworkUrl && albumDetails.artworkUrl.startsWith('http') ? (
            <Image
              source={{ uri: albumDetails.artworkUrl.replace('{w}', '200').replace('{h}', '200') }}
              style={styles.albumArtwork}
            />
          ) : (
            <View style={[styles.albumArtwork, styles.songArtworkPlaceholder, { backgroundColor: themeColors.border }]}>
              <Icon name="appleMusic" size={64} color={themeColors.textSecondary} />
            </View>
          )}
          <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
            {albumDetails.title}
          </Text>
          <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
            {albumDetails.artistName}
          </Text>
          <Text style={[styles.headerMeta, { color: themeColors.textSecondary }]}>
            {albumDetails.trackCount} {t('modules.appleMusic.search.tracks')}
          </Text>
        </View>

        {/* Play All Button */}
        <TouchableOpacity
          style={[styles.playAllButton, { backgroundColor: appleMusicColor }]}
          onPress={() => handlePlayAll(0)}
          accessibilityRole="button"
          accessibilityLabel={t('modules.appleMusic.detail.playAll')}
        >
          <Icon name="play" size={24} color={themeColors.white} />
          <Text style={[styles.playAllText, { color: themeColors.white }]}>
            {t('modules.appleMusic.detail.playAll')}
          </Text>
        </TouchableOpacity>

        {/* Tracks */}
        <View style={styles.section}>
          {albumDetails.tracks.map((song, index) => renderSongItem(song, index, true))}
        </View>
      </ScrollView>
    );
  };

  const renderPlaylistContent = () => {
    if (!playlistDetails) return null;

    return (
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {/* Playlist Header */}
        <View style={styles.header}>
          {playlistDetails.artworkUrl && playlistDetails.artworkUrl.startsWith('http') ? (
            <Image
              source={{ uri: playlistDetails.artworkUrl.replace('{w}', '200').replace('{h}', '200') }}
              style={styles.albumArtwork}
            />
          ) : (
            <View style={[styles.albumArtwork, styles.songArtworkPlaceholder, { backgroundColor: themeColors.border }]}>
              <Icon name="list" size={64} color={themeColors.textSecondary} />
            </View>
          )}
          <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
            {playlistDetails.name}
          </Text>
          {playlistDetails.curatorName && (
            <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
              {playlistDetails.curatorName}
            </Text>
          )}
          {playlistDetails.description && (
            <Text style={[styles.headerDescription, { color: themeColors.textSecondary }]} numberOfLines={3}>
              {playlistDetails.description}
            </Text>
          )}
        </View>

        {/* Play All Button */}
        <TouchableOpacity
          style={[styles.playAllButton, { backgroundColor: appleMusicColor }]}
          onPress={() => handlePlayAll(0)}
          accessibilityRole="button"
          accessibilityLabel={t('modules.appleMusic.detail.playAll')}
        >
          <Icon name="play" size={24} color={themeColors.white} />
          <Text style={[styles.playAllText, { color: themeColors.white }]}>
            {t('modules.appleMusic.detail.playAll')}
          </Text>
        </TouchableOpacity>

        {/* Tracks */}
        <View style={styles.section}>
          {playlistDetails.tracks.map((song, index) => renderSongItem(song, index))}
        </View>
      </ScrollView>
    );
  };

  // ============================================================
  // Render
  // ============================================================

  const getTitle = () => {
    switch (type) {
      case 'artist':
        return artistDetails?.name || (initialData as AppleMusicArtist)?.name || t('modules.appleMusic.search.artistsTitle');
      case 'album':
        return albumDetails?.title || (initialData as AppleMusicAlbum)?.title || t('modules.appleMusic.search.albumsTitle');
      case 'playlist':
        return playlistDetails?.name || (initialData as AppleMusicPlaylist)?.name || t('modules.appleMusic.search.playlistsTitle');
      default:
        return '';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {/* Header with close button */}
        <View style={[styles.modalHeader, { paddingTop: insets.top + spacing.sm, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Icon name="chevron-down" size={28} color={themeColors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {getTitle()}
          </Text>
          <View style={styles.closeButton} />
        </View>

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={appleMusicColor} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
              {t('common.loading')}
            </Text>
          </View>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <View style={styles.errorContainer}>
            <Icon name="warning" size={48} color={themeColors.error} />
            <Text style={[styles.errorText, { color: themeColors.error }]}>
              {t('modules.appleMusic.detail.error')}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { borderColor: appleMusicColor }]}
              onPress={() => {
                // Trigger reload by toggling visible
                setError(null);
                setIsLoading(true);
              }}
            >
              <Text style={[styles.retryText, { color: appleMusicColor }]}>
                {t('common.tryAgain')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Content */}
        {!isLoading && !error && (
          <>
            {type === 'artist' && renderArtistContent()}
            {type === 'album' && renderAlbumContent()}
            {type === 'playlist' && renderPlaylistContent()}
          </>
        )}
      </View>
    </Modal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    ...typography.h3,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  artistArtwork: {
    width: 160,
    height: 160,
    borderRadius: 80,
    marginBottom: spacing.md,
  },
  albumArtwork: {
    width: 200,
    height: 200,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  headerMeta: {
    ...typography.label,
    textAlign: 'center',
  },
  headerDescription: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Play All Button
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    minHeight: touchTargets.comfortable,
  },
  playAllText: {
    ...typography.body,
    fontWeight: '600',
  },

  // Sections
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },

  // Song Item
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    minHeight: touchTargets.comfortable,
  },
  trackNumberContainer: {
    width: 40,
    alignItems: 'center',
  },
  trackNumber: {
    ...typography.body,
    fontWeight: '500',
  },
  songArtwork: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.sm,
  },
  songArtworkPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  songArtist: {
    ...typography.label,
  },

  // Album Grid
  albumsRow: {
    flexDirection: 'row',
  },
  albumGridItem: {
    width: 140,
    marginRight: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  albumGridArtwork: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  albumGridTitle: {
    ...typography.label,
    fontWeight: '600',
  },
  albumGridYear: {
    ...typography.small,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.md,
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    ...typography.body,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
  },
  retryText: {
    ...typography.body,
    fontWeight: '600',
  },
});
