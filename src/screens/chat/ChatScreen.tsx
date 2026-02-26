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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  DeviceEventEmitter,
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
import { useColors } from '@/contexts/ThemeContext';
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
  const themeColors = useColors();
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
    console.info('[ChatScreen] handleSend called, text length:', text.length, 'sending:', sending);
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
      const serviceReady = ServiceContainer.isInitialized && chatService.isInitialized;
      console.info('[ChatScreen] ServiceContainer.isInitialized:', ServiceContainer.isInitialized, 'chatService.isInitialized:', chatService.isInitialized);
      if (serviceReady) {
        // Extract contactJid from chatId (format: "chat:jid1:jid2")
        // JIDs are sorted, so we need to find the one that's NOT the current user
        const parts = chatId.split(':');
        const myJid = chatService.getMyJid()!;
        const contactJid = parts[1] === myJid ? parts[2] : parts[1];
        console.info('[ChatScreen] Sending to:', contactJid, 'from chatId:', chatId);
        const result = await chatService.sendMessage(contactJid, text);
        console.info('[ChatScreen] sendMessage result:', result);
        AccessibilityInfo.announceForAccessibility(t('chat.sending'));
      } else if (__DEV__) {
        console.info('[ChatScreen] Using dev fallback (service not ready)');
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
      console.error('[ChatScreen] Failed to send message:', error);
      setInputText(text); // Restore text on failure
      AccessibilityInfo.announceForAccessibility(t('chat.failed'));
    } finally {
      setSending(false);
    }
  }, [inputText, sending, chatId, t]);

  // Refs for voice command listener to avoid re-subscribing on every keystroke
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;

  // Listen for voice command to send message
  // When user says "stuur" or "verzend", this triggers handleSend
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('voiceCommand:send', () => {
      console.log('[ChatScreen] Voice command: send');
      // Only send if there's text to send
      if (inputTextRef.current.trim()) {
        handleSendRef.current();
      } else {
        // Announce that there's nothing to send
        AccessibilityInfo.announceForAccessibility(t('chat.nothingToSend'));
      }
    });

    return () => subscription.remove();
  }, [t]);

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
        if (isFailed) return { backgroundColor: themeColors.error };
        if (isPending) return { backgroundColor: themeColors.warning };
        return { backgroundColor: themeColors.primary };
      };

      return (
        <View
          style={[
            styles.messageBubble,
            isOwn
              ? [styles.ownMessage, getOwnBubbleStyle()]
              : [styles.otherMessage, { backgroundColor: themeColors.surface }],
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
              { color: themeColors.textPrimary },
              isOwn && { color: themeColors.textOnPrimary },
            ]}
            selectable
          >
            {item.content}
          </Text>

          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                { color: themeColors.textTertiary },
                isOwn && { color: 'rgba(255, 255, 255, 0.7)' },
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
    [t, formatTime, themeColors],
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  // Memoize sorted messages to avoid re-sorting on every render
  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.timestamp - b.timestamp),
    [messages],
  );

  // Debounced scroll to bottom — prevents jank during keyboard animation
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleContentSizeChange = useCallback(() => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, []);

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Messages list - sorted oldest to newest, auto-scroll to bottom */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        accessibilityLabel={t('chat.messageList', { count: messages.length })}
        onContentSizeChange={handleContentSizeChange}
      >
        {sortedMessages.map((item) => (
          <View key={keyExtractor(item)}>
            {renderMessage({ item, index: 0, separators: {} as any })}
          </View>
        ))}
      </ScrollView>

      {/* Input area */}
      <View style={[styles.inputContainer, { backgroundColor: themeColors.surface, borderTopColor: themeColors.divider }]}>
        <TextInput
          style={[styles.textInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.textPrimary }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={t('chat.typeMessage')}
          placeholderTextColor={themeColors.textTertiary}
          multiline
          maxLength={2000}
          accessibilityLabel={t('chat.typeMessage')}
          returnKeyType="default"
          blurOnSubmit={false}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: themeColors.primary },
            (!inputText.trim() || sending) && { backgroundColor: themeColors.disabled },
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.sendButton')}
          accessibilityState={{ disabled: !inputText.trim() || sending }}
        >
          <Text style={[styles.sendButtonText, { color: themeColors.textOnPrimary }]}>
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
    borderBottomRightRadius: borderRadius.sm,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: borderRadius.sm,
  },
  messageText: {
    ...typography.body,
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
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    minHeight: touchTargets.minimum,
    maxHeight: 120,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.input,
    marginRight: spacing.sm,
  },
  sendButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: touchTargets.minimum / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
});
