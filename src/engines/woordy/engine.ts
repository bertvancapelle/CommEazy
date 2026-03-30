/**
 * Woordy Game Engine — CommEazy
 *
 * Pure functions for Woordy (Scrabble-like) game logic.
 * Ties together board generation, letter bag, and scoring.
 *
 * @see .claude/plans/WOORDY_DESIGN.md
 * @see src/types/games.ts
 */

import type {
  WoordyState,
  PlacedTile,
  Tile,
  BoardPosition,
  BoardCell,
  TurnRecord,
  GameEndReason,
  TurnScoreBreakdown,
} from './types';
import { RACK_SIZE, getLetterValue } from './types';
import { generateBoard } from './boardGenerator';
import { createLetterBag, shuffleBag, drawTiles, returnTilesToBag } from './letterBag';
import { calculateTurnScore, findFormedWords } from './scoring';

// ============================================================
// Game Initialization
// ============================================================

/**
 * Create initial game state for a new Woordy game.
 */
export function createInitialState(language: string): WoordyState {
  const [board, triviaPositions] = generateBoard();
  const bag = shuffleBag(createLetterBag(language));

  // Draw initial tiles for both players
  const [playerTiles, bagAfterPlayer] = drawTiles(bag, RACK_SIZE);
  const [opponentTiles, remainingBag] = drawTiles(bagAfterPlayer, RACK_SIZE);

  return {
    board,
    player: {
      id: 'player',
      name: '',
      rack: playerTiles,
      score: 0,
    },
    opponent: {
      id: 'opponent',
      name: '',
      rack: opponentTiles,
      score: 0,
    },
    letterBag: remainingBag,
    currentTurn: 'player',
    turns: [],
    consecutivePasses: 0,
    isComplete: false,
    endReason: null,
    selectedTileId: null,
    pendingTiles: [],
    triviaPositions,
    pendingTrivia: false,
  };
}

// ============================================================
// Tile Selection & Placement (Tap-to-Place)
// ============================================================

/**
 * Select a tile from the rack (tap on rack tile).
 */
export function selectTile(state: WoordyState, tileId: string): WoordyState {
  if (state.isComplete) return state;
  // Toggle selection
  if (state.selectedTileId === tileId) {
    return { ...state, selectedTileId: null };
  }
  return { ...state, selectedTileId: tileId };
}

/**
 * Place the selected tile on the board (tap on board cell).
 */
export function placeTile(
  state: WoordyState,
  position: BoardPosition,
): WoordyState {
  if (state.isComplete || !state.selectedTileId) return state;

  const cell = state.board[position.row][position.col];
  if (cell.tile) return state; // Cell already occupied

  const currentPlayer = state.currentTurn === 'player' ? state.player : state.opponent;
  const tileIndex = currentPlayer.rack.findIndex((t) => t.id === state.selectedTileId);
  if (tileIndex === -1) return state; // Tile not in rack

  const tile = currentPlayer.rack[tileIndex];

  const placedTile: PlacedTile = {
    ...tile,
    position,
    chosenLetter: tile.isBlank ? '' : tile.letter, // Blank tiles need letter choice later
    placedBy: state.currentTurn,
    isCurrentTurn: true,
  };

  // Remove tile from rack
  const newRack = [...currentPlayer.rack];
  newRack.splice(tileIndex, 1);

  // Place tile on board
  const newBoard = state.board.map((row) => row.map((c) => ({ ...c })));
  newBoard[position.row][position.col] = {
    ...newBoard[position.row][position.col],
    tile: placedTile,
  };

  // Update player state
  const updatedPlayer = { ...currentPlayer, rack: newRack };

  return {
    ...state,
    board: newBoard,
    player: state.currentTurn === 'player' ? updatedPlayer : state.player,
    opponent: state.currentTurn === 'opponent' ? updatedPlayer : state.opponent,
    selectedTileId: null,
    pendingTiles: [...state.pendingTiles, placedTile],
  };
}

