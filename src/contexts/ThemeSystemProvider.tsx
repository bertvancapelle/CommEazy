/**
 * ThemeSystemProvider — Compound provider for all visual theming
 *
 * Groups related providers to reduce nesting depth in App.tsx:
 * - ThemeProvider (light/dark mode)
 * - AccentColorProvider (accent color theming)
 * - LiquidGlassProvider (iOS 26+ glass effects)
 * - ButtonStyleProvider (unified button styling)
 * - ModuleColorsProvider (per-module color customization)
 */

import React, { type ReactNode } from 'react';
import { StatusBar } from 'react-native';

import { ThemeProvider, useTheme, useColors } from './ThemeContext';
import { AccentColorProvider } from './AccentColorContext';
import { LiquidGlassProvider } from './LiquidGlassContext';
import { ButtonStyleProvider } from './ButtonStyleContext';
import { ModuleColorsProvider } from './ModuleColorsContext';

/**
 * ThemedStatusBar — Dynamically updates StatusBar based on theme
 */
function ThemedStatusBar() {
  const { isDarkMode } = useTheme();
  const themeColors = useColors();

  return (
    <StatusBar
      barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      backgroundColor={themeColors.background}
    />
  );
}

interface ThemeSystemProviderProps {
  children: ReactNode;
}

export function ThemeSystemProvider({ children }: ThemeSystemProviderProps) {
  return (
    <ThemeProvider>
      <ThemedStatusBar />
      <AccentColorProvider>
        <LiquidGlassProvider>
          <ButtonStyleProvider>
            <ModuleColorsProvider>
              {children}
            </ModuleColorsProvider>
          </ButtonStyleProvider>
        </LiquidGlassProvider>
      </AccentColorProvider>
    </ThemeProvider>
  );
}
