/**
 * PresenceContext — Universal presence state management
 *
 * Provides real-time presence information for any contact across all modules.
 * Wraps chatService.onPresenceChange() and exposes simple hooks:
 *
 * - usePresence(jid): raw PresenceShow value
 * - useVisualPresence(jid): mapped to 3 visual states (online/away/offline)
 *
 * Visual mapping (senior-friendly — 3 states instead of 6):
 * - available/chat → 'online' (green filled dot)
 * - away/xa/dnd → 'away' (orange filled dot)
 * - offline → 'offline' (grey open ring)
 *
 * @see .claude/plans/UNIVERSAL_PRESENCE.md
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PresenceShow } from '@/services/interfaces';
import { ServiceContainer } from '@/services/container';
import { chatService } from '@/services/chat';
import { useColors } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

// --- Types ---

export type VisualPresenceState = 'online' | 'away' | 'offline';

export interface VisualPresence {
  /** Simplified visual state */
  state: VisualPresenceState;
  /** Color for the dot */
  color: string;
  /** Whether to render as open ring (outline) instead of filled */
  isRing: boolean;
  /** Accessibility label: "online", "even weg", "niet online" */
  label: string;
  /** Full accessibility label with name: "Maria, online" */
  a11yLabel: (name: string) => string;
}

interface PresenceContextValue {
  /** Get raw XMPP presence for a JID */
  getPresence: (jid: string) => PresenceShow;
  /** Subscribe version — triggers re-render on presence change for this JID */
  presenceMap: ReadonlyMap<string, PresenceShow>;
  /** Timestamp of last update — used to trigger re-renders */
  lastUpdate: number;
}

// --- Context ---

const PresenceContext = createContext<PresenceContextValue | null>(null);

// --- Provider ---

interface PresenceProviderProps {
  children: React.ReactNode;
}

export function PresenceProvider({ children }: PresenceProviderProps) {
  // Internal presence map — mirrors chatService.presenceMap
  const [presenceState, setPresenceState] = useState<Map<string, PresenceShow>>(new Map());
  const [lastUpdate, setLastUpdate] = useState(0);

  // Subscribe to chatService presence updates
  useEffect(() => {
    if (!ServiceContainer.isInitialized || !chatService.isInitialized) return;

    const unsubscribe = chatService.onPresenceChange((jid: string, show: PresenceShow) => {
      setPresenceState(prev => {
        const next = new Map(prev);
        next.set(jid, show);
        return next;
      });
      setLastUpdate(Date.now());
    });

    return unsubscribe;
  }, []);

  const getPresence = useCallback((jid: string): PresenceShow => {
    // Try local state first, then fall back to chatService
    return presenceState.get(jid) ?? chatService.getContactPresence(jid);
  }, [presenceState]);

  const value = useMemo<PresenceContextValue>(() => ({
    getPresence,
    presenceMap: presenceState,
    lastUpdate,
  }), [getPresence, presenceState, lastUpdate]);

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

// --- Hooks ---

/**
 * Get raw XMPP presence for a contact.
 * Re-renders when this contact's presence changes.
 */
export function usePresence(jid: string | undefined): PresenceShow {
  const ctx = useContext(PresenceContext);

  if (!jid) return 'offline';

  // If context not available (outside provider), fall back to chatService
  if (!ctx) {
    if (ServiceContainer.isInitialized && chatService.isInitialized) {
      return chatService.getContactPresence(jid);
    }
    return 'offline';
  }

  return ctx.getPresence(jid);
}

/**
 * Safe version — returns 'offline' if outside provider.
 */
export function usePresenceSafe(jid: string | undefined): PresenceShow {
  return usePresence(jid);
}

/**
 * Map raw XMPP PresenceShow to visual state.
 */
export function mapToVisualState(show: PresenceShow): VisualPresenceState {
  switch (show) {
    case 'available':
    case 'chat':
      return 'online';
    case 'away':
    case 'xa':
    case 'dnd':
      return 'away';
    case 'offline':
    default:
      return 'offline';
  }
}

/**
 * Get visual presence for a contact: color, ring style, accessibility label.
 * Senior-friendly: 3 states instead of 6.
 *
 * @example
 * const presence = useVisualPresence(contact.jid);
 * // presence.color → '#68C414'
 * // presence.isRing → false
 * // presence.label → 'Online'
 * // presence.a11yLabel('Maria') → 'Maria, online'
 */
export function useVisualPresence(jid: string | undefined): VisualPresence {
  const show = usePresence(jid);
  const themeColors = useColors();
  const { t } = useTranslation();

  return useMemo(() => {
    const state = mapToVisualState(show);

    switch (state) {
      case 'online':
        return {
          state,
          color: themeColors.presenceAvailable,
          isRing: false,
          label: t('presence.online'),
          a11yLabel: (name: string) => t('presence.a11y.online', { name }),
        };
      case 'away':
        return {
          state,
          color: themeColors.presenceAway,
          isRing: false,
          label: t('presence.away'),
          a11yLabel: (name: string) => t('presence.a11y.away', { name }),
        };
      case 'offline':
      default:
        return {
          state,
          color: themeColors.presenceOffline,
          isRing: true,
          label: t('presence.offline'),
          a11yLabel: (name: string) => t('presence.a11y.offline', { name }),
        };
    }
  }, [show, themeColors, t]);
}
