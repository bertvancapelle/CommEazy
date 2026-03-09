/**
 * ModuleBrowsingContext — Preserves browsing state across module navigation
 *
 * When a user navigates away from an audio module (Radio, Podcast, Books, Apple Music)
 * and returns (via MediaIndicator, WheelMenu, or any navigation), the browsing state
 * is restored: active tab, search query, search results, filters, open collections.
 *
 * This prevents the confusing experience where a senior taps the MediaIndicator
 * to "go back to the music" but finds an empty screen with no context of what was playing.
 *
 * Architecture:
 * - One generic context for all modules (Record<moduleId, BrowsingState>)
 * - State is saved continuously (on every change) — in-memory only
 * - Each module uses the useModuleBrowsingState() hook
 * - State shapes are typed per module via discriminated union
 *
 * @see .claude/skills/architecture-lead/SKILL.md
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';

import type { FilterMode } from '@/components/ChipSelector';

// ============================================================
// Per-module browsing state types
// ============================================================

/** Radio browsing state */
export interface RadioBrowsingState {
  module: 'radio';
  showFavorites: boolean;
  searchQuery: string;
  filterMode: FilterMode;
  selectedCountry: string;
  selectedLanguage: string;
  /** Cached search results (may be stale) */
  stations: unknown[];
}

/** Podcast browsing state */
export interface PodcastBrowsingState {
  module: 'podcast';
  showSubscriptions: boolean;
  searchQuery: string;
  selectedCountry: string;
  /** Currently viewed show (detail view) */
  selectedShow: unknown | null;
  /** Episodes of the selected show */
  showEpisodes: unknown[];
  /** Cached search results */
  searchResults: unknown[];
}

/** Books browsing state */
export interface BooksBrowsingState {
  module: 'books';
  showLibrary: boolean;
  searchQuery: string;
  selectedLanguage: string;
  /** Cached search results */
  searchResults: unknown[];
  /** Which sub-screen was last active (for MediaIndicator return navigation) */
  activeView?: 'list' | 'reader' | 'player';
}

/** Apple Music browsing state */
export interface AppleMusicBrowsingState {
  module: 'appleMusic';
  activeTab: 'favorites' | 'search';
  favoritesSubTab: 'playlists' | 'albums' | 'artists';
  searchQuery: string;
  searchFilter: 'all' | 'songs' | 'albums' | 'artists' | 'playlists';
  /** Currently open collection/playlist/album ID */
  openCollectionId: string | null;
  /** Selected chip in collection bar */
  selectedChipId: string;
  /** Cached search results */
  searchResults: unknown | null;
}

/** Union of all module browsing states */
export type ModuleBrowsingState =
  | RadioBrowsingState
  | PodcastBrowsingState
  | BooksBrowsingState
  | AppleMusicBrowsingState;

/** Module IDs that support browsing state */
export type BrowsableModuleId = 'radio' | 'podcast' | 'books' | 'appleMusic';

// ============================================================
// Context
// ============================================================

interface ModuleBrowsingContextValue {
  /** Get the saved browsing state for a module (or null if never saved) */
  getBrowsingState: <T extends ModuleBrowsingState>(moduleId: BrowsableModuleId) => T | null;
  /** Save (merge) browsing state for a module */
  saveBrowsingState: (moduleId: BrowsableModuleId, state: ModuleBrowsingState) => void;
  /** Clear browsing state for a module (e.g., on logout) */
  clearBrowsingState: (moduleId: BrowsableModuleId) => void;
  /** Clear all browsing states */
  clearAllBrowsingStates: () => void;
}

const ModuleBrowsingContext = createContext<ModuleBrowsingContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface ModuleBrowsingProviderProps {
  children: ReactNode;
}

export function ModuleBrowsingProvider({ children }: ModuleBrowsingProviderProps) {
  // Use ref instead of state to avoid unnecessary re-renders.
  // Modules read the state on mount, not reactively.
  const stateRef = useRef<Partial<Record<BrowsableModuleId, ModuleBrowsingState>>>({});

  const getBrowsingState = useCallback(<T extends ModuleBrowsingState>(
    moduleId: BrowsableModuleId
  ): T | null => {
    return (stateRef.current[moduleId] as T) ?? null;
  }, []);

  const saveBrowsingState = useCallback((
    moduleId: BrowsableModuleId,
    state: ModuleBrowsingState
  ) => {
    stateRef.current[moduleId] = state;
  }, []);

  const clearBrowsingState = useCallback((moduleId: BrowsableModuleId) => {
    delete stateRef.current[moduleId];
  }, []);

  const clearAllBrowsingStates = useCallback(() => {
    stateRef.current = {};
  }, []);

  // Stable context value (functions are all useCallback with [])
  const value: ModuleBrowsingContextValue = {
    getBrowsingState,
    saveBrowsingState,
    clearBrowsingState,
    clearAllBrowsingStates,
  };

  return (
    <ModuleBrowsingContext.Provider value={value}>
      {children}
    </ModuleBrowsingContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/** Use the browsing context (throws if outside provider) */
export function useModuleBrowsingContext(): ModuleBrowsingContextValue {
  const ctx = useContext(ModuleBrowsingContext);
  if (!ctx) {
    throw new Error('useModuleBrowsingContext must be used within ModuleBrowsingProvider');
  }
  return ctx;
}

/** Safe version that returns null if outside provider */
export function useModuleBrowsingContextSafe(): ModuleBrowsingContextValue | null {
  return useContext(ModuleBrowsingContext);
}

// ============================================================
// Convenience hook for individual modules
// ============================================================

/**
 * Hook that provides save/restore for a specific module's browsing state.
 *
 * Usage in a module screen:
 * ```typescript
 * const { savedState, save } = useModuleBrowsingState<RadioBrowsingState>('radio');
 *
 * // Initialize state from saved or default
 * const [showFavorites, setShowFavorites] = useState(savedState?.showFavorites ?? true);
 *
 * // Save on every change
 * useEffect(() => {
 *   save({
 *     module: 'radio',
 *     showFavorites,
 *     searchQuery,
 *     filterMode,
 *     selectedCountry,
 *     selectedLanguage,
 *     stations,
 *   });
 * }, [showFavorites, searchQuery, filterMode, selectedCountry, selectedLanguage, stations]);
 * ```
 */
export function useModuleBrowsingState<T extends ModuleBrowsingState>(
  moduleId: BrowsableModuleId
): {
  savedState: T | null;
  save: (state: T) => void;
  clear: () => void;
} {
  const ctx = useModuleBrowsingContext();

  // Read saved state once on mount (stable reference via ref)
  const savedState = ctx.getBrowsingState<T>(moduleId);

  const save = useCallback((state: T) => {
    ctx.saveBrowsingState(moduleId, state);
  }, [ctx, moduleId]);

  const clear = useCallback(() => {
    ctx.clearBrowsingState(moduleId);
  }, [ctx, moduleId]);

  return { savedState, save, clear };
}
