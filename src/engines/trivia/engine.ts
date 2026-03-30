/**
 * Trivia Game Engine — CommEazy
 *
 * Pure functions for trivia quiz game logic.
 * No React, no state management — just game rules.
 *
 * @see .claude/plans/TRIVIA_DESIGN.md
 * @see src/types/games.ts
 */

import type {
  TriviaState,
  TriviaDisplayQuestion,
  TriviaAnswerResult,
  TriviaDifficulty,
  TriviaTheme,
  TriviaQuestion,
} from './types';
import { DIFFICULTY_POINTS } from './types';
import { getQuestions } from './questionBank';

// ============================================================
// Helpers
// ============================================================

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Convert a TriviaQuestion to a TriviaDisplayQuestion with shuffled options
 */
function toDisplayQuestion(question: TriviaQuestion): TriviaDisplayQuestion {
  const options = shuffle([question.correctAnswer, ...question.incorrectAnswers]);
  return { ...question, options };
}

// ============================================================
// Engine Functions
// ============================================================

/**
 * Create initial game state for a new trivia round
 */
export function createInitialState(
  difficulty: TriviaDifficulty,
  theme: TriviaTheme,
  questionsPerRound: number,
  timerSeconds: number,
): TriviaState {
  const rawQuestions = getQuestions(difficulty, theme, questionsPerRound);
  const questions = rawQuestions.map(toDisplayQuestion);

  return {
    difficulty,
    theme,
    questionsPerRound,
    timerSeconds,
    questions,
    currentQuestionIndex: 0,
    answers: [],
    score: 0,
    isComplete: questions.length === 0,
    showingFeedback: false,
  };
}

/**
 * Get the current question to display
 */
export function getCurrentQuestion(state: TriviaState): TriviaDisplayQuestion | null {
  if (state.isComplete) return null;
  if (state.currentQuestionIndex >= state.questions.length) return null;
  return state.questions[state.currentQuestionIndex];
}

/**
 * Submit an answer for the current question.
 * Returns new state with feedback visible.
 */
export function submitAnswer(
  state: TriviaState,
  selectedAnswer: string | null,
): TriviaState {
  if (state.isComplete || state.showingFeedback) return state;

  const question = getCurrentQuestion(state);
  if (!question) return state;

  const isCorrect = selectedAnswer === question.correctAnswer;
  const pointsEarned = isCorrect ? DIFFICULTY_POINTS[state.difficulty] : 0;

  const result: TriviaAnswerResult = {
    questionIndex: state.currentQuestionIndex,
    question,
    selectedAnswer,
    isCorrect,
    pointsEarned,
  };

  return {
    ...state,
    answers: [...state.answers, result],
    score: state.score + pointsEarned,
    showingFeedback: true,
  };
}

/**
 * Advance to the next question after feedback is shown.
 * If this was the last question, marks the round as complete.
 */
export function advanceToNextQuestion(state: TriviaState): TriviaState {
  if (!state.showingFeedback) return state;

  const nextIndex = state.currentQuestionIndex + 1;
  const isComplete = nextIndex >= state.questions.length;

  return {
    ...state,
    currentQuestionIndex: nextIndex,
    showingFeedback: false,
    isComplete,
  };
}

/**
 * Handle timer expiry — submit null answer (time ran out)
 */
export function handleTimerExpiry(state: TriviaState): TriviaState {
  return submitAnswer(state, null);
}

// ============================================================
// Scoring & Stats
// ============================================================

/**
 * Calculate final score (already tracked in state.score, but
 * this provides a clean function for GameOverModal)
 */
export function calculateScore(state: TriviaState): number {
  return state.score;
}

/**
 * Get number of correct answers
 */
export function getCorrectCount(state: TriviaState): number {
  return state.answers.filter(a => a.isCorrect).length;
}

/**
 * Get total number of questions answered
 */
export function getTotalAnswered(state: TriviaState): number {
  return state.answers.length;
}

/**
 * Determine if the player "won" (≥50% correct)
 */
export function isWin(state: TriviaState): boolean {
  if (!state.isComplete) return false;
  return getCorrectCount(state) >= Math.ceil(state.questions.length / 2);
}

/**
 * Get star rating based on percentage correct
 * 3 stars: ≥90%, 2 stars: ≥60%, 1 star: ≥30%
 */
export function getStarRating(state: TriviaState): 1 | 2 | 3 | undefined {
  if (!state.isComplete || state.questions.length === 0) return undefined;
  const pct = getCorrectCount(state) / state.questions.length;
  if (pct >= 0.9) return 3;
  if (pct >= 0.6) return 2;
  if (pct >= 0.3) return 1;
  return undefined;
}

/**
 * Maximum possible score for this round
 */
export function getMaxScore(state: TriviaState): number {
  return state.questions.length * DIFFICULTY_POINTS[state.difficulty];
}

// ============================================================
// Serialization (for database storage)
// ============================================================

/**
 * Serialize state for WatermelonDB state_snapshot
 */
export function serializeState(state: TriviaState): Record<string, unknown> {
  return {
    difficulty: state.difficulty,
    theme: state.theme,
    questionsPerRound: state.questionsPerRound,
    timerSeconds: state.timerSeconds,
    questions: state.questions,
    currentQuestionIndex: state.currentQuestionIndex,
    answers: state.answers,
    score: state.score,
    isComplete: state.isComplete,
    showingFeedback: state.showingFeedback,
  };
}

/**
 * Deserialize state from database snapshot
 */
export function deserializeState(snapshot: Record<string, unknown>): TriviaState {
  return {
    difficulty: (snapshot.difficulty as TriviaDifficulty) || 'medium',
    theme: (snapshot.theme as TriviaTheme) || 'mixed',
    questionsPerRound: (snapshot.questionsPerRound as number) || 10,
    timerSeconds: (snapshot.timerSeconds as number) || 0,
    questions: (snapshot.questions as TriviaDisplayQuestion[]) || [],
    currentQuestionIndex: (snapshot.currentQuestionIndex as number) || 0,
    answers: (snapshot.answers as TriviaAnswerResult[]) || [],
    score: (snapshot.score as number) || 0,
    isComplete: (snapshot.isComplete as boolean) || false,
    showingFeedback: (snapshot.showingFeedback as boolean) || false,
  };
}
