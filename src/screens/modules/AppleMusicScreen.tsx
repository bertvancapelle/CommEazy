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
  HapticTouchable,
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
import { useMusicFavorites } from '@/hooks/useMusicFavorites';
import { useMusicCollections } from '@/hooks/useMusicCollections';
import { useAlbumFavorites } from '@/hooks/useAlbumFavorites';
import { useArtistFavorites } from '@/hooks/useArtistFavorites';
import { useMusicPlayStats } from '@/hooks/useMusicPlayStats';
import { MusicCollectionChipBar, type MusicChipId } from '@/components/MusicCollectionChipBar';

import { EditMusicCollectionModal } from './EditMusicCollectionModal';
import { SongCollectionModal } from './SongCollectionModal';
import { PlaylistBrowserModal } from './PlaylistBrowserModal';
import type { MusicCollection } from '@/services/music';
import { usePlaylistImportContext } from '@/contexts/PlaylistImportContext';

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

type TabType = 'favorites' | 'search';

// Favorites sub-tab filter
type FavoritesSubTab = 'playlists' | 'albums' | 'artists';

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
  const playlistImportCtx = usePlaylistImportContext();

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
    // Queue
    queue,
    // Discovery
    recentlyPlayed,
    isRecentlyPlayedLoading,
    topCharts: topChartsData,
    isTopChartsLoading,
    loadTopCharts,
    // Playlist import & browser
    getLibraryPlaylists,
    getPlaylistDetails,
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
  const [activeTab, setActiveTab] = useState<TabType>('favorites');
  const [favoritesSubTab, setFavoritesSubTab] = useState<FavoritesSubTab>('playlists');
  const [showFavoritesDropdown, setShowFavoritesDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [isQueueVisible, setIsQueueVisible] = useState(false);
  const [searchFilter, setSearchFilter] = useState<SearchFilterType>('all');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAllRecentlyPlayed, setShowAllRecentlyPlayed] = useState(false);

  // Playlist browser state
  const [showPlaylistBrowser, setShowPlaylistBrowser] = useState(false);

  // Collection detail view (null = show collection list, string = show songs for that collection)
  const [openCollectionId, setOpenCollectionId] = useState<string | null>(null);

  // Music Favorites & Collections (CommEazy local curation)
  const musicFavorites = useMusicFavorites(isFocused);
  const musicCollections = useMusicCollections();
  const albumFavorites = useAlbumFavorites(isFocused);
  const artistFavorites = useArtistFavorites(isFocused);
  const playStats = useMusicPlayStats(isFocused);

  // Play stats maps for sorting favorites by most used
  const playlistStatsMap = playStats.getStatsMap('playlist');
  const albumStatsMap = playStats.getStatsMap('album');
  const artistStatsMap = playStats.getStatsMap('artist');

  // Sorted favorites (by play count, most used first)
  const sortedCollections = useMemo(() => {
    return [...musicCollections.collections].sort((a, b) => {
      const countA = playlistStatsMap.get(a.id)?.playCount ?? 0;
      const countB = playlistStatsMap.get(b.id)?.playCount ?? 0;
      if (countA !== countB) return countB - countA;
      return b.updatedAt - a.updatedAt;
    });
  }, [musicCollections.collections, playlistStatsMap]);

  const sortedAlbums = useMemo(() => {
    return [...albumFavorites.albums].sort((a, b) => {
      const countA = albumStatsMap.get(a.catalogId)?.playCount ?? 0;
      const countB = albumStatsMap.get(b.catalogId)?.playCount ?? 0;
      if (countA !== countB) return countB - countA;
      return b.addedAt - a.addedAt;
    });
  }, [albumFavorites.albums, albumStatsMap]);

  const sortedArtists = useMemo(() => {
    return [...artistFavorites.artists].sort((a, b) => {
      const countA = artistStatsMap.get(a.catalogId)?.playCount ?? 0;
      const countB = artistStatsMap.get(b.catalogId)?.playCount ?? 0;
      if (countA !== countB) return countB - countA;
      return b.addedAt - a.addedAt;
    });
  }, [artistFavorites.artists, artistStatsMap]);

  // Songs for the currently opened collection (collection detail view)
  const openCollection = useMemo(() => {
    if (!openCollectionId) return null;
    return musicCollections.collections.find(c => c.id === openCollectionId) ?? null;
  }, [openCollectionId, musicCollections.collections]);

  const openCollectionSongs: AppleMusicSong[] = useMemo(() => {
    if (!openCollection) return [];
    // Build a Map for O(1) lookup instead of find() per song
    const favMap = new Map(musicFavorites.favorites.map(f => [f.catalogId, f]));
    return openCollection.songCatalogIds
      .map(catalogId => {
        const fav = favMap.get(catalogId);
        if (!fav) return null;
        return {
          id: fav.catalogId,
          title: fav.title,
          artistName: fav.artistName,
          artworkUrl: fav.artworkUrl,
          albumTitle: fav.albumTitle,
          durationInMillis: 0,
        } as AppleMusicSong;
      })
      .filter((s): s is AppleMusicSong => s !== null);
  }, [openCollection, musicFavorites.favorites]);

  const [selectedChipId, setSelectedChipId] = useState<MusicChipId>('all');
  const [editCollectionModal, setEditCollectionModal] = useState<{
    visible: boolean;
    collection: MusicCollection | null;
  }>({ visible: false, collection: null });
  const [songCollectionModal, setSongCollectionModal] = useState<{
    visible: boolean;
    catalogId: string | null;
    title: string;
    artistName: string;
    artworkUrl: string | null;
    albumTitle: string;
  }>({ visible: false, catalogId: null, title: '', artistName: '', artworkUrl: null, albumTitle: '' });

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
  // Playlist Import — Sync progress to floating indicator context
  // ============================================================

  useEffect(() => {
    if (musicCollections.importProgress) {
      playlistImportCtx.updateProgress(musicCollections.importProgress);
    }
  }, [musicCollections.importProgress]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Shuffle all favorites — sets shuffle mode then plays the first favorite
  const handleShuffleAll = useCallback(async () => {
    triggerFeedback('tap');
    const favorites = musicFavorites.favorites;
    if (favorites.length === 0) return;

    try {
      // Enable shuffle mode first, then play a favorite — MusicKit will shuffle the queue
      await setShuffleMode('songs');
      await playSong(favorites[0].catalogId, favorites[0].artworkUrl);
    } catch (error) {
      console.error('[AppleMusicScreen] Shuffle all error:', error);
    }
  }, [triggerFeedback, musicFavorites.favorites, setShuffleMode, playSong]);

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

  // Render a single song item — 1 icon per row
  // context='favorites': filled heart (tap = remove from list or toggle favorite)
  // context='search': empty heart (tap = open "Add to..." modal)
  const renderSongItem = (song: AppleMusicSong, index: number, context: 'favorites' | 'search' = 'favorites') => {
    const isCurrentSong = currentSong && currentSong.id === song.id;

    // Heart press handler depends on context
    const handleHeartPress = () => {
      if (context === 'search') {
        // Search: always open "Add to..." modal
        setSongCollectionModal({
          visible: true,
          catalogId: song.id,
          title: song.title,
          artistName: song.artistName,
          artworkUrl: song.artworkUrl ?? null,
          albumTitle: song.albumTitle ?? '',
        });
      } else if (selectedChipId === 'all') {
        // Favorites "All": toggle favorite (existing behavior)
        musicFavorites.toggle({
          catalogId: song.id,
          title: song.title,
          artistName: song.artistName,
          artworkUrl: song.artworkUrl,
          albumTitle: song.albumTitle,
        });
      } else {
        // Favorites within a list: confirm removal from that list
        const collectionId = selectedChipId.replace('collection:', '');
        const collection = musicCollections.collections.find(c => c.id === collectionId);
        if (collection) {
          Alert.alert(
            t('modules.appleMusic.collections.removeFromList', { name: collection.name }),
            t('modules.appleMusic.collections.removeFromListConfirm', { song: song.title, list: collection.name }),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => musicCollections.removeSongs(collectionId, [song.id]),
              },
            ],
          );
        }
      }
    };

    // In favorites context: always filled. In search: always empty.
    const heartIcon = context === 'favorites' ? 'heart-filled' : 'heart';
    const heartLabel = context === 'search'
      ? t('modules.appleMusic.collections.addToCollection')
      : selectedChipId === 'all'
        ? t('modules.appleMusic.favorites.removeFromFavorites')
        : t('modules.appleMusic.collections.removeFromList', {
            name: musicCollections.collections.find(c => `collection:${c.id}` === selectedChipId)?.name ?? '',
          });

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
              icon={heartIcon}
              iconActive={context === 'favorites' ? 'heart-filled' : undefined}
              isActive={context === 'favorites'}
              size={24}
              onPress={handleHeartPress}
              accessibilityLabel={heartLabel}
              style={styles.songItemHeartButton}
            />
          </View>
        </View>
      </VoiceFocusable>
    );
  };

  // Render a single album item
  const renderAlbumItem = (album: AppleMusicAlbum, index: number) => {
    const isAlbumFav = albumFavorites.isFavorite(album.id);
    return (
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
          <View style={styles.songItemActions}>
            <IconButton
              icon={isAlbumFav ? 'heart-filled' : 'heart'}
              isActive={isAlbumFav}
              size={24}
              onPress={() => {
                void triggerFeedback(isAlbumFav ? 'tap' : 'success');
                void albumFavorites.toggle({
                  catalogId: album.id,
                  title: album.title,
                  artistName: album.artistName,
                  artworkUrl: album.artworkUrl,
                  trackCount: album.trackCount ?? 0,
                });
              }}
              accessibilityLabel={
                isAlbumFav
                  ? t('modules.appleMusic.favorites.removeFromFavorites')
                  : t('modules.appleMusic.favorites.addToFavorites')
              }
              style={styles.songItemHeartButton}
            />
            <Icon name="chevron-right" size={24} color={themeColors.textSecondary} />
          </View>
        </TouchableOpacity>
      </VoiceFocusable>
    );
  };

  // Render a single artist item
  const renderArtistItem = (artist: AppleMusicArtist, index: number) => {
    const isArtistFav = artistFavorites.isFavorite(artist.id);
    return (
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
          <View style={styles.songItemActions}>
            <IconButton
              icon={isArtistFav ? 'heart-filled' : 'heart'}
              isActive={isArtistFav}
              size={24}
              onPress={() => {
                void triggerFeedback(isArtistFav ? 'tap' : 'success');
                void artistFavorites.toggle({
                  catalogId: artist.id,
                  name: artist.name,
                  artworkUrl: artist.artworkUrl,
                });
              }}
              accessibilityLabel={
                isArtistFav
                  ? t('modules.appleMusic.favorites.removeFromFavorites')
                  : t('modules.appleMusic.favorites.addToFavorites')
              }
              style={styles.songItemHeartButton}
            />
            <Icon name="chevron-right" size={24} color={themeColors.textSecondary} />
          </View>
        </TouchableOpacity>
      </VoiceFocusable>
    );
  };

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
          {searchResults?.songs?.slice(0, ITEMS_PER_SECTION).map((song, index) => renderSongItem(song, index, 'search'))}
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
        return searchResults?.songs?.map((song, index) => renderSongItem(song, index, 'search'));
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

  // Load top charts when discovery or favorites tab becomes visible
  useEffect(() => {
    if (!isAuthorized) return;
    if ((showDiscovery && activeTab === 'search') || activeTab === 'favorites') {
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

      {/* Empty discovery state (nothing to show yet) */}
      {!isRecentlyPlayedLoading && recentlyPlayed.length === 0 && !isTopChartsLoading && !topChartsData?.songs?.length && (
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
  // Shows CommEazy favorites with collection filtering via ChipBar
  // ============================================================

  // Compute filtered songs based on selected chip
  const filteredFavoriteSongs: AppleMusicSong[] = useMemo(() => {
    const favorites = musicFavorites.favorites;

    // Convert MusicFavorite to AppleMusicSong shape for renderSongItem
    const toSong = (fav: typeof favorites[number]): AppleMusicSong => ({
      id: fav.catalogId,
      title: fav.title,
      artistName: fav.artistName,
      artworkUrl: fav.artworkUrl,
      albumTitle: fav.albumTitle,
      durationInMillis: 0,
    });

    if (selectedChipId === 'all') {
      return favorites.map(toSong);
    }

    // Extract collection ID from chip ID (format: "collection:uuid")
    const collectionId = selectedChipId.replace('collection:', '');
    const collection = musicCollections.collections.find(c => c.id === collectionId);
    if (!collection) return [];

    // Filter favorites to only those in this collection, preserving collection order
    const songIdSet = new Set(collection.songCatalogIds);
    return favorites.filter(f => songIdSet.has(f.catalogId)).map(toSong);
  }, [musicFavorites.favorites, selectedChipId, musicCollections.collections]);

  // Handle playlist import started (single — legacy, kept for backwards compatibility)
  const handleImportStarted = useCallback((playlistId: string, playlistName: string) => {
    playlistImportCtx.setImporting(true);

    // Set up callback for "View playlist" button on success screen
    playlistImportCtx.setOnViewPlaylist(() => {
      // Find the newly created collection and select it
      const newCollection = musicCollections.collections.find(c => c.sourcePlaylistId === playlistId);
      if (newCollection) {
        setSelectedChipId(`collection:${newCollection.id}` as MusicChipId);
        setActiveTab('favorites');
      }
    });

    // Start import and handle result
    musicCollections.startSingleImport(playlistId, playlistName, getPlaylistDetails)
      .then(async (result) => {
        await musicFavorites.reload();

        // Find the created collection for navigation
        const newCollection = musicCollections.collections.find(c => c.sourcePlaylistId === playlistId);

        playlistImportCtx.setImportResult({
          result,
          playlistName,
          collectionId: newCollection?.id,
        });
      })
      .finally(() => {
        playlistImportCtx.setImporting(false);
      });
  }, [musicCollections, musicFavorites, getPlaylistDetails, playlistImportCtx, setActiveTab]);

  // Handle batch import of multiple playlists (processed sequentially)
  const handleImportBatch = useCallback(async (batch: Array<{ id: string; name: string }>) => {
    if (batch.length === 0) return;

    playlistImportCtx.setImporting(true);

    let totalSongsAdded = 0;
    let totalFailures = 0;
    let lastCollectionId: string | undefined;

    for (let i = 0; i < batch.length; i++) {
      const { id: playlistId, name: playlistName } = batch[i];

      // Update floating indicator with batch progress
      playlistImportCtx.updateProgress({
        current: i + 1,
        total: batch.length,
        currentName: playlistName,
      });

      try {
        const result = await musicCollections.startSingleImport(
          playlistId,
          playlistName,
          getPlaylistDetails,
        );
        totalSongsAdded += result.songsAdded;
        totalFailures += result.failures;

        // Track last created collection for navigation
        const newCollection = musicCollections.collections.find(c => c.sourcePlaylistId === playlistId);
        if (newCollection) {
          lastCollectionId = newCollection.id;
        }
      } catch (error) {
        console.error('[AppleMusicScreen] Batch import failed for', playlistName);
        totalFailures += 1;
      }
    }

    // Reload favorites after all imports
    await musicFavorites.reload();

    // Set up "View playlist" to navigate to last imported collection
    if (lastCollectionId) {
      playlistImportCtx.setOnViewPlaylist(() => {
        setSelectedChipId(`collection:${lastCollectionId}` as MusicChipId);
        setActiveTab('favorites');
      });
    }

    // Show final result
    playlistImportCtx.setImportResult({
      result: {
        collectionsCreated: batch.length,
        songsAdded: totalSongsAdded,
        failures: totalFailures,
      },
      playlistName: batch.length === 1
        ? batch[0].name
        : `${batch.length} afspeellijsten`,
      collectionId: lastCollectionId,
    });

    playlistImportCtx.setImporting(false);
    playlistImportCtx.updateProgress(null);
  }, [musicCollections, musicFavorites, getPlaylistDetails, playlistImportCtx, setActiveTab]);

  // Handle long-press on collection chip (open edit modal)
  const handleLongPressCollection = useCallback((collectionId: string) => {
    const collection = musicCollections.collections.find(c => c.id === collectionId);
    if (collection) {
      setEditCollectionModal({ visible: true, collection });
    }
  }, [musicCollections.collections]);

  // Handle playing a song from a collection (builds queue from remaining songs)
  const handlePlayFavoriteSong = useCallback(async (song: AppleMusicSong) => {
    await handlePlaySong(song);

    // If playing within a collection, queue remaining songs asynchronously
    if (selectedChipId !== 'all' && filteredFavoriteSongs.length > 1) {
      const songIndex = filteredFavoriteSongs.findIndex(s => s.id === song.id);
      if (songIndex >= 0) {
        const remaining = filteredFavoriteSongs.slice(songIndex + 1);
        // Queue building is handled by MusicKit when we play from a catalog
        console.debug('[AppleMusicScreen] Collection playback:', remaining.length, 'songs follow');
      }
    }
  }, [handlePlaySong, selectedChipId, filteredFavoriteSongs]);

  const renderFavoritesTab = () => {
    const hasCollections = musicCollections.collections.length > 0;
    const hasImportedPlaylists = musicCollections.collections.some(c => !!c.sourcePlaylistId);
    const hasAlbumFavorites = albumFavorites.albums.length > 0;
    const hasArtistFavorites = artistFavorites.artists.length > 0;

    // Last played per category
    const lastPlayedPlaylist = playStats.getLastPlayed('playlist');
    const lastPlayedAlbum = playStats.getLastPlayed('album');
    const lastPlayedArtist = playStats.getLastPlayed('artist');

    // Render "Last Played" sticky header row
    const renderLastPlayed = (
      lastPlayed: typeof lastPlayedPlaylist,
      onPress: () => void,
    ) => {
      if (!lastPlayed) return null;
      return (
        <HapticTouchable
          style={[styles.lastPlayedRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${t('modules.appleMusic.favorites.lastPlayed')}: ${lastPlayed.displayName}`}
        >
          <Icon name="play" size={20} color={appleMusicColor} />
          <Text style={[styles.lastPlayedLabel, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {t('modules.appleMusic.favorites.lastPlayed')}:
          </Text>
          <Text style={[styles.lastPlayedName, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {lastPlayed.displayName}
          </Text>
          <Icon name="chevron-right" size={18} color={themeColors.textSecondary} />
        </HapticTouchable>
      );
    };

    return (
      <View style={styles.tabContent}>
        {/* Loading state */}
        {(musicFavorites.isLoading || musicCollections.isLoading) && (
          <LoadingView />
        )}

        {/* ===== PLAYLISTS sub-tab ===== */}
        {favoritesSubTab === 'playlists' && !musicCollections.isLoading && (
          <>
            {openCollectionId && openCollection ? (
              /* ---- Collection detail view: show songs in this collection ---- */
              <>
                {/* Back button + collection name + Play All */}
                <View style={styles.favStickyHeader}>
                  <View style={styles.collectionBackRow}>
                    <HapticTouchable
                      style={styles.collectionBackButton}
                      onPress={() => setOpenCollectionId(null)}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.appleMusic.favorites.playlists')}
                    >
                      <Icon name="chevron-left" size={28} color={appleMusicColor} />
                    </HapticTouchable>
                    <Text style={[styles.collectionBackText, { color: themeColors.textPrimary }]} numberOfLines={1}>
                      {t('modules.appleMusic.favorites.playlists')}
                    </Text>
                  </View>

                  <View style={styles.collectionDetailHeader}>
                    <View style={[styles.songArtwork, styles.songArtworkPlaceholder, { backgroundColor: appleMusicColor + '20' }]}>
                      <Icon name="list" size={24} color={appleMusicColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.songTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                        {openCollection.name}
                      </Text>
                      <Text style={[styles.songArtist, { color: themeColors.textSecondary }]} numberOfLines={1}>
                        {openCollection.songCatalogIds.length} {t('modules.appleMusic.collections.songs')}
                      </Text>
                    </View>
                    <HapticTouchable
                      style={styles.collectionEditButton}
                      onPress={() => setEditCollectionModal({ visible: true, collection: openCollection })}
                      accessibilityRole="button"
                      accessibilityLabel={t('common.edit')}
                    >
                      <Icon name="settings" size={22} color={themeColors.textSecondary} />
                    </HapticTouchable>
                  </View>

                  {/* Play All button */}
                  {openCollectionSongs.length > 0 && (
                    <HapticTouchable
                      style={[styles.collectionPlayAllButton, { backgroundColor: appleMusicColor }]}
                      onPress={() => {
                        playStats.recordPlay('playlist', openCollection.id, {
                          displayName: openCollection.name,
                          artworkUrl: null,
                        });
                        if (openCollectionSongs.length > 0) {
                          handlePlaySong(openCollectionSongs[0]);
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.appleMusic.detail.playAll')}
                    >
                      <Icon name="play" size={20} color="#FFFFFF" />
                      <Text style={styles.collectionPlayAllText}>
                        {t('modules.appleMusic.detail.playAll')}
                      </Text>
                    </HapticTouchable>
                  )}
                </View>

                {/* Song list */}
                <ScrollView
                  style={styles.resultsList}
                  contentContainerStyle={[
                    styles.resultsContent,
                    { paddingBottom: bottomPadding + insets.bottom },
                  ]}
                >
                  {openCollectionSongs.map((song, index) =>
                    renderSongItem(song, index, 'favorites')
                  )}
                  {openCollectionSongs.length === 0 && (
                    <View style={styles.emptyState}>
                      <Icon name="appleMusic" size={48} color={themeColors.textSecondary} />
                      <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>
                        {t('modules.appleMusic.collections.collectionEmpty')}
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </>
            ) : (
              /* ---- Collection list view ---- */
              <>
                {/* Sticky header: New playlist + Last Played */}
                <View style={styles.favStickyHeader}>
                  {/* New playlist button */}
                  <HapticTouchable
                    style={[styles.favStickyAction, { borderColor: appleMusicColor }]}
                    onPress={() => {
                      Alert.prompt(
                        t('modules.appleMusic.collections.createCollection'),
                        t('modules.appleMusic.collections.newListName'),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('common.create', 'Aanmaken'),
                            onPress: (name?: string) => {
                              if (name?.trim()) {
                                musicCollections.create(name.trim());
                              }
                            },
                          },
                        ],
                        'plain-text',
                      );
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('modules.appleMusic.favorites.newPlaylist')}
                  >
                    <Icon name="plus" size={20} color={appleMusicColor} />
                    <Text style={[styles.favStickyActionText, { color: appleMusicColor }]}>
                      {t('modules.appleMusic.favorites.newPlaylist')}
                    </Text>
                  </HapticTouchable>

                  {/* Last played playlist */}
                  {renderLastPlayed(lastPlayedPlaylist, () => {
                    if (lastPlayedPlaylist) {
                      setOpenCollectionId(lastPlayedPlaylist.itemId);
                      setSelectedChipId(`collection:${lastPlayedPlaylist.itemId}` as MusicChipId);
                    }
                  })}

                  {/* Import playlists button — hidden after first import (manage via Settings) */}
                  {!hasImportedPlaylists && (
                    <HapticTouchable
                      style={[styles.favStickyAction, { borderColor: appleMusicColor }]}
                      onPress={() => setShowPlaylistBrowser(true)}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.appleMusic.import.importButton')}
                    >
                      <Icon name="download" size={20} color={appleMusicColor} />
                      <Text style={[styles.favStickyActionText, { color: appleMusicColor }]}>
                        {t('modules.appleMusic.import.importButton')}
                      </Text>
                    </HapticTouchable>
                  )}
                </View>

                {/* Scrollable collection list */}
                {hasCollections ? (
                  <ScrollView
                    style={styles.resultsList}
                    contentContainerStyle={[
                      styles.resultsContent,
                      { paddingBottom: bottomPadding + insets.bottom },
                    ]}
                  >
                    {sortedCollections.map((collection, index) => (
                      <HapticTouchable
                        key={collection.id}
                        style={[styles.songItem, { backgroundColor: themeColors.surface }]}
                        onPress={() => {
                          setOpenCollectionId(collection.id);
                          setSelectedChipId(`collection:${collection.id}` as MusicChipId);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`${collection.name}, ${collection.songCatalogIds.length} ${t('modules.appleMusic.collections.songs')}`}
                      >
                        <View style={[styles.songArtwork, styles.songArtworkPlaceholder, { backgroundColor: appleMusicColor + '20' }]}>
                          <Icon name="list" size={24} color={appleMusicColor} />
                        </View>
                        <View style={styles.songInfo}>
                          <Text style={[styles.songTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                            {collection.name}
                          </Text>
                          <Text style={[styles.songArtist, { color: themeColors.textSecondary }]} numberOfLines={1}>
                            {collection.songCatalogIds.length} {t('modules.appleMusic.collections.songs')}
                            {collection.sourcePlaylistId ? ` • ${t('modules.appleMusic.favorites.imported')}` : ''}
                          </Text>
                        </View>
                        <Icon name="chevron-right" size={24} color={themeColors.textSecondary} />
                      </HapticTouchable>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.emptyState}>
                    <Icon name="list" size={48} color={themeColors.textSecondary} />
                    <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>
                      {t('modules.appleMusic.favorites.emptyPlaylistsTitle')}
                    </Text>
                    <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
                      {t('modules.appleMusic.favorites.emptyPlaylistsDescription')}
                    </Text>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ===== ALBUMS sub-tab ===== */}
        {favoritesSubTab === 'albums' && (
          <>
            {/* Sticky header: Last Played */}
            {lastPlayedAlbum && (
              <View style={styles.favStickyHeader}>
                {renderLastPlayed(lastPlayedAlbum, () => {
                  if (lastPlayedAlbum) {
                    handleAlbumPress({
                      id: lastPlayedAlbum.itemId,
                      title: lastPlayedAlbum.displayName,
                      artistName: '',
                      artworkUrl: lastPlayedAlbum.artworkUrl,
                      trackCount: 0,
                    } as AppleMusicAlbum);
                  }
                })}
              </View>
            )}

            {hasAlbumFavorites ? (
              <ScrollView
                style={styles.resultsList}
                contentContainerStyle={[
                  styles.resultsContent,
                  { paddingBottom: bottomPadding + insets.bottom },
                ]}
              >
                {sortedAlbums.map((album, index) =>
                  renderAlbumItem(
                    {
                      id: album.catalogId,
                      title: album.title,
                      artistName: album.artistName,
                      artworkUrl: album.artworkUrl,
                      trackCount: album.trackCount,
                    } as AppleMusicAlbum,
                    index,
                  )
                )}
              </ScrollView>
            ) : (
              <View style={styles.emptyState}>
                <Icon name="appleMusic" size={48} color={themeColors.textSecondary} />
                <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>
                  {t('modules.appleMusic.favorites.emptyAlbumsTitle')}
                </Text>
                <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
                  {t('modules.appleMusic.favorites.emptyAlbumsDescription')}
                </Text>
              </View>
            )}
          </>
        )}

        {/* ===== ARTISTS sub-tab ===== */}
        {favoritesSubTab === 'artists' && (
          <>
            {/* Sticky header: Last Played */}
            {lastPlayedArtist && (
              <View style={styles.favStickyHeader}>
                {renderLastPlayed(lastPlayedArtist, () => {
                  if (lastPlayedArtist) {
                    handleArtistPress({
                      id: lastPlayedArtist.itemId,
                      name: lastPlayedArtist.displayName,
                      artworkUrl: lastPlayedArtist.artworkUrl,
                    } as AppleMusicArtist);
                  }
                })}
              </View>
            )}

            {hasArtistFavorites ? (
              <ScrollView
                style={styles.resultsList}
                contentContainerStyle={[
                  styles.resultsContent,
                  { paddingBottom: bottomPadding + insets.bottom },
                ]}
              >
                {sortedArtists.map((artist, index) =>
                  renderArtistItem(
                    {
                      id: artist.catalogId,
                      name: artist.name,
                      artworkUrl: artist.artworkUrl,
                    } as AppleMusicArtist,
                    index,
                  )
                )}
              </ScrollView>
            ) : (
              <View style={styles.emptyState}>
                <Icon name="contacts" size={48} color={themeColors.textSecondary} />
                <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>
                  {t('modules.appleMusic.favorites.emptyArtistsTitle')}
                </Text>
                <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
                  {t('modules.appleMusic.favorites.emptyArtistsDescription')}
                </Text>
              </View>
            )}
          </>
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

    // Sub-tab labels for dropdown
    const subTabLabels: Record<FavoritesSubTab, string> = {
      playlists: t('modules.appleMusic.favorites.playlists'),
      albums: t('modules.appleMusic.favorites.albums'),
      artists: t('modules.appleMusic.favorites.artists'),
    };

    return (
      <View style={styles.mainContent}>
        {/* Simple 2-tab bar — left button is dropdown trigger for favorites */}
        <View style={[styles.twoTabBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          {/* Favorites tab — dropdown trigger */}
          <View style={{ flex: 1, position: 'relative', zIndex: 10 }}>
            <TouchableOpacity
              style={[
                styles.twoTab,
                {
                  backgroundColor: activeTab === 'favorites'
                    ? appleMusicColor
                    : themeColors.background,
                  borderColor: appleMusicColor,
                },
              ]}
              onPress={() => {
                if (activeTab === 'favorites') {
                  setShowFavoritesDropdown(!showFavoritesDropdown);
                } else {
                  setActiveTab('favorites');
                  setShowFavoritesDropdown(false);
                }
              }}
              onLongPress={() => {}}
              delayLongPress={300}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'favorites' }}
              accessibilityLabel={`${subTabLabels[favoritesSubTab]}, ${t('modules.appleMusic.favorites.changeCategory')}`}
              accessibilityHint={t('modules.appleMusic.favorites.changeCategoryHint')}
            >
              <Icon
                name="heart-filled"
                size={22}
                color={activeTab === 'favorites' ? '#FFFFFF' : appleMusicColor}
              />
              <Text
                style={[
                  styles.twoTabText,
                  { color: activeTab === 'favorites' ? '#FFFFFF' : themeColors.textPrimary },
                ]}
                numberOfLines={1}
              >
                {subTabLabels[favoritesSubTab]}
              </Text>
              {activeTab === 'favorites' && (
                <Icon
                  name="chevron-down"
                  size={16}
                  color="#FFFFFF"
                />
              )}
            </TouchableOpacity>

            {/* Dropdown popup menu */}
            {showFavoritesDropdown && activeTab === 'favorites' && (
              <>
                <TouchableOpacity
                  style={styles.favDropdownOverlay}
                  activeOpacity={1}
                  onPress={() => setShowFavoritesDropdown(false)}
                  accessibilityLabel={t('common.close')}
                />
                <View style={[styles.favDropdownMenu, {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border,
                  top: touchTargets.minimum + spacing.xs,
                  left: 0,
                  right: 0,
                }]}>
                  {(['playlists', 'albums', 'artists'] as FavoritesSubTab[]).map((key) => {
                    const isActive = favoritesSubTab === key;
                    const count = key === 'playlists'
                      ? musicCollections.collections.length
                      : key === 'albums'
                        ? albumFavorites.count
                        : artistFavorites.count;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.favDropdownItem,
                          isActive && { backgroundColor: appleMusicColor },
                        ]}
                        onPress={() => {
                          setFavoritesSubTab(key);
                          setShowFavoritesDropdown(false);
                          setOpenCollectionId(null);
                        }}
                        onLongPress={() => {}}
                        delayLongPress={300}
                        accessibilityRole="menuitem"
                        accessibilityState={{ selected: isActive }}
                        accessibilityLabel={`${subTabLabels[key]} (${count})`}
                      >
                        <Icon
                          name="heart-filled"
                          size={18}
                          color={isActive ? '#FFFFFF' : appleMusicColor}
                        />
                        <Text
                          style={[
                            styles.favDropdownItemText,
                            { color: isActive ? '#FFFFFF' : themeColors.textPrimary },
                          ]}
                        >
                          {subTabLabels[key]} ({count})
                        </Text>
                        {isActive && (
                          <Icon name="checkmark" size={18} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* Search tab */}
          <TouchableOpacity
            style={[
              styles.twoTab,
              { flex: 1 },
              {
                backgroundColor: activeTab === 'search'
                  ? appleMusicColor
                  : themeColors.background,
                borderColor: appleMusicColor,
              },
            ]}
            onPress={() => { setActiveTab('search'); setShowFavoritesDropdown(false); }}
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
        {activeTab === 'favorites' && renderFavoritesTab()}
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
        onAddToList={(song) => {
          setSongCollectionModal({
            visible: true,
            catalogId: song.id,
            title: song.title,
            artistName: song.artistName,
            artworkUrl: song.artworkUrl ?? null,
            albumTitle: song.albumTitle ?? '',
          });
        }}
        isAlbumOrArtistFavorite={
          detailModal.type === 'album'
            ? albumFavorites.isFavorite(detailModal.id)
            : detailModal.type === 'artist'
              ? artistFavorites.isFavorite(detailModal.id)
              : undefined
        }
        onToggleAlbumOrArtistFavorite={
          detailModal.type === 'album' && detailModal.initialData
            ? () => {
                const album = detailModal.initialData as AppleMusicAlbum;
                void triggerFeedback(albumFavorites.isFavorite(detailModal.id) ? 'tap' : 'success');
                void albumFavorites.toggle({
                  catalogId: album.id,
                  title: album.title,
                  artistName: album.artistName,
                  artworkUrl: album.artworkUrl,
                  trackCount: album.trackCount ?? 0,
                });
              }
            : detailModal.type === 'artist' && detailModal.initialData
              ? () => {
                  const artist = detailModal.initialData as AppleMusicArtist;
                  void triggerFeedback(artistFavorites.isFavorite(detailModal.id) ? 'tap' : 'success');
                  void artistFavorites.toggle({
                    catalogId: artist.id,
                    name: artist.name,
                    artworkUrl: artist.artworkUrl,
                  });
                }
              : undefined
        }
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

      {/* Edit Music Collection Modal */}
      <EditMusicCollectionModal
        visible={editCollectionModal.visible}
        collection={editCollectionModal.collection}
        onClose={() => setEditCollectionModal({ visible: false, collection: null })}
        onRename={(collectionId, newName) => {
          musicCollections.rename(collectionId, newName);
        }}
        onDelete={(collectionId) => {
          musicCollections.remove(collectionId);
          // Reset chip selection if the deleted collection was selected
          if (selectedChipId === `collection:${collectionId}`) {
            setSelectedChipId('all');
          }
        }}
      />

      {/* Song Collection Assignment Modal */}
      <SongCollectionModal
        visible={songCollectionModal.visible}
        songCatalogId={songCollectionModal.catalogId}
        songTitle={songCollectionModal.title}
        songArtistName={songCollectionModal.artistName}
        songArtworkUrl={songCollectionModal.artworkUrl}
        songAlbumTitle={songCollectionModal.albumTitle}
        collections={musicCollections.collections}
        onClose={() => setSongCollectionModal({ visible: false, catalogId: null, title: '', artistName: '', artworkUrl: null, albumTitle: '' })}
        onAddToCollection={(collectionId, catalogId) => {
          musicCollections.addSongs(collectionId, [catalogId]);
        }}
        onRemoveFromCollection={(collectionId, catalogId) => {
          musicCollections.removeSongs(collectionId, [catalogId]);
        }}
        onCreateCollectionInline={async (name) => {
          return await musicCollections.create(name) ?? undefined;
        }}
        onAutoFavorite={(song) => {
          musicFavorites.add(song);
        }}
      />

      {/* Playlist Browser Modal */}
      <PlaylistBrowserModal
        visible={showPlaylistBrowser}
        onClose={() => setShowPlaylistBrowser(false)}
        getLibraryPlaylists={getLibraryPlaylists}
        collections={musicCollections.collections}
        isImporting={musicCollections.isImporting}
        accentColor={appleMusicColor}
        onImportBatch={handleImportBatch}
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
    zIndex: 10,
    overflow: 'visible',
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
    zIndex: 1,
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
  collectionEmptyState: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
    alignItems: 'center',
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
  // Import playlists button
  importPlaylistsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    minHeight: 44,
  },
  importPlaylistsText: {
    ...typography.label,
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

  // Favorites sticky header (non-scrollable actions)
  favStickyHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  favStickyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    minHeight: 44,
  },
  favStickyActionText: {
    ...typography.label,
    fontWeight: '600',
  },

  // Last played row
  lastPlayedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: touchTargets.minimum,
  },
  lastPlayedLabel: {
    ...typography.label,
    flexShrink: 0,
  },
  lastPlayedName: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },

  // Collection detail view
  collectionBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  collectionBackButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collectionBackText: {
    ...typography.body,
    fontWeight: '700',
    flex: 1,
  },
  collectionDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  collectionEditButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collectionPlayAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
  },
  collectionPlayAllText: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Favorites dropdown overlay (used by tab bar dropdown)
  favDropdownOverlay: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 1,
  },
  favDropdownMenu: {
    position: 'absolute',
    top: touchTargets.minimum + spacing.sm + spacing.xs,
    left: spacing.md,
    right: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 2,
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  favDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: touchTargets.minimum,
  },
  favDropdownItemText: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
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
