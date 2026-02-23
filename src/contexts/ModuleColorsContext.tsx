/**
 * ModuleColorsContext — Custom module color management
 *
 * Allows users to customize the tint colors for each module.
 * Colors are persisted to AsyncStorage and used by LiquidGlassView
 * and other components that need module-specific colors.
 *
 * @see src/types/liquidGlass.ts for type definitions
 * @see src/contexts/LiquidGlassContext.tsx for glass effect settings
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  type ModuleColorId,
  type ModuleTintColor,
  MODULE_TINT_COLORS,
} from '@/types/liquidGlass';
import {
  ACCENT_COLORS,
  ACCENT_COLOR_KEYS,
  type AccentColorKey,
} from '@/theme/accentColors';

// Re-export type for use in other modules
export type { ModuleColorId } from '@/types/liquidGlass';
export type { AccentColorKey } from '@/theme/accentColors';

// ============================================================
// Constants
// ============================================================

const MODULE_COLORS_STORAGE_KEY = 'module_colors_custom';

/**
 * Color options for module customization
 * Uses the unified ACCENT_COLORS palette (16 colors, 4x4 grid)
 * Labels come from i18n via theme.accentColors.[key]
 */
export const MODULE_COLOR_OPTIONS = ACCENT_COLOR_KEYS.map((key) => ({
  key,
  hex: ACCENT_COLORS[key].primary,
  labelKey: ACCENT_COLORS[key].label,
}));

/**
 * Modules that can be customized by the user
 * Excludes aliases and internal modules
 */
export const CUSTOMIZABLE_MODULES: ModuleColorId[] = [
  'chats',
  'contacts',
  'groups',
  'calls',
  'radio',
  'podcast',
  'books',
  'weather',
  'appleMusic',
  'settings',
];

/**
 * i18n keys for module labels (use with t() in UI)
 */
export const MODULE_LABELS: Record<ModuleColorId, string> = {
  chats: 'navigation.chats',
  messages: 'navigation.chats',
  contacts: 'navigation.contacts',
  groups: 'navigation.groups',
  calls: 'navigation.calls',
  videocall: 'navigation.calls',
  radio: 'navigation.radio',
  podcast: 'navigation.podcast',
  books: 'navigation.books',
  audiobook: 'navigation.books',
  ebook: 'navigation.ebook',
  weather: 'navigation.weather',
  nunl: 'navigation.news',
  appleMusic: 'navigation.appleMusic',
  settings: 'navigation.settings',
  help: 'navigation.help',
  menu: 'navigation.menu',
};

// ============================================================
// Types
// ============================================================

/**
 * Custom color overrides per module
 * Only stores overrides — defaults come from MODULE_TINT_COLORS
 */
export type ModuleColorOverrides = Partial<Record<ModuleColorId, string>>;

export interface ModuleColorsContextValue {
  /**
   * Get the effective color for a module
   * Returns custom color if set, otherwise default
   */
  getModuleColor: (moduleId: ModuleColorId) => ModuleTintColor;

  /**
   * Get the raw hex color for a module
   */
  getModuleHex: (moduleId: ModuleColorId) => string;

  /**
   * Set a custom color for a module
   */
  setModuleColor: (moduleId: ModuleColorId, hexColor: string) => void;

  /**
   * Reset a module to its default color
   */
  resetModuleColor: (moduleId: ModuleColorId) => void;

  /**
   * Reset all modules to default colors
   */
  resetAllColors: () => void;

  /**
   * Check if a module has a custom color
   */
  hasCustomColor: (moduleId: ModuleColorId) => boolean;

  /**
   * Current overrides (for debugging/display)
   */
  overrides: ModuleColorOverrides;

  /**
   * Loading state
   */
  isLoading: boolean;
}

// ============================================================
// Context
// ============================================================

const ModuleColorsContext = createContext<ModuleColorsContextValue | null>(null);

interface ModuleColorsProviderProps {
  children: ReactNode;
}

/**
 * Provider component for module colors context
 */
