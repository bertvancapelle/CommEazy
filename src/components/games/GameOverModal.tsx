/**
 * GameOverModal — End-of-game results modal
 *
 * Shows score, statistics, and action buttons (play again / back to lobby).
 * Uses PanelAwareModal + LiquidGlassView for Liquid Glass compliance.
 *
 * @see Prompt_1_Games_Foundation.md §5.2
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, borderRadius, touchTargets, typography } from '@/theme';
import { HapticTouchable, Icon } from '@/components';
import { PanelAwareModal } from '@/components/PanelAwareModal';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import type { ModuleColorId } from '@/types/liquidGlass';

// ============================================================
// Types
// ============================================================

export interface GameOverStat {
  /** i18n label text */
  label: string;
  /** Display value */
  value: string;
  /** Use accent color for this row */
  isHighlight?: boolean;
}

export interface GameOverModalProps {
  /** Modal visibility */
  visible: boolean;
  /** Module identifier for LiquidGlassView tint */
  moduleId: ModuleColorId;
  /** Title text — e.g. "Gefeliciteerd!" or "Game Over" */
  title: string;
  /** Final score */
  score: number;
  /** Statistics rows */
  stats?: GameOverStat[];
  /** Play again handler */
  onPlayAgain: () => void;
  /** Back to lobby handler */
  onBackToLobby: () => void;
  /** Close modal handler */
  onClose: () => void;
}

// ============================================================
// Component
// ============================================================

export function GameOverModal({
  visible,
  moduleId,
  title,
  score,
  stats = [],
  onPlayAgain,
  onBackToLobby,
  onClose,
}: GameOverModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor(moduleId);

  return (
    <PanelAwareModal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      moduleId={moduleId}
    >
      <LiquidGlassView moduleId={moduleId} cornerRadius={0}>
        <View style={[styles.container, { backgroundColor: themeColors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {title}
            </Text>
            <HapticTouchable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={styles.closeButton}
            >
              <Icon name="x" size={24} color={themeColors.textSecondary} />
            </HapticTouchable>
          </View>

          {/* Score */}
          <View style={[styles.scoreContainer, { backgroundColor: moduleColor + '1A' }]}>
            <Text style={[styles.scoreLabel, { color: themeColors.textSecondary }]}>
              {t('games.common.score')}
            </Text>
            <Text style={[styles.scoreValue, { color: moduleColor }]}>
              {score}
            </Text>
          </View>

          {/* Stats */}
          {stats.length > 0 && (
            <View style={styles.statsContainer}>
              {stats.map((stat, index) => (
                <View
                  key={index}
                  style={[styles.statRow, { borderBottomColor: themeColors.border }]}
                >
                  <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
                    {stat.label}
                  </Text>
                  <Text
                    style={[
                      styles.statValue,
                      { color: stat.isHighlight ? moduleColor : themeColors.textPrimary },
                    ]}
                  >
                    {stat.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <HapticTouchable
              hapticType="success"
              onPress={onPlayAgain}
              accessibilityRole="button"
              accessibilityLabel={t('games.common.playAgain')}
              style={[styles.primaryButton, { backgroundColor: moduleColor }]}
            >
              <Icon name="play" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>
                {t('games.common.playAgain')}
              </Text>
            </HapticTouchable>

            <HapticTouchable
              onPress={onBackToLobby}
              accessibilityRole="button"
              accessibilityLabel={t('games.common.backToLobby')}
              style={[styles.secondaryButton, { borderColor: moduleColor }]}
            >
              <Text style={[styles.secondaryButtonText, { color: moduleColor }]}>
                {t('games.common.backToLobby')}
              </Text>
            </HapticTouchable>
          </View>
        </View>
      </LiquidGlassView>
    </PanelAwareModal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    flex: 1,
  },
  closeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  scoreLabel: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 56,
  },
  statsContainer: {
    marginBottom: spacing.lg,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  statLabel: {
    ...typography.body,
  },
  statValue: {
    ...typography.body,
    fontWeight: '600',
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  primaryButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
});
