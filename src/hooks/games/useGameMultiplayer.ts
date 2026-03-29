/**
 * useGameMultiplayer — Multiplayer game communication hook
 *
 * Manages XMPP game stanza sending/receiving for a specific game session.
 * Handles move transmission, state sync, game end, resign, and chat.
 *
 * @see Prompt_1_Games_Foundation.md §6.3
 * @see types/games.ts for GameStanza types
 * @see contexts/GameContext.tsx for XMPP handler registration
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useGameContext } from '@/contexts/GameContext';
import type {
  GameType,
  GameStanza,
  GameStanzaType,
} from '@/types/games';

// ============================================================
// Types
// ============================================================

interface UseGameMultiplayerOptions {
  /** Game session UUID */
  gameId: string;
  /** Game type */
  gameType: GameType;
  /** Whether this player is the host */
  isHost: boolean;
  /** JIDs of players in the game */
  playerJids: string[];
}

interface UseGameMultiplayerReturn {
  /** Send a game move to other players */
  sendMove: (move: Record<string, unknown>) => void;
  /** Send state sync to a specific player (host → player) */
  sendStateSync: (state: Record<string, unknown>, targetJid: string) => void;
  /** Broadcast game end with final scores */
  sendGameEnd: (scores: Record<string, unknown>) => void;
  /** Send resign notification */
  sendResign: () => void;
  /** Send in-game chat message */
  sendChat: (message: string) => void;
  /** Register callback for incoming moves */
  onMoveReceived: (callback: (move: Record<string, unknown>, senderJid: string) => void) => void;
  /** Register callback for state sync */
  onStateSyncReceived: (callback: (state: Record<string, unknown>) => void) => void;
  /** Register callback for game end */
  onGameEndReceived: (callback: (scores: Record<string, unknown>) => void) => void;
  /** Register callback for resign */
  onResignReceived: (callback: (jid: string) => void) => void;
  /** Register callback for chat */
  onChatReceived: (callback: (message: string, senderJid: string) => void) => void;
  /** Register callback for player disconnect */
  onPlayerDisconnected: (callback: (jid: string) => void) => void;
  /** JIDs of currently connected players */
  connectedPlayers: string[];
  /** Whether own connection is active */
  isConnected: boolean;
}

// ============================================================
// Hook
// ============================================================

export function useGameMultiplayer({
  gameId,
  gameType,
  isHost,
  playerJids,
}: UseGameMultiplayerOptions): UseGameMultiplayerReturn {
  const { sendGameStanza, registerGameHandler, unregisterGameHandler } = useGameContext();
  const [connectedPlayers, setConnectedPlayers] = useState<string[]>(playerJids);
  const [isConnected, setIsConnected] = useState(true);

  // Callback refs to avoid re-registration on every render
  const moveCallbackRef = useRef<((move: Record<string, unknown>, senderJid: string) => void) | null>(null);
  const stateSyncCallbackRef = useRef<((state: Record<string, unknown>) => void) | null>(null);
  const gameEndCallbackRef = useRef<((scores: Record<string, unknown>) => void) | null>(null);
  const resignCallbackRef = useRef<((jid: string) => void) | null>(null);
  const chatCallbackRef = useRef<((message: string, senderJid: string) => void) | null>(null);
  const disconnectCallbackRef = useRef<((jid: string) => void) | null>(null);

  // ── Stanza handler ──────────────────────────────────────

  useEffect(() => {
    const handler = (stanza: GameStanza) => {
      // Only process stanzas for this game session
      if (stanza.gameId !== gameId) return;

      switch (stanza.type) {
        case 'game_move':
        case 'game_move_ack':
          moveCallbackRef.current?.(stanza.payload, stanza.senderId);
          break;
        case 'game_state_sync':
          stateSyncCallbackRef.current?.(stanza.payload);
          break;
        case 'game_end':
          gameEndCallbackRef.current?.(stanza.payload);
          break;
        case 'game_resign':
          resignCallbackRef.current?.(stanza.senderId);
          break;
        case 'game_chat':
          chatCallbackRef.current?.(
            (stanza.payload.message as string) || '',
            stanza.senderId,
          );
          break;
      }
    };

    registerGameHandler(handler);
    return () => unregisterGameHandler(handler);
  }, [gameId, registerGameHandler, unregisterGameHandler]);

  // ── Send helpers ────────────────────────────────────────

  const buildStanza = useCallback(
    (type: GameStanzaType, payload: Record<string, unknown>): GameStanza => ({
      type,
      gameType,
      gameId,
      senderId: '', // Filled by GameContext/XMPP service
      timestamp: Date.now(),
      payload,
    }),
    [gameId, gameType],
  );

  const sendMove = useCallback(
    (move: Record<string, unknown>) => {
      sendGameStanza(playerJids, buildStanza('game_move', move));
    },
    [sendGameStanza, playerJids, buildStanza],
  );

  const sendStateSync = useCallback(
    (state: Record<string, unknown>, targetJid: string) => {
      sendGameStanza([targetJid], buildStanza('game_state_sync', state));
    },
    [sendGameStanza, buildStanza],
  );

  const sendGameEnd = useCallback(
    (scores: Record<string, unknown>) => {
      sendGameStanza(playerJids, buildStanza('game_end', scores));
    },
    [sendGameStanza, playerJids, buildStanza],
  );

  const sendResign = useCallback(() => {
    sendGameStanza(playerJids, buildStanza('game_resign', {}));
  }, [sendGameStanza, playerJids, buildStanza]);

  const sendChat = useCallback(
    (message: string) => {
      sendGameStanza(playerJids, buildStanza('game_chat', { message }));
    },
    [sendGameStanza, playerJids, buildStanza],
  );

  // ── Callback registration ──────────────────────────────

  const onMoveReceived = useCallback(
    (callback: (move: Record<string, unknown>, senderJid: string) => void) => {
      moveCallbackRef.current = callback;
    },
    [],
  );

  const onStateSyncReceived = useCallback(
    (callback: (state: Record<string, unknown>) => void) => {
      stateSyncCallbackRef.current = callback;
    },
    [],
  );

  const onGameEndReceived = useCallback(
    (callback: (scores: Record<string, unknown>) => void) => {
      gameEndCallbackRef.current = callback;
    },
    [],
  );

  const onResignReceived = useCallback(
    (callback: (jid: string) => void) => {
      resignCallbackRef.current = callback;
    },
    [],
  );

  const onChatReceived = useCallback(
    (callback: (message: string, senderJid: string) => void) => {
      chatCallbackRef.current = callback;
    },
    [],
  );

  const onPlayerDisconnected = useCallback(
    (callback: (jid: string) => void) => {
      disconnectCallbackRef.current = callback;
    },
    [],
  );

  return {
    sendMove,
    sendStateSync,
    sendGameEnd,
    sendResign,
    sendChat,
    onMoveReceived,
    onStateSyncReceived,
    onGameEndReceived,
    onResignReceived,
    onChatReceived,
    onPlayerDisconnected,
    connectedPlayers,
    isConnected,
  };
}
