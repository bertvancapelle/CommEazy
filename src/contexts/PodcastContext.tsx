/**
 * PodcastContext — Global podcast player state management
 *
 * Provides app-wide access to podcast playback state:
 * - Current episode and show
 * - Playback controls (play, pause, stop, seek, skip)
 * - Episode progress tracking with resume
 * - Podcast subscriptions
 *
 * Uses react-native-track-player for background audio with lock screen controls.
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 * @see .claude/skills/ui-designer/SKILL.md
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
  AccessibilityInfo,
  DeviceEventEmitter,
} from 'react-native';
import TrackPlayer, {
  Capability,
  State,
  Event,
  usePlaybackState,
  useProgress,
} from 'react-native-track-player';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Types
// ============================================================

export interface PodcastEpisode {
  id: string;
  podcastId: string;
  title: string;
  description: string;
  streamUrl: string;
  duration: number;      // in seconds
  publishedAt: number;   // timestamp
  artwork?: string;
}

export interface PodcastShow {
  id: string;
  title: string;
  author: string;
  description?: string;
  artwork?: string;
  feedUrl: string;
  subscribedAt: number;
}

export interface EpisodeProgress {
  position: number;      // in seconds
  duration: number;      // in seconds
  completedAt?: number;  // timestamp when completed (>90%)
  lastPlayedAt: number;  // timestamp
}

export interface PodcastContextValue {
  // Playback state
  isPlaying: boolean;
  isLoading: boolean;
  isBuffering: boolean;
  currentEpisode: PodcastEpisode | null;
  currentShow: PodcastShow | null;
  progress: { position: number; duration: number; buffered: number };
  playbackRate: number;

  // Current show's episode list (for next/previous episode)
  currentShowEpisodes: PodcastEpisode[];
  setCurrentShowEpisodes: (episodes: PodcastEpisode[]) => void;

  // Subscriptions
  subscriptions: PodcastShow[];

  // Episode progress
  getEpisodeProgress: (episodeId: string) => EpisodeProgress | null;
  isEpisodeCompleted: (episodeId: string) => boolean;

  // Playback controls
  playEpisode: (episode: PodcastEpisode, show: PodcastShow) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  skipForward: (seconds?: number) => Promise<void>;
  skipBackward: (seconds?: number) => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;

  // Next episode
  getNextEpisode: () => PodcastEpisode | null;
  playNextEpisode: () => Promise<void>;

  // Subscriptions
  subscribe: (show: PodcastShow) => Promise<void>;
  unsubscribe: (showId: string) => Promise<void>;
  isSubscribed: (showId: string) => boolean;

  // Sleep timer
  sleepTimerMinutes: number | null;
  setSleepTimer: (minutes: number | null) => void;
}

// ============================================================
// Constants
// ============================================================

const STORAGE_KEYS = {
  subscriptions: 'podcast_subscriptions',
  progress: 'podcast_episode_progress',
};

const DEFAULT_SKIP_FORWARD = 30; // seconds
const DEFAULT_SKIP_BACKWARD = 10; // seconds
const PROGRESS_SAVE_INTERVAL = 5000; // 5 seconds
const COMPLETED_THRESHOLD = 0.9; // 90% = completed

// Track Player is initialized once at app startup (shared with RadioContext)
let isTrackPlayerInitialized = false;

// ============================================================
// Context
// ============================================================

const PodcastContext = createContext<PodcastContextValue | null>(null);

interface PodcastProviderProps {
  children: ReactNode;
}

/**
 * Initialize Track Player with podcast-specific capabilities
 */
