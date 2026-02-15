/**
 * AccentColorContext — Global accent color state management
 *
 * Provides a shared accent color state across all components.
 * When the user changes their accent color, all components using
 * useAccentColor() will re-render with the new color.
 *
 * Usage:
 * 1. Wrap your app with <AccentColorProvider>
 * 2. Use useAccentColor() hook in any component
 *
 * @see src/theme/index.ts for color definitions
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { ServiceContainer } from '@/services/container';
import {
  accentColors,
  type AccentColorKey,
  type AccentColor,
  DEFAULT_ACCENT_COLOR,
} from '@/theme';

export interface AccentColorContextValue {
  /** Current accent color key (e.g., 'blue', 'green') */
  accentColorKey: AccentColorKey;
  /** Current accent color values */
  accentColor: AccentColor;
  /** Update the accent color */
  updateAccentColor: (key: AccentColorKey) => Promise<void>;
  /** Get color with accent applied (for dynamic styling) */
  getColor: (colorName: 'primary' | 'primaryLight' | 'primaryDark') => string;
  /** Loading state */
  isLoading: boolean;
}

const AccentColorContext = createContext<AccentColorContextValue | null>(null);

interface AccentColorProviderProps {
  children: ReactNode;
}

/**
 * Provider component for accent color context
 */
export function AccentColorProvider({ children }: AccentColorProviderProps) {
  const [accentColorKey, setAccentColorKey] = useState<AccentColorKey>(DEFAULT_ACCENT_COLOR);
  const [isLoading, setIsLoading] = useState(true);

  // Load accent color from user profile
  useEffect(() => {
    async function loadAccentColor() {
      try {
        if (!ServiceContainer.isInitialized) {
          setIsLoading(false);
          return;
        }

        const profile = await ServiceContainer.database.getUserProfile();
        if (profile?.accentColor && accentColors[profile.accentColor as AccentColorKey]) {
          setAccentColorKey(profile.accentColor as AccentColorKey);
        }
      } catch (error) {
        console.error('[AccentColorContext] Failed to load accent color:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void loadAccentColor();
  }, []);

  // Update accent color in profile
  const updateAccentColor = useCallback(async (key: AccentColorKey) => {
    // Update state immediately for instant UI feedback
    setAccentColorKey(key);

    try {
      if (!ServiceContainer.isInitialized) return;

      const profile = await ServiceContainer.database.getUserProfile();
      if (profile) {
        await ServiceContainer.database.saveUserProfile({
          ...profile,
          accentColor: key,
        });
      }
    } catch (error) {
      console.error('[AccentColorContext] Failed to save accent color:', error);
    }
  }, []);

  // Get the current accent color values
  const accentColor = useMemo(() => {
    return accentColors[accentColorKey];
  }, [accentColorKey]);

  // Get a specific color with accent applied
  const getColor = useCallback((colorName: 'primary' | 'primaryLight' | 'primaryDark'): string => {
    return accentColor[colorName];
  }, [accentColor]);

  const value = useMemo(() => ({
    accentColorKey,
    accentColor,
    updateAccentColor,
    getColor,
    isLoading,
  }), [accentColorKey, accentColor, updateAccentColor, getColor, isLoading]);

  return (
    <AccentColorContext.Provider value={value}>
      {children}
    </AccentColorContext.Provider>
  );
}

/**
 * Hook to access the accent color context
 * Must be used within an AccentColorProvider
 */
export function useAccentColorContext(): AccentColorContextValue {
  const context = useContext(AccentColorContext);
  if (!context) {
    throw new Error('useAccentColorContext must be used within an AccentColorProvider');
  }
  return context;
}
