/**
 * WoordyScreen — Scrabble-like word game
 *
 * Senior-inclusive design:
 * - Tap-to-select + tap-to-place (no drag-and-drop)
 * - Large tiles (≥44pt with letter + value)
 * - Clear color coding for bonus fields
 * - Score preview before confirming
 * - Undo button to take back tiles
 * - No time pressure
 *
 * @see src/engines/woordy/engine.ts
 * @see src/types/games.ts
 * @see .claude/plans/WOORDY_DESIGN.md
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, borderRadius, touchTargets, typography, colors as themeConst } from '@/theme';
import { ModuleHeader, ModuleScreenLayout, HapticTouchable, Icon, ScrollViewWithIndicator } from '@/components';
import { GameHeader, GameOverModal, GameSoundPicker, GameSettingsAccordion } from '@/components/games';
import type { GameOverStat } from '@/components/games';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useGameSession } from '@/hooks/games/useGameSession';
import type { ModuleColorId } from '@/types/liquidGlass';

import {
  createInitialState,
  selectTile,
  placeTile,
  removePendingTile,
  confirmPlacement,
  passTurn,
  resignGame,
  validatePlacement,
  previewScore,
  calculateFinalScores,
  getWinner,
  getStarRating,
  serializeState,
} from '@/engines/woordy/engine';
import type { WoordyState, BoardCell, Tile } from '@/engines/woordy/types';
import { BOARD_SIZE } from '@/engines/woordy/types';

// ============================================================
// Constants
// ============================================================

const MODULE_ID: ModuleColorId = 'woordy' as ModuleColorId;

const CELL_SIZE = 38;
const RACK_TILE_SIZE = 48;

/** Colors for bonus fields */
const BONUS_COLORS: Record<string, string> = {
  DL: '#64B5F6',   // Light blue
  TL: '#1565C0',   // Dark blue
  DW: '#F48FB1',   // Pink
  TW: '#C62828',   // Red
  center: '#FFD54F', // Gold
  trivia: '#FFB300', // Amber (only when revealed)
  normal: 'transparent',
};

// ============================================================
// Types
// ============================================================

type GamePhase = 'menu' | 'playing';

interface WoordyScreenProps {
  onBack: () => void;
}

// ============================================================
// Component
// ============================================================

