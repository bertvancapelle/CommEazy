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
  PlayingWaveIcon,
  MiniPlayer,
  ExpandedAudioPlayer,
  ModuleHeader,
  FavoriteTabButton,
  SearchTabButton,
  SearchBar,
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
  type LibraryCounts,
  type LibraryCache,
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

// Library category types for "Mijn Muziek" tab
type LibraryCategoryType = 'songs' | 'albums' | 'artists' | 'playlists';

// Threshold for showing search bar in library categories
const LIBRARY_SEARCH_THRESHOLD = 10;

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
    // Library
    addToLibrary,
    isInLibrary,
    getLibrarySongs,
    getLibraryAlbums,
    getLibraryArtists,
    getLibraryPlaylists,
    getLibraryCounts,
    // Library Cache (preloaded at startup)
    libraryCache,
    isLibraryCacheLoading,
    // Queue
    queue,
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
  const [isQueueVisible, setIsQueueVisible] = useState(false);
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

  // Library state (for current song in player)
  const [currentSongInLibrary, setCurrentSongInLibrary] = useState(false);
  const [isAddingToLibrary, setIsAddingToLibrary] = useState(false);

  // "Mijn Muziek" tab state
  const [libraryCounts, setLibraryCounts] = useState<LibraryCounts | null>(null);
  const [isLoadingLibraryCounts, setIsLoadingLibraryCounts] = useState(false);
  const [libraryCategory, setLibraryCategory] = useState<LibraryCategoryType | null>(null);
  const [librarySongs, setLibrarySongs] = useState<AppleMusicSong[]>([]);
  const [libraryAlbums, setLibraryAlbums] = useState<AppleMusicAlbum[]>([]);
  const [libraryArtists, setLibraryArtists] = useState<AppleMusicArtist[]>([]);
  const [libraryPlaylists, setLibraryPlaylists] = useState<AppleMusicPlaylist[]>([]);
  const [isLoadingLibraryContent, setIsLoadingLibraryContent] = useState(false);
  const [showLargeLibraryText, setShowLargeLibraryText] = useState(false);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');

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

  // Effect 9: Load library counts when library tab is selected
  useEffect(() => {
    if (activeTab !== 'library' || !isAuthorized || !isIOS) return;

    const loadCounts = async () => {
      setIsLoadingLibraryCounts(true);
      try {
        const counts = await getLibraryCounts();
        setLibraryCounts(counts);
        console.log('[AppleMusicScreen] Library counts:', counts);
      } catch (error) {
        console.error('[AppleMusicScreen] Failed to load library counts:', error);
      } finally {
        setIsLoadingLibraryCounts(false);
      }
    };

    loadCounts();
  }, [activeTab, isAuthorized, isIOS, getLibraryCounts]);

  // Refs for cache check - avoids recreating the loadLibraryContent callback on every state change
  const librarySongsRef = useRef(librarySongs);
  const libraryAlbumsRef = useRef(libraryAlbums);
  const libraryArtistsRef = useRef(libraryArtists);
  const libraryPlaylistsRef = useRef(libraryPlaylists);

  // Keep refs in sync
  useEffect(() => { librarySongsRef.current = librarySongs; }, [librarySongs]);
  useEffect(() => { libraryAlbumsRef.current = libraryAlbums; }, [libraryAlbums]);
  useEffect(() => { libraryArtistsRef.current = libraryArtists; }, [libraryArtists]);
  useEffect(() => { libraryPlaylistsRef.current = libraryPlaylists; }, [libraryPlaylists]);

  // Library content loading function - extracted for reuse by refresh button
  // Priority: 1) local state cache, 2) context libraryCache (preloaded), 3) API call
  const loadLibraryContent = useCallback(async (category: LibraryCategoryType, forceRefresh = false) => {
    if (!isAuthorized || !isIOS) return;

    console.log('[AppleMusicScreen] loadLibraryContent called:', category, 'forceRefresh:', forceRefresh);
    console.log('[AppleMusicScreen] Current ref lengths - songs:', librarySongsRef.current.length, 'albums:', libraryAlbumsRef.current.length);

    // Skip loading if we already have data for this category (local state cache hit) - unless force refresh
    if (!forceRefresh) {
      switch (category) {
        case 'songs':
          if (librarySongsRef.current.length > 0) {
            console.log('[AppleMusicScreen] ✅ CACHE HIT: Using local cached library songs:', librarySongsRef.current.length);
            return;
          }
          // Check context libraryCache (preloaded at startup)
          if (libraryCache.songs.length > 0) {
            console.log('[AppleMusicScreen] ✅ CACHE HIT: Using context preloaded library songs:', libraryCache.songs.length);
            setLibrarySongs(libraryCache.songs);
            return;
          }
          console.log('[AppleMusicScreen] ❌ CACHE MISS: No cached songs, will fetch from API');
          break;
        case 'albums':
          if (libraryAlbumsRef.current.length > 0) {
            console.log('[AppleMusicScreen] ✅ CACHE HIT: Using local cached library albums:', libraryAlbumsRef.current.length);
            return;
          }
          // Check context libraryCache (preloaded at startup)
          if (libraryCache.albums.length > 0) {
            console.log('[AppleMusicScreen] ✅ CACHE HIT: Using context preloaded library albums:', libraryCache.albums.length);
            setLibraryAlbums(libraryCache.albums);
            return;
          }
          console.log('[AppleMusicScreen] ❌ CACHE MISS: No cached albums, will fetch from API');
          break;
        case 'artists':
          if (libraryArtistsRef.current.length > 0) {
            console.log('[AppleMusicScreen] ✅ CACHE HIT: Using local cached library artists:', libraryArtistsRef.current.length);
            return;
          }
          console.log('[AppleMusicScreen] ❌ CACHE MISS: No cached artists, will fetch from API');
          break;
        case 'playlists':
          if (libraryPlaylistsRef.current.length > 0) {
            console.log('[AppleMusicScreen] ✅ CACHE HIT: Using local cached library playlists:', libraryPlaylistsRef.current.length);
            return;
          }
          console.log('[AppleMusicScreen] ❌ CACHE MISS: No cached playlists, will fetch from API');
          break;
      }
    }

    setIsLoadingLibraryContent(true);
    setShowLargeLibraryText(false);
    setLibrarySearchQuery(''); // Reset search when changing category

    // Start timer to show "Large library loading" text after 1 second
    loadingTimerRef.current = setTimeout(() => {
      setShowLargeLibraryText(true);
    }, 1000);

    try {
      switch (category) {
        case 'songs': {
          const response = await getLibrarySongs(500, 0);
          setLibrarySongs(response.items);
          console.log('[AppleMusicScreen] Loaded', response.items.length, 'library songs from API');
          break;
        }
        case 'albums': {
          const response = await getLibraryAlbums(500, 0);
          setLibraryAlbums(response.items);
          console.log('[AppleMusicScreen] Loaded', response.items.length, 'library albums from API');
          break;
        }
        case 'artists': {
          const response = await getLibraryArtists(500, 0);
          setLibraryArtists(response.items);
          console.log('[AppleMusicScreen] Loaded', response.items.length, 'library artists from API');
          break;
        }
        case 'playlists': {
          const response = await getLibraryPlaylists(500, 0);
          setLibraryPlaylists(response.items);
          console.log('[AppleMusicScreen] Loaded', response.items.length, 'library playlists from API');
          break;
        }
      }
    } catch (error) {
      console.error('[AppleMusicScreen] Failed to load library content:', error);
    } finally {
      // Clear the timer and reset states
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setShowLargeLibraryText(false);
      setIsLoadingLibraryContent(false);
    }
  }, [isAuthorized, isIOS, libraryCache, getLibrarySongs, getLibraryAlbums, getLibraryArtists, getLibraryPlaylists]);

  // Effect 10: Load library content when a category is selected
  useEffect(() => {
    if (!libraryCategory) return;
    loadLibraryContent(libraryCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryCategory]);

  // Effect 10b: Cleanup loading timer on unmount
  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, []);

  // Effect 11: Check library status for search result songs (for heart icon)
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
  // Library Filtering (live filtering for category content)
  // ============================================================

  const filteredLibrarySongs = useMemo(() => {
    let songs = librarySongs;
    if (librarySearchQuery.trim()) {
      const query = librarySearchQuery.toLowerCase();
      songs = librarySongs.filter(
        song => song.title.toLowerCase().includes(query) ||
                song.artistName.toLowerCase().includes(query) ||
                song.albumTitle.toLowerCase().includes(query)
      );
    }
    // Pin currently playing song to top
    if (!currentSong) return songs;
    const playingSong = songs.find((s) => s.id === currentSong.id);
    if (!playingSong) return songs;
    const otherSongs = songs.filter((s) => s.id !== currentSong.id);
    return [playingSong, ...otherSongs];
  }, [librarySongs, librarySearchQuery, currentSong]);

  const filteredLibraryAlbums = useMemo(() => {
    if (!librarySearchQuery.trim()) return libraryAlbums;
    const query = librarySearchQuery.toLowerCase();
    return libraryAlbums.filter(
      album => album.title.toLowerCase().includes(query) ||
               album.artistName.toLowerCase().includes(query)
    );
  }, [libraryAlbums, librarySearchQuery]);

  const filteredLibraryArtists = useMemo(() => {
    if (!librarySearchQuery.trim()) return libraryArtists;
    const query = librarySearchQuery.toLowerCase();
    return libraryArtists.filter(
      artist => artist.name.toLowerCase().includes(query)
    );
  }, [libraryArtists, librarySearchQuery]);

  const filteredLibraryPlaylists = useMemo(() => {
    if (!librarySearchQuery.trim()) return libraryPlaylists;
    const query = librarySearchQuery.toLowerCase();
    return libraryPlaylists.filter(
      playlist => playlist.name.toLowerCase().includes(query) ||
                  playlist.curatorName.toLowerCase().includes(query)
    );
  }, [libraryPlaylists, librarySearchQuery]);

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
      } catch (error) {
        console.error('[AppleMusicScreen] Failed to add to library:', error);
        Alert.alert(
          t('modules.appleMusic.playError.title'),
          t('modules.appleMusic.library.addError')
        );
      }
    }
  }, [searchResultsInLibrary, addToLibrary, triggerFeedback, t]);

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
  // Library Tab Content - "Mijn Muziek"
  // ============================================================

  // Helper function to render a library category button
  const renderCategoryButton = (
    category: LibraryCategoryType,
    icon: 'musical-notes' | 'disc' | 'person' | 'list',
    labelKey: string,
    count: number
  ) => (
    <TouchableOpacity
      key={category}
      style={[styles.libraryButton, { borderColor: appleMusicColor }]}
      onPress={() => {
        triggerFeedback('tap');
        setLibraryCategory(category);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${t(labelKey)} (${count})`}
    >
      <Icon name={icon} size={40} color={appleMusicColor} />
      <Text style={[styles.libraryButtonLabel, { color: themeColors.textPrimary }]}>
        {t(labelKey)}
      </Text>
      <Text style={[styles.libraryButtonCount, { color: themeColors.textSecondary }]}>
        {count}
      </Text>
    </TouchableOpacity>
  );

  // Render library grid (main view of "Mijn Muziek" tab)
  const renderLibraryGrid = () => {
    // Loading state
    if (isLoadingLibraryCounts) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={appleMusicColor} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            {t('common.loading')}
          </Text>
        </View>
      );
    }

    // Empty state - no library content
    const totalCount = libraryCounts
      ? libraryCounts.songs + libraryCounts.albums + libraryCounts.artists + libraryCounts.playlists
      : 0;

    if (totalCount === 0) {
      return (
        <View style={styles.emptyState}>
          <Icon name="appleMusic" size={64} color={themeColors.textSecondary} />
          <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>
            {t('modules.appleMusic.library.emptyTitle')}
          </Text>
          <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
            {t('modules.appleMusic.library.emptyDescription')}
          </Text>
          <TouchableOpacity
            style={[styles.emptyStateButton, { backgroundColor: appleMusicColor }]}
            onPress={() => setActiveTab('search')}
            accessibilityRole="button"
            accessibilityLabel={t('modules.appleMusic.library.searchMusic')}
          >
            <Icon name="search" size={24} color={themeColors.textOnPrimary} />
            <Text style={[styles.emptyStateButtonText, { color: themeColors.textOnPrimary }]}>
              {t('modules.appleMusic.library.searchMusic')}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Grid of category buttons
    return (
      <View style={styles.libraryGrid}>
        {renderCategoryButton('songs', 'musical-notes', 'modules.appleMusic.library.songs', libraryCounts?.songs ?? 0)}
        {renderCategoryButton('artists', 'person', 'modules.appleMusic.library.artists', libraryCounts?.artists ?? 0)}
        {renderCategoryButton('albums', 'disc', 'modules.appleMusic.library.albums', libraryCounts?.albums ?? 0)}
        {renderCategoryButton('playlists', 'list', 'modules.appleMusic.library.playlists', libraryCounts?.playlists ?? 0)}
      </View>
    );
  };

  // Render library category content (songs list, albums list, etc.)
  const renderLibraryCategoryContent = () => {
    const categoryTitles: Record<LibraryCategoryType, string> = {
      songs: t('modules.appleMusic.library.songs'),
      albums: t('modules.appleMusic.library.albums'),
      artists: t('modules.appleMusic.library.artists'),
      playlists: t('modules.appleMusic.library.playlists'),
    };

    // Get the current content and count
    let content: React.ReactNode = null;
    let totalCount = 0;
    let filteredCount = 0;

    switch (libraryCategory) {
      case 'songs':
        totalCount = librarySongs.length;
        filteredCount = filteredLibrarySongs.length;
        content = filteredLibrarySongs.map((song, index) => renderSongItem(song, index));
        break;
      case 'albums':
        totalCount = libraryAlbums.length;
        filteredCount = filteredLibraryAlbums.length;
        content = filteredLibraryAlbums.map((album, index) => renderAlbumItem(album, index));
        break;
      case 'artists':
        totalCount = libraryArtists.length;
        filteredCount = filteredLibraryArtists.length;
        content = filteredLibraryArtists.map((artist, index) => renderArtistItem(artist, index));
        break;
      case 'playlists':
        totalCount = libraryPlaylists.length;
        filteredCount = filteredLibraryPlaylists.length;
        content = filteredLibraryPlaylists.map((playlist, index) => renderPlaylistItem(playlist, index));
        break;
    }

    const showSearchBar = totalCount > LIBRARY_SEARCH_THRESHOLD;

    // Force refresh function - reloads content for current category
    const handleRefreshCategory = () => {
      triggerFeedback('tap');
      if (libraryCategory) {
        loadLibraryContent(libraryCategory, true);
      }
    };

    return (
      <View style={styles.libraryCategoryContent}>
        {/* Header with back button, title, and refresh button */}
        <View style={styles.libraryCategoryHeader}>
          <TouchableOpacity
            style={styles.libraryCategoryBackButton}
            onPress={() => {
              triggerFeedback('tap');
              setLibraryCategory(null);
              setLibrarySearchQuery('');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Icon name="chevron-left" size={28} color={appleMusicColor} />
          </TouchableOpacity>
          <Text style={[styles.libraryCategoryTitle, { color: themeColors.textPrimary }]}>
            {categoryTitles[libraryCategory!]}
          </Text>
          <TouchableOpacity
            style={styles.libraryCategoryBackButton}
            onPress={handleRefreshCategory}
            accessibilityRole="button"
            accessibilityLabel={t('common.refresh')}
          >
            <Icon name="refresh" size={24} color={appleMusicColor} />
          </TouchableOpacity>
        </View>

        {/* Search bar (only shown when >10 items) */}
        {showSearchBar && (
          <View style={styles.librarySearchContainer}>
            <SearchBar
              value={librarySearchQuery}
              onChangeText={setLibrarySearchQuery}
              onSubmit={() => {}} // Live filtering, no explicit submit needed
              placeholder={t('modules.appleMusic.library.searchPlaceholder')}
              searchButtonLabel={t('modules.appleMusic.library.searchButton')}
              maxLength={SEARCH_MAX_LENGTH}
            />
          </View>
        )}

        {/* Loading state */}
        {isLoadingLibraryContent ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={appleMusicColor} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
              {showLargeLibraryText
                ? t('modules.appleMusic.library.loadingLarge')
                : t('common.loading')}
            </Text>
          </View>
        ) : (
          <>
            {/* Results count */}
            {showSearchBar && librarySearchQuery.trim() && (
              <Text style={[styles.libraryResultCount, { color: themeColors.textSecondary }]}>
                {t('modules.appleMusic.library.resultCount', { count: filteredCount, total: totalCount })}
              </Text>
            )}

            {/* Content list */}
            <ScrollView
              style={styles.resultsList}
              contentContainerStyle={[
                styles.resultsContent,
                { paddingBottom: bottomPadding + insets.bottom },
              ]}
            >
              {filteredCount === 0 && librarySearchQuery.trim() ? (
                <View style={styles.emptyState}>
                  <Icon name="search" size={48} color={themeColors.textSecondary} />
                  <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
                    {t('modules.appleMusic.library.noSearchResults')}
                  </Text>
                </View>
              ) : (
                content
              )}
            </ScrollView>
          </>
        )}
      </View>
    );
  };

  const renderLibraryTab = () => (
    <View style={styles.tabContent}>
      {libraryCategory ? renderLibraryCategoryContent() : renderLibraryGrid()}
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
            queue: true,
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

  // Library tab - "Mijn Muziek" grid
  // Note: Using flexBasis instead of width percentage for better cross-device compatibility
  libraryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: spacing.sm,
    rowGap: spacing.md,
  },
  libraryButton: {
    // Use flexBasis with calc-like approach: (100% - gap) / 2
    // spacing.md = 16, so each button is roughly 48% with gap in between
    flexBasis: '48%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTargets.large,
  },
  libraryButtonLabel: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  libraryButtonCount: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Library category content
  libraryCategoryContent: {
    flex: 1,
  },
  libraryCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  libraryCategoryBackButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  libraryCategoryTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  librarySearchContainer: {
    marginBottom: spacing.md,
  },
  libraryResultCount: {
    ...typography.label,
    color: colors.textSecondary,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
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
