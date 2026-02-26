/**
 * PaneContext — Unified pane state management
 *
 * Provides a single abstraction for both iPhone (1 pane) and iPad (2 panes).
 * Replaces SplitViewContext with a device-agnostic pane model:
 * - iPhone: 1 pane ('main')
 * - iPad: 2 panes ('left' + 'right')
 *
 * All screen components use the same pane APIs regardless of device.
 *
 * @see .claude/plans/sunny-yawning-sunset.md
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NavigationDestination } from '@/types/navigation';

// ============================================================
// Constants
// ============================================================

/** AsyncStorage keys */
const STORAGE_KEY_PANEL_RATIO = 'ipad_panel_ratio';
const STORAGE_KEY_LEFT_MODULE = 'ipad_left_module';
const STORAGE_KEY_RIGHT_MODULE = 'ipad_right_module';
const STORAGE_KEY_MAIN_MODULE = 'iphone_main_module';

/** Defaults */
const DEFAULT_PANEL_RATIO = 0.33;
const DEFAULT_LEFT_MODULE: NavigationDestination = 'menu';
const DEFAULT_RIGHT_MODULE: NavigationDestination = 'contacts';
const DEFAULT_MAIN_MODULE: NavigationDestination = 'chats';

// ============================================================
// Types
// ============================================================

/**
 * Pane identifier
 * - 'main': iPhone single pane
 * - 'left'/'right': iPad Split View panes
 */
export type PaneId = 'main' | 'left' | 'right';

/**
 * Pending deep navigation to execute after a pane module switch.
 * E.g., switching to 'chats' AND navigating to a specific ChatDetail.
 */
export interface PendingNavigation {
  /** Screen name within the module's stack navigator */
  screen: string;
  /** Route params for that screen */
  params: Record<string, unknown>;
}

/**
 * State for a single pane
 */
export interface PaneState {
  /** Module currently displayed in this pane */
  moduleId: NavigationDestination;
  /** Optional pending navigation to execute after mount */
  pendingNavigation?: PendingNavigation | null;
}

/**
 * Pane context value
 */
export interface PaneContextValue {
  // Pane states
  /** All pane states indexed by PaneId */
  panes: Partial<Record<PaneId, PaneState>>;
  /** Number of active panes (1 = iPhone, 2 = iPad) */
  paneCount: 1 | 2;

  // Pane actions
  /** Set module for a specific pane, with optional deep navigation */
  setPaneModule: (paneId: PaneId, moduleId: NavigationDestination, pendingNavigation?: PendingNavigation) => void;
  /** Consume and clear pending navigation for a pane (call after navigating) */
  consumePendingNavigation: (paneId: PaneId) => PendingNavigation | null;

  // iPad-only: Panel ratio
  /** Panel ratio (0.25 to 0.75) — left panel width as fraction */
  panelRatio: number;
  /** Set panel ratio */
  setPanelRatio: (ratio: number) => void;

  // Module picker
  /** Which pane's picker is currently open, or null */
  activePickerPane: PaneId | null;
  /** Open module picker for a pane */
  openModulePicker: (paneId: PaneId) => void;
  /** Close module picker */
  closeModulePicker: () => void;

  // Voice scope
  /** Which pane has active voice commands, or null */
  activeVoicePane: PaneId | null;
  /** Set active voice pane */
  setActiveVoicePane: (paneId: PaneId | null) => void;

  // Loading state
  /** Whether context is still loading from storage */
  isLoading: boolean;
}

// ============================================================
// Context
// ============================================================

const PaneContext = createContext<PaneContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

export interface PaneProviderProps {
  /** Number of panes (1 = iPhone, 2 = iPad) */
  paneCount: 1 | 2;
  children: ReactNode;
}

