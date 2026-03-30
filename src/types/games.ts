/**
 * Game Type Definitions — CommEazy
 *
 * Shared types for all 6 games: Woordraad, Sudoku, Solitaire, Memory, Trivia, Woordy.
 *
 * @see Prompt_0_Games_Architecture.md for design rationale
 * @see models/GameSession.ts for WatermelonDB model
 * @see models/GameStat.ts for statistics model
 */

// ============================================================
// Game Identifiers
// ============================================================

/**
 * Game type identifiers — matches ModuleColorId game entries
 */
export type GameType = 'woordraad' | 'sudoku' | 'solitaire' | 'memory' | 'trivia' | 'woordy';

/**
 * All available game types as const array (for iteration)
 */
export const ALL_GAME_TYPES: GameType[] = [
  'woordraad',
  'sudoku',
  'solitaire',
  'memory',
  'trivia',
  'woordy',
];

/**
 * Games that support multiplayer via XMPP
 */
export const MULTIPLAYER_GAMES: GameType[] = ['woordraad', 'memory', 'trivia', 'woordy'];

/**
 * Games that are solo-only
 */
export const SOLO_ONLY_GAMES: GameType[] = ['sudoku', 'solitaire'];

// ============================================================
// Game Session
// ============================================================

/**
 * Game play mode
 */
export type GameMode = 'solo' | 'multiplayer';

/**
 * Game session status
 */
export type GameSessionStatus = 'in_progress' | 'completed' | 'abandoned';

/**
 * Difficulty levels (used by Sudoku, Solitaire, Trivia)
 */
export type GameDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

// ============================================================
// XMPP Game Protocol
// ============================================================

/**
 * Custom XMPP namespace for game communication
 * Follows pattern of urn:commeazy:call:1
 */
export const GAME_XMPP_NAMESPACE = 'urn:commeazy:game:1';

/**
 * Game stanza payload types
 */
export type GameStanzaType =
  | 'game_invite'
  | 'game_invite_accept'
  | 'game_invite_decline'
  | 'game_start'
  | 'game_move'
  | 'game_move_ack'
  | 'game_move_reject'
  | 'game_state_sync'
  | 'game_end'
  | 'game_resign'
  | 'game_chat';

/**
 * Base game stanza structure — sent via XMPP <message> with <game> element
 */
export interface GameStanza {
  /** Stanza type (see GameStanzaType) */
  type: GameStanzaType;
  /** Which game this is for */
  gameType: GameType;
  /** UUID of the current game session */
  gameId: string;
  /** JID of the sender */
  senderId: string;
  /** Unix timestamp (ms) */
  timestamp: number;
  /** Game-specific data (varies by stanza type and game) */
  payload: Record<string, unknown>;
}

// ============================================================
// Game Invite
// ============================================================

/**
 * Invite status for a single player
 */
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'timeout';

/**
 * Tracked invite for multiplayer matchmaking
 */
export interface GameInvite {
  /** JID of the invited player */
  playerJid: string;
  /** Display name of the invited player */
  playerName: string;
  /** Current invite status */
  status: InviteStatus;
  /** Timestamp when invite was sent */
  sentAt: number;
}

/**
 * Invite timeout in milliseconds (60 seconds)
 */
export const GAME_INVITE_TIMEOUT_MS = 60_000;

/**
 * Maximum number of players per multiplayer game
 */
export const MAX_GAME_PLAYERS = 4;

// ============================================================
// Multiplayer Session
// ============================================================

/**
 * Player in a multiplayer game session
 */
export interface GamePlayer {
  /** Player's JID */
  jid: string;
  /** Display name */
  name: string;
  /** Whether this player is the host (validates moves) */
  isHost: boolean;
  /** Connection status */
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  /** Current score in this game */
  score: number;
  /** Last heartbeat timestamp */
  lastHeartbeat: number;
}

/**
 * Heartbeat interval in milliseconds (15 seconds)
 */
export const GAME_HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Disconnect timeout in milliseconds (60 seconds without heartbeat)
 */
export const GAME_DISCONNECT_TIMEOUT_MS = 60_000;

// ============================================================
// Game Statistics
// ============================================================

/**
 * Standard stat keys tracked per game type
 */
export type GameStatKey =
  | 'games_played'
  | 'games_won'
  | 'games_lost'
  | 'best_score'
  | 'total_score'
  | 'best_time_seconds'
  | 'total_time_seconds'
  | 'current_streak'
  | 'best_streak'
  | 'daily_challenges_completed';

/**
 * Aggregated statistics for display in GameStatsView
 */
export interface GameStatsDisplay {
  gameType: GameType;
  gamesPlayed: number;
  gamesWon: number;
  bestScore: number;
  bestTimeSeconds: number | null;
  currentStreak: number;
  bestStreak: number;
  /** Win rate as 0-100 percentage */
  winRate: number;
}

// ============================================================
// Game Over
// ============================================================

/**
 * Game outcome for GameOverModal
 */
export type GameOutcome = 'win' | 'loss' | 'draw' | 'completed';

/**
 * Data passed to GameOverModal
 */
export interface GameOverData {
  /** Final outcome */
  outcome: GameOutcome;
  /** Player's final score */
  score: number;
  /** Time played in seconds */
  durationSeconds: number;
  /** Game-specific score breakdown */
  breakdown?: Record<string, number | string>;
  /** Whether this is a new personal best */
  isNewBest: boolean;
  /** Star rating (1-3) for solo games */
  stars?: 1 | 2 | 3;
  /** Multiplayer: all player scores */
  playerScores?: Array<{ name: string; score: number; isWinner: boolean }>;
}
