/**
 * ThemeContext — Global theme state management (Light/Dark/System)
 *
 * Provides a shared theme state across all components.
 * Supports:
 * - Light mode (default)
 * - Dark mode
 * - System mode (follows iOS/Android system setting)
 *
 * Usage:
 * 1. Wrap your app with <ThemeProvider>
 * 2. Use useTheme() hook in any component
 *
 * @see .claude/plans/COLOR_THEME_SYSTEM_FOR_SENIORS.md
 * @see src/theme/darkColors.ts for dark mode palette
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
import { Appearance, useColorScheme as useRNColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/theme';
import { darkColors, darkAccentColors } from '@/theme/darkColors';

// ============================================================
// Types
// ============================================================

/** Theme mode preference */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Actual resolved theme (light or dark) */
export type ResolvedTheme = 'light' | 'dark';

/** Color palette type */
export type ColorPalette = typeof colors;

export interface ThemeContextValue {
  /** User's theme preference (light, dark, or system) */
  themeMode: ThemeMode;
  /** Resolved theme (light or dark) after applying system preference */
  resolvedTheme: ResolvedTheme;
  /** Whether dark mode is currently active */
  isDarkMode: boolean;
  /** Current color palette based on resolved theme */
  colorPalette: ColorPalette;
  /** Update the theme mode */
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  /** Toggle between light and dark (ignores system) */
  toggleTheme: () => Promise<void>;
  /** Loading state */
  isLoading: boolean;
}

// ============================================================
// Constants
// ============================================================

const THEME_STORAGE_KEY = '@commeazy_theme_mode';
const DEFAULT_THEME_MODE: ThemeMode = 'light';

// ============================================================
// Context
// ============================================================

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Provider component for theme context
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [isLoading, setIsLoading] = useState(true);

  // Get system color scheme from React Native
  const systemColorScheme = useRNColorScheme();

  // Calculate resolved theme based on mode and system preference
  const resolvedTheme = useMemo((): ResolvedTheme => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, systemColorScheme]);

  const isDarkMode = resolvedTheme === 'dark';

  // Get the appropriate color palette
  const colorPalette = useMemo((): ColorPalette => {
    return isDarkMode ? darkColors : colors;
  }, [isDarkMode]);

  // Load theme mode from storage on mount
  useEffect(() => {
    async function loadThemeMode() {
      try {
        const storedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (storedMode && isValidThemeMode(storedMode)) {
          setThemeModeState(storedMode as ThemeMode);
        }
      } catch (error) {
        console.error('[ThemeContext] Failed to load theme mode:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void loadThemeMode();
  }, []);

  // Update theme mode and persist to storage
  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('[ThemeContext] Failed to save theme mode:', error);
    }
  }, []);

  // Toggle between light and dark (ignores system setting)
  const toggleTheme = useCallback(async () => {
    const newMode: ThemeMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    await setThemeMode(newMode);
  }, [resolvedTheme, setThemeMode]);

  const value = useMemo(
    () => ({
      themeMode,
      resolvedTheme,
      isDarkMode,
      colorPalette,
      setThemeMode,
      toggleTheme,
      isLoading,
    }),
    [themeMode, resolvedTheme, isDarkMode, colorPalette, setThemeMode, toggleTheme, isLoading]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Hook to access the theme context
 * Must be used within a ThemeProvider
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Safe hook that returns null if not within a provider
 */
export function useThemeSafe(): ThemeContextValue | null {
  return useContext(ThemeContext);
}

/**
 * Convenience hook for just the color palette
 */
export function useColors(): ColorPalette {
  const context = useTheme();
  return context.colorPalette;
}

/**
 * Convenience hook for dark mode status
 */
export function useIsDarkMode(): boolean {
  const context = useTheme();
  return context.isDarkMode;
}

// ============================================================
// Utilities
// ============================================================

function isValidThemeMode(value: string): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Get dark mode accent color for a given accent color key
 * Used when both accent color AND dark mode are active
 */
export function getDarkAccentColor(key: string): typeof darkAccentColors.blue | null {
  if (key in darkAccentColors) {
    return darkAccentColors[key as keyof typeof darkAccentColors];
  }
  return null;
}
