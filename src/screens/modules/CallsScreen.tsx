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
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets } from '@/theme';
import { ContactAvatar, LoadingView, Icon, ModuleHeader, ModuleScreenLayout, SearchBar, ScrollViewWithIndicator, ErrorView } from '@/components';
import { VoiceFocusable } from '@/components/VoiceFocusable';
import { useVoiceFocusList, type VoiceFocusableItem } from '@/contexts/VoiceFocusContext';
import { useVisualPresence } from '@/contexts/PresenceContext';
import { useFeedback } from '@/hooks/useFeedback';
import { useCall } from '@/contexts/CallContext';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import type { Contact, CallType } from '@/services/interfaces';
import { getContactDisplayName } from '@/services/interfaces';
import { ServiceContainer } from '@/services/container';
import { chatService } from '@/services/chat';
import type { RootStackParams } from '@/navigation';

type CallsNavigationProp = NativeStackNavigationProp<RootStackParams>;

/** Contact row with real presence via PresenceContext */
function CallContactItem({
  contact,
  index,
  onVoiceCall,
  onVideoCall,
  callsModuleColor,
}: {
  contact: Contact;
  index: number;
  onVoiceCall: (contact: Contact) => void;
  onVideoCall: (contact: Contact) => void;
  callsModuleColor: string;
}) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const presence = useVisualPresence(contact.jid);

  return (
    <VoiceFocusable
      key={contact.jid}
      id={contact.jid}
      label={getContactDisplayName(contact)}
      index={index}
      onSelect={() => onVoiceCall(contact)}
    >
      <View style={[styles.contactItem, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.divider }]}>
        {/* Avatar with presence dot (via ContactAvatar) */}
        <ContactAvatar
          name={getContactDisplayName(contact)}
          photoUrl={contact.photoUrl}
          size={56}
          presence={presence}
        />

        {/* Name and status */}
        <View style={styles.contactInfo}>
          <Text
            style={[styles.contactName, { color: themeColors.textPrimary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {getContactDisplayName(contact)}
          </Text>
          <Text style={[styles.statusText, { color: presence.color }]}>
            {presence.label}
          </Text>
        </View>

        {/* Call buttons */}
        <View style={styles.callButtons}>
          {/* Voice call button */}
          <HapticTouchable hapticDisabled
            style={[styles.callButton, { backgroundColor: themeColors.success }]}
            onPress={() => onVoiceCall(contact)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('modules.calls.voiceCallLabel', { name: getContactDisplayName(contact) })}
            accessibilityHint={t('modules.calls.voiceCallHint')}
          >
            <Icon name="call" size={24} color={themeColors.textOnPrimary} />
          </HapticTouchable>

          {/* Video call button */}
          <HapticTouchable hapticDisabled
            style={[styles.callButton, { backgroundColor: callsModuleColor }]}
            onPress={() => onVideoCall(contact)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('modules.calls.videoCallLabel', { name: getContactDisplayName(contact) })}
            accessibilityHint={t('modules.calls.videoCallHint')}
          >
            <Icon name="videocam" size={24} color={themeColors.textOnPrimary} />
          </HapticTouchable>
        </View>
      </View>
    </VoiceFocusable>
  );
}

export function CallsScreen() {
  const { t } = useTranslation();
  const themeColors = useColors();
  const navigation = useNavigation<CallsNavigationProp>();
  const { triggerFeedback } = useFeedback();
  const { initiateCall, activeCall } = useCall();
  const isFocused = useIsFocused();

  // User-customizable module color for Liquid Glass
  const callsModuleColor = useModuleColor('calls');

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
  } | null>(null);

  // Load contacts
  useEffect(() => {
    const loadContacts = async () => {
      try {
        if (ServiceContainer.isInitialized && chatService.isInitialized) {
          const contactList = await chatService.getContacts();
          const sorted = [...contactList].sort((a, b) =>
            getContactDisplayName(a).localeCompare(getContactDisplayName(b), undefined, { sensitivity: 'base' })
          );
          setContacts(sorted);
        } else {
          setContacts([]);
        }
        setLoading(false);
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

  // Navigate to active call screen when OUTGOING call is initiated
  // (Incoming calls are handled by RootNavigator in navigation/index.tsx)
  useEffect(() => {
    if (
      activeCall &&
      activeCall.direction === 'outgoing' &&
      activeCall.state !== 'ended'
    ) {
      // Navigate to active call screen for outgoing calls
      navigation.navigate('ActiveCall', { callId: activeCall.id });
    }
  }, [activeCall, navigation]);

  // Handle initiating a call (voice or video)
  const handleInitiateCall = useCallback(
    async (contact: Contact, callType: CallType) => {
      if (isInitiatingCall || activeCall) {
        console.warn('[CallsScreen] Already in call or initiating');
        return;
      }

      void triggerFeedback('tap');
      setIsInitiatingCall(true);

      try {
        console.info('[CallsScreen] Starting', callType, 'call to:', contact.jid);
        await initiateCall(contact.jid, callType);
        // Navigation happens via the activeCall effect above
      } catch (error) {
        console.error('[CallsScreen] Failed to start call:', error);
        // Show error to user
        setNotification({
          type: 'error',
          title: t('modules.calls.callFailed'),
          message: t('modules.calls.callFailedMessage'),
        });
      } finally {
        setIsInitiatingCall(false);
      }
    },
    [t, triggerFeedback, initiateCall, isInitiatingCall, activeCall]
  );

  // Handle voice call
  const handleVoiceCall = useCallback(
    (contact: Contact) => {
      void handleInitiateCall(contact, 'voice');
    },
    [handleInitiateCall]
  );

  // Handle video call
  const handleVideoCall = useCallback(
    (contact: Contact) => {
      void handleInitiateCall(contact, 'video');
    },
    [handleInitiateCall]
  );

  // Build voice focusable items
  const voiceFocusItems: VoiceFocusableItem[] = useMemo(() => {
    if (!isFocused) return [];
    return filteredContacts.map((contact, index) => ({
      id: contact.jid,
      label: getContactDisplayName(contact),
      index,
      onSelect: () => handleVoiceCall(contact), // Default action: voice call
    }));
  }, [filteredContacts, handleVoiceCall, isFocused]);

  const { scrollRef } = useVoiceFocusList('calls-list', voiceFocusItems);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const renderContactItem = useCallback(
    (contact: Contact, index: number) => {
      return (
        <CallContactItem
          key={contact.jid}
          contact={contact}
          index={index}
          onVoiceCall={handleVoiceCall}
          onVideoCall={handleVideoCall}
          callsModuleColor={callsModuleColor}
        />
      );
    },
    [handleVoiceCall, handleVideoCall, callsModuleColor]
  );

  const renderEmptyList = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconContainer, { backgroundColor: themeColors.backgroundSecondary }]}>
          <Icon name="contacts" size={64} color={themeColors.textTertiary} />
        </View>
        <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>{t('modules.calls.noContacts')}</Text>
        <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>{t('modules.calls.noContactsHint')}</Text>
      </View>
    ),
    [t, themeColors]
  );

  if (loading) {
    return <LoadingView fullscreen message={t('common.loading')} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {notification && (
        <ErrorView
          type={notification.type}
          title={notification.title}
          message={notification.message}
          onDismiss={() => setNotification(null)}
        />
      )}

      <ModuleScreenLayout
        moduleId="calls"
        moduleBlock={
          <ModuleHeader
            moduleId="calls"
            icon="call"
            title={t('navigation.calls')}
            skipSafeArea
          />
        }
        controlsBlock={
          <View style={[styles.searchContainer, { backgroundColor: themeColors.background, borderBottomColor: themeColors.divider }]}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmit={() => {}} // Live filter
              placeholder={t('modules.calls.searchPlaceholder')}
              searchButtonLabel={t('modules.calls.searchButton')}
            />
          </View>
        }
        contentBlock={
          <ScrollViewWithIndicator
            ref={scrollRef}
            style={styles.contentFlex}
            contentContainerStyle={
              filteredContacts.length === 0 ? styles.emptyListContent : undefined
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={callsModuleColor}
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
          </ScrollViewWithIndicator>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentFlex: {
    flex: 1,
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
