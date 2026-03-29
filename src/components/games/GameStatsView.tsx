/**
 * GameStatsView — Statistics display per game
 *
 * Shows aggregated stats: games played, best score, win rate, streaks, total time.
 * Reads data via useGameStats hook.
 *
 * @see Prompt_1_Games_Foundation.md §5.6
 * @see hooks/games/useGameStats.ts
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, borderRadius, typography } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useGameStats } from '@/hooks/games';
import type { GameType } from '@/types/games';
import type { ModuleColorId } from '@/types/liquidGlass';

// ============================================================
// Types
// ============================================================

export interface GameStatsViewProps {
  /** Game type to show stats for */
  gameType: GameType;
  /** Module identifier for accent colors */
  moduleId: ModuleColorId;
}

// ============================================================
// Helpers
// ============================================================

function formatTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0 min';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

// ============================================================
// Component
// ============================================================

export function GameStatsView({ gameType, moduleId }: GameStatsViewProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor(moduleId);
  const { stats, isLoading } = useGameStats(gameType);

  if (isLoading) {
    return null;
  }

  if (stats.gamesPlayed === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
          {t('games.stats.noStats')}
        </Text>
      </View>
    );
  }

  const statRows = [
    { label: t('games.common.gamesPlayed'), value: String(stats.gamesPlayed) },
    { label: t('games.common.bestScore'), value: String(stats.bestScore), highlight: true },
    { label: t('games.common.winRate'), value: `${stats.winRate}%` },
    { label: t('games.common.currentStreak'), value: String(stats.currentStreak) },
    { label: t('games.common.bestStreak'), value: String(stats.bestStreak), highlight: true },
    {
      label: t('games.stats.totalTimePlayed'),
      value: formatTime(stats.bestTimeSeconds || 0),
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: themeColors.textPrimary }]}>
        {t('games.stats.title')}
      </Text>
      <View style={[styles.statsCard, { backgroundColor: themeColors.surface }]}>
        {statRows.map((row, index) => (
          <View
            key={index}
            style={[
              styles.statRow,
              index < statRows.length - 1 && { borderBottomColor: themeColors.border, borderBottomWidth: 1 },
            ]}
          >
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
              {row.label}
            </Text>
            <Text
              style={[
                styles.statValue,
                { color: row.highlight ? moduleColor : themeColors.textPrimary },
              ]}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  title: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  statsCard: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  statLabel: {
    ...typography.body,
  },
  statValue: {
    ...typography.body,
    fontWeight: '600',
  },
  emptyContainer: {
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
});
