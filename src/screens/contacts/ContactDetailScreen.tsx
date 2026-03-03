/**
 * ContactDetailScreen — View and manage a single contact
 *
 * Senior-inclusive design:
 * - Large profile photo (120px) for easy recognition
 * - Clear verification badge
 * - Large action buttons (60pt+)
 * - Minimal visual clutter
 * - VoiceOver support
 * - Address with navigation to Maps
 * - Important dates with personalized calculations
 *
 * Note: Contact photos come FROM the contact themselves (via XMPP).
 * Users can only edit their OWN profile photo in Settings > Profile.
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
  Platform,
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
import {
  getContactDisplayName,
  hasNavigableAddress,
} from '@/services/interfaces';
import type { Contact, ContactAddress } from '@/services/interfaces';
import type { ContactStackParams } from '@/navigation';

type NavigationProp = NativeStackNavigationProp<ContactStackParams, 'ContactDetail'>;
type ContactDetailRouteProp = RouteProp<ContactStackParams, 'ContactDetail'>;

/** Format an address into display lines (street, postcode+city, country) */
function formatAddressLines(address: ContactAddress): string[] {
  const lines: string[] = [];
  if (address.street) lines.push(address.street);
  const cityLine = [address.postalCode, address.city].filter(Boolean).join(' ');
  if (cityLine) lines.push(cityLine);
  if (address.country) lines.push(address.country);
  return lines;
}

/** Build a maps URL for navigation */
function buildMapsUrl(address: ContactAddress): string {
  const parts = [address.street, address.postalCode, address.city, address.country]
    .filter(Boolean)
    .join(', ');
  const encoded = encodeURIComponent(parts);

  if (Platform.OS === 'ios') {
    return `maps:?address=${encoded}`;
  }
  // Android: geo intent with query
  return `geo:0,0?q=${encoded}`;
}

/** Calculate age or years from an ISO date string */
function calculateYears(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  const now = new Date();
  let years = now.getFullYear() - year;
  const monthDiff = now.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) {
    years--;
  }
  return years;
}

/** Calculate age at a specific date (e.g., age at death) */
function calculateYearsBetween(birthIso: string, endIso: string): number {
  const [bYear, bMonth, bDay] = birthIso.split('-').map(Number);
  const [eYear, eMonth, eDay] = endIso.split('-').map(Number);
  let years = eYear - bYear;
  if (eMonth < bMonth || (eMonth === bMonth && eDay < bDay)) {
    years--;
  }
  return years;
}

