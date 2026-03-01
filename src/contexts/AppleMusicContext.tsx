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
import { useTranslation } from 'react-i18next';

import { useAudioOrchestrator } from './AudioOrchestratorContext';

// ============================================================
// Types
// ============================================================

export type AppleMusicAuthStatus =
  | 'authorized'        // iOS: MusicKit authorized
  | 'denied'            // iOS: MusicKit denied
  | 'notDetermined'     // iOS: Not yet requested
  | 'restricted'        // iOS: Restricted (parental controls)
  | 'app_installed'     // Android: Apple Music app is installed
  | 'app_not_installed' // Android: Apple Music app not installed
  | 'unavailable';      // Module not available

export type ShuffleMode = 'off' | 'songs';
export type RepeatMode = 'off' | 'one' | 'all';

export interface AppleMusicSong {
  id: string;
  title: string;
  artistName: string;
  albumTitle: string;
  duration: number;       // seconds
  artworkUrl: string;
  trackNumber: number;
  discNumber: number;
  isExplicit: boolean;
}

export interface AppleMusicAlbum {
  id: string;
  title: string;
  artistName: string;
  artworkUrl: string;
  trackCount: number;
  releaseDate: string;
  isExplicit: boolean;
}

export interface AppleMusicArtist {
  id: string;
  name: string;
  artworkUrl: string;
}

export interface AppleMusicPlaylist {
  id: string;
  name: string;
  curatorName: string;
  artworkUrl: string;
  description: string;
}

export interface SearchResults {
  songs?: AppleMusicSong[];
  albums?: AppleMusicAlbum[];
  artists?: AppleMusicArtist[];
  playlists?: AppleMusicPlaylist[];
}

// Detail response types (for detail screens)
export interface AlbumDetails extends AppleMusicAlbum {
  tracks: AppleMusicSong[];
  artists?: AppleMusicArtist[];
}

export interface ArtistDetails extends AppleMusicArtist {
  topSongs: AppleMusicSong[];
  albums: AppleMusicAlbum[];
}

export interface PlaylistDetails extends AppleMusicPlaylist {
  tracks: AppleMusicSong[];
}

// Library pagination response
export interface LibraryPaginatedResponse<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

// Library counts response
export interface LibraryCounts {
  songs: number;
  albums: number;
  artists: number;
  playlists: number;
}

export interface PlaybackState {
  status: 'playing' | 'paused' | 'stopped' | 'interrupted' | 'seekingForward' | 'seekingBackward' | 'unknown';
  playbackTime: number;
  currentTime: number;  // Alias for playbackTime
  duration: number;     // Current song duration in seconds
  shuffleMode: ShuffleMode;
  repeatMode: RepeatMode;
}

export interface Subscription {
  canPlayCatalogContent: boolean;
  hasCloudLibraryEnabled: boolean;
}

export interface PlatformCapabilities {
  platform: 'ios' | 'android';
  hasMusicKit: boolean;       // Full MusicKit (iOS only)
  canSearch: boolean;         // Search Apple Music catalog
  canPlayback: boolean;       // Control playback
  canDeepLink: boolean;       // Open content in Apple Music app
  appInstalled: boolean;      // Apple Music app installed (Android)
}

// Library cache structure
export interface LibraryCache {
  songs: AppleMusicSong[];
  albums: AppleMusicAlbum[];
  artists: AppleMusicArtist[];
  playlists: AppleMusicPlaylist[];
  counts: LibraryCounts | null;
  lastUpdated: number | null;  // timestamp
}

export interface AppleMusicContextValue {
  // Platform info
  isIOS: boolean;
  isAndroid: boolean;
  capabilities: PlatformCapabilities | null;

  // Authorization
  authStatus: AppleMusicAuthStatus;
  isAuthorized: boolean;
  requestAuthorization: () => Promise<AppleMusicAuthStatus>;

  // Subscription (iOS only)
  subscription: Subscription | null;
  checkSubscription: () => Promise<Subscription | null>;

  // Search (iOS only)
  searchCatalog: (query: string, types?: string[], limit?: number) => Promise<SearchResults>;
  getTopCharts: (types?: string[], limit?: number) => Promise<SearchResults>;

  // Content Details (iOS only, for detail screens)
  getAlbumDetails: (albumId: string) => Promise<AlbumDetails>;
  getArtistDetails: (artistId: string) => Promise<ArtistDetails>;
  getPlaylistDetails: (playlistId: string) => Promise<PlaylistDetails>;

  // Library Management (iOS only)
  addToLibrary: (songId: string) => Promise<boolean>;
  isInLibrary: (songId: string) => Promise<boolean>;
  removeFromLibrary: (songId: string) => Promise<void>;

