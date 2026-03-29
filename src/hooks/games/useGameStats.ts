/**
 * useGameStats — Game Statistics Hook
 *
 * Provides aggregated statistics for a specific game type.
 * Reads from GameContext which manages the underlying WatermelonDB records.
 *
 * @see contexts/GameContext.tsx for data layer
 * @see models/GameStat.ts for stat model
 * @see types/games.ts for GameStatsDisplay
 * @see Prompt_0_Games_Architecture.md §6.2
 */

import { useMemo } from 'react';
import { useGameContext } from '@/contexts/GameContext';
import type { GameType, GameStatsDisplay } from '@/types/games';

interface UseGameStatsReturn {
  /** Aggregated stats for the game type */
  stats: GameStatsDisplay;
  /** Whether data is still loading */
  isLoading: boolean;
  /** Reload stats from database */
  reload: () => Promise<void>;
}

/**
 * Hook to get statistics for a specific game type.
 *
 * Usage:
 * ```tsx
 * const { stats, isLoading } = useGameStats('sudoku');
 * // stats.gamesPlayed, stats.bestScore, stats.winRate, etc.
 * ```
 */
export function useGameStats(gameType: GameType): UseGameStatsReturn {
  const { getStats, isLoading, reload } = useGameContext();

  const stats = useMemo(() => getStats(gameType), [getStats, gameType]);

  return {
    stats,
    isLoading,
    reload,
  };
}