/**
 * Remove a pending tile from the board (tap on placed tile to take back).
 */
export function removePendingTile(
  state: WoordyState,
  position: BoardPosition,
): WoordyState {
  if (state.isComplete) return state;

  const cell = state.board[position.row][position.col];
  if (!cell.tile || !cell.tile.isCurrentTurn) return state;

  const tile = cell.tile;
  const currentPlayer = state.currentTurn === 'player' ? state.player : state.opponent;

  // Remove from board
  const newBoard = state.board.map((row) => row.map((c) => ({ ...c })));
  newBoard[position.row][position.col] = {
    ...newBoard[position.row][position.col],
    tile: null,
  };

  // Return to rack as regular tile
  const returnedTile: Tile = {
    id: tile.id,
    letter: tile.letter,
    value: tile.value,
    isBlank: tile.isBlank,
  };

  const newRack = [...currentPlayer.rack, returnedTile];
  const updatedPlayer = { ...currentPlayer, rack: newRack };

  return {
    ...state,
    board: newBoard,
    player: state.currentTurn === 'player' ? updatedPlayer : state.player,
    opponent: state.currentTurn === 'opponent' ? updatedPlayer : state.opponent,
    pendingTiles: state.pendingTiles.filter(
      (t) => !(t.position.row === position.row && t.position.col === position.col),
    ),
  };
}

/**
 * Set the chosen letter for a blank tile that has been placed.
 */
export function setBlankTileLetter(
  state: WoordyState,
  position: BoardPosition,
  letter: string,
): WoordyState {
  const cell = state.board[position.row][position.col];
  if (!cell.tile || !cell.tile.isBlank || !cell.tile.isCurrentTurn) return state;

  const newBoard = state.board.map((row) => row.map((c) => ({ ...c })));
  newBoard[position.row][position.col] = {
    ...newBoard[position.row][position.col],
    tile: {
      ...cell.tile,
      chosenLetter: letter.toUpperCase(),
    },
  };

  const updatedPendingTiles = state.pendingTiles.map((t) =>
    t.position.row === position.row && t.position.col === position.col
      ? { ...t, chosenLetter: letter.toUpperCase() }
      : t,
  );

  return {
    ...state,
    board: newBoard,
    pendingTiles: updatedPendingTiles,
  };
}

// ============================================================
// Turn Actions
// ============================================================

/**
 * Validate that pending tiles form a valid placement:
 * - All in same row or column
 * - Connected to existing tiles (unless first word)
 * - First word goes through center
 * - No gaps between tiles
 */
