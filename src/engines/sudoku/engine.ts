/**
 * Sudoku Game Engine — Classic 9×9 number puzzle
 *
 * Generates valid Sudoku puzzles at 4 difficulty levels by:
 * 1. Creating a fully solved grid via backtracking
 * 2. Removing cells based on difficulty
 * 3. Validating player input in real-time
 *
 * Solo mode only.
 *
 * @see src/types/games.ts
 */

import type { GameDifficulty } from '@/types/games';

// ============================================================
// Types
// ============================================================

/** 0 = empty cell */
export type CellValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** 9×9 grid (row-major) */
export type Grid = CellValue[][];

export interface CellPosition {
  row: number;
  col: number;
}

export interface SudokuState {
  /** The fully solved grid (hidden during play) */
  solution: Grid;
  /** The puzzle grid (with blanks) */
  puzzle: Grid;
  /** The player's current grid */
  playerGrid: Grid;
  /** Which cells are pre-filled (not editable) */
  locked: boolean[][];
  /** Currently selected cell */
  selectedCell: CellPosition | null;
  /** Player's notes per cell (pencil marks) */
  notes: Set<number>[][];
  /** Number of errors made */
  errorCount: number;
  /** Whether the game is complete */
  isComplete: boolean;
  /** Whether the game is won (complete + correct) */
  isWon: boolean;
  /** Difficulty level */
  difficulty: GameDifficulty;
}

// ============================================================
// Constants
// ============================================================

export const GRID_SIZE = 9;
export const BOX_SIZE = 3;

/** Number of cells to remove per difficulty */
const CELLS_TO_REMOVE: Record<GameDifficulty, number> = {
  easy: 30,
  medium: 40,
  hard: 50,
  expert: 56,
};

// ============================================================
// Grid Utilities
// ============================================================

function createEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => 0 as CellValue),
  );
}

function cloneGrid(grid: Grid): Grid {
  return grid.map(row => [...row]);
}

function createLockedGrid(puzzle: Grid): boolean[][] {
  return puzzle.map(row => row.map(cell => cell !== 0));
}

function createNotesGrid(): Set<number>[][] {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => new Set<number>()),
  );
}

// ============================================================
// Validation
// ============================================================

/**
 * Check if placing `num` at (row, col) is valid.
 */
function isValidPlacement(grid: Grid, row: number, col: number, num: number): boolean {
  // Check row
  for (let c = 0; c < GRID_SIZE; c++) {
    if (c !== col && grid[row][c] === num) return false;
  }

  // Check column
  for (let r = 0; r < GRID_SIZE; r++) {
    if (r !== row && grid[r][col] === num) return false;
  }

  // Check 3×3 box
  const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
  const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
  for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
    for (let c = boxCol; c < boxCol + BOX_SIZE; c++) {
      if (r !== row && c !== col && grid[r][c] === num) return false;
    }
  }

  return true;
}

/**
 * Check if a number conflicts with existing entries at a position.
 */
export function hasConflict(grid: Grid, row: number, col: number): boolean {
  const num = grid[row][col];
  if (num === 0) return false;
  return !isValidPlacement(grid, row, col, num);
}

// ============================================================
// Generator (Backtracking)
// ============================================================

/**
 * Fill the grid completely using randomized backtracking.
 */
function fillGrid(grid: Grid): boolean {
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (grid[row][col] !== 0) continue;

      // Randomize order for variety
      const numbers = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);

      for (const num of numbers) {
        if (isValidPlacement(grid, row, col, num)) {
          grid[row][col] = num as CellValue;
          if (fillGrid(grid)) return true;
          grid[row][col] = 0;
        }
      }
      return false; // Backtrack
    }
  }
  return true; // All cells filled
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate a puzzle by removing cells from a solved grid.
 */
function generatePuzzle(solution: Grid, difficulty: GameDifficulty): Grid {
  const puzzle = cloneGrid(solution);
  const cellsToRemove = CELLS_TO_REMOVE[difficulty];

  // Create list of all positions and shuffle
  const positions: CellPosition[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      positions.push({ row, col });
    }
  }
  const shuffled = shuffleArray(positions);

  let removed = 0;
  for (const { row, col } of shuffled) {
    if (removed >= cellsToRemove) break;
    puzzle[row][col] = 0;
    removed++;
  }

  return puzzle;
}

// ============================================================
// Engine Functions
// ============================================================

/**
 * Create a new Sudoku game state.
 */
export function createInitialState(difficulty: GameDifficulty = 'easy'): SudokuState {
  const solution = createEmptyGrid();
  fillGrid(solution);

  const puzzle = generatePuzzle(solution, difficulty);
  const playerGrid = cloneGrid(puzzle);
  const locked = createLockedGrid(puzzle);
  const notes = createNotesGrid();

  return {
    solution,
    puzzle,
    playerGrid,
    locked,
    selectedCell: null,
    notes,
    errorCount: 0,
    isComplete: false,
    isWon: false,
    difficulty,
  };
}

/**
 * Select a cell.
 */
export function selectCell(state: SudokuState, row: number, col: number): SudokuState {
  return {
    ...state,
    selectedCell: { row, col },
  };
}

/**
 * Place a number in the selected cell.
 * Returns null if cell is locked or no cell selected.
 */
