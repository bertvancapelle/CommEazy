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
  type ReactNode,
} from 'react';
import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { useTranslation } from 'react-i18next';

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

export interface PlaybackState {
  status: 'playing' | 'paused' | 'stopped' | 'interrupted' | 'seekingForward' | 'seekingBackward' | 'unknown';
  playbackTime: number;
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

  // Playback (iOS only)
  playbackState: PlaybackState | null;
  nowPlaying: AppleMusicSong | null;
  isPlaying: boolean;
  isLoading: boolean;
  playSong: (songId: string) => Promise<void>;
  playAlbum: (albumId: string, startIndex?: number) => Promise<void>;
  playPlaylist: (playlistId: string, startIndex?: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
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

  // Derived state
  const isAuthorized = authStatus === 'authorized' || authStatus === 'app_installed';
  const isPlaying = playbackState?.status === 'playing';
  const shuffleMode = playbackState?.shuffleMode ?? 'off';
  const repeatMode = playbackState?.repeatMode ?? 'off';

  // ============================================================
  // Native Event Listener (iOS only)
  // ============================================================

  useEffect(() => {
    if (!isIOS || !AppleMusicModule) return;

    const eventEmitter = new NativeEventEmitter(AppleMusicModule);

    const playbackStateSubscription = eventEmitter.addListener(
      'onPlaybackStateChange',
      (state: PlaybackState) => {
        console.log('[AppleMusicContext] Playback state changed:', state.status);
        setPlaybackState(state);
        setIsLoading(false);
      }
    );

    const nowPlayingSubscription = eventEmitter.addListener(
      'onNowPlayingItemChange',
      (item: AppleMusicSong | null) => {
        console.log('[AppleMusicContext] Now playing changed:', item?.title);
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
  // Playback Control (iOS only)
  // ============================================================

  const playSong = useCallback(async (songId: string) => {
    if (!isIOS || !AppleMusicModule) {
      console.warn('[AppleMusicContext] Playback not available on Android');
      return;
    }

    try {
      setIsLoading(true);
      setShowPlayer(true);
      await AppleMusicModule.playSong(songId);
      AccessibilityInfo.announceForAccessibility(t('modules.appleMusic.playing'));
    } catch (error) {
      setIsLoading(false);
      console.error('[AppleMusicContext] Play song error:', error);
      throw error;
    }
  }, [isIOS, t]);

  const playAlbum = useCallback(async (albumId: string, startIndex: number = 0) => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      setIsLoading(true);
      setShowPlayer(true);
      await AppleMusicModule.playAlbum(albumId, startIndex);
    } catch (error) {
      setIsLoading(false);
      console.error('[AppleMusicContext] Play album error:', error);
      throw error;
    }
  }, [isIOS]);

  const playPlaylist = useCallback(async (playlistId: string, startIndex: number = 0) => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      setIsLoading(true);
      setShowPlayer(true);
      await AppleMusicModule.playPlaylist(playlistId, startIndex);
    } catch (error) {
      setIsLoading(false);
      console.error('[AppleMusicContext] Play playlist error:', error);
      throw error;
    }
  }, [isIOS]);

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
      await AppleMusicModule.resume();
      AccessibilityInfo.announceForAccessibility(t('modules.appleMusic.resumed'));
    } catch (error) {
      console.error('[AppleMusicContext] Resume error:', error);
    }
  }, [isIOS, t]);

  const stop = useCallback(async () => {
    if (!isIOS || !AppleMusicModule) return;

    try {
      await AppleMusicModule.stop();
      setShowPlayer(false);
      setNowPlaying(null);
      AccessibilityInfo.announceForAccessibility(t('modules.appleMusic.stopped'));
    } catch (error) {
      console.error('[AppleMusicContext] Stop error:', error);
    }
  }, [isIOS, t]);

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

      // Playback
      playbackState,
      nowPlaying,
      isPlaying,
      isLoading,
      playSong,
      playAlbum,
      playPlaylist,
      pause,
      resume,
      stop,
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
      playbackState,
      nowPlaying,
      isPlaying,
      isLoading,
      playSong,
      playAlbum,
      playPlaylist,
      pause,
      resume,
      stop,
      skipToNext,
      skipToPrevious,
      seekTo,
      shuffleMode,
      repeatMode,
      setShuffleModeCallback,
      setRepeatModeCallback,
      queue,
      addToQueue,
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
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
} {
  const { playSong, pause, resume, stop, skipToNext, skipToPrevious, seekTo } = useAppleMusicContext();
  return { playSong, pause, resume, stop, skipToNext, skipToPrevious, seekTo };
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