/** Format a date for display: "15 maart 1948" */
function formatDateDisplay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

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

  const displayName = useMemo(
    () => (contact ? getContactDisplayName(contact) : ''),
    [contact],
  );

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
    navigateToModuleInOtherPane('chats', {
      screen: 'ChatDetail',
      params: { chatId, name: displayName, contactJid: contact.jid },
    });
    console.info('[ContactDetail] Navigated to chat with', displayName);
  }, [contact, displayName, triggerFeedback, navigateToModuleInOtherPane]);

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
      navigation.navigate('VerifyContact' as never, { jid: contact.jid, name: displayName } as never);
    }
  }, [contact, displayName, navigation, triggerFeedback]);

  const handleDelete = useCallback(() => {
    void triggerFeedback('tap');
    if (!contact) return;

    Alert.alert(
      t('contacts.deleteTitle'),
      t('contacts.deleteConfirm', { name: displayName }),
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
  }, [contact, displayName, jid, navigation, t, triggerFeedback]);

  const handleNavigateToMaps = useCallback(() => {
    if (!contact?.address) return;
    void triggerFeedback('tap');
    const url = buildMapsUrl(contact.address);
    void Linking.openURL(url);
  }, [contact, triggerFeedback]);

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

  const addressLines = contact.address ? formatAddressLines(contact.address) : [];
  const showNavigationButton = hasNavigableAddress(contact.address);

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.contentContainer}>
      {/* Profile header with large photo */}
      <View style={styles.profileHeader}>
        <ContactAvatar
          name={displayName}
          photoUrl={contact.photoUrl}
          size={120}
        />
        <Text style={[styles.contactName, { color: themeColors.textPrimary }]}>{displayName}</Text>

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

        {contact.phoneNumber && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('contacts.phoneLabel')}</Text>
            <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>{contact.phoneNumber}</Text>
          </View>
        )}
      </View>

      {/* Address section */}
      {addressLines.length > 0 && (
        <View style={[styles.detailsSection, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('contacts.address.title')}</Text>

          {addressLines.map((line, index) => (
            <Text
              key={index}
              style={[styles.addressLine, { color: themeColors.textPrimary }]}
            >
              {line}
            </Text>
          ))}

          {/* Navigation button */}
          {showNavigationButton && (
            <TouchableOpacity
              style={[styles.navigationButton, { backgroundColor: themeColors.primary }]}
              onPress={handleNavigateToMaps}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('contacts.address.navigate')}
              accessibilityHint={t('contacts.address.navigateHint', { name: contact.firstName })}
            >
              <Icon name="navigate" size={22} color={themeColors.textOnPrimary} />
              <Text style={[styles.navigationButtonText, { color: themeColors.textOnPrimary }]}>
                {t('contacts.address.navigate')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Dates section */}
      <View style={[styles.detailsSection, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('contacts.dates.title')}</Text>

        {/* Birth date */}
        {contact.birthDate ? (
          <View style={styles.dateRow}>
            <View style={styles.dateInfo}>
              <Text style={[styles.dateLabel, { color: themeColors.textSecondary }]}>{t('contacts.dates.birthDate')}</Text>
              <Text style={[styles.dateValue, { color: themeColors.textPrimary }]}>
                {formatDateDisplay(contact.birthDate)}
              </Text>
            </View>
            <Text style={[styles.dateCalculation, { color: themeColors.textSecondary }]}>
              {contact.isDeceased && contact.deathDate
                ? t('contacts.dates.ageAtDeath', {
                    name: contact.firstName,
                    years: calculateYearsBetween(contact.birthDate, contact.deathDate),
                  })
                : t('contacts.dates.ageCurrent', {
                    name: contact.firstName,
                    years: calculateYears(contact.birthDate),
                  })
              }
            </Text>
          </View>
        ) : (
          <Text style={[styles.dateEmpty, { color: themeColors.textTertiary }]}>
            {t('contacts.dates.noBirthDate')}
          </Text>
        )}

        {/* Wedding date */}
        {contact.weddingDate && (
          <View style={styles.dateRow}>
            <View style={styles.dateInfo}>
              <Text style={[styles.dateLabel, { color: themeColors.textSecondary }]}>{t('contacts.dates.weddingDate')}</Text>
              <Text style={[styles.dateValue, { color: themeColors.textPrimary }]}>
                {formatDateDisplay(contact.weddingDate)}
              </Text>
            </View>
            <Text style={[styles.dateCalculation, { color: themeColors.textSecondary }]}>
              {t('contacts.dates.weddingYears', { years: calculateYears(contact.weddingDate) })}
            </Text>
          </View>
        )}

        {/* Death date (only if deceased) */}
        {contact.isDeceased && contact.deathDate && (
          <View style={styles.dateRow}>
            <View style={styles.dateInfo}>
              <Text style={[styles.dateLabel, { color: themeColors.textSecondary }]}>{t('contacts.dates.deathDate')}</Text>
              <Text style={[styles.dateValue, { color: themeColors.textPrimary }]}>
                {formatDateDisplay(contact.deathDate)}
              </Text>
            </View>
            <Text style={[styles.dateCalculation, { color: themeColors.textSecondary }]}>
              {t('contacts.dates.deathYearsAgo', { years: calculateYears(contact.deathDate) })}
            </Text>
          </View>
        )}
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
          accessibilityHint={t('accessibility.startChatHint', { name: displayName })}
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
            accessibilityHint={t('accessibility.voiceCallHint', { name: displayName })}
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
            accessibilityHint={t('accessibility.videoCallHint', { name: displayName })}
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
          accessibilityHint={t('accessibility.deleteContactHint', { name: displayName })}
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
    marginBottom: spacing.lg,
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
  // Address styles
  addressLine: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  navigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
    backgroundColor: colors.primary,
  },
  navigationButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  // Date styles
  dateRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  dateInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dateLabel: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  dateValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  dateCalculation: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  dateEmpty: {
    ...typography.body,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  // Action buttons
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
