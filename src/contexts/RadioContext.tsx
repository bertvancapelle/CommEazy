/**
 * RadioContext — Global radio player state management
 *
 * Provides app-wide access to radio playback state:
 * - Current station and playback status
 * - Stream metadata (ICY: artist, title, artwork)
 * - Playback controls (play, pause, stop)
 * - Player overlay visibility
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

import { fetchArtwork } from '@/services/artworkService';
import { useAudioOrchestrator } from './AudioOrchestratorContext';

// ============================================================
// Types
// ============================================================

export interface RadioStation {
  id: string;
  name: string;
  streamUrl: string;
  country: string;
  countryCode: string;
  favicon?: string;
}

export interface StreamMetadata {
  title?: string;      // Current song/show title
  artist?: string;     // Artist name
  album?: string;      // Album name (rare for radio)
  artwork?: string;    // Album/station artwork URL
}

export interface RadioContextValue {
  // Playback state
  isPlaying: boolean;
  isLoading: boolean;
  isBuffering: boolean;
  currentStation: RadioStation | null;
  metadata: StreamMetadata;

  // Player visibility
  showPlayer: boolean;
  setShowPlayer: (show: boolean) => void;

  // Sleep timer state (for MediaIndicator)
  sleepTimerActive: boolean;
  setSleepTimerActive: (active: boolean) => void;

  // Playback controls
  playStation: (station: RadioStation) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;

  // Progress (for buffering indicator)
  buffered: number;
  position: number;
}

// ============================================================
// Constants
// ============================================================

// Track Player is initialized once at app startup
let isTrackPlayerInitialized = false;

// ============================================================
// Context
// ============================================================

const RadioContext = createContext<RadioContextValue | null>(null);

interface RadioProviderProps {
  children: ReactNode;
}

/**
 * Initialize Track Player with radio-specific capabilities
 */
async function setupTrackPlayer(): Promise<boolean> {
  if (isTrackPlayerInitialized) {
    return true;
  }

  try {
    // Try to setup player - it may already be initialized by PodcastContext
    try {
      await TrackPlayer.setupPlayer({
        // Allow continuous playback
        waitForBuffer: true,
      });
      console.log('[RadioContext] TrackPlayer initialized successfully');
    } catch (setupError) {
      // If already initialized, that's fine - just continue
      if (setupError instanceof Error && setupError.message.includes('already been initialized')) {
        console.log('[RadioContext] TrackPlayer was already initialized');
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
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.Stop,
      ],
      // Show on lock screen
      notificationCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.Stop,
      ],
    });

    isTrackPlayerInitialized = true;
    return true;
  } catch (error) {
    console.error('[RadioContext] Failed to initialize TrackPlayer:', error);
    return false;
  }
}

/**
 * Provider component for radio context
 */
