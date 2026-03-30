/**
 * WoordraadScreen — Wordle-style Dutch word guessing game
 *
 * Player guesses a 5-letter Dutch word in up to 6 attempts.
 * Color feedback per letter: green (correct), yellow (present), grey (absent).
 *
 * Senior-inclusive design:
 * - Large letter tiles (56×56pt minimum)
 * - High contrast colors for feedback
 * - On-screen QWERTY keyboard with 60pt keys
 * - Clear visual feedback with color + icon (not color-only)
 *
 * @see src/engines/woordraad/engine.ts
 * @see src/types/games.ts
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, borderRadius, touchTargets, typography, colors as themeConst } from '@/theme';
import { ModuleHeader, ModuleScreenLayout, HapticTouchable, Icon } from '@/components';
import { GameHeader, GameOverModal, DifficultyPicker, GameStatsView } from '@/components/games';
import type { GameOverStat } from '@/components/games';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useGameSession } from '@/hooks/games/useGameSession';
import type { ModuleColorId } from '@/types/liquidGlass';
import type { GameDifficulty } from '@/types/games';

import {
  createInitialState,
  submitGuess,
  validateGuess,
  calculateScore,
  serializeState,
  deserializeState,
  getStarRating,
  WORD_LENGTH,
  MAX_GUESSES,
  type WoordraadState,
  type LetterStatus,
  type LetterResult,
} from '@/engines/woordraad/engine';

// ============================================================
// Constants
// ============================================================

const MODULE_ID: ModuleColorId = 'woordraad' as ModuleColorId;
const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = spacing.md * 2;

// Tile sizing: fit 5 tiles with gaps in available width
const TILE_GAP = 6;
const TILE_SIZE = Math.min(
  Math.floor((SCREEN_WIDTH - GRID_PADDING - TILE_GAP * (WORD_LENGTH - 1)) / WORD_LENGTH),
  64,
);

// Keyboard layout — Dutch QWERTY
const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL'],
];

const KEY_GAP = 4;
const KEY_HEIGHT = 52;

// ============================================================
// Types
// ============================================================

interface WoordraadScreenProps {
  onBack: () => void;
}

type GamePhase = 'menu' | 'playing' | 'gameover';

// ============================================================
// Feedback colors (WCAG AAA compliant)
// ============================================================

const FEEDBACK_COLORS = {
  correct: '#1B5E20',   // Green 900 — letter in correct position
  present: '#E65100',   // Deep Orange 900 — letter in word, wrong position
  absent: '#616161',    // Grey 700 — letter not in word
  empty: 'transparent',
} as const;

// ============================================================
// Component
// ============================================================

export function WoordraadScreen({ onBack }: WoordraadScreenProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor(MODULE_ID);
  const insets = useSafeAreaInsets();

  // Game session
  const {
    durationSeconds,
    startSession,
    completeGame,
    abandonGame,
  } = useGameSession({ gameType: 'woordraad' });

  // Game state
  const [gameState, setGameState] = useState<WoordraadState | null>(null);
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [error, setError] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear error after 2 seconds
  const showError = useCallback((errorKey: string) => {
    setError(errorKey);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => setError(null), 2000);
  }, []);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  // Start new game
  const handleStartGame = useCallback(async () => {
    const state = createInitialState();
    setGameState(state);
    setPhase('playing');
    setError(null);
    await startSession({
      gameType: 'woordraad',
      mode: 'solo',
      players: [],
    });
  }, [startSession]);

  // Handle keyboard input
  const handleKeyPress = useCallback((key: string) => {
    if (!gameState || gameState.isGameOver) return;

    if (key === 'DEL') {
      setGameState(prev => prev ? {
        ...prev,
        currentInput: prev.currentInput.slice(0, -1),
      } : null);
      return;
    }

    if (key === 'ENTER') {
      if (gameState.currentInput.length !== WORD_LENGTH) {
        showError('games.woordraad.errorTooShort');
        return;
      }

      const validationError = validateGuess(gameState.currentInput);
      if (validationError) {
        showError(validationError);
        return;
      }

      const newState = submitGuess(gameState, gameState.currentInput);
      if (!newState) return;

      setGameState(newState);
      setError(null);

      if (newState.isGameOver) {
        const score = calculateScore(newState);
        completeGame(score, newState.isWon);
        setPhase('gameover');
      }
      return;
    }

    // Letter key
    if (gameState.currentInput.length < WORD_LENGTH) {
      setGameState(prev => prev ? {
        ...prev,
        currentInput: prev.currentInput + key,
      } : null);
    }
  }, [gameState, showError, completeGame]);

  // Handle quit
  const handleQuit = useCallback(() => {
    Alert.alert(
      t('games.common.quit'),
      t('games.common.quitConfirm'),
      [
        { text: t('games.common.resume'), style: 'cancel' },
        {
          text: t('games.common.quit'),
          style: 'destructive',
          onPress: () => {
            abandonGame();
            setPhase('menu');
            setGameState(null);
          },
        },
      ],
    );
  }, [t, abandonGame]);

  // Handle play again
  const handlePlayAgain = useCallback(() => {
    handleStartGame();
  }, [handleStartGame]);

  // Handle back to lobby
  const handleBackToLobby = useCallback(() => {
    setPhase('menu');
    setGameState(null);
  }, []);

  // Game over stats
  const gameOverStats: GameOverStat[] = useMemo(() => {
    if (!gameState) return [];
    return [
      {
        label: t('games.woordraad.guessesUsed'),
        value: `${gameState.guesses.length} / ${MAX_GUESSES}`,
      },
      {
        label: t('games.common.time'),
        value: formatTime(durationSeconds),
      },
      ...(gameState.isWon ? [{
        label: t('games.woordraad.stars'),
        value: '⭐'.repeat(getStarRating(gameState) || 0),
        isHighlight: true,
      }] : [{
        label: t('games.woordraad.answer'),
        value: gameState.targetWord,
        isHighlight: true,
      }]),
    ];
  }, [gameState, durationSeconds, t]);

  // ============================================================
  // Render — Menu Phase
  // ============================================================

  if (phase === 'menu') {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ModuleScreenLayout
          moduleId={MODULE_ID}
          moduleBlock={
            <ModuleHeader
              moduleId={MODULE_ID}
              icon="chatbubble"
              title={t('navigation.woordraad')}
              showBackButton
              onBackPress={onBack}
              backIcon="gamepad"
              skipSafeArea
            />
          }
          controlsBlock={<></>}
          contentBlock={
            <View style={styles.menuContent}>
              <View style={[styles.menuCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                <Text style={[styles.menuTitle, { color: themeColors.textPrimary }]}>
                  {t('games.woordraad.title')}
                </Text>
                <Text style={[styles.menuDescription, { color: themeColors.textSecondary }]}>
                  {t('games.woordraad.howToPlay')}
                </Text>

                {/* Legend */}
                <View style={styles.legendSection}>
                  <LegendItem
                    color={FEEDBACK_COLORS.correct}
                    label={t('games.woordraad.legendCorrect')}
                  />
                  <LegendItem
                    color={FEEDBACK_COLORS.present}
                    label={t('games.woordraad.legendPresent')}
                  />
                  <LegendItem
                    color={FEEDBACK_COLORS.absent}
                    label={t('games.woordraad.legendAbsent')}
                  />
                </View>

                <HapticTouchable
                  onPress={handleStartGame}
                  hapticType="success"
                  style={[styles.startButton, { backgroundColor: moduleColor }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('games.lobby.newGame')}
                >
                  <Icon name="play" size={24} color="#FFFFFF" />
                  <Text style={styles.startButtonText}>
                    {t('games.lobby.newGame')}
                  </Text>
                </HapticTouchable>
              </View>

              {/* Stats */}
              <HapticTouchable
                onPress={() => setShowStats(!showStats)}
                style={[styles.statsToggle, { borderColor: themeColors.border }]}
                accessibilityRole="button"
                accessibilityLabel={t('games.stats.title')}
              >
                <Text style={[styles.statsToggleText, { color: moduleColor }]}>
                  {t('games.stats.title')}
                </Text>
                <Icon name={showStats ? 'chevron-up' : 'chevron-down'} size={20} color={moduleColor} />
              </HapticTouchable>

              {showStats && <GameStatsView gameType="woordraad" moduleId={MODULE_ID} />}
            </View>
          }
        />
      </View>
    );
  }

  // ============================================================
  // Render — Playing Phase
  // ============================================================

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ModuleScreenLayout
        moduleId={MODULE_ID}
        moduleBlock={
          <ModuleHeader
            moduleId={MODULE_ID}
            icon="chatbubble"
            title={t('navigation.woordraad')}
            showBackButton
            onBackPress={handleQuit}
            backIcon="gamepad"
            skipSafeArea
          />
        }
        controlsBlock={
          <GameHeader
            moduleId={MODULE_ID}
            showTimer
            timer={durationSeconds}
            actions={[]}
          />
        }
        contentBlock={
          <View style={styles.gameContent}>
            {/* Error banner */}
            {error && (
              <View style={[styles.errorBanner, { backgroundColor: themeConst.errorBackground }]}>
                <Text style={[styles.errorText, { color: themeConst.error }]}>
                  {t(error)}
                </Text>
              </View>
            )}

            {/* Guess grid */}
            <View style={styles.gridContainer}>
              {Array.from({ length: MAX_GUESSES }).map((_, rowIndex) => {
                const guess = gameState?.guesses[rowIndex];
                const result = gameState?.results[rowIndex];
                const isCurrentRow = rowIndex === (gameState?.guesses.length ?? 0);
                const currentInput = isCurrentRow ? (gameState?.currentInput ?? '') : '';

                return (
                  <View key={rowIndex} style={styles.gridRow}>
                    {Array.from({ length: WORD_LENGTH }).map((_, colIndex) => {
                      let letter = '';
                      let status: LetterStatus = 'empty';

                      if (guess && result) {
                        letter = result[colIndex].letter;
                        status = result[colIndex].status;
                      } else if (isCurrentRow && colIndex < currentInput.length) {
                        letter = currentInput[colIndex];
                      }

                      return (
                        <View
                          key={colIndex}
                          style={[
                            styles.tile,
                            {
                              backgroundColor: status !== 'empty'
                                ? FEEDBACK_COLORS[status]
                                : themeColors.surface,
                              borderColor: letter && status === 'empty'
                                ? moduleColor
                                : status !== 'empty'
                                  ? FEEDBACK_COLORS[status]
                                  : themeColors.border,
                            },
                          ]}
                          accessibilityLabel={letter ? `${letter}, ${t(`games.woordraad.status_${status}`)}` : undefined}
                        >
                          <Text
                            style={[
                              styles.tileLetter,
                              {
                                color: status !== 'empty'
                                  ? '#FFFFFF'
                                  : themeColors.textPrimary,
                              },
                            ]}
                          >
                            {letter}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>

            {/* On-screen keyboard */}
            <View style={[styles.keyboardContainer, { paddingBottom: spacing.md + insets.bottom }]}>
              {KEYBOARD_ROWS.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.keyboardRow}>
                  {row.map((key) => {
                    const isSpecial = key === 'ENTER' || key === 'DEL';
                    const keyStatus = !isSpecial ? gameState?.letterStatuses[key] : undefined;

                    return (
                      <HapticTouchable
                        key={key}
                        onPress={() => handleKeyPress(key)}
                        hapticType="tap"
                        style={[
                          styles.key,
                          isSpecial && styles.keyWide,
                          {
                            backgroundColor: keyStatus
                              ? FEEDBACK_COLORS[keyStatus]
                              : themeColors.surface,
                            borderColor: themeColors.border,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={
                          key === 'DEL' ? t('games.woordraad.delete')
                            : key === 'ENTER' ? t('games.woordraad.submit')
                              : key
                        }
                      >
                        {key === 'DEL' ? (
                          <Icon name="close" size={20} color={themeColors.textPrimary} />
                        ) : (
                          <Text
                            style={[
                              styles.keyText,
                              {
                                color: keyStatus && keyStatus !== 'empty'
                                  ? '#FFFFFF'
                                  : themeColors.textPrimary,
                              },
                            ]}
                          >
                            {key === 'ENTER' ? '✓' : key}
                          </Text>
                        )}
                      </HapticTouchable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        }
      />

      {/* Game Over Modal */}
      {gameState && (
        <GameOverModal
          visible={phase === 'gameover'}
          moduleId={MODULE_ID}
          title={gameState.isWon
            ? t('games.common.congratulations')
            : t('games.common.gameOver')
          }
          score={calculateScore(gameState)}
          stats={gameOverStats}
          onPlayAgain={handlePlayAgain}
          onBackToLobby={handleBackToLobby}
          onClose={handleBackToLobby}
        />
      )}
    </View>
  );
}

// ============================================================
// Legend Item Sub-component
// ============================================================

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendTile, { backgroundColor: color }]}>
        <Text style={styles.legendTileLetter}>A</Text>
      </View>
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

// ============================================================
// Helpers
// ============================================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Menu
  menuContent: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  menuCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  menuTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  menuDescription: {
    ...typography.body,
    marginBottom: spacing.lg,
  },
  legendSection: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  legendTile: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendTileLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  legendLabel: {
    ...typography.body,
    flex: 1,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: touchTargets.comfortable,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  startButtonText: {
    ...typography.button,
    color: '#FFFFFF',
  },
  statsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  statsToggleText: {
    ...typography.body,
    fontWeight: '600',
  },
  // Game
  gameContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  errorBanner: {
    marginHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    fontWeight: '600',
  },
  // Grid
  gridContainer: {
    alignItems: 'center',
    gap: TILE_GAP,
    paddingVertical: spacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: TILE_GAP,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileLetter: {
    fontSize: Math.max(TILE_SIZE * 0.5, 24),
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  // Keyboard
  keyboardContainer: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
    gap: KEY_GAP,
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: KEY_GAP,
  },
  key: {
    minWidth: Math.floor((SCREEN_WIDTH - spacing.sm * 2 - KEY_GAP * 9) / 10),
    height: KEY_HEIGHT,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  keyWide: {
    minWidth: Math.floor((SCREEN_WIDTH - spacing.sm * 2 - KEY_GAP * 9) / 10) * 1.5,
    paddingHorizontal: spacing.sm,
  },
  keyText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
