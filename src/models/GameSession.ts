/**
 * GameSession Model — WatermelonDB
 *
 * Stores active and completed game sessions for all 5 game types.
 * Used for resuming interrupted games and tracking history.
 *
 * @see types/games.ts for type definitions
 * @see schema.ts v30 for table definition
 */

import { Model, Q } from '@nozbe/watermelondb';
import { field, date, readonly, writer } from '@nozbe/watermelondb/decorators';
import type { GameType, GameMode, GameSessionStatus, GameDifficulty } from '../types/games';

export class GameSessionModel extends Model {
  static table = 'game_sessions';

  /** UUID of the game (used for XMPP multiplayer identification) */
  @field('game_id') gameId!: string;

  /** Game type: 'woordraad', 'sudoku', 'solitaire', 'memory', 'trivia' */
  @field('game_type') gameType!: GameType;

  /** Play mode: 'solo' or 'multiplayer' */
  @field('mode') mode!: GameMode;

  /** Session status: 'in_progress', 'completed', 'abandoned' */
  @field('status') status!: GameSessionStatus;

  /** JID of the host (multiplayer only, nullable for solo) */
  @field('host_jid') hostJid?: string;

  /** JSON array of player JIDs (including self) */
  @field('players') players!: string;

  /** JSON snapshot of game state (for resume) */
  @field('state_snapshot') stateSnapshot?: string;

  /** Final or current score */
  @field('score') score!: number;

  /** Game-specific difficulty level */
  @field('difficulty') difficulty?: GameDifficulty;

  /** Unix timestamp when game started */
  @field('started_at') startedAt!: number;

  /** Unix timestamp when game ended (null if in_progress) */
  @field('completed_at') completedAt?: number;

  /** Total play duration in seconds */
  @field('duration_seconds') durationSeconds!: number;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // ============================================================
  // Getters
  // ============================================================

  /** Parse players JSON array */
  get playerList(): string[] {
    try {
      return JSON.parse(this.players);
    } catch {
      return [];
    }
  }

  /** Parse state snapshot JSON */
  get parsedState(): Record<string, unknown> | null {
    if (!this.stateSnapshot) return null;
    try {
      return JSON.parse(this.stateSnapshot);
    } catch {
      return null;
    }
  }

  /** Whether this game can be resumed */
  get isResumable(): boolean {
    return this.status === 'in_progress' && this.mode === 'solo';
  }

  // ============================================================
  // Writers
  // ============================================================

  /** Save game state snapshot (for pause/resume) */
  @writer async saveState(state: Record<string, unknown>, score: number, durationSeconds: number): Promise<void> {
    await this.update(record => {
      record.stateSnapshot = JSON.stringify(state);
      record.score = score;
      record.durationSeconds = durationSeconds;
    });
  }

  /** Mark game as completed */
  @writer async complete(finalScore: number, totalDuration: number): Promise<void> {
    await this.update(record => {
      record.status = 'completed';
      record.score = finalScore;
      record.durationSeconds = totalDuration;
      record.completedAt = Date.now();
    });
  }

  /** Mark game as abandoned */
  @writer async abandon(): Promise<void> {
    await this.update(record => {
      record.status = 'abandoned';
      record.completedAt = Date.now();
    });
  }

  // ============================================================
  // Static Queries
  // ============================================================

  /** Find active (in_progress) game session for a game type */
  static queryActive(collection: GameSessionModel['collection'], gameType: GameType) {
    return collection.query(
      Q.where('game_type', gameType),
      Q.where('status', 'in_progress'),
      Q.sortBy('started_at', Q.desc),
      Q.take(1),
    );
  }

  /** Find all completed games for a game type */
  static queryCompleted(collection: GameSessionModel['collection'], gameType: GameType) {
    return collection.query(
      Q.where('game_type', gameType),
      Q.where('status', 'completed'),
      Q.sortBy('completed_at', Q.desc),
    );
  }

  /** Find game session by game_id (UUID) */
  static queryByGameId(collection: GameSessionModel['collection'], gameId: string) {
    return collection.query(Q.where('game_id', gameId));
  }
}
