/**
 * LiquidGlassView — React Native wrapper for Apple Liquid Glass effects
 *
 * Progressive Enhancement:
 * - iOS 26+: Renders native UIGlassEffect with tint color
 * - iOS <26 / Android: Renders View with solid fallback color
 *
 * Usage:
 * ```tsx
 * <LiquidGlassView
 *   moduleId="radio"
 *   style={styles.header}
 * >
 *   <Text>Content on glass</Text>
 * </LiquidGlassView>
 * ```
 *
 * @see src/types/liquidGlass.ts for type definitions
 * @see src/contexts/LiquidGlassContext.tsx for settings
 * @see ios/LiquidGlassModule.swift for native implementation
 */

import React, { useMemo } from 'react';
import {
  View,
  Platform,
  StyleSheet,
  requireNativeComponent,
  type ViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useLiquidGlassContext } from '@/contexts/LiquidGlassContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import {
  type ModuleColorId,
  type GlassStyle,
  MODULE_TINT_COLORS,
} from '@/types/liquidGlass';
import { borderRadius } from '@/theme';

// ============================================================
// Native Component
// ============================================================

interface LiquidGlassNativeViewProps {
  tintColorHex: string;
  tintIntensity: number;
  glassStyle: GlassStyle;
  cornerRadius: number;
  fallbackColorHex: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

// Only require native component on iOS
// Note: ViewManager name is "LiquidGlassViewManager", React Native strips "Manager" suffix
// So the registered name is "LiquidGlassView" (not "LiquidGlassNativeView")
const LiquidGlassNativeView = Platform.OS === 'ios'
  ? requireNativeComponent<LiquidGlassNativeViewProps>('LiquidGlassView')
  : null;

// ============================================================
// Props
// ============================================================

export interface LiquidGlassViewProps extends ViewProps {
  /**
   * Module ID for color lookup
   * Uses MODULE_TINT_COLORS registry
   */
  moduleId: ModuleColorId;

  /**
   * Override tint color (optional)
   * If not provided, uses moduleId lookup
   */
  tintColor?: string;

  /**
   * Override fallback color (optional)
   * If not provided, uses moduleId lookup
   */
  fallbackColor?: string;

  /**
   * Glass effect style
   * - "regular": Standard glass (default)
   * - "prominent": More opaque glass
   */
  glassStyle?: GlassStyle;

  /**
   * Corner radius for the glass effect
   * Defaults to borderRadius.lg (16)
   */
  cornerRadius?: number;

  /**
   * Override tint intensity (0-1)
   * If not provided, uses user settings from context
   */
  tintIntensity?: number;

  /**
   * Children to render on top of the glass
   */
  children?: React.ReactNode;
}

// ============================================================
// Component
// ============================================================

/**
 * LiquidGlassView — Container with Liquid Glass effect
 *
 * Automatically falls back to solid color on unsupported platforms.
 */
export function LiquidGlassView({
  moduleId,
  tintColor,
  fallbackColor,
  glassStyle = 'regular',
  cornerRadius: cornerRadiusProp,
  tintIntensity: tintIntensityProp,
  style,
  children,
  ...viewProps
}: LiquidGlassViewProps): React.ReactElement {
  const context = useLiquidGlassContext();
  // Get custom module color from context (respects user preferences)
  const customModuleColor = useModuleColor(moduleId);

  // Get colors from custom context, props, or fallback to registry
  const colors = useMemo(() => {
    const moduleColors = MODULE_TINT_COLORS[moduleId];
    // Priority: props > custom context color > registry default
    const resolvedTintColor = tintColor || customModuleColor || moduleColors?.tintColor || '#607D8B';
    const resolvedFallbackColor = fallbackColor || customModuleColor || moduleColors?.fallbackColor || '#607D8B';

    if (!moduleColors && !customModuleColor) {
      console.warn(`[LiquidGlassView] Unknown moduleId: ${moduleId}`);
    }
    return {
      tintColor: resolvedTintColor,
      fallbackColor: resolvedFallbackColor,
    };
  }, [moduleId, tintColor, fallbackColor, customModuleColor]);

  // Resolve corner radius
  const resolvedCornerRadius = cornerRadiusProp ?? borderRadius.lg;

  // Resolve tint intensity (0-1)
  const resolvedTintIntensity = tintIntensityProp ?? context.getEffectiveTintIntensity();

  // Determine if we should use native glass effect
  const useNativeGlass = context.isEnabled && Platform.OS === 'ios' && LiquidGlassNativeView;

  // Debug logging for Liquid Glass usage
  console.debug(`[LiquidGlassView] moduleId=${moduleId}, isEnabled=${context.isEnabled}, useNativeGlass=${useNativeGlass}, tintColor=${colors.tintColor}`);

  // ============================================================
  // Render
  // ============================================================

  if (useNativeGlass) {
    // iOS 26+ with Liquid Glass enabled
    return (
      <LiquidGlassNativeView
        tintColorHex={colors.tintColor}
        tintIntensity={resolvedTintIntensity}
        glassStyle={glassStyle}
        cornerRadius={resolvedCornerRadius}
        fallbackColorHex={colors.fallbackColor}
        style={[styles.container, style]}
        {...viewProps}
      >
        {children}
      </LiquidGlassNativeView>
    );
  }

  // Fallback: solid color View
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.fallbackColor,
          borderRadius: resolvedCornerRadius,
        },
        style,
      ]}
      {...viewProps}
    >
      {children}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});

// ============================================================
// Exports
// ============================================================

export type { GlassStyle } from '@/types/liquidGlass';