export function validatePlacement(state: WoordyState): {
  valid: boolean;
  error: string | null;
} {
  const { pendingTiles, board, turns } = state;

  if (pendingTiles.length === 0) {
    return { valid: false, error: 'noTilesPlaced' };
  }

  // Check all in same row or column
  const rows = new Set(pendingTiles.map((t) => t.position.row));
  const cols = new Set(pendingTiles.map((t) => t.position.col));

  if (rows.size > 1 && cols.size > 1) {
    return { valid: false, error: 'notInLine' };
  }

  // Check blank tiles have chosen letters
  const unsetBlanks = pendingTiles.filter((t) => t.isBlank && !t.chosenLetter);
  if (unsetBlanks.length > 0) {
    return { valid: false, error: 'blankNotSet' };
  }

  const isFirstWord = turns.length === 0;

  // First word must go through center
  if (isFirstWord) {
    const touchesCenter = pendingTiles.some(
      (t) => t.position.row === 7 && t.position.col === 7,
    );
    if (!touchesCenter) {
      return { valid: false, error: 'mustTouchCenter' };
    }
  }

  // Check connectivity: must touch at least one existing tile (unless first word)
  if (!isFirstWord) {
    const touchesExisting = pendingTiles.some((t) => {
      const { row, col } = t.position;
      return (
        (row > 0 && board[row - 1][col].tile && !board[row - 1][col].tile!.isCurrentTurn) ||
        (row < 14 && board[row + 1][col].tile && !board[row + 1][col].tile!.isCurrentTurn) ||
        (col > 0 && board[row][col - 1].tile && !board[row][col - 1].tile!.isCurrentTurn) ||
        (col < 14 && board[row][col + 1].tile && !board[row][col + 1].tile!.isCurrentTurn)
      );
    });
    if (!touchesExisting) {
      return { valid: false, error: 'mustConnect' };
    }
  }

  // Check no gaps in the line
  if (pendingTiles.length > 1) {
    const isHorizontal = rows.size === 1;
    if (isHorizontal) {
      const row = pendingTiles[0].position.row;
      const sortedCols = [...cols].sort((a, b) => a - b);
      for (let c = sortedCols[0]; c <= sortedCols[sortedCols.length - 1]; c++) {
        if (!board[row][c].tile) {
          return { valid: false, error: 'hasGaps' };
        }
      }
    } else {
      const col = pendingTiles[0].position.col;
      const sortedRows = [...rows].sort((a, b) => a - b);
      for (let r = sortedRows[0]; r <= sortedRows[sortedRows.length - 1]; r++) {
        if (!board[r][col].tile) {
          return { valid: false, error: 'hasGaps' };
        }
      }
    }
  }

  return { valid: true, error: null };
}

/**
 * Confirm the word placement.
 * NOTE: Word dictionary validation is done externally (async).
 * This function handles scoring and turn advancement.
 */
export function confirmPlacement(
  state: WoordyState,
  triviaCorrect: boolean | null = null,
): WoordyState {
  if (state.isComplete) return state;

  const { pendingTiles, board, turns } = state;
  const isFirstWord = turns.length === 0;

  // Check if any pending tile landed on a trivia field
  const triviaTriggered = pendingTiles.some((t) => {
    const cell = board[t.position.row][t.position.col];
    return cell.fieldType === 'trivia' && !cell.triviaRevealed;
  });

  // Calculate score
  const scoreBreakdown = calculateTurnScore(
    board,
    pendingTiles,
    isFirstWord,
    triviaTriggered,
    triviaCorrect,
  );

  // Get formed words
  const formedWords = findFormedWords(board, pendingTiles);
  const wordStrings = formedWords.map((cells) =>
    cells.map((c) => c.tile!.chosenLetter || c.tile!.letter).join(''),
  );

  // Create turn record
  const turnRecord: TurnRecord = {
    turnNumber: turns.length + 1,
    playedBy: state.currentTurn,
    action: 'place',
    wordsFormed: wordStrings,
    score: scoreBreakdown.total,
    tilesPlaced: pendingTiles,
    triviaTriggered,
    triviaCorrect,
  };

  // Update board: mark tiles as no longer current turn, reveal trivia
  const newBoard = board.map((row) =>
    row.map((cell) => {
      if (cell.tile && cell.tile.isCurrentTurn) {
        return {
          ...cell,
          tile: { ...cell.tile, isCurrentTurn: false },
          triviaRevealed: cell.fieldType === 'trivia' ? true : cell.triviaRevealed,
        };
      }
      return cell;
    }),
  );

  // Update current player score
  const currentPlayer = state.currentTurn === 'player' ? state.player : state.opponent;
  const updatedPlayer = {
    ...currentPlayer,
    score: currentPlayer.score + scoreBreakdown.total,
  };

  // Draw new tiles
  const tilesToDraw = RACK_SIZE - updatedPlayer.rack.length;
  const [newTiles, newBag] = drawTiles(state.letterBag, tilesToDraw);
  updatedPlayer.rack = [...updatedPlayer.rack, ...newTiles];

  // Check game over: player used all tiles and bag is empty
  const isComplete = updatedPlayer.rack.length === 0 && newBag.length === 0;
  const nextTurn = state.currentTurn === 'player' ? 'opponent' : 'player';

  return {
    ...state,
    board: newBoard,
    player: state.currentTurn === 'player' ? updatedPlayer : state.player,
    opponent: state.currentTurn === 'opponent' ? updatedPlayer : state.opponent,
    letterBag: newBag,
    currentTurn: isComplete ? state.currentTurn : nextTurn,
    turns: [...turns, turnRecord],
    consecutivePasses: 0,
    isComplete,
    endReason: isComplete ? 'tiles_empty' : null,
    selectedTileId: null,
    pendingTiles: [],
    pendingTrivia: false,
  };
}

