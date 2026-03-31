/**
 * GameContext — Shared Game State Provider
 *
 * Manages game sessions and statistics for all 5 CommEazy games.
 * Provides session lifecycle (create, save, complete, abandon) and
 * statistics tracking (scores, streaks, play counts).
 *
 * @see types/games.ts for type definitions
 * @see models/GameSession.ts for session model
 * @see models/GameStat.ts for statistics model
 * @see Prompt_0_Games_Architecture.md for design rationale
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

import { ServiceContainer } from '@/services/container';
import { WatermelonDBService } from '@/services/database';
import { GameSessionModel } from '@/models/GameSession';
import { GameStatModel } from '@/models/GameStat';
import type {
  GameType,
  GameMode,
  GameDifficulty,
  GameSessionStatus,
  GameStatKey,
  GameStatsDisplay,
  GameStanza,
} from '@/types/games';

// ============================================================
// Types
// ============================================================

/** Data required to create a new game session */
export interface CreateGameSessionData {
  gameType: GameType;
  mode: GameMode;
  difficulty?: GameDifficulty;
  /** JID of the host (multiplayer only) */
  hostJid?: string;
  /** Player JIDs including self */
  players: string[];
}

/** Handler function for incoming game stanzas */
export type GameStanzaHandler = (stanza: GameStanza) => void;

/** Context value provided to consumers */
export interface GameContextValue {
  /** Whether initial data load is complete */
  isLoading: boolean;

  // ── Session Management ──────────────────────────────────

  /** Get active (in_progress) session for a game type, if any */
  getActiveSession: (gameType: GameType) => GameSessionModel | null;

  /** Create a new game session, returns the session */
  createSession: (data: CreateGameSessionData) => Promise<GameSessionModel>;

  /** Save game state snapshot (for pause/resume) */
  saveSessionState: (
    sessionId: string,
    state: Record<string, unknown>,
    score: number,
    durationSeconds: number,
  ) => Promise<void>;

  /** Mark a session as completed and update stats */
  completeSession: (
    sessionId: string,
    finalScore: number,
    totalDuration: number,
    won: boolean,
  ) => Promise<void>;

  /** Mark a session as abandoned */
  abandonSession: (sessionId: string) => Promise<void>;

  // ── Statistics ──────────────────────────────────────────

  /** Get aggregated stats display for a game type */
  getStats: (gameType: GameType) => GameStatsDisplay;

  /** Reload all data from database */
  reload: () => Promise<void>;

  // ── XMPP Multiplayer ──────────────────────────────────

  /** Send a game stanza to specified JIDs via XMPP */
  sendGameStanza: (targetJids: string[], stanza: GameStanza) => void;

  /** Register a handler for incoming game stanzas */
  registerGameHandler: (handler: GameStanzaHandler) => void;

  /** Unregister a previously registered game stanza handler */
  unregisterGameHandler: (handler: GameStanzaHandler) => void;
}

// ============================================================
// Context
// ============================================================

const GameContext = createContext<GameContextValue | null>(null);

// ============================================================
// Helper: default empty stats
// ============================================================

function emptyStats(gameType: GameType): GameStatsDisplay {
  return {
    gameType,
    gamesPlayed: 0,
    gamesWon: 0,
    bestScore: 0,
    bestTimeSeconds: null,
    currentStreak: 0,
    bestStreak: 0,
    winRate: 0,
  };
}

// ============================================================
// Provider
// ============================================================

