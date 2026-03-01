/**
 * AirPlayButton — Native AVRoutePickerView wrapped in CommEazy styling
 *
 * Renders Apple's standard AirPlay route picker button with CommEazy's
 * button styling (60pt touch target, borderRadius, optional border).
 *
 * iOS only — renders nothing on Android.
 *
 * @see AirPlayRoutePickerViewManager.swift for native implementation
 * @see .claude/CLAUDE.md Section 10d (Unified Button Styling)
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Platform,
  requireNativeComponent,
} from 'react-native';
import { touchTargets, borderRadius } from '@/theme';
import { useButtonStyleSafe } from '@/contexts/ButtonStyleContext';

// ============================================================
// Types
// ============================================================

interface AirPlayRoutePickerNativeProps {
  tintColorHex: string;
  activeTintColorHex: string;
  buttonSize: number;
  style?: any;
}

interface AirPlayButtonProps {
  /** Tint color for the AirPlay icon */
  tintColor?: string;
  /** Tint color when AirPlay is active */
  activeTintColor?: string;
  /** Accessibility label */
  accessibilityLabel?: string;
}

// ============================================================
// Native Component
// ============================================================

// Only require native component on iOS
const AirPlayRoutePickerNative = Platform.OS === 'ios'
  ? requireNativeComponent<AirPlayRoutePickerNativeProps>('AirPlayRoutePickerView')
  : null;

// ============================================================
// Component
// ============================================================

export function AirPlayButton({
  tintColor = '#FFFFFF',
  activeTintColor = '#4FC3F7',
  accessibilityLabel,
}: AirPlayButtonProps) {
  // Don't render on Android
  if (Platform.OS !== 'ios' || !AirPlayRoutePickerNative) {
    return null;
  }

  // Button border styling from user preferences
  const buttonStyleContext = useButtonStyleSafe();
  const buttonBorderStyle = buttonStyleContext?.settings.borderEnabled
    ? {
        borderWidth: 2,
        borderColor: buttonStyleContext.getBorderColorHex(),
      }
    : undefined;

  return (
    <View
      style={[styles.container, buttonBorderStyle]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <AirPlayRoutePickerNative
        tintColorHex={tintColor}
        activeTintColorHex={activeTintColor}
        buttonSize={touchTargets.minimum}
        style={styles.nativePicker}
      />
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  nativePicker: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
  },
});
