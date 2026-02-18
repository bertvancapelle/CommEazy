/**
 * VoiceFocusContext — Voice Session Mode list navigation
 *
 * Enables voice-controlled navigation through lists in CommEazy.
 * When Voice Session is active, users can:
 * - Navigate with "volgende"/"vorige" (next/previous)
 * - Jump to items by name ("Oma" → focus on contact "Oma")
 * - Jump to alphabetic sections ("Letter M" → first item starting with M)
 * - Select focused item with "open"/"kies"
 *
 * Design decisions (from Q&A):
 * - Q1: Multiple lists → last registered list is active (automatic)
 * - Q2: Fuzzy matching → adaptive (80% → 70% + confirmation)
 * - Q3: No match feedback → audio + visual toast
 * - Q4: Long lists → alphabetic jumping ("Letter M")
 * - Q5: Session timeout → configurable (default 2 min)
 * - Q6: Focus persistence → kept within session
 * - Q7: Haptic feedback → follows existing haptic setting
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAccentColorContext } from './AccentColorContext';

// ============================================================
// Types & Interfaces
// ============================================================

/** A focusable item in a voice-navigable list */
export interface VoiceFocusableItem {
  /** Unique identifier for the item */
  id: string;
  /** Label for voice matching (e.g., "Oma", "Maria") — must be human-readable */
  label: string;
  /** Index in the list (for navigation order) */
  index: number;
  /** Callback when this item is selected */
  onSelect: () => void;
  /** Optional: Y position for scroll-to-focus */
  yPosition?: number;
}

/** A registered list of focusable items */
export interface VoiceFocusList {
  /** Unique list identifier */
  id: string;
  /** Items in the list */
  items: VoiceFocusableItem[];
  /** Currently focused item ID (null if none) */
  focusedItemId: string | null;
  /** Timestamp of last registration (for "last registered wins") */
  registeredAt: number;
}

/** Voice commands per language */
export interface VoiceCommands {
  next: string[];
  previous: string[];
  select: string[];
  letterPrefix: string;
  stopSession: string[];
}

/** Voice Session settings */
export interface VoiceSessionSettings {
  /** Timeout in milliseconds (0 = no timeout) */
  timeoutMs: number;
  /** Fuzzy match threshold (0-1, 0.8 = 80%) */
  fuzzyMatchThreshold: number;
  /** Whether to show disambiguation UI on multiple matches */
  showDisambiguation: boolean;
}

/** Result of fuzzy matching */
export interface FuzzyMatchResult {
  item: VoiceFocusableItem;
  score: number;
}

/** Active name filter state (for "volgende Maria" navigation) */
export interface ActiveNameFilter {
  /** The search query that was used */
  query: string;
  /** All matching items from the search */
  matches: FuzzyMatchResult[];
  /** Current index within matches (0-based) */
  currentIndex: number;
}

/** Voice focus context value */
export interface VoiceFocusContextValue {
  // Session state
  isVoiceSessionActive: boolean;
  startVoiceSession: () => void;
  stopVoiceSession: () => void;
  /** Register callback to be notified when session ends (timeout or manual stop) */
  registerSessionEndCallback: (callback: (() => void) | null) => void;

  // List management
  registerList: (listId: string, items: VoiceFocusableItem[]) => void;
  unregisterList: (listId: string) => void;
  activeListId: string | null;

  // Focus management
  focusedItemId: string | null;
  focusNext: () => void;
  focusPrevious: () => void;
  focusById: (itemId: string) => void;
  focusByName: (name: string) => FuzzyMatchResult[];
  focusByLetter: (letter: string) => void;
  selectFocused: () => void;
  clearFocus: () => void;
  /** Reset focus to first item in active list */
  resetFocusToFirst: () => void;
  /** Clear active name filter (stops "volgende Maria" navigation) */
  clearNameFilter: () => void;
  /** Active name filter for multi-match navigation (e.g., multiple "Maria"s) */
  activeNameFilter: ActiveNameFilter | null;

  // Visual styling helpers
  isFocused: (itemId: string) => boolean;
  getFocusStyle: () => {
    borderColor: string;
    backgroundColor: string;
    borderWidth: number;
  };

  // Settings
  settings: VoiceSessionSettings;
  updateSettings: (settings: Partial<VoiceSessionSettings>) => void;

