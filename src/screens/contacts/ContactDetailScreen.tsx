/**
 * ContactDetailScreen — View and manage a single contact
 *
 * Senior-inclusive design:
 * - Large profile photo (120px) for easy recognition
 * - Clear verification badge
 * - Large action buttons (60pt+) AT THE TOP for quick access
 * - Editable contact fields (phone, email, address, dates)
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
  TextInput,
  Alert,
  Keyboard,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { ContactAvatar, Icon, DateTimePickerModal, HapticTouchable, ScrollViewWithIndicator, ErrorView } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useScrollToField } from '@/hooks/useScrollToField';
import { useCall } from '@/contexts/CallContext';
import { useNavigateToModule } from '@/hooks/useNavigateToModule';
import { useContactGroups } from '@/hooks/useContactGroups';
import { removeContactFromAllGroups } from '@/services/contacts';
import {
  getContactDisplayName,
  hasNavigableAddress,
} from '@/services/interfaces';
import type { Contact, ContactAddress } from '@/services/interfaces';
import { ServiceContainer } from '@/services/container';
import type { ContactStackParams } from '@/navigation';
import {
  STANDARD_CATEGORIES,
  CUSTOM_CATEGORIES_STORAGE_KEY,
  type AgendaCategoryDef,
  type CustomCategory,
} from '@/constants/agendaCategories';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { triggerFeedback } = useFeedback();
  const { accentColor } = useAccentColor();
  const { initiateCall, isInCall } = useCall();
  const route = useRoute<ContactDetailRouteProp>();
  const { jid } = route.params;
  const themeColors = useColors();
  const { navigateToModuleInOtherPane } = useNavigateToModule();

  const { groups, addContacts, removeContacts } = useContactGroups();
  const { scrollRef, registerField, scrollToField, getFieldFocusHandler, handleScroll: handleScrollToField } = useScrollToField();

  const [notification, setNotification] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
    onRetry?: () => void;
  } | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [editCategories, setEditCategories] = useState<string[]>([]);

  // Load custom categories on mount
  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY).then(json => {
      if (json) {
        try { setCustomCategories(JSON.parse(json)); } catch { /* ignore */ }
      }
    });
  }, []);

  // Edit state for all editable fields
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editPostalCode, setEditPostalCode] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editBirthDate, setEditBirthDate] = useState<string | undefined>(undefined);
  const [editWeddingDate, setEditWeddingDate] = useState<string | undefined>(undefined);
  const [editDeathDate, setEditDeathDate] = useState<string | undefined>(undefined);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [showWeddingDatePicker, setShowWeddingDatePicker] = useState(false);
  const [showDeathDatePicker, setShowDeathDatePicker] = useState(false);

  // Locale mapping for native date picker
  const pickerLocale = useMemo(() => {
    const lang = i18n.language;
    const map: Record<string, string> = {
      nl: 'nl-NL', en: 'en-US', 'en-GB': 'en-GB', de: 'de-DE',
      fr: 'fr-FR', es: 'es-ES', it: 'it-IT', no: 'nb-NO',
      sv: 'sv-SE', da: 'da-DK', pt: 'pt-PT', 'pt-BR': 'pt-BR', pl: 'pl-PL',
    };
    return map[lang] || 'en-US';
  }, [i18n.language]);

  const formatDateForPicker = useCallback((isoDate: string | undefined): string => {
    if (!isoDate) return '-';
    const d = new Date(isoDate + 'T00:00:00');
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(pickerLocale, { day: 'numeric', month: 'long', year: 'numeric' });
  }, [pickerLocale]);

  const parseDateValue = useCallback((isoDate: string | undefined): Date => {
    if (!isoDate) return new Date();
    const d = new Date(isoDate + 'T00:00:00');
    return isNaN(d.getTime()) ? new Date() : d;
  }, []);

  useEffect(() => {
    const loadContact = async () => {
      try {
        const db = ServiceContainer.database;
        const contactData = await db.getContact(jid);
        setContact(contactData ?? null);
      } catch (error) {
        console.error('Failed to load contact:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadContact();
  }, [jid]);

  // Initialize edit fields when contact loads
  useEffect(() => {
    if (contact) {
      setEditPhone(contact.phoneNumber ?? '');
      setEditEmail(contact.email ?? '');
      setEditStreet(contact.address?.street ?? '');
      setEditPostalCode(contact.address?.postalCode ?? '');
      setEditCity(contact.address?.city ?? '');
      setEditCountry(contact.address?.country ?? '');
      setEditBirthDate(contact.birthDate);
      setEditWeddingDate(contact.weddingDate);
      setEditDeathDate(contact.deathDate);
      // Parse categories from contact (JSON array string)
      try {
        const cats = contact.categories ? JSON.parse(contact.categories as string) : [];
        setEditCategories(Array.isArray(cats) ? cats : []);
      } catch {
        setEditCategories([]);
      }
    }
  }, [contact]);

  const displayName = useMemo(
    () => (contact ? getContactDisplayName(contact) : ''),
    [contact],
  );

  // Groups this contact belongs to
  const contactGroups = useMemo(
    () => groups.filter(g => g.contactJids.includes(jid)),
    [groups, jid],
  );

  // Toggle ICE (In Case of Emergency) status
  const handleToggleICE = useCallback(async () => {
    void triggerFeedback('tap');
    if (!contact) return;

    const updatedContact: Contact = {
      ...contact,
      isEmergencyContact: !contact.isEmergencyContact,
    };
    setContact(updatedContact);
    try {
      await ServiceContainer.database.saveContact(updatedContact);
      console.info('[ContactDetail] ICE toggled:', !contact.isEmergencyContact);
    } catch (error) {
      console.error('[ContactDetail] Failed to persist ICE toggle:', error);
    }
  }, [contact, triggerFeedback]);

  // Toggle group membership for this contact
  const handleToggleGroup = useCallback(async (groupId: string) => {
    void triggerFeedback('tap');
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const isMember = group.contactJids.includes(jid);
    if (isMember) {
      await removeContacts(groupId, [jid]);
    } else {
      await addContacts(groupId, [jid]);
    }
  }, [groups, jid, addContacts, removeContacts, triggerFeedback]);

  // All available categories (standard + custom) for the picker
  const allCategories = useMemo((): (AgendaCategoryDef | CustomCategory)[] => {
    return [
      ...STANDARD_CATEGORIES,
      ...customCategories,
    ];
  }, [customCategories]);

  // Toggle a category for this contact
  const handleToggleCategory = useCallback((categoryId: string) => {
    void triggerFeedback('tap');
    setEditCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      }
      return [...prev, categoryId];
    });
  }, [triggerFeedback]);

  const handleStartEdit = useCallback(() => {
    void triggerFeedback('tap');
    setIsEditing(true);
  }, [triggerFeedback]);

  const handleSave = useCallback(async () => {
    void triggerFeedback('tap');
    if (!contact) return;

    // Build updated contact
    const updatedContact: Contact = {
      ...contact,
      phoneNumber: editPhone.trim() || undefined,
      email: editEmail.trim() || undefined,
      address: (editStreet || editPostalCode || editCity || editCountry)
        ? {
            street: editStreet.trim() || undefined,
            postalCode: editPostalCode.trim() || undefined,
            city: editCity.trim() || undefined,
            country: editCountry.trim() || undefined,
          }
        : undefined,
      birthDate: editBirthDate,
      weddingDate: editWeddingDate,
      deathDate: editDeathDate,
      categories: editCategories.length > 0 ? JSON.stringify(editCategories) : undefined,
    };

    // Persist to database and update local state
    try {
      await ServiceContainer.database.saveContact(updatedContact);
      setContact(updatedContact);
      setIsEditing(false);
      console.info('[ContactDetail] Contact saved:', displayName);
    } catch (error) {
      console.error('[ContactDetail] Failed to save contact:', error);
    }
  }, [contact, displayName, editPhone, editEmail, editStreet, editPostalCode, editCity, editCountry, editBirthDate, editWeddingDate, editDeathDate, editCategories, triggerFeedback]);

  const handleCancelEdit = useCallback(() => {
    void triggerFeedback('tap');
    // Reset edit fields to current contact values
    if (contact) {
      setEditPhone(contact.phoneNumber ?? '');
      setEditEmail(contact.email ?? '');
      setEditStreet(contact.address?.street ?? '');
      setEditPostalCode(contact.address?.postalCode ?? '');
      setEditCity(contact.address?.city ?? '');
      setEditCountry(contact.address?.country ?? '');
      setEditBirthDate(contact.birthDate);
      setEditWeddingDate(contact.weddingDate);
      setEditDeathDate(contact.deathDate);
      try {
        const cats = contact.categories ? JSON.parse(contact.categories as string) : [];
        setEditCategories(Array.isArray(cats) ? cats : []);
      } catch {
        setEditCategories([]);
      }
    }
    setIsEditing(false);
  }, [contact, triggerFeedback]);

  const handleStartChat = useCallback(async () => {
    void triggerFeedback('tap');
    if (!contact) return;

    // Generate proper chat ID (format: chat:jid1:jid2, sorted)
    let myJid = 'f6a7b8c9-d0e1-4f6a-3b7c-4d5e6f7a8b9c@commeazy.local'; // Default fallback
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
      setNotification({ type: 'warning', title: t('calls.alreadyInCall'), message: t('calls.alreadyInCallMessage') });
      return;
    }

    try {
      await initiateCall(contact.jid, 'voice');
    } catch (error) {
      console.error('[ContactDetail] Failed to start voice call:', error);
      setNotification({ type: 'error', title: t('calls.callFailed'), message: t('calls.callFailedMessage') });
    }
  }, [contact, isInCall, initiateCall, t, triggerFeedback]);

  const handleVideoCall = useCallback(async () => {
    console.info('[ContactDetail] handleVideoCall tapped, contact:', contact?.jid, 'isInCall:', isInCall);
    void triggerFeedback('tap');
    if (!contact) return;

    if (isInCall) {
      setNotification({ type: 'warning', title: t('calls.alreadyInCall'), message: t('calls.alreadyInCallMessage') });
      return;
    }

    try {
      await initiateCall(contact.jid, 'video');
    } catch (error) {
      console.error('[ContactDetail] Failed to start video call:', error);
      setNotification({ type: 'error', title: t('calls.callFailed'), message: t('calls.callFailedMessage') });
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
                // Remove contact from all groups (referential integrity)
                await removeContactFromAllGroups(jid);

                await ServiceContainer.database.deleteContact(jid);
                navigation.goBack();
              } catch (error) {
                console.error('Failed to delete contact:', error);
                setNotification({ type: 'error', title: t('errors.genericTitle'), message: t('errors.genericError') });
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
        <HapticTouchable hapticDisabled
          style={[styles.backButton, { backgroundColor: themeColors.primary }]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.backButton')}
        >
          <Text style={[styles.backButtonText, { color: themeColors.textOnPrimary }]}>{t('common.goBack')}</Text>
        </HapticTouchable>
      </View>
    );
  }

  const addressLines = contact.address ? formatAddressLines(contact.address) : [];
  const showNavigationButton = hasNavigableAddress(contact.address);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
    <ScrollViewWithIndicator ref={scrollRef} style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled" onScroll={handleScrollToField} scrollEventThrottle={16}>
      {notification && (
        <ErrorView
          type={notification.type}
          title={notification.title}
          message={notification.message}
          onRetry={notification.onRetry}
          autoDismiss={notification.type === 'success' || notification.type === 'info' ? 3000 : undefined}
          onDismiss={() => setNotification(null)}
        />
      )}

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

      {/* Action buttons — RIGHT AFTER profile header for quick access */}
      <View style={styles.actionsContainer}>
        {/* Primary: Chat button */}
        <HapticTouchable hapticDisabled
          style={[styles.actionButton, styles.primaryButton, { backgroundColor: themeColors.primary }]}
          onPress={handleStartChat}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('contacts.startChat')}
          accessibilityHint={t('accessibility.startChatHint', { name: displayName })}
        >
          <Icon name="chatbubble" size={24} color={themeColors.textOnPrimary} />
          <Text style={[styles.primaryButtonText, { color: themeColors.textOnPrimary }]}>{t('contacts.startChat')}</Text>
        </HapticTouchable>

        {/* Call buttons row: Voice + Video side by side */}
        <View style={styles.callButtonsRow}>
          {/* Voice call button */}
          <HapticTouchable hapticDisabled
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
          </HapticTouchable>

          {/* Video call button */}
          <HapticTouchable hapticDisabled
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
          </HapticTouchable>
        </View>
      </View>

      {/* ICE (In Case of Emergency) toggle */}
      <HapticTouchable
        style={[
          styles.iceToggleRow,
          {
            backgroundColor: contact.isEmergencyContact ? '#FFF3E0' : themeColors.surface,
            borderColor: contact.isEmergencyContact ? '#E65100' : themeColors.border,
          },
        ]}
        onPress={handleToggleICE}
        accessibilityRole="switch"
        accessibilityState={{ checked: contact.isEmergencyContact === true }}
        accessibilityLabel={t('contacts.iceToggle', 'Noodcontact (ICE)')}
        accessibilityHint={t('contacts.iceToggleHint', 'Markeer als noodcontact voor noodsituaties')}
      >
        <Text style={styles.iceEmoji}>{'\u26A0\uFE0F'}</Text>
        <View style={styles.iceTextContainer}>
          <Text style={[styles.iceLabel, { color: themeColors.textPrimary }]}>
            {t('contacts.iceToggle', 'Noodcontact (ICE)')}
          </Text>
          <Text style={[styles.iceDescription, { color: themeColors.textSecondary }]}>
            {t('contacts.iceDescription', 'Zichtbaar bij noodoproepen')}
          </Text>
        </View>
        <View
          style={[
            styles.iceIndicator,
            {
              backgroundColor: contact.isEmergencyContact ? '#E65100' : themeColors.border,
            },
          ]}
        >
          <Text style={styles.iceIndicatorText}>
            {contact.isEmergencyContact ? '\u2713' : ''}
          </Text>
        </View>
      </HapticTouchable>

      {/* Group membership section */}
      <View style={[styles.detailsSection, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
          {t('contacts.groups.title', 'Groepen')}
        </Text>

        {contactGroups.length > 0 ? (
          contactGroups.map(group => (
            <View key={group.id} style={styles.groupRow}>
              <Text style={[styles.groupEmoji, { color: themeColors.textPrimary }]}>
                {group.emoji || '\uD83D\uDC65'}
              </Text>
              <Text style={[styles.groupName, { color: themeColors.textPrimary }]}>
                {group.name}
              </Text>
              <HapticTouchable
                onPress={() => handleToggleGroup(group.id)}
                style={[styles.groupRemoveButton, { borderColor: themeColors.border }]}
                accessibilityRole="button"
                accessibilityLabel={t('contacts.groups.removeFrom', { group: group.name })}
              >
                <Icon name="x" size={16} color={themeColors.textSecondary} />
              </HapticTouchable>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>
            {t('contacts.groups.noGroups', 'Niet in een groep')}
          </Text>
        )}

        {/* Add to group button */}
        <HapticTouchable
          style={[styles.addToGroupButton, { borderColor: themeColors.border }]}
          onPress={() => setShowGroupPicker(!showGroupPicker)}
          accessibilityRole="button"
          accessibilityLabel={t('contacts.groups.addToGroup', 'Toevoegen aan groep')}
        >
          <Icon name="plus" size={20} color={themeColors.primary} />
          <Text style={[styles.addToGroupText, { color: themeColors.primary }]}>
            {t('contacts.groups.addToGroup', 'Toevoegen aan groep')}
          </Text>
        </HapticTouchable>

        {/* Inline group picker (toggled) */}
        {showGroupPicker && groups.length > 0 && (
          <View style={styles.groupPickerContainer}>
            {groups
              .filter(g => !g.contactJids.includes(jid))
              .map(group => (
                <HapticTouchable
                  key={group.id}
                  style={[styles.groupPickerItem, { borderColor: themeColors.border }]}
                  onPress={() => {
                    void handleToggleGroup(group.id);
                    setShowGroupPicker(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('contacts.groups.addTo', { group: group.name })}
                >
                  <Text style={styles.groupEmoji}>{group.emoji || '\uD83D\uDC65'}</Text>
                  <Text style={[styles.groupName, { color: themeColors.textPrimary }]}>{group.name}</Text>
                  <Icon name="plus" size={16} color={themeColors.primary} />
                </HapticTouchable>
              ))
            }
            {groups.filter(g => !g.contactJids.includes(jid)).length === 0 && (
              <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>
                {t('contacts.groups.alreadyInAll', 'Al in alle groepen')}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Agenda categories section (required — min 1) */}
      <View style={[styles.detailsSection, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
          {t('contacts.categories.title', 'Agenda categorieën')} {isEditing ? '*' : ''}
        </Text>

        {isEditing ? (
          <>
            <Text style={[styles.categoriesHint, { color: editCategories.length === 0 ? themeColors.error : themeColors.textSecondary }]}>
              {t('contacts.categories.required', 'Kies minimaal één categorie')}
            </Text>
            <View style={styles.categoryGrid}>
              {allCategories.map(cat => {
                const isSelected = editCategories.includes(cat.id);
                return (
                  <HapticTouchable
                    key={cat.id}
                    style={styles.categoryGridItem}
                    onPress={() => handleToggleCategory(cat.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={cat.nameKey ? t(cat.nameKey) : ('name' in cat ? (cat as CustomCategory).name : cat.id)}
                  >
                    <View
                      style={[
                        styles.categoryCircle,
                        {
                          backgroundColor: isSelected ? themeColors.primary : themeColors.background,
                          borderColor: isSelected ? themeColors.primary : themeColors.border,
                        },
                      ]}
                    >
                      <Text style={styles.categoryEmoji}>{cat.icon}</Text>
                    </View>
                    <Text
                      style={[
                        styles.categoryLabel,
                        { color: isSelected ? themeColors.primary : themeColors.textPrimary },
                      ]}
                      numberOfLines={2}
                    >
                      {cat.nameKey ? t(cat.nameKey) : ('name' in cat ? (cat as CustomCategory).name : cat.id)}
                    </Text>
                  </HapticTouchable>
                );
              })}
            </View>
          </>
        ) : (
          <>
            {editCategories.length > 0 ? (
              <View style={styles.categoryChipsRow}>
                {editCategories.map(catId => {
                  const cat = allCategories.find(c => c.id === catId);
                  if (!cat) return null;
                  const label = cat.nameKey ? t(cat.nameKey) : ('name' in cat ? (cat as CustomCategory).name : cat.id);
                  return (
                    <View key={catId} style={[styles.categoryChip, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                      <Text style={styles.categoryChipEmoji}>{cat.icon}</Text>
                      <Text style={[styles.categoryChipText, { color: themeColors.textPrimary }]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>
                {t('contacts.categories.none', 'Geen categorieën')}
              </Text>
            )}
          </>
        )}
      </View>

      {/* Save / Cancel bar (only visible when editing) */}
      {isEditing && (
        <View style={styles.editBar}>
          <HapticTouchable hapticDisabled
            style={[styles.editBarButton, { backgroundColor: themeColors.primary, opacity: editCategories.length === 0 ? 0.4 : 1 }]}
            onPress={() => void handleSave()}
            activeOpacity={0.7}
            disabled={editCategories.length === 0}
            accessibilityRole="button"
            accessibilityLabel={t('contacts.save')}
            accessibilityState={{ disabled: editCategories.length === 0 }}
          >
            <Icon name="checkmark" size={22} color={themeColors.textOnPrimary} />
            <Text style={[styles.editBarButtonText, { color: themeColors.textOnPrimary }]}>{t('contacts.save')}</Text>
          </HapticTouchable>
          <HapticTouchable hapticDisabled
            style={[styles.editBarButton, { backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.border }]}
            onPress={handleCancelEdit}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text style={[styles.editBarButtonText, { color: themeColors.textPrimary }]}>{t('common.cancel')}</Text>
          </HapticTouchable>
        </View>
      )}

      {/* Contact details section — phone + email */}
      <View style={[styles.detailsSection, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('contacts.details')}</Text>

        {/* Phone number */}
        {isEditing ? (
          <View ref={registerField('phone')} style={styles.editFieldContainer}>
            <Text style={[styles.editFieldLabel, { color: themeColors.textSecondary }]}>{t('contacts.phoneLabel')}</Text>
            <TextInput
              style={[styles.editFieldInput, { color: themeColors.textPrimary, backgroundColor: themeColors.background, borderColor: themeColors.border }]}
              value={editPhone}
              onChangeText={setEditPhone}
              onFocus={getFieldFocusHandler('phone')}
              placeholder={t('contacts.phonePlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              keyboardType="phone-pad"
              accessibilityLabel={t('contacts.phoneLabel')}
            />
          </View>
        ) : (
          contact.phoneNumber ? (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('contacts.phoneLabel')}</Text>
              <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>{contact.phoneNumber}</Text>
            </View>
          ) : null
        )}

        {/* Email */}
        {isEditing ? (
          <View ref={registerField('email')} style={styles.editFieldContainer}>
            <Text style={[styles.editFieldLabel, { color: themeColors.textSecondary }]}>{t('contacts.emailLabel')}</Text>
            <TextInput
              style={[styles.editFieldInput, { color: themeColors.textPrimary, backgroundColor: themeColors.background, borderColor: themeColors.border }]}
              value={editEmail}
              onChangeText={setEditEmail}
              onFocus={getFieldFocusHandler('email')}
              placeholder={t('contacts.emailPlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t('contacts.emailLabel')}
            />
          </View>
        ) : (
          contact.email ? (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('contacts.emailLabel')}</Text>
              <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>{contact.email}</Text>
            </View>
          ) : null
        )}
      </View>

      {/* Address section */}
      <View style={[styles.detailsSection, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('contacts.address.title')}</Text>

        {isEditing ? (
          <>
            <View ref={registerField('street')} style={styles.editFieldContainer}>
              <Text style={[styles.editFieldLabel, { color: themeColors.textSecondary }]}>{t('contacts.address.street')}</Text>
              <TextInput
                style={[styles.editFieldInput, { color: themeColors.textPrimary, backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                value={editStreet}
                onChangeText={setEditStreet}
                onFocus={getFieldFocusHandler('street')}
                placeholder={t('contacts.address.street')}
                placeholderTextColor={themeColors.textTertiary}
                accessibilityLabel={t('contacts.address.street')}
              />
            </View>
            <View ref={registerField('postalCode')} style={styles.editFieldContainer}>
              <Text style={[styles.editFieldLabel, { color: themeColors.textSecondary }]}>{t('contacts.address.postalCode')}</Text>
              <TextInput
                style={[styles.editFieldInput, { color: themeColors.textPrimary, backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                value={editPostalCode}
                onChangeText={setEditPostalCode}
                onFocus={getFieldFocusHandler('postalCode')}
                placeholder={t('contacts.address.postalCode')}
                placeholderTextColor={themeColors.textTertiary}
                accessibilityLabel={t('contacts.address.postalCode')}
              />
            </View>
            <View ref={registerField('city')} style={styles.editFieldContainer}>
              <Text style={[styles.editFieldLabel, { color: themeColors.textSecondary }]}>{t('contacts.address.city')}</Text>
              <TextInput
                style={[styles.editFieldInput, { color: themeColors.textPrimary, backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                value={editCity}
                onChangeText={setEditCity}
                onFocus={getFieldFocusHandler('city')}
                placeholder={t('contacts.address.city')}
                placeholderTextColor={themeColors.textTertiary}
                accessibilityLabel={t('contacts.address.city')}
              />
            </View>
            <View ref={registerField('country')} style={styles.editFieldContainer}>
              <Text style={[styles.editFieldLabel, { color: themeColors.textSecondary }]}>{t('contacts.address.country')}</Text>
              <TextInput
                style={[styles.editFieldInput, { color: themeColors.textPrimary, backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                value={editCountry}
                onChangeText={setEditCountry}
                onFocus={getFieldFocusHandler('country')}
                placeholder={t('contacts.address.country')}
                placeholderTextColor={themeColors.textTertiary}
                accessibilityLabel={t('contacts.address.country')}
              />
            </View>
          </>
        ) : (
          <>
            {addressLines.length > 0 ? (
              <>
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
                  <HapticTouchable hapticDisabled
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
                  </HapticTouchable>
                )}
              </>
            ) : (
              <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>
                {t('contacts.address.noAddress')}
              </Text>
            )}
          </>
        )}
      </View>

      {/* Dates section */}
      <View style={[styles.detailsSection, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('contacts.dates.title')}</Text>

        {isEditing ? (
          <>
            {/* Birth date editor */}
            <View ref={registerField('birthDate')} style={styles.editFieldContainer}>
              <Text style={[styles.editFieldLabel, { color: themeColors.textSecondary }]}>{t('contacts.dates.birthDate')}</Text>
              <HapticTouchable hapticDisabled
                style={[styles.datePickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowBirthDatePicker(true), 100); }}
                accessibilityRole="button"
                accessibilityLabel={t('contacts.dates.birthDate')}
              >
                <Text style={[styles.datePickerValue, editBirthDate ? { color: accentColor.primary } : { color: themeColors.textTertiary }]}>
                  {formatDateForPicker(editBirthDate)}
                </Text>
                <Text style={styles.datePickerEditIcon}>✏️</Text>
              </HapticTouchable>
            </View>

            {/* Wedding date editor */}
            <View ref={registerField('weddingDate')} style={styles.editFieldContainer}>
              <Text style={[styles.editFieldLabel, { color: themeColors.textSecondary }]}>{t('contacts.dates.weddingDate')}</Text>
              <HapticTouchable hapticDisabled
                style={[styles.datePickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowWeddingDatePicker(true), 100); }}
                accessibilityRole="button"
                accessibilityLabel={t('contacts.dates.weddingDate')}
              >
                <Text style={[styles.datePickerValue, editWeddingDate ? { color: accentColor.primary } : { color: themeColors.textTertiary }]}>
                  {formatDateForPicker(editWeddingDate)}
                </Text>
                <Text style={styles.datePickerEditIcon}>✏️</Text>
              </HapticTouchable>
            </View>

            {/* Death date editor */}
            <View ref={registerField('deathDate')} style={styles.editFieldContainer}>
              <Text style={[styles.editFieldLabel, { color: themeColors.textSecondary }]}>{t('contacts.dates.deathDate')}</Text>
              <HapticTouchable hapticDisabled
                style={[styles.datePickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowDeathDatePicker(true), 100); }}
                accessibilityRole="button"
                accessibilityLabel={t('contacts.dates.deathDate')}
              >
                <Text style={[styles.datePickerValue, editDeathDate ? { color: accentColor.primary } : { color: themeColors.textTertiary }]}>
                  {formatDateForPicker(editDeathDate)}
                </Text>
                <Text style={styles.datePickerEditIcon}>✏️</Text>
              </HapticTouchable>
            </View>

            {/* Date picker modals */}
            <DateTimePickerModal
              visible={showBirthDatePicker}
              title={t('contacts.dates.birthDate')}
              value={parseDateValue(editBirthDate)}
              mode="date"
              moduleId="contacts"
              onChange={(_event, selectedDate) => {
                if (selectedDate) setEditBirthDate(selectedDate.toISOString().split('T')[0]);
              }}
              onClose={() => { setShowBirthDatePicker(false); scrollToField('birthDate', { isModalReturn: true }); }}
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
              locale={pickerLocale}
            />

            <DateTimePickerModal
              visible={showWeddingDatePicker}
              title={t('contacts.dates.weddingDate')}
              value={parseDateValue(editWeddingDate)}
              mode="date"
              moduleId="contacts"
              onChange={(_event, selectedDate) => {
                if (selectedDate) setEditWeddingDate(selectedDate.toISOString().split('T')[0]);
              }}
              onClose={() => { setShowWeddingDatePicker(false); scrollToField('weddingDate', { isModalReturn: true }); }}
              maximumDate={new Date(new Date().getFullYear() + 5, 11, 31)}
              minimumDate={new Date(1940, 0, 1)}
              locale={pickerLocale}
            />

            <DateTimePickerModal
              visible={showDeathDatePicker}
              title={t('contacts.dates.deathDate')}
              value={parseDateValue(editDeathDate)}
              mode="date"
              moduleId="contacts"
              onChange={(_event, selectedDate) => {
                if (selectedDate) setEditDeathDate(selectedDate.toISOString().split('T')[0]);
              }}
              onClose={() => { setShowDeathDatePicker(false); scrollToField('deathDate', { isModalReturn: true }); }}
              maximumDate={new Date()}
              minimumDate={new Date(1940, 0, 1)}
              locale={pickerLocale}
            />
          </>
        ) : (
          <>
            {/* Birth date display */}
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
              <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>
                {t('contacts.dates.noBirthDate')}
              </Text>
            )}

            {/* Wedding date display */}
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
          </>
        )}
      </View>

      {/* Bottom actions: Edit + Verify + Delete */}
      <View style={styles.bottomActionsContainer}>
        {/* Edit button (only when not editing) */}
        {!isEditing && (
          <HapticTouchable hapticDisabled
            style={[styles.editBarButton, { backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.border }]}
            onPress={handleStartEdit}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('contacts.edit')}
          >
            <Icon name="pencil" size={22} color={themeColors.textPrimary} />
            <Text style={[styles.editBarButtonText, { color: themeColors.textPrimary }]}>{t('contacts.edit')}</Text>
          </HapticTouchable>
        )}

        {/* Verify/Reverify button */}
        {!contact.verified && (
          <HapticTouchable hapticDisabled
            style={[styles.actionButton, styles.warningButton]}
            onPress={handleVerify}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('contacts.verify')}
          >
            <Text style={[styles.warningButtonText, { color: themeColors.textOnPrimary }]}>{t('contacts.verify')}</Text>
          </HapticTouchable>
        )}

        {/* Delete button - at bottom, less prominent */}
        <HapticTouchable hapticDisabled
          style={[styles.actionButton, styles.dangerButton, { backgroundColor: themeColors.background, borderColor: themeColors.error }]}
          onPress={handleDelete}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('contacts.delete')}
          accessibilityHint={t('accessibility.deleteContactHint', { name: displayName })}
        >
          <Text style={[styles.dangerButtonText, { color: themeColors.error }]}>{t('contacts.delete')}</Text>
        </HapticTouchable>
      </View>

      {/* Extra bottom padding to ensure last fields scroll above keyboard */}
      <View style={{ height: spacing.xxl }} />
    </ScrollViewWithIndicator>
    </KeyboardAvoidingView>
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
    marginBottom: spacing.lg,
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
  // Action buttons — at the top
  actionsContainer: {
    gap: spacing.md,
    marginBottom: spacing.lg,
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
    backgroundColor: colors.info, // Blue for video calls
  },
  callButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
    fontSize: 16,
  },
  // Edit bar
  editBar: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  editBarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
  },
  editBarButtonText: {
    ...typography.button,
    fontSize: 16,
  },
  // Details sections
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
  // Edit field styles
  editFieldContainer: {
    marginBottom: spacing.md,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: touchTargets.comfortable,
  },
  datePickerValue: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  datePickerEditIcon: {
    fontSize: 18,
    marginLeft: spacing.sm,
  },
  editFieldLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  editFieldInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
  },
  emptyText: {
    ...typography.body,
    color: colors.textTertiary,
    fontStyle: 'italic',
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
  // Bottom actions
  bottomActionsContainer: {
    gap: spacing.md,
    marginTop: spacing.md,
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
  // ICE toggle
  iceToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
    minHeight: touchTargets.minimum,
    gap: spacing.md,
  },
  iceEmoji: {
    fontSize: 24,
  },
  iceTextContainer: {
    flex: 1,
  },
  iceLabel: {
    ...typography.body,
    fontWeight: '700',
  },
  iceDescription: {
    ...typography.label,
    marginTop: 2,
  },
  iceIndicator: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iceIndicatorText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  // Group membership
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  groupEmoji: {
    fontSize: 20,
  },
  groupName: {
    ...typography.body,
    flex: 1,
  },
  groupRemoveButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    minHeight: touchTargets.minimum,
  },
  addToGroupText: {
    ...typography.body,
    fontWeight: '600',
  },
  groupPickerContainer: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  groupPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: touchTargets.minimum,
  },
  // Category grid (edit mode — 3-wide grid with circular emoji backgrounds)
  categoriesHint: {
    ...typography.label,
    marginBottom: spacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryGridItem: {
    flexBasis: '30%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  categoryCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  categoryEmoji: {
    fontSize: 24,
  },
  categoryLabel: {
    ...typography.label,
    textAlign: 'center',
    fontWeight: '600',
  },
  // Category chips (view mode)
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  categoryChipEmoji: {
    fontSize: 16,
  },
  categoryChipText: {
    ...typography.label,
    fontWeight: '600',
  },
});
