/**
 * Woordy Board Generator — CommEazy
 *
 * Generates a 15×15 board with randomly placed bonus fields
 * and hidden trivia fields.
 *
 * @see .claude/plans/WOORDY_DESIGN.md §2
 */

import type { BoardCell, BoardPosition, BonusType, FieldType } from './types';
import { BOARD_SIZE, CENTER_POS, BONUS_FIELD_COUNTS, TRIVIA_FIELD_COUNT } from './types';

// ============================================================
// Helpers
// ============================================================

/**
 * Shuffle an array using Fisher-Yates
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
 * Create a position key for Set lookups
 */
function posKey(row: number, col: number): string {
  return `${row},${col}`;
}

// ============================================================
// Board Generation
// ============================================================

/**
 * Generate all available positions on the board (excluding center)
 */
function getAvailablePositions(): BoardPosition[] {
  const positions: BoardPosition[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      // Skip center position
      if (row === CENTER_POS && col === CENTER_POS) continue;
      positions.push({ row, col });
    }
  }
  return positions;
}

/**
 * Place bonus fields randomly on the board.
 * Returns a map of position → bonus type.
 */
function placeBonusFields(
  availablePositions: BoardPosition[],
): Map<string, BonusType> {
  const bonusMap = new Map<string, BonusType>();
  const shuffled = shuffle(availablePositions);
  let idx = 0;

  for (const [bonusType, count] of Object.entries(BONUS_FIELD_COUNTS) as [BonusType, number][]) {
    for (let i = 0; i < count && idx < shuffled.length; i++) {
      const pos = shuffled[idx++];
      bonusMap.set(posKey(pos.row, pos.col), bonusType);
    }
  }

  return bonusMap;
}

/**
 * Place trivia fields randomly on remaining positions.
 * Returns the positions of trivia fields.
 */
function placeTriviaFields(
  availablePositions: BoardPosition[],
  bonusPositions: Set<string>,
): BoardPosition[] {
  // Filter out positions already used by bonuses
  const remaining = availablePositions.filter(
    (p) => !bonusPositions.has(posKey(p.row, p.col)),
  );

  const shuffled = shuffle(remaining);
  return shuffled.slice(0, TRIVIA_FIELD_COUNT);
}

/**
 * Generate a fresh 15×15 board with random bonus and trivia fields.
 *
 * Returns [board, triviaPositions]
 */
export function generateBoard(): [BoardCell[][], BoardPosition[]] {
  const availablePositions = getAvailablePositions();

  // Place bonus fields
  const bonusMap = placeBonusFields(availablePositions);
  const bonusPositionKeys = new Set(bonusMap.keys());

  // Place trivia fields (on remaining positions)
  const triviaPositions = placeTriviaFields(availablePositions, bonusPositionKeys);
  const triviaKeys = new Set(triviaPositions.map((p) => posKey(p.row, p.col)));

  // Build the board
  const board: BoardCell[][] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    const boardRow: BoardCell[] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      const key = posKey(row, col);
      let fieldType: FieldType = 'normal';

      if (row === CENTER_POS && col === CENTER_POS) {
        fieldType = 'center';
      } else if (bonusMap.has(key)) {
        fieldType = bonusMap.get(key)!;
      } else if (triviaKeys.has(key)) {
        fieldType = 'trivia';
      }

      boardRow.push({
        position: { row, col },
        fieldType,
        tile: null,
        triviaRevealed: false,
      });
    }
    board.push(boardRow);
  }

  return [board, triviaPositions];
}

/**
 * Get the display character for a field type (for text rendering).
 */
export function getFieldTypeLabel(fieldType: FieldType): string {
  switch (fieldType) {
    case 'DL': return 'DL';
    case 'TL': return 'TL';
    case 'DW': return 'DW';
    case 'TW': return 'TW';
    case 'center': return '★';
    case 'trivia': return '?';
    default: return '';
  }
}
