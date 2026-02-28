/**
 * ButtonStyleContext — Global button style settings
 *
 * Manages user preferences for button border styling across the app.
 * Settings are persisted in AsyncStorage and synced to the native
 * Glass Player via the glassPlayer bridge.
 *
 * @see .claude/CLAUDE.md Section 10d (Unified Button Styling)
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
import { glassPlayer } from '@/services/glassPlayer';
import { ACCENT_COLORS, type AccentColorKey } from '@/theme';

// ============================================================
// Types
// ============================================================

/** Available border colors (16 accent colors + white + black) */
export type ButtonBorderColor = AccentColorKey | 'white' | 'black';

export interface ButtonStyleSettings {
  /** Whether button borders are enabled */
  borderEnabled: boolean;
  /** Border color key */
  borderColor: ButtonBorderColor;
}

export interface ButtonStyleContextValue {
  /** Current settings */
  settings: ButtonStyleSettings;
  /** Whether the settings are loading */
  isLoading: boolean;
  /** Update border enabled state */
  setBorderEnabled: (enabled: boolean) => Promise<void>;
  /** Update border color */
  setBorderColor: (color: ButtonBorderColor) => Promise<void>;
  /** Get the actual hex color for the border */
  getBorderColorHex: () => string;
}

// ============================================================
// Constants
// ============================================================

const STORAGE_KEY_BORDER_ENABLED = '@commeazy/buttonBorderEnabled';
const STORAGE_KEY_BORDER_COLOR = '@commeazy/buttonBorderColor';

const DEFAULT_SETTINGS: ButtonStyleSettings = {
  borderEnabled: false,
  borderColor: 'white',
};

/** Hex colors for white and black options */
const EXTRA_COLORS: Record<'white' | 'black', string> = {
  white: '#FFFFFF',
  black: '#000000',
};

// ============================================================
// Context
// ============================================================

const ButtonStyleContext = createContext<ButtonStyleContextValue | null>(null);

interface ButtonStyleProviderProps {
  children: ReactNode;
}

/**
 * Provider component for button style context
 */
export function ButtonStyleProvider({ children }: ButtonStyleProviderProps) {
  const [settings, setSettings] = useState<ButtonStyleSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const [borderEnabledStr, borderColor] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_BORDER_ENABLED),
          AsyncStorage.getItem(STORAGE_KEY_BORDER_COLOR),
        ]);

        const newSettings: ButtonStyleSettings = {
          borderEnabled: borderEnabledStr === 'true',
          borderColor: (borderColor as ButtonBorderColor) || DEFAULT_SETTINGS.borderColor,
        };

        setSettings(newSettings);

        // Sync to native Glass Player
        syncToNative(newSettings);
      } catch (error) {
        console.error('[ButtonStyleContext] Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void loadSettings();
  }, []);

  // Sync settings to native Glass Player
  const syncToNative = useCallback((s: ButtonStyleSettings) => {
    const hexColor = getHexColor(s.borderColor);
    glassPlayer.configureButtonStyle?.(s.borderEnabled, hexColor);
  }, []);

  // Get hex color from color key
  const getHexColor = (colorKey: ButtonBorderColor): string => {
    if (colorKey === 'white' || colorKey === 'black') {
      return EXTRA_COLORS[colorKey];
    }
    return ACCENT_COLORS[colorKey]?.primary || EXTRA_COLORS.white;
  };

  // Update border enabled state
  const setBorderEnabled = useCallback(
    async (enabled: boolean) => {
      const newSettings = { ...settings, borderEnabled: enabled };
      setSettings(newSettings);

      try {
        await AsyncStorage.setItem(STORAGE_KEY_BORDER_ENABLED, enabled ? 'true' : 'false');
        syncToNative(newSettings);
      } catch (error) {
        console.error('[ButtonStyleContext] Failed to save borderEnabled:', error);
      }
    },
    [settings, syncToNative]
  );

  // Update border color
  const setBorderColor = useCallback(
    async (color: ButtonBorderColor) => {
      const newSettings = { ...settings, borderColor: color };
      setSettings(newSettings);

      try {
        await AsyncStorage.setItem(STORAGE_KEY_BORDER_COLOR, color);
        syncToNative(newSettings);
      } catch (error) {
        console.error('[ButtonStyleContext] Failed to save borderColor:', error);
      }
    },
    [settings, syncToNative]
  );

  // Get the current border color as hex
  const getBorderColorHex = useCallback((): string => {
    return getHexColor(settings.borderColor);
  }, [settings.borderColor]);

  const value = useMemo(
    () => ({
      settings,
      isLoading,
      setBorderEnabled,
      setBorderColor,
      getBorderColorHex,
    }),
    [settings, isLoading, setBorderEnabled, setBorderColor, getBorderColorHex]
  );

  return (
    <ButtonStyleContext.Provider value={value}>{children}</ButtonStyleContext.Provider>
  );
}

/**
 * Hook to access the button style context
 * Must be used within a ButtonStyleProvider
 */
export function useButtonStyle(): ButtonStyleContextValue {
  const context = useContext(ButtonStyleContext);
  if (!context) {
    throw new Error('useButtonStyle must be used within a ButtonStyleProvider');
  }
  return context;
}

/**
 * Safe hook to access the button style context
 * Returns null if used outside a ButtonStyleProvider (instead of throwing)
 */
export function useButtonStyleSafe(): ButtonStyleContextValue | null {
  return useContext(ButtonStyleContext);
}
