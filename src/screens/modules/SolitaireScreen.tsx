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

import React, { useState, useCallback, useMemo } from 'react';
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
  drawFromStock,
  selectCard,
  moveCards,
  autoComplete,
  canAutoComplete,
  findHint,
  calculateScore,
  getStarRating,
  SUIT_SYMBOLS,
  RANK_LABELS,
  type SolitaireState,
  type Card,
  type PileLocation,
  type Suit,
} from '@/engines/solitaire/engine';

// ============================================================
// Constants
// ============================================================

const MODULE_ID: ModuleColorId = 'solitaire' as ModuleColorId;
const SCREEN_WIDTH = Dimensions.get('window').width;

// Card sizing
const CARD_GAP = 4;
const TABLEAU_PADDING = spacing.sm;
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

    const newState = selectCard(gameState, location);
    setGameState(newState);

    // Check win after move
    if (newState.isComplete && newState.isWon) {
      const score = calculateScore(newState, durationSeconds);
      completeGame(score, true);
      setPhase('gameover');
    }
  }, [gameState, durationSeconds, completeGame]);

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
              icon="layers"
              title={t('navigation.solitaire')}
              showBackButton
              onBackPress={onBack}
              skipSafeArea
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
            icon="layers"
            title={t('navigation.solitaire')}
            showBackButton
            onBackPress={handleQuit}
            skipSafeArea
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
              {
                icon: 'close' as const,
                label: t('games.common.quit'),
                onPress: handleQuit,
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
                  <View style={[styles.cardBack, { backgroundColor: moduleColor }]}>
                    <Text style={styles.cardBackText}>🂠</Text>
                  </View>
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
                  <CardView
                    card={gameState.waste[gameState.waste.length - 1]}
                    moduleColor={moduleColor}
                    themeColors={themeColors}
                    isHinted={isHinted('waste', 0, gameState.waste.length - 1)}
                  />
                ) : null}
              </HapticTouchable>

              {/* Spacer */}
              <View style={{ width: CARD_WIDTH * 0.3 }} />

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
                          <CardView
                            card={card}
                            moduleColor={moduleColor}
                            themeColors={themeColors}
                            isHinted={isHinted('tableau', colIndex, cardIndex)}
                          />
                        ) : (
                          <View style={[styles.cardBack, { backgroundColor: moduleColor }]}>
                            <Text style={styles.cardBackText}>🂠</Text>
                          </View>
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
// CardView Sub-component
// ============================================================

interface CardViewProps {
  card: Card;
  moduleColor: string;
  themeColors: ReturnType<typeof useColors>;
  isHinted: boolean;
}

function CardView({ card, moduleColor, themeColors, isHinted }: CardViewProps) {
  const suitColor = isRedSuit(card.suit) ? '#C62828' : '#1A1A1A';

  return (
    <View style={[
      styles.cardFace,
      {
        backgroundColor: '#FFFFFF',
        borderColor: isHinted ? moduleColor : '#E0E0E0',
        borderWidth: isHinted ? 3 : 1,
      },
    ]}>
      <Text style={[styles.cardRank, { color: suitColor }]}>
        {RANK_LABELS[card.rank]}
      </Text>
      <Text style={[styles.cardSuit, { color: suitColor }]}>
        {SUIT_SYMBOLS[card.suit]}
      </Text>
    </View>
  );
}

function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBackText: {
    fontSize: 24,
  },
  cardFace: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.sm,
    padding: 3,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  cardRank: {
    fontSize: Math.max(CARD_WIDTH * 0.3, 14),
    fontWeight: '700',
    lineHeight: Math.max(CARD_WIDTH * 0.35, 16),
  },
  cardSuit: {
    fontSize: Math.max(CARD_WIDTH * 0.25, 12),
    lineHeight: Math.max(CARD_WIDTH * 0.3, 14),
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
});
