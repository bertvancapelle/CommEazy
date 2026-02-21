/**
 * SplitViewContext — iPad Split View state management
 *
 * Manages the state for iPad's dual-panel Split View layout:
 * - Left panel: Initially shows Menu, can display any module
 * - Right panel: Initially shows Contacts, can display any module
 * - Module picker: Long-press opens picker for that panel
 * - Voice scope: Two-finger long-press activates voice for that panel
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
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

/** AsyncStorage key for panel ratio */
const STORAGE_KEY_PANEL_RATIO = 'ipad_panel_ratio';

/** AsyncStorage key for left panel module */
const STORAGE_KEY_LEFT_MODULE = 'ipad_left_module';

/** AsyncStorage key for right panel module */
const STORAGE_KEY_RIGHT_MODULE = 'ipad_right_module';

/** Default panel ratio (33% left, 67% right) */
const DEFAULT_PANEL_RATIO = 0.33;

/** Default left panel module */
const DEFAULT_LEFT_MODULE: NavigationDestination = 'menu';

/** Default right panel module */
const DEFAULT_RIGHT_MODULE: NavigationDestination = 'contacts';

// ============================================================
// Types
// ============================================================

/**
 * State for a single panel
 */
export interface PanelState {
  /** Module currently displayed in this panel */
  moduleId: NavigationDestination;
}

/**
 * Panel identifier
 */
export type PanelId = 'left' | 'right';

/**
 * Split View context value
 */
export interface SplitViewContextValue {
  // Panel states
  /** Left panel state */
  leftPanel: PanelState;
  /** Right panel state */
  rightPanel: PanelState;

  // Panel actions
  /** Set module for left panel */
  setLeftModule: (moduleId: NavigationDestination) => void;
  /** Set module for right panel */
  setRightModule: (moduleId: NavigationDestination) => void;
  /** Set module for a specific panel */
  setPanelModule: (panelId: PanelId, moduleId: NavigationDestination) => void;

  // Panel ratio
  /** Panel ratio (0.25 to 0.50) — left panel width as fraction */
  panelRatio: number;
  /** Set panel ratio */
  setPanelRatio: (ratio: number) => void;

  // Module picker
  /** Which panel's picker is currently open, or null */
  activePickerPanel: PanelId | null;
  /** Open module picker for a panel */
  openModulePicker: (panelId: PanelId) => void;
  /** Close module picker */
  closeModulePicker: () => void;

  // Voice scope
  /** Which panel has active voice commands, or null */
  activeVoicePanel: PanelId | null;
  /** Set active voice panel */
  setActiveVoicePanel: (panelId: PanelId | null) => void;

  // Loading state
  /** Whether context is still loading from storage */
  isLoading: boolean;
}

// ============================================================
// Context
// ============================================================

const SplitViewContext = createContext<SplitViewContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

export interface SplitViewProviderProps {
  children: ReactNode;
}