export function RadioProvider({ children }: RadioProviderProps) {
  const { t } = useTranslation();
  const playbackState = usePlaybackState();
  const progress = useProgress();
  const audioOrchestrator = useAudioOrchestrator();

  // State
  const [currentStation, setCurrentStation] = useState<RadioStation | null>(null);
  const [metadata, setMetadata] = useState<StreamMetadata>({});
  const [showPlayer, setShowPlayer] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [sleepTimerActive, setSleepTimerActive] = useState(false);

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
    };
    init();

    // Cleanup on unmount
    return () => {
      // Don't destroy player on unmount - keep playing in background
    };
  }, []);

  // ============================================================
  // Event Listeners
  // ============================================================

  useEffect(() => {
    if (!isInitialized) return;

    // Listen for metadata changes (ICY metadata from stream)
    const metadataListener = TrackPlayer.addEventListener(
      Event.PlaybackMetadataReceived,
      async (data) => {
        console.log('[RadioContext] Metadata received:', data);

        // Parse ICY metadata (usually in format "Artist - Title")
        const title = data.title || '';
        const artist = data.artist || '';

        // If title contains " - ", it's likely "Artist - Title" format
        let parsedArtist = artist;
        let parsedTitle = title;

        if (!artist && title.includes(' - ')) {
          const parts = title.split(' - ');
          parsedArtist = parts[0]?.trim() || '';
          parsedTitle = parts.slice(1).join(' - ').trim() || title;
        }

        setMetadata(prev => ({
          ...prev,
          title: parsedTitle || prev.title,
          artist: parsedArtist || prev.artist,
        }));

        // Fetch album artwork for the current song
        if (parsedArtist && parsedTitle) {
          fetchArtwork(parsedArtist, parsedTitle).then(result => {
            if (result.url) {
              console.log('[RadioContext] Artwork found from:', result.source);
              setMetadata(prev => ({
                ...prev,
                artwork: result.url!,
              }));
              // Update track artwork for lock screen
              TrackPlayer.updateNowPlayingMetadata({
                artwork: result.url!,
              });
            }
          }).catch(err => {
            console.log('[RadioContext] Artwork fetch failed:', err);
          });
        }

        // Announce new song for accessibility
        if (parsedTitle && parsedTitle !== metadata.title) {
          const announcement = parsedArtist
            ? `${parsedArtist} - ${parsedTitle}`
            : parsedTitle;
          AccessibilityInfo.announceForAccessibility(
            t('modules.radio.nowPlayingAnnouncement', { song: announcement })
          );
        }
      }
    );

    // Listen for playback errors
    const errorListener = TrackPlayer.addEventListener(
      Event.PlaybackError,
      (error) => {
        console.error('[RadioContext] Playback error:', error);
        setIsLoading(false);

        // Emit error event for UI to handle
        DeviceEventEmitter.emit('radioPlaybackError', error);
      }
    );

    // Listen for playback state changes (only when radio is the active source)
    const stateListener = TrackPlayer.addEventListener(
      Event.PlaybackState,
      (data) => {
        if (audioOrchestrator.activeSource !== 'radio') return;

        if (data.state === State.Playing) {
          setIsLoading(false);
        } else if (data.state === State.Error) {
          setIsLoading(false);
        }
      }
    );

    return () => {
      metadataListener.remove();
      errorListener.remove();
      stateListener.remove();
    };
    // Note: metadata.title removed from dependencies to prevent re-registration on every metadata update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, t]);

  // ============================================================
  // Voice Command Listeners
  // ============================================================

  useEffect(() => {
    const playSubscription = DeviceEventEmitter.addListener('voiceCommand:radioPlay', () => {
      if (currentStation && !isPlaying) {
        play();
      }
    });

    const pauseSubscription = DeviceEventEmitter.addListener('voiceCommand:radioPause', () => {
      if (isPlaying) {
        pause();
      }
    });

    const stopSubscription = DeviceEventEmitter.addListener('voiceCommand:radioStop', () => {
      stop();
    });

    return () => {
      playSubscription.remove();
      pauseSubscription.remove();
      stopSubscription.remove();
    };
  }, [currentStation, isPlaying]);

  // ============================================================
  // Playback Controls
  // ============================================================

  const playStation = useCallback(
    async (station: RadioStation) => {
      if (!isInitialized) {
        console.warn('[RadioContext] TrackPlayer not initialized');
        return;
      }

      try {
        // Request playback from orchestrator (stops other audio sources)
        await audioOrchestrator.requestPlayback('radio');

        setIsLoading(true);
        setCurrentStation(station);
        setMetadata({}); // Clear previous metadata
        setShowPlayer(true);

        // Stop any current playback
        await TrackPlayer.reset();

        // Add the new track
        await TrackPlayer.add({
          id: station.id,
          url: station.streamUrl,
          title: station.name,
          artist: station.country,
          artwork: station.favicon || undefined,
          isLiveStream: true,
        });

        // Start playback
        await TrackPlayer.play();

        console.log('[RadioContext] Playing station:', station.name);

        // Announce for accessibility
        AccessibilityInfo.announceForAccessibility(
          t('modules.radio.nowPlaying', { station: station.name })
        );
      } catch (error) {
        console.error('[RadioContext] Failed to play station:', error);
        setIsLoading(false);
        DeviceEventEmitter.emit('radioPlaybackError', error);
      }
    },
    [isInitialized, audioOrchestrator, t]
  );

  const play = useCallback(async () => {
    if (!isInitialized || !currentStation) return;

    try {
      // Request playback from orchestrator (stops other audio sources)
      await audioOrchestrator.requestPlayback('radio');

      await TrackPlayer.play();
      AccessibilityInfo.announceForAccessibility(t('modules.radio.resumed'));
    } catch (error) {
      console.error('[RadioContext] Failed to play:', error);
    }
  }, [isInitialized, currentStation, audioOrchestrator, t]);

  const pause = useCallback(async () => {
    if (!isInitialized) return;

    try {
      await TrackPlayer.pause();
      AccessibilityInfo.announceForAccessibility(t('modules.radio.paused'));
    } catch (error) {
      console.error('[RadioContext] Failed to pause:', error);
    }
  }, [isInitialized, t]);

  const stop = useCallback(async () => {
    if (!isInitialized) return;

    try {
      await TrackPlayer.stop();
      await TrackPlayer.reset();
      setCurrentStation(null);
      setMetadata({});
      setShowPlayer(false);
      audioOrchestrator.releasePlayback('radio');
      AccessibilityInfo.announceForAccessibility(t('modules.radio.stopped'));
    } catch (error) {
      console.error('[RadioContext] Failed to stop:', error);
    }
  }, [isInitialized, audioOrchestrator, t]);

  // ============================================================
  // Audio Orchestrator Registration
  // ============================================================

  // Use refs to provide stable callbacks for orchestrator (prevents re-registration cycles)
  const stopRef = useRef(stop);
  stopRef.current = stop;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    // Register radio as an audio source with the orchestrator
    audioOrchestrator.registerSource('radio', {
      stop: async () => {
        await stopRef.current();
      },
      isPlaying: () => isPlayingRef.current,
    });

    return () => {
      audioOrchestrator.unregisterSource('radio');
    };
  }, [audioOrchestrator]);

  // ============================================================
  // Context Value
  // ============================================================

  const value = useMemo(
    (): RadioContextValue => ({
      isPlaying,
      isLoading,
      isBuffering,
      currentStation,
      metadata,
      showPlayer,
      setShowPlayer,
      sleepTimerActive,
      setSleepTimerActive,
      playStation,
      play,
      pause,
      stop,
      buffered: progress.buffered,
      position: progress.position,
    }),
    [
      isPlaying,
      isLoading,
      isBuffering,
      currentStation,
      metadata,
      showPlayer,
      sleepTimerActive,
      playStation,
      play,
      pause,
      stop,
      progress.buffered,
      progress.position,
    ]
  );

  return (
    <RadioContext.Provider value={value}>
      {children}
    </RadioContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Hook to access radio context
 * Must be used within a RadioProvider
 */
export function useRadioContext(): RadioContextValue {
  const context = useContext(RadioContext);
  if (!context) {
    throw new Error('useRadioContext must be used within a RadioProvider');
  }
  return context;
}

/**
 * Hook for basic radio state (lightweight)
 */
export function useRadioState(): {
  isPlaying: boolean;
  currentStation: RadioStation | null;
  metadata: StreamMetadata;
} {
  const { isPlaying, currentStation, metadata } = useRadioContext();
  return { isPlaying, currentStation, metadata };
}

/**
 * Hook for radio controls
 */
export function useRadioControls(): {
  playStation: (station: RadioStation) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const { playStation, play, pause, stop } = useRadioContext();
  return { playStation, play, pause, stop };
}
