/**
 * GameOverModal — End-of-game results popup
 *
 * Centered floating card with semi-transparent backdrop.
 * On win: celebration animation (random type) + score count-up + win sound.
 * On loss: snowfall animation + static score + lose sound.
 *
 * Uses PanelAwareModal (fade) + LiquidGlassView for Liquid Glass compliance.
 *
 * @see CelebrationAnimation.tsx
 * @see src/services/gameSoundService.ts
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, borderRadius, touchTargets, typography } from '@/theme';
import { HapticTouchable, Icon } from '@/components';
import { PanelAwareModal } from '@/components/PanelAwareModal';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { gameSoundService } from '@/services/gameSoundService';
import type { ModuleColorId } from '@/types/liquidGlass';
import { CelebrationAnimation } from './CelebrationAnimation';

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
  /** Whether the player won */
  isWon?: boolean;
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
// Score Count-Up Hook
// ============================================================

function useCountUp(target: number, active: boolean, duration = 1000): number {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!active || target <= 0) {
      setDisplay(target);
      return;
    }

    setDisplay(0);
    const startTime = Date.now();
    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic for satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [target, active, duration]);

  return display;
}

// ============================================================
// Component
// ============================================================

export function GameOverModal({
  visible,
  moduleId,
  title,
  score,
  isWon = false,
  stats = [],
  onPlayAgain,
  onBackToLobby,
  onClose,
}: GameOverModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor(moduleId);

  // Animations
  const cardScale = useRef(new Animated.Value(0.8)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Score count-up (only on win)
  const displayScore = useCountUp(score, visible && isWon);

  // Entrance animation + win sound
  useEffect(() => {
    if (visible) {
      // Load sound settings (if not already loaded)
      gameSoundService.loadSettings();

      // Reset animations
      cardScale.setValue(0.8);
      cardOpacity.setValue(0);
      backdropOpacity.setValue(0);

      // Backdrop fade-in
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Card entrance
      Animated.parallel([
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      // Play win or lose sound
      if (isWon) {
        setTimeout(() => gameSoundService.playWinSound(), 200);
      } else {
        setTimeout(() => gameSoundService.playLoseSound(), 200);
      }
    }
  }, [visible, isWon, cardScale, cardOpacity, backdropOpacity]);

  if (!visible) return null;

  return (
    <PanelAwareModal
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
      moduleId={moduleId}
    >
      {/* Semi-transparent backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <HapticTouchable
          hapticDisabled
          longPressGuardDisabled
          style={styles.backdropTouchable}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
      </Animated.View>

      {/* Celebration animation (above backdrop, below card) */}
      <CelebrationAnimation
        moduleColor={moduleColor}
        active={visible}
        isWon={isWon}
      />

      {/* Centered popup card */}
      <View style={styles.centerContainer} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.cardWrapper,
            {
              opacity: cardOpacity,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          <LiquidGlassView moduleId={moduleId} cornerRadius={16}>
            <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
              {/* Title */}
              <Text style={[styles.title, { color: themeColors.textPrimary }]}>
                {title}
              </Text>

              {/* Score */}
              <View style={[styles.scoreContainer, { backgroundColor: moduleColor + '1A' }]}>
                <Text style={[styles.scoreLabel, { color: themeColors.textSecondary }]}>
                  {t('games.common.score')}
                </Text>
                <Text style={[styles.scoreValue, { color: moduleColor }]}>
                  {isWon ? displayScore : score}
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
        </Animated.View>
      </View>
    </PanelAwareModal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  backdropTouchable: {
    flex: 1,
  },
  centerContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    // Shadow for elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    overflow: 'hidden',
  },
  title: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  scoreContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
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
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
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
