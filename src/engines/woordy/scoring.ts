/**
 * Woordy Scoring — CommEazy
 *
 * Score calculation with letter multipliers, word multipliers,
 * and bonus scoring.
 *
 * @see .claude/plans/WOORDY_DESIGN.md §5
 */

import type { BoardCell, PlacedTile, WordScoreBreakdown, TurnScoreBreakdown } from './types';
import {
  TRIVIA_BONUS,
  TRIVIA_PENALTY,
  ALL_TILES_BONUS,
  FIRST_WORD_BONUS,
  RACK_SIZE,
  getLetterValue,
} from './types';

// ============================================================
// Word Detection
// ============================================================

/**
 * Find all words formed by the tiles placed this turn.
 * Returns arrays of cells for each word formed.
 */
export function findFormedWords(
  board: BoardCell[][],
  placedTiles: PlacedTile[],
): BoardCell[][] {
  if (placedTiles.length === 0) return [];

  const words: BoardCell[][] = [];

  // Determine direction: all tiles in same row → horizontal, same column → vertical
  const rows = new Set(placedTiles.map((t) => t.position.row));
  const cols = new Set(placedTiles.map((t) => t.position.col));

  // Single tile: check both directions
  if (placedTiles.length === 1) {
    const hWord = getWordAt(board, placedTiles[0].position.row, placedTiles[0].position.col, 'horizontal');
    const vWord = getWordAt(board, placedTiles[0].position.row, placedTiles[0].position.col, 'vertical');
    if (hWord.length > 1) words.push(hWord);
    if (vWord.length > 1) words.push(vWord);
    return words;
  }

  const isHorizontal = rows.size === 1;

  if (isHorizontal) {
    // Main word: horizontal
    const row = placedTiles[0].position.row;
    const minCol = Math.min(...placedTiles.map((t) => t.position.col));
    const mainWord = getWordAt(board, row, minCol, 'horizontal');
    if (mainWord.length > 1) words.push(mainWord);

    // Cross words: vertical for each placed tile
    for (const tile of placedTiles) {
      const crossWord = getWordAt(board, tile.position.row, tile.position.col, 'vertical');
      if (crossWord.length > 1) words.push(crossWord);
    }
  } else {
    // Main word: vertical
    const col = placedTiles[0].position.col;
    const minRow = Math.min(...placedTiles.map((t) => t.position.row));
    const mainWord = getWordAt(board, minRow, col, 'vertical');
    if (mainWord.length > 1) words.push(mainWord);

    // Cross words: horizontal for each placed tile
    for (const tile of placedTiles) {
      const crossWord = getWordAt(board, tile.position.row, tile.position.col, 'horizontal');
      if (crossWord.length > 1) words.push(crossWord);
    }
  }

  return words;
}

/**
 * Get the complete word at a position in a given direction.
 * Extends in both directions until finding an empty cell.
 */
function getWordAt(
  board: BoardCell[][],
  row: number,
  col: number,
  direction: 'horizontal' | 'vertical',
): BoardCell[] {
  const cells: BoardCell[] = [];
  const dr = direction === 'vertical' ? 1 : 0;
  const dc = direction === 'horizontal' ? 1 : 0;

  // Find start of word (go backwards)
  let r = row;
  let c = col;
  while (r - dr >= 0 && c - dc >= 0 && board[r - dr][c - dc].tile) {
    r -= dr;
    c -= dc;
  }

  // Collect all cells in the word
  while (r < 15 && c < 15 && board[r][c].tile) {
    cells.push(board[r][c]);
    r += dr;
    c += dc;
  }

  return cells;
}

// ============================================================
// Score Calculation
// ============================================================

/**
 * Calculate the score for a single word.
 * Only new tiles (isCurrentTurn) activate bonus fields.
 */
export function calculateWordScore(
  wordCells: BoardCell[],
): WordScoreBreakdown {
  let wordMultiplier = 1;
  let baseScore = 0;
  const letterMultipliers: number[] = [];
  const letters: string[] = [];

  for (const cell of wordCells) {
    const tile = cell.tile!;
    const letterValue = tile.isBlank
      ? 0
      : getLetterValue(tile.chosenLetter || tile.letter);

    let letterMult = 1;

    // Only tiles placed THIS turn activate bonuses
    if (tile.isCurrentTurn) {
      switch (cell.fieldType) {
        case 'DL':
          letterMult = 2;
          break;
        case 'TL':
          letterMult = 3;
          break;
        case 'DW':
          wordMultiplier *= 2;
          break;
        case 'TW':
          wordMultiplier *= 3;
          break;
      }
    }

    baseScore += letterValue * letterMult;
    letterMultipliers.push(letterMult);
    letters.push(tile.chosenLetter || tile.letter);
  }

  const totalScore = baseScore * wordMultiplier;
  const word = letters.join('');

  return {
    word,
    baseScore,
    letterMultipliers,
    wordMultiplier,
    totalScore,
  };
}

/**
 * Calculate the full score for a turn, including all bonuses.
 */
export function calculateTurnScore(
  board: BoardCell[][],
  placedTiles: PlacedTile[],
  isFirstWord: boolean,
  triviaTriggered: boolean,
  triviaCorrect: boolean | null,
): TurnScoreBreakdown {
  const formedWords = findFormedWords(board, placedTiles);

  const words = formedWords.map(calculateWordScore);
  const subtotal = words.reduce((sum, w) => sum + w.totalScore, 0);

  // Bonuses
  const firstWordBonus = isFirstWord ? FIRST_WORD_BONUS : 0;
  const allTilesBonus = placedTiles.length === RACK_SIZE ? ALL_TILES_BONUS : 0;
  const triviaBonus = triviaTriggered
    ? (triviaCorrect ? TRIVIA_BONUS : TRIVIA_PENALTY)
    : 0;

  const total = subtotal + firstWordBonus + allTilesBonus + triviaBonus;

  return {
    words,
    subtotal,
    triviaBonus,
    allTilesBonus,
    firstWordBonus,
    total,
  };
}

/**
 * Calculate end-of-game tile penalty.
 * Player with remaining tiles loses their tile values.
 * Player without tiles gains opponent's remaining tile values.
 */
export function calculateEndGameAdjustment(
  remainingTileValues: number,
): { penalty: number; bonus: number } {
  return {
    penalty: -remainingTileValues,
    bonus: remainingTileValues,
  };
}
