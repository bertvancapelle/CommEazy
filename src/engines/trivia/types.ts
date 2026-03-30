/**
 * Trivia Game Types — CommEazy
 *
 * Type definitions for the trivia quiz game.
 * Multiple-choice (4 options), 3 difficulty levels, 8 category themes.
 *
 * @see .claude/plans/TRIVIA_DESIGN.md
 * @see src/types/games.ts
 */

// ============================================================
// Category Themes (grouped from OpenTDB categories)
// ============================================================

/**
 * Broad category themes — 8 groups derived from ~24 OpenTDB categories.
 * Easier for seniors to choose from than 24 fine-grained categories.
 */
export type TriviaTheme =
  | 'science'        // Wetenschap & Natuur
  | 'history'        // Geschiedenis & Aardrijkskunde
  | 'arts'           // Kunst & Cultuur
  | 'entertainment'  // Entertainment (film, tv, muziek, games)
  | 'sports'         // Sport
  | 'general'        // Algemene Kennis
  | 'animals'        // Dieren & Voertuigen
  | 'mixed';         // Gemengd (alle categorieën)

/**
 * All selectable themes (for category picker)
 */
export const ALL_TRIVIA_THEMES: TriviaTheme[] = [
  'mixed',
  'general',
  'science',
  'history',
  'arts',
  'entertainment',
  'sports',
  'animals',
];

// ============================================================
// Difficulty
// ============================================================

export type TriviaDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Points awarded per difficulty level (correct answer)
 */
export const DIFFICULTY_POINTS: Record<TriviaDifficulty, number> = {
  easy: 10,
  medium: 20,
  hard: 30,
};

// ============================================================
// Questions
// ============================================================

/**
 * A single trivia question (multiple-choice, 4 options)
 */
export interface TriviaQuestion {
  /** Unique question ID */
  id: string;
  /** Original OpenTDB category string */
  category: string;
  /** Mapped broad theme */
  theme: TriviaTheme;
  /** Difficulty level */
  difficulty: TriviaDifficulty;
  /** The question text */
  question: string;
  /** The correct answer */
  correctAnswer: string;
  /** Three incorrect answers */
  incorrectAnswers: string[];
}

/**
 * A question with shuffled answer options (ready for display)
 */
export interface TriviaDisplayQuestion extends TriviaQuestion {
  /** All 4 options in shuffled order */
  options: string[];
}

// ============================================================
// Answer Result
// ============================================================

export interface TriviaAnswerResult {
  /** Index of the question in the round */
  questionIndex: number;
  /** The question that was answered */
  question: TriviaDisplayQuestion;
  /** The answer the player selected (null if time ran out) */
  selectedAnswer: string | null;
  /** Whether the answer was correct */
  isCorrect: boolean;
  /** Points earned for this question */
  pointsEarned: number;
}

// ============================================================
// Game State
// ============================================================

export interface TriviaState {
  /** Selected difficulty for this round */
  difficulty: TriviaDifficulty;
  /** Selected category theme */
  theme: TriviaTheme;
  /** Number of questions in this round */
  questionsPerRound: number;
  /** Timer seconds per question (0 = no timer) */
  timerSeconds: number;
  /** All questions for this round (shuffled options) */
  questions: TriviaDisplayQuestion[];
  /** Current question index (0-based) */
  currentQuestionIndex: number;
  /** Results for answered questions */
  answers: TriviaAnswerResult[];
  /** Running score */
  score: number;
  /** Whether the round is complete */
  isComplete: boolean;
  /** Whether we're showing feedback for the current answer */
  showingFeedback: boolean;
}

// ============================================================
// Settings (persisted in AsyncStorage)
// ============================================================

export interface TriviaSettings {
  difficulty: TriviaDifficulty;
  questionsPerRound: number;
  timerSeconds: number;
  feedbackSeconds: number;
}

export const DEFAULT_TRIVIA_SETTINGS: TriviaSettings = {
  difficulty: 'medium',
  questionsPerRound: 10,
  timerSeconds: 0, // No timer by default (senior-friendly)
  feedbackSeconds: 2, // Show answer feedback for 2 seconds
};

export const QUESTIONS_PER_ROUND_OPTIONS = [5, 10, 15, 20] as const;
export const TIMER_OPTIONS = [0, 15, 30, 60] as const;
export const FEEDBACK_TIMER_OPTIONS = [1, 2, 3, 5] as const;
