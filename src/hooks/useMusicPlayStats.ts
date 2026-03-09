/**
 * useMusicPlayStats — React hook for music play stats state management
 *
 * Provides play count tracking and "last played" lookups with automatic state updates.
 * Follows the useAlbumFavorites.ts pattern: load on mount, re-read after mutations.
 *
 * Used by the favorites tab to sort items by most used and show "last played".
 */

import { useState, useCallback, useEffect } from 'react';
import type { PlayStatsCategory, PlayStatEntry } from '@/services/music/musicPlayStatsService';
import {
  recordPlay as recordPlayService,
  getPlayStats,
  getLastPlayed as getLastPlayedService,
  getStatsSortedByPlayCount,
  removePlayStats as removePlayStatsService,
} from '@/services/music/musicPlayStatsService';

// ============================================================
// Types
// ============================================================

export interface UseMusicPlayStatsReturn {
  /** Whether stats are being loaded */
  isLoading: boolean;

  /** Record a play for an item (increments count, updates lastPlayedAt) */
  recordPlay: (
    category: PlayStatsCategory,
    itemId: string,
    metadata: { displayName: string; artworkUrl: string | null },
  ) => Promise<void>;

  /** Get the most recently played item for a category */
  getLastPlayed: (category: PlayStatsCategory) => PlayStatEntry | null;

  /** Get play stats map for sorting (itemId → PlayStatEntry), sorted by play count */
  getStatsMap: (category: PlayStatsCategory) => Map<string, PlayStatEntry>;

  /** Remove play stats for a specific item */
  removeStats: (category: PlayStatsCategory, itemId: string) => Promise<void>;

  /** Reload all stats from storage */
  reload: () => Promise<void>;
}

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[useMusicPlayStats]';

// ============================================================
// Hook
// ============================================================

export function useMusicPlayStats(isFocused?: boolean): UseMusicPlayStatsReturn {
  const [allStats, setAllStats] = useState<PlayStatEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load all stats from storage
  const reload = useCallback(async () => {
    try {
      const stats = await getPlayStats();
      setAllStats(stats);
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to load play stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount + reload when screen regains focus
  useEffect(() => {
    if (isFocused === undefined || isFocused) {
      reload();
    }
  }, [reload, isFocused]);

  // Record a play and refresh state
  const recordPlay = useCallback(async (
    category: PlayStatsCategory,
    itemId: string,
    metadata: { displayName: string; artworkUrl: string | null },
  ): Promise<void> => {
    try {
      await recordPlayService(category, itemId, metadata);
      await reload();
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to record play');
    }
  }, [reload]);

  // Get last played for a category (sync, uses in-memory state)
  const getLastPlayed = useCallback((category: PlayStatsCategory): PlayStatEntry | null => {
    const categoryStats = allStats.filter(s => s.category === category);
    if (categoryStats.length === 0) return null;

    return categoryStats.reduce((latest, current) =>
      current.lastPlayedAt > latest.lastPlayedAt ? current : latest,
    );
  }, [allStats]);

  // Get stats map for a category, sorted by play count (sync, uses in-memory state)
  const getStatsMap = useCallback((category: PlayStatsCategory): Map<string, PlayStatEntry> => {
    const categoryStats = allStats.filter(s => s.category === category);
    const map = new Map<string, PlayStatEntry>();

    categoryStats
      .sort((a, b) => b.playCount - a.playCount || b.lastPlayedAt - a.lastPlayedAt)
      .forEach(s => map.set(s.itemId, s));

    return map;
  }, [allStats]);

  // Remove stats for an item and refresh
  const removeStats = useCallback(async (
    category: PlayStatsCategory,
    itemId: string,
  ): Promise<void> => {
    try {
      await removePlayStatsService(category, itemId);
      await reload();
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to remove play stats');
    }
  }, [reload]);

  return {
    isLoading,
    recordPlay,
    getLastPlayed,
    getStatsMap,
    removeStats,
    reload,
  };
}