  // Voice command processing
  processVoiceCommand: (command: string) => boolean;
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes (Q5)
const FUZZY_THRESHOLD_HIGH = 0.8; // 80% (Q2)
const FUZZY_THRESHOLD_LOW = 0.7; // 70% fallback (Q2)

/** Voice commands per language (Q5 additional stop commands) */
const VOICE_COMMANDS: Record<string, VoiceCommands> = {
  nl: {
    next: ['volgende', 'verder'],
    previous: ['vorige', 'terug'],
    select: ['open', 'kies', 'selecteer'],
    letterPrefix: 'letter',
    stopSession: ['stop opnemen', 'stop', 'einde', 'klaar'],
  },
  en: {
    next: ['next', 'forward'],
    previous: ['previous', 'back'],
    select: ['open', 'select', 'choose'],
    letterPrefix: 'letter',
    stopSession: ['stop recording', 'stop', 'end', 'done'],
  },
  de: {
    next: ['nächste', 'weiter'],
    previous: ['vorherige', 'zurück'],
    select: ['öffnen', 'wählen', 'auswählen'],
    letterPrefix: 'buchstabe',
    stopSession: ['aufnahme stoppen', 'stopp', 'ende', 'fertig'],
  },
  fr: {
    next: ['suivant', 'prochain'],
    previous: ['précédent', 'retour'],
    select: ['ouvrir', 'choisir', 'sélectionner'],
    letterPrefix: 'lettre',
    stopSession: ['arrêter', 'stop', 'fin', 'terminé'],
  },
  es: {
    next: ['siguiente', 'adelante'],
    previous: ['anterior', 'atrás'],
    select: ['abrir', 'elegir', 'seleccionar'],
    letterPrefix: 'letra',
    stopSession: ['parar', 'detener', 'fin', 'listo'],
  },
};

// ============================================================
// Fuzzy Matching Utility
// ============================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) between two strings
 * Supports:
 * - Exact match (1.0)
 * - Prefix match: "mar" → "maria" (0.9)
 * - Word match: "maria" → "Tante Maria" (0.88)
 * - Word prefix match: "mar" → "Tante Maria" (0.85)
 * - Levenshtein fallback for typos
 */
function similarityScore(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  if (aLower === bLower) return 1;
  if (aLower.length === 0 || bLower.length === 0) return 0;

  // Check if one starts with the other (partial match)
  if (aLower.startsWith(bLower) || bLower.startsWith(aLower)) {
    return 0.9;
  }

  // Check if query matches any word in the label (e.g., "maria" → "Tante Maria")
  // Split label into words and check each word
  const bWords = bLower.split(/\s+/);
  for (const word of bWords) {
    // Exact word match (high score)
    if (word === aLower) {
      return 0.88;
    }
    // Word starts with query (e.g., "mar" matches word "maria")
    if (word.startsWith(aLower) && aLower.length >= 2) {
      return 0.85;
    }
    // Query starts with word (e.g., "maria123" matches word "maria")
    if (aLower.startsWith(word) && word.length >= 2) {
      return 0.85;
    }
  }

  // Also check if query is a word in the label using Levenshtein on individual words
  // This handles typos in word matching (e.g., "meria" → "maria" in "Tante Maria")
  for (const word of bWords) {
    if (word.length >= 3) {
      const wordDistance = levenshteinDistance(aLower, word);
      const wordScore = 1 - wordDistance / Math.max(aLower.length, word.length);
      // If close match to a word, return high score
      if (wordScore >= 0.75) {
        return Math.min(0.85, wordScore); // Cap at 0.85 for word matches
      }
    }
  }

  const distance = levenshteinDistance(aLower, bLower);
  const maxLength = Math.max(aLower.length, bLower.length);
  return 1 - distance / maxLength;
}

/**
 * Find matching items using adaptive fuzzy matching (Q2)
 */
function fuzzyMatch(
  query: string,
  items: VoiceFocusableItem[],
  thresholdHigh: number = FUZZY_THRESHOLD_HIGH,
  thresholdLow: number = FUZZY_THRESHOLD_LOW
): FuzzyMatchResult[] {
  const queryLower = query.toLowerCase().trim();

  // First pass: try high threshold (80%)
  let matches = items
    .map((item) => ({
      item,
      score: similarityScore(queryLower, item.label),
    }))
    .filter((result) => result.score >= thresholdHigh)
    .sort((a, b) => b.score - a.score);

  // Second pass: if no matches, try lower threshold (70%)
  if (matches.length === 0) {
    matches = items
      .map((item) => ({
        item,
        score: similarityScore(queryLower, item.label),
      }))
      .filter((result) => result.score >= thresholdLow)
      .sort((a, b) => b.score - a.score);
  }

  return matches;
}

// ============================================================
// Context
// ============================================================

const VoiceFocusContext = createContext<VoiceFocusContextValue | null>(null);

interface VoiceFocusProviderProps {
  children: ReactNode;
}

/**
 * Provider component for voice focus context
 */
export function VoiceFocusProvider({ children }: VoiceFocusProviderProps) {
  const { i18n, t } = useTranslation();
  const { accentColor } = useAccentColorContext();

  // Session state
  const [isVoiceSessionActive, setIsVoiceSessionActive] = useState(false);
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Callback to notify parent (HoldToNavigateWrapper) when session ends
  const sessionEndCallbackRef = useRef<(() => void) | null>(null);

  // Lists state (using Map for O(1) lookup)
  const [lists, setLists] = useState<Map<string, VoiceFocusList>>(new Map());
  const [activeListId, setActiveListId] = useState<string | null>(null);

  // CRITICAL: Refs to avoid stale closures in callbacks
  // The callback functions need access to the latest lists/activeListId even when
  // called from stale closures in other components (like HoldToNavigateWrapper)
  const listsRef = useRef(lists);
  const activeListIdRef = useRef(activeListId);

  // Keep refs in sync with state
  useEffect(() => {
    listsRef.current = lists;
    activeListIdRef.current = activeListId;
  }, [lists, activeListId]);

  // Focus state per list (persisted within session - Q6)
  const [focusState, setFocusState] = useState<Map<string, string | null>>(
    new Map()
  );

  // Active name filter for multi-match navigation (e.g., "maria" matches multiple contacts)
  // When user says "maria" and there are multiple matches, this stores them
  // so "volgende" navigates to next Maria, not just next item in list
  const [activeNameFilter, setActiveNameFilter] = useState<ActiveNameFilter | null>(null);

  // Settings
  const [settings, setSettings] = useState<VoiceSessionSettings>({
    timeoutMs: DEFAULT_TIMEOUT_MS,
    fuzzyMatchThreshold: FUZZY_THRESHOLD_HIGH,
    showDisambiguation: true,
  });

  // Get voice commands for current language
  const voiceCommands = useMemo(() => {
    const lang = i18n.language.substring(0, 2);
    return VOICE_COMMANDS[lang] || VOICE_COMMANDS.en;
  }, [i18n.language]);

  // Get active list
  const activeList = useMemo(() => {
    if (!activeListId) return null;
    return lists.get(activeListId) || null;
  }, [activeListId, lists]);

  // Get focused item ID for active list
  const focusedItemId = useMemo(() => {
    if (!activeListId) return null;
    return focusState.get(activeListId) || null;
  }, [activeListId, focusState]);

  // ============================================================
  // Session Management
  // ============================================================

  const resetSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }

