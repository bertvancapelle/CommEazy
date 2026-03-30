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
import Svg, { Path, Rect, G, Circle } from 'react-native-svg';

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

// Card sizing — maximized to fill screen width without scrolling
const CARD_GAP = 2;
const TABLEAU_PADDING = 4;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - TABLEAU_PADDING * 2 - CARD_GAP * 6) / 7);
const CARD_HEIGHT = Math.floor(CARD_WIDTH * 1.4);
const STACK_OVERLAP = Math.floor(CARD_HEIGHT * 0.25); // Vertical overlap for tableau stacks

// Card corner text sizing — proportional to card width
const CORNER_RANK_SIZE = Math.max(Math.floor(CARD_WIDTH * 0.28), 13);
const CORNER_SUIT_SIZE = Math.max(Math.floor(CARD_WIDTH * 0.22), 11);
const CENTER_PIP_SIZE = Math.max(Math.floor(CARD_WIDTH * 0.28), 13);

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
                  <CardView
                    card={gameState.waste[gameState.waste.length - 1]}
                    moduleColor={moduleColor}
                    themeColors={themeColors}
                    isHinted={isHinted('waste', 0, gameState.waste.length - 1)}
                  />
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
                          <CardView
                            card={card}
                            moduleColor={moduleColor}
                            themeColors={themeColors}
                            isHinted={isHinted('tableau', colIndex, cardIndex)}
                          />
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

