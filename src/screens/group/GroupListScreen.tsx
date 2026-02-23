/**
 * GroupListScreen — List of all group conversations
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
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  AccessibilityInfo,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { Button, LoadingView, VoiceFocusable, Icon, ModuleHeader } from '@/components';
import { useVoiceFocusList } from '@/contexts/VoiceFocusContext';
import type { GroupStackParams } from '@/navigation';
import { ServiceContainer } from '@/services/container';
import { groupChatService, GroupListItem } from '@/services/groupChat';

type NavigationProp = NativeStackNavigationProp<GroupStackParams, 'GroupList'>;

export function GroupListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused();
  const themeColors = useColors();
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Voice Focus: Register list items for voice navigation
  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return []; // Only register when screen is focused
    return groups.map((group, index) => ({
      id: group.groupId,
      label: group.group.name, // Human-readable name for voice matching
      index,
      onSelect: () => handleGroupPress(group),
    }));
  }, [groups, isFocused]);

  const { scrollRef, isFocused: isItemFocused, getFocusStyle } = useVoiceFocusList(
    'group-list',
    voiceFocusItems
  );

  // Load groups
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const loadGroups = async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      if (cancelled) return;

      try {
        if (ServiceContainer.isInitialized && groupChatService.isInitialized) {
          const observable = groupChatService.observeGroupList();
          unsubscribe = observable.subscribe(groupList => {
            if (!cancelled) {
              setGroups(groupList);
              setLoading(false);
            }
          });
        } else if (__DEV__) {
          // Mock data for dev mode
          const mockGroups: GroupListItem[] = [
            {
              groupId: 'mock-group-1',
              group: {
                id: 'mock-group-1',
                name: 'Familie van de Berg',
                members: ['ik@commeazy.local', 'oma@commeazy.local', 'piet@commeazy.local'],
                createdBy: 'ik@commeazy.local',
                createdAt: Date.now() - 86400000,
                encryptionMode: 'encrypt-to-all',
              },
              lastMessage: {
                id: 'msg-1',
                chatId: 'mock-group-1',
                senderId: 'oma@commeazy.local',
                senderName: 'Oma',
                content: 'Wie komt er zondag eten?',
                contentType: 'text',
                timestamp: Date.now() - 3600000,
                status: 'delivered',
              },
              unreadCount: 2,
            },
            {
              groupId: 'mock-group-2',
              group: {
                id: 'mock-group-2',
                name: 'Buurtclub',
                members: ['ik@commeazy.local', 'buurman@commeazy.local'],
                createdBy: 'ik@commeazy.local',
                createdAt: Date.now() - 172800000,
                encryptionMode: 'encrypt-to-all',
              },
              lastMessage: null,
              unreadCount: 0,
            },
          ];
          if (!cancelled) setGroups(mockGroups);
          if (!cancelled) setLoading(false);
        } else {
          if (!cancelled) setGroups([]);
          if (!cancelled) setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load groups:', error);
        if (!cancelled) setGroups([]);
        if (!cancelled) setLoading(false);
      }
    };

    void loadGroups();
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Refresh when screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (ServiceContainer.isInitialized && groupChatService.isInitialized) {
        void refreshGroupsInternal();
      }
    }, []),
  );

  const refreshGroupsInternal = async () => {
    try {
      if (ServiceContainer.isInitialized && groupChatService.isInitialized) {
        const groupList = await groupChatService.getGroupList();
        setGroups(groupList);
      }
    } catch (error) {
      console.error('Failed to refresh groups:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshGroupsInternal();
    setRefreshing(false);
  }, []);

  const handleGroupPress = useCallback(
    (item: GroupListItem) => {
      navigation.navigate('GroupDetail', {
        groupId: item.groupId,
        name: item.group.name,
      });
    },
    [navigation],
  );

  const handleCreateGroup = useCallback(() => {
    navigation.navigate('CreateGroup');
    AccessibilityInfo.announceForAccessibility(t('group.create'));
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

  const renderGroupItem = useCallback(
    (item: GroupListItem, index: number): React.ReactElement => {
      const focused = isItemFocused(item.groupId);
      const focusStyle = focused ? getFocusStyle() : undefined;

      return (
        <VoiceFocusable
          key={item.groupId}
          id={item.groupId}
          label={item.group.name}
          index={index}
          onSelect={() => handleGroupPress(item)}
        >
          <TouchableOpacity
            style={[
              styles.groupItem,
              { backgroundColor: themeColors.surface, borderBottomColor: themeColors.divider },
              focused && {
                borderColor: focusStyle?.borderColor,
                borderWidth: focusStyle?.borderWidth,
                backgroundColor: focusStyle?.backgroundColor,
              },
            ]}
            onPress={() => handleGroupPress(item)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.groupChat', {
              name: item.group.name,
              memberCount: item.group.members.length,
            })}
            accessibilityHint={t('chat.openConversation')}
          >
            {/* Group icon */}
            <View style={[styles.groupIcon, { backgroundColor: themeColors.primaryLight }]}>
              <Text style={[styles.groupIconText, { color: themeColors.primary }]}>
                {item.group.name.charAt(0).toUpperCase()}
              </Text>
            </View>

            {/* Content */}
            <View style={styles.groupContent}>
              <View style={styles.groupHeader}>
                <Text
                  style={[styles.groupName, { color: themeColors.textPrimary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.group.name}
                </Text>
                {item.lastMessage && (
                  <Text style={[styles.timestamp, { color: themeColors.textTertiary }]}>
                    {formatTime(item.lastMessage.timestamp)}
                  </Text>
                )}
              </View>

              {/* Member count */}
              <Text style={[styles.memberCount, { color: themeColors.textSecondary }]}>
                {t('group.memberCount', { count: item.group.members.length })}
              </Text>

              {/* Last message */}
              {item.lastMessage && (
                <Text
                  style={[styles.lastMessage, { color: themeColors.textSecondary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  <Text style={styles.senderName}>{item.lastMessage.senderName}: </Text>
                  {item.lastMessage.content}
                </Text>
              )}
            </View>

            {/* Unread badge */}
            {item.unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: themeColors.primary }]}>
                <Text style={[styles.unreadCount, { color: themeColors.textOnPrimary }]}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </VoiceFocusable>
      );
    },
    [handleGroupPress, formatTime, t, isItemFocused, getFocusStyle, themeColors],
  );

  const renderEmptyList = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>{t('group.noGroups')}</Text>
        <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>{t('group.noGroupsHint')}</Text>
        <Button
          title={t('group.create')}
          onPress={handleCreateGroup}
          style={styles.createButton}
        />
      </View>
    ),
    [t, handleCreateGroup, themeColors],
  );

  if (loading) {
    return <LoadingView fullscreen message={t('common.loading')} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Module Header — standardized component */}
      <ModuleHeader
        moduleId="groups"
        icon="groups"
        title={t('tabs.groups')}
        showAdMob={true}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={groups.length === 0 ? styles.emptyListContent : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={themeColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        accessibilityLabel={t('accessibility.groupList', { count: groups.length })}
      >
        {groups.length === 0 ? (
          renderEmptyList()
        ) : (
          groups.map((item, index) => renderGroupItem(item, index))
        )}
      </ScrollView>

      {/* Floating action button for new group */}
      {groups.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: themeColors.primary }]}
          onPress={handleCreateGroup}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('group.create')}
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
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
    borderBottomWidth: 1,
  },
  groupIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  groupIconText: {
    ...typography.h2,
  },
  groupContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  groupName: {
    ...typography.h3,
    flex: 1,
    marginRight: spacing.sm,
  },
  timestamp: {
    ...typography.small,
  },
  memberCount: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  lastMessage: {
    ...typography.body,
  },
  senderName: {
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  unreadCount: {
    ...typography.label,
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
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptySubtitle: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  createButton: {
    minWidth: 200,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    width: touchTargets.large,
    height: touchTargets.large,
    borderRadius: touchTargets.large / 2,
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
    fontWeight: '300',
  },
});