export function GameProvider({ children }: { children: ReactNode }) {
  const [activeSessions, setActiveSessions] = useState<GameSessionModel[]>([]);
  const [allStats, setAllStats] = useState<GameStatModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Data Loading ────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const dbService = ServiceContainer.database as WatermelonDBService;
      const db = dbService.getDb();

      // Load active sessions for all game types
      const sessionCollection = db.get<GameSessionModel>('game_sessions');
      const sessions = await sessionCollection
        .query()
        .fetch();
      // Filter to only in_progress sessions
      const active = sessions.filter(s => s.status === 'in_progress');
      setActiveSessions(active);

      // Load all stats
      const statCollection = db.get<GameStatModel>('game_stats');
      const stats = await statCollection.query().fetch();
      setAllStats(stats);
    } catch (error) {
      console.error('[GameContext] Failed to load data:', (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Session Management ──────────────────────────────────

  const getActiveSession = useCallback(
    (gameType: GameType): GameSessionModel | null => {
      return (
        activeSessions.find(
          s => s.gameType === gameType && s.status === 'in_progress',
        ) ?? null
      );
    },
    [activeSessions],
  );

  const createSession = useCallback(
    async (data: CreateGameSessionData): Promise<GameSessionModel> => {
      const dbService = ServiceContainer.database as WatermelonDBService;
      const db = dbService.getDb();
      const collection = db.get<GameSessionModel>('game_sessions');

      // Generate a UUID for the game
      const gameId = `game-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      let session: GameSessionModel | null = null;
      await db.write(async () => {
        session = await collection.create(record => {
          record.gameId = gameId;
          record.gameType = data.gameType;
          record.mode = data.mode;
          record.status = 'in_progress';
          record.hostJid = data.hostJid;
          record.players = JSON.stringify(data.players);
          record.score = 0;
          record.difficulty = data.difficulty;
          record.startedAt = Date.now();
          record.durationSeconds = 0;
        });
      });

      await loadData();
      return session!;
    },
    [loadData],
  );

  const saveSessionState = useCallback(
    async (
      sessionId: string,
      state: Record<string, unknown>,
      score: number,
      durationSeconds: number,
    ): Promise<void> => {
      const dbService = ServiceContainer.database as WatermelonDBService;
      const db = dbService.getDb();
      const collection = db.get<GameSessionModel>('game_sessions');

      const session = await collection.find(sessionId);
      await session.saveState(state, score, durationSeconds);
    },
    [],
  );

  const completeSession = useCallback(
    async (
      sessionId: string,
      finalScore: number,
      totalDuration: number,
      won: boolean,
    ): Promise<void> => {
      const dbService = ServiceContainer.database as WatermelonDBService;
      const db = dbService.getDb();
      const sessionCollection = db.get<GameSessionModel>('game_sessions');
      const statCollection = db.get<GameStatModel>('game_stats');

      const session = await sessionCollection.find(sessionId);
      const gameType = session.gameType;

      // All updates in a single db.write() to avoid concurrent write conflicts
      await db.write(async () => {
        // Mark session as completed
        session.prepareComplete(finalScore, totalDuration);

        // Helper to get or create a stat record
        const getOrCreateStat = async (
          key: GameStatKey,
        ): Promise<GameStatModel> => {
          const existing = await GameStatModel.queryByStat(
            statCollection,
            gameType,
            key,
          ).fetch();
          if (existing.length > 0) return existing[0];

          return await statCollection.create(record => {
            record.gameType = gameType;
            record.statKey = key;
            record.statValue = 0;
          });
        };

        // games_played +1
        const played = await getOrCreateStat('games_played');
        played.prepareUpdate(r => {
          r.statValue = r.statValue + 1;
        });

        // games_won (if applicable)
        if (won) {
          const wonStat = await getOrCreateStat('games_won');
          wonStat.prepareUpdate(r => {
            r.statValue = r.statValue + 1;
          });

          // current_streak +1
          const streak = await getOrCreateStat('current_streak');
          const currentStreakVal = streak.statValue + 1;
          streak.prepareUpdate(r => {
            r.statValue = currentStreakVal;
          });

          // best_streak (update if current > best)
          const bestStreak = await getOrCreateStat('best_streak');
          if (currentStreakVal > bestStreak.statValue) {
            bestStreak.prepareUpdate(r => {
              r.statValue = currentStreakVal;
            });
          }
        } else {
          // games_lost +1
          const lost = await getOrCreateStat('games_lost');
          lost.prepareUpdate(r => {
            r.statValue = r.statValue + 1;
          });

          // Reset current streak
          const streak = await getOrCreateStat('current_streak');
          streak.prepareUpdate(r => {
            r.statValue = 0;
          });
        }

        // best_score
        const bestScore = await getOrCreateStat('best_score');
        if (finalScore > bestScore.statValue) {
          bestScore.prepareUpdate(r => {
            r.statValue = finalScore;
          });
        }

        // total_score
        const totalScore = await getOrCreateStat('total_score');
        totalScore.prepareUpdate(r => {
          r.statValue = r.statValue + finalScore;
        });

        // best_time_seconds (lower is better)
        if (totalDuration > 0) {
          const bestTime = await getOrCreateStat('best_time_seconds');
          if (bestTime.statValue === 0 || totalDuration < bestTime.statValue) {
            bestTime.prepareUpdate(r => {
              r.statValue = totalDuration;
            });
          }
        }

        // total_time_seconds
        const totalTime = await getOrCreateStat('total_time_seconds');
        totalTime.prepareUpdate(r => {
          r.statValue = r.statValue + totalDuration;
        });
      });

      await loadData();
    },
    [loadData],
  );

  const abandonSession = useCallback(
    async (sessionId: string): Promise<void> => {
      const dbService = ServiceContainer.database as WatermelonDBService;
      const db = dbService.getDb();
      const collection = db.get<GameSessionModel>('game_sessions');

      const session = await collection.find(sessionId);
      await db.write(async () => {
        session.prepareAbandon();
      });

      await loadData();
    },
    [loadData],
  );

  // ── Statistics ──────────────────────────────────────────

  const getStats = useCallback(
    (gameType: GameType): GameStatsDisplay => {
      const gameStats = allStats.filter(s => s.gameType === gameType);
      if (gameStats.length === 0) return emptyStats(gameType);

      const getStat = (key: GameStatKey): number => {
        const stat = gameStats.find(s => s.statKey === key);
        return stat?.statValue ?? 0;
      };

      const gamesPlayed = getStat('games_played');
      const gamesWon = getStat('games_won');
      const bestTimeVal = getStat('best_time_seconds');

      return {
        gameType,
        gamesPlayed,
        gamesWon,
        bestScore: getStat('best_score'),
        bestTimeSeconds: bestTimeVal > 0 ? bestTimeVal : null,
        currentStreak: getStat('current_streak'),
        bestStreak: getStat('best_streak'),
        winRate: gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0,
      };
    },
    [allStats],
  );

  // ── XMPP Multiplayer ───────────────────────────────────

  const gameHandlersRef = useRef<Set<GameStanzaHandler>>(new Set());

  const sendGameStanza = useCallback(
    (targetJids: string[], stanza: GameStanza) => {
      // TODO: Wire to actual XMPP service when game protocol is connected
      // For now, log the intent for development/testing
      console.debug('[GameContext] sendGameStanza', {
        type: stanza.type,
        gameId: stanza.gameId,
        targets: targetJids.length,
      });
    },
    [],
  );

  const registerGameHandler = useCallback((handler: GameStanzaHandler) => {
    gameHandlersRef.current.add(handler);
  }, []);

  const unregisterGameHandler = useCallback((handler: GameStanzaHandler) => {
    gameHandlersRef.current.delete(handler);
  }, []);

  /**
   * Dispatch an incoming game stanza to all registered handlers.
   * Called by the XMPP service when a game message is received.
   */
  const dispatchGameStanza = useCallback((stanza: GameStanza) => {
    gameHandlersRef.current.forEach(handler => {
      try {
        handler(stanza);
      } catch (error) {
        console.error('[GameContext] Handler error:', (error as Error).message);
      }
    });
  }, []);

  // ── Context Value ───────────────────────────────────────

  const value = useMemo<GameContextValue>(
    () => ({
      isLoading,
      getActiveSession,
      createSession,
      saveSessionState,
      completeSession,
      abandonSession,
      getStats,
      reload: loadData,
      sendGameStanza,
      registerGameHandler,
      unregisterGameHandler,
    }),
    [
      isLoading,
      getActiveSession,
      createSession,
      saveSessionState,
      completeSession,
      abandonSession,
      getStats,
      loadData,
      sendGameStanza,
      registerGameHandler,
      unregisterGameHandler,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// ============================================================
// Hooks
// ============================================================

/** Use game context — throws if not within GameProvider */
export function useGameContext(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameContext must be used within GameProvider');
  }
  return context;
}

/** Safe variant — returns null outside GameProvider */
export function useGameContextSafe(): GameContextValue | null {
  return useContext(GameContext);
}
