/**
 * useActivePlayback — Aggregates all audio contexts into a single active playback state
 *
 * Used by HomeScreen to show a UnifiedMiniPlayer for whatever audio is currently playing.
 * Reads from RadioContext, PodcastContext, BooksContext, and AppleMusicContext.
 *
 * Priority order (highest first): Apple Music → Radio → Podcast → Books
 *
 * Returns null when no audio is active.
 */

import { useMemo } from 'react';

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

// ── Hook ───────────────────────────────────────────────────────

export function useActivePlayback(): ActivePlaybackInfo | null {
  const radioCtx = useRadioContextSafe();
  const podcastCtx = usePodcastContextSafe();
  const booksCtx = useBooksContextSafe();
  const appleMusicCtx = useAppleMusicContextSafe();

  return useMemo((): ActivePlaybackInfo | null => {
    // Priority: Apple Music > Radio > Podcast > Books

    // ── Apple Music ──
    if (appleMusicCtx?.isPlaying && appleMusicCtx?.nowPlaying) {
      const song = appleMusicCtx.nowPlaying;
      const state = appleMusicCtx.playbackState;
      const position = state?.position ?? 0;
      const duration = state?.duration ?? 0;

      return {
        moduleId: 'appleMusic',
        artwork: appleMusicCtx.effectiveArtworkUrl ?? null,
        title: song.title || '',
        subtitle: (song as any).artistName || '',
        isPlaying: true,
        isLoading: appleMusicCtx.isLoading ?? false,
        progressType: 'bar',
        progress: duration > 0 ? position / duration : 0,
        onPlayPause: () => { appleMusicCtx.togglePlayback(); },
        onStop: () => { appleMusicCtx.stop(); },
        scrollToId: song.id,
      };
    }

    // ── Radio ──
    if (radioCtx?.isPlaying && radioCtx?.currentStation) {
      const station = radioCtx.currentStation;

      return {
        moduleId: 'radio',
        artwork: radioCtx.metadata?.artwork || station.favicon || null,
        title: radioCtx.metadata?.title || station.name,
        subtitle: radioCtx.metadata?.artist || station.name,
        isPlaying: true,
        isLoading: radioCtx.isLoading ?? false,
        progressType: 'duration',
        listenDuration: radioCtx.position ?? 0,
        onPlayPause: () => {
          if (radioCtx.isPlaying) {
            radioCtx.pause();
          } else {
            radioCtx.play();
          }
        },
        onStop: () => { radioCtx.stop(); },
        scrollToId: station.id,
      };
    }

    // ── Podcast ──
    if (podcastCtx?.isPlaying && podcastCtx?.currentEpisode) {
      const episode = podcastCtx.currentEpisode;
      const show = podcastCtx.currentShow;
      const position = podcastCtx.progress?.position ?? 0;
      const duration = podcastCtx.progress?.duration ?? 0;

      return {
        moduleId: 'podcast',
        artwork: episode.artwork || show?.artwork || null,
        title: episode.title || '',
        subtitle: show?.title || '',
        isPlaying: true,
        isLoading: podcastCtx.isLoading ?? false,
        progressType: 'bar',
        progress: duration > 0 ? position / duration : 0,
        onPlayPause: () => {
          if (podcastCtx.isPlaying) {
            podcastCtx.pause();
          } else {
            podcastCtx.play();
          }
        },
        onStop: () => { podcastCtx.stop(); },
        scrollToId: episode.id,
        collectionId: show?.id,
      };
    }

    // ── Books ──
    // BooksContext has two modes: 'read' (TTS) and 'listen' (audio player)
    // Check both isSpeaking (TTS) and isAudioPlaying (audio)
    const booksActive = booksCtx &&
      (booksCtx.isSpeaking || booksCtx.isAudioPlaying) &&
      booksCtx.currentBook;

    if (booksActive && booksCtx) {
      const book = booksCtx.currentBook!;
      const isListenMode = booksCtx.bookMode === 'listen';
      const audioProgress = booksCtx.audioProgress;
      const progress = isListenMode && audioProgress
        ? audioProgress.percentage / 100
        : 0;

      return {
        moduleId: 'books',
        artwork: null, // Books don't have artwork URLs
        title: book.title || '',
        subtitle: book.author || '',
        isPlaying: true,
        isLoading: booksCtx.isLoading || booksCtx.isAudioLoading || false,
        progressType: 'bar',
        progress,
        onPlayPause: () => {
          if (isListenMode) {
            if (booksCtx.isAudioPlaying) {
              booksCtx.pauseAudio();
            } else {
              booksCtx.playAudio();
            }
          } else {
            if (booksCtx.isSpeaking) {
              booksCtx.pauseReading();
            } else {
              booksCtx.resumeReading();
            }
          }
        },
        onStop: () => {
          if (isListenMode) {
            booksCtx.stopAudio();
          } else {
            booksCtx.stopReading();
          }
        },
        scrollToId: book.id,
      };
    }

    return null;
  }, [
    // Apple Music deps
    appleMusicCtx?.isPlaying,
    appleMusicCtx?.nowPlaying,
    appleMusicCtx?.effectiveArtworkUrl,
    appleMusicCtx?.playbackState,
    appleMusicCtx?.isLoading,
    // Radio deps
    radioCtx?.isPlaying,
    radioCtx?.currentStation,
    radioCtx?.metadata,
    radioCtx?.position,
    radioCtx?.isLoading,
    // Podcast deps
    podcastCtx?.isPlaying,
    podcastCtx?.currentEpisode,
    podcastCtx?.currentShow,
    podcastCtx?.progress,
    podcastCtx?.isLoading,
    // Books deps
    booksCtx?.isSpeaking,
    booksCtx?.isAudioPlaying,
    booksCtx?.currentBook,
    booksCtx?.bookMode,
    booksCtx?.audioProgress,
    booksCtx?.isLoading,
    booksCtx?.isAudioLoading,
    // Note: callbacks (play/pause/stop) are stable refs from contexts,
    // no need to include them as deps
  ]);
}