    if (settings.timeoutMs > 0) {
      sessionTimeoutRef.current = setTimeout(() => {
        console.debug('[VoiceFocusContext] Session timeout - stopping voice session');
        setIsVoiceSessionActive(false);
        // Clear focus state
        setFocusState(new Map());
        setActiveNameFilter(null);
        // Notify parent (HoldToNavigateWrapper) to stop microphone
        if (sessionEndCallbackRef.current) {
          console.debug('[VoiceFocusContext] Calling session end callback');
          sessionEndCallbackRef.current();
        }
        AccessibilityInfo.announceForAccessibility(
          t('voiceCommands.sessionStopped')
        );
      }, settings.timeoutMs);
    }
  }, [settings.timeoutMs, t]);

  const startVoiceSession = useCallback(() => {
    console.debug('[VoiceFocusContext] Starting voice session - setting isVoiceSessionActive to true');
    console.debug('[VoiceFocusContext] Current lists:', Array.from(lists.keys()).join(', '));
    setIsVoiceSessionActive(true);
    resetSessionTimeout();
    AccessibilityInfo.announceForAccessibility(
      t('voiceCommands.sessionActive')
    );
  }, [resetSessionTimeout, t, lists]);

  const stopVoiceSession = useCallback(() => {
    console.debug('[VoiceFocusContext] stopVoiceSession called');
    setIsVoiceSessionActive(false);
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
    // Clear all focus state when session ends (Q6)
    setFocusState(new Map());
    // Clear name filter
    setActiveNameFilter(null);
    // Note: We don't call sessionEndCallbackRef here because stopVoiceSession
    // is called BY HoldToNavigateWrapper, so it already knows the session ended
    AccessibilityInfo.announceForAccessibility(
      t('voiceCommands.sessionStopped')
    );
  }, [t]);

  const registerSessionEndCallback = useCallback((callback: (() => void) | null) => {
    console.debug('[VoiceFocusContext] Registering session end callback:', !!callback);
    sessionEndCallbackRef.current = callback;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, []);

  // ============================================================
  // List Management
  // ============================================================

  const registerList = useCallback(
    (listId: string, items: VoiceFocusableItem[]) => {
      console.debug(`[VoiceFocusContext] registerList called: ${listId} with ${items.length} items`);

      setLists((prev) => {
        const newLists = new Map(prev);
        newLists.set(listId, {
          id: listId,
          items,
          focusedItemId: focusState.get(listId) || null,
          registeredAt: Date.now(),
        });
        return newLists;
      });

      // Q1: Last registered list becomes active (automatic)
      setActiveListId(listId);

      // Auto-focus first item if no item is focused yet (for initial visual feedback)
      // NOTE: This only sets FOCUS (visual highlight), it does NOT call onSelect!
      // The onSelect callback is only called when user says "open"/"kies" via selectFocused()
      const currentFocus = focusState.get(listId);
      console.debug(`[VoiceFocusContext] Current focus for ${listId}: ${currentFocus}`);

      if (!currentFocus && items.length > 0) {
        console.debug(`[VoiceFocusContext] Auto-focusing first item: ${items[0].id} (${items[0].label}) - visual only, NOT selecting`);
        setFocusState((prev) => {
          const newState = new Map(prev);
          newState.set(listId, items[0].id);
          return newState;
        });
        // Announce the focused item
        AccessibilityInfo.announceForAccessibility(
          t('voiceCommands.focusedOn', { name: items[0].label })
        );
      }
    },
    [focusState, t]
  );

  const unregisterList = useCallback((listId: string) => {
    setLists((prev) => {
      const newLists = new Map(prev);
      newLists.delete(listId);
      return newLists;
    });

    // If active list was unregistered, switch to most recently registered
    setActiveListId((prev) => {
      if (prev !== listId) return prev;

      // Find most recently registered list
      let mostRecent: VoiceFocusList | null = null;
      lists.forEach((list) => {
        if (
          list.id !== listId &&
          (!mostRecent || list.registeredAt > mostRecent.registeredAt)
        ) {
          mostRecent = list;
        }
      });

      return mostRecent?.id || null;
    });
  }, [lists]);

  // ============================================================
  // Focus Management
  // ============================================================

  const setFocusedItem = useCallback(
    (listId: string, itemId: string | null) => {
      setFocusState((prev) => {
        const newState = new Map(prev);
        newState.set(listId, itemId);
        return newState;
      });

      // Reset session timeout on focus change
      if (isVoiceSessionActive) {
        resetSessionTimeout();
      }
    },
    [isVoiceSessionActive, resetSessionTimeout]
  );

  const focusNext = useCallback(() => {
    console.debug('[VoiceFocusContext] focusNext called');
    console.debug('[VoiceFocusContext] activeList:', activeList?.id, 'items:', activeList?.items.length);
    console.debug('[VoiceFocusContext] isVoiceSessionActive:', isVoiceSessionActive);
    console.debug('[VoiceFocusContext] focusedItemId:', focusedItemId);
    console.debug('[VoiceFocusContext] activeNameFilter:', activeNameFilter?.query, 'matches:', activeNameFilter?.matches.length);

    if (!activeList || activeList.items.length === 0) {
      console.debug('[VoiceFocusContext] focusNext: No active list or empty list');
      return;
    }

    // If there's an active name filter with multiple matches, navigate within those matches
    // e.g., "maria" matched "Oma Maria" and "Tante Maria" → "volgende" goes to next Maria
    if (activeNameFilter && activeNameFilter.matches.length > 1) {
      const nextIndex = (activeNameFilter.currentIndex + 1) % activeNameFilter.matches.length;
      const nextMatch = activeNameFilter.matches[nextIndex];

      console.debug('[VoiceFocusContext] focusNext within name filter:', activeNameFilter.query,
        'index:', activeNameFilter.currentIndex, '->', nextIndex,
        'item:', nextMatch.item.label);

      // Update the filter's current index
      setActiveNameFilter({
        ...activeNameFilter,
        currentIndex: nextIndex,
      });

      // Focus on the next match
      setFocusedItem(activeList.id, nextMatch.item.id);

      // Announce with context about which match we're on
      AccessibilityInfo.announceForAccessibility(
        t('voiceCommands.focusedOnMatch', {
          name: nextMatch.item.label,
          current: nextIndex + 1,
          total: activeNameFilter.matches.length,
        })
      );

      // Announce if wrapped around to first match
      if (nextIndex === 0) {
        AccessibilityInfo.announceForAccessibility(t('voiceCommands.endOfMatches'));
      }
      return;
    }

    // No active name filter - normal list navigation
    const currentIndex = focusedItemId
      ? activeList.items.findIndex((item) => item.id === focusedItemId)
      : -1;

    const nextIndex =
      currentIndex >= activeList.items.length - 1 ? 0 : currentIndex + 1;
    const nextItem = activeList.items[nextIndex];

    console.debug('[VoiceFocusContext] focusNext: currentIndex:', currentIndex, '-> nextIndex:', nextIndex, 'item:', nextItem.label);

    setFocusedItem(activeList.id, nextItem.id);

    // Announce for accessibility
    AccessibilityInfo.announceForAccessibility(
      t('voiceCommands.focusedOn', { name: nextItem.label })
    );

    // Announce if at end of list
    if (nextIndex === 0 && currentIndex >= 0) {
      AccessibilityInfo.announceForAccessibility(t('voiceCommands.endOfList'));
    }
  }, [activeList, focusedItemId, setFocusedItem, t, isVoiceSessionActive, activeNameFilter]);

  const focusPrevious = useCallback(() => {
    if (!activeList || activeList.items.length === 0) return;

    // If there's an active name filter with multiple matches, navigate within those matches
    if (activeNameFilter && activeNameFilter.matches.length > 1) {
      const prevIndex = activeNameFilter.currentIndex <= 0
        ? activeNameFilter.matches.length - 1
        : activeNameFilter.currentIndex - 1;
      const prevMatch = activeNameFilter.matches[prevIndex];

      console.debug('[VoiceFocusContext] focusPrevious within name filter:', activeNameFilter.query,
        'index:', activeNameFilter.currentIndex, '->', prevIndex,
        'item:', prevMatch.item.label);

      // Update the filter's current index
      setActiveNameFilter({
        ...activeNameFilter,
        currentIndex: prevIndex,
      });

      // Focus on the previous match
      setFocusedItem(activeList.id, prevMatch.item.id);

      // Announce with context about which match we're on
      AccessibilityInfo.announceForAccessibility(
        t('voiceCommands.focusedOnMatch', {
          name: prevMatch.item.label,
          current: prevIndex + 1,
          total: activeNameFilter.matches.length,
        })
      );

      // Announce if wrapped around to last match
      if (prevIndex === activeNameFilter.matches.length - 1) {
        AccessibilityInfo.announceForAccessibility(t('voiceCommands.endOfMatches'));
      }
      return;
    }

    // No active name filter - normal list navigation
    const currentIndex = focusedItemId
      ? activeList.items.findIndex((item) => item.id === focusedItemId)
      : activeList.items.length;

    const prevIndex =
      currentIndex <= 0 ? activeList.items.length - 1 : currentIndex - 1;
    const prevItem = activeList.items[prevIndex];

    setFocusedItem(activeList.id, prevItem.id);

    // Announce for accessibility
    AccessibilityInfo.announceForAccessibility(
      t('voiceCommands.focusedOn', { name: prevItem.label })
    );

    // Announce if at start of list
    if (prevIndex === activeList.items.length - 1 && currentIndex > 0) {
      AccessibilityInfo.announceForAccessibility(t('voiceCommands.endOfList'));
    }
  }, [activeList, focusedItemId, setFocusedItem, t, activeNameFilter]);

  const focusById = useCallback(
    (itemId: string) => {
      if (!activeList) return;
      const item = activeList.items.find((i) => i.id === itemId);
      if (item) {
        setFocusedItem(activeList.id, itemId);
        AccessibilityInfo.announceForAccessibility(
          t('voiceCommands.focusedOn', { name: item.label })
        );
      }
    },
    [activeList, setFocusedItem, t]
  );

  const focusByName = useCallback(
    (name: string): FuzzyMatchResult[] => {
      // CRITICAL: Use refs to get the LATEST lists/activeListId to avoid stale closures
      // When this function is called from HoldToNavigateWrapper via a ref, the closure
      // may be stale, but the refs always point to the current data
      const currentLists = listsRef.current;
      const currentActiveListId = activeListIdRef.current;
      const currentActiveList = currentActiveListId ? currentLists.get(currentActiveListId) : null;

      console.debug('[VoiceFocusContext] focusByName called with:', name);
      console.debug('[VoiceFocusContext] - activeListId (ref):', currentActiveListId);
      console.debug('[VoiceFocusContext] - activeList exists (ref):', !!currentActiveList);
      console.debug('[VoiceFocusContext] - registered lists (ref):', Array.from(currentLists.keys()).join(', '));

      if (!currentActiveList) {
        console.debug('[VoiceFocusContext] focusByName - NO activeList!');
        return [];
      }
      console.debug('[VoiceFocusContext] focusByName - activeList has', currentActiveList.items.length, 'items:', currentActiveList.items.map(i => i.label).join(', '));

      const matches = fuzzyMatch(
        name,
        currentActiveList.items,
        settings.fuzzyMatchThreshold,
        FUZZY_THRESHOLD_LOW
      );

      if (matches.length === 0) {
        // Q3: Audio + visual feedback (toast handled by caller)
        // Clear any existing name filter since search failed
        setActiveNameFilter(null);
        AccessibilityInfo.announceForAccessibility(
          t('voiceCommands.notUnderstood')
        );
        return [];
      }

      // Focus on the first/best match
      setFocusedItem(currentActiveList.id, matches[0].item.id);

      if (matches.length === 1 || matches[0].score > 0.95) {
        // Single match or very confident match → no need for multi-match navigation
        setActiveNameFilter(null);
        AccessibilityInfo.announceForAccessibility(
          t('voiceCommands.focusedOn', { name: matches[0].item.label })
        );
      } else {
        // Multiple matches → store for "volgende"/"vorige" navigation
        // e.g., "maria" matches "Oma Maria" and "Tante Maria"
        console.debug('[VoiceFocusContext] Multiple matches for:', name,
          'count:', matches.length,
          'names:', matches.map(m => m.item.label).join(', '));

        setActiveNameFilter({
          query: name,
          matches,
          currentIndex: 0, // Start at first match
        });

        // Announce with context about multiple matches
        AccessibilityInfo.announceForAccessibility(
          t('voiceCommands.multipleMatches', {
            name: matches[0].item.label,
            count: matches.length,
          })
        );
      }

      return matches;
    },
    [settings.fuzzyMatchThreshold, setFocusedItem, t]
  );

  const focusByLetter = useCallback(
    (letter: string) => {
      if (!activeList) return;

      const letterLower = letter.toLowerCase().trim();
      const item = activeList.items.find((i) =>
        i.label.toLowerCase().startsWith(letterLower)
      );

      if (item) {
        setFocusedItem(activeList.id, item.id);
        AccessibilityInfo.announceForAccessibility(
          t('voiceCommands.focusedOn', { name: item.label })
        );
      } else {
        AccessibilityInfo.announceForAccessibility(
          t('voiceCommands.notUnderstood')
        );
      }
    },
    [activeList, setFocusedItem, t]
  );

  const selectFocused = useCallback(() => {
    if (!activeList || !focusedItemId) return;

    const item = activeList.items.find((i) => i.id === focusedItemId);
    if (item) {
      item.onSelect();
    }
  }, [activeList, focusedItemId]);

  const clearFocus = useCallback(() => {
    if (activeListId) {
      setFocusedItem(activeListId, null);
    }
  }, [activeListId, setFocusedItem]);

  const resetFocusToFirst = useCallback(() => {
    if (!activeList || activeList.items.length === 0) {
      console.debug('[VoiceFocusContext] resetFocusToFirst: No active list or empty list');
      return;
    }

    const firstItem = activeList.items[0];
    console.debug('[VoiceFocusContext] resetFocusToFirst: Resetting to first item:', firstItem.label);
    setFocusedItem(activeList.id, firstItem.id);

    // Announce the focused item
    AccessibilityInfo.announceForAccessibility(
      t('voiceCommands.focusedOn', { name: firstItem.label })
    );
  }, [activeList, setFocusedItem, t]);

  const clearNameFilter = useCallback(() => {
    console.debug('[VoiceFocusContext] Clearing name filter');
    setActiveNameFilter(null);
  }, []);

  // ============================================================
  // Visual Styling
  // ============================================================

  const isFocused = useCallback(
    (itemId: string): boolean => {
      return isVoiceSessionActive && focusedItemId === itemId;
    },
    [isVoiceSessionActive, focusedItemId]
  );

  const getFocusStyle = useCallback(() => {
    return {
      borderColor: accentColor.primary,
      backgroundColor: `${accentColor.primary}1A`, // 10% opacity (1A = 26/255)
      borderWidth: 4,
    };
  }, [accentColor]);

  // ============================================================
  // Voice Command Processing
  // ============================================================

  const processVoiceCommand = useCallback(
    (command: string): boolean => {
      const cmdLower = command.toLowerCase().trim();

      // Check for stop session commands (Q5)
      if (voiceCommands.stopSession.some((stop) => cmdLower.includes(stop))) {
        stopVoiceSession();
        return true;
      }

      // Check for next command
      if (voiceCommands.next.some((next) => cmdLower === next)) {
        focusNext();
        return true;
      }

      // Check for previous command
      if (voiceCommands.previous.some((prev) => cmdLower === prev)) {
        focusPrevious();
        return true;
      }

      // Check for select command
      if (voiceCommands.select.some((sel) => cmdLower === sel)) {
        selectFocused();
        return true;
      }

      // Check for letter command (Q4: alphabetic jumping)
      const letterPrefix = voiceCommands.letterPrefix.toLowerCase();
      if (cmdLower.startsWith(letterPrefix + ' ')) {
        const letter = cmdLower.substring(letterPrefix.length + 1).trim();
        if (letter.length >= 1) {
          focusByLetter(letter.charAt(0));
          return true;
        }
      }

      // Try direct name match
      const matches = focusByName(cmdLower);
      return matches.length > 0;
    },
    [
      voiceCommands,
      stopVoiceSession,
      focusNext,
      focusPrevious,
      selectFocused,
      focusByLetter,
      focusByName,
    ]
  );

  // ============================================================
  // Settings
  // ============================================================

  const updateSettings = useCallback(
    (newSettings: Partial<VoiceSessionSettings>) => {
      setSettings((prev) => ({ ...prev, ...newSettings }));
    },
    []
  );

  // ============================================================
  // Context Value
  // ============================================================

  const value = useMemo(
    (): VoiceFocusContextValue => ({
      isVoiceSessionActive,
      startVoiceSession,
      stopVoiceSession,
      registerSessionEndCallback,

      registerList,
      unregisterList,
      activeListId,

      focusedItemId,
      focusNext,
      focusPrevious,
      focusById,
      focusByName,
      focusByLetter,
      selectFocused,
      clearFocus,
      resetFocusToFirst,
      clearNameFilter,
      activeNameFilter,

      isFocused,
      getFocusStyle,

      settings,
      updateSettings,

      processVoiceCommand,
    }),
    [
      isVoiceSessionActive,
      startVoiceSession,
      stopVoiceSession,
      registerSessionEndCallback,
      registerList,
      unregisterList,
      activeListId,
      focusedItemId,
      focusNext,
      focusPrevious,
      focusById,
      focusByName,
      focusByLetter,
      selectFocused,
      clearFocus,
      resetFocusToFirst,
      clearNameFilter,
      activeNameFilter,
      isFocused,
      getFocusStyle,
      settings,
      updateSettings,
      processVoiceCommand,
    ]
  );

  return (
    <VoiceFocusContext.Provider value={value}>
      {children}
    </VoiceFocusContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Hook to access the voice focus context
 * Must be used within a VoiceFocusProvider
 */
export function useVoiceFocusContext(): VoiceFocusContextValue {
  const context = useContext(VoiceFocusContext);
  if (!context) {
    throw new Error(
      'useVoiceFocusContext must be used within a VoiceFocusProvider'
    );
  }
  return context;
}

/**
 * Hook to check if voice session is active (lightweight)
 */
export function useVoiceSessionStatus(): {
  isVoiceSessionActive: boolean;
  startVoiceSession: () => void;
  stopVoiceSession: () => void;
} {
  const { isVoiceSessionActive, startVoiceSession, stopVoiceSession } =
    useVoiceFocusContext();
  return { isVoiceSessionActive, startVoiceSession, stopVoiceSession };
}

/**
 * Hook to register a list for voice focus navigation
 *
 * @param listId Unique identifier for the list
 * @param items Items in the list (will be re-registered when changed)
 * @returns Object with scrollRef for automatic scroll-to-focus
 */
export function useVoiceFocusList(
  listId: string,
  items: VoiceFocusableItem[]
): {
  scrollRef: RefObject<ScrollView>;
  focusedItemId: string | null;
  isFocused: (itemId: string) => boolean;
  getFocusStyle: () => {
    borderColor: string;
    backgroundColor: string;
    borderWidth: number;
  };
} {
  const {
    registerList,
    unregisterList,
    isVoiceSessionActive,
    focusedItemId,
    isFocused,
    getFocusStyle,
  } = useVoiceFocusContext();

  const scrollRef = useRef<ScrollView>(null);
  const itemPositions = useRef<Map<string, number>>(new Map());

  // Track if we registered this list (to know if we need to unregister on cleanup)
  const isRegisteredRef = useRef(false);
  // Stable reference to unregisterList to avoid dependency issues
  const unregisterListRef = useRef(unregisterList);
  unregisterListRef.current = unregisterList;

  // Handle voice session state changes AND item changes
  // IMPORTANT: We need to re-register when items change while session is active
  // because contacts may load asynchronously after the screen mounts
  useEffect(() => {
    console.debug(`[VoiceFocusList] useEffect triggered - isVoiceSessionActive: ${isVoiceSessionActive}, items: ${items.length}, isRegistered: ${isRegisteredRef.current}`);

    if (isVoiceSessionActive && items.length > 0) {
      // Voice session is active and we have items - register (or re-register)
      console.debug(`[VoiceFocusList] Session active, registering list: ${listId} with ${items.length} items`);
      console.debug(`[VoiceFocusList] Item labels:`, items.map(i => i.label).join(', '));
      registerList(listId, items);
      isRegisteredRef.current = true;
    } else if (!isVoiceSessionActive && isRegisteredRef.current) {
      // Voice session ended, unregister
      console.debug(`[VoiceFocusList] Session ended, unregistering list: ${listId}`);
      unregisterListRef.current(listId);
      isRegisteredRef.current = false;
    } else if (isVoiceSessionActive && items.length === 0 && isRegisteredRef.current) {
      // Items became empty while session is active - unregister
      console.debug(`[VoiceFocusList] Items cleared while session active, unregistering: ${listId}`);
      unregisterListRef.current(listId);
      isRegisteredRef.current = false;
    }
    // NOTE: No cleanup here - we only cleanup on unmount (separate effect)
  }, [listId, items, isVoiceSessionActive, registerList]);

  // Cleanup on unmount only
  useEffect(() => {
    const currentListId = listId;
    return () => {
      if (isRegisteredRef.current) {
        console.debug(`[VoiceFocusList] Unmounting, unregistering list: ${currentListId}`);
        unregisterListRef.current(currentListId);
        isRegisteredRef.current = false;
      }
    };
  }, [listId]);

  // Scroll to focused item
  useEffect(() => {
    if (
      focusedItemId &&
      scrollRef.current &&
      itemPositions.current.has(focusedItemId)
    ) {
      const yPosition = itemPositions.current.get(focusedItemId) || 0;
      scrollRef.current.scrollTo({ y: yPosition, animated: true });
    }
  }, [focusedItemId]);

  return {
    scrollRef,
    focusedItemId,
    isFocused,
    getFocusStyle,
  };
}

// ============================================================
// Export Types
// ============================================================

export type {
  VoiceFocusableItem,
  VoiceFocusList,
  VoiceCommands,
  VoiceSessionSettings,
  FuzzyMatchResult,
  ActiveNameFilter,
};
