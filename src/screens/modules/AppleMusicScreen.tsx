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
  Alert,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import {
  Icon,
  IconButton,
  VoiceFocusable,
  PlayingWaveIcon,
  MiniPlayer,
  ExpandedAudioPlayer,
  ModuleHeader,
  SearchBar,
  LoadingView,
  ErrorView,
  AppleMusicDetailModal,
  QueueView,
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
  type RecentlyPlayedItem,
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

type TabType = 'myMusic' | 'search';

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
    playAlbum,
    playPlaylist,
    playStation,
    pause,
    resume,
    stop,
    togglePlayback,
    skipToNext,
    skipToPrevious,
    seekTo,
    setShuffleMode,
    setRepeatMode,
    // Sleep timer
    setSleepTimerActive,
    // Search
    searchCatalog,
    // Library (used for Favorites)
    addToLibrary,
    isInLibrary,
    // Library Cache (preloaded at startup - used for Favorites tab)
    libraryCache,
    isLibraryCacheLoading,
    // Queue
    queue,
    // Discovery
    recentlyPlayed,
    isRecentlyPlayedLoading,
    topCharts: topChartsData,
    isTopChartsLoading,
    loadTopCharts,
    recentLibraryItems,
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
  const [activeTab, setActiveTab] = useState<TabType>('myMusic');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [isQueueVisible, setIsQueueVisible] = useState(false);
  const [searchFilter, setSearchFilter] = useState<SearchFilterType>('all');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAllRecentlyPlayed, setShowAllRecentlyPlayed] = useState(false);

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

  // Library state (for current song in player)
  const [currentSongInLibrary, setCurrentSongInLibrary] = useState(false);
  const [isAddingToLibrary, setIsAddingToLibrary] = useState(false);

  // Track which search result songs are in library (for heart icon display)
  const [searchResultsInLibrary, setSearchResultsInLibrary] = useState<Set<string>>(new Set());
  const [isCheckingLibraryStatus, setIsCheckingLibraryStatus] = useState(false);

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
    showFromMinimized: showGlassFromMinimized,
  } = useGlassPlayer({
    onPlayPause: async () => {
      // Use togglePlayback which checks native state directly
      // This avoids race conditions with stale isPlaying values in closures
      console.log('[AppleMusicScreen] onPlayPause from native - using togglePlayback');
      await togglePlayback();
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
  // Glass Player is system-wide - shows regardless of which screen is focused
  useEffect(() => {
    if (!isGlassPlayerAvailable || !currentSong) {
      return;
    }

    // Only show if not already visible (avoid duplicate calls)
    if (isGlassPlayerVisible) {
      return;
    }

    // Use effectiveArtworkUrl which prefers cached search result URLs over MusicKit queue URLs
    const artworkUrl = effectiveArtworkUrl;

    console.log('[AppleMusicScreen] Showing Glass Player with artwork:', artworkUrl);

    // Configure controls for Apple Music (skip buttons, shuffle, repeat, etc.)
    // Apple Music: NO stop button (pause is sufficient for on-demand content)
    configureGlassControls({
      seekSlider: true,
      skipButtons: true,
      speedControl: false,
      sleepTimer: true,
      favorite: true,
      stopButton: false,  // Apple Music doesn't need stop (pause is sufficient)
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
      showStopButton: false,  // Apple Music doesn't need stop button
    });
  }, [isGlassPlayerAvailable, isGlassPlayerVisible, currentSong, effectiveArtworkUrl, showGlassMiniPlayer, configureGlassControls, appleMusicColor, playbackState?.currentTime, playbackState?.duration]);

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
      showStopButton: false,  // Apple Music doesn't need stop button
    });
  }, [isGlassPlayerAvailable, isGlassPlayerVisible, currentSong, effectiveArtworkUrl, playbackState?.currentTime, playbackState?.duration, appleMusicColor, updateGlassContent]);

  // Effect 4: REMOVED - Glass Player is system-wide and should NOT hide on navigation
  // The Glass Player window stays visible while music plays, regardless of which screen is focused.
  // Only hide when playback actually stops (Effect 6).

  // Effect 6: Hide native player when playback stops (no current song)
  useEffect(() => {
    if (!currentSong && isGlassPlayerAvailable && isGlassPlayerVisible) {
      console.debug('[AppleMusicScreen] Hiding Glass Player - no current song');
      hideGlassPlayer();
    }
  }, [currentSong, isGlassPlayerAvailable, isGlassPlayerVisible, hideGlassPlayer]);

  // Effect 7: REMOVED - No need to re-show since we don't hide on navigation anymore

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

  // Effect 9: Check library status for search result songs (for heart icon)
  useEffect(() => {
    if (!searchResults?.songs?.length || !isAuthorized || !isIOS) {
      setSearchResultsInLibrary(new Set());
      return;
    }

    const checkLibraryStatus = async () => {
      setIsCheckingLibraryStatus(true);
      const inLibrarySet = new Set<string>();

      // Check each song in parallel (batch of promises)
      const checks = searchResults.songs!.map(async (song) => {
        try {
          const inLib = await isInLibrary(song.id);
          if (inLib) {
            inLibrarySet.add(song.id);
          }
        } catch {
          // Ignore errors for individual checks
        }
      });

      await Promise.all(checks);
      setSearchResultsInLibrary(inLibrarySet);
      setIsCheckingLibraryStatus(false);
    };

    checkLibraryStatus();
  }, [searchResults?.songs, isAuthorized, isIOS, isInLibrary]);

  // ============================================================
  // Handlers
  // ============================================================

  const getLibraryErrorMessage = useCallback((error: any): string => {
    const code = error?.code ?? '';
    switch (code) {
      case 'CLOUD_LIBRARY_DISABLED':
        return t('modules.appleMusic.library.cloudLibraryDisabled');
      case 'NO_SUBSCRIPTION':
        return t('modules.appleMusic.library.noSubscription');
      case 'CATALOG_FETCH_ERROR':
        return t('modules.appleMusic.library.catalogFetchError');
      case 'LIBRARY_ADD_ERROR':
      default:
        return t('modules.appleMusic.library.addErrorGeneric');
    }
  }, [t]);

  const handleAddToLibrary = useCallback(async () => {
    if (!currentSong?.id || currentSongInLibrary || isAddingToLibrary) return;

    setIsAddingToLibrary(true);
    try {
      await addToLibrary(currentSong.id);
      setCurrentSongInLibrary(true);
      triggerFeedback('success');
    } catch (error: any) {
      console.error('[AppleMusicScreen] Failed to add to library:', error);
      Alert.alert(
        t('modules.appleMusic.library.addError'),
        getLibraryErrorMessage(error),
      );
    } finally {
      setIsAddingToLibrary(false);
    }
  }, [currentSong?.id, currentSongInLibrary, isAddingToLibrary, addToLibrary, triggerFeedback, t, getLibraryErrorMessage]);

  // Handler for toggling library status from search results
  const handleToggleSearchResultLibrary = useCallback(async (song: AppleMusicSong) => {
    const isCurrentlyInLibrary = searchResultsInLibrary.has(song.id);

    if (isCurrentlyInLibrary) {
      // Song is already in library - Apple Music API doesn't support removal
      // Show info alert
      Alert.alert(
        t('modules.appleMusic.inLibrary'),
        t('modules.appleMusic.library.alreadyInLibraryMessage', { title: song.title })
      );
    } else {
      // Add to library
      try {
        await addToLibrary(song.id);
        // Update local state optimistically
        setSearchResultsInLibrary(prev => {
          const next = new Set(prev);
          next.add(song.id);
          return next;
        });
        // Provide haptic feedback
        triggerFeedback('success');
      } catch (error: any) {
        console.error('[AppleMusicScreen] Failed to add to library:', error);
        Alert.alert(
          t('modules.appleMusic.library.addError'),
          getLibraryErrorMessage(error),
        );
      }
    }
  }, [searchResultsInLibrary, addToLibrary, triggerFeedback, t, getLibraryErrorMessage]);

  // Handle tap on recently played container
  const handleRecentlyPlayedTap = useCallback((item: RecentlyPlayedItem) => {
    triggerFeedback('tap');
    if (item.type === 'album') {
      // Open album detail modal with tracklist
      setDetailModal({
        visible: true,
        type: 'album',
        id: item.id,
        initialData: {
          id: item.id,
          title: item.title,
          artistName: item.subtitle,
          artworkUrl: item.artworkUrl,
          trackCount: item.trackCount ?? 0,
        } as AppleMusicAlbum,
      });
    } else if (item.type === 'playlist') {
      void playPlaylist(item.id);
    } else if (item.type === 'station') {
      void playStation(item.id);
    } else if (item.type === 'song') {
      void playSong(item.id, item.artworkUrl);
    }
  }, [triggerFeedback, playPlaylist, playStation, playSong]);

  const handleSearch = useCallback(async () => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      console.debug('[AppleMusicScreen] Searching catalog');
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

    // If tapping the currently playing song, restore the mini player instead of restarting
    if (currentSong && currentSong.id === song.id && isPlaying) {
      console.log('[AppleMusicScreen] Song already playing, restoring mini player');
      await showGlassFromMinimized();
      return;
    }

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
  }, [playSong, triggerFeedback, t, currentSong, isPlaying, showGlassFromMinimized]);

  const handlePlayPause = useCallback(() => {
    triggerFeedback('tap');
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [isPlaying, pause, resume, triggerFeedback]);

  // Shuffle all library songs — sets shuffle mode then plays the first library song
  const handleShuffleAll = useCallback(async () => {
    triggerFeedback('tap');
    const songs = libraryCache?.songs;
    if (!songs || songs.length === 0) return;

    try {
      // Enable shuffle mode first, then play a song — MusicKit will shuffle the queue
      await setShuffleMode('songs');
      await playSong(songs[0].id, songs[0].artworkUrl);
    } catch (error) {
      console.error('[AppleMusicScreen] Shuffle all error:', error);
    }
  }, [triggerFeedback, libraryCache?.songs, setShuffleMode, playSong]);

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
  const renderSongItem = (song: AppleMusicSong, index: number) => {
    const isInLib = searchResultsInLibrary.has(song.id);
    const isCurrentSong = currentSong && currentSong.id === song.id;

    return (
      <VoiceFocusable
        key={song.id}
        id={song.id}
        label={`${song.title} ${song.artistName}`}
        index={index}
        onSelect={() => handlePlaySong(song)}
      >
        <View style={[
          styles.songItem,
          { backgroundColor: themeColors.surface },
          isCurrentSong && {
            borderWidth: 2,
            borderColor: accentColor.primary,
          },
        ]}>
          {/* Playing wave icon — shown for currently playing song */}
          {isCurrentSong && (
            <View style={styles.songPlayingWaveContainer}>
              <PlayingWaveIcon
                color={accentColor.primary}
                size={20}
                isPlaying={isPlaying}
              />
            </View>
          )}
          <TouchableOpacity
            style={styles.songTappableArea}
            onPress={() => handlePlaySong(song)}
            onLongPress={() => {}}
            delayLongPress={300}
            accessibilityRole="button"
            accessibilityLabel={`${song.title} ${t('common.by')} ${song.artistName}`}
            accessibilityState={{ selected: isCurrentSong ?? false }}
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
          <View style={styles.songItemActions}>
            <IconButton
              icon={isInLib ? 'heart-filled' : 'heart'}
              iconActive="heart-filled"
              isActive={isInLib}
              size={24}
              onPress={() => handleToggleSearchResultLibrary(song)}
              accessibilityLabel={isInLib
                ? t('modules.appleMusic.inLibrary')
                : t('modules.appleMusic.addToLibrary')
              }
              style={styles.songItemHeartButton}
            />
            <IconButton
              icon={isCurrentSong && isPlaying ? 'pause' : 'play'}
              size={28}
              onPress={() => handlePlaySong(song)}
              accessibilityLabel={t('modules.appleMusic.play', { title: song.title })}
            />
          </View>
        </View>
      </VoiceFocusable>
    );
  };

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
                color={isActive ? themeColors.textOnPrimary : themeColors.textPrimary}
              />
              <Text
                style={[
                  styles.filterTabCount,
                  { color: isActive ? themeColors.textOnPrimary : themeColors.textSecondary },
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

  // Show discovery when search tab is open but no search results yet
  const showDiscovery = !isSearching && !hasAnyResults && !searchQuery;

  // Load top charts when discovery or myMusic tab becomes visible
  useEffect(() => {
    if (!isAuthorized) return;
    if ((showDiscovery && activeTab === 'search') || activeTab === 'myMusic') {
      void loadTopCharts();
    }
  }, [showDiscovery, activeTab, isAuthorized, loadTopCharts]);

  // Render discovery sections (shown before user searches)
  const renderDiscoverySections = () => (
    <ScrollView
      style={styles.resultsList}
      contentContainerStyle={[
        styles.resultsContent,
        { paddingBottom: bottomPadding + insets.bottom },
      ]}
    >
      {/* Layer 1: Recently Played (MusicKit API — albums, playlists, stations) */}
      {(isRecentlyPlayedLoading || recentlyPlayed.length > 0) && (
        <View style={styles.discoverySection}>
          <Text style={[styles.discoverySectionTitle, { color: themeColors.textPrimary }]}>
            {t('modules.appleMusic.discovery.recentlyPlayed')}
          </Text>
          {isRecentlyPlayedLoading ? (
            <ActivityIndicator size="small" color={appleMusicColor} style={styles.discoveryLoader} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.discoveryRow}>
              {recentlyPlayed.slice(0, 10).map((item) => (
                <TouchableOpacity
                  key={`${item.type}-${item.id}`}
                  style={[styles.discoveryCard, { backgroundColor: themeColors.surface }]}
                  onPress={() => handleRecentlyPlayedTap(item)}
                  onLongPress={() => {}}
                  delayLongPress={300}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}${item.subtitle ? `, ${item.subtitle}` : ''}`}
                  accessibilityHint={
                    item.type === 'album'
                      ? t('modules.appleMusic.discovery.albumHint')
                      : t('modules.appleMusic.discovery.playHint')
                  }
                >
                  {item.artworkUrl ? (
                    <Image
                      source={{ uri: item.artworkUrl }}
                      style={styles.discoveryArtwork}
                    />
                  ) : (
                    <View style={[styles.discoveryArtwork, styles.discoveryArtworkPlaceholder, { backgroundColor: themeColors.border }]}>
                      <Icon name="appleMusic" size={32} color={themeColors.textSecondary} />
                    </View>
                  )}
                  <Text style={[styles.discoveryCardTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text style={[styles.discoveryCardSubtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
              {/* "Toon alles" card at the end */}
              {recentlyPlayed.length > 10 && (
                <TouchableOpacity
                  style={[styles.discoveryCard, styles.showAllCard, { backgroundColor: themeColors.surface }]}
                  onPress={() => {
                    triggerFeedback('tap');
                    setShowAllRecentlyPlayed(true);
                  }}
                  onLongPress={() => {}}
                  delayLongPress={300}
                  accessibilityRole="button"
                  accessibilityLabel={t('modules.appleMusic.discovery.showAll')}
                >
                  <View style={[styles.discoveryArtwork, styles.showAllArtwork, { backgroundColor: appleMusicColor + '20' }]}>
                    <Icon name="chevronRight" size={32} color={appleMusicColor} />
                  </View>
                  <Text style={[styles.discoveryCardTitle, { color: appleMusicColor }]} numberOfLines={2}>
                    {t('modules.appleMusic.discovery.showAll')}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* Layer 2: Popular Now (Top Charts) */}
      {(isTopChartsLoading || (topChartsData?.songs && topChartsData.songs.length > 0)) && (
        <View style={styles.discoverySection}>
          <Text style={[styles.discoverySectionTitle, { color: themeColors.textPrimary }]}>
            {t('modules.appleMusic.discovery.popularNow')}
          </Text>
          {isTopChartsLoading ? (
            <ActivityIndicator size="small" color={appleMusicColor} style={styles.discoveryLoader} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.discoveryRow}>
              {topChartsData?.songs?.slice(0, 10).map((song) => (
                <TouchableOpacity
                  key={song.id}
                  style={[styles.discoveryCard, { backgroundColor: themeColors.surface }]}
                  onPress={() => {
                    triggerFeedback('tap');
                    void playSong(song.id, song.artworkUrl);
                  }}
                  onLongPress={() => {}}
                  delayLongPress={300}
                  accessibilityRole="button"
                  accessibilityLabel={`${song.title} ${t('common.by')} ${song.artistName}`}
                >
                  {song.artworkUrl && song.artworkUrl.startsWith('http') ? (
                    <Image
                      source={{ uri: song.artworkUrl.replace('{w}', '120').replace('{h}', '120') }}
                      style={styles.discoveryArtwork}
                    />
                  ) : (
                    <View style={[styles.discoveryArtwork, styles.discoveryArtworkPlaceholder, { backgroundColor: themeColors.border }]}>
                      <Icon name="appleMusic" size={32} color={themeColors.textSecondary} />
                    </View>
                  )}
                  <Text style={[styles.discoveryCardTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
                    {song.title}
                  </Text>
                  <Text style={[styles.discoveryCardSubtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>
                    {song.artistName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Layer 3: From Your Library */}
      {recentLibraryItems.length > 0 && (
        <View style={styles.discoverySection}>
          <Text style={[styles.discoverySectionTitle, { color: themeColors.textPrimary }]}>
            {t('modules.appleMusic.discovery.fromLibrary')}
          </Text>
          {recentLibraryItems.slice(0, 5).map((song, index) => (
            <TouchableOpacity
              key={song.id}
              style={[styles.discoveryListItem, { backgroundColor: themeColors.surface }]}
              onPress={() => {
                triggerFeedback('tap');
                void playSong(song.id, song.artworkUrl);
              }}
              onLongPress={() => {}}
              delayLongPress={300}
              accessibilityRole="button"
              accessibilityLabel={`${song.title} ${t('common.by')} ${song.artistName}`}
            >
              {song.artworkUrl && song.artworkUrl.startsWith('http') ? (
                <Image
                  source={{ uri: song.artworkUrl.replace('{w}', '50').replace('{h}', '50') }}
                  style={styles.discoveryListArtwork}
                />
              ) : (
                <View style={[styles.discoveryListArtwork, styles.discoveryArtworkPlaceholder, { backgroundColor: themeColors.border }]}>
                  <Icon name="appleMusic" size={20} color={themeColors.textSecondary} />
                </View>
              )}
              <View style={styles.discoveryListInfo}>
                <Text style={[styles.discoveryListTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                  {song.title}
                </Text>
                <Text style={[styles.discoveryListSubtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  {song.artistName} — {song.albumTitle}
                </Text>
              </View>
              <Icon name="play" size={24} color={appleMusicColor} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Empty discovery state (nothing to show yet) */}
      {!isRecentlyPlayedLoading && recentlyPlayed.length === 0 && !isTopChartsLoading && !topChartsData?.songs?.length && recentLibraryItems.length === 0 && (
        <View style={styles.emptyState}>
          <Icon name="search" size={48} color={themeColors.textSecondary} />
          <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
            {t('modules.appleMusic.discovery.emptyHint')}
          </Text>
        </View>
      )}
    </ScrollView>
  );

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
        <LoadingView />
      )}

      {searchError && (
        <ErrorView
          message={t('modules.appleMusic.search.error')}
          onRetry={clearSearch}
          retryText={t('common.dismiss')}
        />
      )}

      {/* Discovery sections (shown before user searches) */}
      {showDiscovery && renderDiscoverySections()}

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
  // My Music Tab Content - "Mijn Muziek"
  // Combines: Library (songs/albums/artists) + Recently Played + Shuffle All
  // ============================================================

  const renderMyMusicTab = () => {
    const librarySongs = libraryCache?.songs ?? [];
    const libraryAlbums = libraryCache?.albums ?? [];
    const libraryArtists = libraryCache?.artists ?? [];
    const hasLibrary = librarySongs.length > 0 || libraryAlbums.length > 0 || libraryArtists.length > 0;
    const hasContent = hasLibrary || recentlyPlayed.length > 0;

    return (
      <View style={styles.tabContent}>
        {/* Loading state */}
        {(isLibraryCacheLoading || isRecentlyPlayedLoading) && !hasContent && (
          <LoadingView />
        )}

        {/* Content */}
        {hasContent && (
          <ScrollView
            style={styles.resultsList}
            contentContainerStyle={[
              styles.resultsContent,
              { paddingBottom: bottomPadding + insets.bottom },
            ]}
          >
            {/* Shuffle All button — prominent at top */}
            {librarySongs.length > 0 && (
              <TouchableOpacity
                style={[styles.shuffleAllButton, { backgroundColor: appleMusicColor }]}
                onPress={handleShuffleAll}
                onLongPress={() => {}}
                delayLongPress={300}
                accessibilityRole="button"
                accessibilityLabel={t('modules.appleMusic.myMusic.shuffleAll')}
              >
                <Icon name="shuffle" size={24} color="#FFFFFF" />
                <Text style={styles.shuffleAllText}>
                  {t('modules.appleMusic.myMusic.shuffleAll')}
                </Text>
              </TouchableOpacity>
            )}

            {/* Recently Played section */}
            {recentlyPlayed.length > 0 && (
              <View style={styles.favoritesSection}>
                <Text style={[styles.discoverySectionTitle, { color: themeColors.textPrimary }]}>
                  {t('modules.appleMusic.discovery.recentlyPlayed')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.discoveryRow}>
                  {recentlyPlayed.slice(0, 10).map((item) => (
                    <TouchableOpacity
                      key={`${item.type}-${item.id}`}
                      style={[styles.discoveryCard, { backgroundColor: themeColors.surface }]}
                      onPress={() => handleRecentlyPlayedTap(item)}
                      onLongPress={() => {}}
                      delayLongPress={300}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.title}${item.subtitle ? `, ${item.subtitle}` : ''}`}
                    >
                      {item.artworkUrl ? (
                        <Image
                          source={{ uri: item.artworkUrl }}
                          style={styles.discoveryArtwork}
                        />
                      ) : (
                        <View style={[styles.discoveryArtwork, styles.discoveryArtworkPlaceholder, { backgroundColor: themeColors.border }]}>
                          <Icon name="appleMusic" size={32} color={themeColors.textSecondary} />
                        </View>
                      )}
                      <Text style={[styles.discoveryCardTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
                        {item.title}
                      </Text>
                      {item.subtitle ? (
                        <Text style={[styles.discoveryCardSubtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                  {/* "Toon alles" card at the end */}
                  {recentlyPlayed.length > 10 && (
                    <TouchableOpacity
                      style={[styles.discoveryCard, styles.showAllCard, { backgroundColor: themeColors.surface }]}
                      onPress={() => {
                        triggerFeedback('tap');
                        setShowAllRecentlyPlayed(true);
                      }}
                      onLongPress={() => {}}
                      delayLongPress={300}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.appleMusic.discovery.showAll')}
                    >
                      <View style={[styles.discoveryArtwork, styles.showAllArtwork, { backgroundColor: appleMusicColor + '20' }]}>
                        <Icon name="chevronRight" size={32} color={appleMusicColor} />
                      </View>
                      <Text style={[styles.discoveryCardTitle, { color: appleMusicColor }]} numberOfLines={2}>
                        {t('modules.appleMusic.discovery.showAll')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}

            {/* Library Songs section */}
            {librarySongs.length > 0 && (
              <View style={styles.favoritesSection}>
                <Text style={[styles.discoverySectionTitle, { color: themeColors.textPrimary }]}>
                  {t('modules.appleMusic.favorites.songs')} ({librarySongs.length})
                </Text>
                {librarySongs.slice(0, 10).map((song, index) => renderSongItem(song, index))}
                {librarySongs.length > 10 && (
                  <TouchableOpacity
                    style={styles.showAllButton}
                    onPress={() => {
                      triggerFeedback('tap');
                      setActiveTab('search');
                    }}
                    onLongPress={() => {}}
                    delayLongPress={300}
                    accessibilityRole="button"
                    accessibilityLabel={t('modules.appleMusic.favorites.showAllSongs')}
                  >
                    <Text style={[styles.showAllText, { color: appleMusicColor }]}>
                      {t('modules.appleMusic.favorites.showAll', { count: librarySongs.length })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Library Albums section */}
            {libraryAlbums.length > 0 && (
              <View style={styles.favoritesSection}>
                <Text style={[styles.discoverySectionTitle, { color: themeColors.textPrimary }]}>
                  {t('modules.appleMusic.favorites.albums')} ({libraryAlbums.length})
                </Text>
                {libraryAlbums.slice(0, 6).map((album, index) => renderAlbumItem(album, index))}
                {libraryAlbums.length > 6 && (
                  <TouchableOpacity
                    style={styles.showAllButton}
                    onPress={() => {
                      triggerFeedback('tap');
                      setActiveTab('search');
                    }}
                    onLongPress={() => {}}
                    delayLongPress={300}
                    accessibilityRole="button"
                    accessibilityLabel={t('modules.appleMusic.favorites.showAllAlbums')}
                  >
                    <Text style={[styles.showAllText, { color: appleMusicColor }]}>
                      {t('modules.appleMusic.favorites.showAll', { count: libraryAlbums.length })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Library Artists section */}
            {libraryArtists.length > 0 && (
              <View style={styles.favoritesSection}>
                <Text style={[styles.discoverySectionTitle, { color: themeColors.textPrimary }]}>
                  {t('modules.appleMusic.favorites.artists')} ({libraryArtists.length})
                </Text>
                {libraryArtists.slice(0, 6).map((artist, index) => renderArtistItem(artist, index))}
                {libraryArtists.length > 6 && (
                  <TouchableOpacity
                    style={styles.showAllButton}
                    onPress={() => {
                      triggerFeedback('tap');
                      setActiveTab('search');
                    }}
                    onLongPress={() => {}}
                    delayLongPress={300}
                    accessibilityRole="button"
                    accessibilityLabel={t('modules.appleMusic.favorites.showAllArtists')}
                  >
                    <Text style={[styles.showAllText, { color: appleMusicColor }]}>
                      {t('modules.appleMusic.favorites.showAll', { count: libraryArtists.length })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        )}

        {/* Empty state — no library and no recently played */}
        {!isLibraryCacheLoading && !isRecentlyPlayedLoading && !hasContent && (
          <View style={styles.emptyState}>
            <Icon name="appleMusic" size={48} color={themeColors.textSecondary} />
            <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>
              {t('modules.appleMusic.myMusic.emptyTitle')}
            </Text>
            <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
              {t('modules.appleMusic.myMusic.emptyDescription')}
            </Text>
            <TouchableOpacity
              style={[styles.emptyStateButton, { backgroundColor: appleMusicColor }]}
              onPress={() => setActiveTab('search')}
              accessibilityRole="button"
              accessibilityLabel={t('modules.appleMusic.myMusic.searchMusic')}
            >
              <Icon name="search" size={24} color="#FFFFFF" />
              <Text style={[styles.emptyStateButtonText, { color: '#FFFFFF' }]}>
                {t('modules.appleMusic.myMusic.searchMusic')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

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
        {/* Simple 2-tab bar */}
        <View style={[styles.twoTabBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity
            style={[
              styles.twoTab,
              {
                backgroundColor: activeTab === 'myMusic'
                  ? appleMusicColor
                  : themeColors.background,
                borderColor: appleMusicColor,
              },
            ]}
            onPress={() => setActiveTab('myMusic')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'myMusic' }}
            accessibilityLabel={t('modules.appleMusic.tabs.myMusic')}
          >
            <Icon
              name="appleMusic"
              size={22}
              color={activeTab === 'myMusic' ? '#FFFFFF' : appleMusicColor}
            />
            <Text
              style={[
                styles.twoTabText,
                { color: activeTab === 'myMusic' ? '#FFFFFF' : themeColors.textPrimary },
              ]}
              numberOfLines={1}
            >
              {t('modules.appleMusic.tabs.myMusic')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.twoTab,
              {
                backgroundColor: activeTab === 'search'
                  ? appleMusicColor
                  : themeColors.background,
                borderColor: appleMusicColor,
              },
            ]}
            onPress={() => setActiveTab('search')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'search' }}
            accessibilityLabel={t('modules.appleMusic.tabs.search')}
          >
            <Icon
              name="search"
              size={22}
              color={activeTab === 'search' ? '#FFFFFF' : appleMusicColor}
            />
            <Text
              style={[
                styles.twoTabText,
                { color: activeTab === 'search' ? '#FFFFFF' : themeColors.textPrimary },
              ]}
              numberOfLines={1}
            >
              {t('modules.appleMusic.tabs.search')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'myMusic' && renderMyMusicTab()}
        {activeTab === 'search' && renderSearchTab()}
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
            queue: true,
            airplay: true,
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
          queueCount={queue.length}
          onQueuePress={() => setIsQueueVisible(true)}
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

      {/* Show All Recently Played Modal */}
      <Modal
        visible={showAllRecentlyPlayed}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAllRecentlyPlayed(false)}
      >
        <View style={[styles.showAllModal, { backgroundColor: themeColors.background, paddingTop: insets.top }]}>
          {/* Header */}
          <View style={[styles.showAllHeader, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.showAllTitle, { color: themeColors.textPrimary }]}>
              {t('modules.appleMusic.discovery.recentlyPlayed')}
            </Text>
            <IconButton
              icon="close"
              size={28}
              color={themeColors.textPrimary}
              onPress={() => setShowAllRecentlyPlayed(false)}
              accessibilityLabel={t('common.close')}
            />
          </View>
          {/* Full vertical list */}
          <ScrollView
            style={styles.showAllList}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
          >
            {recentlyPlayed.map((item) => (
              <TouchableOpacity
                key={`${item.type}-${item.id}`}
                style={[styles.showAllItem, { backgroundColor: themeColors.surface }]}
                onPress={() => {
                  setShowAllRecentlyPlayed(false);
                  // Small delay to allow modal close animation
                  setTimeout(() => handleRecentlyPlayedTap(item), 300);
                }}
                onLongPress={() => {}}
                delayLongPress={300}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}${item.subtitle ? `, ${item.subtitle}` : ''}`}
              >
                {item.artworkUrl ? (
                  <Image
                    source={{ uri: item.artworkUrl }}
                    style={styles.showAllArtworkImage}
                  />
                ) : (
                  <View style={[styles.showAllArtworkImage, styles.discoveryArtworkPlaceholder, { backgroundColor: themeColors.border }]}>
                    <Icon name="appleMusic" size={24} color={themeColors.textSecondary} />
                  </View>
                )}
                <View style={styles.showAllItemInfo}>
                  <Text style={[styles.showAllItemTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text style={[styles.showAllItemSubtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
                <Icon
                  name={item.type === 'album' ? 'chevronRight' : 'play'}
                  size={24}
                  color={appleMusicColor}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Queue View Modal */}
      <QueueView
        visible={isQueueVisible}
        queue={queue}
        nowPlaying={currentSong}
        accentColor={appleMusicColor}
        onClose={() => setIsQueueVisible(false)}
        onPlaySong={(song) => {
          playSong(song.id, song.artworkUrl);
          setIsQueueVisible(false);
        }}
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

  // Simple 2-tab bar
  twoTabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  twoTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  twoTabText: {
    ...typography.body,
    fontWeight: '600',
  },

  // Shuffle All button
  shuffleAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.comfortable,
    marginBottom: spacing.lg,
  },
  shuffleAllText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
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
  songPlayingWaveContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
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
  songItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  songItemHeartButton: {
    width: touchTargets.minimum - 8,  // Slightly smaller than default (52pt vs 60pt)
    height: touchTargets.minimum - 8,
    borderWidth: 0,  // No border for more subtle appearance
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyStateTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xl,
    minHeight: touchTargets.comfortable,
  },
  emptyStateButtonText: {
    ...typography.body,
    fontWeight: '600',
  },

  // Library/Favorites sections
  favoritesSection: {
    marginBottom: spacing.lg,
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

  // Discovery sections (search tab before searching)
  discoverySection: {
    marginBottom: spacing.lg,
  },
  discoverySectionTitle: {
    ...typography.h3,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  discoveryRow: {
    marginHorizontal: -spacing.md, // Bleed to edges
    paddingHorizontal: spacing.md,
  },
  discoveryCard: {
    width: 140,
    marginRight: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  discoveryArtwork: {
    width: 140,
    height: 140,
    borderTopLeftRadius: borderRadius.md,
    borderTopRightRadius: borderRadius.md,
  },
  discoveryArtworkPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  discoveryCardTitle: {
    ...typography.label,
    fontWeight: '600',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  discoveryCardSubtitle: {
    ...typography.label,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    paddingTop: 2,
  },
  discoveryLoader: {
    marginVertical: spacing.lg,
  },
  discoveryListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    minHeight: touchTargets.comfortable,
  },
  discoveryListArtwork: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
  },
  discoveryListInfo: {
    flex: 1,
  },
  discoveryListTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  discoveryListSubtitle: {
    ...typography.label,
  },

  // "Show All" card in horizontal scroll
  showAllCard: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  showAllArtwork: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // "Show All" full-screen modal
  showAllModal: {
    flex: 1,
  },
  showAllHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  showAllTitle: {
    ...typography.h3,
    fontWeight: '700',
  },
  showAllList: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  showAllItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    minHeight: touchTargets.comfortable,
  },
  showAllArtworkImage: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.sm,
  },
  showAllItemInfo: {
    flex: 1,
  },
  showAllItemTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  showAllItemSubtitle: {
    ...typography.label,
    marginTop: 2,
  },
});
