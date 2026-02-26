/**
 * ContactDetailScreen — View and manage a single contact
 *
 * Senior-inclusive design:
 * - Large profile photo (120px) for easy recognition
 * - Clear verification badge
 * - Large action buttons (60pt+)
 * - Minimal visual clutter
 * - VoiceOver support
 *
 * Note: Contact photos come FROM the contact themselves (via XMPP).
 * Users can only edit their OWN profile photo in Settings > Profile.
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { ContactAvatar, Icon } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import { useCall } from '@/contexts/CallContext';
import { useNavigateToModule } from '@/hooks/useNavigateToModule';
import type { Contact } from '@/services/interfaces';
import type { ContactStackParams } from '@/navigation';

type NavigationProp = NativeStackNavigationProp<ContactStackParams, 'ContactDetail'>;
type ContactDetailRouteProp = RouteProp<ContactStackParams, 'ContactDetail'>;

export function ContactDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { triggerFeedback } = useFeedback();
  const { initiateCall, isInCall } = useCall();
  const route = useRoute<ContactDetailRouteProp>();
  const { jid } = route.params;
  const themeColors = useColors();
  const { navigateToModuleInOtherPane } = useNavigateToModule();

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContact = async () => {
      try {
        if (__DEV__) {
          // Dynamic import to avoid module loading at bundle time
          const { getMockContactByJid } = await import('@/services/mock');
          const mockContact = getMockContactByJid(jid);
          setContact(mockContact ?? null);
        } else {
          // Production: use real database service
          // const db = ServiceContainer.database;
          // const contactData = await db.getContact(jid);
          // setContact(contactData);
          setContact(null);
        }
      } catch (error) {
        console.error('Failed to load contact:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadContact();
  }, [jid]);

  const handleStartChat = useCallback(async () => {
    void triggerFeedback('tap');
    if (!contact) return;

    // Generate proper chat ID (format: chat:jid1:jid2, sorted)
    let myJid = 'ik@commeazy.local'; // Default fallback
    try {
      const { chatService } = await import('@/services/chat');
      if (chatService.isInitialized) {
        myJid = chatService.getMyJid() || myJid;
      }
    } catch {
      // Use default
    }
    const jids = [myJid, contact.jid].sort();
    const chatId = `chat:${jids.join(':')}`;

    // Unified: navigate other pane to chats → ChatDetail
    // iPad: opens in the other panel, iPhone: navigates in 'main' pane
    navigateToModuleInOtherPane('chats', {
      screen: 'ChatDetail',
      params: { chatId, name: contact.name },
    });
    console.info('[ContactDetail] Navigated to chat with', contact.name);
  }, [contact, triggerFeedback, navigateToModuleInOtherPane]);

  const handleVoiceCall = useCallback(async () => {
    console.info('[ContactDetail] handleVoiceCall tapped, contact:', contact?.jid, 'isInCall:', isInCall);
    void triggerFeedback('tap');
    if (!contact) return;

    if (isInCall) {
      Alert.alert(
        t('calls.alreadyInCall'),
        t('calls.alreadyInCallMessage'),
        [{ text: t('common.ok'), style: 'default' }]
      );
      return;
    }

    try {
      await initiateCall(contact.jid, 'voice');
      // Navigation to call screen is handled by CallContext/CallOverlay
    } catch (error) {
      console.error('[ContactDetail] Failed to start voice call:', error);
      Alert.alert(
        t('calls.callFailed'),
        t('calls.callFailedMessage'),
        [{ text: t('common.ok'), style: 'default' }]
      );
    }
  }, [contact, isInCall, initiateCall, t, triggerFeedback]);

  const handleVideoCall = useCallback(async () => {
    console.info('[ContactDetail] handleVideoCall tapped, contact:', contact?.jid, 'isInCall:', isInCall);
    void triggerFeedback('tap');
    if (!contact) return;

    if (isInCall) {
      Alert.alert(
        t('calls.alreadyInCall'),
        t('calls.alreadyInCallMessage'),
        [{ text: t('common.ok'), style: 'default' }]
      );
      return;
    }

    try {
      await initiateCall(contact.jid, 'video');
      // Navigation to call screen is handled by CallContext/CallOverlay
    } catch (error) {
      console.error('[ContactDetail] Failed to start video call:', error);
      Alert.alert(
        t('calls.callFailed'),
        t('calls.callFailedMessage'),
        [{ text: t('common.ok'), style: 'default' }]
      );
    }
  }, [contact, isInCall, initiateCall, t, triggerFeedback]);

  const handleVerify = useCallback(() => {
    void triggerFeedback('tap');
    if (contact) {
      navigation.navigate('VerifyContact' as never, { jid: contact.jid, name: contact.name } as never);
    }
  }, [contact, navigation, triggerFeedback]);

  const handleDelete = useCallback(() => {
    void triggerFeedback('tap');
    if (!contact) return;

    Alert.alert(
      t('contacts.deleteTitle'),
      t('contacts.deleteConfirm', { name: contact.name }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('contacts.delete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                if (__DEV__) {
                  // In dev mode, just navigate back (mock data is in memory)
                  console.log('[DEV] Would delete contact:', jid);
                } else {
                  // Production: use real database service
                  // const db = ServiceContainer.database;
                  // await db.deleteContact(jid);
                }
                navigation.goBack();
              } catch (error) {
                console.error('Failed to delete contact:', error);
                Alert.alert(t('errors.genericError'));
              }
            })();
          },
        },
      ]
    );
  }, [contact, jid, navigation, t, triggerFeedback]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.errorText, { color: themeColors.textSecondary }]}>{t('contacts.notFound')}</Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: themeColors.primary }]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.backButton')}
        >
          <Text style={[styles.backButtonText, { color: themeColors.textOnPrimary }]}>{t('common.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.contentContainer}>
      {/* Profile header with large photo */}
      <View style={styles.profileHeader}>
        <ContactAvatar
          name={contact.name}
          photoUrl={contact.photoUrl}
          size={120}
        />
        <Text style={[styles.contactName, { color: themeColors.textPrimary }]}>{contact.name}</Text>

        {/* Verification badge - compact */}
        <View
          style={[
            styles.verificationBadge,
            contact.verified ? styles.verifiedBadge : styles.notVerifiedBadge,
          ]}
          accessibilityLabel={
            contact.verified ? t('contacts.verified') : t('contacts.notVerified')
          }
        >
          <Text style={[styles.verificationIcon, { color: themeColors.textOnPrimary }]}>
            {contact.verified ? '✓' : '!'}
          </Text>
          <Text style={[styles.verificationText, { color: themeColors.textOnPrimary }]}>
            {contact.verified ? t('contacts.verified') : t('contacts.notVerified')}
          </Text>
        </View>
      </View>

      {/* Contact details section */}
      <View style={[styles.detailsSection, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('contacts.details')}</Text>

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('contacts.phoneLabel')}</Text>
          <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>{contact.phoneNumber}</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsContainer}>
        {/* Primary: Chat button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton, { backgroundColor: themeColors.primary }]}
          onPress={handleStartChat}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('contacts.startChat')}
          accessibilityHint={t('accessibility.startChatHint', { name: contact.name })}
        >
          <Icon name="chatbubble" size={24} color={themeColors.textOnPrimary} />
          <Text style={[styles.primaryButtonText, { color: themeColors.textOnPrimary }]}>{t('contacts.startChat')}</Text>
        </TouchableOpacity>

        {/* Call buttons row: Voice + Video side by side */}
        <View style={styles.callButtonsRow}>
          {/* Voice call button */}
          <TouchableOpacity
            style={[styles.callButton, styles.voiceCallButton]}
            onPress={handleVoiceCall}
            activeOpacity={0.7}
            disabled={isInCall}
            accessibilityRole="button"
            accessibilityLabel={t('contacts.voiceCall')}
            accessibilityHint={t('accessibility.voiceCallHint', { name: contact.name })}
            accessibilityState={{ disabled: isInCall }}
          >
            <Icon name="call" size={28} color={themeColors.textOnPrimary} />
            <Text style={[styles.callButtonText, { color: themeColors.textOnPrimary }]}>{t('contacts.voiceCall')}</Text>
          </TouchableOpacity>

          {/* Video call button */}
          <TouchableOpacity
            style={[styles.callButton, styles.videoCallButton]}
            onPress={handleVideoCall}
            activeOpacity={0.7}
            disabled={isInCall}
            accessibilityRole="button"
            accessibilityLabel={t('contacts.videoCall')}
            accessibilityHint={t('accessibility.videoCallHint', { name: contact.name })}
            accessibilityState={{ disabled: isInCall }}
          >
            <Icon name="videocam" size={28} color={themeColors.textOnPrimary} />
            <Text style={[styles.callButtonText, { color: themeColors.textOnPrimary }]}>{t('contacts.videoCall')}</Text>
          </TouchableOpacity>
        </View>

        {/* Verify/Reverify button */}
        {!contact.verified && (
          <TouchableOpacity
            style={[styles.actionButton, styles.warningButton]}
            onPress={handleVerify}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('contacts.verify')}
          >
            <Text style={[styles.warningButtonText, { color: themeColors.textOnPrimary }]}>{t('contacts.verify')}</Text>
          </TouchableOpacity>
        )}

        {/* Delete button - at bottom, less prominent */}
        <TouchableOpacity
          style={[styles.actionButton, styles.dangerButton, { backgroundColor: themeColors.background, borderColor: themeColors.error }]}
          onPress={handleDelete}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('contacts.delete')}
          accessibilityHint={t('accessibility.deleteContactHint', { name: contact.name })}
        >
          <Text style={[styles.dangerButtonText, { color: themeColors.error }]}>{t('contacts.delete')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  contactName: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  verifiedBadge: {
    backgroundColor: colors.success,
  },
  notVerifiedBadge: {
    backgroundColor: colors.warning,
  },
  verificationIcon: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginRight: spacing.xs,
  },
  verificationText: {
    ...typography.small,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  actionsContainer: {
    gap: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.comfortable,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  callButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  callButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.large,
  },
  voiceCallButton: {
    backgroundColor: colors.success,
  },
  videoCallButton: {
    backgroundColor: '#7B1FA2', // Purple for video (consistent with moduleColors.podcast)
  },
  callButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
    fontSize: 16,
  },
  warningButton: {
    backgroundColor: colors.warning,
  },
  warningButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  dangerButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.error,
  },
  dangerButtonText: {
    ...typography.button,
    color: colors.error,
  },
});
