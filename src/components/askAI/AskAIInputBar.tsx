/**
 * AskAIInputBar — Text input + send button for Ask AI
 *
 * Senior-inclusive design:
 * - 60pt minimum touch target for send button
 * - 18pt font size in input field
 * - Clear visual feedback for send state
 *
 * @see .claude/plans/VRAAG_HET_AI_MODULE.md
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';

import {
  colors,
  typography,
  spacing,
  borderRadius,
  touchTargets,
} from '@/theme';
import { Icon } from '@/components/Icon';

interface AskAIInputBarProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  moduleColor: string;
}

export function AskAIInputBar({ onSend, isLoading, moduleColor }: AskAIInputBarProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setText('');
  }, [text, isLoading, onSend]);

  const canSend = text.trim().length > 0 && !isLoading;

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={t('modules.askAI.chat.inputPlaceholder')}
        placeholderTextColor={colors.textTertiary}
        multiline
        maxLength={2000}
        returnKeyType="send"
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
        accessibilityLabel={t('modules.askAI.chat.inputPlaceholder')}
        editable={!isLoading}
      />
      <HapticTouchable hapticDisabled
        style={[
          styles.sendButton,
          canSend
            ? { backgroundColor: moduleColor }
            : styles.sendButtonDisabled,
        ]}
        onPress={handleSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel={t('modules.askAI.a11y.sendMessage')}
        accessibilityState={{ disabled: !canSend }}
      >
        <Icon
          name="chevron-right"
          size={28}
          color={canSend ? '#FFFFFF' : colors.textTertiary}
        />
      </HapticTouchable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTargets.minimum,
    maxHeight: 120,
    ...Platform.select({
      ios: { paddingTop: spacing.md },
      android: { textAlignVertical: 'center' as const },
    }),
  },
  sendButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
});
