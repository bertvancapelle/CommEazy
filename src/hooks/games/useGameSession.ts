/**
 * useGameSession — Game Session Lifecycle Hook
 *
 * Manages the lifecycle of a single game session:
 * - Create/resume sessions
 * - Auto-save state snapshots
 * - Timer tracking (play duration)
 * - Status transitions (in_progress → completed/abandoned)
 *
 * @see contexts/GameContext.tsx for data layer
 * @see models/GameSession.ts for model
 * @see Prompt_0_Games_Architecture.md §6.1
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGameContext, type CreateGameSessionData } from '@/contexts/GameContext';
import { GameSessionModel } from '@/models/GameSession';
import type { GameType } from '@/types/games';

interface UseGameSessionOptions {
  /** Game type for this session */
  gameType: GameType;
  /** Auto-save interval in milliseconds (default: 30000 = 30s) */
  autoSaveInterval?: number;
}

interface UseGameSessionReturn {
  /** Current active session, or null */
  session: GameSessionModel | null;
  /** Whether a session is currently active */
  isActive: boolean;
  /** Current play duration in seconds */
  durationSeconds: number;
  /** Start a new game session */
  startSession: (data: Omit<CreateGameSessionData, 'gameType'>) => Promise<GameSessionModel>;
  /** Resume an existing in_progress session */
  resumeSession: () => GameSessionModel | null;
  /** Save current game state */
  saveState: (state: Record<string, unknown>, score: number) => Promise<void>;
  /** Complete the game (win or lose) */
  completeGame: (finalScore: number, won: boolean) => Promise<void>;
  /** Abandon the game */
  abandonGame: () => Promise<void>;
}

export function useGameSession({
  gameType,
  autoSaveInterval = 30_000,
}: UseGameSessionOptions): UseGameSessionReturn {
  const {
    getActiveSession,
    createSession,
    saveSessionState,
    completeSession,
    abandonSession,
  } = useGameContext();

  const [session, setSession] = useState<GameSessionModel | null>(() =>
    getActiveSession(gameType),
  );
  const [durationSeconds, setDurationSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const baseDurationRef = useRef<number>(0);

  // ── Timer ─────────────────────────────────────────────

  const startTimer = useCallback((baseDuration: number = 0) => {
    baseDurationRef.current = baseDuration;
    startTimeRef.current = Date.now();
    setDurationSeconds(baseDuration);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setDurationSeconds(baseDurationRef.current + elapsed);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  // Resume timer if session exists on mount
  useEffect(() => {
    const active = getActiveSession(gameType);
    if (active) {
      setSession(active);
      startTimer(active.durationSeconds);
    }
  }, [gameType, getActiveSession, startTimer]);

  // ── Session Lifecycle ─────────────────────────────────

  const startSession = useCallback(
    async (data: Omit<CreateGameSessionData, 'gameType'>): Promise<GameSessionModel> => {
      const newSession = await createSession({
        ...data,
        gameType,
      });
      setSession(newSession);
      startTimer(0);
      return newSession;
    },
    [createSession, gameType, startTimer],
  );

  const resumeSession = useCallback((): GameSessionModel | null => {
    const active = getActiveSession(gameType);
    if (active) {
      setSession(active);
      startTimer(active.durationSeconds);
    }
    return active;
  }, [getActiveSession, gameType, startTimer]);

  const saveState = useCallback(
    async (state: Record<string, unknown>, score: number): Promise<void> => {
      if (!session) return;
      await saveSessionState(session.id, state, score, durationSeconds);
    },
    [session, saveSessionState, durationSeconds],
  );

  const completeGame = useCallback(
    async (finalScore: number, won: boolean): Promise<void> => {
      if (!session) return;
      stopTimer();
      // Capture current duration before any async work
      const finalDuration = baseDurationRef.current +
        Math.floor((Date.now() - startTimeRef.current) / 1000);
      setDurationSeconds(finalDuration);
      await completeSession(session.id, finalScore, finalDuration, won);
      setSession(null);
      // Don't reset durationSeconds here — keep it so GameOverModal shows the final time.
      // It gets reset in startSession() when a new game begins.
    },
    [session, completeSession, stopTimer],
  );

  const abandonGame = useCallback(async (): Promise<void> => {
    if (!session) return;
    stopTimer();
    await abandonSession(session.id);
    setSession(null);
    setDurationSeconds(0);
  }, [session, abandonSession, stopTimer]);

  // ── Auto-save ─────────────────────────────────────────

  // Note: auto-save requires the game-specific screen to call saveState()
  // with the current game state. The hook provides the timer; the screen
  // provides the state. This is intentional — we don't store game state
  // here because each game has different state shapes.

  return {
    session,
    isActive: session !== null,
    durationSeconds,
    startSession,
    resumeSession,
    saveState,
    completeGame,
    abandonGame,
  };
}
