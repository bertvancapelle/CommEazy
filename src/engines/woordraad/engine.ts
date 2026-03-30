/**
 * Woordraad Game Engine — Wordle-style word guessing
 *
 * The player guesses a 5-letter word in up to 6 attempts.
 * Each guess receives per-letter feedback:
 * - correct: letter is in the right position (green)
 * - present: letter is in the word but wrong position (yellow)
 * - absent:  letter is not in the word (grey)
 *
 * Word lists are loaded externally via downloadService + wordBank.
 * Two-list architecture:
 * - targetWords: common words (Hunspell ∩ OpenSubtitles top-5000) — game solutions
 * - validGuesses: all 5-letter words (full Hunspell) — accepted player input
 *
 * Solo mode only for now. Multiplayer support via XMPP planned.
 *
 * @see src/engines/woordraad/wordBank.ts
 * @see src/services/downloadService.ts
 * @see src/types/games.ts
 */

// ============================================================
// Types
// ============================================================

export type LetterStatus = 'correct' | 'present' | 'absent' | 'empty';

export interface LetterResult {
  letter: string;
  status: LetterStatus;
}

export interface WoordraadState {
  /** The target word (hidden from UI until game over) */
  targetWord: string;
  /** All guesses made so far (max 6) */
  guesses: string[];
  /** Feedback for each guess */
  results: LetterResult[][];
  /** Current input (not yet submitted) */
  currentInput: string;
  /** Whether the game is over */
  isGameOver: boolean;
  /** Whether the player won */
  isWon: boolean;
  /** Keyboard letter statuses (for on-screen keyboard coloring) */
  letterStatuses: Record<string, LetterStatus>;
}

// ============================================================
// Constants
// ============================================================

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

// ============================================================
// Word Data Type (loaded from woordraad-{lang}.json)
// ============================================================

/**
 * Shape of the downloaded woordraad JSON file.
 * Contains two lists: frequent target words and all valid guesses.
 */
export interface WoordraadWordData {
  language: string;
  version: string;
  generated: string;
  source: string;
  /** Common 5-letter words — used as game solutions */
  targetWords: string[];
  /** All valid 5-letter words — accepted as player guesses */
  validGuesses: string[];
}

// ============================================================
// Engine Functions
// ============================================================

/**
 * Pick a random target word from the loaded word list
 */
export function pickRandomWord(targetWords: string[]): string {
  if (targetWords.length === 0) {
    // Fallback — should never happen if wordBank is loaded
    console.warn('[Woordraad] pickRandomWord called with empty word list');
    return 'WOORD';
  }
  const index = Math.floor(Math.random() * targetWords.length);
  return targetWords[index].toUpperCase();
}

/**
 * Create initial game state
 *
 * @param targetWords - List of possible target words (from wordBank)
 * @param targetWord - Optional specific target word (for testing/multiplayer)
 */
export function createInitialState(targetWords: string[], targetWord?: string): WoordraadState {
  return {
    targetWord: targetWord || pickRandomWord(targetWords),
    guesses: [],
    results: [],
    currentInput: '',
    isGameOver: false,
    isWon: false,
    letterStatuses: {},
  };
}

/**
 * Evaluate a guess against the target word.
 *
 * Algorithm (handles duplicate letters correctly):
 * 1. First pass: mark exact matches (correct)
 * 2. Second pass: mark present/absent for remaining letters
 */
export function evaluateGuess(guess: string, target: string): LetterResult[] {
  const g = guess.toUpperCase().split('');
  const t = target.toUpperCase().split('');
  const result: LetterResult[] = g.map(letter => ({ letter, status: 'empty' as LetterStatus }));

  // Track which target letters are "consumed"
  const targetConsumed = new Array(t.length).fill(false);

  // Pass 1: exact matches
  for (let i = 0; i < g.length; i++) {
    if (g[i] === t[i]) {
      result[i].status = 'correct';
      targetConsumed[i] = true;
    }
  }

  // Pass 2: present or absent
  for (let i = 0; i < g.length; i++) {
    if (result[i].status === 'correct') continue;

    const targetIndex = t.findIndex((letter, j) => letter === g[i] && !targetConsumed[j]);
    if (targetIndex >= 0) {
      result[i].status = 'present';
      targetConsumed[targetIndex] = true;
    } else {
      result[i].status = 'absent';
    }
  }

  return result;
}

