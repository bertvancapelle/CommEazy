/**
 * ChatScreen — 1-on-1 Chat Conversation
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets for send button
 * - 18pt body text in messages
 * - Clear message bubbles with high contrast
 * - VoiceOver support with message context
 * - Inverted FlatList (newest at bottom)
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/react-native-expert/SKILL.md
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  colors,
  typography,
  spacing,
  touchTargets,
  borderRadius,
} from '@/theme';
import { chatService } from '@/services/chat';
import type { Message, DeliveryStatus, Unsubscribe } from '@/services/interfaces';
import type { ChatStackParams } from '@/navigation';

type ChatScreenRouteProp = RouteProp<ChatStackParams, 'ChatDetail'>;
type ChatScreenNavigationProp = NativeStackNavigationProp<ChatStackParams, 'ChatDetail'>;

const MESSAGE_LIMIT = 50;

export function ChatScreen() {
  const { t } = useTranslation();
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const { chatId, name } = route.params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Set header title
  useEffect(() => {
    navigation.setOptions({ title: name });
  }, [navigation, name]);

  // Subscribe to messages
  useEffect(() => {
    const observable = chatService.observeMessages(chatId, MESSAGE_LIMIT);
    const unsubscribe = observable.subscribe(msgs => {
      setMessages(msgs);
    });

    // Also listen for new incoming messages
    const msgUnsubscribe = chatService.onMessage(msg => {
      if (msg.chatId === chatId) {
        AccessibilityInfo.announceForAccessibility(
          t('accessibility.messageFrom', { name: msg.senderName, time: '' }),
        );
      }
    });

    return () => {
      unsubscribe();
      msgUnsubscribe();
    };
  }, [chatId, t]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText('');

    try {
      // Extract contactJid from chatId (format: "chat:jid1:jid2")
      const parts = chatId.split(':');
      const contactJid = parts[1] || parts[2]; // Get the other JID

      await chatService.sendMessage(contactJid, text);
      AccessibilityInfo.announceForAccessibility(t('chat.sending'));
    } catch (error) {
      console.error('Failed to send message:', error);
      setInputText(text); // Restore text on failure
      AccessibilityInfo.announceForAccessibility(t('chat.failed'));
    } finally {
      setSending(false);
    }
  }, [inputText, sending, chatId, t]);

  const formatTime = useCallback((timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const getStatusText = useCallback(
    (status: DeliveryStatus): string => {
      switch (status) {
        case 'pending':
          return t('chat.sending');
        case 'sent':
          return '✓';
        case 'delivered':
          return '✓✓';
        case 'failed':
          return t('chat.failed');
        case 'expired':
          return t('chat.expired');
        default:
          return '';
      }
    },
    [t],
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      // Determine if message is from current user
      // In a real app, compare with myJid from chatService
      const isOwn = item.senderId !== route.params.chatId.split(':')[1];

      return (
        <View
          style={[
            styles.messageBubble,
            isOwn ? styles.ownMessage : styles.otherMessage,
          ]}
          accessible={true}
          accessibilityLabel={t('accessibility.messageFrom', {
            name: isOwn ? t('group.you') : item.senderName,
            time: formatTime(item.timestamp),
          }) + `. ${item.content}`}
          accessibilityHint={
            isOwn
              ? t('accessibility.deliveryStatus', { status: getStatusText(item.status) })
              : undefined
          }
        >
          <Text
            style={[styles.messageText, isOwn && styles.ownMessageText]}
            selectable
          >
            {item.content}
          </Text>

          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isOwn && styles.ownMessageTime]}>
              {formatTime(item.timestamp)}
            </Text>
            {isOwn && (
              <Text
                style={[
                  styles.messageStatus,
                  item.status === 'delivered' && styles.statusDelivered,
                  item.status === 'failed' && styles.statusFailed,
                ]}
              >
                {getStatusText(item.status)}
              </Text>
            )}
          </View>
        </View>
      );
    },
    [t, formatTime, getStatusText, route.params.chatId],
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Messages list - inverted so newest at bottom */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        inverted
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={21}
        removeClippedSubviews={Platform.OS === 'android'}
        accessibilityLabel={t('chat.messageList', { count: messages.length })}
      />

      {/* Input area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder={t('chat.typeMessage')}
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={2000}
          accessibilityLabel={t('chat.typeMessage')}
          returnKeyType="default"
          blurOnSubmit={false}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() || sending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.sendButton')}
          accessibilityState={{ disabled: !inputText.trim() || sending }}
        >
          <Text style={styles.sendButtonText}>
            {sending ? '...' : '→'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  messageList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: borderRadius.sm,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderBottomLeftRadius: borderRadius.sm,
  },
  messageText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  ownMessageText: {
    color: colors.textOnPrimary,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  messageTime: {
    ...typography.small,
    color: colors.textTertiary,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageStatus: {
    ...typography.small,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusDelivered: {
    color: colors.textOnPrimary,
  },
  statusFailed: {
    color: colors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  textInput: {
    flex: 1,
    minHeight: touchTargets.minimum,
    maxHeight: 120,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.input,
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  sendButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: touchTargets.minimum / 2,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  sendButtonText: {
    fontSize: 24,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
});
