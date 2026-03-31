/**
 * Solitaire Game Engine — Klondike Solitaire
 *
 * Standard Klondike rules:
 * - 7 tableau columns (1-7 cards, top face-up)
 * - Stock pile (remaining cards, draw 1 or 3)
 * - 4 foundation piles (Ace → King per suit)
 * - Tableau: descending rank, alternating colors (red/black)
 *
 * Difficulty levels:
 * - easy: Draw 1, unlimited passes
 * - medium: Draw 1, max 3 passes
 * - hard: Draw 3, unlimited passes
 * - expert: Draw 3, max 1 pass
 *
 * Solo mode only.
 *
 * @see src/types/games.ts
 */

import type { GameDifficulty } from '@/types/games';

// ============================================================
// Types
// ============================================================

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export type PileType = 'stock' | 'waste' | 'foundation' | 'tableau';

export interface PileLocation {
  pile: PileType;
  pileIndex: number;   // Foundation: 0-3, Tableau: 0-6, Stock/Waste: 0
  cardIndex: number;    // Index within pile (for tableau multi-card moves)
}

export interface SolitaireState {
  stock: Card[];             // Draw pile (face-down)
  waste: Card[];             // Flipped cards from stock
  foundations: Card[][];     // 4 foundation piles (♠♣♥♦)
  tableau: Card[][];         // 7 tableau columns
  selectedLocation: PileLocation | null;
  moveCount: number;
  stockPassCount: number;    // How many times stock was recycled
  isComplete: boolean;
  isWon: boolean;
  difficulty: GameDifficulty;
  drawCount: number;         // 1 or 3
  maxPasses: number;         // 0 = unlimited
  canRecycleStock: boolean;
}

// ============================================================
// Constants
// ============================================================

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const TABLEAU_COLUMNS = 7;
const FOUNDATION_COUNT = 4;

/** Card display symbols */
export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export const RANK_LABELS: Record<Rank, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
};

