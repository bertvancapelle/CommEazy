/**
 * Trivia Question Bank — CommEazy
 *
 * Reads trivia questions from locally downloaded JSON files.
 * Questions are downloaded per language via downloadService on first launch.
 *
 * File format (trivia-{lang}.json):
 * {
 *   "version": "1.0",
 *   "language": "nl",
 *   "questionCount": 200,
 *   "questions": [ { id, category, theme, difficulty, question, correctAnswer, incorrectAnswers } ]
 * }
 *
 * Source: OpenTDB (CC BY-SA 4.0) — translated per language
 * @see https://opentdb.com/
 * @see src/services/downloadService.ts
 */

import type { TriviaQuestion, TriviaDifficulty, TriviaTheme } from './types';
import { readLocalGameData } from '@/services/downloadService';

// ============================================================
// OpenTDB Category → Theme Mapping
// ============================================================

const CATEGORY_THEME_MAP: Record<string, TriviaTheme> = {
  'General Knowledge': 'general',
  'Entertainment: Books': 'arts',
  'Entertainment: Film': 'entertainment',
  'Entertainment: Music': 'entertainment',
  'Entertainment: Musicals & Theatres': 'arts',
  'Entertainment: Television': 'entertainment',
  'Entertainment: Video Games': 'entertainment',
  'Entertainment: Board Games': 'entertainment',
  'Entertainment: Comics': 'entertainment',
  'Entertainment: Japanese Anime & Manga': 'entertainment',
  'Entertainment: Cartoon & Animations': 'entertainment',
  'Science & Nature': 'science',
  'Science: Computers': 'science',
  'Science: Mathematics': 'science',
  'Science: Gadgets': 'science',
  'Mythology': 'arts',
  'Sports': 'sports',
  'Geography': 'history',
  'History': 'history',
  'Politics': 'history',
  'Art': 'arts',
  'Celebrities': 'entertainment',
  'Animals': 'animals',
  'Vehicles': 'animals',
};

/**
 * Map an OpenTDB category string to a broad theme
 */
export function mapCategoryToTheme(category: string): TriviaTheme {
  return CATEGORY_THEME_MAP[category] || 'general';
}

// ============================================================
// Downloaded Questions File Format
// ============================================================

interface TriviaDataFile {
  version: string;
  language: string;
  questionCount: number;
  questions: TriviaQuestion[];
}

// ============================================================
// In-Memory Cache
// ============================================================

let cachedQuestions: TriviaQuestion[] = [];
let cachedLanguage: string | null = null;

/**
 * Load questions from local storage into memory.
 * Called once when TriviaScreen detects data is available.
 *
 * @param language - Language code (e.g. 'nl', 'en')
 * @returns true if questions were loaded successfully
 */
export async function loadQuestions(language: string): Promise<boolean> {
  // Return cached if already loaded for this language
  if (cachedLanguage === language && cachedQuestions.length > 0) {
    return true;
  }

  try {
    const data = await readLocalGameData<TriviaDataFile>('trivia', language);
    if (!data || !data.questions || data.questions.length === 0) {
      console.warn(`[QuestionBank] No questions found for language: ${language}`);
      return false;
    }

    cachedQuestions = data.questions;
    cachedLanguage = language;
    console.info(`[QuestionBank] Loaded ${cachedQuestions.length} questions for ${language}`);
    return true;
  } catch (error) {
    console.error(`[QuestionBank] Failed to load questions for ${language}:`, error);
    return false;
  }
}

/**
 * Clear the in-memory question cache
 */
export function clearQuestionCache(): void {
  cachedQuestions = [];
  cachedLanguage = null;
}

// ============================================================
// Query Functions
// ============================================================

/**
 * Get questions filtered by difficulty and theme.
 * Questions MUST be loaded first via loadQuestions().
 */
export function getQuestions(
  difficulty: TriviaDifficulty,
  theme: TriviaTheme,
  count: number,
): TriviaQuestion[] {
  let pool = [...cachedQuestions];

  // Filter by difficulty
  pool = pool.filter(q => q.difficulty === difficulty);

  // Filter by theme (unless 'mixed')
  if (theme !== 'mixed') {
    pool = pool.filter(q => q.theme === theme);
  }

  // Shuffle using Fisher-Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // If we don't have enough questions in the filtered pool,
  // fill with questions from other themes at the same difficulty
  if (pool.length < count && theme !== 'mixed') {
    const fallback = cachedQuestions
      .filter(q => q.difficulty === difficulty && q.theme !== theme)
      .sort(() => Math.random() - 0.5);

    const existing = new Set(pool.map(q => q.id));
    for (const q of fallback) {
      if (pool.length >= count) break;
      if (!existing.has(q.id)) {
        pool.push(q);
      }
    }
  }

  return pool.slice(0, count);
}

/**
 * Get the total number of available questions per difficulty.
 * Returns zeros if questions are not loaded.
 */
export function getQuestionCounts(): Record<TriviaDifficulty, number> {
  return {
    easy: cachedQuestions.filter(q => q.difficulty === 'easy').length,
    medium: cachedQuestions.filter(q => q.difficulty === 'medium').length,
    hard: cachedQuestions.filter(q => q.difficulty === 'hard').length,
  };
}

/**
 * Check whether questions are loaded in memory
 */
export function isQuestionsLoaded(): boolean {
  return cachedQuestions.length > 0;
}

/**
 * Get the language of the currently loaded questions
 */
export function getLoadedLanguage(): string | null {
  return cachedLanguage;
}
