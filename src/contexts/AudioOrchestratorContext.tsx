/**
 * AudioOrchestratorContext — Central audio management for CommEazy
 *
 * This context ensures that only ONE audio source plays at a time.
 * When a new audio source starts playing, all other sources are automatically stopped.
 *
 * Supported audio sources:
 * - radio: Live radio streams (TrackPlayer)
 * - podcast: Podcast episodes (TrackPlayer)
 * - books: TTS read-aloud (Piper TTS)
 * - appleMusic: Apple Music (native MusicKit)
 *
 * Usage:
 * 1. Each audio context registers its stop handler via registerSource()
 * 2. Before playing, call requestPlayback(source) which stops all other sources
 * 3. When stopping, call releasePlayback(source)
 *
 * @see .claude/CLAUDE.md section on Audio Management
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

// ============================================================
// Types
// ============================================================

export type AudioSource = 'radio' | 'podcast' | 'books' | 'appleMusic' | 'call';

interface AudioSourceHandler {
  stop: () => Promise<void>;
  isPlaying: () => boolean;
}

interface AudioOrchestratorContextValue {
  /** Currently active audio source (null if nothing playing) */
  activeSource: AudioSource | null;

  /** Whether any audio is currently playing */
  isAnyPlaying: boolean;

  /**
   * Register an audio source with its control handlers.
   * Call this once when the context mounts.
   */
  registerSource: (source: AudioSource, handlers: AudioSourceHandler) => void;

  /**
   * Unregister an audio source (e.g., when context unmounts).
   */
  unregisterSource: (source: AudioSource) => void;

  /**
   * Request to start playback for a source.
   * This will automatically stop all other sources first.
   * Returns true if playback can proceed, false if blocked.
   */
  requestPlayback: (source: AudioSource) => Promise<boolean>;

  /**
   * Release playback (call when stopping).
   * This clears the active source if it matches.
   */
  releasePlayback: (source: AudioSource) => void;

  /**
   * Stop all audio sources immediately.
   */
  stopAll: () => Promise<void>;
}

// ============================================================
// Context
// ============================================================

const AudioOrchestratorContext = createContext<AudioOrchestratorContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface AudioOrchestratorProviderProps {
  children: React.ReactNode;
}

export function AudioOrchestratorProvider({ children }: AudioOrchestratorProviderProps) {
  const [activeSource, setActiveSource] = useState<AudioSource | null>(null);
  const handlersRef = useRef<Map<AudioSource, AudioSourceHandler>>(new Map());

  // Register a source's handlers
  const registerSource = useCallback((source: AudioSource, handlers: AudioSourceHandler) => {
    console.log(`[AudioOrchestrator] Registering source: ${source}`);
    handlersRef.current.set(source, handlers);
  }, []);

  // Unregister a source
  const unregisterSource = useCallback((source: AudioSource) => {
    console.log(`[AudioOrchestrator] Unregistering source: ${source}`);
    handlersRef.current.delete(source);
  }, []);

  // Stop all sources except the specified one
  const stopOtherSources = useCallback(async (exceptSource: AudioSource) => {
    const stopPromises: Promise<void>[] = [];

    for (const [source, handlers] of handlersRef.current.entries()) {
      if (source !== exceptSource) {
        try {
          if (handlers.isPlaying()) {
            console.log(`[AudioOrchestrator] Stopping ${source} (${exceptSource} is starting)`);
            stopPromises.push(handlers.stop());
          }
        } catch (error) {
          console.warn(`[AudioOrchestrator] Error checking/stopping ${source}:`, error);
        }
      }
    }

    if (stopPromises.length > 0) {
      await Promise.allSettled(stopPromises);
    }
  }, []);

  // Request playback for a source
  const requestPlayback = useCallback(async (source: AudioSource): Promise<boolean> => {
    console.log(`[AudioOrchestrator] Playback requested by: ${source}`);

    // Stop all other sources first
    await stopOtherSources(source);

    // Set as active source
    setActiveSource(source);
    console.log(`[AudioOrchestrator] Active source set to: ${source}`);

    return true;
  }, [stopOtherSources]);

  // Release playback
  const releasePlayback = useCallback((source: AudioSource) => {
    console.log(`[AudioOrchestrator] Playback released by: ${source}`);
    setActiveSource(current => (current === source ? null : current));
  }, []);

  // Stop all sources
  const stopAll = useCallback(async () => {
    console.log('[AudioOrchestrator] Stopping all audio sources');
    const stopPromises: Promise<void>[] = [];

    for (const [source, handlers] of handlersRef.current.entries()) {
      try {
        if (handlers.isPlaying()) {
          console.log(`[AudioOrchestrator] Stopping ${source}`);
          stopPromises.push(handlers.stop());
        }
      } catch (error) {
        console.warn(`[AudioOrchestrator] Error stopping ${source}:`, error);
      }
    }

    await Promise.allSettled(stopPromises);
    setActiveSource(null);
  }, []);

  // Check if any source is playing
  const isAnyPlaying = useMemo(() => {
    return activeSource !== null;
  }, [activeSource]);

  const value = useMemo<AudioOrchestratorContextValue>(
    () => ({
      activeSource,
      isAnyPlaying,
      registerSource,
      unregisterSource,
      requestPlayback,
      releasePlayback,
      stopAll,
    }),
    [
      activeSource,
      isAnyPlaying,
      registerSource,
      unregisterSource,
      requestPlayback,
      releasePlayback,
      stopAll,
    ]
  );

  return (
    <AudioOrchestratorContext.Provider value={value}>
      {children}
    </AudioOrchestratorContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

/**
 * Hook to access the audio orchestrator.
 * Use this in audio contexts to coordinate playback.
 */
export function useAudioOrchestrator(): AudioOrchestratorContextValue {
  const context = useContext(AudioOrchestratorContext);
  if (!context) {
    throw new Error('useAudioOrchestrator must be used within AudioOrchestratorProvider');
  }
  return context;
}

/**
 * Optional hook that returns null if not within provider.
 * Use this for components that may or may not be in audio context.
 */
export function useAudioOrchestratorOptional(): AudioOrchestratorContextValue | null {
  return useContext(AudioOrchestratorContext);
}

export default AudioOrchestratorContext;
