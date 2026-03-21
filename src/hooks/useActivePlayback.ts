/**
 * useActivePlayback — Aggregates all audio contexts into a single active playback state
 *
 * Used by HomeScreen to show a UnifiedMiniPlayer for whatever audio is currently playing.
 *
 * Reads state from AudioOrchestrator's activeState (Single Source of Truth).
 * Callbacks (onPlayPause / onStop) come from individual contexts since the
 * orchestrator is a state container, not a control surface.
 *
 * Returns null when no audio is active.
 */

import { useMemo } from 'react';

import { useAudioOrchestratorOptional } from '@/contexts/AudioOrchestratorContext';
import { useRadioContextSafe } from '@/contexts/RadioContext';
import { usePodcastContextSafe } from '@/contexts/PodcastContext';
import { useBooksContextSafe } from '@/contexts/BooksContext';
import { useAppleMusicContextSafe } from '@/contexts/AppleMusicContext';
import type { ModuleColorId } from '@/types/liquidGlass';

// ── Types ──────────────────────────────────────────────────────

export interface ActivePlaybackInfo {
  /** Module identifier for colors and navigation */
  moduleId: ModuleColorId;
  /** Artwork URL (album art, station logo, etc.) */
  artwork: string | null;
  /** Primary text: track/episode/station name */
  title: string;
  /** Secondary text: artist/show/author */
  subtitle?: string;

  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Whether audio is loading/buffering */
  isLoading: boolean;

  /** Progress display variant */
  progressType: 'bar' | 'duration';
  /** 0-1 progress value (for 'bar' type) */
  progress?: number;
  /** Seconds of listen time (for 'duration' type — radio) */
  listenDuration?: number;

  /** Play/pause toggle callback */
  onPlayPause: () => void;
  /** Stop and clear callback */
  onStop: () => void;

  /** ID of the currently playing item (for scroll-to-active) */
  scrollToId?: string;
  /** ID of the collection containing the active item */
  collectionId?: string;
}

// ── Callbacks from individual contexts ─────────────────────────
// The orchestrator provides state but NOT playback controls.
// onPlayPause/onStop must come from individual contexts.

interface SourceCallbacks {
  onPlayPause: () => void;
  onStop: () => void;
}

/**
 * Build callbacks for the given source from individual context values.
 * Returns null if the context is not available.
 * NOTE: Not a hook — called inside useMemo. Named without 'use' prefix intentionally.
 */
function getSourceCallbacks(
  source: string | null,
  radioCtx: ReturnType<typeof useRadioContextSafe>,
  podcastCtx: ReturnType<typeof usePodcastContextSafe>,
  booksCtx: ReturnType<typeof useBooksContextSafe>,
  appleMusicCtx: ReturnType<typeof useAppleMusicContextSafe>,
): SourceCallbacks | null {
  if (!source) return null;

  switch (source) {
    case 'radio':
      if (!radioCtx) return null;
      return {
        onPlayPause: () => {
          if (radioCtx.isPlaying) { radioCtx.pause(); }
          else { radioCtx.play(); }
        },
        onStop: () => { radioCtx.stop(); },
      };

    case 'podcast':
      if (!podcastCtx) return null;
      return {
        onPlayPause: () => {
          if (podcastCtx.isPlaying) { podcastCtx.pause(); }
          else { podcastCtx.play(); }
        },
        onStop: () => { podcastCtx.stop(); },
      };

    case 'books':
      if (!booksCtx) return null;
      return {
        onPlayPause: () => {
          const isListenMode = booksCtx.bookMode === 'listen';
          if (isListenMode) {
            if (booksCtx.isAudioPlaying) { booksCtx.pauseAudio(); }
            else { booksCtx.playAudio(); }
          } else {
            if (booksCtx.isSpeaking) { booksCtx.pauseReading(); }
            else { booksCtx.resumeReading(); }
          }
        },
        onStop: () => {
          const isListenMode = booksCtx.bookMode === 'listen';
          if (isListenMode) { booksCtx.stopAudio(); }
          else { booksCtx.stopReading(); }
        },
      };

    case 'appleMusic':
      if (!appleMusicCtx) return null;
      return {
        onPlayPause: () => { appleMusicCtx.togglePlayback(); },
        onStop: () => { appleMusicCtx.stop(); },
      };

    default:
      return null;
  }
}

// ── Hook ───────────────────────────────────────────────────────

export function useActivePlayback(): ActivePlaybackInfo | null {
  // PRIMARY: AudioOrchestrator (Single Source of Truth)
  const orchestrator = useAudioOrchestratorOptional();
  const activeSource = orchestrator?.activeSource ?? null;
  const activeState = orchestrator?.activeState ?? null;

  // Individual contexts for callbacks only (orchestrator doesn't expose controls)
  const radioCtx = useRadioContextSafe();
  const podcastCtx = usePodcastContextSafe();
  const booksCtx = useBooksContextSafe();
  const appleMusicCtx = useAppleMusicContextSafe();

  return useMemo((): ActivePlaybackInfo | null => {
    // Nothing playing
    if (!activeSource || !activeState) return null;

    // Build callbacks from the individual context
    const callbacks = getSourceCallbacks(
      activeSource, radioCtx, podcastCtx, booksCtx, appleMusicCtx,
    );
    // TTS sources don't have context callbacks — they're self-contained hooks.
    // If no callbacks, we can't provide play/pause/stop for the HomeScreen player.
    if (!callbacks) return null;

    return {
      moduleId: activeState.moduleId,
      artwork: activeState.artwork,
      title: activeState.title,
      subtitle: activeState.subtitle,
      isPlaying: activeState.isPlaying,
      isLoading: activeState.isBuffering,
      progressType: activeState.progressType,
      progress: activeState.progressType === 'bar' ? activeState.progress : undefined,
      listenDuration: activeState.progressType === 'duration' ? activeState.listenDuration : undefined,
      onPlayPause: callbacks.onPlayPause,
      onStop: callbacks.onStop,
    };
  }, [
    activeSource,
    activeState,
    // Context deps for callbacks (stable refs, but included for correctness)
    radioCtx,
    podcastCtx,
    booksCtx,
    appleMusicCtx,
  ]);
}
