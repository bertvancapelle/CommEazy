/**
 * CommEazy PIN Input Component
 *
 * Senior-inclusive PIN input with:
 * - Large cells (60pt minimum)
 * - High contrast
 * - Clear visual feedback
 * - Accessible
 */

import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { colors, typography, touchTargets, borderRadius, spacing } from '@/theme';

interface PinInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel?: string;
  error?: boolean;
  secureTextEntry?: boolean;
}

export function PinInput({
  length = 6,
  value,
  onChange,
  accessibilityLabel,
  error = false,
  secureTextEntry = true,
}: PinInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handlePress = () => {
    inputRef.current?.focus();
  };

  const handleChange = (text: string) => {
    // Only allow digits
    const digits = text.replace(/[^0-9]/g, '').slice(0, length);
    onChange(digits);
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.cellsContainer}
        onPress={handlePress}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="none"
      >
        {Array.from({ length }, (_, index) => {
          const char = value[index];
          const isCurrentCell = index === value.length;
          const isFilled = index < value.length;

          return (
            <View
              key={index}
              style={[
                styles.cell,
                isFocused && isCurrentCell && styles.cellFocused,
                error && styles.cellError,
                isFilled && styles.cellFilled,
              ]}
            >
              <Text style={styles.cellText}>
                {char ? (secureTextEntry ? '●' : char) : ''}
              </Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        keyboardType="number-pad"
        maxLength={length}
        autoComplete="off"
        textContentType="oneTimeCode"
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  cellsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  cell: {
    width: touchTargets.minimum,
    height: touchTargets.comfortable,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  cellFocused: {
    borderColor: colors.primary,
  },
  cellError: {
    borderColor: colors.error,
  },
  cellFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundSecondary,
  },
  cellText: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
});