export function WoordyScreen({ onBack }: WoordyScreenProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor(MODULE_ID);

  const {
    durationSeconds,
    startSession,
    completeGame,
    abandonGame,
  } = useGameSession({ gameType: 'woordy' as any });

  // Phase management
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [gameState, setGameState] = useState<WoordyState | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);

  // ============================================================
  // Game Actions
  // ============================================================

  const handleStartGame = useCallback(() => {
    // Use app language for dictionary — for now default to 'nl'
    const state = createInitialState('nl');
    setGameState(state);
    setPhase('playing');
    startSession();
  }, [startSession]);

  const handleQuit = useCallback(() => {
    Alert.alert(
      t('games.woordy.quitTitle'),
      t('games.woordy.quitMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.quit'),
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

  const handleSelectRackTile = useCallback((tileId: string) => {
    setGameState((prev) => (prev ? selectTile(prev, tileId) : prev));
  }, []);

  const handleTapCell = useCallback((row: number, col: number) => {
    setGameState((prev) => {
      if (!prev) return prev;
      const cell = prev.board[row][col];

      // If tapping a tile placed this turn, remove it
      if (cell.tile && cell.tile.isCurrentTurn) {
        return removePendingTile(prev, { row, col });
      }

      // If a tile is selected from rack, place it
      if (prev.selectedTileId) {
        return placeTile(prev, { row, col });
      }

      return prev;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setGameState((prev) => {
      if (!prev) return prev;
      const validation = validatePlacement(prev);
      if (!validation.valid) {
        // Show error in next tick to avoid setState during render
        setTimeout(() => {
          Alert.alert(
            t('games.woordy.invalidWord'),
            t(`games.woordy.errors.${validation.error}`),
          );
        }, 0);
        return prev;
      }

      const newState = confirmPlacement(prev);

      if (newState.isComplete) {
        setTimeout(() => setShowGameOver(true), 500);
      }

      return newState;
    });
  }, [t]);

  const handlePass = useCallback(() => {
    Alert.alert(
      t('games.woordy.passTitle'),
      t('games.woordy.passMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('games.woordy.pass'),
          onPress: () => {
            setGameState((prev) => {
              if (!prev) return prev;
              const newState = passTurn(prev);
              if (newState.isComplete) {
                setTimeout(() => setShowGameOver(true), 500);
              }
              return newState;
            });
          },
        },
      ],
    );
  }, [t]);

  const handleResign = useCallback(() => {
    Alert.alert(
      t('games.woordy.resignTitle'),
      t('games.woordy.resignMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('games.woordy.resign'),
          style: 'destructive',
          onPress: () => {
            setGameState((prev) => {
              if (!prev) return prev;
              const newState = resignGame(prev);
              setTimeout(() => setShowGameOver(true), 500);
              return newState;
            });
          },
        },
      ],
    );
  }, [t]);

  const handleGameOverClose = useCallback(() => {
    if (gameState) {
      const winner = getWinner(gameState);
      completeGame(
        winner === 'player',
        gameState.player.score,
        serializeState(gameState),
      );
    }
    setShowGameOver(false);
    setPhase('menu');
    setGameState(null);
  }, [gameState, completeGame]);

  // ============================================================
  // Score preview
  // ============================================================

  const scorePreview = useMemo(() => {
    if (!gameState) return null;
    return previewScore(gameState);
  }, [gameState]);

  // ============================================================
  // Game Over Stats
  // ============================================================

  const gameOverStats = useMemo((): GameOverStat[] => {
    if (!gameState || !gameState.isComplete) return [];
    const finals = calculateFinalScores(gameState);
    return [
      {
        label: t('games.woordy.yourScore'),
        value: `${finals.playerFinal}`,
      },
      {
        label: t('games.woordy.opponentScore'),
        value: `${finals.opponentFinal}`,
      },
      {
        label: t('games.woordy.wordsPlayed'),
        value: `${gameState.turns.filter((turn) => turn.playedBy === 'player' && turn.action === 'place').length}`,
      },
    ];
  }, [gameState, t]);

  // ============================================================
  // Render: Menu Phase
  // ============================================================

  const renderMenu = () => (
    <ScrollViewWithIndicator style={{ flex: 1 }} contentContainerStyle={[styles.menuContainer, { backgroundColor: themeColors.background }]}>
      <Text style={[styles.menuTitle, { color: themeColors.textPrimary }]}>
        {t('games.woordy.title')}
      </Text>
      <Text style={[styles.menuDescription, { color: themeColors.textSecondary }]}>
        {t('games.woordy.howToPlay')}
      </Text>

      {/* Start button — top for quick access */}
      <HapticTouchable
        style={[styles.startButton, { backgroundColor: moduleColor }]}
        onPress={handleStartGame}
      >
        <Text style={styles.startButtonText}>
          {t('games.common.play')}
        </Text>
      </HapticTouchable>

      <GameSettingsAccordion moduleColor={moduleColor}>
        {/* Sound settings */}
        <GameSoundPicker moduleColor={moduleColor} />
      </GameSettingsAccordion>
    </ScrollViewWithIndicator>
  );

  // ============================================================
  // Render: Board
  // ============================================================

  const renderCell = (cell: BoardCell, row: number, col: number) => {
    const isSelected = false; // Could highlight target cells
    const hasTile = cell.tile !== null;
    const isPending = hasTile && cell.tile!.isCurrentTurn;
    const fieldColor = cell.triviaRevealed
      ? BONUS_COLORS.trivia
      : BONUS_COLORS[cell.fieldType] ?? BONUS_COLORS.normal;

    return (
      <HapticTouchable
        key={`${row}-${col}`}
        style={[
          styles.cell,
          {
            backgroundColor: hasTile
              ? (isPending ? moduleColor : themeColors.surface)
              : fieldColor !== 'transparent'
                ? fieldColor
                : themeColors.surfaceVariant,
            borderColor: isPending ? '#FFFFFF' : themeColors.border,
          },
        ]}
        onPress={() => handleTapCell(row, col)}
        hapticDisabled={!hasTile && !gameState?.selectedTileId}
      >
        {hasTile ? (
          <View style={styles.cellContent}>
            <Text
              style={[
                styles.cellLetter,
                { color: isPending ? '#FFFFFF' : themeColors.textPrimary },
              ]}
            >
              {cell.tile!.chosenLetter || cell.tile!.letter || '★'}
            </Text>
            {cell.tile!.value > 0 && (
              <Text
                style={[
                  styles.cellValue,
                  { color: isPending ? 'rgba(255,255,255,0.7)' : themeColors.textTertiary },
                ]}
              >
                {cell.tile!.value}
              </Text>
            )}
          </View>
        ) : cell.fieldType !== 'normal' && cell.fieldType !== 'trivia' ? (
          <Text style={styles.fieldLabel}>
            {cell.fieldType === 'center' ? '★' : cell.fieldType}
          </Text>
        ) : null}
      </HapticTouchable>
    );
  };

  const renderBoard = () => {
    if (!gameState) return null;

    return (
      <ScrollView
        style={styles.boardScrollH}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <ScrollView
          style={styles.boardScrollV}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.boardContainer}>
            {gameState.board.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.boardRow}>
                {row.map((cell, colIdx) => renderCell(cell, rowIdx, colIdx))}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    );
  };

  // ============================================================
  // Render: Rack
  // ============================================================

  const renderRack = () => {
    if (!gameState) return null;
    const rack = gameState.player.rack;

    return (
      <View style={styles.rackContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rackScroll}>
          {rack.map((tile: Tile) => (
            <HapticTouchable
              key={tile.id}
              style={[
                styles.rackTile,
                {
                  backgroundColor:
                    gameState.selectedTileId === tile.id
                      ? moduleColor
                      : themeColors.surface,
                  borderColor:
                    gameState.selectedTileId === tile.id
                      ? '#FFFFFF'
                      : themeColors.border,
                },
              ]}
              onPress={() => handleSelectRackTile(tile.id)}
            >
              <Text
                style={[
                  styles.rackLetter,
                  {
                    color:
                      gameState.selectedTileId === tile.id
                        ? '#FFFFFF'
                        : themeColors.textPrimary,
                  },
                ]}
              >
                {tile.isBlank ? '★' : tile.letter}
              </Text>
              {tile.value > 0 && (
                <Text
                  style={[
                    styles.rackValue,
                    {
                      color:
                        gameState.selectedTileId === tile.id
                          ? 'rgba(255,255,255,0.7)'
                          : themeColors.textTertiary,
                    },
                  ]}
                >
                  {tile.value}
                </Text>
              )}
            </HapticTouchable>
          ))}
        </ScrollView>
      </View>
    );
  };

  // ============================================================
  // Render: Action Buttons
  // ============================================================

  const renderActions = () => {
    if (!gameState || gameState.currentTurn !== 'player') return null;

    const hasPending = gameState.pendingTiles.length > 0;

    return (
      <View style={styles.actionsContainer}>
        {/* Score preview */}
        {scorePreview && (
          <View style={[styles.scorePreview, { backgroundColor: moduleColor }]}>
            <Text style={styles.scorePreviewText}>
              +{scorePreview.total} {t('games.woordy.points')}
            </Text>
          </View>
        )}

        <View style={styles.actionRow}>
          {hasPending && (
            <HapticTouchable
              style={[styles.actionButton, { backgroundColor: moduleColor }]}
              onPress={handleConfirm}
            >
              <Icon name="check" size={24} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>
                {t('games.woordy.confirm')}
              </Text>
            </HapticTouchable>
          )}

          <HapticTouchable
            style={[styles.actionButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border, borderWidth: 1 }]}
            onPress={handlePass}
          >
            <Text style={[styles.actionButtonText, { color: themeColors.textPrimary }]}>
              {t('games.woordy.pass')}
            </Text>
          </HapticTouchable>

          <HapticTouchable
            style={[styles.actionButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border, borderWidth: 1 }]}
            onPress={handleResign}
          >
            <Text style={[styles.actionButtonText, { color: themeColors.error }]}>
              {t('games.woordy.resign')}
            </Text>
          </HapticTouchable>
        </View>
      </View>
    );
  };

  // ============================================================
  // Render: Scoreboard
  // ============================================================

  const renderScoreboard = () => {
    if (!gameState) return null;

    return (
      <View style={[styles.scoreboard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <View style={styles.scorePlayer}>
          <Text style={[styles.scoreLabel, { color: themeColors.textSecondary }]}>
            {t('games.woordy.you')}
          </Text>
          <Text style={[styles.scoreValue, { color: moduleColor }]}>
            {gameState.player.score}
          </Text>
        </View>
        <View style={[styles.scoreDivider, { backgroundColor: themeColors.border }]} />
        <View style={styles.scorePlayer}>
          <Text style={[styles.scoreLabel, { color: themeColors.textSecondary }]}>
            {t('games.woordy.opponent')}
          </Text>
          <Text style={[styles.scoreValue, { color: themeColors.textPrimary }]}>
            {gameState.opponent.score}
          </Text>
        </View>
        <View style={[styles.scoreDivider, { backgroundColor: themeColors.border }]} />
        <View style={styles.scorePlayer}>
          <Text style={[styles.scoreLabel, { color: themeColors.textSecondary }]}>
            {t('games.woordy.tilesLeft')}
          </Text>
          <Text style={[styles.scoreValue, { color: themeColors.textPrimary }]}>
            {gameState.letterBag.length}
          </Text>
        </View>
      </View>
    );
  };

  // ============================================================
  // Render: Playing Phase
  // ============================================================

  const renderPlaying = () => (
    <View style={{ flex: 1 }}>
      {renderScoreboard()}
      <View style={{ flex: 1 }}>
        {renderBoard()}
      </View>
      {renderRack()}
      {renderActions()}
    </View>
  );

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
  // Main Render
  // ============================================================

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ModuleScreenLayout
        moduleId={MODULE_ID}
        moduleBlock={
          <ModuleHeader
            moduleId={MODULE_ID}
            icon="document-text"
            title={t('games.woordy.title')}
            skipSafeArea
            showGridButton={false}
            rightAccessory={renderGamepadButton(
              phase === 'menu' ? onBack : handleQuit,
              phase === 'menu' ? undefined : t('games.common.quit'),
            )}
          />
        }
        controlsBlock={
          phase === 'playing' ? (
            <GameHeader
              moduleId={MODULE_ID}
              showTimer
              timer={durationSeconds}
              actions={[]}
            />
          ) : <></>
        }
        contentBlock={
          phase === 'menu' ? renderMenu() : renderPlaying()
        }
      />

      {/* Game Over Modal */}
      {gameState && showGameOver && (
        <GameOverModal
          visible={showGameOver}
          moduleId={MODULE_ID}
          title={getWinner(gameState) === 'player'
            ? t('games.common.congratulations')
            : getWinner(gameState) === 'draw'
              ? t('games.common.draw')
              : t('games.common.gameOver')
          }
          score={gameState.player.score}
          isWon={getWinner(gameState) === 'player'}
          stats={gameOverStats}
          onPlayAgain={() => {
            setShowGameOver(false);
            handleStartGame();
          }}
          onBackToLobby={handleGameOverClose}
          onClose={handleGameOverClose}
        />
      )}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Menu
  menuContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  menuTitle: {
    ...typography.h2,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  menuDescription: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 28,
  },
  startButton: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    minWidth: 200,
    alignItems: 'center',
  },
  startButtonText: {
    ...typography.h3,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Scoreboard
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  scorePlayer: {
    flex: 1,
    alignItems: 'center',
  },
  scoreLabel: {
    ...typography.caption,
    marginBottom: 2,
  },
  scoreValue: {
    ...typography.h3,
    fontWeight: '700',
  },
  scoreDivider: {
    width: 1,
    height: 32,
    marginHorizontal: spacing.sm,
  },

  // Board
  boardScrollH: {
    flex: 1,
  },
  boardScrollV: {
    flex: 1,
  },
  boardContainer: {
    padding: spacing.sm,
  },
  boardRow: {
    flexDirection: 'row',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderRadius: 2,
    margin: 0.5,
  },
  cellContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLetter: {
    fontSize: 14,
    fontWeight: '700',
  },
  cellValue: {
    fontSize: 8,
    fontWeight: '500',
    position: 'absolute',
    bottom: -2,
    right: -4,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  // Rack
  rackContainer: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  rackScroll: {
    gap: spacing.sm,
    justifyContent: 'center',
  },
  rackTile: {
    width: RACK_TILE_SIZE,
    height: RACK_TILE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    borderWidth: 2,
  },
  rackLetter: {
    fontSize: 22,
    fontWeight: '700',
  },
  rackValue: {
    fontSize: 10,
    fontWeight: '500',
    position: 'absolute',
    bottom: 2,
    right: 4,
  },

  // Actions
  actionsContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  scorePreview: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  scorePreviewText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
  },
  actionButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
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