function CardView({ card, moduleColor, themeColors, isHinted }: CardViewProps) {
  const suitColor = isRedSuit(card.suit) ? '#C62828' : '#1A1A1A';
  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const rankLabel = RANK_LABELS[card.rank];
  const isFaceCard = card.rank >= 11 && card.rank <= 13;
  const isAce = card.rank === 1;

  return (
    <View style={[
      styles.cardFace,
      {
        backgroundColor: '#FFFFFF',
        borderColor: isHinted ? moduleColor : '#D0D0D0',
        borderWidth: isHinted ? 3 : 1,
      },
    ]}>
      {/* Top-left corner: rank + suit */}
      <View style={styles.cornerTL}>
        <Text style={[styles.cornerRank, { color: suitColor }]}>{rankLabel}</Text>
        <Text style={[styles.cornerSuit, { color: suitColor }]}>{suitSymbol}</Text>
      </View>

      {/* Bottom-right corner: rank + suit (rotated) */}
      <View style={styles.cornerBR}>
        <Text style={[styles.cornerRank, { color: suitColor }]}>{rankLabel}</Text>
        <Text style={[styles.cornerSuit, { color: suitColor }]}>{suitSymbol}</Text>
      </View>

      {/* Center content */}
      <View style={styles.cardCenter}>
        {isAce ? (
          <Text style={[styles.aceSuit, { color: suitColor }]}>{suitSymbol}</Text>
        ) : isFaceCard ? (
          <FaceCardArt rank={card.rank} suit={card.suit} suitColor={suitColor} />
        ) : (
          <PipLayout rank={card.rank} suitSymbol={suitSymbol} suitColor={suitColor} />
        )}
      </View>
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
// PipLayout — Suit symbols arranged like real playing cards
// ============================================================

// Standard pip positions for cards 2-10 (x: 0=left, 1=center, 2=right; y: 0-4 top to bottom)
const PIP_LAYOUTS: Record<number, Array<[number, number]>> = {
  2: [[1,0],[1,4]],
  3: [[1,0],[1,2],[1,4]],
  4: [[0,0],[2,0],[0,4],[2,4]],
  5: [[0,0],[2,0],[1,2],[0,4],[2,4]],
  6: [[0,0],[2,0],[0,2],[2,2],[0,4],[2,4]],
  7: [[0,0],[2,0],[1,1],[0,2],[2,2],[0,4],[2,4]],
  8: [[0,0],[2,0],[1,1],[0,2],[2,2],[1,3],[0,4],[2,4]],
  9: [[0,0],[2,0],[0,1.3],[2,1.3],[1,2],[0,2.7],[2,2.7],[0,4],[2,4]],
  10: [[0,0],[2,0],[1,0.7],[0,1.3],[2,1.3],[0,2.7],[2,2.7],[1,3.3],[0,4],[2,4]],
};

function PipLayout({ rank, suitSymbol, suitColor }: { rank: number; suitSymbol: string; suitColor: string }) {
  const pips = PIP_LAYOUTS[rank];
  if (!pips) return null;

  return (
    <View style={styles.pipContainer}>
      {pips.map(([col, row], i) => (
        <Text
          key={i}
          style={[
            styles.pip,
            {
              color: suitColor,
              left: col === 0 ? '10%' : col === 1 ? '38%' : '66%',
              top: `${(row / 4) * 85 + 2}%`,
              transform: row > 2 ? [{ rotate: '180deg' }] : [],
            },
          ]}
        >
          {suitSymbol}
        </Text>
      ))}
    </View>
  );
}

// ============================================================
// FaceCardArt — SVG artwork for J, Q, K
// ============================================================

function FaceCardArt({ rank, suit, suitColor }: { rank: number; suit: Suit; suitColor: string }) {
  const artSize = Math.floor(CARD_WIDTH * 0.6);
  const isRed = suit === 'hearts' || suit === 'diamonds';
  const primary = suitColor;
  const secondary = isRed ? '#FFD54F' : '#90CAF9'; // Gold trim for red, silver-blue for black
  const tertiary = isRed ? '#E65100' : '#1565C0';  // Deeper accent

  // Simplified traditional figure: crown area + body + suit accent
  return (
    <Svg width={artSize} height={artSize} viewBox="0 0 32 32">
      {rank === 11 && (
        /* Jack — young figure with feathered hat */
        <G>
          {/* Hat */}
          <Path d="M10,8 L16,3 L22,8 L20,9 L16,6 L12,9 Z" fill={secondary} />
          <Path d="M22,8 L24,5 L23,8 Z" fill={primary} opacity={0.7} />
          {/* Face */}
          <Circle cx="16" cy="13" r="4.5" fill="#FFE0B2" />
          {/* Eyes */}
          <Circle cx="14.5" cy="12.5" r="0.7" fill={primary} />
          <Circle cx="17.5" cy="12.5" r="0.7" fill={primary} />
          {/* Body / tunic */}
          <Path d="M10,17 L12,15 L16,17 L20,15 L22,17 L22,28 L10,28 Z" fill={primary} />
          {/* Belt / sash */}
          <Rect x="10" y="21" width="12" height="2" fill={secondary} />
          {/* Suit emblem on chest */}
          <SuitEmblem suit={suit} cx={16} cy={19} size={3} />
        </G>
      )}
      {rank === 12 && (
        /* Queen — figure with crown and flower */
        <G>
          {/* Crown */}
          <Path d="M10,9 L12,4 L14,7 L16,3 L18,7 L20,4 L22,9 Z" fill={secondary} />
          {/* Crown jewels */}
          <Circle cx="16" cy="5.5" r="1" fill={tertiary} />
          <Circle cx="12.5" cy="6.5" r="0.7" fill={tertiary} />
          <Circle cx="19.5" cy="6.5" r="0.7" fill={tertiary} />
          {/* Face */}
          <Circle cx="16" cy="13" r="4.5" fill="#FFE0B2" />
          {/* Eyes */}
          <Circle cx="14.5" cy="12.5" r="0.7" fill={primary} />
          <Circle cx="17.5" cy="12.5" r="0.7" fill={primary} />
          {/* Lips */}
          <Path d="M14.5,14.5 Q16,16 17.5,14.5" stroke="#E57373" strokeWidth="0.5" fill="none" />
          {/* Dress */}
          <Path d="M9,17 L12,15 L16,16.5 L20,15 L23,17 L24,28 L8,28 Z" fill={primary} />
          {/* Necklace */}
          <Path d="M12,17 Q16,19 20,17" stroke={secondary} strokeWidth="1" fill="none" />
          {/* Suit emblem */}
          <SuitEmblem suit={suit} cx={16} cy={22} size={3} />
        </G>
      )}
      {rank === 13 && (
        /* King — figure with grand crown and scepter */
        <G>
          {/* Crown */}
          <Path d="M9,9 L11,3 L13.5,7 L16,2 L18.5,7 L21,3 L23,9 Z" fill={secondary} />
          {/* Crown band */}
          <Rect x="9" y="8" width="14" height="2" rx="0.5" fill={tertiary} />
          {/* Crown jewels */}
          <Circle cx="16" cy="4.5" r="1.2" fill={tertiary} />
          <Circle cx="12" cy="5.5" r="0.8" fill="#E57373" />
          <Circle cx="20" cy="5.5" r="0.8" fill="#E57373" />
          {/* Face */}
          <Circle cx="16" cy="14" r="4.5" fill="#FFE0B2" />
          {/* Eyes */}
          <Circle cx="14.5" cy="13.5" r="0.7" fill={primary} />
          <Circle cx="17.5" cy="13.5" r="0.7" fill={primary} />
          {/* Beard */}
          <Path d="M12.5,16 Q16,20 19.5,16" fill="#8D6E63" opacity={0.6} />
          {/* Robe */}
          <Path d="M8,18 L12,16 L16,17.5 L20,16 L24,18 L25,28 L7,28 Z" fill={primary} />
          {/* Ermine trim */}
          <Path d="M8,18 L24,18" stroke="#FFFFFF" strokeWidth="1.5" />
          {/* Suit emblem */}
          <SuitEmblem suit={suit} cx={16} cy={23} size={3.5} />
        </G>
      )}
    </Svg>
  );
}

// Small suit emblem used on face card bodies
function SuitEmblem({ suit, cx, cy, size }: { suit: Suit; cx: number; cy: number; size: number }) {
  const color = isRedSuit(suit) ? '#C62828' : '#1A1A1A';
  const s = size;

  switch (suit) {
    case 'hearts':
      return (
        <Path
          d={`M${cx},${cy + s * 0.4} C${cx - s * 0.6},${cy - s * 0.3} ${cx - s},${cy - s * 0.7} ${cx},${cy - s * 0.15} C${cx + s},${cy - s * 0.7} ${cx + s * 0.6},${cy - s * 0.3} ${cx},${cy + s * 0.4}`}
          fill={color}
        />
      );
    case 'diamonds':
      return (
        <Path
          d={`M${cx},${cy - s * 0.5} L${cx + s * 0.35},${cy} L${cx},${cy + s * 0.5} L${cx - s * 0.35},${cy} Z`}
          fill={color}
        />
      );
    case 'clubs':
      return (
        <G>
          <Circle cx={cx} cy={cy - s * 0.25} r={s * 0.25} fill={color} />
          <Circle cx={cx - s * 0.25} cy={cy + s * 0.1} r={s * 0.25} fill={color} />
          <Circle cx={cx + s * 0.25} cy={cy + s * 0.1} r={s * 0.25} fill={color} />
          <Path d={`M${cx},${cy + s * 0.1} L${cx - s * 0.1},${cy + s * 0.45} L${cx + s * 0.1},${cy + s * 0.45} Z`} fill={color} />
        </G>
      );
    case 'spades':
      return (
        <G>
          <Path
            d={`M${cx},${cy - s * 0.45} C${cx - s * 0.6},${cy + s * 0.1} ${cx - s},${cy - s * 0.15} ${cx},${cy + s * 0.2} C${cx + s},${cy - s * 0.15} ${cx + s * 0.6},${cy + s * 0.1} ${cx},${cy - s * 0.45}`}
            fill={color}
          />
          <Path d={`M${cx},${cy + s * 0.15} L${cx - s * 0.1},${cy + s * 0.45} L${cx + s * 0.1},${cy + s * 0.45} Z`} fill={color} />
        </G>
      );
  }
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
    position: 'relative',
  },
  cornerTL: {
    position: 'absolute',
    top: 1,
    left: 2,
    alignItems: 'center',
  },
  cornerBR: {
    position: 'absolute',
    bottom: 1,
    right: 2,
    alignItems: 'center',
    transform: [{ rotate: '180deg' }],
  },
  cornerRank: {
    fontSize: CORNER_RANK_SIZE,
    fontWeight: '800',
    lineHeight: CORNER_RANK_SIZE + 1,
    includeFontPadding: false,
  },
  cornerSuit: {
    fontSize: CORNER_SUIT_SIZE,
    lineHeight: CORNER_SUIT_SIZE + 1,
    includeFontPadding: false,
    marginTop: -1,
  },
  cardCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aceSuit: {
    fontSize: Math.floor(CARD_WIDTH * 0.5),
    lineHeight: Math.floor(CARD_WIDTH * 0.55),
  },
  pipContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  pip: {
    position: 'absolute',
    fontSize: CENTER_PIP_SIZE,
    lineHeight: CENTER_PIP_SIZE + 2,
    includeFontPadding: false,
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
});
