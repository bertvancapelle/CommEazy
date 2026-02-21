/**
 * useLiquidGlass — Hook for Apple Liquid Glass effects
 *
 * Provides:
 * - Platform support detection (iOS 26+ required)
 * - User settings (tint intensity, force disable)
 * - Accessibility state (reduce transparency)
 * - Module color lookup with automatic fallback
 *
 * Progressive Enhancement:
 * - iOS 26+: Returns isEnabled=true, use Liquid Glass effects
 * - iOS <26 / Android: Returns isEnabled=false, use solid colors
 *
 * NOTE: This hook uses LiquidGlassContext for shared state.
 * Make sure your app is wrapped with <LiquidGlassProvider>.
 *
 * @see src/types/liquidGlass.ts for type definitions
 * @see src/contexts/LiquidGlassContext.tsx for the context provider
 * @see .claude/CLAUDE.md section 16 - Apple Liquid Glass Compliance
 */

import { useMemo } from 'react';
import {
  useLiquidGlassContext,
  useLiquidGlassEnabled,
  type LiquidGlassContextValue,
} from '@/contexts/LiquidGlassContext';
import {
  type ModuleColorId,
  type ModuleTintColor,
  MODULE_TINT_COLORS,
  LIQUID_GLASS_MIN_IOS_VERSION,
} from '@/types/liquidGlass';

// ============================================================
// Main Hook
// ============================================================

/**
 * Main hook for Liquid Glass functionality
 * Returns the full context value with all settings and methods
 */
export function useLiquidGlass(): LiquidGlassContextValue {
  return useLiquidGlassContext();
}

// ============================================================
// Convenience Hooks
// ============================================================

/**
 * Check if Liquid Glass is enabled on current device
 * Returns false if outside provider or not supported
 */
export function useIsLiquidGlassEnabled(): boolean {
  return useLiquidGlassEnabled();
}

/**
 * Get color configuration for a specific module
 * Automatically handles Liquid Glass vs fallback selection
 *
 * @param moduleId - Module to get colors for
 * @returns Object with tintColor, fallbackColor, and effectiveColor
 */
export function useModuleTintColor(moduleId: ModuleColorId): {
  /** Tint color for Liquid Glass effect */
  tintColor: string;
  /** Fallback solid color for unsupported platforms */
  fallbackColor: string;
  /** Light color for text/icons on this background */
  lightColor: string;
  /** The color to use based on current platform support */
  effectiveColor: string;
  /** Whether Liquid Glass is enabled */
  isGlassEnabled: boolean;
} {
  const context = useLiquidGlassContext();
  const colors = MODULE_TINT_COLORS[moduleId];

  return useMemo(() => {
    if (!colors) {
      // Unknown module, return safe defaults
      console.warn(`[useLiquidGlass] Unknown moduleId: ${moduleId}`);
      return {
        tintColor: '#607D8B',
        fallbackColor: '#607D8B',
        lightColor: '#FFFFFF',
        effectiveColor: '#607D8B',
        isGlassEnabled: false,
      };
    }

    return {
      tintColor: colors.tintColor,
      fallbackColor: colors.fallbackColor,
      lightColor: colors.lightColor,
      effectiveColor: context.isEnabled ? colors.tintColor : colors.fallbackColor,
      isGlassEnabled: context.isEnabled,
    };
  }, [colors, context.isEnabled, moduleId]);
}

/**
 * Get tint intensity for Liquid Glass effect
 * Returns 0-1 value suitable for native module
 *
 * @returns Object with intensity values and setter
 */
export function useTintIntensity(): {
  /** Current intensity as percentage (0-100) */
  percentage: number;
  /** Current intensity as decimal (0-1) for native module */
  decimal: number;
  /** Update intensity (0-100) */
  setIntensity: (value: number) => void;
} {
  const context = useLiquidGlassContext();

  return useMemo(
    () => ({
      percentage: context.settings.tintIntensity,
      decimal: context.getEffectiveTintIntensity(),
      setIntensity: context.setTintIntensity,
    }),
    [context.settings.tintIntensity, context.getEffectiveTintIntensity, context.setTintIntensity]
  );
}

/**
 * Get platform support information
 *
 * @returns Object with platform details
 */
export function useLiquidGlassPlatform(): {
  /** True if running on iOS 26+ */
  isSupported: boolean;
  /** iOS version number, null on Android */
  iosVersion: number | null;
  /** Platform name */
  platform: 'ios' | 'android';
  /** Minimum iOS version required */
  minVersion: number;
} {
  const context = useLiquidGlassContext();

  return useMemo(
    () => ({
      isSupported: context.platform.isSupported,
      iosVersion: context.platform.iosVersion,
      platform: context.platform.platform,
      minVersion: LIQUID_GLASS_MIN_IOS_VERSION,
    }),
    [context.platform]
  );
}

/**
 * Get accessibility state relevant to Liquid Glass
 *
 * @returns Object with accessibility settings
 */
export function useLiquidGlassAccessibility(): {
  /** System "Reduce Transparency" is enabled */
  reduceTransparencyEnabled: boolean;
  /** System "Reduce Motion" is enabled */
  reduceMotionEnabled: boolean;
  /** User has force-disabled Liquid Glass */
  forceDisabled: boolean;
  /** Set force-disabled preference */
  setForceDisabled: (disabled: boolean) => void;
} {
  const context = useLiquidGlassContext();

  return useMemo(
    () => ({
      reduceTransparencyEnabled: context.accessibility.reduceTransparencyEnabled,
      reduceMotionEnabled: context.accessibility.reduceMotionEnabled,
      forceDisabled: context.settings.forceDisabled,
      setForceDisabled: context.setForceDisabled,
    }),
    [context.accessibility, context.settings.forceDisabled, context.setForceDisabled]
  );
}

// ============================================================
// Exports
// ============================================================

// Re-export types for convenience
export type { ModuleColorId, ModuleTintColor };
export { MODULE_TINT_COLORS, LIQUID_GLASS_MIN_IOS_VERSION };
