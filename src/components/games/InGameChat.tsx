/**
 * InGameChat — Minimal in-game chat bar for multiplayer
 *
 * Shows last message + quick reactions. Tap to expand to full chat.
 * Uses PanelAwareModal for expanded view.
 *
 * @see Prompt_1_Games_Foundation.md §5.5
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, borderRadius, touchTargets, typography } from '@/theme';
import { HapticTouchable, Icon, ScrollViewWithIndicator } from '@/components';
import { PanelAwareModal } from '@/components/PanelAwareModal';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import type { GameType } from '@/types/games';
import type { ModuleColorId } from '@/types/liquidGlass';

// ============================================================
// Types
// ============================================================

export interface GameChatMessage {
  /** Unique message ID */
  id: string;
  /** Sender JID */
  senderJid: string;
  /** Sender display name */
  senderName: string;
  /** Message text (or emoji) */
  text: string;
  /** Unix timestamp */
  timestamp: number;
}

export interface PlayerInfo {
  /** Player JID */
  jid: string;
  /** Display name */
  name: string;
}

export interface InGameChatProps {
  /** Game session ID */
  gameId: string;
  /** Game type */
  gameType: GameType;
  /** Players in the game */
  players: PlayerInfo[];
  /** Chat messages */
  messages: GameChatMessage[];
  /** Send a message */
  onSendMessage: (text: string) => void;
  /** Module identifier for accent color */
  moduleId: ModuleColorId;
}

// ============================================================
// Quick reaction emojis
// ============================================================

const QUICK_REACTIONS = ['👍', '👏', '😄', '🤔'];

// ============================================================
// Component
// ============================================================

export function InGameChat({
  gameId: _gameId,
  gameType: _gameType,
  players: _players,
  messages,
  onSendMessage,
  moduleId,
}: InGameChatProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor(moduleId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (trimmed) {
      onSendMessage(trimmed);
      setInputText('');
    }
  }, [inputText, onSendMessage]);

  const handleReaction = useCallback(
    (emoji: string) => {
      onSendMessage(emoji);
    },
    [onSendMessage],
  );

  return (
    <>
      {/* Compact bar */}
      <HapticTouchable
        onPress={() => setIsExpanded(true)}
        accessibilityRole="button"
        accessibilityLabel={t('games.multiplayer.openChat')}
        style={[styles.compactBar, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
      >
        <Icon name="chat" size={20} color={moduleColor} />
        <Text
          style={[styles.lastMessage, { color: themeColors.textSecondary }]}
          numberOfLines={1}
        >
          {lastMessage
            ? `${lastMessage.senderName}: ${lastMessage.text}`
            : t('games.multiplayer.chatHint')}
        </Text>
        <Icon name="chevron-up" size={16} color={themeColors.textTertiary} />
      </HapticTouchable>

      {/* Expanded chat modal */}
      <PanelAwareModal
        visible={isExpanded}
        onRequestClose={() => setIsExpanded(false)}
        animationType="slide"
        moduleId={moduleId}
      >
        <LiquidGlassView moduleId={moduleId} cornerRadius={0}>
          <KeyboardAvoidingView
            style={[styles.expandedContainer, { backgroundColor: themeColors.surface }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Header */}
            <View style={styles.expandedHeader}>
              <Text style={[styles.expandedTitle, { color: themeColors.textPrimary }]}>
                Chat
              </Text>
              <HapticTouchable
                onPress={() => setIsExpanded(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                style={styles.closeButton}
              >
                <Icon name="chevron-down" size={24} color={themeColors.textSecondary} />
              </HapticTouchable>
            </View>

            {/* Messages */}
            <ScrollViewWithIndicator style={styles.messageList}>
              {messages.map((msg) => (
                <View key={msg.id} style={styles.messageRow}>
                  <Text style={[styles.messageSender, { color: moduleColor }]}>
                    {msg.senderName}
                  </Text>
                  <Text style={[styles.messageText, { color: themeColors.textPrimary }]}>
                    {msg.text}
                  </Text>
                </View>
              ))}
            </ScrollViewWithIndicator>

            {/* Quick reactions */}
            <View style={styles.reactionsRow}>
              {QUICK_REACTIONS.map((emoji) => (
                <HapticTouchable
                  key={emoji}
                  onPress={() => handleReaction(emoji)}
                  accessibilityRole="button"
                  accessibilityLabel={emoji}
                  style={[styles.reactionButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </HapticTouchable>
              ))}
            </View>

            {/* Text input */}
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: themeColors.textPrimary,
                    backgroundColor: themeColors.background,
                    borderColor: themeColors.border,
                  },
                ]}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                placeholder={t('games.multiplayer.chatPlaceholder')}
                placeholderTextColor={themeColors.textTertiary}
              />
              <HapticTouchable
                hapticType="success"
                onPress={handleSend}
                disabled={!inputText.trim()}
                accessibilityRole="button"
                accessibilityLabel={t('common.send')}
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: inputText.trim() ? moduleColor : themeColors.border,
                  },
                ]}
              >
                <Icon name="navigate" size={20} color="#FFFFFF" />
              </HapticTouchable>
            </View>
          </KeyboardAvoidingView>
        </LiquidGlassView>
      </PanelAwareModal>
    </>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  // Compact bar
  compactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  lastMessage: {
    ...typography.label,
    flex: 1,
  },

  // Expanded modal
  expandedContainer: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  expandedTitle: {
    ...typography.h3,
  },
  closeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  messageRow: {
    marginBottom: spacing.md,
  },
  messageSender: {
    ...typography.label,
    fontWeight: '600',
    marginBottom: 2,
  },
  messageText: {
    ...typography.body,
  },

  // Quick reactions
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  reactionButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: 24,
  },

  // Text input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  textInput: {
    ...typography.body,
    flex: 1,
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  sendButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
