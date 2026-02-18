/**
 * VoiceTextInput — Voice-enabled text input component
 *
 * Extends TextInput with voice dictation support:
 * - Registers with VoiceFormContext for voice commands
 * - "pas aan [veldnaam]" → Focus this field
 * - "wis" → Clear field content
 * - "dicteer" → Start voice-to-text dictation
 * - Visual indicator when field is voice-focused
 *
 * @see .claude/CLAUDE.md § 11. Voice Interaction Architecture
 * @see src/contexts/VoiceFormContext.tsx
 */

import React, { forwardRef, useCallback, useRef, useImperativeHandle, useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text,
  StyleSheet,
  TextInputProps as RNTextInputProps,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useVoiceField } from '@/contexts/VoiceFormContext';
import { useAccentColor } from '@/hooks/useAccentColor';

// ============================================================
// Types
// ============================================================

interface VoiceTextInputProps extends Omit<RNTextInputProps, 'style' | 'value' | 'onChangeText'> {
  /** Unique ID for voice command targeting */
  voiceId: string;
  /** Label displayed above the input (used for voice matching) */
  label: string;
  /** Current value */
  value: string;
  /** Called when text changes (from typing or dictation) */
  onChangeText: (text: string) => void;
  /** Optional hint text below the input */
  hint?: string;
  /** Error message to display */
  error?: string;
  /** Container style override */
  containerStyle?: ViewStyle;
  /** Whether voice features are enabled (default: true) */
  voiceEnabled?: boolean;
  /** Whether to show mic icon (default: true when voiceEnabled) */
  showMicIcon?: boolean;
}

export interface VoiceTextInputRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  isFocused: () => boolean;
}

// ============================================================
// Component
// ============================================================

export const VoiceTextInput = forwardRef<VoiceTextInputRef, VoiceTextInputProps>(
  (
    {
      voiceId,
      label,
      value,
      onChangeText,
      hint,
      error,
      containerStyle,
      voiceEnabled = true,
      showMicIcon = true,
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation();
    const { accentColor } = useAccentColor();
    const inputRef = useRef<RNTextInput>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Voice field callbacks
    const handleEdit = useCallback(() => {
      inputRef.current?.focus();
    }, []);

    const handleClear = useCallback(() => {
      onChangeText('');
    }, [onChangeText]);

    const handleDictate = useCallback((text: string) => {
      // Append dictated text to existing value (or replace if empty)
      const newValue = value ? `${value} ${text}` : text;
      onChangeText(newValue);
    }, [value, onChangeText]);

    // Register with VoiceFormContext
    const { isActive: isVoiceActive, setActive } = voiceEnabled
      ? useVoiceField(voiceId, label, handleEdit, handleClear, handleDictate)
      : { isActive: false, setActive: () => {} };

    // Expose ref methods
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      clear: () => onChangeText(''),
      isFocused: () => isFocused,
    }));

    const hasError = Boolean(error);
    const showVoiceFocus = voiceEnabled && isVoiceActive;

    // Handle focus/blur to track state
    const handleFocus = useCallback(() => {
      setIsFocused(true);
      setActive();
      props.onFocus?.({} as any);
    }, [setActive, props.onFocus]);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
      props.onBlur?.({} as any);
    }, [props.onBlur]);

    return (
      <View style={[styles.container, containerStyle]}>
        {/* Label */}
        <Text style={styles.label} accessibilityRole="text">
          {label}
        </Text>

        {/* Input container with voice focus indicator */}
        <View
          style={[
            styles.inputContainer,
            hasError && styles.inputContainerError,
            showVoiceFocus && {
              borderWidth: 4,
              borderColor: accentColor.primary,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <RNTextInput
            ref={inputRef}
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholderTextColor={colors.textTertiary}
            selectionColor={accentColor.primary}
            accessibilityLabel={label}
            accessibilityHint={hint || t('accessibility.textInputHint', { label })}
            accessibilityState={{
              selected: isVoiceActive,
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />

          {/* Voice focus indicator / mic icon */}
          {voiceEnabled && showMicIcon && (
            <View style={styles.micIconContainer}>
              {isVoiceActive ? (
                <Text style={styles.micIconActive}>🎤</Text>
              ) : (
                <Text style={styles.micIcon}>🎙️</Text>
              )}
            </View>
          )}
        </View>

        {/* Hint or error */}
        {hint && !error && (
          <Text style={styles.hint}>{hint}</Text>
        )}
        {error && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}

        {/* Voice active indicator text */}
        {showVoiceFocus && (
          <Text style={[styles.voiceActiveHint, { color: accentColor.primary }]}>
            {t('voiceCommands.editingField', { field: label })}
          </Text>
        )}
      </View>
    );
  }
);

VoiceTextInput.displayName = 'VoiceTextInput';

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  inputContainerError: {
    borderColor: colors.error,
  },
  input: {
    ...typography.input,
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  micIconContainer: {
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micIcon: {
    fontSize: 20,
    opacity: 0.4,
  },
  micIconActive: {
    fontSize: 20,
    opacity: 1,
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
  voiceActiveHint: {
    ...typography.small,
    fontWeight: '600',
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
});
