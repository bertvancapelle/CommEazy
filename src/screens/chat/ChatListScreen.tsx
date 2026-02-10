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
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Button } from '@/components';
import { chatService, type ChatListItem } from '@/services/chat';
import type { ChatStackParams } from '@/navigation';

type NavigationProp = NativeStackNavigationProp<ChatStackParams, 'ChatList'>;

export function ChatListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadChats = useCallback(async () => {
    try {
      const chatList = await chatService.getChatList();
      setChats(chatList);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChats();
    setRefreshing(false);
  }, [loadChats]);

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
    // Navigate to contacts to start new chat
    // For now, just announce the action
    AccessibilityInfo.announceForAccessibility(t('chat.newChat'));
  }, [t]);

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
        {/* Avatar placeholder */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.contactName.charAt(0).toUpperCase()}
          </Text>
          {item.isOnline && <View style={styles.onlineIndicator} />}
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

          <Text
            style={styles.lastMessage}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.lastMessage}
          </Text>
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
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>{t('chat.noChats')}</Text>
        <Text style={styles.emptySubtitle}>{t('chat.noChatsHint')}</Text>
        <Button
          title={t('chat.startChat')}
          onPress={handleNewChat}
          style={styles.startChatButton}
        />
      </View>
    ),
    [t, handleNewChat],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={chats}
        renderItem={renderChatItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={chats.length === 0 ? styles.emptyListContent : undefined}
        ListEmptyComponent={renderEmptyList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        accessibilityLabel={t('accessibility.unreadMessages', { count: chats.length })}
      />

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
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
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.h3,
    color: colors.textOnPrimary,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
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
    ...typography.bodyBold,
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
    fontSize: 14,
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
});
