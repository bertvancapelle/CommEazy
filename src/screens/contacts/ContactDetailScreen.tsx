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
import { ContactAvatar } from '@/components';
import type { Contact } from '@/services/interfaces';
import type { ContactStackParams } from '@/navigation';

type NavigationProp = NativeStackNavigationProp<ContactStackParams, 'ContactDetail'>;
type ContactDetailRouteProp = RouteProp<ContactStackParams, 'ContactDetail'>;

export function ContactDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ContactDetailRouteProp>();
  const { jid } = route.params;

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
    if (contact) {
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

      // Navigate to chat with this contact
      navigation.getParent()?.navigate('ChatsTab', {
        screen: 'ChatDetail',
        params: { chatId, name: contact.name },
      });
    }
  }, [contact, navigation]);

  const handleCall = useCallback(() => {
    // Disabled for now - show coming soon message
    Alert.alert(
      t('contacts.callDisabled'),
      t('contacts.callDisabledMessage'),
      [{ text: t('common.ok'), style: 'default' }]
    );
  }, [t]);

  const handleVerify = useCallback(() => {
    if (contact) {
      navigation.navigate('VerifyContact' as never, { jid: contact.jid, name: contact.name } as never);
    }
  }, [contact, navigation]);

  const handleDelete = useCallback(() => {
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
  }, [contact, jid, navigation, t]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('contacts.notFound')}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.backButton')}
        >
          <Text style={styles.backButtonText}>{t('common.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profile header with large photo */}
      <View style={styles.profileHeader}>
        <ContactAvatar
          name={contact.name}
          photoUrl={contact.photoUrl}
          size={120}
        />
        <Text style={styles.contactName}>{contact.name}</Text>

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
          <Text style={styles.verificationIcon}>
            {contact.verified ? '✓' : '!'}
          </Text>
          <Text style={styles.verificationText}>
            {contact.verified ? t('contacts.verified') : t('contacts.notVerified')}
          </Text>
        </View>
      </View>

      {/* Contact details section */}
      <View style={styles.detailsSection}>
        <Text style={styles.sectionTitle}>{t('contacts.details')}</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('contacts.phoneLabel')}</Text>
          <Text style={styles.detailValue}>{contact.phoneNumber}</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsContainer}>
        {/* Primary: Chat button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={handleStartChat}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('contacts.startChat')}
          accessibilityHint={t('accessibility.startChatHint', { name: contact.name })}
        >
          <Text style={styles.primaryButtonText}>{t('contacts.startChat')}</Text>
        </TouchableOpacity>

        {/* Secondary: Call button (disabled) */}
        <TouchableOpacity
          style={[styles.actionButton, styles.disabledButton]}
          onPress={handleCall}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('contacts.call')}
          accessibilityState={{ disabled: true }}
        >
          <Text style={styles.disabledButtonText}>{t('contacts.call')}</Text>
          <Text style={styles.comingSoonText}>{t('contacts.comingSoon')}</Text>
        </TouchableOpacity>

        {/* Verify/Reverify button */}
        {!contact.verified && (
          <TouchableOpacity
            style={[styles.actionButton, styles.warningButton]}
            onPress={handleVerify}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('contacts.verify')}
          >
            <Text style={styles.warningButtonText}>{t('contacts.verify')}</Text>
          </TouchableOpacity>
        )}

        {/* Delete button - at bottom, less prominent */}
        <TouchableOpacity
          style={[styles.actionButton, styles.dangerButton]}
          onPress={handleDelete}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('contacts.delete')}
          accessibilityHint={t('accessibility.deleteContactHint', { name: contact.name })}
        >
          <Text style={styles.dangerButtonText}>{t('contacts.delete')}</Text>
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
  warningButton: {
    backgroundColor: colors.warning,
  },
  warningButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  disabledButton: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.disabled,
  },
  disabledButtonText: {
    ...typography.button,
    color: colors.disabled,
  },
  comingSoonText: {
    ...typography.small,
    color: colors.disabled,
    fontStyle: 'italic',
    marginLeft: spacing.sm,
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