  // Library Content Retrieval (iOS only)
  getLibrarySongs: (limit?: number, offset?: number) => Promise<LibraryPaginatedResponse<AppleMusicSong>>;
  getLibraryAlbums: (limit?: number, offset?: number) => Promise<LibraryPaginatedResponse<AppleMusicAlbum>>;
  getLibraryArtists: (limit?: number, offset?: number) => Promise<LibraryPaginatedResponse<AppleMusicArtist>>;
  getLibraryPlaylists: (limit?: number, offset?: number) => Promise<LibraryPaginatedResponse<AppleMusicPlaylist>>;
  getLibraryCounts: () => Promise<LibraryCounts>;

  // Library Cache (preloaded at startup for instant access)
  libraryCache: LibraryCache;
  isLibraryCacheLoading: boolean;
  preloadLibrary: () => Promise<void>;
  refreshLibraryCache: () => Promise<void>;

  // Playback (iOS only)
  playbackState: PlaybackState | null;
  nowPlaying: AppleMusicSong | null;
  /** Effective artwork URL (prefers search result URL over MusicKit queue URL) */
  effectiveArtworkUrl: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  /** Play a song - optionally pass artworkUrl from search results for reliable artwork display */
  playSong: (songId: string, artworkUrl?: string) => Promise<void>;
  playAlbum: (albumId: string, startIndex?: number) => Promise<void>;
  playPlaylist: (playlistId: string, startIndex?: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  /** Toggle playback - uses native state to avoid race conditions */
  togglePlayback: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;

  // Shuffle & Repeat (iOS only)
  shuffleMode: ShuffleMode;
  repeatMode: RepeatMode;
  setShuffleMode: (mode: ShuffleMode) => Promise<void>;
  setRepeatMode: (mode: RepeatMode) => Promise<void>;

  // Queue (iOS only)
  queue: AppleMusicSong[];
  addToQueue: (songId: string, position?: 'next' | 'last') => Promise<void>;

  // Sleep timer
  sleepTimerActive: boolean;
  setSleepTimerActive: (active: boolean) => void;

  // Android-specific
  openPlayStore: () => Promise<void>;
  openAppleMusicApp: () => Promise<void>;
  openContent: (type: 'song' | 'album' | 'playlist' | 'artist', id: string) => Promise<void>;

  // Player visibility
  showPlayer: boolean;
  setShowPlayer: (show: boolean) => void;
}

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

  // Library cache for instant access (preloaded at startup)
  const [libraryCache, setLibraryCache] = useState<LibraryCache>({
    songs: [],
    albums: [],
    artists: [],
    playlists: [],
    counts: null,
    lastUpdated: null,
  });
  const [isLibraryCacheLoading, setIsLibraryCacheLoading] = useState(false);

  // Track when app went to background for refresh logic
  const lastBackgroundTimeRef = useRef<number | null>(null);

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
  // Native Event Listener (iOS only)
  // ============================================================

