/**
 * SolitaireScreen — Klondike Solitaire card game
 *
 * Senior-inclusive design:
 * - Tap-to-select, tap-to-place (no drag-and-drop)
 * - Large card sizes (minimum 50×70pt)
 * - Color + symbol for suit (♠♣♥♦) — not color-only
 * - Clear selection highlight with accent border
 * - Hint and auto-complete buttons
 *
 * @see src/engines/solitaire/engine.ts
 * @see src/types/games.ts
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, Alert, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

import { getCardImage } from '@/assets/cards';

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
  drawFromStock,
  selectCard,
  moveCards,
  autoComplete,
  canAutoComplete,
  findHint,
  findBestMoveForCard,
  calculateScore,
  getStarRating,
  SUIT_SYMBOLS,
  RANK_LABELS,
  type SolitaireState,
  type Card,
  type PileLocation,
} from '@/engines/solitaire/engine';

// ============================================================
// Constants
// ============================================================

const MODULE_ID: ModuleColorId = 'solitaire' as ModuleColorId;
const SCREEN_WIDTH = Dimensions.get('window').width;
const STORAGE_KEY_AUTO_MOVE = '@commeazy/solitaire_autoMove';

// Card sizing — maximized to fill screen width without scrolling
const CARD_GAP = 2;
const TABLEAU_PADDING = 4;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - TABLEAU_PADDING * 2 - CARD_GAP * 6) / 7);
const CARD_HEIGHT = Math.floor(CARD_WIDTH * 1.4);
const STACK_OVERLAP = Math.floor(CARD_HEIGHT * 0.25); // Vertical overlap for tableau stacks

// ============================================================
// Types
// ============================================================

interface SolitaireScreenProps {
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

export function SolitaireScreen({ onBack }: SolitaireScreenProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor(MODULE_ID);

  // Game session
  const {
    durationSeconds,
    startSession,
    completeGame,
    abandonGame,
  } = useGameSession({ gameType: 'solitaire' });

  // Game state
  const [gameState, setGameState] = useState<SolitaireState | null>(null);
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [difficulty, setDifficulty] = useState<GameDifficulty>('easy');
  const [showStats, setShowStats] = useState(false);
  const [hintLocation, setHintLocation] = useState<PileLocation | null>(null);
  const [autoMoveEnabled, setAutoMoveEnabled] = useState(true); // Default: ON
  const [flashLocation, setFlashLocation] = useState<PileLocation | null>(null);
  const flashAnim = useRef(new Animated.Value(1)).current;

  // Load auto-move setting from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_AUTO_MOVE).then(value => {
      if (value !== null) setAutoMoveEnabled(value === 'true');
    });
  }, []);

  // Toggle auto-move setting
  const handleToggleAutoMove = useCallback(() => {
    setAutoMoveEnabled(prev => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY_AUTO_MOVE, String(next));
      return next;
    });
  }, []);

  // Flash animation for "no valid move"
  const triggerFlash = useCallback((location: PileLocation) => {
    setFlashLocation(location);
    flashAnim.setValue(1);
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 0.3, duration: 100, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0.3, duration: 100, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start(() => setFlashLocation(null));
  }, [flashAnim]);

  // Foundation count
  const foundationCount = useMemo(() => {
    if (!gameState) return 0;
    return gameState.foundations.reduce((sum, f) => sum + f.length, 0);
  }, [gameState]);

  // Start new game
  const handleStartGame = useCallback(async () => {
    const state = createInitialState(difficulty);
    setGameState(state);
    setPhase('playing');
    setHintLocation(null);
    await startSession({
      gameType: 'solitaire',
      mode: 'solo',
      difficulty,
      players: [],
    });
  }, [difficulty, startSession]);

  // Draw from stock
  const handleDrawStock = useCallback(() => {
    if (!gameState) return;
    setHintLocation(null);
    const newState = drawFromStock(gameState);
    setGameState(newState);
  }, [gameState]);

  // Handle card/pile tap
  const handleCardTap = useCallback((location: PileLocation) => {
    if (!gameState || gameState.isComplete) return;
    setHintLocation(null);

    // Auto-move mode: find best destination and execute directly
    if (autoMoveEnabled && location.pile !== 'foundation') {
      const bestDest = findBestMoveForCard(gameState, location);
      if (bestDest) {
        const moved = moveCards(gameState, location, bestDest);
        if (moved) {
          setGameState(moved);
          if (moved.isComplete && moved.isWon) {
            const score = calculateScore(moved, durationSeconds);
            completeGame(score, true);
            setPhase('gameover');
          }
          return;
        }
      }
      // No valid move — flash the card
      triggerFlash(location);
      return;
    }

    // Standard two-tap mode
    const newState = selectCard(gameState, location);
    setGameState(newState);

    // Check win after move
    if (newState.isComplete && newState.isWon) {
      const score = calculateScore(newState, durationSeconds);
      completeGame(score, true);
      setPhase('gameover');
    }
  }, [gameState, durationSeconds, completeGame, autoMoveEnabled, triggerFlash]);

  // Auto-complete
  const handleAutoComplete = useCallback(() => {
    if (!gameState) return;
    const result = autoComplete(gameState);
    if (result) {
      setGameState(result);
      if (result.isWon) {
        const score = calculateScore(result, durationSeconds);
        completeGame(score, true);
        setPhase('gameover');
      }
    }
  }, [gameState, durationSeconds, completeGame]);

  // Hint
  const handleHint = useCallback(() => {
    if (!gameState) return;
    const hint = findHint(gameState);
    if (hint) {
      setHintLocation(hint.from);
      // Auto-clear hint after 2s
      setTimeout(() => setHintLocation(null), 2000);
    }
  }, [gameState]);

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
            abandonGame();
            setPhase('menu');
            setGameState(null);
          },
        },
      ],
    );
  }, [t, abandonGame]);

  // Play again / back to lobby
  const handlePlayAgain = useCallback(() => { handleStartGame(); }, [handleStartGame]);
  const handleBackToLobby = useCallback(() => { setPhase('menu'); setGameState(null); }, []);

  // Game over stats
  const gameOverStats: GameOverStat[] = useMemo(() => {
    if (!gameState) return [];
    return [
      { label: t('games.solitaire.movesCount'), value: `${gameState.moveCount}` },
      { label: t('games.common.time'), value: formatTime(durationSeconds) },
      ...(gameState.isWon ? [{
        label: t('games.woordraad.stars'),
        value: '⭐'.repeat(getStarRating(gameState) || 0),
        isHighlight: true,
      }] : []),
    ];
  }, [gameState, durationSeconds, t]);

  // Check if location matches hint
  const isHinted = useCallback((pile: string, pileIndex: number, cardIndex: number): boolean => {
    if (!hintLocation) return false;
    return hintLocation.pile === pile && hintLocation.pileIndex === pileIndex && hintLocation.cardIndex === cardIndex;
  }, [hintLocation]);

  // Check if location matches selection
  const isSelected = useCallback((pile: string, pileIndex: number, cardIndex: number): boolean => {
    if (!gameState?.selectedLocation) return false;
    const sel = gameState.selectedLocation;
    if (sel.pile !== pile || sel.pileIndex !== pileIndex) return false;
    if (pile === 'tableau') return cardIndex >= sel.cardIndex;
    return sel.cardIndex === cardIndex;
  }, [gameState?.selectedLocation]);

  // Check if location is flashing (no valid auto-move)
  const isFlashing = useCallback((pile: string, pileIndex: number, cardIndex: number): boolean => {
    if (!flashLocation) return false;
    return flashLocation.pile === pile && flashLocation.pileIndex === pileIndex && flashLocation.cardIndex === cardIndex;
  }, [flashLocation]);

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
              icon="list"
              title={t('navigation.solitaire')}
              skipSafeArea
              showGridButton={false}
              rightAccessory={renderGamepadButton(onBack)}
            />
          }
          controlsBlock={<></>}
          contentBlock={
            <View style={styles.menuContent}>
              <View style={[styles.menuCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                <Text style={[styles.menuTitle, { color: themeColors.textPrimary }]}>
                  {t('games.solitaire.title')}
                </Text>
                <Text style={[styles.menuDescription, { color: themeColors.textSecondary }]}>
                  {t('games.solitaire.howToPlay')}
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

                <View style={{ height: spacing.md }} />

                {/* Auto-move toggle */}
                <HapticTouchable
                  onPress={handleToggleAutoMove}
                  style={styles.autoMoveRow}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: autoMoveEnabled }}
                  accessibilityLabel={t('games.solitaire.autoMove')}
                >
                  <Text style={[styles.autoMoveLabel, { color: themeColors.textPrimary }]}>
                    {t('games.solitaire.autoMove')}
                  </Text>
                  <View style={[
                    styles.toggleTrack,
                    { backgroundColor: autoMoveEnabled ? moduleColor : themeColors.border },
                  ]}>
                    <View style={[
                      styles.toggleThumb,
                      { transform: [{ translateX: autoMoveEnabled ? 22 : 2 }] },
                    ]} />
                  </View>
                </HapticTouchable>

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

              {showStats && <GameStatsView gameType="solitaire" moduleId={MODULE_ID} />}
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
            icon="list"
            title={t('navigation.solitaire')}
            skipSafeArea
            showGridButton={false}
            rightAccessory={renderGamepadButton(handleQuit, t('games.common.quit'))}
          />
        }
        controlsBlock={
          <GameHeader
            moduleId={MODULE_ID}
            showTimer
            timer={durationSeconds}
            actions={[
              ...(gameState && canAutoComplete(gameState) ? [{
                icon: 'checkmark-circle' as const,
                label: t('games.solitaire.autoComplete'),
                onPress: handleAutoComplete,
              }] : []),
              {
                icon: 'star' as const,
                label: t('games.solitaire.hint'),
                onPress: handleHint,
              },
            ]}
          />
        }
        contentBlock={
          <View style={styles.gameContent}>
            {/* Info bar */}
            <View style={styles.infoBar}>
              <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
                {t('games.solitaire.movesCount')}: {gameState?.moveCount ?? 0}
              </Text>
              <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
                {t('games.solitaire.foundation')}: {foundationCount}/52
              </Text>
            </View>

            {/* Top row: Stock + Waste + Foundations */}
            <View style={styles.topRow}>
              {/* Stock pile */}
              <HapticTouchable
                onPress={handleDrawStock}
                hapticType="tap"
                style={[
                  styles.cardSlot,
                  {
                    borderColor: themeColors.border,
                    backgroundColor: gameState && gameState.stock.length > 0
                      ? moduleColor + '30'
                      : themeColors.surface,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('games.solitaire.stock')}
              >
                {gameState && gameState.stock.length > 0 ? (
                  <CardBackView moduleColor={moduleColor} />
                ) : (
                  <Icon
                    name="refresh"
                    size={24}
                    color={gameState?.canRecycleStock ? moduleColor : themeColors.textTertiary}
                  />
                )}
              </HapticTouchable>

              {/* Waste pile */}
              <HapticTouchable
                onPress={() => {
                  if (gameState && gameState.waste.length > 0) {
                    handleCardTap({ pile: 'waste', pileIndex: 0, cardIndex: gameState.waste.length - 1 });
                  }
                }}
                hapticType="tap"
                style={[
                  styles.cardSlot,
                  {
                    borderColor: isSelected('waste', 0, (gameState?.waste.length ?? 1) - 1) ? moduleColor : themeColors.border,
                    borderWidth: isSelected('waste', 0, (gameState?.waste.length ?? 1) - 1) ? 3 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('games.solitaire.waste')}
              >
                {gameState && gameState.waste.length > 0 ? (
                  <Animated.View style={[
                    { width: '100%', height: '100%' },
                    isFlashing('waste', 0, gameState.waste.length - 1) && { opacity: flashAnim },
                  ]}>
                    <CardView
                      card={gameState.waste[gameState.waste.length - 1]}
                      moduleColor={moduleColor}
                      themeColors={themeColors}
                      isHinted={isHinted('waste', 0, gameState.waste.length - 1)}
                    />
                  </Animated.View>
                ) : null}
              </HapticTouchable>

              {/* Spacer */}
              <View style={{ width: CARD_GAP * 2 }} />

              {/* Foundation piles */}
              {gameState?.foundations.map((foundation, fi) => (
                <HapticTouchable
                  key={fi}
                  onPress={() => handleCardTap({ pile: 'foundation', pileIndex: fi, cardIndex: Math.max(0, foundation.length - 1) })}
                  hapticType="tap"
                  style={[
                    styles.cardSlot,
                    {
                      borderColor: themeColors.border,
                      backgroundColor: themeColors.surface,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('games.solitaire.foundation')} ${fi + 1}`}
                >
                  {foundation.length > 0 ? (
                    <CardView
                      card={foundation[foundation.length - 1]}
                      moduleColor={moduleColor}
                      themeColors={themeColors}
                      isHinted={false}
                    />
                  ) : (
                    <Text style={[styles.emptyPileText, { color: themeColors.textTertiary }]}>A</Text>
                  )}
                </HapticTouchable>
              ))}
            </View>

            {/* Tableau */}
            <View style={styles.tableauContainer}>
              {gameState?.tableau.map((column, colIndex) => (
                <View key={colIndex} style={styles.tableauColumn}>
                  {column.length === 0 ? (
                    <HapticTouchable
                      onPress={() => handleCardTap({ pile: 'tableau', pileIndex: colIndex, cardIndex: 0 })}
                      hapticType="tap"
                      style={[styles.cardSlot, { borderColor: themeColors.border, borderStyle: 'dashed' }]}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('games.solitaire.tableau')} ${colIndex + 1}`}
                    >
                      <Text style={[styles.emptyPileText, { color: themeColors.textTertiary }]}>K</Text>
                    </HapticTouchable>
                  ) : (
                    column.map((card, cardIndex) => (
                      <HapticTouchable
                        key={cardIndex}
                        onPress={() => {
                          if (card.faceUp) {
                            handleCardTap({ pile: 'tableau', pileIndex: colIndex, cardIndex });
                          }
                        }}
                        hapticType="tap"
                        disabled={!card.faceUp}
                        style={[
                          styles.tableauCard,
                          cardIndex > 0 && { marginTop: -CARD_HEIGHT + STACK_OVERLAP },
                          {
                            borderColor: isSelected('tableau', colIndex, cardIndex) ? moduleColor : 'transparent',
                            borderWidth: isSelected('tableau', colIndex, cardIndex) ? 3 : 0,
                            borderRadius: borderRadius.sm,
                            zIndex: cardIndex,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={
                          card.faceUp
                            ? `${RANK_LABELS[card.rank]} ${SUIT_SYMBOLS[card.suit]}`
                            : t('games.solitaire.faceDown')
                        }
                      >
                        {card.faceUp ? (
                          <Animated.View style={[
                            { width: '100%', height: '100%' },
                            isFlashing('tableau', colIndex, cardIndex) && { opacity: flashAnim },
                          ]}>
                            <CardView
                              card={card}
                              moduleColor={moduleColor}
                              themeColors={themeColors}
                              isHinted={isHinted('tableau', colIndex, cardIndex)}
                            />
                          </Animated.View>
                        ) : (
                          <CardBackView moduleColor={moduleColor} />
                        )}
                      </HapticTouchable>
                    ))
                  )}
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
// CardView Sub-component — Traditional playing card design
// ============================================================

interface CardViewProps {
  card: Card;
  moduleColor: string;
  themeColors: ReturnType<typeof useColors>;
  isHinted: boolean;
}

function CardView({ card, moduleColor, themeColors: _themeColors, isHinted }: CardViewProps) {
  return (
    <View style={[
      styles.cardFace,
      {
        borderColor: isHinted ? moduleColor : 'transparent',
        borderWidth: isHinted ? 3 : 0,
      },
    ]}>
      <Image
        source={getCardImage(card.suit, card.rank)}
        style={styles.cardImage}
        resizeMode="contain"
      />
    </View>
  );
}

// ============================================================
// CardBackView — Traditional diamond pattern
// ============================================================

function CardBackView({ moduleColor }: { moduleColor: string }) {
  return (
    <View style={[styles.cardBack, { backgroundColor: moduleColor }]}>
      <View style={styles.cardBackInner}>
        <Svg width="100%" height="100%" viewBox="0 0 40 56">
          {/* White border inset */}
          <Rect x="2" y="2" width="36" height="52" rx="2" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity={0.5} />
          {/* Diamond pattern */}
          {[0, 1, 2, 3, 4, 5, 6].map(row =>
            [0, 1, 2, 3].map(col => (
              <Path
                key={`${row}-${col}`}
                d={`M${6 + col * 8},${6 + row * 7} l3,-3.5 l3,3.5 l-3,3.5 z`}
                fill="#FFFFFF"
                opacity={0.3}
              />
            ))
          )}
          {/* Center ornament */}
          <Circle cx="20" cy="28" r="6" fill="#FFFFFF" opacity={0.25} />
          <Circle cx="20" cy="28" r="3" fill="#FFFFFF" opacity={0.35} />
        </Svg>
      </View>
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
  // Top row
  topRow: {
    flexDirection: 'row',
    paddingHorizontal: TABLEAU_PADDING,
    gap: CARD_GAP,
    marginBottom: spacing.sm,
  },
  cardSlot: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  emptyPileText: {
    fontSize: 20,
    fontWeight: '700',
  },
  cardBack: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  cardBackInner: {
    flex: 1,
    margin: 2,
    borderRadius: borderRadius.sm - 1,
    overflow: 'hidden',
  },
  cardFace: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  // Tableau
  tableauContainer: {
    flexDirection: 'row',
    paddingHorizontal: TABLEAU_PADDING,
    gap: CARD_GAP,
    flex: 1,
  },
  tableauColumn: {
    width: CARD_WIDTH,
  },
  tableauCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    overflow: 'hidden',
  },
  gamepadButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Auto-move toggle
  autoMoveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTargets.minimum,
    paddingVertical: spacing.sm,
  },
  autoMoveLabel: {
    ...typography.body,
    flex: 1,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
});