// ============================================================
// Utility Functions
// ============================================================

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, faceUp: false });
    }
  }
  return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isRed(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

function isBlack(suit: Suit): boolean {
  return suit === 'clubs' || suit === 'spades';
}

function alternatingColor(a: Suit, b: Suit): boolean {
  return (isRed(a) && isBlack(b)) || (isBlack(a) && isRed(b));
}

function cloneCards(cards: Card[]): Card[] {
  return cards.map(c => ({ ...c }));
}

function cloneState(state: SolitaireState): SolitaireState {
  return {
    stock: cloneCards(state.stock),
    waste: cloneCards(state.waste),
    foundations: state.foundations.map(f => cloneCards(f)),
    tableau: state.tableau.map(t => cloneCards(t)),
    selectedLocation: state.selectedLocation ? { ...state.selectedLocation } : null,
    moveCount: state.moveCount,
    stockPassCount: state.stockPassCount,
    isComplete: state.isComplete,
    isWon: state.isWon,
    difficulty: state.difficulty,
    drawCount: state.drawCount,
    maxPasses: state.maxPasses,
    canRecycleStock: state.canRecycleStock,
  };
}

// ============================================================
// Difficulty Configuration
// ============================================================

function getDifficultyConfig(difficulty: GameDifficulty): { drawCount: number; maxPasses: number } {
  switch (difficulty) {
    case 'easy': return { drawCount: 1, maxPasses: 0 };     // Draw 1, unlimited
    case 'medium': return { drawCount: 1, maxPasses: 3 };   // Draw 1, 3 passes
    case 'hard': return { drawCount: 3, maxPasses: 0 };     // Draw 3, unlimited
    case 'expert': return { drawCount: 3, maxPasses: 1 };   // Draw 3, 1 pass
  }
}

// ============================================================
// Engine Functions
// ============================================================

/**
 * Create initial game state — deal cards to tableau, rest to stock.
 */
export function createInitialState(difficulty: GameDifficulty = 'easy'): SolitaireState {
  const deck = shuffleDeck(createDeck());
  const config = getDifficultyConfig(difficulty);

  const tableau: Card[][] = [];
  let cardIndex = 0;

  // Deal tableau: column i gets i+1 cards, top card face-up
  for (let col = 0; col < TABLEAU_COLUMNS; col++) {
    const column: Card[] = [];
    for (let row = 0; row <= col; row++) {
      const card = { ...deck[cardIndex] };
      card.faceUp = row === col; // Only top card face-up
      column.push(card);
      cardIndex++;
    }
    tableau.push(column);
  }

  // Remaining cards go to stock
  const stock = deck.slice(cardIndex).map(c => ({ ...c, faceUp: false }));

  return {
    stock,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    selectedLocation: null,
    moveCount: 0,
    stockPassCount: 0,
    isComplete: false,
    isWon: false,
    difficulty,
    drawCount: config.drawCount,
    maxPasses: config.maxPasses,
    canRecycleStock: true,
  };
}

/**
 * Draw card(s) from stock to waste.
 */
export function drawFromStock(state: SolitaireState): SolitaireState {
  const newState = cloneState(state);
  newState.selectedLocation = null;

  if (newState.stock.length === 0) {
    // Recycle waste back to stock
    if (!newState.canRecycleStock) return state;
    if (newState.waste.length === 0) return state;

    newState.stock = newState.waste.reverse().map(c => ({ ...c, faceUp: false }));
    newState.waste = [];
    newState.stockPassCount++;

    // Check pass limit
    if (newState.maxPasses > 0 && newState.stockPassCount >= newState.maxPasses) {
      newState.canRecycleStock = false;
    }

    return newState;
  }

  // Draw cards
  const count = Math.min(newState.drawCount, newState.stock.length);
  for (let i = 0; i < count; i++) {
    const card = newState.stock.pop()!;
    card.faceUp = true;
    newState.waste.push(card);
  }

  return newState;
}

/**
 * Select a card or pile location. Returns updated state with selection.
 */
export function selectCard(state: SolitaireState, location: PileLocation): SolitaireState {
  // If same location selected, deselect
  if (
    state.selectedLocation &&
    state.selectedLocation.pile === location.pile &&
    state.selectedLocation.pileIndex === location.pileIndex &&
    state.selectedLocation.cardIndex === location.cardIndex
  ) {
    return { ...state, selectedLocation: null };
  }

  // If something is already selected, try to move
  if (state.selectedLocation) {
    const moved = moveCards(state, state.selectedLocation, location);
    if (moved) return moved;
    // If can't move, select the new location instead
  }

  return { ...state, selectedLocation: location };
}

/**
 * Check if a card can be placed on a foundation pile.
 */
function canPlaceOnFoundation(card: Card, foundation: Card[]): boolean {
  if (foundation.length === 0) {
    return card.rank === 1; // Only Ace on empty foundation
  }
  const topCard = foundation[foundation.length - 1];
  return card.suit === topCard.suit && card.rank === topCard.rank + 1;
}

/**
 * Check if card(s) can be placed on a tableau column.
 */
function canPlaceOnTableau(card: Card, column: Card[]): boolean {
  if (column.length === 0) {
    return card.rank === 13; // Only King on empty column
  }
  const topCard = column[column.length - 1];
  return topCard.faceUp && alternatingColor(card.suit, topCard.suit) && card.rank === topCard.rank - 1;
}

/**
 * Get the cards being moved from a pile location.
 */
function getCardsFromLocation(state: SolitaireState, location: PileLocation): Card[] | null {
  switch (location.pile) {
    case 'waste': {
      if (state.waste.length === 0) return null;
      return [state.waste[state.waste.length - 1]];
    }
    case 'foundation': {
      const foundation = state.foundations[location.pileIndex];
      if (foundation.length === 0) return null;
      return [foundation[foundation.length - 1]];
    }
    case 'tableau': {
      const column = state.tableau[location.pileIndex];
      if (location.cardIndex < 0 || location.cardIndex >= column.length) return null;
      const card = column[location.cardIndex];
      if (!card.faceUp) return null;
      // Return card and all cards on top of it
      return column.slice(location.cardIndex);
    }
    default:
      return null;
  }
}

/**
 * Move cards from source to destination.
 * Returns new state if move is valid, null otherwise.
 */
export function moveCards(
  state: SolitaireState,
  from: PileLocation,
  to: PileLocation,
): SolitaireState | null {
  const cards = getCardsFromLocation(state, from);
  if (!cards || cards.length === 0) return null;

  const topCard = cards[0];

  // Validate destination
  if (to.pile === 'foundation') {
    if (cards.length > 1) return null; // Can only move one card to foundation
    if (!canPlaceOnFoundation(topCard, state.foundations[to.pileIndex])) return null;
  } else if (to.pile === 'tableau') {
    if (!canPlaceOnTableau(topCard, state.tableau[to.pileIndex])) return null;
  } else {
    return null; // Can't move to stock or waste
  }

  // Execute move
  const newState = cloneState(state);
  newState.selectedLocation = null;
  newState.moveCount++;

  // Remove from source
  switch (from.pile) {
    case 'waste':
      newState.waste.pop();
      break;
    case 'foundation':
      newState.foundations[from.pileIndex].pop();
      break;
    case 'tableau': {
      const column = newState.tableau[from.pileIndex];
      column.splice(from.cardIndex, cards.length);
      // Flip the new top card face-up
      if (column.length > 0 && !column[column.length - 1].faceUp) {
        column[column.length - 1].faceUp = true;
      }
      break;
    }
  }

  // Add to destination
  if (to.pile === 'foundation') {
    newState.foundations[to.pileIndex].push({ ...cards[0], faceUp: true });
  } else if (to.pile === 'tableau') {
    for (const card of cards) {
      newState.tableau[to.pileIndex].push({ ...card, faceUp: true });
    }
  }

  // Check win condition
  const totalFoundation = newState.foundations.reduce((sum, f) => sum + f.length, 0);
  if (totalFoundation === 52) {
    newState.isComplete = true;
    newState.isWon = true;
  }

  return newState;
}

/**
 * Auto-complete: move all cards to foundations when all are face-up.
 * Returns new state if auto-complete is possible, null otherwise.
 */
export function autoComplete(state: SolitaireState): SolitaireState | null {
  // Check if all cards are face-up
  const allFaceUp = state.tableau.every(col => col.every(c => c.faceUp));
  if (!allFaceUp) return null;
  if (state.stock.length > 0) return null;

  const newState = cloneState(state);

  // Move all cards to foundations one by one
  let moved = true;
  while (moved) {
    moved = false;

    // Try waste
    if (newState.waste.length > 0) {
      const card = newState.waste[newState.waste.length - 1];
      for (let f = 0; f < FOUNDATION_COUNT; f++) {
        if (canPlaceOnFoundation(card, newState.foundations[f])) {
          newState.foundations[f].push({ ...newState.waste.pop()!, faceUp: true });
          newState.moveCount++;
          moved = true;
          break;
        }
      }
    }

    // Try tableau columns
    for (let col = 0; col < TABLEAU_COLUMNS; col++) {
      const column = newState.tableau[col];
      if (column.length === 0) continue;
      const card = column[column.length - 1];
      for (let f = 0; f < FOUNDATION_COUNT; f++) {
        if (canPlaceOnFoundation(card, newState.foundations[f])) {
          newState.foundations[f].push({ ...column.pop()!, faceUp: true });
          newState.moveCount++;
          moved = true;
          break;
        }
      }
    }
  }

  // Check win
  const totalFoundation = newState.foundations.reduce((sum, f) => sum + f.length, 0);
  if (totalFoundation === 52) {
    newState.isComplete = true;
    newState.isWon = true;
  }

  return newState;
}

/**
 * Check if auto-complete is available (all cards face-up, no stock).
 */
export function canAutoComplete(state: SolitaireState): boolean {
  if (state.stock.length > 0) return false;
  return state.tableau.every(col => col.every(c => c.faceUp));
}

/**
 * Find a hint — returns a valid move or null.
 */
export function findHint(state: SolitaireState): { from: PileLocation; to: PileLocation } | null {
  // Try waste → foundation
  if (state.waste.length > 0) {
    const card = state.waste[state.waste.length - 1];
    for (let f = 0; f < FOUNDATION_COUNT; f++) {
      if (canPlaceOnFoundation(card, state.foundations[f])) {
        return {
          from: { pile: 'waste', pileIndex: 0, cardIndex: state.waste.length - 1 },
          to: { pile: 'foundation', pileIndex: f, cardIndex: 0 },
        };
      }
    }
  }

  // Try tableau → foundation
  for (let col = 0; col < TABLEAU_COLUMNS; col++) {
    const column = state.tableau[col];
    if (column.length === 0) continue;
    const card = column[column.length - 1];
    if (!card.faceUp) continue;
    for (let f = 0; f < FOUNDATION_COUNT; f++) {
      if (canPlaceOnFoundation(card, state.foundations[f])) {
        return {
          from: { pile: 'tableau', pileIndex: col, cardIndex: column.length - 1 },
          to: { pile: 'foundation', pileIndex: f, cardIndex: 0 },
        };
      }
    }
  }

  // Try waste → tableau
  if (state.waste.length > 0) {
    const card = state.waste[state.waste.length - 1];
    for (let col = 0; col < TABLEAU_COLUMNS; col++) {
      if (canPlaceOnTableau(card, state.tableau[col])) {
        return {
          from: { pile: 'waste', pileIndex: 0, cardIndex: state.waste.length - 1 },
          to: { pile: 'tableau', pileIndex: col, cardIndex: state.tableau[col].length },
        };
      }
    }
  }

  // Try tableau → tableau
  for (let fromCol = 0; fromCol < TABLEAU_COLUMNS; fromCol++) {
    const fromColumn = state.tableau[fromCol];
    for (let i = 0; i < fromColumn.length; i++) {
      if (!fromColumn[i].faceUp) continue;
      const card = fromColumn[i];
      for (let toCol = 0; toCol < TABLEAU_COLUMNS; toCol++) {
        if (toCol === fromCol) continue;
        if (canPlaceOnTableau(card, state.tableau[toCol])) {
          return {
            from: { pile: 'tableau', pileIndex: fromCol, cardIndex: i },
            to: { pile: 'tableau', pileIndex: toCol, cardIndex: state.tableau[toCol].length },
          };
        }
      }
    }
  }

  return null;
}

/**
 * Find the best auto-move for a specific card location.
 * Priority: Foundation > Tableau (prefer revealing face-down cards, then longer columns).
 * Returns destination location or null if no valid move exists.
 */
export function findBestMoveForCard(
  state: SolitaireState,
  from: PileLocation,
): PileLocation | null {
  const cards = getCardsFromLocation(state, from);
  if (!cards || cards.length === 0) return null;

  const topCard = cards[0];

  // Priority 1: Foundation (only single cards)
  if (cards.length === 1) {
    for (let f = 0; f < FOUNDATION_COUNT; f++) {
      if (canPlaceOnFoundation(topCard, state.foundations[f])) {
        return { pile: 'foundation', pileIndex: f, cardIndex: 0 };
      }
    }
  }

  // Priority 2: Tableau — score each valid column and pick the best
  let bestCol = -1;
  let bestScore = -1;

  for (let col = 0; col < TABLEAU_COLUMNS; col++) {
    // Skip same column
    if (from.pile === 'tableau' && from.pileIndex === col) continue;
    if (!canPlaceOnTableau(topCard, state.tableau[col])) continue;

    let score = 0;

    // Prefer columns where the move reveals a face-down card
    if (from.pile === 'tableau') {
      const fromColumn = state.tableau[from.pileIndex];
      const cardBelow = from.cardIndex > 0 ? fromColumn[from.cardIndex - 1] : null;
      if (cardBelow && !cardBelow.faceUp) {
        score += 100; // High priority: reveals hidden card
      }
    }

    // Prefer non-empty columns (building on existing stacks)
    if (state.tableau[col].length > 0) {
      score += 10;
    }

    // Prefer longer columns (consolidate stacks)
    score += state.tableau[col].length;

    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }

  if (bestCol >= 0) {
    return { pile: 'tableau', pileIndex: bestCol, cardIndex: state.tableau[bestCol].length };
  }

  return null;
}

// ============================================================
// Scoring
// ============================================================

/**
 * Calculate score based on moves, time, and cards in foundation.
 */
export function calculateScore(state: SolitaireState, durationSeconds: number = 0): number {
  if (!state.isWon) return 0;

  const foundationCards = state.foundations.reduce((sum, f) => sum + f.length, 0);
  const baseScore = foundationCards * 10; // 520 for full foundation

  // Difficulty multiplier
  const difficultyMultiplier: Record<GameDifficulty, number> = {
    easy: 1,
    medium: 1.5,
    hard: 2,
    expert: 3,
  };

  // Move efficiency bonus (fewer moves = more points)
  const moveBonus = Math.max(0, 500 - state.moveCount * 2);

  // Time bonus (faster = more points, capped at 10 minutes)
  const timeBonus = Math.max(0, 300 - Math.floor(durationSeconds / 2));

  const raw = (baseScore + moveBonus + timeBonus) * difficultyMultiplier[state.difficulty];
  return Math.round(raw);
}

/**
 * Get star rating.
 */
export function getStarRating(state: SolitaireState): 1 | 2 | 3 | undefined {
  if (!state.isWon) return undefined;
  if (state.moveCount <= 100) return 3;
  if (state.moveCount <= 150) return 2;
  return 1;
}

// ============================================================
// Serialization
// ============================================================

export function serializeState(state: SolitaireState): Record<string, unknown> {
  return {
    stock: state.stock,
    waste: state.waste,
    foundations: state.foundations,
    tableau: state.tableau,
    moveCount: state.moveCount,
    stockPassCount: state.stockPassCount,
    isComplete: state.isComplete,
    isWon: state.isWon,
    difficulty: state.difficulty,
    drawCount: state.drawCount,
    maxPasses: state.maxPasses,
    canRecycleStock: state.canRecycleStock,
  };
}

export function deserializeState(snapshot: Record<string, unknown>): SolitaireState {
  return {
    stock: (snapshot.stock as Card[]) || [],
    waste: (snapshot.waste as Card[]) || [],
    foundations: (snapshot.foundations as Card[][]) || [[], [], [], []],
    tableau: (snapshot.tableau as Card[][]) || [[], [], [], [], [], [], []],
    selectedLocation: null,
    moveCount: (snapshot.moveCount as number) || 0,
    stockPassCount: (snapshot.stockPassCount as number) || 0,
    isComplete: (snapshot.isComplete as boolean) || false,
    isWon: (snapshot.isWon as boolean) || false,
    difficulty: (snapshot.difficulty as GameDifficulty) || 'easy',
    drawCount: (snapshot.drawCount as number) || 1,
    maxPasses: (snapshot.maxPasses as number) || 0,
    canRecycleStock: (snapshot.canRecycleStock as boolean) ?? true,
  };
}