  useEffect(() => {
    if (!isIOS || !AppleMusicModule) return;

    const eventEmitter = new NativeEventEmitter(AppleMusicModule);

    // Track last logged status to avoid excessive console spam
    let lastLoggedStatus: string | null = null;

    const playbackStateSubscription = eventEmitter.addListener(
      'onPlaybackStateChange',
      (state: PlaybackState) => {
        // Only log when status actually changes (not on every time update)
        if (state.status !== lastLoggedStatus) {
          console.log('[AppleMusicContext] Playback state changed:', state.status);
          lastLoggedStatus = state.status;
        }
        setPlaybackState(state);
        setIsLoading(false);
      }
    );

    const nowPlayingSubscription = eventEmitter.addListener(
      'onNowPlayingItemChange',
      (item: AppleMusicSong | null) => {
        console.log('[AppleMusicContext] Now playing changed:', item?.title, 'artworkUrl:', item?.artworkUrl);
        setNowPlaying(item);
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
    } catch (error) {
      console.error('[AppleMusicContext] Add to library error:', error);
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
  // Library Cache (Preload at Startup)
  // ============================================================

  /**
   * Preload library content for instant access.
   * Called at app startup to ensure "Mijn Muziek" is immediately available.
   *
   * Loads first 500 songs and albums (most commonly accessed).
   * Artists and playlists are loaded on-demand.
   */
  const preloadLibrary = useCallback(async (): Promise<void> => {
    if (!isIOS || !AppleMusicModule || authStatus !== 'authorized') {
      console.log('[AppleMusicContext] Skipping library preload (not iOS or not authorized)');
      return;
    }

    // Skip if already loading or recently loaded (within 5 minutes)
    if (isLibraryCacheLoading) {
      console.log('[AppleMusicContext] Library preload already in progress');
      return;
    }

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (libraryCache.lastUpdated && libraryCache.lastUpdated > fiveMinutesAgo) {
      console.log('[AppleMusicContext] Library cache is fresh, skipping preload');
      return;
    }

    setIsLibraryCacheLoading(true);
    console.log('[AppleMusicContext] Starting library preload...');

    try {
      // Load counts and first batch of songs/albums in parallel
      const [counts, songsResult, albumsResult] = await Promise.all([
        AppleMusicModule.getLibraryCounts(),
        AppleMusicModule.getLibrarySongs(500, 0),
        AppleMusicModule.getLibraryAlbums(500, 0),
      ]);

      setLibraryCache({
        songs: songsResult.items,
        albums: albumsResult.items,
        artists: [],  // Load on-demand
        playlists: [],  // Load on-demand
        counts,
        lastUpdated: Date.now(),
      });

      console.log('[AppleMusicContext] Library preload complete:', {
        songs: songsResult.items.length,
        albums: albumsResult.items.length,
        totalSongs: counts.songs,
        totalAlbums: counts.albums,
      });
    } catch (error) {
      console.error('[AppleMusicContext] Library preload error:', error);
    } finally {
      setIsLibraryCacheLoading(false);
    }
  }, [isIOS, authStatus, isLibraryCacheLoading, libraryCache.lastUpdated]);

  /**
   * Force refresh library cache.
   * Called when user pulls to refresh or after returning from background >30 min.
   */
  const refreshLibraryCache = useCallback(async (): Promise<void> => {
    if (!isIOS || !AppleMusicModule || authStatus !== 'authorized') {
      return;
    }

    setIsLibraryCacheLoading(true);
    console.log('[AppleMusicContext] Refreshing library cache...');

    try {
      const [counts, songsResult, albumsResult] = await Promise.all([
        AppleMusicModule.getLibraryCounts(),
        AppleMusicModule.getLibrarySongs(500, 0),
        AppleMusicModule.getLibraryAlbums(500, 0),
      ]);

      setLibraryCache((prev) => ({
        ...prev,
        songs: songsResult.items,
        albums: albumsResult.items,
        counts,
        lastUpdated: Date.now(),
      }));

      console.log('[AppleMusicContext] Library cache refreshed');
    } catch (error) {
      console.error('[AppleMusicContext] Library refresh error:', error);
    } finally {
      setIsLibraryCacheLoading(false);
    }
  }, [isIOS, authStatus]);

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

  const pause = useCallback(async () => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      await AppleMusicModule.pause();
      AccessibilityInfo.announceForAccessibility(t('modules.appleMusic.paused'));
    } catch (error) {
      console.error('[AppleMusicContext] Pause error:', error);
    }
  }, [isIOS, t]);

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
  // Audio Orchestrator Registration
  // ============================================================

  // Use refs to provide stable callbacks for orchestrator (prevents re-registration cycles)
  const stopRef = useRef(stop);
  stopRef.current = stop;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    // Register Apple Music as an audio source with the orchestrator
    audioOrchestrator.registerSource('appleMusic', {
      stop: async () => {
        // Use ref to always call the latest stop function
        await stopRef.current();
      },
      isPlaying: () => isPlayingRef.current,
    });

    return () => {
      audioOrchestrator.unregisterSource('appleMusic');
    };
  }, [audioOrchestrator]);

  // ============================================================
  // Library Preload at Startup
  // ============================================================

  // Use ref to avoid preloadLibrary in effect deps (its deps change during preload → cascading re-triggers)
  const preloadLibraryRef = useRef(preloadLibrary);
  preloadLibraryRef.current = preloadLibrary;

  // Preload library when authorized (runs once after authorization)
  useEffect(() => {
    if (authStatus === 'authorized' && isIOS) {
      void preloadLibraryRef.current();
    }
  }, [authStatus, isIOS]);

  // ============================================================
  // Foreground Refresh (after 30+ min in background)
  // ============================================================

  useEffect(() => {
    if (!isIOS) return;

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Record when app went to background
        lastBackgroundTimeRef.current = Date.now();
        console.log('[AppleMusicContext] App going to background');
      } else if (nextAppState === 'active') {
        // App returned to foreground
        const backgroundTime = lastBackgroundTimeRef.current;
        if (backgroundTime) {
          const timeInBackground = Date.now() - backgroundTime;
          const thirtyMinutes = 30 * 60 * 1000;

          if (timeInBackground > thirtyMinutes && authStatus === 'authorized') {
            console.log('[AppleMusicContext] App returned after 30+ min, refreshing library cache...');
            void refreshLibraryCache();
          } else {
            console.log('[AppleMusicContext] App returned to foreground (background time:',
              Math.round(timeInBackground / 1000), 'seconds)');
          }
        }
        lastBackgroundTimeRef.current = null;
      }
    };

    // Import AppState dynamically to avoid issues
    const { AppState } = require('react-native');
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isIOS, authStatus, refreshLibraryCache]);

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

      // Library Cache
      libraryCache,
      isLibraryCacheLoading,
      preloadLibrary,
      refreshLibraryCache,

      // Playback
      playbackState,
      nowPlaying,
      effectiveArtworkUrl,
      isPlaying,
      isLoading,
      playSong,
      playAlbum,
      playPlaylist,
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
      libraryCache,
      isLibraryCacheLoading,
      preloadLibrary,
      refreshLibraryCache,
      playbackState,
      nowPlaying,
      effectiveArtworkUrl,
      isPlaying,
      isLoading,
      playSong,
      playAlbum,
      playPlaylist,
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