export function placeNumber(state: SudokuState, num: CellValue): SudokuState | null {
  if (!state.selectedCell) return null;
  const { row, col } = state.selectedCell;
  if (state.locked[row][col]) return null;
  if (state.isComplete) return null;

  const newGrid = cloneGrid(state.playerGrid);
  newGrid[row][col] = num;

  // Clear notes for this cell when placing a number
  const newNotes = state.notes.map(r => r.map(s => new Set(s)));
  if (num !== 0) {
    newNotes[row][col].clear();
  }

  // Check for errors
  let newErrorCount = state.errorCount;
  if (num !== 0 && state.solution[row][col] !== num) {
    newErrorCount++;
  }

  // Check completion
  const isComplete = checkCompletion(newGrid);
  const isWon = isComplete && checkCorrectness(newGrid, state.solution);

  return {
    ...state,
    playerGrid: newGrid,
    notes: newNotes,
    errorCount: newErrorCount,
    isComplete,
    isWon,
  };
}

/**
 * Toggle a note (pencil mark) in the selected cell.
 */
export function toggleNote(state: SudokuState, num: number): SudokuState | null {
  if (!state.selectedCell) return null;
  const { row, col } = state.selectedCell;
  if (state.locked[row][col]) return null;
  if (state.playerGrid[row][col] !== 0) return null; // Can't note a filled cell

  const newNotes = state.notes.map(r => r.map(s => new Set(s)));
  if (newNotes[row][col].has(num)) {
    newNotes[row][col].delete(num);
  } else {
    newNotes[row][col].add(num);
  }

  return {
    ...state,
    notes: newNotes,
  };
}

/**
 * Clear the selected cell.
 */
export function clearCell(state: SudokuState): SudokuState | null {
  if (!state.selectedCell) return null;
  const { row, col } = state.selectedCell;
  if (state.locked[row][col]) return null;

  const newGrid = cloneGrid(state.playerGrid);
  newGrid[row][col] = 0;

  const newNotes = state.notes.map(r => r.map(s => new Set(s)));
  newNotes[row][col].clear();

  return {
    ...state,
    playerGrid: newGrid,
    notes: newNotes,
    isComplete: false,
    isWon: false,
  };
}

/**
 * Use a hint — reveal the correct value for the selected cell.
 */
export function useHint(state: SudokuState): SudokuState | null {
  if (!state.selectedCell) return null;
  const { row, col } = state.selectedCell;
  if (state.locked[row][col]) return null;
  if (state.playerGrid[row][col] === state.solution[row][col]) return null;

  const newGrid = cloneGrid(state.playerGrid);
  newGrid[row][col] = state.solution[row][col];

  const newNotes = state.notes.map(r => r.map(s => new Set(s)));
  newNotes[row][col].clear();

  const isComplete = checkCompletion(newGrid);
  const isWon = isComplete && checkCorrectness(newGrid, state.solution);

  return {
    ...state,
    playerGrid: newGrid,
    notes: newNotes,
    isComplete,
    isWon,
  };
}

// ============================================================
// Completion & Scoring
// ============================================================

function checkCompletion(grid: Grid): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 0) return false;
    }
  }
  return true;
}

function checkCorrectness(playerGrid: Grid, solution: Grid): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (playerGrid[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}

/**
 * Calculate score based on difficulty, errors, and time.
 */
export function calculateScore(state: SudokuState, durationSeconds: number): number {
  if (!state.isWon) return 0;

  const difficultyMultiplier: Record<GameDifficulty, number> = {
    easy: 1,
    medium: 2,
    hard: 3,
    expert: 5,
  };

  const base = 1000 * difficultyMultiplier[state.difficulty];
  const errorPenalty = state.errorCount * 50;
  const timePenalty = Math.floor(durationSeconds / 60) * 10; // -10 per minute

  return Math.max(0, base - errorPenalty - timePenalty);
}

/**
 * Get star rating.
 */
export function getStarRating(state: SudokuState): 1 | 2 | 3 | undefined {
  if (!state.isWon) return undefined;
  if (state.errorCount === 0) return 3;
  if (state.errorCount <= 3) return 2;
  return 1;
}

/**
 * Count remaining empty cells.
 */
export function getRemainingCells(state: SudokuState): number {
  let count = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (state.playerGrid[r][c] === 0) count++;
    }
  }
  return count;
}

// ============================================================
// Serialization
// ============================================================

export function serializeState(state: SudokuState): Record<string, unknown> {
  return {
    solution: state.solution,
    puzzle: state.puzzle,
    playerGrid: state.playerGrid,
    locked: state.locked,
    notes: state.notes.map(row =>
      row.map(set => Array.from(set)),
    ),
    errorCount: state.errorCount,
    isComplete: state.isComplete,
    isWon: state.isWon,
    difficulty: state.difficulty,
  };
}

export function deserializeState(snapshot: Record<string, unknown>): SudokuState {
  const notesData = snapshot.notes as number[][][] | undefined;
  const notes = notesData
    ? notesData.map(row => row.map(arr => new Set(arr)))
    : createNotesGrid();

  return {
    solution: (snapshot.solution as Grid) || createEmptyGrid(),
    puzzle: (snapshot.puzzle as Grid) || createEmptyGrid(),
    playerGrid: (snapshot.playerGrid as Grid) || createEmptyGrid(),
    locked: (snapshot.locked as boolean[][]) || Array.from({ length: 9 }, () => Array(9).fill(false)),
    selectedCell: null,
    notes,
    errorCount: (snapshot.errorCount as number) || 0,
    isComplete: (snapshot.isComplete as boolean) || false,
    isWon: (snapshot.isWon as boolean) || false,
    difficulty: (snapshot.difficulty as GameDifficulty) || 'easy',
  };
}