/**
 * Pass the turn (no tiles played).
 */
export function passTurn(state: WoordyState): WoordyState {
  if (state.isComplete) return state;

  // Clear any pending tiles back to rack
  let clearedState = state;
  for (const tile of [...state.pendingTiles].reverse()) {
    clearedState = removePendingTile(clearedState, tile.position);
  }

  const newConsecutivePasses = clearedState.consecutivePasses + 1;
  const isComplete = newConsecutivePasses >= 2;

  const turnRecord: TurnRecord = {
    turnNumber: clearedState.turns.length + 1,
    playedBy: clearedState.currentTurn,
    action: 'pass',
    wordsFormed: [],
    score: 0,
    tilesPlaced: [],
    triviaTriggered: false,
    triviaCorrect: null,
  };

  return {
    ...clearedState,
    currentTurn: isComplete
      ? clearedState.currentTurn
      : clearedState.currentTurn === 'player'
        ? 'opponent'
        : 'player',
    turns: [...clearedState.turns, turnRecord],
    consecutivePasses: newConsecutivePasses,
    isComplete,
    endReason: isComplete ? 'both_passed' : null,
    selectedTileId: null,
    pendingTiles: [],
  };
}

/**
 * Swap selected tiles (exchange with bag).
 * Tiles must be selected from rack first.
 */
export function swapTiles(
  state: WoordyState,
  tileIds: string[],
): WoordyState {
  if (state.isComplete || tileIds.length === 0) return state;
  if (state.letterBag.length === 0) return state; // Can't swap with empty bag

  // Clear pending tiles first
  let clearedState = state;
  for (const tile of [...state.pendingTiles].reverse()) {
    clearedState = removePendingTile(clearedState, tile.position);
  }

  const currentPlayer =
    clearedState.currentTurn === 'player' ? clearedState.player : clearedState.opponent;

  const tilesToSwap = currentPlayer.rack.filter((t) => tileIds.includes(t.id));
  const remainingRack = currentPlayer.rack.filter((t) => !tileIds.includes(t.id));

  // Return tiles to bag, draw new ones
  const newBag = returnTilesToBag(clearedState.letterBag, tilesToSwap);
  const [drawnTiles, finalBag] = drawTiles(newBag, tilesToSwap.length);

  const updatedPlayer = {
    ...currentPlayer,
    rack: [...remainingRack, ...drawnTiles],
  };

  const turnRecord: TurnRecord = {
    turnNumber: clearedState.turns.length + 1,
    playedBy: clearedState.currentTurn,
    action: 'swap',
    wordsFormed: [],
    score: 0,
    tilesPlaced: [],
    triviaTriggered: false,
    triviaCorrect: null,
  };

  return {
    ...clearedState,
    player: clearedState.currentTurn === 'player' ? updatedPlayer : clearedState.player,
    opponent: clearedState.currentTurn === 'opponent' ? updatedPlayer : clearedState.opponent,
    letterBag: finalBag,
    currentTurn:
      clearedState.currentTurn === 'player' ? 'opponent' : 'player',
    turns: [...clearedState.turns, turnRecord],
    consecutivePasses: 0,
    selectedTileId: null,
    pendingTiles: [],
  };
}

/**
 * Resign the game.
 */
