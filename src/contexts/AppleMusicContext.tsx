/**
 * AppleMusicContext — Global Apple Music state management
 *
 * Provides app-wide access to Apple Music integration:
 * - iOS: Full MusicKit integration (search, playback, queue, shuffle/repeat)
 * - Android: App detection and deep linking only
 *
 * Architecture:
 * - Uses native AppleMusicModule for platform-specific implementation
 * - Provides unified API that gracefully degrades on Android
 * - Real-time playback state updates via native events
 *
 * @see .claude/plans/APPLE_MUSIC_IMPLEMENTATION.md
 * @see ios/AppleMusicModule.swift
 * @see android/app/src/main/java/com/commeazytemp/AppleMusicModule.kt
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

import { useAudioOrchestrator, type AudioSourceState } from './AudioOrchestratorContext';
import type {
  AppleMusicAuthStatus,
  ShuffleMode,
  RepeatMode,
  AppleMusicSong,
  AppleMusicAlbum,
  AppleMusicArtist,
  AppleMusicPlaylist,
  AppleMusicGenre,
  SearchResults,
  AlbumDetails,
  ArtistDetails,
  PlaylistDetails,
  LibraryPaginatedResponse,
  LibraryCounts,
  PlaybackState,
  Subscription,
  PlatformCapabilities,
  RecentlyPlayedItem,
  AppleMusicContextValue,
} from './appleMusicContextTypes';
import {
  RECENTLY_PLAYED_STORAGE_KEY,
  RECENTLY_PLAYED_MAX_ITEMS,
} from './appleMusicContextTypes';

// ============================================================
// Native Module
// ============================================================

const { AppleMusicModule } = NativeModules;

// ============================================================
// Context
// ============================================================

const AppleMusicContext = createContext<AppleMusicContextValue | null>(null);

interface AppleMusicProviderProps {
  children: ReactNode;
}

/**
 * Provider component for Apple Music context
 */