/**
 * Update keyboard letter statuses after a guess.
 * Priority: correct > present > absent (a letter never "downgrades")
 */
export function updateLetterStatuses(
  existing: Record<string, LetterStatus>,
  results: LetterResult[],
): Record<string, LetterStatus> {
  const updated = { ...existing };
  const priority: Record<LetterStatus, number> = {
    correct: 3,
    present: 2,
    absent: 1,
    empty: 0,
  };

  for (const { letter, status } of results) {
    const current = updated[letter] || 'empty';
    if (priority[status] > priority[current]) {
      updated[letter] = status;
    }
  }

  return updated;
}

/**
 * Check if a guess is valid (correct length, in word list).
 * Returns null if valid, or an error key for i18n.
 *
 * @param guess - The player's guess
 * @param validGuesses - Set of all accepted words (uppercase)
 */
export function validateGuess(guess: string, validGuesses: Set<string>): string | null {
  if (guess.length !== WORD_LENGTH) {
    return 'games.woordraad.errorTooShort';
  }
  if (!validGuesses.has(guess.toUpperCase())) {
    return 'games.woordraad.errorNotInList';
  }
  return null;
}

/**
 * Submit a guess and return the new state.
 * Returns null if the guess is invalid.
 */
export function submitGuess(state: WoordraadState, guess: string): WoordraadState | null {
  if (state.isGameOver) return null;
  if (guess.length !== WORD_LENGTH) return null;

  const upperGuess = guess.toUpperCase();
  const results = evaluateGuess(upperGuess, state.targetWord);
  const newGuesses = [...state.guesses, upperGuess];
  const newResults = [...state.results, results];
  const isWon = results.every(r => r.status === 'correct');
  const isGameOver = isWon || newGuesses.length >= MAX_GUESSES;
  const letterStatuses = updateLetterStatuses(state.letterStatuses, results);

  return {
    ...state,
    guesses: newGuesses,
    results: newResults,
    currentInput: '',
    isGameOver,
    isWon,
    letterStatuses,
  };
}

/**
 * Calculate score based on performance.
 * Fewer guesses = higher score. Win bonus included.
 */
export function calculateScore(state: WoordraadState): number {
  if (!state.isWon) return 0;

  const guessCount = state.guesses.length;
  // Score: 600 for 1 guess, 500 for 2, ... 100 for 6
  const baseScore = (MAX_GUESSES - guessCount + 1) * 100;
  return baseScore;
}

/**
 * Serialize state for database storage (hides target word from snapshot
 * only if game is still in progress).
 */
export function serializeState(state: WoordraadState): Record<string, unknown> {
  return {
    targetWord: state.targetWord,
    guesses: state.guesses,
    results: state.results,
    isGameOver: state.isGameOver,
    isWon: state.isWon,
    letterStatuses: state.letterStatuses,
  };
}

/**
 * Deserialize state from database snapshot.
 *
 * @param snapshot - Serialized state from database
 * @param targetWords - Word list for fallback target (from wordBank)
 */
export function deserializeState(snapshot: Record<string, unknown>, targetWords: string[]): WoordraadState {
  return {
    targetWord: (snapshot.targetWord as string) || pickRandomWord(targetWords),
    guesses: (snapshot.guesses as string[]) || [],
    results: (snapshot.results as LetterResult[][]) || [],
    currentInput: '',
    isGameOver: (snapshot.isGameOver as boolean) || false,
    isWon: (snapshot.isWon as boolean) || false,
    letterStatuses: (snapshot.letterStatuses as Record<string, LetterStatus>) || {},
  };
}

/**
 * Get star rating (1-3) based on number of guesses.
 */
export function getStarRating(state: WoordraadState): 1 | 2 | 3 | undefined {
  if (!state.isWon) return undefined;
  const guesses = state.guesses.length;
  if (guesses <= 2) return 3;
  if (guesses <= 4) return 2;
  return 1;
}
