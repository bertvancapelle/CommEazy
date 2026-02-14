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

import React, { useCallback, useEffect, useState } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets } from '@/theme';
import { Button, PresenceIndicator, LoadingView } from '@/components';
import type { ChatStackParams } from '@/navigation';
import { ServiceContainer } from '@/services/container';
import { chatService } from '@/services/chat';
import type { PresenceShow } from '@/services/interfaces';

// ChatListItem type for this screen
interface ChatListItem {
  chatId: string;
  contactJid: string;
  contactName: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  presenceShow: PresenceShow;
}

type NavigationProp = NativeStackNavigationProp<ChatStackParams, 'ChatList'>;

export function ChatListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

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
          unsubscribe = observable.subscribe(chatList => {
            if (!cancelled) {
              const items: ChatListItem[] = chatList.map(chat => ({
                chatId: chat.chatId,
                contactJid: chat.contact.jid,
                contactName: chat.contact.name,
                lastMessage: chat.lastMessage?.content ?? '',
                lastMessageTime: chat.lastMessage?.timestamp ?? 0,
                unreadCount: chat.unreadCount,
                presenceShow: chatService.getContactPresence(chat.contact.jid),
              }));
              setChats(items);
              setLoading(false);
            }
          });
        } else if (__DEV__) {
          // Fallback to mock data in dev mode if service not ready
          const { getMockChatList, getMockContactPresence } = await import('@/services/mock');
          const mockChats = getMockChatList();
          const chatList: ChatListItem[] = mockChats
            .filter(chat => chat.lastMessage) // Only show chats with messages
            .map(chat => ({
              chatId: chat.chatId,
              contactJid: chat.contact.jid,
              contactName: chat.contact.name,
              lastMessage: chat.lastMessage?.content ?? '',
              lastMessageTime: chat.lastMessage?.timestamp ?? 0,
              unreadCount: chat.unreadCount,
              presenceShow: getMockContactPresence(chat.contact),
            }));
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
            const { getMockChatList, getMockContactPresence } = await import('@/services/mock');
            const mockChats = getMockChatList();
            const chatList: ChatListItem[] = mockChats
              .filter(chat => chat.lastMessage)
              .map(chat => ({
                chatId: chat.chatId,
                contactJid: chat.contact.jid,
                contactName: chat.contact.name,
                lastMessage: chat.lastMessage?.content ?? '',
                lastMessageTime: chat.lastMessage?.timestamp ?? 0,
                unreadCount: chat.unreadCount,
                presenceShow: getMockContactPresence(chat.contact),
              }));
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
        const items: ChatListItem[] = chatList.map(chat => ({
          chatId: chat.chatId,
          contactJid: chat.contact.jid,
          contactName: chat.contact.name,
          lastMessage: chat.lastMessage?.content ?? '',
          lastMessageTime: chat.lastMessage?.timestamp ?? 0,
          unreadCount: chat.unreadCount,
          presenceShow: chatService.getContactPresence(chat.contact.jid),
        }));
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
        const items: ChatListItem[] = chatList.map(chat => ({
          chatId: chat.chatId,
          contactJid: chat.contact.jid,
          contactName: chat.contact.name,
          lastMessage: chat.lastMessage?.content ?? '',
          lastMessageTime: chat.lastMessage?.timestamp ?? 0,
          unreadCount: chat.unreadCount,
          presenceShow: chatService.getContactPresence(chat.contact.jid),
        }));
        setChats(items);
      } else if (__DEV__) {
        const { getMockChatList, getMockContactPresence } = await import('@/services/mock');
        const mockChats = getMockChatList();
        const chatList: ChatListItem[] = mockChats
          .filter(chat => chat.lastMessage)
          .map(chat => ({
            chatId: chat.chatId,
            contactJid: chat.contact.jid,
            contactName: chat.contact.name,
            lastMessage: chat.lastMessage?.content ?? '',
            lastMessageTime: chat.lastMessage?.timestamp ?? 0,
            unreadCount: chat.unreadCount,
            presenceShow: getMockContactPresence(chat.contact),
          }));
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
      navigation.navigate('ChatDetail', {
        chatId: item.chatId,
        name: item.contactName,
      });
    },
    [navigation],
  );

  const handleNewChat = useCallback(() => {
    // Navigate to contacts tab to start new chat
    // Use parent navigator (Tab Navigator) to switch tabs
    const parentNav = navigation.getParent();
    if (parentNav) {
      parentNav.navigate('ContactsTab');
    }
    AccessibilityInfo.announceForAccessibility(t('chat.newChat'));
  }, [navigation, t]);

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

  const renderChatItem = useCallback(
    ({ item }: { item: ChatListItem }) => (
      <TouchableOpacity
        style={styles.chatItem}
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
              style={styles.contactName}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.contactName}
            </Text>
            <Text style={styles.timestamp}>{formatTime(item.lastMessageTime)}</Text>
          </View>

          {/* Show up to 2 lines of the last message */}
          {item.lastMessage ? (
            <Text
              style={styles.lastMessage}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {item.lastMessage}
            </Text>
          ) : null}
        </View>

        {/* Unread badge */}
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>
              {item.unreadCount > 99 ? '99+' : item.unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    ),
    [handleChatPress, formatTime, t],
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
          <Text style={styles.emptyTitle}>{t('chat.noChats')}</Text>
          <Text style={styles.emptySubtitle}>{t('chat.noChatsHint')}</Text>
          <Button
            title={t('chat.startChat')}
            onPress={handleNewChat}
            style={styles.startChatButton}
          />
          {/* DEV DEBUG INFO */}
          {__DEV__ && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugText}>User: {myJid}</Text>
              <Text style={styles.debugText}>Window: {windowDims.width}x{windowDims.height}</Text>
              <Text style={styles.debugText}>Screen: {screenDims.width}x{screenDims.height}</Text>
              <Text style={styles.debugText}>Size: {Math.round(windowDims.width * windowDims.height)}</Text>
            </View>
          )}
        </View>
      );
    },
    [t, handleNewChat],
  );

  if (loading) {
    return <LoadingView fullscreen message={t('common.loading')} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={chats.length === 0 ? styles.emptyListContent : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        accessibilityLabel={t('accessibility.unreadMessages', { count: chats.length })}
      >
        {chats.length === 0 ? (
          renderEmptyList()
        ) : (
          chats.map((item) => (
            <View key={keyExtractor(item)}>
              {renderChatItem({ item, index: 0, separators: {} as any })}
            </View>
          ))
        )}
      </ScrollView>

      {/* Floating action button for new chat */}
      {chats.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleNewChat}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('chat.newChat')}
        >
          <Text style={styles.fabIcon}>+</Text>
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
    ...typography.label,
    color: colors.textOnPrimary,
    fontSize: 16,
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