export function AppleMusicProvider({ children }: AppleMusicProviderProps) {
  const { t } = useTranslation();
  const audioOrchestrator = useAudioOrchestrator();

  // Platform detection
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';

  // State
  const [authStatus, setAuthStatus] = useState<AppleMusicAuthStatus>('notDetermined');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [nowPlaying, setNowPlaying] = useState<AppleMusicSong | null>(null);
  const [queue, setQueue] = useState<AppleMusicSong[]>([]);
  const [showPlayer, setShowPlayer] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<PlatformCapabilities | null>(null);
  const [sleepTimerActive, setSleepTimerActive] = useState(false);

  // Artwork URL from search results (more reliable than MusicKit queue URLs)
  // Maps song ID to artwork URL
  const [artworkCache, setArtworkCache] = useState<Map<string, string>>(new Map());

  // Discovery: Recently Played (locally tracked via AsyncStorage)
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedItem[]>([]);
  const [isRecentlyPlayedLoading, setIsRecentlyPlayedLoading] = useState(true);

  // Discovery: Top Charts (cached from API)
  const [topCharts, setTopCharts] = useState<SearchResults | null>(null);
  const [isTopChartsLoading, setIsTopChartsLoading] = useState(false);

  // Discovery: Genres
  const [genres, setGenres] = useState<AppleMusicGenre[]>([]);
  const [isGenresLoading, setIsGenresLoading] = useState(false);

  // Derived state
  const isAuthorized = authStatus === 'authorized' || authStatus === 'app_installed';
  const isPlaying = playbackState?.status === 'playing';
  const shuffleMode = playbackState?.shuffleMode ?? 'off';
  const repeatMode = playbackState?.repeatMode ?? 'off';

  // Effective artwork URL: prefer cached URL from search results over MusicKit queue URL
  // MusicKit queue entries often have musicKit:// URLs that don't work in React Native
  const effectiveArtworkUrl = useMemo(() => {
    if (!nowPlaying) return null;

    // First check our cache (artwork URL from search results)
    const cachedUrl = artworkCache.get(nowPlaying.id);
    if (cachedUrl) {
      console.log('[AppleMusicContext] Using cached artwork URL:', cachedUrl.substring(0, 80));
      return cachedUrl;
    }

    // Fall back to nowPlaying.artworkUrl (may be musicKit:// which doesn't work)
    if (nowPlaying.artworkUrl && nowPlaying.artworkUrl.startsWith('https://')) {
      console.log('[AppleMusicContext] Using nowPlaying artwork URL:', nowPlaying.artworkUrl.substring(0, 80));
      return nowPlaying.artworkUrl;
    }

    console.log('[AppleMusicContext] No usable artwork URL available');
    return null;
  }, [nowPlaying, artworkCache]);

  // ============================================================
  // Recently Played (MusicKit API + local AsyncStorage supplement)
  // ============================================================

  // Valid types for recently played (container API returns album/playlist/station; song fallback returns song)
  const VALID_RECENTLY_PLAYED_TYPES = new Set(['album', 'playlist', 'station', 'song']);

  /** Load recently played items from AsyncStorage, filtering out legacy song-type entries */
  const loadLocalRecentlyPlayed = useCallback(async (): Promise<RecentlyPlayedItem[]> => {
    try {
      const stored = await AsyncStorage.getItem(RECENTLY_PLAYED_STORAGE_KEY);
      if (stored) {
        const items: RecentlyPlayedItem[] = JSON.parse(stored);
        // Filter out old song-type items from previous implementation
        return items.filter(item => VALID_RECENTLY_PLAYED_TYPES.has(item.type));
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  }, []);

  /** Fetch recently played from MusicKit API (native code tries containers first, falls back to songs) */
  const fetchMusicKitRecentlyPlayed = useCallback(async (): Promise<RecentlyPlayedItem[]> => {
    const response = await AppleMusicModule!.getRecentlyPlayed(20);
    return (response.items || []).map(
      (item: Record<string, unknown>, index: number) => ({
        type: (item.type || 'album') as RecentlyPlayedItem['type'],
        id: item.id,
        title: item.title || '',
        subtitle: item.subtitle || '',
        artworkUrl: item.artworkUrl || '',
        trackCount: item.trackCount || 0,
        playedAt: Date.now() - index * 60000,
        source: 'musickit' as const,
      })
    );
  }, []);

  /** Load recently played: MusicKit API first, then merge with local tracking */
  const loadRecentlyPlayed = useCallback(async () => {
    if (!isIOS || !AppleMusicModule || authStatus !== 'authorized') {
      const localItems = await loadLocalRecentlyPlayed();
      if (localItems.length > 0) {
        setRecentlyPlayed(localItems);
      }
      setIsRecentlyPlayedLoading(false);
      return;
    }

    try {
      const musicKitItems = await fetchMusicKitRecentlyPlayed();
      console.info('[AppleMusicContext] MusicKit recently played loaded:', musicKitItems.length, 'items');

      // Also load local tracking
      const localItems = await loadLocalRecentlyPlayed();

      // Merge: local items first (most recent CommEazy playback), then MusicKit items
      // Deduplicate by id+type
      const seenIds = new Set<string>();
      const merged: RecentlyPlayedItem[] = [];

      for (const item of localItems) {
        const key = `${item.type}-${item.id}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          merged.push({ ...item, source: 'local' });
        }
      }

      for (const item of musicKitItems) {
        const key = `${item.type}-${item.id}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          merged.push(item);
        }
      }

      const finalList = merged.slice(0, RECENTLY_PLAYED_MAX_ITEMS);
      setRecentlyPlayed(finalList);
    } catch (error) {
      console.warn('[AppleMusicContext] Failed to load MusicKit recently played, falling back to local:', error);
      const localItems = await loadLocalRecentlyPlayed();
      if (localItems.length > 0) {
        setRecentlyPlayed(localItems);
      }
    } finally {
      setIsRecentlyPlayedLoading(false);
    }
  }, [isIOS, authStatus, loadLocalRecentlyPlayed, fetchMusicKitRecentlyPlayed]);

  /** Add an item to recently played (dedup + FIFO) */
  const addToRecentlyPlayed = useCallback(async (item: Omit<RecentlyPlayedItem, 'playedAt'>) => {
    try {
      setRecentlyPlayed((prev) => {
        // Remove existing entry with same id+type (dedup — replay moves to top)
        const filtered = prev.filter((p) => !(p.id === item.id && p.type === item.type));
        // Add new entry at the front
        const updated = [{ ...item, playedAt: Date.now() }, ...filtered].slice(0, RECENTLY_PLAYED_MAX_ITEMS);
        // Persist asynchronously
        AsyncStorage.setItem(RECENTLY_PLAYED_STORAGE_KEY, JSON.stringify(updated)).catch((err) => {
          console.warn('[AppleMusicContext] Failed to save recently played:', err);
        });
        return updated;
      });
    } catch (error) {
      console.warn('[AppleMusicContext] Failed to add to recently played:', error);
    }
  }, []);

  // Load recently played on mount
  useEffect(() => {
    void loadRecentlyPlayed();
  }, [loadRecentlyPlayed]);

  // ============================================================
  // Native Event Listener (iOS only)
  // ============================================================

  // Refs for stable access inside event listeners
  const addToRecentlyPlayedRef = useRef(addToRecentlyPlayed);
  addToRecentlyPlayedRef.current = addToRecentlyPlayed;
  const artworkCacheRef = useRef(artworkCache);
  artworkCacheRef.current = artworkCache;

  useEffect(() => {
    if (!isIOS || !AppleMusicModule) return;

    const eventEmitter = new NativeEventEmitter(AppleMusicModule);

    // Track last state to skip redundant updates (reduces re-renders)
    let lastLoggedStatus: string | null = null;
    let lastPosition: number = 0;
    let lastStatus: string | null = null;

    const playbackStateSubscription = eventEmitter.addListener(
      'onPlaybackStateChange',
      (state: PlaybackState) => {
        // Only log when status actually changes (not on every time update)
        if (state.status !== lastLoggedStatus) {
          console.log('[AppleMusicContext] Playback state changed:', state.status);
          lastLoggedStatus = state.status;
        }

        // Debounce: skip update if only position changed by <0.5s and status is the same.
        // This prevents re-rendering the entire component tree on every timer tick.
        const statusChanged = state.status !== lastStatus;
        const positionDelta = Math.abs((state.currentTime ?? 0) - lastPosition);

        if (!statusChanged && positionDelta < 0.5) {
          return; // Skip redundant update
        }

        lastStatus = state.status;
        lastPosition = state.currentTime ?? 0;

        setPlaybackState(state);
        setIsLoading(false);
      }
    );

    const nowPlayingSubscription = eventEmitter.addListener(
      'onNowPlayingItemChange',
      (item: AppleMusicSong | null) => {
        console.log('[AppleMusicContext] Now playing changed:', item?.title, 'artworkUrl:', item?.artworkUrl);
        setNowPlaying(item);

        // MusicKit's container API automatically tracks recently played
        // albums/playlists/stations when using ApplicationMusicPlayer,
        // so no manual local tracking needed.
      }
    );

    const queueSubscription = eventEmitter.addListener(
      'onQueueChange',
      (items: AppleMusicSong[]) => {
        console.log('[AppleMusicContext] Queue changed:', items.length, 'items');
        setQueue(items);
      }
    );

    const authSubscription = eventEmitter.addListener(
      'onAuthorizationStatusChange',
      (data: { status: AppleMusicAuthStatus }) => {
        console.log('[AppleMusicContext] Auth status changed:', data.status);
        setAuthStatus(data.status);
      }
    );

    return () => {
      playbackStateSubscription.remove();
      nowPlayingSubscription.remove();
      queueSubscription.remove();
      authSubscription.remove();
    };
  }, [isIOS]);

  // ============================================================
  // Top Charts (cached from API, loaded on demand)
  // ============================================================

  const loadTopCharts = useCallback(async () => {
    if (!isIOS || !AppleMusicModule || authStatus !== 'authorized') {
      return;
    }

    // Skip if already loaded or loading
    if (topCharts || isTopChartsLoading) return;

    setIsTopChartsLoading(true);
    try {
      const charts = await AppleMusicModule.getTopCharts(['songs', 'albums', 'playlists'], 10);
      setTopCharts(charts);
      console.log('[AppleMusicContext] Top charts loaded');
    } catch (error) {
      console.warn('[AppleMusicContext] Failed to load top charts:', error);
    } finally {
      setIsTopChartsLoading(false);
    }
  }, [isIOS, authStatus, topCharts, isTopChartsLoading]);

  // ============================================================
  // Genres (cached from API, loaded on demand)
  // ============================================================

  const loadGenres = useCallback(async () => {
    if (!isIOS || !AppleMusicModule || authStatus !== 'authorized') {
      return;
    }

    // Skip if already loaded or loading
    if (genres.length > 0 || isGenresLoading) return;

    setIsGenresLoading(true);
    try {
      const genreList = await AppleMusicModule.getGenres();
      setGenres(genreList);
      console.log('[AppleMusicContext] Genres loaded:', genreList.length);
    } catch (error) {
      console.warn('[AppleMusicContext] Failed to load genres:', error);
    } finally {
      setIsGenresLoading(false);
    }
  }, [isIOS, authStatus, genres.length, isGenresLoading]);

  const getTopChartsByGenreCallback = useCallback(async (
    genreId: string,
    types: string[] = ['songs', 'albums'],
    limit: number = 15,
  ): Promise<SearchResults> => {
    if (!isIOS || !AppleMusicModule || authStatus !== 'authorized') {
      return {};
    }

    try {
      const charts = await AppleMusicModule.getTopChartsByGenre(genreId, types, limit);
      console.log('[AppleMusicContext] Charts loaded for genre:', genreId);
      return charts;
    } catch (error) {
      console.warn('[AppleMusicContext] Failed to load charts for genre:', error);
      return {};
    }
  }, [isIOS, authStatus]);

  // ============================================================
  // Initialization
  // ============================================================

  useEffect(() => {
    const init = async () => {
      if (!AppleMusicModule) {
        console.warn('[AppleMusicContext] AppleMusicModule not available');
        setAuthStatus('unavailable');
        return;
      }

      try {
        // Check auth status
        const status = await AppleMusicModule.checkAuthStatus();
        setAuthStatus(status);
        console.log('[AppleMusicContext] Initial auth status:', status);

        // Get capabilities (Android)
        if (isAndroid && AppleMusicModule.getCapabilities) {
          const caps = await AppleMusicModule.getCapabilities();
          setCapabilities(caps);
          console.log('[AppleMusicContext] Capabilities:', caps);
        } else if (isIOS) {
          setCapabilities({
            platform: 'ios',
            hasMusicKit: true,
            canSearch: true,
            canPlayback: true,
            canDeepLink: true,
            appInstalled: true,
          });
        }

        // Check subscription (iOS only)
        if (isIOS && status === 'authorized') {
          const sub = await AppleMusicModule.checkSubscription();
          setSubscription(sub);
          console.log('[AppleMusicContext] Subscription:', sub);
        }
      } catch (error) {
        console.error('[AppleMusicContext] Initialization error:', error);
        setAuthStatus('unavailable');
      }
    };

    init();
  }, [isIOS, isAndroid]);

  // ============================================================
  // Authorization
  // ============================================================

  const requestAuthorization = useCallback(async (): Promise<AppleMusicAuthStatus> => {
    if (!AppleMusicModule) {
      return 'unavailable';
    }

    try {
      if (isIOS) {
        const status = await AppleMusicModule.requestAuthorization();
        setAuthStatus(status);
        return status;
      } else {
        // Android: just return current status
        const status = await AppleMusicModule.checkAuthStatus();
        setAuthStatus(status);
        return status;
      }
    } catch (error) {
      console.error('[AppleMusicContext] Authorization error:', error);
      return 'denied';
    }
  }, [isIOS]);

  const checkSubscription = useCallback(async (): Promise<Subscription | null> => {
    if (!isIOS || !AppleMusicModule) {
      return null;
    }

    try {
      const sub = await AppleMusicModule.checkSubscription();
      setSubscription(sub);
      return sub;
    } catch (error) {
      console.error('[AppleMusicContext] Subscription check error:', error);
      return null;
    }
  }, [isIOS]);

  // ============================================================
  // Search (iOS only)
  // ============================================================

  const searchCatalog = useCallback(async (
    query: string,
    types: string[] = ['songs', 'albums', 'artists', 'playlists'],
    limit: number = 25
  ): Promise<SearchResults> => {
    if (!isIOS || !AppleMusicModule) {
      console.warn('[AppleMusicContext] Search not available on Android');
      return {};
    }

    try {
      return await AppleMusicModule.searchCatalog(query, types, limit);
    } catch (error) {
      console.error('[AppleMusicContext] Search error:', error);
      throw error;
    }
  }, [isIOS]);

  const getTopCharts = useCallback(async (
    types: string[] = ['songs', 'albums', 'playlists'],
    limit: number = 25
  ): Promise<SearchResults> => {
    if (!isIOS || !AppleMusicModule) {
      console.warn('[AppleMusicContext] Charts not available on Android');
      return {};
    }

    try {
      return await AppleMusicModule.getTopCharts(types, limit);
    } catch (error) {
      console.error('[AppleMusicContext] Charts error:', error);
      throw error;
    }
  }, [isIOS]);

  // ============================================================
  // Content Details (iOS only, for detail screens)
  // ============================================================

  const getAlbumDetails = useCallback(async (albumId: string): Promise<AlbumDetails> => {
    if (!isIOS || !AppleMusicModule) {
      throw new Error('Album details not available on Android');
    }

    try {
      return await AppleMusicModule.getAlbumDetails(albumId);
    } catch (error) {
      console.error('[AppleMusicContext] Get album details error:', error);
      throw error;
    }
  }, [isIOS]);

  const getArtistDetails = useCallback(async (artistId: string): Promise<ArtistDetails> => {
    if (!isIOS || !AppleMusicModule) {
      throw new Error('Artist details not available on Android');
    }

    try {
      return await AppleMusicModule.getArtistDetails(artistId);
    } catch (error) {
      console.error('[AppleMusicContext] Get artist details error:', error);
      throw error;
    }
  }, [isIOS]);

  const getPlaylistDetails = useCallback(async (playlistId: string): Promise<PlaylistDetails> => {
    if (!isIOS || !AppleMusicModule) {
      throw new Error('Playlist details not available on Android');
    }

    try {
      return await AppleMusicModule.getPlaylistDetails(playlistId);
    } catch (error) {
      console.error('[AppleMusicContext] Get playlist details error:', error);
      throw error;
    }
  }, [isIOS]);

  // ============================================================
  // Library Management (iOS only)
  // ============================================================

  const addToLibrary = useCallback(async (songId: string): Promise<boolean> => {
    if (!isIOS || !AppleMusicModule) {
      console.warn('[AppleMusicContext] Library management not available on Android');
      return false;
    }

    try {
      return await AppleMusicModule.addToLibrary(songId);
    } catch (error: any) {
      const errorCode = error?.code ?? error?.message?.split(']')?.[0]?.replace('[', '') ?? 'UNKNOWN';
      console.error(`[AppleMusicContext] Add to library error [${errorCode}]:`, error?.message ?? error);
      throw error;
    }
  }, [isIOS]);

  const isInLibrary = useCallback(async (songId: string): Promise<boolean> => {
    if (!isIOS || !AppleMusicModule) {
      return false;
    }

    try {
      return await AppleMusicModule.isInLibrary(songId);
    } catch (error) {
      console.error('[AppleMusicContext] Is in library error:', error);
      return false;
    }
  }, [isIOS]);

  const removeFromLibrary = useCallback(async (songId: string): Promise<void> => {
    if (!isIOS || !AppleMusicModule) {
      console.warn('[AppleMusicContext] Library management not available on Android');
      return;
    }

    try {
      await AppleMusicModule.removeFromLibrary(songId);
    } catch (error) {
      // Apple Music API doesn't support programmatic removal
      // This will throw NOT_SUPPORTED error from native side
      console.error('[AppleMusicContext] Remove from library error:', error);
      throw error;
    }
  }, [isIOS]);

  // ============================================================
  // Library Content Retrieval (iOS only)
  // ============================================================

  const getLibrarySongs = useCallback(async (
    limit: number = 50,
    offset: number = 0
  ): Promise<LibraryPaginatedResponse<AppleMusicSong>> => {
    if (!isIOS || !AppleMusicModule) {
      return { items: [], total: 0, offset: 0, limit: 0 };
    }

    try {
      return await AppleMusicModule.getLibrarySongs(limit, offset);
    } catch (error) {
      console.error('[AppleMusicContext] Get library songs error:', error);
      throw error;
    }
  }, [isIOS]);

  const getLibraryAlbums = useCallback(async (
    limit: number = 50,
    offset: number = 0
  ): Promise<LibraryPaginatedResponse<AppleMusicAlbum>> => {
    if (!isIOS || !AppleMusicModule) {
      return { items: [], total: 0, offset: 0, limit: 0 };
    }

    try {
      return await AppleMusicModule.getLibraryAlbums(limit, offset);
    } catch (error) {
      console.error('[AppleMusicContext] Get library albums error:', error);
      throw error;
    }
  }, [isIOS]);

  const getLibraryArtists = useCallback(async (
    limit: number = 50,
    offset: number = 0
  ): Promise<LibraryPaginatedResponse<AppleMusicArtist>> => {
    if (!isIOS || !AppleMusicModule) {
      return { items: [], total: 0, offset: 0, limit: 0 };
    }

    try {
      return await AppleMusicModule.getLibraryArtists(limit, offset);
    } catch (error) {
      console.error('[AppleMusicContext] Get library artists error:', error);
      throw error;
    }
  }, [isIOS]);

  const getLibraryPlaylists = useCallback(async (
    limit: number = 50,
    offset: number = 0
  ): Promise<LibraryPaginatedResponse<AppleMusicPlaylist>> => {
    if (!isIOS || !AppleMusicModule) {
      return { items: [], total: 0, offset: 0, limit: 0 };
    }

    try {
      return await AppleMusicModule.getLibraryPlaylists(limit, offset);
    } catch (error) {
      console.error('[AppleMusicContext] Get library playlists error:', error);
      throw error;
    }
  }, [isIOS]);

  const getLibraryCounts = useCallback(async (): Promise<LibraryCounts> => {
    if (!isIOS || !AppleMusicModule) {
      return { songs: 0, albums: 0, artists: 0, playlists: 0 };
    }

    try {
      return await AppleMusicModule.getLibraryCounts();
    } catch (error) {
      console.error('[AppleMusicContext] Get library counts error:', error);
      throw error;
    }
  }, [isIOS]);

  // ============================================================
  // Playback Control (iOS only)
  // ============================================================

  const playSong = useCallback(async (songId: string, artworkUrl?: string) => {
    if (!isIOS || !AppleMusicModule) {
      console.warn('[AppleMusicContext] Playback not available on Android');
      return;
    }

    try {
      // Request playback from orchestrator (stops other audio sources)
      await audioOrchestrator.requestPlayback('appleMusic');

      setIsLoading(true);
      setShowPlayer(true);

      // Cache the artwork URL from search results (more reliable than MusicKit queue URLs)
      if (artworkUrl && artworkUrl.startsWith('https://')) {
        console.log('[AppleMusicContext] Caching artwork URL for song:', songId, artworkUrl.substring(0, 80));
        setArtworkCache((prev) => {
          const newCache = new Map(prev);
          newCache.set(songId, artworkUrl);
          return newCache;
        });
      }

      // Detect if this is a library song (starts with "i.") or catalog song
      // Library songs have IDs like "i.8BCC85DD-ECB5-492B-B88F-733758A37D81"
      // Catalog songs have numeric IDs like "1234567890"
      const isLibrarySong = songId.startsWith('i.');

      if (isLibrarySong) {
        console.debug('[AppleMusicContext] Playing library song:', songId);
        await AppleMusicModule.playLibrarySong(songId);
      } else {
        console.debug('[AppleMusicContext] Playing catalog song:', songId);
        await AppleMusicModule.playSong(songId);
      }

      AccessibilityInfo.announceForAccessibility(t('modules.appleMusic.playing'));
    } catch (error) {
      setIsLoading(false);
      console.error('[AppleMusicContext] Play song error:', error);
      throw error;
    }
  }, [isIOS, audioOrchestrator, t]);

  const playAlbum = useCallback(async (albumId: string, startIndex: number = 0) => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      // Request playback from orchestrator (stops other audio sources)
      await audioOrchestrator.requestPlayback('appleMusic');

      setIsLoading(true);
      setShowPlayer(true);
      await AppleMusicModule.playAlbum(albumId, startIndex);
    } catch (error) {
      setIsLoading(false);
      console.error('[AppleMusicContext] Play album error:', error);
      throw error;
    }
  }, [isIOS, audioOrchestrator]);

  const playPlaylist = useCallback(async (playlistId: string, startIndex: number = 0) => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      // Request playback from orchestrator (stops other audio sources)
      await audioOrchestrator.requestPlayback('appleMusic');

      setIsLoading(true);
      setShowPlayer(true);
      await AppleMusicModule.playPlaylist(playlistId, startIndex);
    } catch (error) {
      setIsLoading(false);
      console.error('[AppleMusicContext] Play playlist error:', error);
      throw error;
    }
  }, [isIOS, audioOrchestrator]);

  const playStation = useCallback(async (stationId: string) => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      await audioOrchestrator.requestPlayback('appleMusic');
      setIsLoading(true);
      setShowPlayer(true);
      await AppleMusicModule.playStation(stationId);
    } catch (error) {
      setIsLoading(false);
      console.error('[AppleMusicContext] Play station error:', error);
      throw error;
    }
  }, [isIOS, audioOrchestrator]);

  const pause = useCallback(async () => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      await AppleMusicModule.pause();
      // Push paused state — keeps activeSource (pause is resumable)
      audioOrchestrator.updateState('appleMusic', { isPlaying: false });
      AccessibilityInfo.announceForAccessibility(t('modules.appleMusic.paused'));
    } catch (error) {
      console.error('[AppleMusicContext] Pause error:', error);
    }
  }, [isIOS, audioOrchestrator, t]);

  const resume = useCallback(async () => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      // Request playback from orchestrator (stops other audio sources)
      await audioOrchestrator.requestPlayback('appleMusic');

      await AppleMusicModule.resume();
      AccessibilityInfo.announceForAccessibility(t('modules.appleMusic.resumed'));
    } catch (error) {
      console.error('[AppleMusicContext] Resume error:', error);
    }
  }, [isIOS, audioOrchestrator, t]);

  const stop = useCallback(async () => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      await AppleMusicModule.stop();
      setShowPlayer(false);
      setNowPlaying(null);
      audioOrchestrator.releasePlayback('appleMusic');
      AccessibilityInfo.announceForAccessibility(t('modules.appleMusic.stopped'));
    } catch (error) {
      console.error('[AppleMusicContext] Stop error:', error);
    }
  }, [isIOS, audioOrchestrator, t]);

  /**
   * Toggle playback (play/pause) - uses native state to avoid race conditions
   * This is more reliable than checking isPlaying in JS callbacks
   */
  const togglePlayback = useCallback(async () => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      // Request playback slot from orchestrator (will stop other sources if needed)
      // Only needed when resuming, but orchestrator handles the logic
      await audioOrchestrator.requestPlayback('appleMusic');

      const result = await AppleMusicModule.togglePlayback();
      console.log('[AppleMusicContext] togglePlayback result:', result?.newState);

      // Accessibility announcement based on new state
      if (result?.newState === 'playing') {
        AccessibilityInfo.announceForAccessibility(t('modules.appleMusic.resumed'));
      } else if (result?.newState === 'paused') {
        AccessibilityInfo.announceForAccessibility(t('modules.appleMusic.paused'));
      }
    } catch (error) {
      console.error('[AppleMusicContext] Toggle playback error:', error);
    }
  }, [isIOS, audioOrchestrator, t]);

  const skipToNext = useCallback(async () => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      await AppleMusicModule.skipToNext();
    } catch (error) {
      console.error('[AppleMusicContext] Skip next error:', error);
    }
  }, [isIOS]);

  const skipToPrevious = useCallback(async () => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      await AppleMusicModule.skipToPrevious();
    } catch (error) {
      console.error('[AppleMusicContext] Skip previous error:', error);
    }
  }, [isIOS]);

  const seekTo = useCallback(async (position: number) => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      await AppleMusicModule.seekTo(position);
    } catch (error) {
      console.error('[AppleMusicContext] Seek error:', error);
    }
  }, [isIOS]);

  // ============================================================
  // Shuffle & Repeat (iOS only)
  // ============================================================

  const setShuffleModeCallback = useCallback(async (mode: ShuffleMode) => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      await AppleMusicModule.setShuffleMode(mode);
    } catch (error) {
      console.error('[AppleMusicContext] Set shuffle mode error:', error);
    }
  }, [isIOS]);

  const setRepeatModeCallback = useCallback(async (mode: RepeatMode) => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      await AppleMusicModule.setRepeatMode(mode);
    } catch (error) {
      console.error('[AppleMusicContext] Set repeat mode error:', error);
    }
  }, [isIOS]);

  // ============================================================
  // Queue (iOS only)
  // ============================================================

  const addToQueue = useCallback(async (songId: string, position: 'next' | 'last' = 'last') => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      await AppleMusicModule.addToQueue(songId, position);
    } catch (error) {
      console.error('[AppleMusicContext] Add to queue error:', error);
    }
  }, [isIOS]);

  // ============================================================
  // Android-specific
  // ============================================================

  const openPlayStore = useCallback(async () => {
    if (!isAndroid || !AppleMusicModule) return;

    try {
      await AppleMusicModule.openPlayStore();
    } catch (error) {
      console.error('[AppleMusicContext] Open Play Store error:', error);
    }
  }, [isAndroid]);

  const openAppleMusicApp = useCallback(async () => {
    if (!isAndroid || !AppleMusicModule) return;

    try {
      await AppleMusicModule.openAppleMusicApp();
    } catch (error) {
      console.error('[AppleMusicContext] Open Apple Music app error:', error);
    }
  }, [isAndroid]);

  const openContent = useCallback(async (
    type: 'song' | 'album' | 'playlist' | 'artist',
    id: string
  ) => {
    if (!isAndroid || !AppleMusicModule) return;

    try {
      await AppleMusicModule.openContent(type, id);
    } catch (error) {
      console.error('[AppleMusicContext] Open content error:', error);
    }
  }, [isAndroid]);

  // ============================================================
  // Audio Orchestrator Registration + State Push
  // ============================================================

  // Use refs to provide stable callbacks for orchestrator (prevents re-registration cycles)
  const stopRef = useRef(stop);
  stopRef.current = stop;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Stable ref for orchestrator — prevents re-registration when context value changes
  const audioOrchestratorRef = useRef(audioOrchestrator);
  audioOrchestratorRef.current = audioOrchestrator;

  // Refs for getState pull fallback (all state needed to build AudioSourceState)
  const nowPlayingRef = useRef(nowPlaying);
  nowPlayingRef.current = nowPlaying;
  const playbackStateRef = useRef(playbackState);
  playbackStateRef.current = playbackState;
  const effectiveArtworkUrlRef = useRef(effectiveArtworkUrl);
  effectiveArtworkUrlRef.current = effectiveArtworkUrl;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  const sleepTimerActiveRef = useRef(sleepTimerActive);
  sleepTimerActiveRef.current = sleepTimerActive;

  // Build full state snapshot for Push + Pull
  const buildAppleMusicState = useCallback((): AudioSourceState => {
    const song = nowPlayingRef.current;
    const state = playbackStateRef.current;
    const position = state?.currentTime ?? 0;
    const duration = (song as any)?.duration ?? 0;
    return {
      isPlaying: isPlayingRef.current,
      isBuffering: isLoadingRef.current,
      title: song?.title || '',
      subtitle: (song as any)?.artistName || '',
      artwork: effectiveArtworkUrlRef.current ?? null,
      progressType: 'bar',
      progress: duration > 0 ? position / duration : 0,
      listenDuration: 0,
      position,
      duration,
      isFavorite: false, // Apple Music doesn't track favorites via context
      sleepTimerActive: sleepTimerActiveRef.current,
      playbackRate: 1,
      moduleId: 'appleMusic',
    };
  }, []);

  // Register Apple Music as an audio source — runs only on mount/unmount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    audioOrchestratorRef.current.registerSource('appleMusic', {
      stop: async () => {
        await stopRef.current();
      },
      isPlaying: () => isPlayingRef.current,
      getState: () => buildAppleMusicState(),
    });

    return () => {
      audioOrchestratorRef.current.unregisterSource('appleMusic');
    };
  }, [buildAppleMusicState]);

  // Push state to orchestrator whenever Apple Music state changes.
  // Uses ref for orchestrator to avoid re-triggering on every context value change.
  useEffect(() => {
    if (audioOrchestratorRef.current.activeSource !== 'appleMusic') return;
    audioOrchestratorRef.current.updateState('appleMusic', buildAppleMusicState());
  }, [
    isPlaying,
    nowPlaying,
    playbackState,
    effectiveArtworkUrl,
    isLoading,
    sleepTimerActive,
    buildAppleMusicState,
  ]);

  // ============================================================
  // Context Value
  // ============================================================

  const value = useMemo(
    (): AppleMusicContextValue => ({
      // Platform info
      isIOS,
      isAndroid,
      capabilities,

      // Authorization
      authStatus,
      isAuthorized,
      requestAuthorization,

      // Subscription
      subscription,
      checkSubscription,

      // Search
      searchCatalog,
      getTopCharts,

      // Content Details
      getAlbumDetails,
      getArtistDetails,
      getPlaylistDetails,

      // Library Management
      addToLibrary,
      isInLibrary,
      removeFromLibrary,

      // Library Content Retrieval
      getLibrarySongs,
      getLibraryAlbums,
      getLibraryArtists,
      getLibraryPlaylists,
      getLibraryCounts,

      // Playback
      playbackState,
      nowPlaying,
      effectiveArtworkUrl,
      isPlaying,
      isLoading,
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

      // Shuffle & Repeat
      shuffleMode,
      repeatMode,
      setShuffleMode: setShuffleModeCallback,
      setRepeatMode: setRepeatModeCallback,

      // Queue
      queue,
      addToQueue,

      // Sleep timer
      sleepTimerActive,
      setSleepTimerActive,

      // Android-specific
      openPlayStore,
      openAppleMusicApp,
      openContent,

      // Discovery: Recently Played
      recentlyPlayed,
      isRecentlyPlayedLoading,

      // Discovery: Top Charts
      topCharts,
      isTopChartsLoading,
      loadTopCharts,

      // Discovery: Genres
      genres,
      isGenresLoading,
      loadGenres,
      getTopChartsByGenre: getTopChartsByGenreCallback,

      // Player visibility
      showPlayer,
      setShowPlayer,
    }),
    [
      isIOS,
      isAndroid,
      capabilities,
      authStatus,
      isAuthorized,
      requestAuthorization,
      subscription,
      checkSubscription,
      searchCatalog,
      getTopCharts,
      getAlbumDetails,
      getArtistDetails,
      getPlaylistDetails,
      addToLibrary,
      isInLibrary,
      removeFromLibrary,
      getLibrarySongs,
      getLibraryAlbums,
      getLibraryArtists,
      getLibraryPlaylists,
      getLibraryCounts,
      playbackState,
      nowPlaying,
      effectiveArtworkUrl,
      isPlaying,
      isLoading,
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
      shuffleMode,
      repeatMode,
      setShuffleModeCallback,
      setRepeatModeCallback,
      queue,
      addToQueue,
      sleepTimerActive,
      openPlayStore,
      openAppleMusicApp,
      openContent,
      recentlyPlayed,
      isRecentlyPlayedLoading,
      topCharts,
      isTopChartsLoading,
      loadTopCharts,
      genres,
      isGenresLoading,
      loadGenres,
      getTopChartsByGenreCallback,
      showPlayer,
    ]
  );

  return (
    <AppleMusicContext.Provider value={value}>
      {children}
    </AppleMusicContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Hook to access Apple Music context
 * Must be used within an AppleMusicProvider
 */
export function useAppleMusicContext(): AppleMusicContextValue {
  const context = useContext(AppleMusicContext);
  if (!context) {
    throw new Error('useAppleMusicContext must be used within an AppleMusicProvider');
  }
  return context;
}

/**
 * Hook to safely access Apple Music context (returns null if not in provider)
 */
export function useAppleMusicContextSafe(): AppleMusicContextValue | null {
  return useContext(AppleMusicContext);
}

/**
 * Hook for basic Apple Music state
 */
export function useAppleMusicState(): {
  isPlaying: boolean;
  nowPlaying: AppleMusicSong | null;
  isAuthorized: boolean;
  isIOS: boolean;
} {
  const { isPlaying, nowPlaying, isAuthorized, isIOS } = useAppleMusicContext();
  return { isPlaying, nowPlaying, isAuthorized, isIOS };
}

/**
 * Hook for Apple Music playback controls
 */
export function useAppleMusicControls(): {
  playSong: (songId: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  togglePlayback: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
} {
  const { playSong, pause, resume, stop, togglePlayback, skipToNext, skipToPrevious, seekTo } = useAppleMusicContext();
  return { playSong, pause, resume, stop, togglePlayback, skipToNext, skipToPrevious, seekTo };
}

/**
 * Hook for Apple Music search
 */
export function useAppleMusicSearch(): {
  searchCatalog: (query: string, types?: string[], limit?: number) => Promise<SearchResults>;
  getTopCharts: (types?: string[], limit?: number) => Promise<SearchResults>;
} {
  const { searchCatalog, getTopCharts } = useAppleMusicContext();
  return { searchCatalog, getTopCharts };
}

// Re-export types and helpers from appleMusicContextTypes
export type {
  AppleMusicAuthStatus,
  ShuffleMode,
  RepeatMode,
  AppleMusicSong,
  AppleMusicAlbum,
  AppleMusicArtist,
  AppleMusicPlaylist,
  AppleMusicGenre,
  SearchResults,
  AlbumDetails,
  ArtistDetails,
  PlaylistDetails,
  LibraryPaginatedResponse,
  LibraryCounts,
  PlaybackState,
  Subscription,
  PlatformCapabilities,
  RecentlyPlayedItem,
  AppleMusicContextValue,
} from './appleMusicContextTypes';
