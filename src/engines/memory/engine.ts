/**
 * Memory Game Engine — Emoji pair matching
 *
 * Player flips cards to find matching emoji pairs.
 * Grid size varies by difficulty:
 * - easy: 4×3 = 12 cards (6 pairs)
 * - medium: 4×4 = 16 cards (8 pairs)
 * - hard: 5×4 = 20 cards (10 pairs)
 * - expert: 6×5 = 30 cards (15 pairs)
 *
 * Multiplayer-capable (future), solo mode first.
 *
 * @see src/types/games.ts
 */

import type { GameDifficulty } from '@/types/games';

// ============================================================
// Types
// ============================================================

export interface MemoryCard {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export interface MemoryState {
  cards: MemoryCard[];
  gridCols: number;
  gridRows: number;
  flippedIndices: number[];    // Currently flipped (max 2)
  matchedPairs: number;
  totalPairs: number;
  moveCount: number;           // Each pair of flips = 1 move
  isComplete: boolean;
  isWon: boolean;
  difficulty: GameDifficulty;
  isCheckingMatch: boolean;    // True while waiting for flip-back
}

// ============================================================
// Constants
// ============================================================

/** Grid configuration per difficulty */
const GRID_CONFIG: Record<GameDifficulty, { cols: number; rows: number }> = {
  easy: { cols: 4, rows: 3 },       // 12 cards = 6 pairs
  medium: { cols: 4, rows: 4 },     // 16 cards = 8 pairs
  hard: { cols: 5, rows: 4 },       // 20 cards = 10 pairs
  expert: { cols: 6, rows: 5 },     // 30 cards = 15 pairs
};

/**
 * Emoji sets — senior-friendly, universally recognizable
 * Mixed categories for variety per game
 */
const ALL_EMOJIS: string[] = [
  // Animals (15)
  '🐶', '🐱', '🐰', '🐻', '🦊',
  '🐸', '🐥', '🦋', '🐠', '🐢',
  '🦉', '🐝', '🐞', '🦀', '🐬',
  // Food (10)
  '🍎', '🍊', '🍋', '🍓', '🍇',
  '🍉', '🍌', '🥕', '🍕', '☕',
  // Nature (10)
  '🌺', '🌻', '🌹', '🌷', '🌸',
  '⭐', '🌈', '☀️', '🌙', '❄️',
  // Objects (10)
  '🎈', '🎁', '🏠', '⚽', '🎵',
  '📚', '🔔', '💎', '🕐', '🚗',
];

// ============================================================
// Utility Functions
// ============================================================

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ============================================================
// Engine Functions
// ============================================================

/**
 * Create initial game state — select random emojis, create pairs, shuffle.
 */
export function createInitialState(difficulty: GameDifficulty = 'easy'): MemoryState {
  const config = GRID_CONFIG[difficulty];
  const totalCards = config.cols * config.rows;
  const totalPairs = totalCards / 2;

  // Select random emojis for pairs
  const selectedEmojis = shuffleArray(ALL_EMOJIS).slice(0, totalPairs);

  // Create pairs
  const cards: MemoryCard[] = [];
  let id = 0;
  for (const emoji of selectedEmojis) {
    cards.push({ id: id++, emoji, isFlipped: false, isMatched: false });
    cards.push({ id: id++, emoji, isFlipped: false, isMatched: false });
  }

  // Shuffle card positions
  const shuffledCards = shuffleArray(cards).map((card, index) => ({
    ...card,
    id: index, // Re-assign IDs based on position
  }));

  return {
    cards: shuffledCards,
    gridCols: config.cols,
    gridRows: config.rows,
    flippedIndices: [],
    matchedPairs: 0,
    totalPairs,
    moveCount: 0,
    isComplete: false,
    isWon: false,
    difficulty,
    isCheckingMatch: false,
  };
}

/**
 * Flip a card. Returns new state.
 *
 * Rules:
 * - Can't flip already matched cards
 * - Can't flip already flipped cards
 * - Can't flip while checking a match (2 cards visible)
 * - Max 2 cards flipped at once
 */
export function flipCard(state: MemoryState, index: number): MemoryState | null {
  // Guard conditions
  if (state.isComplete) return null;
  if (state.isCheckingMatch) return null;
  if (index < 0 || index >= state.cards.length) return null;

  const card = state.cards[index];
  if (card.isFlipped || card.isMatched) return null;
  if (state.flippedIndices.length >= 2) return null;

  // Flip the card
  const newCards = state.cards.map((c, i) =>
    i === index ? { ...c, isFlipped: true } : { ...c },
  );

  const newFlipped = [...state.flippedIndices, index];
  const isCheckingMatch = newFlipped.length === 2;

  return {
    ...state,
    cards: newCards,
    flippedIndices: newFlipped,
    isCheckingMatch,
  };
}

/**
 * Check if the two flipped cards match.
 * Call this after flipCard when flippedIndices.length === 2.
 *
 * Returns: { state, isMatch }
 * - If match: cards stay face-up, marked as matched
 * - If no match: cards flip back face-down
 */
export function checkMatch(state: MemoryState): { state: MemoryState; isMatch: boolean } {
  if (state.flippedIndices.length !== 2) {
    return { state, isMatch: false };
  }

  const [idx1, idx2] = state.flippedIndices;
  const card1 = state.cards[idx1];
  const card2 = state.cards[idx2];
  const isMatch = card1.emoji === card2.emoji;

  let newCards: MemoryCard[];
  let matchedPairs = state.matchedPairs;

  if (isMatch) {
    // Mark both as matched (stay face-up)
    newCards = state.cards.map((c, i) =>
      i === idx1 || i === idx2
        ? { ...c, isMatched: true }
        : { ...c },
    );
    matchedPairs++;
  } else {
    // Flip both back face-down
    newCards = state.cards.map((c, i) =>
      i === idx1 || i === idx2
        ? { ...c, isFlipped: false }
        : { ...c },
    );
  }

  const isComplete = matchedPairs === state.totalPairs;

  return {
    state: {
      ...state,
      cards: newCards,
      flippedIndices: [],
      matchedPairs,
      moveCount: state.moveCount + 1,
      isComplete,
      isWon: isComplete,
      isCheckingMatch: false,
    },
    isMatch,
  };
}

/**
 * Reset flipped cards (for timeout-based flip-back).
 * Use this when the match check delay has passed.
 */
export function resetFlipped(state: MemoryState): MemoryState {
  if (state.flippedIndices.length === 0) return state;

  const newCards = state.cards.map((c, i) =>
    state.flippedIndices.includes(i) && !c.isMatched
      ? { ...c, isFlipped: false }
      : { ...c },
  );

  return {
    ...state,
    cards: newCards,
    flippedIndices: [],
    isCheckingMatch: false,
  };
}

// ============================================================
// Scoring
// ============================================================

/**
 * Calculate score based on moves, time, and difficulty.
 */
export function calculateScore(state: MemoryState, durationSeconds: number = 0): number {
  if (!state.isWon) return 0;

  const difficultyMultiplier: Record<GameDifficulty, number> = {
    easy: 1,
    medium: 1.5,
    hard: 2,
    expert: 3,
  };

  // Perfect score: matched all pairs in minimum moves
  const perfectMoves = state.totalPairs;
  const moveEfficiency = Math.max(0, 1 - (state.moveCount - perfectMoves) / (perfectMoves * 3));

  const base = 1000 * difficultyMultiplier[state.difficulty];
  const moveBonus = Math.round(base * moveEfficiency);
  const timeBonus = Math.max(0, 200 - Math.floor(durationSeconds / 3));

  return moveBonus + timeBonus;
}

/**
 * Get star rating.
 */
export function getStarRating(state: MemoryState): 1 | 2 | 3 | undefined {
  if (!state.isWon) return undefined;

  const perfectMoves = state.totalPairs;
  const ratio = state.moveCount / perfectMoves;

  if (ratio <= 1.5) return 3;  // Near perfect
  if (ratio <= 2.5) return 2;  // Good
  return 1;                     // Completed
}

// ============================================================
// Serialization
// ============================================================

export function serializeState(state: MemoryState): Record<string, unknown> {
  return {
    cards: state.cards,
    gridCols: state.gridCols,
    gridRows: state.gridRows,
    matchedPairs: state.matchedPairs,
    totalPairs: state.totalPairs,
    moveCount: state.moveCount,
    isComplete: state.isComplete,
    isWon: state.isWon,
    difficulty: state.difficulty,
  };
}

export function deserializeState(snapshot: Record<string, unknown>): MemoryState {
  const cards = (snapshot.cards as MemoryCard[]) || [];
  return {
    cards: cards.map(c => ({ ...c, isFlipped: c.isMatched })), // Only show matched
    gridCols: (snapshot.gridCols as number) || 4,
    gridRows: (snapshot.gridRows as number) || 3,
    flippedIndices: [],
    matchedPairs: (snapshot.matchedPairs as number) || 0,
    totalPairs: (snapshot.totalPairs as number) || 6,
    moveCount: (snapshot.moveCount as number) || 0,
    isComplete: (snapshot.isComplete as boolean) || false,
    isWon: (snapshot.isWon as boolean) || false,
    difficulty: (snapshot.difficulty as GameDifficulty) || 'easy',
    isCheckingMatch: false,
  };
}
