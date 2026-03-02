/**
 * AskAIChatBubble — Chat message bubble (user or AI)
 *
 * WhatsApp-style message direction:
 * - User messages: right-aligned with accent color
 * - AI messages: left-aligned with surface color and robot indicator
 *
 * @see .claude/plans/VRAAG_HET_AI_MODULE.md
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import {
  colors,
  typography,
  spacing,
  borderRadius,
} from '@/theme';
import type { AskAIMessage } from '@/types/askAI';

interface AskAIChatBubbleProps {
  message: AskAIMessage;
  moduleColor: string;
}

export function AskAIChatBubble({ message, moduleColor }: AskAIChatBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.containerUser : styles.containerAI,
      ]}
      accessibilityRole="text"
      accessibilityLabel={message.content}
    >
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: moduleColor }]
            : styles.bubbleAI,
        ]}
      >
        <Text
          style={[
            styles.text,
            isUser ? styles.textUser : styles.textAI,
          ]}
          selectable
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  containerUser: {
    alignItems: 'flex-end',
  },
  containerAI: {
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  bubbleUser: {
    maxWidth: '80%',
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    maxWidth: '85%',
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  text: {
    ...typography.body,
    lineHeight: 26,
  },
  textUser: {
    color: '#FFFFFF',
  },
  textAI: {
    color: colors.textPrimary,
  },
});
