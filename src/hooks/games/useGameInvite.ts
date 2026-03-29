/**
 * useGameInvite — Multiplayer game invitation hook
 *
 * Manages sending, receiving, accepting, and declining game invites
 * via XMPP game stanzas. Handles invite timeout (60s).
 *
 * @see Prompt_1_Games_Foundation.md §6.4
 * @see types/games.ts for GameStanza, InviteStatus, GAME_INVITE_TIMEOUT_MS
 * @see contexts/GameContext.tsx for XMPP handler registration
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useGameContext } from '@/contexts/GameContext';
import type {
  GameType,
  GameStanza,
  InviteStatus,
} from '@/types/games';

// ============================================================
// Types
// ============================================================

/** Status of an outgoing invite per JID */
export interface OutgoingInviteStatus {
  jid: string;
  name: string;
  status: InviteStatus;
  sentAt: number;
}

/** Incoming invite from another player */
export interface IncomingInvite {
  gameId: string;
  gameType: GameType;
  hostJid: string;
  hostName: string;
  receivedAt: number;
}

interface UseGameInviteReturn {
  /** Send game invitations to selected contacts */
  sendInvites: (jids: string[], names: Record<string, string>) => void;
  /** Accept an incoming invite */
  acceptInvite: (gameId: string, hostJid: string) => void;
  /** Decline an incoming invite */
  declineInvite: (gameId: string, hostJid: string) => void;
  /** Cancel all pending outgoing invites */
  cancelInvites: () => void;
  /** Status of each outgoing invite */
  inviteStatuses: OutgoingInviteStatus[];
  /** Currently pending incoming invite, if any */
  incomingInvite: IncomingInvite | null;
  /** Dismiss the incoming invite notification */
  dismissIncomingInvite: () => void;
  /** Whether all outgoing invites are resolved (accepted/declined/timeout) */
  allResolved: boolean;
}

// ============================================================
// Constants
// ============================================================

const INVITE_TIMEOUT_MS = 60_000;

// ============================================================
// Hook
// ============================================================

