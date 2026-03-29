/**
 * GameStat Model — WatermelonDB
 *
 * Stores aggregated game statistics per game type.
 * Each row is a single stat_key for a game_type (e.g., 'sudoku' + 'best_score').
 *
 * @see types/games.ts for GameStatKey type
 * @see schema.ts v30 for table definition
 */

import { Model, Q } from '@nozbe/watermelondb';
import { field, date, readonly, writer } from '@nozbe/watermelondb/decorators';
import type { GameType, GameStatKey } from '../types/games';

export class GameStatModel extends Model {
  static table = 'game_stats';

  /** Game type: 'woordraad', 'sudoku', etc. */
  @field('game_type') gameType!: GameType;

  /** Stat identifier: 'games_played', 'best_score', etc. */
  @field('stat_key') statKey!: GameStatKey;

  /** Numeric value for this stat */
  @field('stat_value') statValue!: number;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // ============================================================
  // Writers
  // ============================================================

  /** Update stat value */
  @writer async setValue(value: number): Promise<void> {
    await this.update(record => {
      record.statValue = value;
    });
  }

  /** Increment stat value by amount (default 1) */
  @writer async increment(amount: number = 1): Promise<void> {
    await this.update(record => {
      record.statValue = record.statValue + amount;
    });
  }

  /** Set value only if higher than current (for best scores) */
  @writer async setIfHigher(value: number): Promise<void> {
    if (value > this.statValue) {
      await this.update(record => {
        record.statValue = value;
      });
    }
  }

  /** Set value only if lower than current (for best times) */
  @writer async setIfLower(value: number): Promise<void> {
    if (this.statValue === 0 || value < this.statValue) {
      await this.update(record => {
        record.statValue = value;
      });
    }
  }

  // ============================================================
  // Static Queries
  // ============================================================

  /** Get all stats for a game type */
  static queryByGameType(collection: GameStatModel['collection'], gameType: GameType) {
    return collection.query(Q.where('game_type', gameType));
  }

  /** Get a specific stat */
  static queryByStat(collection: GameStatModel['collection'], gameType: GameType, statKey: GameStatKey) {
    return collection.query(
      Q.where('game_type', gameType),
      Q.where('stat_key', statKey),
    );
  }
}