export function SplitViewProvider({ children }: SplitViewProviderProps) {
  // ============================================================
  // State
  // ============================================================

  const [isLoading, setIsLoading] = useState(true);

  // Panel states
  const [leftPanel, setLeftPanel] = useState<PanelState>({
    moduleId: DEFAULT_LEFT_MODULE,
  });
  const [rightPanel, setRightPanel] = useState<PanelState>({
    moduleId: DEFAULT_RIGHT_MODULE,
  });

  // Panel ratio
  const [panelRatio, setPanelRatioState] = useState(DEFAULT_PANEL_RATIO);

  // Module picker
  const [activePickerPanel, setActivePickerPanel] = useState<PanelId | null>(null);

  // Voice scope
  const [activeVoicePanel, setActiveVoicePanel] = useState<PanelId | null>(null);

  // ============================================================
  // Load from Storage
  // ============================================================

  useEffect(() => {
    const loadFromStorage = async () => {
      try {
        const [savedRatio, savedLeft, savedRight] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_PANEL_RATIO),
          AsyncStorage.getItem(STORAGE_KEY_LEFT_MODULE),
          AsyncStorage.getItem(STORAGE_KEY_RIGHT_MODULE),
        ]);

        if (savedRatio) {
          const ratio = parseFloat(savedRatio);
          if (ratio >= 0.25 && ratio <= 0.50) {
            setPanelRatioState(ratio);
          }
        }

        if (savedLeft) {
          setLeftPanel({ moduleId: savedLeft as NavigationDestination });
        }

        if (savedRight) {
          setRightPanel({ moduleId: savedRight as NavigationDestination });
        }
      } catch (error) {
        console.warn('[SplitViewContext] Failed to load from storage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFromStorage();
  }, []);

  // ============================================================
  // Panel Actions
  // ============================================================

  const setLeftModule = useCallback((moduleId: NavigationDestination) => {
    setLeftPanel({ moduleId });
    AsyncStorage.setItem(STORAGE_KEY_LEFT_MODULE, moduleId).catch((error) => {
      console.warn('[SplitViewContext] Failed to save left module:', error);
    });
  }, []);

  const setRightModule = useCallback((moduleId: NavigationDestination) => {
    setRightPanel({ moduleId });
    AsyncStorage.setItem(STORAGE_KEY_RIGHT_MODULE, moduleId).catch((error) => {
      console.warn('[SplitViewContext] Failed to save right module:', error);
    });
  }, []);

  const setPanelModule = useCallback(
    (panelId: PanelId, moduleId: NavigationDestination) => {
      if (panelId === 'left') {
        setLeftModule(moduleId);
      } else {
        setRightModule(moduleId);
      }
    },
    [setLeftModule, setRightModule]
  );

  // ============================================================
  // Panel Ratio
  // ============================================================

  const setPanelRatio = useCallback((ratio: number) => {
    // Clamp ratio between 0.25 and 0.50
    const clampedRatio = Math.max(0.25, Math.min(0.50, ratio));
    setPanelRatioState(clampedRatio);
    AsyncStorage.setItem(STORAGE_KEY_PANEL_RATIO, clampedRatio.toString()).catch((error) => {
      console.warn('[SplitViewContext] Failed to save panel ratio:', error);
    });
  }, []);

  // ============================================================
  // Module Picker
  // ============================================================

  const openModulePicker = useCallback((panelId: PanelId) => {
    setActivePickerPanel(panelId);
  }, []);

  const closeModulePicker = useCallback(() => {
    setActivePickerPanel(null);
  }, []);

  // ============================================================
  // Context Value
  // ============================================================

  const value = useMemo<SplitViewContextValue>(
    () => ({
      leftPanel,
      rightPanel,
      setLeftModule,
      setRightModule,
      setPanelModule,
      panelRatio,
      setPanelRatio,
      activePickerPanel,
      openModulePicker,
      closeModulePicker,
      activeVoicePanel,
      setActiveVoicePanel,
      isLoading,
    }),
    [
      leftPanel,
      rightPanel,
      setLeftModule,
      setRightModule,
      setPanelModule,
      panelRatio,
      setPanelRatio,
      activePickerPanel,
      openModulePicker,
      closeModulePicker,
      activeVoicePanel,
      isLoading,
    ]
  );

  return (
    <SplitViewContext.Provider value={value}>
      {children}
    </SplitViewContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Use Split View context
 * @throws Error if used outside SplitViewProvider
 */
export function useSplitViewContext(): SplitViewContextValue {
  const context = useContext(SplitViewContext);
  if (!context) {
    throw new Error('useSplitViewContext must be used within SplitViewProvider');
  }
  return context;
}

/**
 * Use Split View context (safe version)
 * Returns null if used outside SplitViewProvider
 */
export function useSplitViewContextSafe(): SplitViewContextValue | null {
  return useContext(SplitViewContext);
}

/**
 * Get state for a specific panel
 */
export function usePanelState(panelId: PanelId): PanelState {
  const { leftPanel, rightPanel } = useSplitViewContext();
  return panelId === 'left' ? leftPanel : rightPanel;
}

/**
 * Check if this panel's module picker is open
 */
export function usePanelPicker(panelId: PanelId): boolean {
  const { activePickerPanel } = useSplitViewContext();
  return activePickerPanel === panelId;
}

/**
 * Check if this panel has active voice commands
 */
export function usePanelVoice(panelId: PanelId): boolean {
  const { activeVoicePanel } = useSplitViewContext();
  return activeVoicePanel === panelId;
}
