/**
 * CommEazy PIN Input Component
 *
 * Senior-inclusive PIN input with:
 * - Large cells (60pt minimum)
 * - High contrast
 * - Clear visual feedback
 * - Accessible
 * - Shows digit briefly before masking (senior-friendly)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { colors, typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useAccentColor } from '@/hooks/useAccentColor';

interface PinInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel?: string;
  error?: boolean;
  secureTextEntry?: boolean;
  /** Show all digits (not masked) - used for error display */
  showAllDigits?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

export function PinInput({
  length = 6,
  value,
  onChange,
  accessibilityLabel,
  error = false,
  secureTextEntry = true,
  showAllDigits = false,
  autoFocus = false,
}: PinInputProps) {
  const { accentColor } = useAccentColor();
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  // Track which digit was just entered (to show briefly before masking)
  const [visibleIndex, setVisibleIndex] = useState<number | null>(null);
  const visibleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus) {
      // Small delay to ensure component is mounted
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  // When value changes, show the last digit briefly
  useEffect(() => {
    if (value.length > 0 && secureTextEntry && !showAllDigits) {
      // Clear any existing timeout
      if (visibleTimeoutRef.current) {
        clearTimeout(visibleTimeoutRef.current);
      }

      // Show the last entered digit
      setVisibleIndex(value.length - 1);

      // Hide it after 500ms
      visibleTimeoutRef.current = setTimeout(() => {
        setVisibleIndex(null);
      }, 500);
    }

    return () => {
      if (visibleTimeoutRef.current) {
        clearTimeout(visibleTimeoutRef.current);
      }
    };
  }, [value, secureTextEntry, showAllDigits]);

  const handlePress = () => {
    inputRef.current?.focus();
  };

  const handleChange = (text: string) => {
    // Only allow digits
    const digits = text.replace(/[^0-9]/g, '').slice(0, length);
    onChange(digits);
  };

  const getDisplayChar = (char: string | undefined, index: number): string => {
    if (!char) return '';

    // Always show if showAllDigits is true (error state)
    if (showAllDigits) return char;

    // Always show if secureTextEntry is false
    if (!secureTextEntry) return char;

    // Show if this is the digit that was just entered
    if (index === visibleIndex) return char;

    // Otherwise show dot
    return '●';
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
                isFocused && isCurrentCell && { borderColor: accentColor.primary },
                error && styles.cellError,
                isFilled && { borderColor: accentColor.primary, backgroundColor: colors.backgroundSecondary },
              ]}
            >
              <Text style={[styles.cellText, error && styles.cellTextError]}>
                {getDisplayChar(char, index)}
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
  cellError: {
    borderColor: colors.error,
  },
  cellText: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  cellTextError: {
    color: colors.error,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
});
