/**
 * SearchBar — Senior-inclusive search input with button
 *
 * Standardized search component for all screens with search functionality.
 * Ensures consistent height, styling, and behavior across the app.
 *
 * Features:
 * - Input height matches button height exactly (60pt)
 * - No text shift when typing (fixed line height issue)
 * - Search triggers on Enter key or button tap
 * - Haptic feedback on button press
 *
 * Senior-inclusive design:
 * - Touch targets ≥60pt
 * - Clear visual feedback
 * - Large, readable text (18pt)
 *
 * @see .claude/CLAUDE.md Section 12 (Media Module Design Principles)
 */

import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Platform,
  TextInputProps,
} from 'react-native';

import { Icon } from './Icon';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';

// ============================================================
// Types
// ============================================================

export interface SearchBarRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
}

export interface SearchBarProps {
  /** Current search query value */
  value: string;
  /** Callback when text changes */
  onChangeText: (text: string) => void;
  /** Callback when search is submitted (Enter or button tap) */
  onSubmit: () => void;
  /** Placeholder text */
  placeholder: string;
  /** Accessibility label for the search button */
  searchButtonLabel?: string;
  /** Maximum input length (default: 100) */
  maxLength?: number;
  /** Additional TextInput props */
  textInputProps?: Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'onSubmitEditing' | 'maxLength'>;
}

// ============================================================
// SearchBar Component
// ============================================================

/**
 * Standardized search bar with input and button
 *
 * @example
 * <SearchBar
 *   value={searchQuery}
 *   onChangeText={setSearchQuery}
 *   onSubmit={handleSearch}
 *   placeholder={t('modules.podcast.searchPlaceholder')}
 *   searchButtonLabel={t('modules.podcast.searchButton')}
 * />
 */
export const SearchBar = forwardRef<SearchBarRef, SearchBarProps>(
  (
    {
      value,
      onChangeText,
      onSubmit,
      placeholder,
      searchButtonLabel = 'Search',
      maxLength = 100,
      textInputProps,
    },
    ref
  ) => {
    const inputRef = useRef<TextInput>(null);
    const { accentColor } = useAccentColor();
    const { triggerFeedback } = useFeedback();

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      clear: () => onChangeText(''),
    }));

    const handleSubmit = () => {
      Keyboard.dismiss();
      onSubmit();
    };

    const handleButtonPress = async () => {
      await triggerFeedback('tap');
      handleSubmit();
    };

    return (
      <View style={styles.container}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          maxLength={maxLength}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={placeholder}
          {...textInputProps}
        />
        <TouchableOpacity
          style={[styles.button, { backgroundColor: accentColor.primary }]}
          onPress={handleButtonPress}
          accessibilityRole="button"
          accessibilityLabel={searchButtonLabel}
        >
          <Icon name="search" size={24} color={colors.textOnPrimary} />
        </TouchableOpacity>
      </View>
    );
  }
);

SearchBar.displayName = 'SearchBar';

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    // Fixed height to match button exactly (no minHeight + padding accumulation)
    height: touchTargets.minimum, // 60pt
    // Typography without lineHeight to prevent text shift
    fontSize: typography.body.fontSize, // 18pt
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    // Remove lineHeight to prevent text positioning issues
    // lineHeight causes text to shift when first character is typed
    // Vertical centering
    textAlignVertical: 'center', // Android
    // Styling
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    // No paddingVertical — height is fixed, text is centered
    color: colors.textPrimary,
    // Android: remove extra font padding that causes text shift
    includeFontPadding: false,
  },
  button: {
    width: touchTargets.minimum, // 60pt
    height: touchTargets.minimum, // 60pt
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SearchBar;
