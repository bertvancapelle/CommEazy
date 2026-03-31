/**
 * SudokuScreen — Classic 9×9 number puzzle
 *
 * Senior-inclusive design:
 * - Large number pad buttons (60pt minimum)
 * - Clear visual distinction: pre-filled vs player cells
 * - Error highlighting with color + icon
 * - Selected cell with bold accent border
 * - Notes mode toggle with clear indicator
 *
 * @see src/engines/sudoku/engine.ts
 * @see src/types/games.ts
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, borderRadius, touchTargets, typography, colors as themeConst } from '@/theme';
import { ModuleHeader, ModuleScreenLayout, HapticTouchable, Icon, ScrollViewWithIndicator } from '@/components';
import { GameHeader, GameOverModal, DifficultyPicker, GameStatsView, GameSoundPicker } from '@/components/games';
import type { GameOverStat, DifficultyOption } from '@/components/games';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useGameSession } from '@/hooks/games/useGameSession';
import type { ModuleColorId } from '@/types/liquidGlass';
import type { GameDifficulty } from '@/types/games';

import {
  createInitialState,
  selectCell,
  placeNumber,
  toggleNote,
  clearCell,
  useHint,
  calculateScore,
  getStarRating,
  getRemainingCells,
  hasConflict,
  GRID_SIZE,
  BOX_SIZE,
  type SudokuState,
  type CellValue,
} from '@/engines/sudoku/engine';

// ============================================================
// Constants
// ============================================================

const MODULE_ID: ModuleColorId = 'sudoku' as ModuleColorId;
const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = spacing.md * 2;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - GRID_PADDING - 4) / GRID_SIZE); // -4 for box borders
const NUM_PAD_GAP = 6;

// ============================================================
// Types
// ============================================================

interface SudokuScreenProps {
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

export function SudokuScreen({ onBack }: SudokuScreenProps) {
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
  } = useGameSession({ gameType: 'sudoku' });

  // Game state
  const [gameState, setGameState] = useState<SudokuState | null>(null);
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [difficulty, setDifficulty] = useState<GameDifficulty>('easy');
  const [notesMode, setNotesMode] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Remaining cells count
  const remaining = useMemo(() => {
    if (!gameState) return 0;
    return getRemainingCells(gameState);
  }, [gameState]);

  // Start new game
  const handleStartGame = useCallback(async () => {
    const state = createInitialState(difficulty);
    setGameState(state);
    setPhase('playing');
    setNotesMode(false);
    await startSession({
      gameType: 'sudoku',
      mode: 'solo',
      difficulty,
      players: [],
    });
  }, [difficulty, startSession]);

  // Select cell
  const handleCellPress = useCallback((row: number, col: number) => {
    if (!gameState || gameState.isComplete) return;
    setGameState(prev => prev ? selectCell(prev, row, col) : null);
  }, [gameState]);

  // Place number or toggle note
  const handleNumberPress = useCallback((num: number) => {
    if (!gameState || !gameState.selectedCell) return;

    if (notesMode) {
      const newState = toggleNote(gameState, num);
      if (newState) setGameState(newState);
    } else {
      const newState = placeNumber(gameState, num as CellValue);
      if (newState) {
        setGameState(newState);
        if (newState.isComplete && newState.isWon) {
          const score = calculateScore(newState, durationSeconds);
          completeGame(score, true);
          setPhase('gameover');
        }
      }
    }
  }, [gameState, notesMode, durationSeconds, completeGame]);

  // Clear cell
  const handleClear = useCallback(() => {
    if (!gameState) return;
    const newState = clearCell(gameState);
    if (newState) setGameState(newState);
  }, [gameState]);

  // Use hint
  const handleHint = useCallback(() => {
    if (!gameState) return;
    const newState = useHint(gameState);
    if (newState) {
      setGameState(newState);
      if (newState.isComplete && newState.isWon) {
        const score = calculateScore(newState, durationSeconds);
        completeGame(score, true);
        setPhase('gameover');
      }
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
      { label: t('games.sudoku.errors'), value: `${gameState.errorCount}` },
      { label: t('games.common.time'), value: formatTime(durationSeconds) },
      { label: t('games.sudoku.difficulty'), value: t(`games.lobby.${gameState.difficulty}`) },
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
              title={t('navigation.sudoku')}
              skipSafeArea
              showGridButton={false}
              rightAccessory={renderGamepadButton(onBack)}
            />
          }
          controlsBlock={<></>}
          contentBlock={
            <ScrollViewWithIndicator style={{ flex: 1 }} contentContainerStyle={styles.menuContent}>
              <View style={[styles.menuCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                <Text style={[styles.menuTitle, { color: themeColors.textPrimary }]}>
                  {t('games.sudoku.title')}
                </Text>
                <Text style={[styles.menuDescription, { color: themeColors.textSecondary }]}>
                  {t('games.sudoku.howToPlay')}
                </Text>

                {/* Start button — top for quick access */}
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

                {/* Sound settings */}
                <GameSoundPicker moduleColor={moduleColor} />
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

              {showStats && <GameStatsView gameType="sudoku" moduleId={MODULE_ID} />}
            </ScrollViewWithIndicator>
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
            title={t('navigation.sudoku')}
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
              {
                icon: 'star',
                label: t('games.common.hint'),
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
                {t('games.sudoku.remaining', { count: remaining })}
              </Text>
              <Text style={[styles.infoText, { color: gameState && gameState.errorCount > 0 ? themeConst.error : themeColors.textSecondary }]}>
                {t('games.sudoku.errors')}: {gameState?.errorCount ?? 0}
              </Text>
            </View>

            {/* Sudoku Grid */}
            <View style={[styles.gridContainer, { borderColor: themeColors.textPrimary }]}>
              {Array.from({ length: GRID_SIZE }).map((_, row) => (
                <View key={row} style={styles.gridRow}>
                  {Array.from({ length: GRID_SIZE }).map((_, col) => {
                    const value = gameState?.playerGrid[row][col] ?? 0;
                    const isLocked = gameState?.locked[row][col] ?? false;
                    const isSelected = gameState?.selectedCell?.row === row && gameState?.selectedCell?.col === col;
                    const isSameNumber = value !== 0 && gameState?.selectedCell && gameState.playerGrid[gameState.selectedCell.row][gameState.selectedCell.col] === value;
                    const isError = gameState ? (value !== 0 && hasConflict(gameState.playerGrid, row, col)) : false;
                    const cellNotes = gameState?.notes[row][col];

                    // Box borders
                    const rightBorder = (col + 1) % BOX_SIZE === 0 && col < GRID_SIZE - 1;
                    const bottomBorder = (row + 1) % BOX_SIZE === 0 && row < GRID_SIZE - 1;

                    return (
                      <HapticTouchable
                        key={col}
                        onPress={() => handleCellPress(row, col)}
                        hapticType="tap"
                        style={[
                          styles.cell,
                          {
                            borderColor: themeColors.border,
                            backgroundColor: isSelected
                              ? moduleColor + '20'
                              : isSameNumber
                                ? moduleColor + '10'
                                : isError
                                  ? themeConst.errorBackground
                                  : themeColors.surface,
                          },
                          isSelected && { borderColor: moduleColor, borderWidth: 2 },
                          rightBorder && styles.cellRightBorder,
                          bottomBorder && styles.cellBottomBorder,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('games.sudoku.cell')} ${row + 1},${col + 1}${value ? `: ${value}` : ''}`}
                      >
                        {value !== 0 ? (
                          <Text
                            style={[
                              styles.cellText,
                              {
                                color: isError
                                  ? themeConst.error
                                  : isLocked
                                    ? themeColors.textPrimary
                                    : moduleColor,
                                fontWeight: isLocked ? '700' : '500',
                              },
                            ]}
                          >
                            {value}
                          </Text>
                        ) : cellNotes && cellNotes.size > 0 ? (
                          <View style={styles.notesContainer}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                              <Text
                                key={n}
                                style={[
                                  styles.noteText,
                                  { color: cellNotes.has(n) ? themeColors.textSecondary : 'transparent' },
                                ]}
                              >
                                {n}
                              </Text>
                            ))}
                          </View>
                        ) : null}
                      </HapticTouchable>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Number pad + controls */}
            <View style={[styles.controlsContainer, { paddingBottom: spacing.md + insets.bottom }]}>
              {/* Notes mode toggle */}
              <View style={styles.modeRow}>
                <HapticTouchable
                  onPress={() => setNotesMode(!notesMode)}
                  style={[
                    styles.modeButton,
                    {
                      backgroundColor: notesMode ? moduleColor : themeColors.surface,
                      borderColor: notesMode ? moduleColor : themeColors.border,
                    },
                  ]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: notesMode }}
                  accessibilityLabel={t('games.sudoku.notesMode')}
                >
                  <Icon name="edit" size={20} color={notesMode ? '#FFFFFF' : themeColors.textPrimary} />
                  <Text style={[styles.modeButtonText, { color: notesMode ? '#FFFFFF' : themeColors.textPrimary }]}>
                    {t('games.sudoku.notes')}
                  </Text>
                </HapticTouchable>

                <HapticTouchable
                  onPress={handleClear}
                  style={[styles.modeButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('games.sudoku.erase')}
                >
                  <Icon name="close" size={20} color={themeColors.textPrimary} />
                  <Text style={[styles.modeButtonText, { color: themeColors.textPrimary }]}>
                    {t('games.sudoku.erase')}
                  </Text>
                </HapticTouchable>
              </View>

              {/* Number pad: 1-9 in a single row */}
              <View style={styles.numPadRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <HapticTouchable
                    key={num}
                    onPress={() => handleNumberPress(num)}
                    hapticType="tap"
                    style={[
                      styles.numKey,
                      {
                        backgroundColor: themeColors.surface,
                        borderColor: themeColors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${num}`}
                  >
                    <Text style={[styles.numKeyText, { color: moduleColor }]}>
                      {num}
                    </Text>
                  </HapticTouchable>
                ))}
              </View>
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
          isWon={gameState.isWon}
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
    justifyContent: 'space-between',
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
  // Grid
  gridContainer: {
    alignSelf: 'center',
    borderWidth: 2,
    borderRadius: borderRadius.sm,
  },
  gridRow: {
    flexDirection: 'row',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellRightBorder: {
    borderRightWidth: 2,
    borderRightColor: '#1A1A1A',
  },
  cellBottomBorder: {
    borderBottomWidth: 2,
    borderBottomColor: '#1A1A1A',
  },
  cellText: {
    fontSize: Math.max(CELL_SIZE * 0.45, 18),
  },
  notesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    height: '100%',
    padding: 1,
  },
  noteText: {
    width: '33.33%',
    textAlign: 'center',
    fontSize: Math.max(CELL_SIZE * 0.22, 9),
    lineHeight: Math.max(CELL_SIZE * 0.3, 12),
  },
  // Controls
  controlsContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: touchTargets.minimum,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  modeButtonText: {
    ...typography.label,
    fontWeight: '600',
  },
  numPadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: NUM_PAD_GAP,
  },
  numKey: {
    width: Math.floor((SCREEN_WIDTH - spacing.md * 2 - NUM_PAD_GAP * 8) / 9),
    height: touchTargets.minimum,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numKeyText: {
    fontSize: 22,
    fontWeight: '700',
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
