/**
 * useSleepTimer — Shared hook for sleep timer functionality
 *
 * Provides a reusable sleep timer that can be used across all audio modules
 * (Radio, Apple Music, Podcast, Books).
 *
 * Features:
 * - Set timer with duration in minutes
 * - Auto-stop playback when timer expires
 * - Cancel timer functionality
 * - Cleanup on unmount
 *
 * @see .claude/skills/react-native-expert/SKILL.md
 */

import { useRef, useEffect, useCallback } from 'react';

interface UseSleepTimerProps {
  /** Function to call when timer expires (typically stop playback) */
  onTimerExpired: () => void | Promise<void>;
  /** Function to update context state for MediaIndicator */
  setSleepTimerActive: (active: boolean) => void;
  /** Module name for logging */
  moduleName?: string;
  /** Enable test mode where 0 minutes = 30 seconds (DEV only) */
  enableTestMode?: boolean;
}

interface UseSleepTimerReturn {
  /** Set the sleep timer with duration in minutes, or null to cancel */
  setSleepTimer: (minutes: number | null) => void;
  /** Check if a sleep timer is currently active */
  isTimerActive: () => boolean;
  /** Cancel any active sleep timer */
  cancelTimer: () => void;
}

/**
 * Hook for managing sleep timer functionality across audio modules.
 *
 * @example
 * ```typescript
 * const { setSleepTimer, cancelTimer } = useSleepTimer({
 *   onTimerExpired: () => stop(),
 *   setSleepTimerActive,
 *   moduleName: 'RadioScreen',
 * });
 *
 * // In glass player callbacks:
 * onSleepTimerSet: setSleepTimer,
 * ```
 */
export function useSleepTimer({
  onTimerExpired,
  setSleepTimerActive,
  moduleName = 'SleepTimer',
  enableTestMode = false,
}: UseSleepTimerProps): UseSleepTimerReturn {
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cancel any existing timer
  const cancelTimer = useCallback(() => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    setSleepTimerActive(false);
  }, [setSleepTimerActive]);

  // Set or cancel the sleep timer
  const setSleepTimer = useCallback(
    (minutes: number | null) => {
      // Clear existing timer if any
      cancelTimer();

      if (minutes === null) {
        console.log(`[${moduleName}] Sleep timer cancelled`);
        return;
      }

      // In test mode (DEV only), 0 minutes = 30 seconds for quick testing
      const isTestDuration = enableTestMode && __DEV__ && minutes === 0;
      const durationMs = isTestDuration ? 30 * 1000 : minutes * 60 * 1000;
      const logMessage = isTestDuration
        ? `[${moduleName}] Sleep timer set for 30 seconds (TEST MODE)`
        : `[${moduleName}] Sleep timer set for ${minutes} minutes`;
      console.log(logMessage);

      // Update context so MediaIndicator shows the moon icon
      setSleepTimerActive(true);

      sleepTimerRef.current = setTimeout(async () => {
        console.log(`[${moduleName}] Sleep timer triggered - stopping playback`);
        await onTimerExpired();
        sleepTimerRef.current = null;
        setSleepTimerActive(false);
      }, durationMs);
    },
    [onTimerExpired, setSleepTimerActive, moduleName, cancelTimer, enableTestMode]
  );

  // Check if timer is active
  const isTimerActive = useCallback(() => {
    return sleepTimerRef.current !== null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
    };
  }, []);

  return {
    setSleepTimer,
    isTimerActive,
    cancelTimer,
  };
}
