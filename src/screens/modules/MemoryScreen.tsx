/**
 * MemoryScreen — Emoji pair matching game
 *
 * Senior-inclusive design:
 * - Large emoji cards (minimum 60×60pt)
 * - Clear flip feedback with scale animation
 * - Matched pairs stay visible with lighter opacity
 * - No time pressure (timer is informational)
 * - Clear visual + haptic feedback on match/mismatch
 *
 * @see src/engines/memory/engine.ts
 * @see src/types/games.ts
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, borderRadius, touchTargets, typography, colors as themeConst } from '@/theme';
import { ModuleHeader, ModuleScreenLayout, HapticTouchable, Icon } from '@/components';
import { GameHeader, GameOverModal, DifficultyPicker, GameStatsView } from '@/components/games';
import type { GameOverStat, DifficultyOption } from '@/components/games';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useGameSession } from '@/hooks/games/useGameSession';
import type { ModuleColorId } from '@/types/liquidGlass';
import type { GameDifficulty } from '@/types/games';

import {
  createInitialState,
  flipCard,
  checkMatch,
  calculateScore,
  getStarRating,
  type MemoryState,
  type MemoryCard,
} from '@/engines/memory/engine';

// ============================================================
// Constants
// ============================================================

const MODULE_ID: ModuleColorId = 'memory' as ModuleColorId;
const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = spacing.md;
const CARD_GAP = spacing.sm;
const MATCH_CHECK_DELAY = 1000; // ms before checking match

// ============================================================
// Types
// ============================================================

interface MemoryScreenProps {
  onBack: () => void;
}

type GamePhase = 'menu' | 'playing' | 'gameover';

// ============================================================
// Difficulty options
// ============================================================

const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  { value: 'easy', label: 'games.lobby.easy' },
  { value: 'medium', label: 'games.lobby.medium' },
  { value: 'hard', label: 'games.lobby.hard' },
  { value: 'expert', label: 'games.lobby.expert' },
];

// ============================================================
// Component
// ============================================================

export function MemoryScreen({ onBack }: MemoryScreenProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor(MODULE_ID);

  // Game session
  const {
    durationSeconds,
    startSession,
    completeGame,
    abandonGame,
  } = useGameSession({ gameType: 'memory' });

  // Game state
  const [gameState, setGameState] = useState<MemoryState | null>(null);
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [difficulty, setDifficulty] = useState<GameDifficulty>('easy');
  const [showStats, setShowStats] = useState(false);
  const [lastMatchResult, setLastMatchResult] = useState<boolean | null>(null);
  const matchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
    };
  }, []);

  // Calculate card size based on grid dimensions
  const cardSize = useMemo(() => {
    if (!gameState) return 60;
    const availableWidth = SCREEN_WIDTH - GRID_PADDING * 2 - CARD_GAP * (gameState.gridCols - 1);
    const maxCardWidth = Math.floor(availableWidth / gameState.gridCols);
    return Math.min(maxCardWidth, 80); // Cap at 80pt
  }, [gameState]);

  // Start new game
  const handleStartGame = useCallback(async () => {
    const state = createInitialState(difficulty);
    setGameState(state);
    setPhase('playing');
    setLastMatchResult(null);
    await startSession({
      gameType: 'memory',
      mode: 'solo',
      difficulty,
      players: [],
    });
  }, [difficulty, startSession]);

  // Handle card flip
  const handleCardFlip = useCallback((index: number) => {
    if (!gameState || gameState.isCheckingMatch) return;

    const flipped = flipCard(gameState, index);
    if (!flipped) return;

    setGameState(flipped);

    // If two cards are flipped, check for match after delay
    if (flipped.isCheckingMatch) {
      matchTimerRef.current = setTimeout(() => {
        setGameState(prev => {
          if (!prev) return prev;
          const { state: newState, isMatch } = checkMatch(prev);
          setLastMatchResult(isMatch);

          // Clear match result indicator after 500ms
          setTimeout(() => setLastMatchResult(null), 500);

          // Check win
          if (newState.isComplete && newState.isWon) {
            const score = calculateScore(newState, durationSeconds);
            completeGame(score, true);
            setPhase('gameover');
          }

          return newState;
        });
      }, MATCH_CHECK_DELAY);
    }
  }, [gameState, durationSeconds, completeGame]);

  // Quit
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
            if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
            abandonGame();
            setPhase('menu');
            setGameState(null);
          },
        },
      ],
    );
  }, [t, abandonGame]);

  // Play again / back to lobby
  const handlePlayAgain = useCallback(() => {
    if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
    handleStartGame();
  }, [handleStartGame]);

  const handleBackToLobby = useCallback(() => {
    if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
    setPhase('menu');
    setGameState(null);
  }, []);

  // Game over stats
  const gameOverStats: GameOverStat[] = useMemo(() => {
    if (!gameState) return [];
    return [
      { label: t('games.memory.moves'), value: `${gameState.moveCount}` },
      { label: t('games.memory.pairs'), value: `${gameState.matchedPairs}/${gameState.totalPairs}` },
      { label: t('games.common.time'), value: formatTime(durationSeconds) },
      ...(gameState.isWon ? [{
        label: t('games.woordraad.stars'),
        value: '⭐'.repeat(getStarRating(gameState) || 0),
        isHighlight: true,
      }] : []),
    ];
  }, [gameState, durationSeconds, t]);

  // ============================================================
  // Gamepad button (RIGHT side — consistent across all games)
  // ============================================================

  const renderGamepadButton = useCallback((onPress: () => void, label?: string) => (
    <HapticTouchable
      hapticDisabled
      style={styles.gamepadButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label || t('navigation.games')}
    >
      <Icon name="gamepad" size={28} color={themeConst.textOnPrimary} />
    </HapticTouchable>
  ), [t]);

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
              icon="grid"
              title={t('navigation.memory')}
              skipSafeArea
              rightAccessory={renderGamepadButton(onBack)}
            />
          }
          controlsBlock={<></>}
          contentBlock={
            <View style={styles.menuContent}>
              <View style={[styles.menuCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                <Text style={[styles.menuTitle, { color: themeColors.textPrimary }]}>
                  {t('games.memory.title')}
                </Text>
                <Text style={[styles.menuDescription, { color: themeColors.textSecondary }]}>
                  {t('games.memory.howToPlay')}
                </Text>

                {/* Difficulty picker */}
                <Text style={[styles.difficultyLabel, { color: themeColors.textPrimary }]}>
                  {t('games.lobby.difficulty')}
                </Text>
                <DifficultyPicker
                  selected={difficulty}
                  onSelect={setDifficulty}
                  options={DIFFICULTY_OPTIONS.map(o => ({ ...o, label: t(o.label) }))}
                  moduleId={MODULE_ID}
                />

                <View style={{ height: spacing.lg }} />

                <HapticTouchable
                  onPress={handleStartGame}
                  hapticType="success"
                  style={[styles.startButton, { backgroundColor: moduleColor }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('games.lobby.newGame')}
                >
                  <Icon name="play" size={24} color="#FFFFFF" />
                  <Text style={styles.startButtonText}>{t('games.lobby.newGame')}</Text>
                </HapticTouchable>
              </View>

              {/* Stats toggle */}
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

              {showStats && <GameStatsView gameType="memory" moduleId={MODULE_ID} />}
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
            icon="grid"
            title={t('navigation.memory')}
            skipSafeArea
            rightAccessory={renderGamepadButton(handleQuit, t('games.common.quit'))}
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
            {/* Info bar */}
            <View style={styles.infoBar}>
              <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
                {t('games.memory.moves')}: {gameState?.moveCount ?? 0}
              </Text>
              <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
                {t('games.memory.pairsFound')}: {gameState?.matchedPairs ?? 0}/{gameState?.totalPairs ?? 0}
              </Text>
            </View>

            {/* Match result indicator */}
            {lastMatchResult !== null && (
              <View style={[
                styles.matchIndicator,
                {
                  backgroundColor: lastMatchResult
                    ? themeConst.successBackground || '#E8F5E9'
                    : themeConst.errorBackground,
                },
              ]}>
                <Text style={[
                  styles.matchIndicatorText,
                  { color: lastMatchResult ? '#1B5E20' : themeConst.error },
                ]}>
                  {lastMatchResult ? `✅ ${t('games.memory.matchFound')}` : `❌ ${t('games.memory.noMatch')}`}
                </Text>
              </View>
            )}

            {/* Card grid */}
            <View style={styles.gridContainer}>
              {gameState && Array.from({ length: gameState.gridRows }).map((_, rowIndex) => (
                <View key={rowIndex} style={styles.gridRow}>
                  {Array.from({ length: gameState.gridCols }).map((_, colIndex) => {
                    const cardIndex = rowIndex * gameState.gridCols + colIndex;
                    const card = gameState.cards[cardIndex];
                    if (!card) return null;

                    return (
                      <MemoryCardView
                        key={cardIndex}
                        card={card}
                        size={cardSize}
                        moduleColor={moduleColor}
                        themeColors={themeColors}
                        onPress={() => handleCardFlip(cardIndex)}
                        disabled={card.isFlipped || card.isMatched || gameState.isCheckingMatch}
                        faceDownLabel={t('games.memory.card')}
                      />
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
            ? gameState.moveCount === gameState.totalPairs
              ? t('games.memory.perfectGame')
              : t('games.common.congratulations')
            : t('games.common.gameOver')
          }
          score={calculateScore(gameState, durationSeconds)}
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
// MemoryCardView Sub-component
// ============================================================

interface MemoryCardViewProps {
  card: MemoryCard;
  size: number;
  moduleColor: string;
  themeColors: ReturnType<typeof useColors>;
  onPress: () => void;
  disabled: boolean;
  faceDownLabel: string;
}

function MemoryCardView({ card, size, moduleColor, themeColors, onPress, disabled, faceDownLabel }: MemoryCardViewProps) {
  if (card.isMatched) {
    // Matched card: show emoji with lower opacity
    return (
      <View style={[
        styles.card,
        {
          width: size,
          height: size,
          backgroundColor: '#E8F5E9',
          borderColor: '#81C784',
          opacity: 0.6,
        },
      ]}>
        <Text style={[styles.cardEmoji, { fontSize: size * 0.45 }]}>
          {card.emoji}
        </Text>
      </View>
    );
  }

  if (card.isFlipped) {
    // Flipped card: show emoji
    return (
      <View style={[
        styles.card,
        {
          width: size,
          height: size,
          backgroundColor: '#FFFFFF',
          borderColor: moduleColor,
          borderWidth: 2,
        },
      ]}>
        <Text style={[styles.cardEmoji, { fontSize: size * 0.45 }]}>
          {card.emoji}
        </Text>
      </View>
    );
  }

  // Face-down card: show back
  return (
    <HapticTouchable
      onPress={onPress}
      hapticType="tap"
      disabled={disabled}
      style={[
        styles.card,
        {
          width: size,
          height: size,
          backgroundColor: moduleColor,
          borderColor: moduleColor,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={faceDownLabel}
    >
      <Text style={[styles.cardBackSymbol, { fontSize: size * 0.35 }]}>?</Text>
    </HapticTouchable>
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
  difficultyLabel: {
    ...typography.bodyBold,
    marginBottom: spacing.sm,
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
    paddingTop: spacing.xs,
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  infoText: {
    ...typography.label,
  },
  matchIndicator: {
    marginHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  matchIndicatorText: {
    ...typography.body,
    fontWeight: '600',
  },
  // Grid
  gridContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: CARD_GAP,
    paddingHorizontal: GRID_PADDING,
  },
  gridRow: {
    flexDirection: 'row',
    gap: CARD_GAP,
  },
  // Card
  card: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardEmoji: {
    textAlign: 'center',
  },
  cardBackSymbol: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  gamepadButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
