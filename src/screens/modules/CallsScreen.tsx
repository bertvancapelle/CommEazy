/**
 * CallsScreen — Combined voice and video calling module
 *
 * Displays all contacts with:
 * - Voice call button (📞)
 * - Video call button (📹)
 * - Online/offline status indicator
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets for call buttons
 * - Large text (18pt+)
 * - Clear presence indicators with icons (not just color)
 * - VoiceOver support
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { ContactAvatar, LoadingView, Icon, ModuleHeader, SearchBar } from '@/components';
import { VoiceFocusable } from '@/components/VoiceFocusable';
import { useVoiceFocusList, type VoiceFocusableItem } from '@/contexts/VoiceFocusContext';
import { useFeedback } from '@/hooks/useFeedback';
import type { Contact, PresenceShow } from '@/services/interfaces';

// Module color — Blue (consistent with WheelNavigationMenu)
const CALLS_COLOR = '#1565C0';

export function CallsScreen() {
  const { t } = useTranslation();
  const { triggerFeedback } = useFeedback();
  const isFocused = useIsFocused();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load contacts
  useEffect(() => {
    const loadContacts = async () => {
      try {
        if (__DEV__) {
          const { getMockContactsForDevice } = await import('@/services/mock');
          const { chatService } = await import('@/services/chat');

          const currentUserJid = chatService.isInitialized ? chatService.getMyJid() : 'ik@commeazy.local';
          const deviceContacts = getMockContactsForDevice(currentUserJid || 'ik@commeazy.local');

          const sorted = [...deviceContacts].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          );
          setContacts(sorted);
          setLoading(false);
        } else {
          setContacts([]);
          setLoading(false);
        }
      } catch (error) {
        console.error('[CallsScreen] Failed to load contacts:', error);
        setContacts([]);
        setLoading(false);
      }
    };
    void loadContacts();
  }, []);

  // Filter contacts when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.phoneNumber.includes(query)
      );
      setFilteredContacts(filtered);
    }
  }, [searchQuery, contacts]);

  // Handle voice call
  const handleVoiceCall = useCallback(
    (contact: Contact) => {
      void triggerFeedback('tap');
      // TODO: Implement WebRTC voice call
      Alert.alert(
        t('modules.calls.voiceCallTitle'),
        t('modules.calls.callStarting', { name: contact.name }),
        [{ text: t('common.ok') }]
      );
      console.log('[CallsScreen] Starting voice call to:', contact.jid);
    },
    [t, triggerFeedback]
  );

  // Handle video call
  const handleVideoCall = useCallback(
    (contact: Contact) => {
      void triggerFeedback('tap');
      // TODO: Implement WebRTC video call
      Alert.alert(
        t('modules.calls.videoCallTitle'),
        t('modules.calls.callStarting', { name: contact.name }),
        [{ text: t('common.ok') }]
      );
      console.log('[CallsScreen] Starting video call to:', contact.jid);
    },
    [t, triggerFeedback]
  );

  // Build voice focusable items
  const voiceFocusItems: VoiceFocusableItem[] = useMemo(() => {
    if (!isFocused) return [];
    return filteredContacts.map((contact, index) => ({
      id: contact.jid,
      label: contact.name,
      index,
      onSelect: () => handleVoiceCall(contact), // Default action: voice call
    }));
  }, [filteredContacts, handleVoiceCall, isFocused]);

  const { scrollRef } = useVoiceFocusList('calls-list', voiceFocusItems);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  // Get presence color and icon
  const getPresenceInfo = (presence?: PresenceShow): { color: string; icon: string; label: string } => {
    switch (presence) {
      case 'chat':
      case undefined: // Default to available if not specified
        return { color: colors.presenceAvailable, icon: 'checkmark-circle', label: t('presence.available') };
      case 'away':
        return { color: colors.presenceAway, icon: 'time', label: t('presence.away') };
      case 'xa':
        return { color: colors.presenceXa, icon: 'close-circle', label: t('presence.xa') };
      case 'dnd':
        return { color: colors.presenceDnd, icon: 'remove-circle', label: t('presence.dnd') };
      default:
        return { color: colors.presenceOffline, icon: 'ellipse-outline', label: t('presence.offline') };
    }
  };

  const renderContactItem = useCallback(
    (contact: Contact, index: number) => {
      // Mock presence for development (TODO: use real XMPP presence)
      const mockPresence: PresenceShow = index % 3 === 0 ? 'chat' : index % 3 === 1 ? 'away' : 'xa';
      const presenceInfo = getPresenceInfo(mockPresence);

      return (
        <VoiceFocusable
          key={contact.jid}
          id={contact.jid}
          label={contact.name}
          index={index}
          onSelect={() => handleVoiceCall(contact)}
        >
          <View style={styles.contactItem}>
            {/* Avatar with presence indicator */}
            <View style={styles.avatarContainer}>
              <ContactAvatar
                name={contact.name}
                photoUrl={contact.photoUrl}
                size={56}
              />
              {/* Presence dot */}
              <View
                style={[
                  styles.presenceDot,
                  { backgroundColor: presenceInfo.color },
                ]}
                accessibilityLabel={presenceInfo.label}
              />
            </View>

            {/* Name and status */}
            <View style={styles.contactInfo}>
              <Text
                style={styles.contactName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {contact.name}
              </Text>
              <View style={styles.statusRow}>
                <Icon
                  name={presenceInfo.icon as 'checkmark-circle' | 'time' | 'close-circle' | 'remove-circle' | 'ellipse-outline'}
                  size={16}
                  color={presenceInfo.color}
                />
                <Text style={[styles.statusText, { color: presenceInfo.color }]}>
                  {presenceInfo.label}
                </Text>
              </View>
            </View>

            {/* Call buttons */}
            <View style={styles.callButtons}>
              {/* Voice call button */}
              <TouchableOpacity
                style={[styles.callButton, styles.voiceCallButton]}
                onPress={() => handleVoiceCall(contact)}
                onLongPress={() => {}} // Prevent double-action
                delayLongPress={300}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('modules.calls.voiceCallLabel', { name: contact.name })}
                accessibilityHint={t('modules.calls.voiceCallHint')}
              >
                <Icon name="call" size={24} color={colors.textOnPrimary} />
              </TouchableOpacity>

              {/* Video call button */}
              <TouchableOpacity
                style={[styles.callButton, styles.videoCallButton]}
                onPress={() => handleVideoCall(contact)}
                onLongPress={() => {}} // Prevent double-action
                delayLongPress={300}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('modules.calls.videoCallLabel', { name: contact.name })}
                accessibilityHint={t('modules.calls.videoCallHint')}
              >
                <Icon name="videocam" size={24} color={colors.textOnPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </VoiceFocusable>
      );
    },
    [handleVoiceCall, handleVideoCall, t]
  );

  const renderEmptyList = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Icon name="people" size={64} color={colors.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>{t('modules.calls.noContacts')}</Text>
        <Text style={styles.emptySubtitle}>{t('modules.calls.noContactsHint')}</Text>
      </View>
    ),
    [t]
  );

  if (loading) {
    return <LoadingView fullscreen message={t('common.loading')} />;
  }

  return (
    <View style={styles.container}>
      {/* Module Header */}
      <ModuleHeader
        moduleId="calls"
        icon="call"
        title={t('navigation.calls')}
        showAdMob={true}
      />

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmit={() => {}} // Live filter
          placeholder={t('modules.calls.searchPlaceholder')}
          searchButtonLabel={t('modules.calls.searchButton')}
        />
      </View>

      {/* Contact list */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={
          filteredContacts.length === 0 ? styles.emptyListContent : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={CALLS_COLOR}
          />
        }
        showsVerticalScrollIndicator={false}
        accessibilityLabel={t('modules.calls.contactList', { count: filteredContacts.length })}
      >
        {filteredContacts.length === 0 ? (
          renderEmptyList()
        ) : (
          filteredContacts.map((contact, index) => renderContactItem(contact, index))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  avatarContainer: {
    position: 'relative',
  },
  presenceDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  contactInfo: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  contactName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  statusText: {
    ...typography.small,
    marginLeft: spacing.xs,
  },
  callButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  callButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: touchTargets.minimum / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceCallButton: {
    backgroundColor: colors.success, // Green for voice call
  },
  videoCallButton: {
    backgroundColor: CALLS_COLOR, // Blue for video call
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
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
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
  },
});
