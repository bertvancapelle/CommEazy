/**
 * useGlassPlayer — React hook for Glass Player Window
 *
 * Provides a convenient React hook interface for controlling the native
 * iOS Glass Player Window with Liquid Glass effects.
 *
 * Usage:
 * ```tsx
 * const {
 *   isAvailable,
 *   isVisible,
 *   isExpanded,
 *   showMiniPlayer,
 *   expandToFull,
 *   collapseToMini,
 *   hide,
 *   updateContent,
 *   updatePlaybackState,
 * } = useGlassPlayer({
 *   onPlayPause: () => togglePlayback(),
 *   onStop: () => stopPlayback(),
 *   onSeek: (position) => seekTo(position),
 * });
 * ```
 *
 * @see src/services/glassPlayer.ts
 * @see .claude/plans/LIQUID_GLASS_PLAYER_WINDOW.md
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  glassPlayer,
  type GlassPlayerContent,
  type GlassPlayerPlaybackState,
  type GlassPlayerSeekEvent,
  type GlassPlayerSleepTimerEvent,
  type GlassPlayerSpeedEvent,
} from '@/services/glassPlayer';

// ============================================================
// Types
// ============================================================

export interface UseGlassPlayerOptions {
  /** Called when play/pause is tapped */
  onPlayPause?: () => void;
  /** Called when stop is tapped */
  onStop?: () => void;
  /** Called when player expands to full */
  onExpand?: () => void;
  /** Called when player collapses to mini */
  onCollapse?: () => void;
  /** Called when user seeks to position (0-1) */
  onSeek?: (position: number) => void;
  /** Called when skip forward is tapped */
  onSkipForward?: () => void;
  /** Called when skip backward is tapped */
  onSkipBackward?: () => void;
  /** Called when player is closed */
  onClose?: () => void;
  /** Called when favorite button is tapped */
  onFavoriteToggle?: () => void;
  /** Called when sleep timer is set (minutes or null for off) */
  onSleepTimerSet?: (minutes: number | null) => void;
  /** Called when playback speed is changed */
  onSpeedChange?: (speed: number) => void;
  /** Called when shuffle is toggled */
  onShuffleToggle?: () => void;
  /** Called when repeat is toggled */
  onRepeatToggle?: () => void;
}

export interface UseGlassPlayerReturn {
  /** Is Glass Player available (iOS 26+) */
  isAvailable: boolean;
  /** Is availability check still in progress */
  isCheckingAvailability: boolean;
  /** Is player currently visible */
  isVisible: boolean;
  /** Is player in expanded (full) state */
  isExpanded: boolean;
  /** Show mini player with content */
  showMiniPlayer: (content: GlassPlayerContent) => Promise<boolean>;
  /** Expand to full player */
  expandToFull: () => Promise<boolean>;
  /** Collapse to mini player */
  collapseToMini: () => Promise<boolean>;
  /** Hide player completely */
  hide: () => Promise<boolean>;
  /** Update player content */
  updateContent: (content: Partial<GlassPlayerContent>) => void;
  /** Update playback state */
  updatePlaybackState: (state: GlassPlayerPlaybackState) => void;
}

// ============================================================
// Hook
// ============================================================

export function useGlassPlayer(options: UseGlassPlayerOptions = {}): UseGlassPlayerReturn {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Store callbacks in ref to avoid re-subscribing on every render
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Check availability on mount
  useEffect(() => {
    let mounted = true;

    const checkAvailability = async () => {
      const available = await glassPlayer.isAvailable();
      if (mounted) {
        setIsAvailable(available);
        setIsCheckingAvailability(false);
        console.log('[useGlassPlayer] Availability check complete:', available);
      }
    };

    checkAvailability();

    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to events
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(
      glassPlayer.addEventListener('onPlayPause', () => {
        optionsRef.current.onPlayPause?.();
      })
    );

    unsubscribers.push(
      glassPlayer.addEventListener('onStop', () => {
        optionsRef.current.onStop?.();
      })
    );

    unsubscribers.push(
      glassPlayer.addEventListener('onExpand', () => {
        setIsExpanded(true);
        optionsRef.current.onExpand?.();
      })
    );

    unsubscribers.push(
      glassPlayer.addEventListener('onCollapse', () => {
        setIsExpanded(false);
        optionsRef.current.onCollapse?.();
      })
    );

    unsubscribers.push(
      glassPlayer.addEventListener('onSeek', (data: GlassPlayerSeekEvent) => {
        optionsRef.current.onSeek?.(data.position);
      })
    );

    unsubscribers.push(
      glassPlayer.addEventListener('onSkipForward', () => {
        optionsRef.current.onSkipForward?.();
      })
    );

    unsubscribers.push(
      glassPlayer.addEventListener('onSkipBackward', () => {
        optionsRef.current.onSkipBackward?.();
      })
    );

    unsubscribers.push(
      glassPlayer.addEventListener('onClose', () => {
        setIsVisible(false);
        setIsExpanded(false);
        optionsRef.current.onClose?.();
      })
    );

    unsubscribers.push(
      glassPlayer.addEventListener('onFavoriteToggle', () => {
        optionsRef.current.onFavoriteToggle?.();
      })
    );

    unsubscribers.push(
      glassPlayer.addEventListener('onSleepTimerSet', (data: GlassPlayerSleepTimerEvent) => {
        optionsRef.current.onSleepTimerSet?.(data.minutes);
      })
    );

    unsubscribers.push(
      glassPlayer.addEventListener('onSpeedChange', (data: GlassPlayerSpeedEvent) => {
        optionsRef.current.onSpeedChange?.(data.speed);
      })
    );

    unsubscribers.push(
      glassPlayer.addEventListener('onShuffleToggle', () => {
        optionsRef.current.onShuffleToggle?.();
      })
    );

    unsubscribers.push(
      glassPlayer.addEventListener('onRepeatToggle', () => {
        optionsRef.current.onRepeatToggle?.();
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);

  // Wrapped methods that update local state
  const showMiniPlayer = useCallback(async (content: GlassPlayerContent): Promise<boolean> => {
    const result = await glassPlayer.showMiniPlayer(content);
    if (result) {
      setIsVisible(true);
      setIsExpanded(false);
    }
    return result;
  }, []);

  const expandToFull = useCallback(async (): Promise<boolean> => {
    const result = await glassPlayer.expandToFull();
    if (result) {
      setIsExpanded(true);
    }
    return result;
  }, []);

  const collapseToMini = useCallback(async (): Promise<boolean> => {
    const result = await glassPlayer.collapseToMini();
    if (result) {
      setIsExpanded(false);
    }
    return result;
  }, []);

  const hide = useCallback(async (): Promise<boolean> => {
    const result = await glassPlayer.hide();
    if (result) {
      setIsVisible(false);
      setIsExpanded(false);
    }
    return result;
  }, []);

  const updateContent = useCallback((content: Partial<GlassPlayerContent>): void => {
    glassPlayer.updateContent(content);
  }, []);

  const updatePlaybackState = useCallback((state: GlassPlayerPlaybackState): void => {
    glassPlayer.updatePlaybackState(state);
  }, []);

  return {
    isAvailable,
    isCheckingAvailability,
    isVisible,
    isExpanded,
    showMiniPlayer,
    expandToFull,
    collapseToMini,
    hide,
    updateContent,
    updatePlaybackState,
  };
}

export default useGlassPlayer;
