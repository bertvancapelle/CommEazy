/**
 * ChatListScreen — List of all 1-on-1 conversations
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - 18pt body text
 * - Clear visual hierarchy
 * - VoiceOver support
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  AccessibilityInfo,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Button, PresenceIndicator, LoadingView, VoiceFocusable, Icon, ModuleHeader } from '@/components';
import { useVoiceFocusList } from '@/contexts/VoiceFocusContext';
import { useColors } from '@/contexts/ThemeContext';
import { useFeedback } from '@/hooks/useFeedback';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useNavigateToModule } from '@/hooks/useNavigateToModule';
import type { ChatStackParams } from '@/navigation';
import { ServiceContainer } from '@/services/container';
import { chatService } from '@/services/chat';
import type { PresenceShow, DeliveryStatus } from '@/services/interfaces';

// ChatListItem type for this screen
interface ChatListItem {
  chatId: string;
  contactJid: string;
  contactName: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  presenceShow: PresenceShow;
  lastMessageIsFromMe: boolean;  // true = I sent last message, false = they sent it
  lastMessageStatus?: DeliveryStatus;  // Only relevant when lastMessageIsFromMe = true
}

type NavigationProp = NativeStackNavigationProp<ChatStackParams, 'ChatList'>;

export function ChatListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { triggerFeedback } = useFeedback();
  const { accentColor } = useAccentColor();
  const themeColors = useColors();
  const isFocused = useIsFocused();
  const { navigateToModuleInOtherPane } = useNavigateToModule();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Voice Focus: Register list items for voice navigation
  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return []; // Only register when screen is focused
    return chats.map((chat, index) => ({
      id: chat.chatId,
      label: chat.contactName, // Human-readable name for voice matching
      index,
      onSelect: () => handleChatPress(chat),
    }));
  }, [chats, isFocused]);

  const { scrollRef, isFocused: isItemFocused, getFocusStyle } = useVoiceFocusList(
    'chat-list',
    voiceFocusItems
  );

  // Load chats - delayed to ensure native modules are ready
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const loadChats = async () => {
      // Small delay to ensure all native modules are initialized
      await new Promise(resolve => setTimeout(resolve, 50));
      if (cancelled) return;

      try {
        // Try to use real service if fully initialized (ServiceContainer + ChatService)
        if (ServiceContainer.isInitialized && chatService.isInitialized) {
          // Subscribe to real-time chat list updates
          const observable = chatService.observeChatList();
          const myJid = chatService.getMyJid();
          unsubscribe = observable.subscribe(chatList => {
            if (!cancelled) {
              const items: ChatListItem[] = chatList.map(chat => {
                const lastMsg = chat.lastMessage;
                const isFromMe = lastMsg ? lastMsg.senderId === myJid : false;
                return {
                  chatId: chat.chatId,
                  contactJid: chat.contact.jid,
                  contactName: chat.contact.name,
                  lastMessage: lastMsg?.content ?? '',
                  lastMessageTime: lastMsg?.timestamp ?? 0,
                  unreadCount: chat.unreadCount,
                  presenceShow: chatService.getContactPresence(chat.contact.jid),
                  lastMessageIsFromMe: isFromMe,
                  lastMessageStatus: isFromMe ? lastMsg?.status : undefined,
                };
              });
              setChats(items);
              setLoading(false);
            }
          });
        } else if (__DEV__) {
          // Fallback to mock data in dev mode if service not ready
          const { getMockChatList, getMockContactPresence, MOCK_CURRENT_USER } = await import('@/services/mock');
          const mockChats = await getMockChatList();
          const chatList: ChatListItem[] = mockChats
            .filter(chat => chat.lastMessage) // Only show chats with messages
            .map(chat => {
              const lastMsg = chat.lastMessage;
              const isFromMe = lastMsg ? lastMsg.senderId === MOCK_CURRENT_USER.jid : false;
              return {
                chatId: chat.chatId,
                contactJid: chat.contact.jid,
                contactName: chat.contact.name,
                lastMessage: lastMsg?.content ?? '',
                lastMessageTime: lastMsg?.timestamp ?? 0,
                unreadCount: chat.unreadCount,
                presenceShow: getMockContactPresence(chat.contact),
                lastMessageIsFromMe: isFromMe,
                lastMessageStatus: isFromMe ? lastMsg?.status : undefined,
              };
            });
          if (!cancelled) setChats(chatList);
          if (!cancelled) setLoading(false);
        } else {
          if (!cancelled) setChats([]);
          if (!cancelled) setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load chats:', error);
        // Fallback to mock data on error in dev mode
        if (__DEV__ && !cancelled) {
          try {
            const { getMockChatList, getMockContactPresence, MOCK_CURRENT_USER } = await import('@/services/mock');
            const mockChats = await getMockChatList();
            const chatList: ChatListItem[] = mockChats
              .filter(chat => chat.lastMessage)
              .map(chat => {
                const lastMsg = chat.lastMessage;
                const isFromMe = lastMsg ? lastMsg.senderId === MOCK_CURRENT_USER.jid : false;
                return {
                  chatId: chat.chatId,
                  contactJid: chat.contact.jid,
                  contactName: chat.contact.name,
                  lastMessage: lastMsg?.content ?? '',
                  lastMessageTime: lastMsg?.timestamp ?? 0,
                  unreadCount: chat.unreadCount,
                  presenceShow: getMockContactPresence(chat.contact),
                  lastMessageIsFromMe: isFromMe,
                  lastMessageStatus: isFromMe ? lastMsg?.status : undefined,
                };
              });
            setChats(chatList);
          } catch {
            setChats([]);
          }
        } else if (!cancelled) {
          setChats([]);
        }
        if (!cancelled) setLoading(false);
      }
    };

    void loadChats();
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Subscribe to presence changes for real-time status updates
  useEffect(() => {
    if (!ServiceContainer.isInitialized || !chatService.isInitialized) return;

    const unsubscribe = chatService.onPresenceChange((jid, presenceShow) => {
      setChats(prevChats =>
        prevChats.map(chat =>
          chat.contactJid === jid ? { ...chat, presenceShow } : chat,
        ),
      );
    });

    return unsubscribe;
  }, []);

  // Refresh chat list when screen gains focus (e.g., after returning from chat)
  // This ensures unread counts are updated after marking messages as read
  useFocusEffect(
    useCallback(() => {
      if (ServiceContainer.isInitialized && chatService.isInitialized) {
        void refreshChatsInternal();
      }
    }, []),
  );

  const refreshChatsInternal = async () => {
    try {
      if (ServiceContainer.isInitialized && chatService.isInitialized) {
        const chatList = await chatService.getChatList();
        const myJid = chatService.getMyJid();
        const items: ChatListItem[] = chatList.map(chat => {
          const lastMsg = chat.lastMessage;
          const isFromMe = lastMsg ? lastMsg.senderId === myJid : false;
          return {
            chatId: chat.chatId,
            contactJid: chat.contact.jid,
            contactName: chat.contact.name,
            lastMessage: lastMsg?.content ?? '',
            lastMessageTime: lastMsg?.timestamp ?? 0,
            unreadCount: chat.unreadCount,
            presenceShow: chatService.getContactPresence(chat.contact.jid),
            lastMessageIsFromMe: isFromMe,
            lastMessageStatus: isFromMe ? lastMsg?.status : undefined,
          };
        });
        setChats(items);
      }
    } catch (error) {
      console.error('Failed to refresh chats on focus:', error);
    }
  };

  const refreshChats = useCallback(async () => {
    try {
      // Try to use real service if fully initialized
      if (ServiceContainer.isInitialized && chatService.isInitialized) {
        const chatList = await chatService.getChatList();
        const myJid = chatService.getMyJid();
        const items: ChatListItem[] = chatList.map(chat => {
          const lastMsg = chat.lastMessage;
          const isFromMe = lastMsg ? lastMsg.senderId === myJid : false;
          return {
            chatId: chat.chatId,
            contactJid: chat.contact.jid,
            contactName: chat.contact.name,
            lastMessage: lastMsg?.content ?? '',
            lastMessageTime: lastMsg?.timestamp ?? 0,
            unreadCount: chat.unreadCount,
            presenceShow: chatService.getContactPresence(chat.contact.jid),
            lastMessageIsFromMe: isFromMe,
            lastMessageStatus: isFromMe ? lastMsg?.status : undefined,
          };
        });
        setChats(items);
      } else if (__DEV__) {
        const { getMockChatList, getMockContactPresence, MOCK_CURRENT_USER } = await import('@/services/mock');
        const mockChats = await getMockChatList();
        const chatList: ChatListItem[] = mockChats
          .filter(chat => chat.lastMessage)
          .map(chat => {
            const lastMsg = chat.lastMessage;
            const isFromMe = lastMsg ? lastMsg.senderId === MOCK_CURRENT_USER.jid : false;
            return {
              chatId: chat.chatId,
              contactJid: chat.contact.jid,
              contactName: chat.contact.name,
              lastMessage: lastMsg?.content ?? '',
              lastMessageTime: lastMsg?.timestamp ?? 0,
              unreadCount: chat.unreadCount,
              presenceShow: getMockContactPresence(chat.contact),
              lastMessageIsFromMe: isFromMe,
              lastMessageStatus: isFromMe ? lastMsg?.status : undefined,
            };
          });
        setChats(chatList);
      } else {
        setChats([]);
      }
    } catch (error) {
      console.error('Failed to refresh chats:', error);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshChats();
    setRefreshing(false);
  }, [refreshChats]);

  const handleChatPress = useCallback(
    (item: ChatListItem) => {
      void triggerFeedback('tap');
      navigation.navigate('ChatDetail', {
        chatId: item.chatId,
        name: item.contactName,
      });
    },
    [navigation, triggerFeedback],
  );

  const handleNewChat = useCallback(() => {
    void triggerFeedback('tap');

    // Unified: navigate other pane to contacts
    // iPad: opens contacts in the other panel, iPhone: switches 'main' pane
    navigateToModuleInOtherPane('contacts');
    AccessibilityInfo.announceForAccessibility(t('chat.newChat'));
  }, [t, triggerFeedback, navigateToModuleInOtherPane]);

  const formatTime = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return t('chat.yesterday');
    }

    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }, [t]);

  // Helper to get status icon for outgoing messages (WhatsApp style)
  const getStatusIcon = useCallback((status?: DeliveryStatus): { name: 'time' | 'check' | 'check-all' | 'alert'; color: string } | null => {
    switch (status) {
      case 'pending':
        return { name: 'time', color: themeColors.textTertiary };  // Clock icon
      case 'sent':
        return { name: 'check', color: accentColor.primary };  // Single check in accent
      case 'delivered':
        return { name: 'check-all', color: accentColor.primary };  // Double check in accent
      case 'failed':
        return { name: 'alert', color: themeColors.error };  // Alert triangle
      default:
        return null;
    }
  }, [accentColor.primary, themeColors]);

  const renderChatItem = useCallback(
    ({ item, index }: { item: ChatListItem; index: number }): React.ReactElement => {
      const focused = isItemFocused(item.chatId);
      const focusStyle = focused ? getFocusStyle() : undefined;

      // Message direction styling
      const isFromMe = item.lastMessageIsFromMe;
      const hasUnread = item.unreadCount > 0;
      const statusIcon = isFromMe ? getStatusIcon(item.lastMessageStatus) : null;

      return (
        <VoiceFocusable
          id={item.chatId}
          label={item.contactName}
          index={index}
          onSelect={() => handleChatPress(item)}
        >
          <TouchableOpacity
            style={[
              styles.chatItem,
              { backgroundColor: themeColors.surface, borderBottomColor: themeColors.divider },
              // No accent background on row - only message text gets accent color
              focused && {
                borderColor: focusStyle?.borderColor,
                borderWidth: focusStyle?.borderWidth,
                backgroundColor: focusStyle?.backgroundColor,
              },
            ]}
            onPress={() => handleChatPress(item)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.messageFrom', {
              name: item.contactName,
              time: formatTime(item.lastMessageTime),
            })}
            accessibilityHint={t('chat.openConversation')}
          >
            {/* Large status indicator - senior-friendly, configurable colors */}
            <View style={styles.presenceWrapper}>
              <PresenceIndicator
                show={item.presenceShow}
                size={56}
              />
            </View>

            {/* Content */}
            <View style={styles.chatContent}>
              <View style={styles.chatHeader}>
                <Text
                  style={[
                    styles.contactName,
                    { color: themeColors.textPrimary },
                    // Bold for unread incoming messages
                    hasUnread && !isFromMe && { fontWeight: '800' },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.contactName}
                </Text>
                <Text style={[styles.timestamp, { color: themeColors.textTertiary }]}>{formatTime(item.lastMessageTime)}</Text>
              </View>

              {/* Show up to 2 lines of the last message with status indicator */}
              {item.lastMessage ? (
                <View
                  style={[
                    styles.lastMessageRow,
                    // Light accent background for outgoing messages (WhatsApp style)
                    isFromMe && { backgroundColor: accentColor.light, borderRadius: 6 },
                  ]}
                >
                  {/* Status icon for outgoing messages */}
                  {statusIcon && (
                    <View style={styles.statusIconWrapper}>
                      <Icon
                        name={statusIcon.name}
                        size={16}
                        color={statusIcon.color}
                      />
                    </View>
                  )}
                  <Text
                    style={[
                      styles.lastMessage,
                      { color: themeColors.textSecondary },
                      // Bold for unread incoming messages
                      hasUnread && !isFromMe && { fontWeight: '700', color: themeColors.textPrimary },
                    ]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {item.lastMessage}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Unread badge - only show for incoming messages */}
            {hasUnread && !isFromMe && (
              <View style={[styles.unreadBadge, { backgroundColor: accentColor.primary }]}>
                <Text style={[styles.unreadCount, { color: themeColors.textOnPrimary }]}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </VoiceFocusable>
      );
    },
    [handleChatPress, formatTime, t, isItemFocused, getFocusStyle, accentColor, getStatusIcon, themeColors],
  );

  const keyExtractor = useCallback((item: ChatListItem) => item.chatId, []);

  const renderEmptyList = useCallback(
    () => {
      // Debug info for dev mode
      const windowDims = Dimensions.get('window');
      const screenDims = Dimensions.get('screen');
      const myJid = chatService.isInitialized ? chatService.getMyJid() : 'not initialized';

      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>{t('chat.noChats')}</Text>
          <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>{t('chat.noChatsHint')}</Text>
          <Button
            title={t('chat.startChat')}
            onPress={handleNewChat}
            style={styles.startChatButton}
          />
          {/* DEV DEBUG INFO */}
          {__DEV__ && (
            <View style={[styles.debugContainer, { backgroundColor: themeColors.backgroundSecondary }]}>
              <Text style={styles.debugText}>User: {myJid}</Text>
              <Text style={styles.debugText}>Window: {windowDims.width}x{windowDims.height}</Text>
              <Text style={styles.debugText}>Screen: {screenDims.width}x{screenDims.height}</Text>
              <Text style={styles.debugText}>Size: {Math.round(windowDims.width * windowDims.height)}</Text>
            </View>
          )}
        </View>
      );
    },
    [t, handleNewChat, themeColors],
  );

  if (loading) {
    return <LoadingView fullscreen message={t('common.loading')} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Module Header — standardized component */}
      <ModuleHeader
        moduleId="messages"
        icon="chat"
        title={t('tabs.chats')}
        showAdMob={true}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={chats.length === 0 ? styles.emptyListContent : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={themeColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        accessibilityLabel={t('accessibility.unreadMessages', { count: chats.length })}
      >
        {chats.length === 0 ? (
          renderEmptyList()
        ) : (
          chats.map((item, index) => (
            <View key={keyExtractor(item)}>
              {renderChatItem({ item, index })}
            </View>
          ))
        )}
      </ScrollView>

      {/* Floating action button for new chat */}
      {chats.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: themeColors.primary }]}
          onPress={handleNewChat}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('chat.newChat')}
        >
          <Text style={[styles.fabIcon, { color: themeColors.textOnPrimary }]}>+</Text>
        </TouchableOpacity>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  presenceWrapper: {
    marginRight: spacing.md,
  },
  chatContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  contactName: {
    ...typography.h3,  // Larger, bolder text for senior readability
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  timestamp: {
    ...typography.small,
    color: colors.textTertiary,
  },
  lastMessage: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  statusIconWrapper: {
    marginRight: spacing.xs,
    marginTop: 3, // Align with text baseline
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  unreadCount: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 24, // Match badge height for perfect vertical centering
    textAlign: 'center',
    includeFontPadding: false, // Android: remove extra padding
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  startChatButton: {
    minWidth: 200,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    width: touchTargets.large,
    height: touchTargets.large,
    borderRadius: touchTargets.large / 2,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabIcon: {
    fontSize: 32,
    color: colors.textOnPrimary,
    fontWeight: '300',
  },
  debugContainer: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  debugText: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: '#666',
  },
});