export function ModuleColorsProvider({ children }: ModuleColorsProviderProps) {
  const [overrides, setOverrides] = useState<ModuleColorOverrides>({});
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================
  // Load from AsyncStorage
  // ============================================================

  useEffect(() => {
    async function loadOverrides() {
      try {
        const stored = await AsyncStorage.getItem(MODULE_COLORS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as ModuleColorOverrides;
          setOverrides(parsed);
        }
      } catch (error) {
        console.error('[ModuleColorsContext] Failed to load overrides:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void loadOverrides();
  }, []);

  // ============================================================
  // Persist to AsyncStorage
  // ============================================================

  const persistOverrides = useCallback(async (newOverrides: ModuleColorOverrides) => {
    try {
      await AsyncStorage.setItem(
        MODULE_COLORS_STORAGE_KEY,
        JSON.stringify(newOverrides)
      );
    } catch (error) {
      console.error('[ModuleColorsContext] Failed to persist overrides:', error);
    }
  }, []);

  // ============================================================
  // Methods
  // ============================================================

  const getModuleColor = useCallback(
    (moduleId: ModuleColorId): ModuleTintColor => {
      const customHex = overrides[moduleId];
      const defaultColor = MODULE_TINT_COLORS[moduleId];

      if (!defaultColor) {
        console.warn(`[ModuleColorsContext] Unknown moduleId: ${moduleId}`);
        return {
          moduleId,
          tintColor: '#607D8B',
          fallbackColor: '#607D8B',
          lightColor: '#FFFFFF',
        };
      }

      if (customHex) {
        return {
          ...defaultColor,
          tintColor: customHex,
          fallbackColor: customHex,
        };
      }

      return defaultColor;
    },
    [overrides]
  );

  const getModuleHex = useCallback(
    (moduleId: ModuleColorId): string => {
      return overrides[moduleId] || MODULE_TINT_COLORS[moduleId]?.tintColor || '#607D8B';
    },
    [overrides]
  );

  const setModuleColor = useCallback(
    (moduleId: ModuleColorId, hexColor: string) => {
      const newOverrides = {
        ...overrides,
        [moduleId]: hexColor,
      };
      setOverrides(newOverrides);
      void persistOverrides(newOverrides);
    },
    [overrides, persistOverrides]
  );

  const resetModuleColor = useCallback(
    (moduleId: ModuleColorId) => {
      const newOverrides = { ...overrides };
      delete newOverrides[moduleId];
      setOverrides(newOverrides);
      void persistOverrides(newOverrides);
    },
    [overrides, persistOverrides]
  );

  const resetAllColors = useCallback(() => {
    setOverrides({});
    void persistOverrides({});
  }, [persistOverrides]);

  const hasCustomColor = useCallback(
    (moduleId: ModuleColorId): boolean => {
      return moduleId in overrides;
    },
    [overrides]
  );

  // ============================================================
  // Context Value
  // ============================================================

  const value = useMemo<ModuleColorsContextValue>(
    () => ({
      getModuleColor,
      getModuleHex,
      setModuleColor,
      resetModuleColor,
      resetAllColors,
      hasCustomColor,
      overrides,
      isLoading,
    }),
    [
      getModuleColor,
      getModuleHex,
      setModuleColor,
      resetModuleColor,
      resetAllColors,
      hasCustomColor,
      overrides,
      isLoading,
    ]
  );

  return (
    <ModuleColorsContext.Provider value={value}>
      {children}
    </ModuleColorsContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Hook to access the module colors context
 * Must be used within a ModuleColorsProvider
 */
export function useModuleColorsContext(): ModuleColorsContextValue {
  const context = useContext(ModuleColorsContext);
  if (!context) {
    throw new Error(
      'useModuleColorsContext must be used within a ModuleColorsProvider'
    );
  }
  return context;
}

/**
 * Safe hook that returns null if outside provider
 */
export function useModuleColorsContextSafe(): ModuleColorsContextValue | null {
  return useContext(ModuleColorsContext);
}

/**
 * Convenience hook for getting a single module's color
 */
export function useModuleColor(moduleId: ModuleColorId): string {
  const context = useContext(ModuleColorsContext);
  if (!context) {
    return MODULE_TINT_COLORS[moduleId]?.tintColor || '#607D8B';
  }
  return context.getModuleHex(moduleId);
}