export function useGameInvite(gameType: GameType): UseGameInviteReturn {
  const { sendGameStanza, registerGameHandler, unregisterGameHandler } = useGameContext();

  const [inviteStatuses, setInviteStatuses] = useState<OutgoingInviteStatus[]>([]);
  const [incomingInvite, setIncomingInvite] = useState<IncomingInvite | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameIdRef = useRef<string>('');

  // ── Generate game ID for new invite session ───────────────

  const generateGameId = useCallback(() => {
    const id = `game-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    gameIdRef.current = id;
    return id;
  }, []);

  // ── Stanza handler ────────────────────────────────────────

  useEffect(() => {
    const handler = (stanza: GameStanza) => {
      // Only process invite-related stanzas for our game type
      if (stanza.gameType !== gameType) return;

      switch (stanza.type) {
        case 'game_invite': {
          // Incoming invite from another player
          setIncomingInvite({
            gameId: stanza.gameId,
            gameType: stanza.gameType,
            hostJid: stanza.senderId,
            hostName: (stanza.payload.hostName as string) || stanza.senderId,
            receivedAt: Date.now(),
          });
          break;
        }

        case 'game_invite_accept': {
          // Someone accepted our invite
          setInviteStatuses(prev =>
            prev.map(inv =>
              inv.jid === stanza.senderId
                ? { ...inv, status: 'accepted' as InviteStatus }
                : inv,
            ),
          );
          break;
        }

        case 'game_invite_decline': {
          // Someone declined our invite
          setInviteStatuses(prev =>
            prev.map(inv =>
              inv.jid === stanza.senderId
                ? { ...inv, status: 'declined' as InviteStatus }
                : inv,
            ),
          );
          break;
        }
      }
    };

    registerGameHandler(handler);
    return () => unregisterGameHandler(handler);
  }, [gameType, registerGameHandler, unregisterGameHandler]);

  // ── Timeout handler for pending invites ───────────────────

  useEffect(() => {
    const pendingInvites = inviteStatuses.filter(inv => inv.status === 'pending');
    if (pendingInvites.length === 0) return;

    // Find the oldest pending invite
    const oldestSentAt = Math.min(...pendingInvites.map(inv => inv.sentAt));
    const elapsed = Date.now() - oldestSentAt;
    const remaining = Math.max(0, INVITE_TIMEOUT_MS - elapsed);

    timeoutRef.current = setTimeout(() => {
      setInviteStatuses(prev =>
        prev.map(inv =>
          inv.status === 'pending'
            ? { ...inv, status: 'timeout' as InviteStatus }
            : inv,
        ),
      );
    }, remaining);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [inviteStatuses]);

  // ── Send invites ──────────────────────────────────────────

  const sendInvites = useCallback(
    (jids: string[], names: Record<string, string>) => {
      const gameId = generateGameId();
      const now = Date.now();

      // Create invite status entries
      const statuses: OutgoingInviteStatus[] = jids.map(jid => ({
        jid,
        name: names[jid] || jid,
        status: 'pending' as InviteStatus,
        sentAt: now,
      }));
      setInviteStatuses(statuses);

      // Send invite stanza to each player
      const stanza: GameStanza = {
        type: 'game_invite',
        gameType,
        gameId,
        senderId: '', // Filled by GameContext/XMPP service
        timestamp: now,
        payload: {},
      };
      sendGameStanza(jids, stanza);
    },
    [gameType, sendGameStanza, generateGameId],
  );

  // ── Accept incoming invite ────────────────────────────────

  const acceptInvite = useCallback(
    (gameId: string, hostJid: string) => {
      const stanza: GameStanza = {
        type: 'game_invite_accept',
        gameType,
        gameId,
        senderId: '', // Filled by GameContext/XMPP service
        timestamp: Date.now(),
        payload: {},
      };
      sendGameStanza([hostJid], stanza);
      setIncomingInvite(null);
    },
    [gameType, sendGameStanza],
  );

  // ── Decline incoming invite ───────────────────────────────

  const declineInvite = useCallback(
    (gameId: string, hostJid: string) => {
      const stanza: GameStanza = {
        type: 'game_invite_decline',
        gameType,
        gameId,
        senderId: '', // Filled by GameContext/XMPP service
        timestamp: Date.now(),
        payload: {},
      };
      sendGameStanza([hostJid], stanza);
      setIncomingInvite(null);
    },
    [gameType, sendGameStanza],
  );

  // ── Cancel outgoing invites ───────────────────────────────

  const cancelInvites = useCallback(() => {
    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Send cancel to all pending/accepted players
    const activeInvites = inviteStatuses.filter(
      inv => inv.status === 'pending' || inv.status === 'accepted',
    );
    if (activeInvites.length > 0 && gameIdRef.current) {
      const stanza: GameStanza = {
        type: 'game_end',
        gameType,
        gameId: gameIdRef.current,
        senderId: '', // Filled by GameContext/XMPP service
        timestamp: Date.now(),
        payload: { reason: 'cancelled' },
      };
      sendGameStanza(
        activeInvites.map(inv => inv.jid),
        stanza,
      );
    }

    setInviteStatuses([]);
    gameIdRef.current = '';
  }, [gameType, sendGameStanza, inviteStatuses]);

  // ── Dismiss incoming invite ───────────────────────────────

  const dismissIncomingInvite = useCallback(() => {
    setIncomingInvite(null);
  }, []);

  // ── All resolved check ────────────────────────────────────

  const allResolved = inviteStatuses.length > 0 &&
    inviteStatuses.every(inv => inv.status !== 'pending');

  return {
    sendInvites,
    acceptInvite,
    declineInvite,
    cancelInvites,
    inviteStatuses,
    incomingInvite,
    dismissIncomingInvite,
    allResolved,
  };
}
