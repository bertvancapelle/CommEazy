/**
 * GroupDetailScreen — Group chat messages view
 *
 * Shows messages from all group members with sender names.
 * Includes member list and group management.
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - 18pt body text
 * - Sender names always visible
 * - VoiceOver support
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { TextInput, LoadingView } from '@/components';
import type { GroupStackParams } from '@/navigation';
import { ServiceContainer } from '@/services/container';
import { groupChatService } from '@/services/groupChat';
import type { Message, Group, DeliveryStatus } from '@/services/interfaces';
import { triggerHaptic } from '@/hooks/useHoldToNavigate';

type Props = NativeStackScreenProps<GroupStackParams, 'GroupDetail'>;
type NavigationProp = NativeStackNavigationProp<GroupStackParams, 'GroupDetail'>;

export function GroupDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<Props['route']>();
  const { groupId, name } = route.params;

  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showMembers, setShowMembers] = useState(false);

  const myJid = groupChatService.getMyJid();

  // Load group and messages
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const load = async () => {
      try {
        if (ServiceContainer.isInitialized && groupChatService.isInitialized) {
          // Load group info
          const groupInfo = await ServiceContainer.database.getGroup(groupId);
          if (!cancelled) setGroup(groupInfo);

          // Subscribe to messages
          const observable = groupChatService.observeMessages(groupId, 100);
          unsubscribe = observable.subscribe(msgs => {
            if (!cancelled) {
              setMessages(msgs);
              setLoading(false);
              // Scroll to bottom on new messages
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }
          });
        } else if (__DEV__) {
          // Mock data
          const mockGroup: Group = {
            id: groupId,
            name: name,
            members: ['ik@commeazy.local', 'oma@commeazy.local', 'piet@commeazy.local'],
            createdBy: 'ik@commeazy.local',
            createdAt: Date.now() - 86400000,
            encryptionMode: 'encrypt-to-all',
          };
          const mockMessages: Message[] = [
            {
              id: '1',
              chatId: groupId,
              senderId: 'oma@commeazy.local',
              senderName: 'Oma',
              content: 'Goedemorgen allemaal! 🌞',
              contentType: 'text',
              timestamp: Date.now() - 7200000,
              status: 'delivered',
            },
            {
              id: '2',
              chatId: groupId,
              senderId: 'piet@commeazy.local',
              senderName: 'Piet',
              content: 'Goedemorgen! Hoe is het?',
              contentType: 'text',
              timestamp: Date.now() - 3600000,
              status: 'delivered',
            },
            {
              id: '3',
              chatId: groupId,
              senderId: 'ik@commeazy.local',
              senderName: 'Ik',
              content: 'Prima hier! Wie komt er zondag?',
              contentType: 'text',
              timestamp: Date.now() - 1800000,
              status: 'sent',
            },
          ];
          if (!cancelled) {
            setGroup(mockGroup);
            setMessages(mockMessages);
            setLoading(false);
          }
        } else {
          if (!cancelled) setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load group:', error);
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [groupId, name]);

  // Mark as read when screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (ServiceContainer.isInitialized && groupChatService.isInitialized) {
        void groupChatService.markGroupAsRead(groupId);
      }
    }, [groupId]),
  );

  // Set header title
  useEffect(() => {
    navigation.setOptions({
      title: name,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setShowMembers(!showMembers)}
          style={styles.headerButton}
          accessibilityLabel={t('group.members')}
        >
          <Text style={styles.headerButtonText}>👥</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, name, showMembers, t]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || sending) return;

    setSending(true);
    triggerHaptic('medium');
    const text = inputText.trim();
    setInputText('');

    try {
      await groupChatService.sendMessage(groupId, text);
      triggerHaptic('success');
      AccessibilityInfo.announceForAccessibility(t('chat.messageSent'));
    } catch (error) {
      console.error('Failed to send message:', error);
      triggerHaptic('error');
      // Restore input on error
      setInputText(text);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, groupId, t]);

  const formatTime = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const getStatusIcon = useCallback((status: DeliveryStatus): string => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'sent':
        return '✓';
      case 'delivered':
        return '✓✓';
      case 'failed':
        return '⚠️';
      default:
        return '';
    }
  }, []);

  const renderMessage = useCallback(
    (message: Message) => {
      const isOwn = message.senderId === myJid;

      return (
        <View
          key={message.id}
          style={[styles.messageBubble, isOwn ? styles.ownMessage : styles.otherMessage]}
          accessible={true}
          accessibilityLabel={`${message.senderName}: ${message.content}`}
        >
          {/* Sender name (always show for groups, except own messages) */}
          {!isOwn && (
            <Text style={styles.senderName}>{message.senderName}</Text>
          )}

          <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
            {message.content}
          </Text>

          <View style={styles.messageMeta}>
            <Text style={[styles.messageTime, isOwn && styles.ownMessageTime]}>
              {formatTime(message.timestamp)}
            </Text>
            {isOwn && (
              <Text style={styles.statusIcon}>{getStatusIcon(message.status)}</Text>
            )}
          </View>
        </View>
      );
    },
    [myJid, formatTime, getStatusIcon],
  );

  const renderMembersList = useCallback(() => {
    if (!group || !showMembers) return null;

    return (
      <View style={styles.membersPanel}>
        <View style={styles.membersPanelHeader}>
          <Text style={styles.membersPanelTitle}>
            {t('group.memberCount', { count: group.members.length })}
          </Text>
          <TouchableOpacity
            onPress={() => setShowMembers(false)}
            style={styles.closeButton}
            accessibilityLabel={t('common.close')}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.membersList}>
          {group.members.map(memberJid => (
            <View key={memberJid} style={styles.memberItem}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {memberJid.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.memberName}>
                {memberJid === myJid ? t('group.you') : memberJid.split('@')[0]}
              </Text>
              {memberJid === group.createdBy && (
                <Text style={styles.adminBadge}>{t('group.admin')}</Text>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }, [group, showMembers, myJid, t]);

  if (loading) {
    return <LoadingView fullscreen message={t('common.loading')} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Members panel (overlay) */}
      {renderMembersList()}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        showsVerticalScrollIndicator={false}
        accessibilityLabel={t('accessibility.messageList')}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyMessages}>
            <Text style={styles.emptyText}>{t('chat.noMessages')}</Text>
            <Text style={styles.emptyHint}>{t('chat.startConversation')}</Text>
          </View>
        ) : (
          messages.map(msg => renderMessage(msg))
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder={t('chat.typeMessage')}
          multiline
          maxLength={5000}
          style={styles.textInput}
          accessibilityLabel={t('chat.typeMessage')}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={() => void handleSend()}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.sendButton')}
        >
          <Text style={styles.sendButtonText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerButton: {
    padding: spacing.sm,
    minWidth: touchTargets.minimum,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    fontSize: 24,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: spacing.md,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  ownMessage: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: borderRadius.sm,
  },
  otherMessage: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: borderRadius.sm,
  },
  senderName: {
    ...typography.label,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  messageText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  ownMessageText: {
    color: colors.textOnPrimary,
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  messageTime: {
    ...typography.small,
    color: colors.textSecondary,
  },
  ownMessageTime: {
    color: colors.textOnPrimary + '99',
  },
  statusIcon: {
    fontSize: 16,
    color: colors.textOnPrimary + '99',
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    ...typography.h3,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  emptyHint: {
    ...typography.body,
    color: colors.textTertiary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    maxHeight: 120,
    minHeight: touchTargets.minimum,
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
    backgroundColor: colors.border,
  },
  sendButtonText: {
    fontSize: 24,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  membersPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 280,
    backgroundColor: colors.surface,
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  membersPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  membersPanelTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  closeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  membersList: {
    flex: 1,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    minHeight: touchTargets.minimum,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  memberAvatarText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
  },
  memberName: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  adminBadge: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
  },
});
