/**
 * WoordraadScreen — Wordle-style Dutch word guessing game
 *
 * Player guesses a 5-letter Dutch word in up to 6 attempts.
 * Color feedback per letter: green (correct), yellow (present), grey (absent).
 *
 * Senior-inclusive design — "kassabon" layout:
 * - Scrollable previous guesses zone (32pt compact tiles with color feedback)
 * - Fixed input row (52pt large tiles) always visible above keyboard
 * - Fixed on-screen QWERTY keyboard (52pt keys) always visible at bottom
 * - High contrast colors for feedback (green/orange/grey)
 * - All 6 guess rows + input + keyboard fit on iPhone SE without scrolling
 *
 * @see src/engines/woordraad/engine.ts
 * @see src/types/games.ts
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, borderRadius, touchTargets, typography, colors as themeConst } from '@/theme';
import { ModuleHeader, ModuleScreenLayout, HapticTouchable, Icon } from '@/components';
import { GameHeader, GameOverModal, GameStatsView } from '@/components/games';
import type { GameOverStat } from '@/components/games';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useGameSession } from '@/hooks/games/useGameSession';
import type { ModuleColorId } from '@/types/liquidGlass';


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
} from '@/engines/woordraad/engine';
import { checkDataStatus, downloadGameData, type DownloadProgress } from '@/services/downloadService';
import {
  loadWordLists,
  isWordListsLoaded,
  getLoadedLanguage,
  getTargetWords,
  getValidGuesses,
} from '@/engines/woordraad/wordBank';

// ============================================================
// Constants
// ============================================================

const MODULE_ID: ModuleColorId = 'woordraad' as ModuleColorId;
const SCREEN_WIDTH = Dimensions.get('window').width;

// Tile sizing
const TILE_GAP = 6;

// Kassabon tiles — compact previous guesses (scrollable zone)
const KASSABON_TILE_SIZE = 32;
const KASSABON_FONT_SIZE = 18;

// Input row tiles — large, focused current guess (fixed above keyboard)
const INPUT_TILE_SIZE = 52;
const INPUT_FONT_SIZE = 28;

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

type GamePhase = 'loading' | 'download' | 'downloading' | 'menu' | 'playing' | 'gameover';

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
  const { t, i18n } = useTranslation();
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
  const [phase, setPhase] = useState<GamePhase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kassabonScrollRef = useRef<ScrollView>(null);

  // Download state
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Current language code (e.g. 'nl', 'en', 'de')
  const woordraadLanguage = useMemo(() => i18n.language.substring(0, 2), [i18n.language]);

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

  // Auto-scroll kassabon to latest guess
  useEffect(() => {
    if (gameState && gameState.guesses.length > 0) {
      requestAnimationFrame(() => {
        kassabonScrollRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [gameState?.guesses.length]);

  // ============================================================
  // Initialization — Check if word lists are available
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    async function checkAndLoadWords() {
      // If already loaded for this language, go straight to menu
      if (isWordListsLoaded() && getLoadedLanguage() === woordraadLanguage) {
        setPhase('menu');
        return;
      }

      // Check if data is downloaded locally
      const status = await checkDataStatus('woordraad', woordraadLanguage);

      if (cancelled) return;

      if (status.isAvailable) {
        // Data is downloaded — load into memory
        const loaded = await loadWordLists(woordraadLanguage);
        if (cancelled) return;

        if (loaded) {
          setPhase('menu');
        } else {
          // File exists but couldn't be loaded — re-download
          setPhase('download');
        }
      } else {
        // No data — show download prompt
        setPhase('download');
      }
    }

    checkAndLoadWords();
    return () => { cancelled = true; };
  }, [woordraadLanguage]);

  // ============================================================
  // Download handler
  // ============================================================

  const handleStartDownload = useCallback(async () => {
    setPhase('downloading');
    setDownloadProgress(0);
    setDownloadError(null);

    const result = await downloadGameData('woordraad', woordraadLanguage, (progress: DownloadProgress) => {
      setDownloadProgress(progress.progress);
    });

    if (!result.success) {
      setDownloadError(result.error || 'download_failed');
      setPhase('download');
      return;
    }

    // Load the downloaded word lists into memory
    const loaded = await loadWordLists(woordraadLanguage);
    if (loaded) {
      setPhase('menu');
    } else {
      setDownloadError('load_failed');
      setPhase('download');
    }
  }, [woordraadLanguage]);

  // Start new game
  const handleStartGame = useCallback(async () => {
    const state = createInitialState(getTargetWords());
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

      const validationError = validateGuess(gameState.currentInput, getValidGuesses());
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
  // Render — Loading Phase (checking local data)
  // ============================================================

  if (phase === 'loading') {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ModuleScreenLayout
          moduleId={MODULE_ID}
          moduleBlock={
            <ModuleHeader
              moduleId={MODULE_ID}
              icon="chatbubble"
              title={t('navigation.woordraad')}
              skipSafeArea
              rightAccessory={renderGamepadButton(onBack)}
            />
          }
          controlsBlock={<></>}
          contentBlock={
            <View style={styles.downloadContent}>
              <ActivityIndicator size="large" color={moduleColor} />
              <Text style={[styles.downloadStatusText, { color: themeColors.textSecondary }]}>
                {t('games.woordraad.download.checking')}
              </Text>
            </View>
          }
        />
      </View>
    );
  }

  // ============================================================
  // Render — Download Phase (prompt to download)
  // ============================================================

  if (phase === 'download') {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ModuleScreenLayout
          moduleId={MODULE_ID}
          moduleBlock={
            <ModuleHeader
              moduleId={MODULE_ID}
              icon="chatbubble"
              title={t('navigation.woordraad')}
              skipSafeArea
              rightAccessory={renderGamepadButton(onBack)}
            />
          }
          controlsBlock={<></>}
          contentBlock={
            <View style={styles.downloadContent}>
              <View style={[styles.downloadCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                <Text style={styles.downloadEmoji}>📥</Text>
                <Text style={[styles.downloadTitle, { color: themeColors.textPrimary }]}>
                  {t('games.woordraad.download.title')}
                </Text>
                <Text style={[styles.downloadDescription, { color: themeColors.textSecondary }]}>
                  {t('games.woordraad.download.description')}
                </Text>
                <Text style={[styles.downloadSize, { color: themeColors.textTertiary }]}>
                  {t('games.woordraad.download.size')}
                </Text>

                {downloadError && (
                  <View style={styles.downloadErrorBanner}>
                    <Icon name="warning" size={20} color="#F44336" />
                    <Text style={styles.downloadErrorText}>
                      {t('games.woordraad.download.error')}
                    </Text>
                  </View>
                )}

                <HapticTouchable
                  style={[styles.downloadButton, { backgroundColor: moduleColor }]}
                  onPress={handleStartDownload}
                  accessibilityRole="button"
                  accessibilityLabel={t('games.woordraad.download.button')}
                >
                  <Icon name="download" size={24} color="#FFFFFF" />
                  <Text style={styles.downloadButtonText}>
                    {t('games.woordraad.download.button')}
                  </Text>
                </HapticTouchable>
              </View>
            </View>
          }
        />
      </View>
    );
  }

  // ============================================================
  // Render — Downloading Phase (progress bar)
  // ============================================================

  if (phase === 'downloading') {
    const progressPercent = Math.round(downloadProgress * 100);

    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ModuleScreenLayout
          moduleId={MODULE_ID}
          moduleBlock={
            <ModuleHeader
              moduleId={MODULE_ID}
              icon="chatbubble"
              title={t('navigation.woordraad')}
              skipSafeArea
              rightAccessory={renderGamepadButton(onBack)}
            />
          }
          controlsBlock={<></>}
          contentBlock={
            <View style={styles.downloadContent}>
              <View style={[styles.downloadCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                <Text style={styles.downloadEmoji}>📥</Text>
                <Text style={[styles.downloadTitle, { color: themeColors.textPrimary }]}>
                  {t('games.woordraad.download.downloading')}
                </Text>

                {/* Progress bar */}
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarTrack, { backgroundColor: themeColors.border }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { backgroundColor: moduleColor, width: `${progressPercent}%` },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressBarText, { color: themeColors.textSecondary }]}>
                    {progressPercent}%
                  </Text>
                </View>

                <Text style={[styles.downloadStatusText, { color: themeColors.textTertiary }]}>
                  {t('games.woordraad.download.pleaseWait')}
                </Text>
              </View>
            </View>
          }
        />
      </View>
    );
  }

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
              skipSafeArea
              rightAccessory={renderGamepadButton(onBack)}
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
            {/* Error banner */}
            {error && (
              <View style={[styles.errorBanner, { backgroundColor: themeConst.errorBackground }]}>
                <Text style={[styles.errorText, { color: themeConst.error }]}>
                  {t(error)}
                </Text>
              </View>
            )}

            {/* ============ KASSABON ZONE — scrollable previous guesses ============ */}
            <ScrollView
              ref={kassabonScrollRef}
              style={styles.kassabonScroll}
              contentContainerStyle={styles.kassabonContent}
              showsVerticalScrollIndicator={false}
            >
              {gameState?.guesses.map((guess, rowIndex) => {
                const result = gameState.results[rowIndex];
                if (!result) return null;
                return (
                  <View key={rowIndex} style={styles.kassabonRow}>
                    {Array.from({ length: WORD_LENGTH }).map((_, colIndex) => (
                      <View
                        key={colIndex}
                        style={[
                          styles.kassabonTile,
                          {
                            backgroundColor: FEEDBACK_COLORS[result[colIndex].status],
                            borderColor: FEEDBACK_COLORS[result[colIndex].status],
                          },
                        ]}
                        accessibilityLabel={`${result[colIndex].letter}, ${t(`games.woordraad.status_${result[colIndex].status}`)}`}
                      >
                        <Text style={styles.kassabonLetter}>
                          {result[colIndex].letter}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })}

              {/* Empty rows — show remaining unfilled rows as placeholders */}
              {Array.from({ length: Math.max(0, MAX_GUESSES - (gameState?.guesses.length ?? 0) - 1) }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.kassabonRow}>
                  {Array.from({ length: WORD_LENGTH }).map((_, colIndex) => (
                    <View
                      key={colIndex}
                      style={[
                        styles.kassabonTile,
                        {
                          backgroundColor: 'transparent',
                          borderColor: themeColors.border,
                        },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>

            {/* ============ INPUT ROW — fixed current guess ============ */}
            <View style={styles.inputRowContainer}>
              <View style={styles.inputRow}>
                {Array.from({ length: WORD_LENGTH }).map((_, colIndex) => {
                  const letter = (gameState?.currentInput ?? '')[colIndex] ?? '';
                  return (
                    <View
                      key={colIndex}
                      style={[
                        styles.inputTile,
                        {
                          backgroundColor: themeColors.surface,
                          borderColor: letter ? moduleColor : themeColors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.inputLetter,
                          { color: themeColors.textPrimary },
                        ]}
                      >
                        {letter}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ============ KEYBOARD — fixed at bottom ============ */}
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
  // Kassabon — scrollable previous guesses
  kassabonScroll: {
    flex: 1,
  },
  kassabonContent: {
    alignItems: 'center',
    gap: TILE_GAP,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  kassabonRow: {
    flexDirection: 'row',
    gap: TILE_GAP,
  },
  kassabonTile: {
    width: KASSABON_TILE_SIZE,
    height: KASSABON_TILE_SIZE,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kassabonLetter: {
    fontSize: KASSABON_FONT_SIZE,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  // Input row — fixed current guess above keyboard
  inputRowContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: TILE_GAP,
  },
  inputTile: {
    width: INPUT_TILE_SIZE,
    height: INPUT_TILE_SIZE,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLetter: {
    fontSize: INPUT_FONT_SIZE,
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
  gamepadButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Download flow
  downloadContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  downloadCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  downloadEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  downloadTitle: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  downloadDescription: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  downloadSize: {
    ...typography.label,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.comfortable,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    width: '100%',
  },
  downloadButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  downloadStatusText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  downloadErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  downloadErrorText: {
    ...typography.body,
    color: '#F44336',
    flex: 1,
  },
  progressBarContainer: {
    width: '100%',
    marginBottom: spacing.md,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressBarText: {
    ...typography.label,
    textAlign: 'center',
  },
});