export function PaneProvider({ paneCount, children }: PaneProviderProps) {
  // ============================================================
  // State
  // ============================================================

  const [isLoading, setIsLoading] = useState(true);

  // Pane states
  const [mainPane, setMainPane] = useState<PaneState>({
    moduleId: DEFAULT_MAIN_MODULE,
  });
  const [leftPane, setLeftPane] = useState<PaneState>({
    moduleId: DEFAULT_LEFT_MODULE,
  });
  const [rightPane, setRightPane] = useState<PaneState>({
    moduleId: DEFAULT_RIGHT_MODULE,
  });

  // Panel ratio (iPad only)
  const [panelRatio, setPanelRatioState] = useState(DEFAULT_PANEL_RATIO);

  // Module picker
  const [activePickerPane, setActivePickerPane] = useState<PaneId | null>(null);

  // Voice scope
  const [activeVoicePane, setActiveVoicePane] = useState<PaneId | null>(null);

  // ============================================================
  // Load from Storage
  // ============================================================

  useEffect(() => {
    const loadFromStorage = async () => {
      try {
        if (paneCount === 1) {
          // iPhone: load main module
          const savedMain = await AsyncStorage.getItem(STORAGE_KEY_MAIN_MODULE);
          if (savedMain) {
            setMainPane({ moduleId: savedMain as NavigationDestination });
          }
        } else {
          // iPad: load left, right, and ratio
          const [savedRatio, savedLeft, savedRight] = await Promise.all([
            AsyncStorage.getItem(STORAGE_KEY_PANEL_RATIO),
            AsyncStorage.getItem(STORAGE_KEY_LEFT_MODULE),
            AsyncStorage.getItem(STORAGE_KEY_RIGHT_MODULE),
          ]);

          if (savedRatio) {
            const ratio = parseFloat(savedRatio);
            if (ratio >= 0.25 && ratio <= 0.75) {
              setPanelRatioState(ratio);
            }
          }

          if (savedLeft) {
            setLeftPane({ moduleId: savedLeft as NavigationDestination });
          }

          if (savedRight) {
            setRightPane({ moduleId: savedRight as NavigationDestination });
          }
        }
      } catch (error) {
        console.warn('[PaneContext] Failed to load from storage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFromStorage();
  }, [paneCount]);

  // ============================================================
  // Pane Actions
  // ============================================================

  const setPaneModule = useCallback(
    (paneId: PaneId, moduleId: NavigationDestination, pendingNav?: PendingNavigation) => {
      const newState: PaneState = {
        moduleId,
        pendingNavigation: pendingNav ?? null,
      };

      if (paneId === 'main') {
        setMainPane(newState);
        AsyncStorage.setItem(STORAGE_KEY_MAIN_MODULE, moduleId).catch((error) => {
          console.warn('[PaneContext] Failed to save main module:', error);
        });
      } else if (paneId === 'left') {
        setLeftPane(newState);
        AsyncStorage.setItem(STORAGE_KEY_LEFT_MODULE, moduleId).catch((error) => {
          console.warn('[PaneContext] Failed to save left module:', error);
        });
      } else {
        setRightPane(newState);
        AsyncStorage.setItem(STORAGE_KEY_RIGHT_MODULE, moduleId).catch((error) => {
          console.warn('[PaneContext] Failed to save right module:', error);
        });
      }
    },
    []
  );

  const consumePendingNavigation = useCallback(
    (paneId: PaneId): PendingNavigation | null => {
      let pending: PendingNavigation | null = null;

      if (paneId === 'main') {
        pending = mainPane.pendingNavigation ?? null;
        if (pending) {
          setMainPane(prev => ({ ...prev, pendingNavigation: null }));
        }
      } else if (paneId === 'left') {
        pending = leftPane.pendingNavigation ?? null;
        if (pending) {
          setLeftPane(prev => ({ ...prev, pendingNavigation: null }));
        }
      } else {
        pending = rightPane.pendingNavigation ?? null;
        if (pending) {
          setRightPane(prev => ({ ...prev, pendingNavigation: null }));
        }
      }

      return pending;
    },
    [mainPane, leftPane, rightPane]
  );

  // ============================================================
  // Panel Ratio
  // ============================================================

  const setPanelRatio = useCallback((ratio: number) => {
    const clampedRatio = Math.max(0.25, Math.min(0.75, ratio));
    setPanelRatioState(clampedRatio);
    AsyncStorage.setItem(STORAGE_KEY_PANEL_RATIO, clampedRatio.toString()).catch((error) => {
      console.warn('[PaneContext] Failed to save panel ratio:', error);
    });
  }, []);

  // ============================================================
  // Module Picker
  // ============================================================

  const openModulePicker = useCallback((paneId: PaneId) => {
    setActivePickerPane(paneId);
  }, []);

  const closeModulePicker = useCallback(() => {
    setActivePickerPane(null);
  }, []);

  // ============================================================
  // Panes Record
  // ============================================================

  const panes = useMemo<Partial<Record<PaneId, PaneState>>>(() => {
    if (paneCount === 1) {
      return { main: mainPane };
    }
    return { left: leftPane, right: rightPane };
  }, [paneCount, mainPane, leftPane, rightPane]);

  // ============================================================
  // Context Value
  // ============================================================

  const value = useMemo<PaneContextValue>(
    () => ({
      panes,
      paneCount,
      setPaneModule,
      consumePendingNavigation,
      panelRatio,
      setPanelRatio,
      activePickerPane,
      openModulePicker,
      closeModulePicker,
      activeVoicePane,
      setActiveVoicePane,
      isLoading,
    }),
    [
      panes,
      paneCount,
      setPaneModule,
      consumePendingNavigation,
      panelRatio,
      setPanelRatio,
      activePickerPane,
      openModulePicker,
      closeModulePicker,
      activeVoicePane,
      isLoading,
    ]
  );

  return (
    <PaneContext.Provider value={value}>
      {children}
    </PaneContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Use Pane context
 * @throws Error if used outside PaneProvider
 */
export function usePaneContext(): PaneContextValue {
  const context = useContext(PaneContext);
  if (!context) {
    throw new Error('usePaneContext must be used within PaneProvider');
  }
  return context;
}

/**
 * Use Pane context (safe version)
 * Returns null if used outside PaneProvider
 */
export function usePaneContextSafe(): PaneContextValue | null {
  return useContext(PaneContext);
}

/**
 * Get state for a specific pane
 */
export function usePaneState(paneId: PaneId): PaneState {
  const { panes } = usePaneContext();
  const pane = panes[paneId];
  if (!pane) {
    throw new Error(`Pane '${paneId}' not found in current layout`);
  }
  return pane;
}