export function resignGame(state: WoordyState): WoordyState {
  if (state.isComplete) return state;

  const turnRecord: TurnRecord = {
    turnNumber: state.turns.length + 1,
    playedBy: state.currentTurn,
    action: 'resign',
    wordsFormed: [],
    score: 0,
    tilesPlaced: [],
    triviaTriggered: false,
    triviaCorrect: null,
  };

  return {
    ...state,
    turns: [...state.turns, turnRecord],
    isComplete: true,
    endReason: 'resign',
    selectedTileId: null,
    pendingTiles: [],
  };
}

// ============================================================
// Score Preview
// ============================================================

/**
 * Preview the score for currently placed tiles (before confirming).
 */
export function previewScore(state: WoordyState): TurnScoreBreakdown | null {
  if (state.pendingTiles.length === 0) return null;

  const isFirstWord = state.turns.length === 0;
  return calculateTurnScore(
    state.board,
    state.pendingTiles,
    isFirstWord,
    false, // no trivia during preview
    null,
  );
}

// ============================================================
// Game Over Helpers
// ============================================================

/**
 * Calculate the final adjusted scores after game ends.
 * Returns the adjustment amounts for each player.
 */
export function calculateFinalScores(state: WoordyState): {
  playerAdjustment: number;
  opponentAdjustment: number;
  playerFinal: number;
  opponentFinal: number;
} {
  if (state.endReason === 'resign') {
    return {
      playerAdjustment: 0,
      opponentAdjustment: 0,
      playerFinal: state.player.score,
      opponentFinal: state.opponent.score,
    };
  }

  const playerRemaining = state.player.rack.reduce(
    (sum, t) => sum + getLetterValue(t.letter),
    0,
  );
  const opponentRemaining = state.opponent.rack.reduce(
    (sum, t) => sum + getLetterValue(t.letter),
    0,
  );

  // Player who emptied rack gets opponent's remaining tile values
  const playerEmptied = state.player.rack.length === 0;
  const opponentEmptied = state.opponent.rack.length === 0;

  let playerAdj = -playerRemaining;
  let opponentAdj = -opponentRemaining;

  if (playerEmptied) {
    playerAdj = opponentRemaining;
  }
  if (opponentEmptied) {
    opponentAdj = playerRemaining;
  }

  return {
    playerAdjustment: playerAdj,
    opponentAdjustment: opponentAdj,
    playerFinal: state.player.score + playerAdj,
    opponentFinal: state.opponent.score + opponentAdj,
  };
}

/**
 * Determine the winner.
 */
export function getWinner(state: WoordyState): 'player' | 'opponent' | 'draw' | null {
  if (!state.isComplete) return null;

  if (state.endReason === 'resign') {
    return state.currentTurn === 'player' ? 'opponent' : 'player';
  }

  const { playerFinal, opponentFinal } = calculateFinalScores(state);
  if (playerFinal > opponentFinal) return 'player';
  if (opponentFinal > playerFinal) return 'opponent';
  return 'draw';
}

/**
 * Get star rating based on score ratio (solo mode: player vs opponent).
 */
export function getStarRating(state: WoordyState): 1 | 2 | 3 | undefined {
  if (!state.isComplete) return undefined;
  const winner = getWinner(state);
  if (winner !== 'player') return undefined;

  const { playerFinal, opponentFinal } = calculateFinalScores(state);
  if (opponentFinal === 0) return 3;
  const ratio = playerFinal / opponentFinal;
  if (ratio >= 2.0) return 3;
  if (ratio >= 1.5) return 2;
  return 1;
}

// ============================================================
// Serialization
// ============================================================

/**
 * Serialize state for WatermelonDB storage.
 */
export function serializeState(state: WoordyState): Record<string, unknown> {
  return { ...state };
}

/**
 * Deserialize state from database snapshot.
 */
export function deserializeState(snapshot: Record<string, unknown>): WoordyState {
  return snapshot as unknown as WoordyState;
}
