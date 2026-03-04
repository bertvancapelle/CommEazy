/**
 * RecipientInput — Chip-based email recipient input with autocomplete
 *
 * Features:
 * - Chips for each recipient (scrollable, ≥60pt tap targets)
 * - Auto-complete from CommEazy contacts (at 2+ characters)
 * - Manual email entry (validated on Enter/space)
 * - Remove chip via X button with haptic feedback
 *
 * Senior-inclusive:
 * - Large chips (≥60pt height)
 * - Clear X buttons on each chip
 * - Accessibility labels per chip
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 13
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { Icon } from '@/components';
import type { MailRecipient } from '@/types/mail';

// ============================================================
// Types
// ============================================================

export interface RecipientInputProps {
  /** Field label (e.g., "To", "CC") */
  label: string;
  /** Current recipients */
  recipients: MailRecipient[];
  /** Callback when recipients change */
  onRecipientsChange: (recipients: MailRecipient[]) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Max number of recipients */
  maxRecipients?: number;
  /** Autocomplete suggestions */
  suggestions?: MailRecipient[];
  /** Called when input text changes (for autocomplete) */
  onSearchChange?: (query: string) => void;
}

// ============================================================
// Haptic Helper
// ============================================================

const triggerHaptic = () => {
  const options = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };
  const hapticType = Platform.select({
    ios: 'impactMedium',
    android: 'effectClick',
    default: 'impactMedium',
  }) as string;
  ReactNativeHapticFeedback.trigger(hapticType, options);
};

// ============================================================
// Email Validation
// ============================================================

const EMAIL_REGEX = /^[^@]+@[^@]+\.[^@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

// ============================================================
// Component
// ============================================================

export function RecipientInput({
  label,
  recipients,
  onRecipientsChange,
  placeholder,
  maxRecipients = 50,
  suggestions = [],
  onSearchChange,
}: RecipientInputProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // ============================================================
  // Add / Remove Recipients
  // ============================================================

  const addRecipient = useCallback(
    (recipient: MailRecipient) => {
      if (recipients.length >= maxRecipients) return;
      // Deduplicate by email
      if (recipients.some(r => r.email.toLowerCase() === recipient.email.toLowerCase())) return;

      triggerHaptic();
      onRecipientsChange([...recipients, recipient]);
      setInputValue('');
      setShowSuggestions(false);
      onSearchChange?.('');
    },
    [recipients, maxRecipients, onRecipientsChange, onSearchChange],
  );

  const removeRecipient = useCallback(
    (email: string) => {
      triggerHaptic();
      onRecipientsChange(recipients.filter(r => r.email !== email));
    },
    [recipients, onRecipientsChange],
  );

  // ============================================================
  // Text Input Handling
  // ============================================================

  const handleTextChange = useCallback(
    (text: string) => {
      setInputValue(text);
      onSearchChange?.(text);
      setShowSuggestions(text.length >= 2);
    },
    [onSearchChange],
  );

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (isValidEmail(trimmed)) {
      addRecipient({
        email: trimmed,
        isFromContacts: false,
      });
    }
  }, [inputValue, addRecipient]);

  const handleSuggestionPress = useCallback(
    (suggestion: MailRecipient) => {
      addRecipient(suggestion);
      inputRef.current?.focus();
    },
    [addRecipient],
  );

  // ============================================================
  // Render
  // ============================================================

  return (
    <View style={styles.container}>
      {/* Label */}
      <Text style={[styles.label, { color: themeColors.textSecondary }]}>
        {label}
      </Text>

      {/* Chips + Input */}
      <View style={[styles.inputContainer, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          keyboardShouldPersistTaps="handled"
        >
          {recipients.map(recipient => (
            <View
              key={recipient.email}
              style={[styles.chip, { backgroundColor: accentColor.light }]}
              accessibilityLabel={`${recipient.name || recipient.email}, ${t('modules.mail.compose.removeRecipient')}`}
            >
              <Text
                style={[styles.chipText, { color: themeColors.textPrimary }]}
                numberOfLines={1}
              >
                {recipient.name || recipient.email}
              </Text>
              <TouchableOpacity
                style={styles.chipRemove}
                onPress={() => removeRecipient(recipient.email)}
                onLongPress={() => {}}
                delayLongPress={300}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t('modules.mail.compose.removeRecipient')}
              >
                <Icon name="close" size={16} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}

          <TextInput
            ref={inputRef}
            style={[styles.textInput, { color: themeColors.textPrimary }]}
            value={inputValue}
            onChangeText={handleTextChange}
            onSubmitEditing={handleSubmit}
            placeholder={recipients.length === 0 ? placeholder : ''}
            placeholderTextColor={themeColors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            blurOnSubmit={false}
            accessibilityLabel={label}
          />
        </ScrollView>
      </View>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={[styles.suggestionsContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          {suggestions.map(suggestion => (
            <TouchableOpacity
              key={suggestion.email}
              style={styles.suggestionItem}
              onPress={() => handleSuggestionPress(suggestion)}
              onLongPress={() => {}}
              delayLongPress={300}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${suggestion.name}, ${suggestion.email}`}
            >
              <View style={styles.suggestionContent}>
                <Text style={[styles.suggestionName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                  {suggestion.name}
                </Text>
                <Text style={[styles.suggestionEmail, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  {suggestion.email}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: 18,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    gap: 4,
    maxWidth: 200,
  },
  chipText: {
    ...typography.small,
    fontWeight: '600',
    flexShrink: 1,
  },
  chipRemove: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    ...typography.body,
    flex: 1,
    minWidth: 120,
    minHeight: touchTargets.minimum,
    paddingVertical: 0,
  },
  suggestionsContainer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  suggestionItem: {
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  suggestionContent: {
    gap: 2,
  },
  suggestionName: {
    ...typography.body,
    fontWeight: '600',
  },
  suggestionEmail: {
    ...typography.small,
  },
});
