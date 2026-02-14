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
  ScrollView,
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
import { MessageStatus } from '@/components';
import type { Message, DeliveryStatus } from '@/services/interfaces';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import type { ChatStackParams } from '@/navigation';
import { ServiceContainer } from '@/services/container';
import { chatService } from '@/services/chat';

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
  const scrollViewRef = useRef<ScrollView>(null);

  // Set header title
  useEffect(() => {
    navigation.setOptions({ title: name });
  }, [navigation, name]);

  // Mark all messages as read when entering the chat
  useEffect(() => {
    const markAsRead = async () => {
      if (ServiceContainer.isInitialized && chatService.isInitialized) {
        await chatService.markChatAsRead(chatId);
      }
    };
    void markAsRead();
  }, [chatId]);

  // Load and observe messages
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const loadMessages = async () => {
      // Small delay to ensure native modules are initialized
      await new Promise(resolve => setTimeout(resolve, 50));
      if (cancelled) return;

      try {
        // Try to use real service if initialized
        if (ServiceContainer.isInitialized) {
          // Subscribe to real-time message updates
          const observable = chatService.observeMessages(chatId, MESSAGE_LIMIT);
          unsubscribe = observable.subscribe(msgs => {
            if (!cancelled) setMessages(msgs);
          });
        } else if (__DEV__) {
          // Fallback to mock data in dev mode if service not ready
          const { getMockMessages } = await import('@/services/mock');
          const mockMsgs = getMockMessages(chatId, MESSAGE_LIMIT);
          if (!cancelled) setMessages(mockMsgs);
        } else {
          if (!cancelled) setMessages([]);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
        // Fallback to mock data on error in dev mode
        if (__DEV__ && !cancelled) {
          try {
            const { getMockMessages } = await import('@/services/mock');
            const mockMsgs = getMockMessages(chatId, MESSAGE_LIMIT);
            setMessages(mockMsgs);
          } catch {
            setMessages([]);
          }
        } else if (!cancelled) {
          setMessages([]);
        }
      }
    };

    void loadMessages();
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [chatId]);

  // Subscribe to message status changes (pending → sent → delivered)
  useEffect(() => {
    if (!ServiceContainer.isInitialized || !chatService.isInitialized) return;

    const unsubscribe = chatService.onMessageStatusChange((messageId, status) => {
      console.log(`[ChatScreen] Status change: ${messageId} -> ${status}`);
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === messageId ? { ...msg, status } : msg,
        ),
      );
    });

    return unsubscribe;
  }, []);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    // Haptic feedback on send
    ReactNativeHapticFeedback.trigger('impactMedium', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });

    setSending(true);
    setInputText('');

    try {
      // Try to use real service if fully initialized
      if (ServiceContainer.isInitialized && chatService.isInitialized) {
        // Extract contactJid from chatId (format: "chat:jid1:jid2")
        // JIDs are sorted, so we need to find the one that's NOT the current user
        const parts = chatId.split(':');
        const myJid = chatService.getMyJid()!;
        const contactJid = parts[1] === myJid ? parts[2] : parts[1];
        await chatService.sendMessage(contactJid, text);
        AccessibilityInfo.announceForAccessibility(t('chat.sending'));
      } else if (__DEV__) {
        // Fallback: add message locally in dev mode
        // Use mock current user from dev constants
        const { MOCK_CURRENT_USER } = await import('@/services/mock');
        const newMessage: Message = {
          id: `local_${Date.now()}`,
          chatId,
          senderId: MOCK_CURRENT_USER.jid,
          senderName: MOCK_CURRENT_USER.name,
          content: text,
          contentType: 'text',
          timestamp: Date.now(),
          status: 'sent',
        };
        setMessages(prev => [newMessage, ...prev]);
        AccessibilityInfo.announceForAccessibility(t('chat.sending'));
      }
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

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      // Determine if message is from current user
      // Check against chatService JID or fallback to name comparison
      const myJid = chatService.getMyJid();
      const isOwn = myJid
        ? item.senderId === myJid
        : item.senderName === 'Ik'; // Fallback for dev mode without service

      // Determine bubble style based on delivery status
      const isPending = item.status === 'pending';
      const isFailed = item.status === 'failed' || item.status === 'expired';

      // Get the appropriate bubble style for own messages
      const getOwnBubbleStyle = () => {
        if (isFailed) return styles.failedMessage;
        if (isPending) return styles.pendingMessage;
        return styles.ownMessage;
      };

      return (
        <View
          style={[
            styles.messageBubble,
            isOwn ? getOwnBubbleStyle() : styles.otherMessage,
          ]}
          accessible={true}
          accessibilityLabel={t('accessibility.messageFrom', {
            name: isOwn ? t('group.you') : item.senderName,
            time: formatTime(item.timestamp),
          }) + `. ${item.content}`}
          accessibilityHint={
            isOwn
              ? t('accessibility.deliveryStatus', { status: t(`status.${item.status}`) })
              : undefined
          }
        >
          <Text
            style={[
              styles.messageText,
              isOwn && !isPending && !isFailed && styles.ownMessageText,
              isPending && styles.pendingMessageText,
              isFailed && styles.failedMessageText,
            ]}
            selectable
          >
            {item.content}
          </Text>

          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                isOwn && !isPending && !isFailed && styles.ownMessageTime,
                isPending && styles.pendingMessageTime,
                isFailed && styles.failedMessageTime,
              ]}
            >
              {formatTime(item.timestamp)}
            </Text>
            {isOwn && (
              <MessageStatus status={item.status} />
            )}
          </View>
        </View>
      );
    },
    [t, formatTime],
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Messages list - sorted oldest to newest, auto-scroll to bottom */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        accessibilityLabel={t('chat.messageList', { count: messages.length })}
        onContentSizeChange={() => {
          // Auto-scroll to bottom when new messages arrive
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }}
      >
        {/* Sort messages by timestamp ascending (oldest first, newest at bottom) */}
        {[...messages].sort((a, b) => a.timestamp - b.timestamp).map((item) => (
          <View key={keyExtractor(item)}>
            {renderMessage({ item, index: 0, separators: {} as any })}
          </View>
        ))}
      </ScrollView>

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
  pendingMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.warning,
    borderBottomRightRadius: borderRadius.sm,
  },
  failedMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.error,
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
  pendingMessageText: {
    color: colors.textOnPrimary,
  },
  failedMessageText: {
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
  pendingMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  failedMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
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
