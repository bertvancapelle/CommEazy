/**
 * TriviaScreen — Multiple-choice quiz game
 *
 * Senior-inclusive design:
 * - Large answer buttons (≥72pt height)
 * - Clear question text (≥18pt)
 * - Color + icon feedback (never color alone)
 * - No timer by default (senior-friendly)
 * - Haptic feedback on correct/incorrect answer
 *
 * @see src/engines/trivia/engine.ts
 * @see src/types/games.ts
 * @see .claude/plans/TRIVIA_DESIGN.md
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  submitAnswer,
  advanceToNextQuestion,
  handleTimerExpiry,
  getCurrentQuestion,
  calculateScore,
  getCorrectCount,
  getStarRating,
  isWin,
  getMaxScore,
  serializeState,
} from '@/engines/trivia/engine';
import type { TriviaState, TriviaDifficulty, TriviaTheme, TriviaSettings } from '@/engines/trivia/types';
import { ALL_TRIVIA_THEMES, DEFAULT_TRIVIA_SETTINGS, QUESTIONS_PER_ROUND_OPTIONS, TIMER_OPTIONS, FEEDBACK_TIMER_OPTIONS } from '@/engines/trivia/types';
import { checkDataStatus, downloadGameData, type DownloadProgress } from '@/services/downloadService';
import { loadQuestions, isQuestionsLoaded, getLoadedLanguage } from '@/engines/trivia/questionBank';

// ============================================================
// Constants
// ============================================================

const MODULE_ID: ModuleColorId = 'trivia' as ModuleColorId;
const SETTINGS_STORAGE_KEY = '@commeazy/trivia_settings';

// ============================================================
// Types
// ============================================================

interface TriviaScreenProps {
  onBack: () => void;
}

type GamePhase = 'loading' | 'download' | 'downloading' | 'menu' | 'category' | 'playing' | 'gameover';

// ============================================================
// Difficulty options
// ============================================================

const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  { value: 'easy', label: 'games.lobby.easy' },
  { value: 'medium', label: 'games.lobby.medium' },
  { value: 'hard', label: 'games.lobby.hard' },
];

// ============================================================
// Helpers
// ============================================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================
// Component
// ============================================================

export function TriviaScreen({ onBack }: TriviaScreenProps) {
  const { t, i18n } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor(MODULE_ID);

  // Game session
  const {
    durationSeconds,
    startSession,
    completeGame,
    abandonGame,
  } = useGameSession({ gameType: 'trivia' });

  // Game state
  const [gameState, setGameState] = useState<TriviaState | null>(null);
  const [phase, setPhase] = useState<GamePhase>('loading');
  const [difficulty, setDifficulty] = useState<TriviaDifficulty>('medium');
  const [questionsPerRound, setQuestionsPerRound] = useState(DEFAULT_TRIVIA_SETTINGS.questionsPerRound);
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_TRIVIA_SETTINGS.timerSeconds);
  const [feedbackSeconds, setFeedbackSeconds] = useState(DEFAULT_TRIVIA_SETTINGS.feedbackSeconds);
  const [showStats, setShowStats] = useState(false);
  const [questionTimer, setQuestionTimer] = useState(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Download state
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Current language code (e.g. 'nl', 'en', 'de')
  const triviaLanguage = useMemo(() => i18n.language.substring(0, 2), [i18n.language]);

  // ============================================================
  // Settings Persistence
  // ============================================================

  // Load persisted settings on mount
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_STORAGE_KEY).then(stored => {
      if (stored) {
        try {
          const s = JSON.parse(stored) as Partial<TriviaSettings>;
          if (s.difficulty) setDifficulty(s.difficulty);
          if (s.questionsPerRound) setQuestionsPerRound(s.questionsPerRound);
          if (s.timerSeconds !== undefined) setTimerSeconds(s.timerSeconds);
          if (s.feedbackSeconds !== undefined) setFeedbackSeconds(s.feedbackSeconds);
        } catch {
          // Invalid JSON — use defaults
        }
      }
    });
  }, []);

  // Save settings helper
  const saveSettings = useCallback((updated: Partial<TriviaSettings>) => {
    const settings: TriviaSettings = {
      difficulty,
      questionsPerRound,
      timerSeconds,
      feedbackSeconds,
      ...updated,
    };
    AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)).catch(() => {});
  }, [difficulty, questionsPerRound, timerSeconds, feedbackSeconds]);

  // Wrapped setters that also persist
  const handleSetDifficulty = useCallback((d: TriviaDifficulty) => {
    setDifficulty(d);
    saveSettings({ difficulty: d });
  }, [saveSettings]);

  const handleSetQuestionsPerRound = useCallback((q: number) => {
    setQuestionsPerRound(q);
    saveSettings({ questionsPerRound: q });
  }, [saveSettings]);

  const handleSetTimerSeconds = useCallback((s: number) => {
    setTimerSeconds(s);
    saveSettings({ timerSeconds: s });
  }, [saveSettings]);

  const handleSetFeedbackSeconds = useCallback((s: number) => {
    setFeedbackSeconds(s);
    saveSettings({ feedbackSeconds: s });
  }, [saveSettings]);

  // ============================================================
  // Initialization — Check if questions are available
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    async function checkAndLoadQuestions() {
      // If already loaded for this language, go straight to menu
      if (isQuestionsLoaded() && getLoadedLanguage() === triviaLanguage) {
        setPhase('menu');
        return;
      }

      // Check if data is downloaded locally
      const status = await checkDataStatus('trivia', triviaLanguage);

      if (cancelled) return;

      if (status.isAvailable) {
        // Data is downloaded — load into memory
        const loaded = await loadQuestions(triviaLanguage);
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

    checkAndLoadQuestions();
    return () => { cancelled = true; };
  }, [triviaLanguage]);

  // ============================================================
  // Download handler
  // ============================================================

  const handleStartDownload = useCallback(async () => {
    setPhase('downloading');
    setDownloadProgress(0);
    setDownloadError(null);

    const result = await downloadGameData('trivia', triviaLanguage, (progress: DownloadProgress) => {
      setDownloadProgress(progress.progress);
    });

    if (!result.success) {
      setDownloadError(result.error || 'download_failed');
      setPhase('download');
      return;
    }

    // Load the downloaded questions into memory
    const loaded = await loadQuestions(triviaLanguage);
    if (loaded) {
      setPhase('menu');
    } else {
      setDownloadError('load_failed');
      setPhase('download');
    }
  }, [triviaLanguage]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    };
  }, []);

  // Question timer effect
  useEffect(() => {
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);

    if (!gameState || gameState.isComplete || gameState.showingFeedback || timerSeconds === 0) {
      return;
    }

    setQuestionTimer(timerSeconds);
    questionTimerRef.current = setInterval(() => {
      setQuestionTimer(prev => {
        if (prev <= 1) {
          if (questionTimerRef.current) clearInterval(questionTimerRef.current);
          // Time's up — submit null answer
          setGameState(prevState => {
            if (!prevState || prevState.showingFeedback) return prevState;
            const newState = handleTimerExpiry(prevState);
            // Auto-advance after feedback delay
            if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
            feedbackTimerRef.current = setTimeout(() => {
              setGameState(s => {
                if (!s) return s;
                const advanced = advanceToNextQuestion(s);
                if (advanced.isComplete) {
                  const score = calculateScore(advanced);
                  completeGame(score, isWin(advanced));
                  setPhase('gameover');
                }
                return advanced;
              });
            }, feedbackSeconds * 1000);
            return newState;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    };
  }, [gameState?.currentQuestionIndex, gameState?.isComplete, gameState?.showingFeedback, timerSeconds, feedbackSeconds, completeGame]);

  // Show category picker
  const handleShowCategories = useCallback(() => {
    setPhase('category');
  }, []);

  // Start game with selected theme
  const handleStartGame = useCallback(async (theme: TriviaTheme) => {
    const state = createInitialState(difficulty, theme, questionsPerRound, timerSeconds);
    setGameState(state);
    setPhase('playing');
    await startSession({
      gameType: 'trivia',
      mode: 'solo',
      difficulty: difficulty as GameDifficulty,
      players: [],
    });
  }, [difficulty, questionsPerRound, timerSeconds, startSession]);

  // Handle answer selection
  const handleSelectAnswer = useCallback((answer: string) => {
    if (!gameState || gameState.showingFeedback) return;

    // Stop question timer
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);

    const newState = submitAnswer(gameState, answer);
    setGameState(newState);

    // Auto-advance after feedback delay
    feedbackTimerRef.current = setTimeout(() => {
      setGameState(prev => {
        if (!prev) return prev;
        const advanced = advanceToNextQuestion(prev);
        if (advanced.isComplete) {
          const score = calculateScore(advanced);
          completeGame(score, isWin(advanced));
          setPhase('gameover');
        }
        return advanced;
      });
    }, feedbackSeconds * 1000);
  }, [gameState, feedbackSeconds, completeGame]);

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
            if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
            if (questionTimerRef.current) clearInterval(questionTimerRef.current);
            abandonGame();
            setPhase('menu');
            setGameState(null);
          },
        },
      ],
    );
  }, [t, abandonGame]);

  // Play again
  const handlePlayAgain = useCallback(() => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    setPhase('category');
    setGameState(null);
  }, []);

  const handleBackToLobby = useCallback(() => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    setPhase('menu');
    setGameState(null);
  }, []);

  // Game over stats
  const gameOverStats: GameOverStat[] = useMemo(() => {
    if (!gameState) return [];
    const correct = getCorrectCount(gameState);
    const total = gameState.questions.length;
    const stars = getStarRating(gameState);
    return [
      {
        label: t('games.trivia.correctAnswers'),
        value: `${correct}/${total}`,
        isHighlight: true,
      },
      {
        label: t('games.trivia.maxScore'),
        value: `${getMaxScore(gameState)}`,
      },
      { label: t('games.common.time'), value: formatTime(durationSeconds) },
      ...(stars ? [{
        label: t('games.common.stars', { count: stars }),
        value: '⭐'.repeat(stars),
        isHighlight: true,
      }] : []),
    ];
  }, [gameState, durationSeconds, t]);

  // Current question
  const currentQuestion = gameState ? getCurrentQuestion(gameState) : null;
  const lastAnswer = gameState?.answers[gameState.answers.length - 1];

  // ============================================================
  // Render — Loading Phase (checking if data is available)
  // ============================================================

  // Gamepad button for right side of ModuleHeader
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

  if (phase === 'loading') {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ModuleScreenLayout
          moduleId={MODULE_ID}
          moduleBlock={
            <ModuleHeader
              moduleId={MODULE_ID}
              icon="star"
              title={t('navigation.trivia')}
              skipSafeArea
              showGridButton={false}
              rightAccessory={renderGamepadButton(onBack)}
            />
          }
          controlsBlock={<></>}
          contentBlock={
            <View style={styles.downloadContent}>
              <ActivityIndicator size="large" color={moduleColor} />
              <Text style={[styles.downloadStatusText, { color: themeColors.textSecondary }]}>
                {t('games.trivia.download.checking')}
              </Text>
            </View>
          }
        />
      </View>
    );
  }

  // ============================================================
  // Render — Download Prompt Phase
  // ============================================================

  if (phase === 'download') {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ModuleScreenLayout
          moduleId={MODULE_ID}
          moduleBlock={
            <ModuleHeader
              moduleId={MODULE_ID}
              icon="star"
              title={t('navigation.trivia')}
              skipSafeArea
              showGridButton={false}
              rightAccessory={renderGamepadButton(onBack)}
            />
          }
          controlsBlock={<></>}
          contentBlock={
            <View style={styles.downloadContent}>
              <View style={[styles.downloadCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                <Text style={styles.downloadEmoji}>📥</Text>
                <Text style={[styles.downloadTitle, { color: themeColors.textPrimary }]}>
                  {t('games.trivia.download.title')}
                </Text>
                <Text style={[styles.downloadDescription, { color: themeColors.textSecondary }]}>
                  {t('games.trivia.download.description')}
                </Text>
                <Text style={[styles.downloadSize, { color: themeColors.textTertiary }]}>
                  {t('games.trivia.download.size')}
                </Text>

                {downloadError && (
                  <View style={styles.errorBanner}>
                    <Icon name="warning" size={20} color="#F44336" />
                    <Text style={styles.errorText}>
                      {t('games.trivia.download.error')}
                    </Text>
                  </View>
                )}

                <HapticTouchable
                  style={[styles.downloadButton, { backgroundColor: moduleColor }]}
                  onPress={handleStartDownload}
                >
                  <Icon name="download" size={24} color="#FFFFFF" />
                  <Text style={styles.downloadButtonText}>
                    {t('games.trivia.download.button')}
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
  // Render — Downloading Phase (progress indicator)
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
              icon="star"
              title={t('navigation.trivia')}
              skipSafeArea
              showGridButton={false}
              rightAccessory={renderGamepadButton(onBack)}
            />
          }
          controlsBlock={<></>}
          contentBlock={
            <View style={styles.downloadContent}>
              <View style={[styles.downloadCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                <Text style={styles.downloadEmoji}>📥</Text>
                <Text style={[styles.downloadTitle, { color: themeColors.textPrimary }]}>
                  {t('games.trivia.download.downloading')}
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
                  {t('games.trivia.download.pleaseWait')}
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
              icon="star"
              title={t('navigation.trivia')}
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
                  {t('games.trivia.title')}
                </Text>
                <Text style={[styles.menuDescription, { color: themeColors.textSecondary }]}>
                  {t('games.trivia.howToPlay')}
                </Text>

                {/* Difficulty */}
                <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                  {t('games.lobby.difficulty')}
                </Text>
                <DifficultyPicker
                  selected={difficulty as GameDifficulty}
                  onSelect={(d) => handleSetDifficulty(d as TriviaDifficulty)}
                  options={DIFFICULTY_OPTIONS}
                  moduleId={MODULE_ID}
                />

                {/* Questions per round */}
                <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                  {t('games.trivia.questionsPerRound')}
                </Text>
                <View style={styles.chipRow}>
                  {QUESTIONS_PER_ROUND_OPTIONS.map(count => (
                    <HapticTouchable
                      key={count}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: questionsPerRound === count ? moduleColor : themeColors.surface,
                          borderColor: questionsPerRound === count ? moduleColor : themeColors.border,
                        },
                      ]}
                      onPress={() => handleSetQuestionsPerRound(count)}
                    >
                      <Text style={[
                        styles.chipText,
                        { color: questionsPerRound === count ? '#FFFFFF' : themeColors.textPrimary },
                      ]}>
                        {count}
                      </Text>
                    </HapticTouchable>
                  ))}
                </View>

                {/* Timer */}
                <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                  {t('games.trivia.timerSetting')}
                </Text>
                <View style={styles.chipRow}>
                  {TIMER_OPTIONS.map(sec => (
                    <HapticTouchable
                      key={sec}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: timerSeconds === sec ? moduleColor : themeColors.surface,
                          borderColor: timerSeconds === sec ? moduleColor : themeColors.border,
                        },
                      ]}
                      onPress={() => handleSetTimerSeconds(sec)}
                    >
                      <Text style={[
                        styles.chipText,
                        { color: timerSeconds === sec ? '#FFFFFF' : themeColors.textPrimary },
                      ]}>
                        {sec === 0 ? t('games.trivia.timerOff') : `${sec}s`}
                      </Text>
                    </HapticTouchable>
                  ))}
                </View>

                {/* Feedback timer */}
                <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                  {t('games.trivia.feedbackTimer')}
                </Text>
                <View style={styles.chipRow}>
                  {FEEDBACK_TIMER_OPTIONS.map(sec => (
                    <HapticTouchable
                      key={sec}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: feedbackSeconds === sec ? moduleColor : themeColors.surface,
                          borderColor: feedbackSeconds === sec ? moduleColor : themeColors.border,
                        },
                      ]}
                      onPress={() => handleSetFeedbackSeconds(sec)}
                    >
                      <Text style={[
                        styles.chipText,
                        { color: feedbackSeconds === sec ? '#FFFFFF' : themeColors.textPrimary },
                      ]}>
                        {`${sec}s`}
                      </Text>
                    </HapticTouchable>
                  ))}
                </View>

                {/* Start button */}
                <HapticTouchable
                  style={[styles.startButton, { backgroundColor: moduleColor }]}
                  onPress={handleShowCategories}
                >
                  <Icon name="play" size={24} color="#FFFFFF" />
                  <Text style={styles.startButtonText}>
                    {t('games.trivia.chooseCategory')}
                  </Text>
                </HapticTouchable>
              </View>

              {/* Stats toggle */}
              <HapticTouchable
                style={[styles.statsToggle, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                onPress={() => setShowStats(prev => !prev)}
              >
                <Text style={[styles.statsToggleText, { color: moduleColor }]}>
                  {showStats ? t('games.trivia.hideStats') : t('games.trivia.showStats')}
                </Text>
              </HapticTouchable>

              {showStats && <GameStatsView gameType="trivia" moduleId={MODULE_ID} />}
            </View>
          }
        />
      </View>
    );
  }

  // ============================================================
  // Render — Category Selection Phase
  // ============================================================

  if (phase === 'category') {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ModuleScreenLayout
          moduleId={MODULE_ID}
          moduleBlock={
            <ModuleHeader
              moduleId={MODULE_ID}
              icon="star"
              title={t('navigation.trivia')}
              showBackButton
              onBackPress={() => setPhase('menu')}
              skipSafeArea
              showGridButton={false}
              rightAccessory={renderGamepadButton(onBack)}
            />
          }
          controlsBlock={<></>}
          contentBlock={
            <View style={styles.categoryContent}>
              <Text style={[styles.categoryTitle, { color: themeColors.textPrimary }]}>
                {t('games.trivia.chooseCategory')}
              </Text>
              <View style={styles.categoryGrid}>
                {ALL_TRIVIA_THEMES.map(theme => (
                  <HapticTouchable
                    key={theme}
                    style={[styles.categoryButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                    onPress={() => handleStartGame(theme)}
                  >
                    <Text style={styles.categoryEmoji}>
                      {getCategoryEmoji(theme)}
                    </Text>
                    <Text style={[styles.categoryLabel, { color: themeColors.textPrimary }]}>
                      {t(`games.trivia.themes.${theme}`)}
                    </Text>
                  </HapticTouchable>
                ))}
              </View>
            </View>
          }
        />
      </View>
    );
  }

  // ============================================================
  // Render — Playing Phase
  // ============================================================

  if (phase === 'playing' && gameState && currentQuestion) {
    const questionNum = gameState.currentQuestionIndex + 1;
    const totalQuestions = gameState.questions.length;

    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ModuleScreenLayout
          moduleId={MODULE_ID}
          moduleBlock={
            <ModuleHeader
              moduleId={MODULE_ID}
              icon="star"
              title={t('navigation.trivia')}
              skipSafeArea
              showGridButton={false}
              rightAccessory={renderGamepadButton(handleQuit, t('games.common.quit'))}
            />
          }
          controlsBlock={
            <GameHeader
              moduleId={MODULE_ID}
              showTimer={timerSeconds > 0}
              timer={timerSeconds > 0 ? questionTimer : durationSeconds}
              actions={[]}
            />
          }
          contentBlock={
            <View style={styles.playContent}>
            <ScrollView style={styles.playContent} contentContainerStyle={styles.playContentInner}>
              {/* Progress bar */}
              <View style={styles.progressContainer}>
                <View style={[styles.progressTrack, { backgroundColor: themeColors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: moduleColor,
                        width: `${(questionNum / totalQuestions) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: themeColors.textSecondary }]}>
                  {t('games.trivia.question', { number: questionNum, total: totalQuestions })}
                </Text>
              </View>

              {/* Score */}
              <Text style={[styles.scoreText, { color: moduleColor }]}>
                {t('games.common.score')}: {gameState.score}
              </Text>

              {/* Question card */}
              <View style={[styles.questionCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                <Text style={[styles.questionCategory, { color: moduleColor }]}>
                  {t(`games.trivia.themes.${currentQuestion.theme}`)}
                </Text>
                <Text style={[styles.questionText, { color: themeColors.textPrimary }]}>
                  {currentQuestion.question}
                </Text>
              </View>

              {/* Answer options */}
              <View style={styles.answersContainer}>
                {currentQuestion.options.map((option, index) => {
                  const isSelected = gameState.showingFeedback &&
                    lastAnswer?.selectedAnswer === option;
                  const isCorrectAnswer = gameState.showingFeedback &&
                    option === currentQuestion.correctAnswer;
                  const isWrongSelected = isSelected && !lastAnswer?.isCorrect;

                  let bgColor = themeColors.surface;
                  let borderColor = themeColors.border;
                  let textColor = themeColors.textPrimary;
                  let iconName: 'checkmark' | 'close' | null = null;

                  if (gameState.showingFeedback) {
                    if (isCorrectAnswer) {
                      bgColor = '#E8F5E9';
                      borderColor = '#4CAF50';
                      textColor = '#2E7D32';
                      iconName = 'checkmark';
                    } else if (isWrongSelected) {
                      bgColor = '#FFEBEE';
                      borderColor = '#F44336';
                      textColor = '#C62828';
                      iconName = 'close';
                    }
                  }

                  return (
                    <HapticTouchable
                      key={index}
                      style={[
                        styles.answerButton,
                        {
                          backgroundColor: bgColor,
                          borderColor,
                        },
                      ]}
                      onPress={() => handleSelectAnswer(option)}
                      hapticType={gameState.showingFeedback ? undefined : 'tap'}
                      hapticDisabled={gameState.showingFeedback}
                    >
                      <Text style={[styles.answerLabel, { color: themeColors.textSecondary }]}>
                        {String.fromCharCode(65 + index)}
                      </Text>
                      <Text style={[styles.answerText, { color: textColor }]} numberOfLines={3}>
                        {option}
                      </Text>
                      {iconName && (
                        <Icon
                          name={iconName}
                          size={24}
                          color={isCorrectAnswer ? '#4CAF50' : '#F44336'}
                        />
                      )}
                    </HapticTouchable>
                  );
                })}
              </View>

            </ScrollView>

              {/* Feedback overlay popup */}
              {gameState.showingFeedback && lastAnswer && (
                <View style={styles.feedbackOverlay} pointerEvents="none">
                  <View style={styles.feedbackBackdrop} />
                  <View style={[
                    styles.feedbackPopup,
                    {
                      backgroundColor: lastAnswer.isCorrect ? '#E8F5E9' : '#FFEBEE',
                      borderColor: lastAnswer.isCorrect ? '#4CAF50' : '#F44336',
                    },
                  ]}>
                    <Icon
                      name={lastAnswer.isCorrect ? 'checkmark-circle' : 'close-circle'}
                      size={48}
                      color={lastAnswer.isCorrect ? '#4CAF50' : '#F44336'}
                    />
                    <Text style={[
                      styles.feedbackPopupText,
                      { color: lastAnswer.isCorrect ? '#2E7D32' : '#C62828' },
                    ]}>
                      {lastAnswer.isCorrect
                        ? t('games.trivia.correct')
                        : t('games.trivia.wrong', { answer: currentQuestion.correctAnswer })
                      }
                    </Text>
                    {lastAnswer.isCorrect && (
                      <Text style={[styles.feedbackPopupPoints, { color: '#2E7D32' }]}>
                        +{lastAnswer.pointsEarned}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          }
        />
      </View>
    );
  }

  // ============================================================
  // Render — Game Over Phase
  // ============================================================

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ModuleScreenLayout
        moduleId={MODULE_ID}
        moduleBlock={
          <ModuleHeader
            moduleId={MODULE_ID}
            icon="star"
            title={t('navigation.trivia')}
            skipSafeArea
            showGridButton={false}
            rightAccessory={renderGamepadButton(onBack)}
          />
        }
        controlsBlock={<></>}
        contentBlock={<View />}
      />
      {gameState && (
        <GameOverModal
          visible={phase === 'gameover'}
          moduleId={MODULE_ID}
          title={isWin(gameState)
            ? t('games.common.congratulations')
            : t('games.common.completed')
          }
          score={calculateScore(gameState)}
          stats={gameOverStats}
          onPlayAgain={handlePlayAgain}
          onBackToLobby={() => { handleBackToLobby(); onBack(); }}
          onClose={handleBackToLobby}
        />
      )}
    </View>
  );
}

// ============================================================
// Helpers
// ============================================================

function getCategoryEmoji(theme: TriviaTheme): string {
  const emojiMap: Record<TriviaTheme, string> = {
    mixed: '🎲',
    general: '💡',
    science: '🔬',
    history: '🏛️',
    arts: '🎨',
    entertainment: '🎬',
    sports: '⚽',
    animals: '🐾',
  };
  return emojiMap[theme] || '❓';
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Download phases
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    width: '100%',
  },
  errorText: {
    ...typography.body,
    color: '#C62828',
    flex: 1,
  },

  // Menu phase
  menuContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  menuCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.lg,
  },
  menuTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  menuDescription: {
    ...typography.body,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  settingLabel: {
    ...typography.body,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    ...typography.body,
    fontWeight: '600',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.comfortable,
    borderRadius: borderRadius.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  startButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsToggle: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  statsToggleText: {
    ...typography.body,
    fontWeight: '600',
  },

  // Category phase
  categoryContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  categoryTitle: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
  },
  categoryButton: {
    width: '45%',
    minHeight: touchTargets.comfortable,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  categoryLabel: {
    ...typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Playing phase
  playContent: {
    flex: 1,
  },
  playContentInner: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  progressContainer: {
    marginBottom: spacing.md,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    ...typography.label,
    textAlign: 'center',
  },
  scoreText: {
    ...typography.body,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  questionCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  questionCategory: {
    ...typography.label,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  questionText: {
    ...typography.h3,
    lineHeight: 32,
  },
  answersContainer: {
    gap: spacing.sm,
  },
  answerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.comfortable,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  answerLabel: {
    ...typography.body,
    fontWeight: '700',
    width: 28,
  },
  answerText: {
    ...typography.body,
    flex: 1,
  },
  // Feedback overlay popup
  feedbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  feedbackPopup: {
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    padding: spacing.xl,
    alignItems: 'center',
    width: '75%',
    maxWidth: 320,
    gap: spacing.sm,
  },
  feedbackPopupText: {
    ...typography.body,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  feedbackPopupPoints: {
    ...typography.h3,
    fontWeight: '700',
  },

  // Gamepad button (right side of ModuleHeader)
  gamepadButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
