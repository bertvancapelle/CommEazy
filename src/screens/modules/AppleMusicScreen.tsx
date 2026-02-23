/**
 * AppleMusicScreen — Apple Music integration module
 *
 * Senior-inclusive Apple Music player with:
 * - Search and discover music (iOS only)
 * - Library access and playback (iOS only)
 * - Large touch targets (60pt+)
 * - VoiceFocusable song lists
 * - Android: App detection with Play Store / Open App buttons
 *
 * Voice commands supported:
 * - "speel" / "play" — Play selected song
 * - "pauze" / "pause" — Pause playback
 * - "stop" — Stop playback
 * - "volgende" / "next" — Next track
 * - "vorige" / "previous" — Previous track
 * - "[song name]" — Focus on song
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import {
  Icon,
  IconButton,
  VoiceFocusable,
  MiniPlayer,
  ExpandedAudioPlayer,
  ModuleHeader,
  FavoriteTabButton,
  SearchTabButton,
  SearchBar,
  AppleMusicDetailModal,
  type SearchBarRef,
} from '@/components';
import { useVoiceFocusList, useVoiceFocusContext } from '@/contexts/VoiceFocusContext';
import { useHoldGestureContextSafe } from '@/contexts/HoldGestureContext';
import { useColors } from '@/contexts/ThemeContext';
import {
  useAppleMusicContext,
  type AppleMusicSong,
  type AppleMusicAlbum,
  type AppleMusicArtist,
  type AppleMusicPlaylist,
  type SearchResults,
} from '@/contexts/AppleMusicContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFeedback } from '@/hooks/useFeedback';
import { useGlassPlayer } from '@/hooks/useGlassPlayer';
import { useSleepTimer } from '@/hooks/useSleepTimer';

// ============================================================
// Constants
// ============================================================

const SEARCH_MAX_LENGTH = 100;

// Layout constants for overlay positioning
const MODULE_HEADER_HEIGHT = 120;
const MINI_PLAYER_HEIGHT = 84;

// ============================================================
// Types
// ============================================================

type TabType = 'search' | 'library' | 'playlists';

// Search result filter types
type SearchFilterType = 'all' | 'songs' | 'albums' | 'artists' | 'playlists';

// Number of items to show per section in "Alle" tab
const ITEMS_PER_SECTION = 5;

// ============================================================
// Component
// ============================================================

export function AppleMusicScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { accentColor } = useAccentColor();
  const appleMusicColor = useModuleColor('appleMusic');  // User-customizable module color
  const { isVoiceSessionActive } = useVoiceFocusContext();
  const holdGesture = useHoldGestureContextSafe();
  const isReducedMotion = useReducedMotion();
  const { triggerFeedback } = useFeedback();
  const themeColors = useColors();

  // Apple Music Context
  const {
    authStatus,
    isAuthorized,
    capabilities,
    requestAuthorization,
    openPlayStore,
    openAppleMusicApp,
    // Playback
    isPlaying,
    isLoading: isPlaybackLoading,
    nowPlaying: currentSong,
    effectiveArtworkUrl,
    playbackState,
    shuffleMode,
    repeatMode,
    // Controls
    playSong,
    pause,
    resume,
    stop,
    skipToNext,
    skipToPrevious,
    seekTo,
    setShuffleMode,
    setRepeatMode,
    // Sleep timer
    setSleepTimerActive,
    // Search
    searchCatalog,
    // Library
    addToLibrary,
    isInLibrary,
  } = useAppleMusicContext();

  // Sleep timer hook - shared logic for all audio modules
  const { setSleepTimer } = useSleepTimer({
    onTimerExpired: stop,
    setSleepTimerActive,
    moduleName: 'AppleMusicScreen',
    enableTestMode: true, // Allow 0 minutes = 30 seconds for testing
  });

  // Local search state (context returns Promise, we manage state here)
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // State
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [searchFilter, setSearchFilter] = useState<SearchFilterType>('all');
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Detail modal state
  const [detailModal, setDetailModal] = useState<{
    visible: boolean;
    type: 'artist' | 'album' | 'playlist';
    id: string;
    initialData?: AppleMusicArtist | AppleMusicAlbum | AppleMusicPlaylist;
  }>({
    visible: false,
    type: 'album',
    id: '',
  });

  // Library state
  const [currentSongInLibrary, setCurrentSongInLibrary] = useState(false);
  const [isAddingToLibrary, setIsAddingToLibrary] = useState(false);

  // Check if platform supports full functionality
  const hasFullSupport = capabilities?.hasMusicKit && capabilities?.canPlayback;
  const isAndroid = Platform.OS === 'android';
  const isIOS = Platform.OS === 'ios';

  // ============================================================
  // Glass Player (iOS 26+ native Liquid Glass player)
  // ============================================================

  const {
    isAvailable: isGlassPlayerAvailable,
    isCheckingAvailability: isCheckingGlassPlayerAvailability,
    isVisible: isGlassPlayerVisible,
    isExpanded: isGlassPlayerExpanded,
    showMiniPlayer: showGlassMiniPlayer,
    expandToFull: expandGlassPlayer,
    collapseToMini: collapseGlassPlayer,
    hide: hideGlassPlayer,
    updateContent: updateGlassContent,
    updatePlaybackState: updateGlassPlaybackState,
    configureControls: configureGlassControls,
  } = useGlassPlayer({
    onPlayPause: async () => {
      // Native Glass Player handles its own UI state.
      // We just need to toggle the underlying playback.
      // NOTE: Don't check isPlaying here - the native side already knows the state
      // and may have already updated its UI. Just tell MusicKit to toggle.
      console.log('[AppleMusicScreen] onPlayPause from native, current isPlaying:', isPlaying);
      if (isPlaying) {
        await pause();
      } else {
        await resume();
      }
    },
    onStop: async () => {
      await stop();
    },
    onExpand: () => {
      setIsPlayerExpanded(true);
    },
    onCollapse: () => {
      setIsPlayerExpanded(false);
    },
    onClose: () => {
      setIsPlayerExpanded(false);
    },
    onSeek: async (position: number) => {
      // position is in seconds from native player
      console.log('[AppleMusicScreen] onSeek from native:', position);
      await seekTo(position);
    },
    onSkipForward: async () => {
      // Skip 30 seconds forward
      const currentTime = playbackState?.currentTime ?? 0;
      const duration = playbackState?.duration ?? 0;
      const newPosition = Math.min(currentTime + 30, duration);
      console.log('[AppleMusicScreen] Skip forward 30s:', currentTime, '->', newPosition);
      await seekTo(newPosition);
    },
    onSkipBackward: async () => {
      // Skip 10 seconds backward
      const currentTime = playbackState?.currentTime ?? 0;
      const newPosition = Math.max(currentTime - 10, 0);
      console.log('[AppleMusicScreen] Skip backward 10s:', currentTime, '->', newPosition);
      await seekTo(newPosition);
    },
    onFavoriteToggle: () => {
      // Apple Music favorites not implemented yet
    },
    onSleepTimerSet: setSleepTimer,
    onShuffleToggle: () => {
      // Toggle shuffle mode
      setShuffleMode(shuffleMode === 'off' ? 'songs' : 'off');
    },
    onRepeatToggle: () => {
      // Cycle through: off -> all -> one -> off
      const nextMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
      setRepeatMode(nextMode);
    },
  });

  // ============================================================
  // Glass Player Effects (iOS 26+ synchronization)
  // ============================================================

  // Effect 1: Show native mini player when song plays (iOS 26+ only)
  useEffect(() => {
    if (!isGlassPlayerAvailable || !currentSong || !isFocused) {
      return;
    }

    // Use effectiveArtworkUrl which prefers cached search result URLs over MusicKit queue URLs
    // MusicKit queue entries often have musicKit:// URLs that don't work in React Native
    const artworkUrl = effectiveArtworkUrl;

    console.log('[AppleMusicScreen] Showing Glass Player with artwork:', artworkUrl);

    // Configure controls for Apple Music (skip buttons, shuffle, repeat, etc.)
    configureGlassControls({
      seekSlider: true,
      skipButtons: true,
      speedControl: false,
      sleepTimer: true,
      favorite: true,
      stopButton: true,
      shuffle: true,
      repeat: true,
    });

    showGlassMiniPlayer({
      moduleId: 'appleMusic',
      tintColorHex: appleMusicColor,
      artwork: artworkUrl,
      title: currentSong.title,
      subtitle: currentSong.artistName,
      progressType: 'bar',
      progress: (playbackState?.currentTime ?? 0) / (playbackState?.duration || 1),
      showStopButton: true,
    });
  }, [isGlassPlayerAvailable, currentSong, effectiveArtworkUrl, isFocused, showGlassMiniPlayer, configureGlassControls]);

  // Effect 2: Update playback state when playing/paused changes
  useEffect(() => {
    if (!isGlassPlayerAvailable || !isGlassPlayerVisible) {
      return;
    }

    updateGlassPlaybackState({
      isPlaying,
      isLoading: isPlaybackLoading,
      isBuffering: false,
      progress: (playbackState?.currentTime ?? 0) / (playbackState?.duration || 1),
      position: playbackState?.currentTime ?? 0,
      duration: playbackState?.duration ?? 0,
      isFavorite: false,
      shuffleMode,
      repeatMode,
    });
  }, [isGlassPlayerAvailable, isGlassPlayerVisible, isPlaying, isPlaybackLoading, playbackState, shuffleMode, repeatMode, updateGlassPlaybackState]);

  // Effect 3: Update content when song/metadata changes
  useEffect(() => {
    if (!isGlassPlayerAvailable || !isGlassPlayerVisible || !currentSong) {
      return;
    }

    // Use effectiveArtworkUrl which prefers cached search result URLs
    const artworkUrl = effectiveArtworkUrl;

    updateGlassContent({
      tintColorHex: appleMusicColor,  // MUST include to prevent fallback to default color
      artwork: artworkUrl,
      title: currentSong.title,
      subtitle: currentSong.artistName,
      progress: (playbackState?.currentTime ?? 0) / (playbackState?.duration || 1),
      showStopButton: true,  // Single source of truth for stop button visibility
    });
  }, [isGlassPlayerAvailable, isGlassPlayerVisible, currentSong, effectiveArtworkUrl, playbackState?.currentTime, playbackState?.duration, appleMusicColor, updateGlassContent]);

  // Effect 4: Hide native player when navigating away
  useEffect(() => {
    if (!isFocused && isGlassPlayerAvailable && isGlassPlayerVisible) {
      hideGlassPlayer();
    }
  }, [isFocused, isGlassPlayerAvailable, isGlassPlayerVisible, hideGlassPlayer]);

  // Effect 6: Hide native player when song stops
  useEffect(() => {
    if (!currentSong && isGlassPlayerAvailable && isGlassPlayerVisible) {
      hideGlassPlayer();
    }
  }, [currentSong, isGlassPlayerAvailable, isGlassPlayerVisible, hideGlassPlayer]);

  // Effect 7: Re-show native player when navigating back to screen with active playback
  useEffect(() => {
    if (isFocused && isGlassPlayerAvailable && currentSong && !isGlassPlayerVisible) {
      console.debug('[AppleMusicScreen] Re-showing Glass Player after navigation');

      // Use effectiveArtworkUrl which prefers cached search result URLs
      const artworkUrl = effectiveArtworkUrl;

      // Configure controls for Apple Music
      configureGlassControls({
        seekSlider: true,
        skipButtons: true,
        speedControl: false,
        sleepTimer: true,
        favorite: true,
        stopButton: false,
        shuffle: true,
        repeat: true,
      });

      showGlassMiniPlayer({
        moduleId: 'appleMusic',
        tintColorHex: appleMusicColor,
        artwork: artworkUrl,
        title: currentSong.title,
        subtitle: currentSong.artistName,
        progressType: 'bar',
        progress: (playbackState?.currentTime ?? 0) / (playbackState?.duration || 1),
        showStopButton: false,
      });
    }
  }, [isFocused, isGlassPlayerAvailable, isGlassPlayerVisible, currentSong, effectiveArtworkUrl, playbackState, showGlassMiniPlayer, configureGlassControls]);

  // Effect 8: Check if current song is in library when song changes
  useEffect(() => {
    if (!currentSong?.id) {
      setCurrentSongInLibrary(false);
      return;
    }

    // Check library status for current song
    isInLibrary(currentSong.id)
      .then(setCurrentSongInLibrary)
      .catch(() => setCurrentSongInLibrary(false));
  }, [currentSong?.id, isInLibrary]);

  // ============================================================
  // Handlers
  // ============================================================

  const handleAddToLibrary = useCallback(async () => {
    if (!currentSong?.id || currentSongInLibrary || isAddingToLibrary) return;

    setIsAddingToLibrary(true);
    try {
      await addToLibrary(currentSong.id);
      setCurrentSongInLibrary(true);
    } catch (error) {
      console.error('[AppleMusicScreen] Failed to add to library:', error);
    } finally {
      setIsAddingToLibrary(false);
    }
  }, [currentSong?.id, currentSongInLibrary, isAddingToLibrary, addToLibrary]);

  const handleSearch = useCallback(async () => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      console.log('[AppleMusicScreen] Searching for:', trimmedQuery);
      const results = await searchCatalog(trimmedQuery);
      console.log('[AppleMusicScreen] Search results:', {
        songs: results.songs?.length ?? 0,
        albums: results.albums?.length ?? 0,
        artists: results.artists?.length ?? 0,
        playlists: results.playlists?.length ?? 0,
      });
      setSearchResults(results);
    } catch (error) {
      console.error('[AppleMusicScreen] Search error:', error);
      setSearchError(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchCatalog]);

  const clearSearch = useCallback(() => {
    setSearchResults(null);
    setSearchError(null);
    setSearchQuery('');
  }, []);

  const handleAuthorize = useCallback(async () => {
    const success = await requestAuthorization();
    if (success) {
      setShowAuthModal(false);
    }
  }, [requestAuthorization]);

  const handlePlaySong = useCallback(async (song: AppleMusicSong) => {
    triggerFeedback('tap');
    try {
      console.log('[AppleMusicScreen] Playing song:', song.id, song.title, 'artworkUrl:', song.artworkUrl?.substring(0, 60));
      // Pass the artwork URL from the search result - this is more reliable than MusicKit queue URLs
      await playSong(song.id, song.artworkUrl);
    } catch (error) {
      console.error('[AppleMusicScreen] Play song error:', error);
      Alert.alert(
        t('modules.appleMusic.playError.title'),
        t('modules.appleMusic.playError.message')
      );
    }
  }, [playSong, triggerFeedback, t]);

  const handlePlayPause = useCallback(() => {
    triggerFeedback('tap');
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [isPlaying, pause, resume, triggerFeedback]);

  const handleOpenPlayStore = useCallback(async () => {
    triggerFeedback('tap');
    await openPlayStore();
  }, [openPlayStore, triggerFeedback]);

  const handleOpenAppleMusicApp = useCallback(async () => {
    triggerFeedback('tap');
    await openAppleMusicApp();
  }, [openAppleMusicApp, triggerFeedback]);

  // ============================================================
  // Voice Focus
  // ============================================================

  const voiceFocusItems = useMemo(() => {
    if (!isFocused || !searchResults?.songs) return [];
    return searchResults.songs.map((song, index) => ({
      id: song.id,
      label: `${song.title} ${song.artistName}`,
      index,
      onSelect: () => handlePlaySong(song),
    }));
  }, [isFocused, searchResults?.songs, handlePlaySong]);

  const { scrollRef } = useVoiceFocusList('apple-music-songs', voiceFocusItems);

  // ============================================================
  // Authorization Required Screen (iOS)
  // ============================================================

  const renderAuthRequired = () => (
    <View style={styles.centeredContainer}>
      <Icon name="appleMusic" size={80} color={appleMusicColor} />
      <Text style={[styles.authTitle, { color: themeColors.textPrimary }]}>{t('modules.appleMusic.authRequired.title')}</Text>
      <Text style={[styles.authDescription, { color: themeColors.textSecondary }]}>
        {t('modules.appleMusic.authRequired.description')}
      </Text>
      <TouchableOpacity
        style={[styles.authButton, { backgroundColor: appleMusicColor }]}
        onPress={handleAuthorize}
        accessibilityRole="button"
        accessibilityLabel={t('modules.appleMusic.authRequired.button')}
      >
        <Text style={[styles.authButtonText, { color: themeColors.white }]}>
          {t('modules.appleMusic.authRequired.button')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ============================================================
  // Android App Not Installed Screen
  // ============================================================

  const renderAndroidNotInstalled = () => (
    <View style={styles.centeredContainer}>
      <Icon name="appleMusic" size={80} color={appleMusicColor} />
      <Text style={[styles.authTitle, { color: themeColors.textPrimary }]}>{t('modules.appleMusic.android.notInstalled.title')}</Text>
      <Text style={[styles.authDescription, { color: themeColors.textSecondary }]}>
        {t('modules.appleMusic.android.notInstalled.description')}
      </Text>
      <TouchableOpacity
        style={[styles.authButton, { backgroundColor: appleMusicColor }]}
        onPress={handleOpenPlayStore}
        accessibilityRole="button"
        accessibilityLabel={t('modules.appleMusic.android.notInstalled.downloadButton')}
      >
        <Icon name="external-link" size={20} color={themeColors.white} />
        <Text style={[styles.authButtonText, { color: themeColors.white }]}>
          {t('modules.appleMusic.android.notInstalled.downloadButton')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ============================================================
  // Android App Installed Screen
  // ============================================================

  const renderAndroidInstalled = () => (
    <View style={styles.centeredContainer}>
      <Icon name="appleMusic" size={80} color={appleMusicColor} />
      <Text style={[styles.authTitle, { color: themeColors.textPrimary }]}>{t('modules.appleMusic.android.installed.title')}</Text>
      <Text style={[styles.authDescription, { color: themeColors.textSecondary }]}>
        {t('modules.appleMusic.android.installed.description')}
      </Text>
      <TouchableOpacity
        style={[styles.authButton, { backgroundColor: appleMusicColor }]}
        onPress={handleOpenAppleMusicApp}
        accessibilityRole="button"
        accessibilityLabel={t('modules.appleMusic.android.installed.openButton')}
      >
        <Icon name="external-link" size={20} color={themeColors.white} />
        <Text style={[styles.authButtonText, { color: themeColors.white }]}>
          {t('modules.appleMusic.android.installed.openButton')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ============================================================
  // Search Tab Content
  // ============================================================

  // Calculate counts for each filter tab
  const resultCounts = useMemo(() => ({
    songs: searchResults?.songs?.length ?? 0,
    albums: searchResults?.albums?.length ?? 0,
    artists: searchResults?.artists?.length ?? 0,
    playlists: searchResults?.playlists?.length ?? 0,
  }), [searchResults]);

  const totalResults = resultCounts.songs + resultCounts.albums + resultCounts.artists + resultCounts.playlists;
  const hasAnyResults = totalResults > 0;

  // Render a single song item
  const renderSongItem = (song: AppleMusicSong, index: number) => (
    <VoiceFocusable
      key={song.id}
      id={song.id}
      label={`${song.title} ${song.artistName}`}
      index={index}
      onSelect={() => handlePlaySong(song)}
    >
      <View style={[styles.songItem, { backgroundColor: themeColors.surface }]}>
        <TouchableOpacity
          style={styles.songTappableArea}
          onPress={() => handlePlaySong(song)}
          onLongPress={() => {}}
          delayLongPress={300}
          accessibilityRole="button"
          accessibilityLabel={`${song.title} ${t('common.by')} ${song.artistName}`}
        >
          {song.artworkUrl && song.artworkUrl.startsWith('http') ? (
            <Image
              source={{ uri: song.artworkUrl.replace('{w}', '60').replace('{h}', '60') }}
              style={styles.songArtwork}
            />
          ) : (
            <View style={[styles.songArtwork, styles.songArtworkPlaceholder, { backgroundColor: themeColors.border }]}>
              <Icon name="appleMusic" size={24} color={themeColors.textSecondary} />
            </View>
          )}
          <View style={styles.songInfo}>
            <Text style={[styles.songTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {song.title}
            </Text>
            <Text style={[styles.songArtist, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {song.artistName}
            </Text>
          </View>
        </TouchableOpacity>
        <IconButton
          icon="play"
          size={40}
          onPress={() => handlePlaySong(song)}
          accessibilityLabel={t('modules.appleMusic.play', { title: song.title })}
        />
      </View>
    </VoiceFocusable>
  );

  // Render a single album item
  const renderAlbumItem = (album: AppleMusicAlbum, index: number) => (
    <VoiceFocusable
      key={album.id}
      id={album.id}
      label={`${album.title} ${album.artistName}`}
      index={index}
      onSelect={() => handleAlbumPress(album)}
    >
      <TouchableOpacity
        style={[styles.songItem, { backgroundColor: themeColors.surface }]}
        onPress={() => handleAlbumPress(album)}
        onLongPress={() => {}}
        delayLongPress={300}
        accessibilityRole="button"
        accessibilityLabel={`${t('modules.appleMusic.search.albumsTitle')}: ${album.title} ${t('common.by')} ${album.artistName}`}
      >
        {album.artworkUrl && album.artworkUrl.startsWith('http') ? (
          <Image
            source={{ uri: album.artworkUrl.replace('{w}', '60').replace('{h}', '60') }}
            style={styles.songArtwork}
          />
        ) : (
          <View style={[styles.songArtwork, styles.songArtworkPlaceholder, { backgroundColor: themeColors.border }]}>
            <Icon name="appleMusic" size={24} color={themeColors.textSecondary} />
          </View>
        )}
        <View style={styles.songInfo}>
          <Text style={[styles.songTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {album.title}
          </Text>
          <Text style={[styles.songArtist, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {album.artistName} • {album.trackCount} {t('modules.appleMusic.search.tracks')}
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color={themeColors.textSecondary} />
      </TouchableOpacity>
    </VoiceFocusable>
  );

  // Render a single artist item
  const renderArtistItem = (artist: AppleMusicArtist, index: number) => (
    <VoiceFocusable
      key={artist.id}
      id={artist.id}
      label={artist.name}
      index={index}
      onSelect={() => handleArtistPress(artist)}
    >
      <TouchableOpacity
        style={[styles.songItem, { backgroundColor: themeColors.surface }]}
        onPress={() => handleArtistPress(artist)}
        onLongPress={() => {}}
        delayLongPress={300}
        accessibilityRole="button"
        accessibilityLabel={`${t('modules.appleMusic.search.artistsTitle')}: ${artist.name}`}
      >
        {artist.artworkUrl && artist.artworkUrl.startsWith('http') ? (
          <Image
            source={{ uri: artist.artworkUrl.replace('{w}', '60').replace('{h}', '60') }}
            style={[styles.songArtwork, styles.artistArtwork]}
          />
        ) : (
          <View style={[styles.songArtwork, styles.artistArtwork, styles.songArtworkPlaceholder, { backgroundColor: themeColors.border }]}>
            <Icon name="contacts" size={24} color={themeColors.textSecondary} />
          </View>
        )}
        <View style={styles.songInfo}>
          <Text style={[styles.songTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {artist.name}
          </Text>
          <Text style={[styles.songArtist, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {t('modules.appleMusic.search.artistsTitle')}
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color={themeColors.textSecondary} />
      </TouchableOpacity>
    </VoiceFocusable>
  );

  // Render a single playlist item
  const renderPlaylistItem = (playlist: AppleMusicPlaylist, index: number) => (
    <VoiceFocusable
      key={playlist.id}
      id={playlist.id}
      label={playlist.name}
      index={index}
      onSelect={() => handlePlaylistPress(playlist)}
    >
      <TouchableOpacity
        style={[styles.songItem, { backgroundColor: themeColors.surface }]}
        onPress={() => handlePlaylistPress(playlist)}
        onLongPress={() => {}}
        delayLongPress={300}
        accessibilityRole="button"
        accessibilityLabel={`${t('modules.appleMusic.search.playlistsTitle')}: ${playlist.name}`}
      >
        {playlist.artworkUrl && playlist.artworkUrl.startsWith('http') ? (
          <Image
            source={{ uri: playlist.artworkUrl.replace('{w}', '60').replace('{h}', '60') }}
            style={styles.songArtwork}
          />
        ) : (
          <View style={[styles.songArtwork, styles.songArtworkPlaceholder, { backgroundColor: themeColors.border }]}>
            <Icon name="list" size={24} color={themeColors.textSecondary} />
          </View>
        )}
        <View style={styles.songInfo}>
          <Text style={[styles.songTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {playlist.name}
          </Text>
          <Text style={[styles.songArtist, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {playlist.curatorName || t('modules.appleMusic.search.playlistsTitle')}
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color={themeColors.textSecondary} />
      </TouchableOpacity>
    </VoiceFocusable>
  );

  // Render "Show all X →" button for a section
  const renderShowAllButton = (filterType: SearchFilterType, count: number) => (
    <TouchableOpacity
      style={styles.showAllButton}
      onPress={() => setSearchFilter(filterType)}
      accessibilityRole="button"
      accessibilityLabel={t('modules.appleMusic.search.showAll', { count })}
    >
      <Text style={[styles.showAllText, { color: appleMusicColor }]}>
        {t('modules.appleMusic.search.showAll', { count })} →
      </Text>
    </TouchableOpacity>
  );

  // Handle album tap - open album detail modal
  const handleAlbumPress = useCallback((album: AppleMusicAlbum) => {
    triggerFeedback('tap');
    console.log('[AppleMusicScreen] Album pressed:', album.id, album.title);
    setDetailModal({
      visible: true,
      type: 'album',
      id: album.id,
      initialData: album,
    });
  }, [triggerFeedback]);

  // Handle artist tap - open artist detail modal
  const handleArtistPress = useCallback((artist: AppleMusicArtist) => {
    triggerFeedback('tap');
    console.log('[AppleMusicScreen] Artist pressed:', artist.id, artist.name);
    setDetailModal({
      visible: true,
      type: 'artist',
      id: artist.id,
      initialData: artist,
    });
  }, [triggerFeedback]);

  // Handle playlist tap - open playlist detail modal
  const handlePlaylistPress = useCallback((playlist: AppleMusicPlaylist) => {
    triggerFeedback('tap');
    console.log('[AppleMusicScreen] Playlist pressed:', playlist.id, playlist.name);
    setDetailModal({
      visible: true,
      type: 'playlist',
      id: playlist.id,
      initialData: playlist,
    });
  }, [triggerFeedback]);

  // Close detail modal
  const handleCloseDetailModal = useCallback(() => {
    setDetailModal(prev => ({ ...prev, visible: false }));
  }, []);

  // Render search filter tabs
  const renderSearchFilterTabs = () => {
    const filters: { type: SearchFilterType; labelKey: string; icon: 'grid' | 'musical-notes' | 'disc' | 'person' | 'list'; count: number }[] = [
      { type: 'all', labelKey: 'modules.appleMusic.search.filterAll', icon: 'grid', count: totalResults },
      { type: 'songs', labelKey: 'modules.appleMusic.search.songsTitle', icon: 'musical-notes', count: resultCounts.songs },
      { type: 'albums', labelKey: 'modules.appleMusic.search.albumsTitle', icon: 'disc', count: resultCounts.albums },
      { type: 'artists', labelKey: 'modules.appleMusic.search.artistsTitle', icon: 'person', count: resultCounts.artists },
      { type: 'playlists', labelKey: 'modules.appleMusic.search.playlistsTitle', icon: 'list', count: resultCounts.playlists },
    ];

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterTabsContainer}
        contentContainerStyle={styles.filterTabsContent}
      >
        {filters.map(({ type, labelKey, icon, count }) => {
          const isActive = searchFilter === type;
          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterTab,
                isActive && { backgroundColor: appleMusicColor },
              ]}
              onPress={() => setSearchFilter(type)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${t(labelKey)} (${count})`}
            >
              <Icon
                name={icon}
                size={20}
                color={isActive ? themeColors.white : themeColors.textPrimary}
              />
              <Text
                style={[
                  styles.filterTabCount,
                  { color: isActive ? themeColors.white : themeColors.textSecondary },
                ]}
              >
                {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  // Render "Alle" (All) tab content - shows sections with limited items
  const renderAllResults = () => (
    <>
      {/* Songs Section */}
      {resultCounts.songs > 0 && (
        <View style={styles.resultSection}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
            {t('modules.appleMusic.search.songsTitle')}
          </Text>
          {searchResults?.songs?.slice(0, ITEMS_PER_SECTION).map((song, index) => renderSongItem(song, index))}
          {resultCounts.songs > ITEMS_PER_SECTION && renderShowAllButton('songs', resultCounts.songs)}
        </View>
      )}

      {/* Albums Section */}
      {resultCounts.albums > 0 && (
        <View style={styles.resultSection}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
            {t('modules.appleMusic.search.albumsTitle')}
          </Text>
          {searchResults?.albums?.slice(0, ITEMS_PER_SECTION).map((album, index) => renderAlbumItem(album, index))}
          {resultCounts.albums > ITEMS_PER_SECTION && renderShowAllButton('albums', resultCounts.albums)}
        </View>
      )}

      {/* Artists Section */}
      {resultCounts.artists > 0 && (
        <View style={styles.resultSection}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
            {t('modules.appleMusic.search.artistsTitle')}
          </Text>
          {searchResults?.artists?.slice(0, ITEMS_PER_SECTION).map((artist, index) => renderArtistItem(artist, index))}
          {resultCounts.artists > ITEMS_PER_SECTION && renderShowAllButton('artists', resultCounts.artists)}
        </View>
      )}

      {/* Playlists Section */}
      {resultCounts.playlists > 0 && (
        <View style={styles.resultSection}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
            {t('modules.appleMusic.search.playlistsTitle')}
          </Text>
          {searchResults?.playlists?.slice(0, ITEMS_PER_SECTION).map((playlist, index) => renderPlaylistItem(playlist, index))}
          {resultCounts.playlists > ITEMS_PER_SECTION && renderShowAllButton('playlists', resultCounts.playlists)}
        </View>
      )}
    </>
  );

  // Render filtered results (single type)
  const renderFilteredResults = () => {
    switch (searchFilter) {
      case 'songs':
        return searchResults?.songs?.map((song, index) => renderSongItem(song, index));
      case 'albums':
        return searchResults?.albums?.map((album, index) => renderAlbumItem(album, index));
      case 'artists':
        return searchResults?.artists?.map((artist, index) => renderArtistItem(artist, index));
      case 'playlists':
        return searchResults?.playlists?.map((playlist, index) => renderPlaylistItem(playlist, index));
      default:
        return null;
    }
  };

  const renderSearchTab = () => (
    <View style={styles.tabContent}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmit={handleSearch}
        placeholder={t('modules.appleMusic.search.placeholder')}
        searchButtonLabel={t('modules.appleMusic.search.button')}
        maxLength={SEARCH_MAX_LENGTH}
      />

      {isSearching && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={appleMusicColor} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>{t('common.loading')}</Text>
        </View>
      )}

      {searchError && (
        <View style={[styles.errorBanner, { backgroundColor: themeColors.errorLight }]}>
          <Icon name="warning" size={24} color={themeColors.error} />
          <Text style={[styles.errorText, { color: themeColors.error }]}>{t('modules.appleMusic.search.error')}</Text>
          <TouchableOpacity onPress={clearSearch}>
            <Text style={[styles.errorDismiss, { color: themeColors.error }]}>{t('common.dismiss')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter tabs - only show when we have results */}
      {hasAnyResults && renderSearchFilterTabs()}

      {/* Results */}
      {hasAnyResults && (
        <ScrollView
          ref={scrollRef}
          style={styles.resultsList}
          contentContainerStyle={[
            styles.resultsContent,
            { paddingBottom: bottomPadding + insets.bottom },
          ]}
        >
          {searchFilter === 'all' ? renderAllResults() : renderFilteredResults()}
        </ScrollView>
      )}

      {/* No results state */}
      {!isSearching && !hasAnyResults && searchQuery && (
        <View style={styles.emptyState}>
          <Icon name="search" size={48} color={themeColors.textSecondary} />
          <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
            {t('modules.appleMusic.search.noResults')}
          </Text>
        </View>
      )}
    </View>
  );

  // ============================================================
  // Library Tab Content
  // ============================================================

  const renderLibraryTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.emptyState}>
        <Icon name="appleMusic" size={48} color={themeColors.textSecondary} />
        <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
          {t('modules.appleMusic.library.comingSoon')}
        </Text>
      </View>
    </View>
  );

  // ============================================================
  // Playlists Tab Content
  // ============================================================

  const renderPlaylistsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.emptyState}>
        <Icon name="list" size={48} color={themeColors.textSecondary} />
        <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
          {t('modules.appleMusic.playlists.comingSoon')}
        </Text>
      </View>
    </View>
  );

  // ============================================================
  // Main iOS Content
  // ============================================================

  const renderIOSContent = () => {
    // Not authorized
    if (authStatus !== 'authorized') {
      return renderAuthRequired();
    }

    return (
      <View style={styles.mainContent}>
        {/* Tab Bar */}
        <View style={[styles.tabBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'search' && styles.tabActive, activeTab === 'search' && { borderBottomColor: appleMusicColor }]}
            onPress={() => setActiveTab('search')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'search' }}
          >
            <Icon
              name="search"
              size={20}
              color={activeTab === 'search' ? appleMusicColor : themeColors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                { color: themeColors.textSecondary },
                activeTab === 'search' && { color: appleMusicColor },
              ]}
            >
              {t('modules.appleMusic.tabs.search')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'library' && styles.tabActive, activeTab === 'library' && { borderBottomColor: appleMusicColor }]}
            onPress={() => setActiveTab('library')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'library' }}
          >
            <Icon
              name="appleMusic"
              size={20}
              color={activeTab === 'library' ? appleMusicColor : themeColors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                { color: themeColors.textSecondary },
                activeTab === 'library' && { color: appleMusicColor },
              ]}
            >
              {t('modules.appleMusic.tabs.library')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'playlists' && styles.tabActive, activeTab === 'playlists' && { borderBottomColor: appleMusicColor }]}
            onPress={() => setActiveTab('playlists')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'playlists' }}
          >
            <Icon
              name="list"
              size={20}
              color={activeTab === 'playlists' ? appleMusicColor : themeColors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                { color: themeColors.textSecondary },
                activeTab === 'playlists' && { color: appleMusicColor },
              ]}
            >
              {t('modules.appleMusic.tabs.playlists')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'search' && renderSearchTab()}
        {activeTab === 'library' && renderLibraryTab()}
        {activeTab === 'playlists' && renderPlaylistsTab()}
      </View>
    );
  };

  // ============================================================
  // Render
  // ============================================================

  // Determine if we should show the React Native MiniPlayer
  // Only show RN player when Glass Player is NOT available (iOS <26 or Android)
  const shouldShowRNMiniPlayer =
    !isCheckingGlassPlayerAvailability &&
    !isGlassPlayerAvailable &&
    currentSong &&
    !isPlayerExpanded;

  // Determine if Glass Player mini is visible (iOS 26+)
  const isGlassMiniVisible = isGlassPlayerAvailable && isGlassPlayerVisible && currentSong;

  // Calculate bottom padding
  // Both React Native MiniPlayer and Glass Player mini window need bottom padding
  // Glass Player floating bar: 88pt height + 20pt margin + safe area
  const GLASS_MINI_PLAYER_HEIGHT = 88 + 20;
  const bottomPadding = shouldShowRNMiniPlayer
    ? MINI_PLAYER_HEIGHT + spacing.md
    : isGlassMiniVisible
      ? GLASS_MINI_PLAYER_HEIGHT + spacing.md
      : spacing.md;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ModuleHeader
        moduleId="appleMusic"
        icon="appleMusic"
        title={t('modules.appleMusic.title')}
        currentSource="appleMusic"
        showAdMob={true}
      />

      <View style={styles.content}>
        {/* Android: Show app detection UI */}
        {isAndroid && (
          authStatus === 'app_installed'
            ? renderAndroidInstalled()
            : renderAndroidNotInstalled()
        )}

        {/* iOS: Show full functionality */}
        {!isAndroid && renderIOSContent()}
      </View>

      {/* Mini Player (iOS <26 / Android fallback)
          On iOS 26+, the native GlassPlayerWindow handles this */}
      {shouldShowRNMiniPlayer && (
        <MiniPlayer
          moduleId="appleMusic"
          artwork={currentSong.artworkUrl || null}
          title={currentSong.title}
          subtitle={currentSong.artistName}
          accentColor={appleMusicColor}
          isPlaying={isPlaying}
          isLoading={isPlaybackLoading}
          progressType="bar"
          progress={(playbackState?.currentTime ?? 0) / (playbackState?.duration || 1)}
          onPress={() => setIsPlayerExpanded(true)}
          onPlayPause={handlePlayPause}
          style={styles.miniPlayer}
        />
      )}

      {/* Expanded Player (iOS <26 / Android fallback)
          On iOS 26+, the native GlassPlayerWindow handles this entirely.
          We should NOT render the RN player at all when Glass Player is available.
          Also don't render while checking availability to prevent flash. */}
      {!isAndroid && !isCheckingGlassPlayerAvailability && !isGlassPlayerAvailable && (
        <ExpandedAudioPlayer
          visible={isPlayerExpanded}
          moduleId="appleMusic"
          artwork={currentSong?.artworkUrl || null}
          title={currentSong?.title || ''}
          subtitle={currentSong?.artistName}
          accentColor={appleMusicColor}
          isPlaying={isPlaying}
          isLoading={isPlaybackLoading}
          isBuffering={false}
          position={playbackState?.currentTime ?? 0}
          duration={playbackState?.duration ?? 0}
          onSeek={() => {}}
          onPlayPause={handlePlayPause}
          onClose={() => setIsPlayerExpanded(false)}
          showAdMob={true}
          controls={{
            seekSlider: true,
            skipButtons: true,
            speedControl: false,
            sleepTimer: true,
            favorite: true,
            shuffle: true,
            repeat: true,
            addToLibrary: true,
          }}
          onSkipBackward={skipToPrevious}
          onSkipForward={skipToNext}
          shuffleMode={shuffleMode}
          onShufflePress={() => setShuffleMode(shuffleMode === 'off' ? 'songs' : 'off')}
          repeatMode={repeatMode}
          onRepeatPress={() => {
            // Cycle through: off -> all -> one -> off
            const nextMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
            setRepeatMode(nextMode);
          }}
          isInLibrary={currentSongInLibrary}
          isAddingToLibrary={isAddingToLibrary}
          onAddToLibraryPress={handleAddToLibrary}
        />
      )}

      {/* Detail Modal for Artist/Album/Playlist */}
      <AppleMusicDetailModal
        visible={detailModal.visible}
        type={detailModal.type}
        id={detailModal.id}
        onClose={handleCloseDetailModal}
        initialData={detailModal.initialData}
      />
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
  },
  miniPlayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  // Centered container (auth, android screens)
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  authTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  authDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    minHeight: touchTargets.comfortable,
  },
  authButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
  },
  tabActive: {
    borderBottomWidth: 2,
    // borderBottomColor is set inline with dynamic appleMusicColor
  },
  tabText: {
    ...typography.label,
    color: colors.textSecondary,
  },

  // Tab content
  tabContent: {
    flex: 1,
    padding: spacing.md,
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
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    flex: 1,
  },
  errorDismiss: {
    ...typography.label,
    color: colors.error,
    fontWeight: '600',
  },

  // Results list
  resultsList: {
    flex: 1,
  },
  resultsContent: {
    // paddingBottom is set dynamically in contentContainerStyle for mini player
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  // Song item
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    minHeight: touchTargets.comfortable,
  },
  songTappableArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  songArtwork: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.sm,
  },
  songArtworkPlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  songArtist: {
    ...typography.label,
    color: colors.textSecondary,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // Filter tabs for search results
  filterTabsContainer: {
    flexGrow: 0,
    marginBottom: spacing.md,
  },
  filterTabsContent: {
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
  },
  filterTab: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  filterTabCount: {
    ...typography.label,
    fontWeight: '600',
  },

  // Result sections
  resultSection: {
    marginBottom: spacing.lg,
  },

  // Show all button
  showAllButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
  },
  showAllText: {
    ...typography.body,
    fontWeight: '600',
  },

  // Artist artwork (rounded)
  artistArtwork: {
    borderRadius: 28,  // Half of 56 width for circular
  },
});
