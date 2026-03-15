/**
 * ModuleLayoutContext — Configurable toolbar position for module screens
 *
 * Controls where the toolbar (ModuleHeader + controls) appears relative
 * to content:
 * - "top" (default): Header → Controls → Content
 * - "bottom": Content → Controls (reversed) → Header
 *
 * When toolbar is at bottom, the controls rows are rendered in reverse
 * order so that rows closest to the header stay closest to the header.
 *
 * AdMob stays fixed at the very top (not affected by this setting).
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

/** Toolbar position relative to content */
export type ToolbarPosition = 'top' | 'bottom';

const DEFAULT_TOOLBAR_POSITION: ToolbarPosition = 'top';

const STORAGE_KEY = '@commeazy/toolbarPosition';

export interface ModuleLayoutContextValue {
  /** Where the toolbar (header + controls) sits relative to content */
  toolbarPosition: ToolbarPosition;
  /** Toggle between top and bottom */
  toggleToolbarPosition: () => void;
  /** Set a specific position */
  setToolbarPosition: (position: ToolbarPosition) => void;
  /** Reset to default (top) */
  resetToDefault: () => void;
  /** Whether the position differs from default */
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
  const [toolbarPosition, setToolbarPositionState] = useState<ToolbarPosition>(DEFAULT_TOOLBAR_POSITION);

  // Load persisted position on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value === 'top' || value === 'bottom') {
        setToolbarPositionState(value);
      }
    });
  }, []);

  const persistToStorage = useCallback((position: ToolbarPosition) => {
    AsyncStorage.setItem(STORAGE_KEY, position);
  }, []);

  const toggleToolbarPosition = useCallback(() => {
    setToolbarPositionState((prev) => {
      const next = prev === 'top' ? 'bottom' : 'top';
      persistToStorage(next);
      return next;
    });
  }, [persistToStorage]);

  const setToolbarPosition = useCallback((position: ToolbarPosition) => {
    setToolbarPositionState(position);
    persistToStorage(position);
  }, [persistToStorage]);

  const resetToDefault = useCallback(() => {
    setToolbarPositionState(DEFAULT_TOOLBAR_POSITION);
    persistToStorage(DEFAULT_TOOLBAR_POSITION);
  }, [persistToStorage]);

  const isCustomized = toolbarPosition !== DEFAULT_TOOLBAR_POSITION;

  return (
    <ModuleLayoutContext.Provider
      value={{
        toolbarPosition,
        toggleToolbarPosition,
        setToolbarPosition,
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

/** Safe hook that returns default position when outside provider */
export function useModuleLayoutSafe(): ModuleLayoutContextValue {
  const ctx = useContext(ModuleLayoutContext);
  if (!ctx) {
    return {
      toolbarPosition: DEFAULT_TOOLBAR_POSITION,
      toggleToolbarPosition: () => {},
      setToolbarPosition: () => {},
      resetToDefault: () => {},
      isCustomized: false,
    };
  }
  return ctx;
}
