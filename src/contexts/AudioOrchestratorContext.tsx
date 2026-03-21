/**
 * AudioOrchestratorContext — Central audio management for CommEazy
 *
 * Single Source of Truth for all audio playback state. Ensures only ONE
 * audio source plays at a time and provides unified state for consumers
 * like MediaIndicator and useActivePlayback.
 *
 * Push + Pull hybrid pattern:
 * - Push (primary): Contexts call updateState() on every state change
 * - Pull (fallback): Orchestrator calls handler.getState() as safety net
 *
 * Supported audio sources:
 * - radio: Live radio streams (TrackPlayer)
 * - podcast: Podcast episodes (TrackPlayer)
 * - books: TTS read-aloud (Piper TTS)
 * - appleMusic: Apple Music (native MusicKit)
 * - tts:article / tts:mail / tts:weather: Standalone TTS
 * - call: Voice/video calls
 *
 * Usage:
 * 1. Each audio context registers via registerSource() with stop, isPlaying, getState
 * 2. Before playing, call requestPlayback(source) which stops all other sources
 * 3. During playback, push state via updateState(source, partial)
 * 4. When pausing, push updateState(source, { isPlaying: false }) — keeps activeSource
 * 5. When stopping, call releasePlayback(source) — clears activeSource + activeState
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

import type { ModuleColorId } from '@/types/liquidGlass';

// ============================================================
// Types
// ============================================================

export type AudioSource =
  | 'radio'
  | 'podcast'
  | 'books'
  | 'appleMusic'
  | 'call'
  | 'tts:article'
  | 'tts:mail'
  | 'tts:weather';

/**
 * Unified playback state pushed by each audio context.
 * MediaIndicator and useActivePlayback read ONLY this.
 */
export interface AudioSourceState {
  isPlaying: boolean;
  isBuffering: boolean;
  title: string;
  subtitle: string;
  artwork: string | null;
  /** 'bar' for seekable content, 'duration' for live streams */
  progressType: 'bar' | 'duration';
  /** 0-1 progress fraction (for 'bar' type) */
  progress: number;
  /** Listen duration in seconds (for 'duration' type, e.g. radio) */
  listenDuration: number;
  /** Current position in seconds */
  position: number;
  /** Total duration in seconds */
  duration: number;
  isFavorite: boolean;
  sleepTimerActive: boolean;
  playbackRate: number;
  moduleId: ModuleColorId;
}

export interface AudioSourceHandler {
  stop: () => Promise<void>;
  isPlaying: () => boolean;
  /** Pull fallback: returns current state for safety net.
   *  Optional during migration — will become required when all contexts are migrated. */
  getState?: () => AudioSourceState;
}

interface AudioOrchestratorContextValue {
  /** Currently active audio source (null if nothing playing) */
  activeSource: AudioSource | null;

  /** Unified state from the active source (null if nothing active) */
  activeState: AudioSourceState | null;

  /** Whether any audio is currently playing */
  isAnyPlaying: boolean;

  /**
   * Register an audio source with its control handlers.
   * Call this once when the context mounts (use ref pattern for stability).
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
   * This clears activeSource AND activeState.
   */
  releasePlayback: (source: AudioSource) => void;

  /**
   * Push state update from the active source.
   * Only accepted if source matches activeSource (prevents stale updates).
   */
  updateState: (source: AudioSource, partial: Partial<AudioSourceState>) => void;

  /**
   * Pull the active state (with fallback to handler.getState()).
   * Primarily for consumers that need a one-time read.
   */
  getActiveState: () => AudioSourceState | null;

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
  const [activeState, setActiveState] = useState<AudioSourceState | null>(null);
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
    // If the unregistered source was active, clear state
    setActiveSource(current => {
      if (current === source) {
        setActiveState(null);
        return null;
      }
      return current;
    });
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

    // Set as active source (activeState will be populated by updateState push)
    setActiveSource(source);
    console.log(`[AudioOrchestrator] Active source set to: ${source}`);

    return true;
  }, [stopOtherSources]);

  // Release playback — clears both activeSource AND activeState
  const releasePlayback = useCallback((source: AudioSource) => {
    console.log(`[AudioOrchestrator] Playback released by: ${source}`);
    setActiveSource(current => {
      if (current === source) {
        setActiveState(null);
        return null;
      }
      return current;
    });
  }, []);

  // Push state update from the active source
  const updateState = useCallback((source: AudioSource, partial: Partial<AudioSourceState>) => {
    setActiveSource(current => {
      if (current !== source) {
        // Ignore stale updates from non-active sources
        return current;
      }
      setActiveState(prev => {
        if (prev === null) {
          // First push — partial must contain all required fields.
          // Fill defaults for missing fields to be safe.
          return {
            isPlaying: false,
            isBuffering: false,
            title: '',
            subtitle: '',
            artwork: null,
            progressType: 'duration',
            progress: 0,
            listenDuration: 0,
            position: 0,
            duration: 0,
            isFavorite: false,
            sleepTimerActive: false,
            playbackRate: 1,
            moduleId: 'radio' as ModuleColorId,
            ...partial,
          };
        }
        return { ...prev, ...partial };
      });
      return current;
    });
  }, []);

  // Pull active state with fallback to handler.getState()
  const getActiveState = useCallback((): AudioSourceState | null => {
    // Primary: return pushed state
    if (activeState) return activeState;

    // Fallback: pull from handler if source is active but no pushed state yet
    if (activeSource) {
      const handler = handlersRef.current.get(activeSource);
      if (handler?.getState) {
        try {
          const pulled = handler.getState();
          // Cache the pulled state
          setActiveState(pulled);
          return pulled;
        } catch (error) {
          console.warn(`[AudioOrchestrator] Pull fallback failed for ${activeSource}:`, error);
        }
      }
    }

    return null;
  }, [activeSource, activeState]);

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
    setActiveState(null);
  }, []);

  // Check if any source is playing
  const isAnyPlaying = useMemo(() => {
    return activeSource !== null;
  }, [activeSource]);

  const value = useMemo<AudioOrchestratorContextValue>(
    () => ({
      activeSource,
      activeState,
      isAnyPlaying,
      registerSource,
      unregisterSource,
      requestPlayback,
      releasePlayback,
      updateState,
      getActiveState,
      stopAll,
    }),
    [
      activeSource,
      activeState,
      isAnyPlaying,
      registerSource,
      unregisterSource,
      requestPlayback,
      releasePlayback,
      updateState,
      getActiveState,
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
