/**
 * CommEazy TextInput Component
 *
 * Senior-inclusive text input with:
 * - Large text (20pt input)
 * - 60pt minimum height
 * - High contrast
 * - Clear labels
 */

import React, { forwardRef } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text,
  StyleSheet,
  TextInputProps as RNTextInputProps,
  ViewStyle,
} from 'react-native';
import { colors, typography, touchTargets, borderRadius, spacing } from '@/theme';

interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  ({ label, hint, error, containerStyle, ...props }, ref) => {
    const hasError = Boolean(error);

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text style={styles.label} accessibilityRole="text">
            {label}
          </Text>
        )}
        <RNTextInput
          ref={ref}
          style={[styles.input, hasError && styles.inputError]}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primary}
          accessibilityLabel={label}
          accessibilityHint={hint}
          {...props}
        />
        {hint && !error && (
          <Text style={styles.hint}>{hint}</Text>
        )}
        {error && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}
      </View>
    );
  }
);

TextInput.displayName = 'TextInput';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.input,
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.error,
  },
  hint: {
    ...typography.small,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  error: {
    ...typography.small,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
