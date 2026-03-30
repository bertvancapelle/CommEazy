/**
 * Woordy Game Types — CommEazy
 *
 * TypeScript types for the Woordy word game (Scrabble-like).
 * @see .claude/plans/WOORDY_DESIGN.md
 */

// ============================================================
// Board Types
// ============================================================

/** Board size constant */
export const BOARD_SIZE = 15;

/** Center position on the board */
export const CENTER_POS = 7;

/** Bonus field types */
export type BonusType = 'DL' | 'TL' | 'DW' | 'TW';

/** Special field types */
export type FieldType = 'normal' | 'center' | BonusType | 'trivia';

/** Position on the board */
export interface BoardPosition {
  row: number;
  col: number;
}

/** A single cell on the board */
export interface BoardCell {
  position: BoardPosition;
  fieldType: FieldType;
  tile: PlacedTile | null;
  /** Whether a trivia field has been revealed */
  triviaRevealed: boolean;
}

// ============================================================
// Tile Types
// ============================================================

/** A tile in the letter bag or on the rack */
export interface Tile {
  /** Unique tile ID */
  id: string;
  /** Letter (empty string for blank tile) */
  letter: string;
  /** Point value (0 for blank) */
  value: number;
  /** Whether this is a blank tile */
  isBlank: boolean;
}

/** A tile placed on the board */
export interface PlacedTile extends Tile {
  /** Position on the board */
  position: BoardPosition;
  /** For blank tiles: the chosen letter */
  chosenLetter: string;
  /** Who placed this tile ('player' | 'opponent') */
  placedBy: 'player' | 'opponent';
  /** Whether this tile was placed in the current turn */
  isCurrentTurn: boolean;
}

// ============================================================
// Universal Letter Values (range 1-5, all 13 languages)
// ============================================================

/** Universal letter values — same across all languages */
export const LETTER_VALUES: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 2, E: 1,
  F: 3, G: 2, H: 2, I: 1, J: 2,
  K: 2, L: 2, M: 2, N: 2, O: 1,
  P: 2, Q: 5, R: 2, S: 2, T: 2,
  U: 1, V: 2, W: 2, X: 3, Y: 5,
  Z: 3,
};

/** Get value for a letter (0 for blank, default 1 for unknown) */
export function getLetterValue(letter: string): number {
  if (!letter) return 0;
  return LETTER_VALUES[letter.toUpperCase()] ?? 1;
}

// ============================================================
// Game State Types
// ============================================================

/** Turn action type */
export type TurnAction = 'place' | 'pass' | 'swap' | 'resign';

/** A completed turn record */
export interface TurnRecord {
  /** Turn number (1-based) */
  turnNumber: number;
  /** Who played ('player' | 'opponent') */
  playedBy: 'player' | 'opponent';
  /** Action type */
  action: TurnAction;
  /** Word(s) formed (if action is 'place') */
  wordsFormed: string[];
  /** Score earned this turn */
  score: number;
  /** Tiles placed (if action is 'place') */
  tilesPlaced: PlacedTile[];
  /** Trivia triggered? */
  triviaTriggered: boolean;
  /** Trivia result (if triggered) */
  triviaCorrect: boolean | null;
}

/** Player state */
export interface PlayerState {
  /** Player identifier */
  id: 'player' | 'opponent';
  /** Display name */
  name: string;
  /** Current rack tiles */
  rack: Tile[];
  /** Total score */
  score: number;
}

/** Game end reason */
export type GameEndReason = 'tiles_empty' | 'both_passed' | 'resign';

/** Full game state */
export interface WoordyState {
  /** 15x15 board */
  board: BoardCell[][];
  /** Player state */
  player: PlayerState;
  /** Opponent state (for multiplayer preview; in solo mode, AI-controlled) */
  opponent: PlayerState;
  /** Letter bag (remaining tiles) */
  letterBag: Tile[];
  /** Whose turn it is */
  currentTurn: 'player' | 'opponent';
  /** Turn history */
  turns: TurnRecord[];
  /** Consecutive passes counter (2 = game over) */
  consecutivePasses: number;
  /** Whether the game is over */
  isComplete: boolean;
  /** End reason */
  endReason: GameEndReason | null;
  /** Currently selected tile from rack (for tap-to-place) */
  selectedTileId: string | null;
  /** Tiles placed this turn (not yet confirmed) */
  pendingTiles: PlacedTile[];
  /** Trivia field positions (hidden from UI until revealed) */
  triviaPositions: BoardPosition[];
  /** Pending trivia question (shown after placing word on trivia field) */
  pendingTrivia: boolean;
}

// ============================================================
// Scoring Types
// ============================================================

/** Score breakdown for a single word */
export interface WordScoreBreakdown {
  word: string;
  baseScore: number;
  letterMultipliers: number[];
  wordMultiplier: number;
  totalScore: number;
}

/** Full turn score breakdown */
export interface TurnScoreBreakdown {
  words: WordScoreBreakdown[];
  subtotal: number;
  triviaBonus: number;
  allTilesBonus: number;
  firstWordBonus: number;
  total: number;
}

// ============================================================
// Bonus Constants
// ============================================================

/** Bonus/penalty amounts */
export const TRIVIA_BONUS = 10;
export const TRIVIA_PENALTY = -10;
export const ALL_TILES_BONUS = 10;
export const FIRST_WORD_BONUS = 10;

/** Number of tiles in a full rack */
export const RACK_SIZE = 7;

/** Number of blank tiles in the bag */
export const BLANK_TILE_COUNT = 2;

/** Number of trivia fields per game */
export const TRIVIA_FIELD_COUNT = 2;

// ============================================================
// Bonus Field Distribution
// ============================================================

/** Standard bonus field counts for a 15x15 board */
export const BONUS_FIELD_COUNTS: Record<BonusType, number> = {
  DL: 24,
  TL: 12,
  DW: 16,
  TW: 8,
};
