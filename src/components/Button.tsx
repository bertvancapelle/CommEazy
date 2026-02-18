/**
 * CommEazy Button Component
 *
 * Senior-inclusive button with:
 * - Minimum 60pt touch target (exceeds Apple 44pt / Google 48dp)
 * - Large text (18pt)
 * - High contrast
 * - Haptic feedback support
 * - User-customizable accent color support
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  AccessibilityRole,
  Platform,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { colors, typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useAccentColor } from '@/hooks/useAccentColor';

// Haptic feedback helper - senior-inclusive: provides tactile confirmation
const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'medium') => {
  const options = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  const hapticType = Platform.select({
    ios: type === 'light' ? 'impactLight' : type === 'heavy' ? 'impactHeavy' : 'impactMedium',
    android: type === 'light' ? 'effectClick' : type === 'heavy' ? 'effectHeavyClick' : 'effectClick',
    default: 'impactMedium',
  }) as string;

  ReactNativeHapticFeedback.trigger(hapticType, options);
};

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text';
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const { accentColor } = useAccentColor();
  const isDisabled = disabled || loading;

  // Build button styles with accent color
  const buttonStyle: ViewStyle[] = [
    styles.base,
    variant === 'primary' && { backgroundColor: accentColor.primary },
    variant === 'secondary' && {
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: accentColor.primary,
    },
    variant === 'text' && styles.text,
    isDisabled && styles.disabled,
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[];

  // Build text styles with accent color
  const textStyle: TextStyle[] = [
    styles.label,
    variant === 'primary' && styles.labelPrimary,
    variant === 'secondary' && { color: accentColor.primary },
    variant === 'text' && { color: accentColor.primary },
    isDisabled && styles.labelDisabled,
  ].filter(Boolean) as TextStyle[];

  const handlePress = () => {
    triggerHaptic('medium');
    onPress();
  };

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole={'button' as AccessibilityRole}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled }}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.textOnPrimary : accentColor.primary}
          size="small"
        />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    backgroundColor: 'transparent',
  },
  disabled: {
    backgroundColor: colors.disabled,
    borderColor: colors.disabled,
  },
  label: {
    ...typography.button,
  },
  labelPrimary: {
    color: colors.textOnPrimary,
  },
  labelDisabled: {
    color: colors.textTertiary,
  },
});
