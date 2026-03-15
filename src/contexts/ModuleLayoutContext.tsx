/**
 * ModuleLayoutContext — Configurable module screen layout order
 *
 * Allows users to reorder the three visual blocks in module screens:
 * 1. "module" — Module icon + title (in ModuleHeader)
 * 2. "controls" — Tabs, ChipSelector, SearchBar
 * 3. "content" — Main scrollable content (list, grid, etc.)
 *
 * AdMob stays fixed at the top (not reorderable).
 *
 * ONE global setting applies to ALL module screens.
 *
 * @see src/screens/settings/AppearanceSettingsScreen.tsx
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Types
// ============================================================

/** The three reorderable layout blocks */
export type LayoutBlock = 'module' | 'controls' | 'content';

/** Default order — matches current layout */
export const DEFAULT_LAYOUT_ORDER: LayoutBlock[] = ['module', 'controls', 'content'];

const STORAGE_KEY = '@commeazy/moduleLayoutOrder';

export interface ModuleLayoutContextValue {
  /** Current block order (always 3 elements) */
  layoutOrder: LayoutBlock[];
  /** Move a block up in the order (swap with previous) */
  moveUp: (block: LayoutBlock) => void;
  /** Move a block down in the order (swap with next) */
  moveDown: (block: LayoutBlock) => void;
  /** Reset to default order */
  resetToDefault: () => void;
  /** Whether the order differs from default */
  isCustomized: boolean;
}

// ============================================================
// Context
// ============================================================

const ModuleLayoutContext = createContext<ModuleLayoutContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface ModuleLayoutProviderProps {
  children: ReactNode;
}

export function ModuleLayoutProvider({ children }: ModuleLayoutProviderProps) {
  const [layoutOrder, setLayoutOrder] = useState<LayoutBlock[]>(DEFAULT_LAYOUT_ORDER);

  // Load persisted order on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((json) => {
      if (!json) return;
      try {
        const parsed = JSON.parse(json);
        // Validate: must be array of exactly 3 known blocks
        if (
          Array.isArray(parsed) &&
          parsed.length === 3 &&
          parsed.includes('module') &&
          parsed.includes('controls') &&
          parsed.includes('content')
        ) {
          setLayoutOrder(parsed as LayoutBlock[]);
        }
      } catch {
        // Invalid JSON — ignore, use default
      }
    });
  }, []);

  const persist = useCallback((order: LayoutBlock[]) => {
    setLayoutOrder(order);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }, []);

  const moveUp = useCallback((block: LayoutBlock) => {
    setLayoutOrder((prev) => {
      const idx = prev.indexOf(block);
      if (idx <= 0) return prev; // Already at top
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      persist(next);
      return next;
    });
  }, [persist]);

  const moveDown = useCallback((block: LayoutBlock) => {
    setLayoutOrder((prev) => {
      const idx = prev.indexOf(block);
      if (idx < 0 || idx >= prev.length - 1) return prev; // Already at bottom
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      persist(next);
      return next;
    });
  }, [persist]);

  const resetToDefault = useCallback(() => {
    persist([...DEFAULT_LAYOUT_ORDER]);
  }, [persist]);

  const isCustomized =
    layoutOrder[0] !== DEFAULT_LAYOUT_ORDER[0] ||
    layoutOrder[1] !== DEFAULT_LAYOUT_ORDER[1] ||
    layoutOrder[2] !== DEFAULT_LAYOUT_ORDER[2];

  return (
    <ModuleLayoutContext.Provider
      value={{
        layoutOrder,
        moveUp,
        moveDown,
        resetToDefault,
        isCustomized,
      }}
    >
      {children}
    </ModuleLayoutContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

export function useModuleLayout(): ModuleLayoutContextValue {
  const ctx = useContext(ModuleLayoutContext);
  if (!ctx) {
    throw new Error('useModuleLayout must be used within ModuleLayoutProvider');
  }
  return ctx;
}

/** Safe hook that returns default order when outside provider */
export function useModuleLayoutSafe(): ModuleLayoutContextValue {
  const ctx = useContext(ModuleLayoutContext);
  if (!ctx) {
    return {
      layoutOrder: DEFAULT_LAYOUT_ORDER,
      moveUp: () => {},
      moveDown: () => {},
      resetToDefault: () => {},
      isCustomized: false,
    };
  }
  return ctx;
}