async function setupTrackPlayer(): Promise<boolean> {
  if (isTrackPlayerInitialized) {
    return true;
  }

  try {
    // Try to setup player - it may already be initialized by RadioContext
    try {
      await TrackPlayer.setupPlayer({
        waitForBuffer: true,
      });
      console.debug('[PodcastContext] TrackPlayer initialized successfully');
    } catch (setupError) {
      // If already initialized, that's fine - just continue
      if (setupError instanceof Error && setupError.message.includes('already been initialized')) {
        console.debug('[PodcastContext] TrackPlayer was already initialized');
      } else {
        throw setupError;
      }
    }

    // Configure capabilities for lock screen controls
    await TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.Stop,
        Capability.SeekTo,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
      notificationCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.Stop,
        Capability.SeekTo,
      ],
      // Progress bar on lock screen
      progressUpdateEventInterval: 1,
    });

    isTrackPlayerInitialized = true;
    return true;
  } catch (error) {
    console.error('[PodcastContext] Failed to initialize TrackPlayer:', error);
    return false;
  }
}

/**
 * Format seconds to display time (mm:ss or hh:mm:ss)
 */
export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Provider component for podcast context
 */
export function PodcastProvider({ children }: PodcastProviderProps) {
  const { t } = useTranslation();
  const playbackState = usePlaybackState();
  const trackProgress = useProgress();

  // State
  const [currentEpisode, setCurrentEpisode] = useState<PodcastEpisode | null>(null);
  const [currentShow, setCurrentShow] = useState<PodcastShow | null>(null);
  const [currentShowEpisodes, setCurrentShowEpisodes] = useState<PodcastEpisode[]>([]);
  const [subscriptions, setSubscriptions] = useState<PodcastShow[]>([]);
  const [episodeProgress, setEpisodeProgress] = useState<Record<string, EpisodeProgress>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1.0);
  const [sleepTimerMinutes, setSleepTimerMinutesState] = useState<number | null>(null);

  // Refs for progress saving
  const progressSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived state from playback state
  const isPlaying = playbackState.state === State.Playing;
  const isBuffering = playbackState.state === State.Buffering || playbackState.state === State.Loading;

  // ============================================================
  // Initialization
  // ============================================================

  useEffect(() => {
    const init = async () => {
      const success = await setupTrackPlayer();
      setIsInitialized(success);

      // Load subscriptions from storage
      try {
        const storedSubs = await AsyncStorage.getItem(STORAGE_KEYS.subscriptions);
        if (storedSubs) {
          setSubscriptions(JSON.parse(storedSubs));
        }
      } catch (error) {
        console.error('[PodcastContext] Failed to load subscriptions:', error);
      }

      // Load episode progress from storage
      try {
        const storedProgress = await AsyncStorage.getItem(STORAGE_KEYS.progress);
        if (storedProgress) {
          setEpisodeProgress(JSON.parse(storedProgress));
        }
      } catch (error) {
        console.error('[PodcastContext] Failed to load episode progress:', error);
      }
    };
    init();

    return () => {
      // Clear intervals on unmount
      if (progressSaveIntervalRef.current) {
        clearInterval(progressSaveIntervalRef.current);
      }
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
      }
    };
  }, []);

  // ============================================================
  // Progress Saving
  // ============================================================

  // Save progress periodically while playing
  useEffect(() => {
    if (isPlaying && currentEpisode) {
      progressSaveIntervalRef.current = setInterval(() => {
        if (currentEpisode && trackProgress.position > 0) {
          const newProgress: EpisodeProgress = {
            position: trackProgress.position,
            duration: trackProgress.duration || currentEpisode.duration,
            lastPlayedAt: Date.now(),
          };

          // Check if completed (>90%)
          if (trackProgress.duration > 0 &&
              trackProgress.position / trackProgress.duration >= COMPLETED_THRESHOLD) {
            newProgress.completedAt = Date.now();
          }

          setEpisodeProgress(prev => {
            const updated = { ...prev, [currentEpisode.id]: newProgress };
            // Save to storage (async, don't await)
            AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(updated));
            return updated;
          });
        }
      }, PROGRESS_SAVE_INTERVAL);

      return () => {
        if (progressSaveIntervalRef.current) {
          clearInterval(progressSaveIntervalRef.current);
        }
      };
    }
  }, [isPlaying, currentEpisode, trackProgress.position, trackProgress.duration]);

  // ============================================================
  // Event Listeners
  // ============================================================

  useEffect(() => {
    if (!isInitialized) return;

    // Listen for playback errors
    const errorListener = TrackPlayer.addEventListener(
      Event.PlaybackError,
      (error) => {
        console.error('[PodcastContext] Playback error:', error);
        setIsLoading(false);

        // Emit error event for UI to handle
        DeviceEventEmitter.emit('podcastPlaybackError', error);
      }
    );

    // Listen for playback state changes
    const stateListener = TrackPlayer.addEventListener(
      Event.PlaybackState,
      (data) => {
        console.debug('[PodcastContext] Playback state changed:', data.state);

        if (data.state === State.Playing) {
          setIsLoading(false);
        } else if (data.state === State.Error) {
          setIsLoading(false);
        }
      }
    );

    // Listen for track end
    const endListener = TrackPlayer.addEventListener(
      Event.PlaybackQueueEnded,
      () => {
        console.debug('[PodcastContext] Episode ended');
        if (currentEpisode) {
          // Mark as completed
          setEpisodeProgress(prev => {
            const updated = {
              ...prev,
              [currentEpisode.id]: {
                ...prev[currentEpisode.id],
                position: currentEpisode.duration,
                completedAt: Date.now(),
                lastPlayedAt: Date.now(),
              },
            };
            AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(updated));
            return updated;
          });

          // Check if there's a next episode and emit event for UI
          if (currentShowEpisodes.length > 1) {
            const currentIndex = currentShowEpisodes.findIndex(ep => ep.id === currentEpisode.id);
            // Episodes are sorted newest first, so "next" is the older episode (index + 1)
            const nextEpisode = currentIndex >= 0 && currentIndex < currentShowEpisodes.length - 1
              ? currentShowEpisodes[currentIndex + 1]
              : null;

            if (nextEpisode) {
              console.debug('[PodcastContext] Next episode available:', nextEpisode.title);
              DeviceEventEmitter.emit('podcastEpisodeEnded', {
                completedEpisode: currentEpisode,
                nextEpisode,
                show: currentShow,
              });
            } else {
              console.debug('[PodcastContext] No next episode - this was the last one');
              DeviceEventEmitter.emit('podcastEpisodeEnded', {
                completedEpisode: currentEpisode,
                nextEpisode: null,
                show: currentShow,
              });
            }
          } else {
            console.debug('[PodcastContext] Single episode show, no next episode');
            DeviceEventEmitter.emit('podcastEpisodeEnded', {
              completedEpisode: currentEpisode,
              nextEpisode: null,
              show: currentShow,
            });
          }
        }
      }
    );

    return () => {
      errorListener.remove();
      stateListener.remove();
      endListener.remove();
    };
  }, [isInitialized, currentEpisode]);

  // ============================================================
  // Voice Command Listeners
  // ============================================================

  useEffect(() => {
    const playSubscription = DeviceEventEmitter.addListener('voiceCommand:podcastPlay', () => {
      if (currentEpisode && !isPlaying) {
        play();
      }
    });

    const pauseSubscription = DeviceEventEmitter.addListener('voiceCommand:podcastPause', () => {
      if (isPlaying) {
        pause();
      }
    });

    const stopSubscription = DeviceEventEmitter.addListener('voiceCommand:podcastStop', () => {
      stop();
    });

    const skipForwardSubscription = DeviceEventEmitter.addListener('voiceCommand:podcastSkipForward', () => {
      skipForward();
    });

    const skipBackwardSubscription = DeviceEventEmitter.addListener('voiceCommand:podcastSkipBackward', () => {
      skipBackward();
    });

    return () => {
      playSubscription.remove();
      pauseSubscription.remove();
      stopSubscription.remove();
      skipForwardSubscription.remove();
      skipBackwardSubscription.remove();
    };
  }, [currentEpisode, isPlaying]);

  // ============================================================
  // Sleep Timer
  // ============================================================

  const setSleepTimer = useCallback((minutes: number | null) => {
    // Clear existing timer
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }

    setSleepTimerMinutesState(minutes);

    if (minutes !== null && minutes > 0) {
      sleepTimerRef.current = setTimeout(async () => {
        console.debug('[PodcastContext] Sleep timer triggered');
        await TrackPlayer.pause();
        setSleepTimerMinutesState(null);
        AccessibilityInfo.announceForAccessibility(t('modules.podcast.sleepTimerEnded'));
      }, minutes * 60 * 1000);

      AccessibilityInfo.announceForAccessibility(
        t('modules.podcast.sleepTimerSet', { minutes })
      );
    }
  }, [t]);

  // ============================================================
  // Episode Progress
  // ============================================================

  const getEpisodeProgress = useCallback((episodeId: string): EpisodeProgress | null => {
    return episodeProgress[episodeId] || null;
  }, [episodeProgress]);

  const isEpisodeCompleted = useCallback((episodeId: string): boolean => {
    const progress = episodeProgress[episodeId];
    return progress?.completedAt !== undefined;
  }, [episodeProgress]);

  // ============================================================
  // Playback Controls
  // ============================================================

  const playEpisode = useCallback(
    async (episode: PodcastEpisode, show: PodcastShow) => {
      if (!isInitialized) {
        console.warn('[PodcastContext] TrackPlayer not initialized');
        return;
      }

      try {
        setIsLoading(true);
        setCurrentEpisode(episode);
        setCurrentShow(show);

        // Stop any current playback
        await TrackPlayer.reset();

        // Get resume position if available
        const savedProgress = episodeProgress[episode.id];
        const startPosition = savedProgress?.position && !savedProgress.completedAt
          ? savedProgress.position
          : 0;

        // Log the stream URL for debugging
        console.debug('[PodcastContext] Stream URL:', episode.streamUrl);

        // Add the new track
        await TrackPlayer.add({
          id: episode.id,
          url: episode.streamUrl,
          title: episode.title,
          artist: show.title,
          artwork: episode.artwork || show.artwork || undefined,
          duration: episode.duration,
        });

        // Seek to resume position if needed
        if (startPosition > 0) {
          await TrackPlayer.seekTo(startPosition);
          AccessibilityInfo.announceForAccessibility(
            t('modules.podcast.resumeFrom', { time: formatTime(startPosition) })
          );
        }

        // Start playback
        await TrackPlayer.play();

        console.debug('[PodcastContext] Playing episode:', episode.title);

        // Announce for accessibility
        AccessibilityInfo.announceForAccessibility(
          t('modules.podcast.nowPlaying', { episode: episode.title })
        );
      } catch (error) {
        console.error('[PodcastContext] Failed to play episode:', error);
        setIsLoading(false);
        DeviceEventEmitter.emit('podcastPlaybackError', error);
      }
    },
    [isInitialized, episodeProgress, t]
  );

  const play = useCallback(async () => {
    if (!isInitialized || !currentEpisode) return;

    try {
      await TrackPlayer.play();
      AccessibilityInfo.announceForAccessibility(t('modules.podcast.resumed'));
    } catch (error) {
      console.error('[PodcastContext] Failed to play:', error);
    }
  }, [isInitialized, currentEpisode, t]);

  const pause = useCallback(async () => {
    if (!isInitialized) return;

    try {
      await TrackPlayer.pause();
      AccessibilityInfo.announceForAccessibility(t('modules.podcast.paused'));

      // Save progress immediately on pause
      if (currentEpisode && trackProgress.position > 0) {
        const newProgress: EpisodeProgress = {
          position: trackProgress.position,
          duration: trackProgress.duration || currentEpisode.duration,
          lastPlayedAt: Date.now(),
        };
        setEpisodeProgress(prev => {
          const updated = { ...prev, [currentEpisode.id]: newProgress };
          AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(updated));
          return updated;
        });
      }
    } catch (error) {
      console.error('[PodcastContext] Failed to pause:', error);
    }
  }, [isInitialized, currentEpisode, trackProgress, t]);

  const stop = useCallback(async () => {
    if (!isInitialized) return;

    try {
      // Save progress before stopping
      if (currentEpisode && trackProgress.position > 0) {
        const newProgress: EpisodeProgress = {
          position: trackProgress.position,
          duration: trackProgress.duration || currentEpisode.duration,
          lastPlayedAt: Date.now(),
        };
        setEpisodeProgress(prev => {
          const updated = { ...prev, [currentEpisode.id]: newProgress };
          AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(updated));
          return updated;
        });
      }

      await TrackPlayer.stop();
      await TrackPlayer.reset();
      setCurrentEpisode(null);
      setCurrentShow(null);
      setSleepTimer(null);
      AccessibilityInfo.announceForAccessibility(t('modules.podcast.stopped'));
    } catch (error) {
      console.error('[PodcastContext] Failed to stop:', error);
    }
  }, [isInitialized, currentEpisode, trackProgress, t, setSleepTimer]);

  const seekTo = useCallback(async (position: number) => {
    if (!isInitialized) return;

    try {
      await TrackPlayer.seekTo(position);
    } catch (error) {
      console.error('[PodcastContext] Failed to seek:', error);
    }
  }, [isInitialized]);

  const skipForward = useCallback(async (seconds: number = DEFAULT_SKIP_FORWARD) => {
    if (!isInitialized) return;

    try {
      const newPosition = Math.min(
        trackProgress.position + seconds,
        trackProgress.duration
      );
      await TrackPlayer.seekTo(newPosition);
      AccessibilityInfo.announceForAccessibility(
        t('modules.podcast.skippedForward', { seconds })
      );
    } catch (error) {
      console.error('[PodcastContext] Failed to skip forward:', error);
    }
  }, [isInitialized, trackProgress, t]);

  const skipBackward = useCallback(async (seconds: number = DEFAULT_SKIP_BACKWARD) => {
    if (!isInitialized) return;

    try {
      const newPosition = Math.max(trackProgress.position - seconds, 0);
      await TrackPlayer.seekTo(newPosition);
      AccessibilityInfo.announceForAccessibility(
        t('modules.podcast.skippedBackward', { seconds })
      );
    } catch (error) {
      console.error('[PodcastContext] Failed to skip backward:', error);
    }
  }, [isInitialized, trackProgress, t]);

  const setPlaybackRate = useCallback(async (rate: number) => {
    if (!isInitialized) return;

    try {
      await TrackPlayer.setRate(rate);
      setPlaybackRateState(rate);
      AccessibilityInfo.announceForAccessibility(
        t('modules.podcast.playbackRateChanged', { rate: `${rate}x` })
      );
    } catch (error) {
      console.error('[PodcastContext] Failed to set playback rate:', error);
    }
  }, [isInitialized, t]);

  // ============================================================
  // Next Episode
  // ============================================================

  const getNextEpisode = useCallback((): PodcastEpisode | null => {
    if (!currentEpisode || currentShowEpisodes.length <= 1) {
      return null;
    }

    const currentIndex = currentShowEpisodes.findIndex(ep => ep.id === currentEpisode.id);
    // Episodes are sorted newest first, so "next" is the older episode (index + 1)
    if (currentIndex >= 0 && currentIndex < currentShowEpisodes.length - 1) {
      return currentShowEpisodes[currentIndex + 1];
    }
    return null;
  }, [currentEpisode, currentShowEpisodes]);

  const playNextEpisode = useCallback(async () => {
    const nextEpisode = getNextEpisode();
    if (nextEpisode && currentShow) {
      console.debug('[PodcastContext] Playing next episode:', nextEpisode.title);
      await playEpisode(nextEpisode, currentShow);
    }
  }, [getNextEpisode, currentShow, playEpisode]);

  // ============================================================
  // Subscriptions
  // ============================================================

  const subscribe = useCallback(async (show: PodcastShow) => {
    const newShow: PodcastShow = {
      ...show,
      subscribedAt: Date.now(),
    };

    setSubscriptions(prev => {
      // Check if already subscribed
      if (prev.some(s => s.id === show.id)) {
        return prev;
      }
      const updated = [...prev, newShow];
      AsyncStorage.setItem(STORAGE_KEYS.subscriptions, JSON.stringify(updated));
      return updated;
    });

    AccessibilityInfo.announceForAccessibility(
      t('modules.podcast.subscribed', { show: show.title })
    );
  }, [t]);

  const unsubscribe = useCallback(async (showId: string) => {
    setSubscriptions(prev => {
      const show = prev.find(s => s.id === showId);
      const updated = prev.filter(s => s.id !== showId);
      AsyncStorage.setItem(STORAGE_KEYS.subscriptions, JSON.stringify(updated));

      if (show) {
        AccessibilityInfo.announceForAccessibility(
          t('modules.podcast.unsubscribed', { show: show.title })
        );
      }

      return updated;
    });
  }, [t]);

  const isSubscribed = useCallback((showId: string): boolean => {
    return subscriptions.some(s => s.id === showId);
  }, [subscriptions]);

  // ============================================================
  // Context Value
  // ============================================================

  const value = useMemo(
    (): PodcastContextValue => ({
      isPlaying,
      isLoading,
      isBuffering,
      currentEpisode,
      currentShow,
      progress: {
        position: trackProgress.position,
        duration: trackProgress.duration,
        buffered: trackProgress.buffered,
      },
      playbackRate,
      currentShowEpisodes,
      setCurrentShowEpisodes,
      subscriptions,
      getEpisodeProgress,
      isEpisodeCompleted,
      playEpisode,
      play,
      pause,
      stop,
      seekTo,
      skipForward,
      skipBackward,
      setPlaybackRate,
      getNextEpisode,
      playNextEpisode,
      subscribe,
      unsubscribe,
      isSubscribed,
      sleepTimerMinutes,
      setSleepTimer,
    }),
    [
      isPlaying,
      isLoading,
      isBuffering,
      currentEpisode,
      currentShow,
      trackProgress.position,
      trackProgress.duration,
      trackProgress.buffered,
      playbackRate,
      currentShowEpisodes,
      subscriptions,
      getEpisodeProgress,
      isEpisodeCompleted,
      playEpisode,
      play,
      pause,
      stop,
      seekTo,
      skipForward,
      skipBackward,
      setPlaybackRate,
      getNextEpisode,
      playNextEpisode,
      subscribe,
      unsubscribe,
      isSubscribed,
      sleepTimerMinutes,
      setSleepTimer,
    ]
  );

  return (
    <PodcastContext.Provider value={value}>
      {children}
    </PodcastContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Hook to access podcast context
 * Must be used within a PodcastProvider
 */
export function usePodcastContext(): PodcastContextValue {
  const context = useContext(PodcastContext);
  if (!context) {
    throw new Error('usePodcastContext must be used within a PodcastProvider');
  }
  return context;
}

/**
 * Safe hook to access podcast context
 * Returns null if not within a PodcastProvider (useful for components that may render before provider is ready)
 */
export function usePodcastContextSafe(): PodcastContextValue | null {
  return useContext(PodcastContext);
}

/**
 * Hook for basic podcast state (lightweight)
 */
export function usePodcastState(): {
  isPlaying: boolean;
  currentEpisode: PodcastEpisode | null;
  currentShow: PodcastShow | null;
  progress: { position: number; duration: number };
} {
  const { isPlaying, currentEpisode, currentShow, progress } = usePodcastContext();
  return { isPlaying, currentEpisode, currentShow, progress };
}

/**
 * Hook for podcast controls
 */
export function usePodcastControls(): {
  playEpisode: (episode: PodcastEpisode, show: PodcastShow) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  skipForward: (seconds?: number) => Promise<void>;
  skipBackward: (seconds?: number) => Promise<void>;
} {
  const { playEpisode, play, pause, stop, seekTo, skipForward, skipBackward } = usePodcastContext();
  return { playEpisode, play, pause, stop, seekTo, skipForward, skipBackward };
}
