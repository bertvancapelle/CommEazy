/**
 * ProfileSettingsScreen — Edit your profile
 *
 * 3-section layout matching onboarding structure:
 * - Section 1: "Wie ben je?" (name, gender, birthDate, weddingDate)
 * - Section 2: "Waar woon je?" (country, postcode, housenumber, street, city, province + GISCO)
 * - Section 3: "Hoe bereiken we je?" (email, mobile, landline)
 *
 * Also shows:
 * - Profile photo
 * - Phone number (read-only)
 * - Shared data consent toggles
 * - UUID (dev mode only)
 *
 * Senior-inclusive design:
 * - Large tappable elements (60pt+ touch targets)
 * - Clear labels and hints
 * - Simple picker interfaces
 * - Red asterisks on required fields
 * - GISCO address auto-lookup for EU countries
 * - VoiceOver support
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  Switch,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';
import { useNavigation, useIsFocused } from '@react-navigation/native';

import { colors, typography, spacing, borderRadius, touchTargets } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useLabelStyle, useFieldTextStyle } from '@/contexts/FieldTextStyleContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { ContactAvatar, LoadingView, ScrollViewWithIndicator, ErrorView } from '@/components';
import { useVoiceFocusList, useVoiceFocusContext } from '@/contexts/VoiceFocusContext';
import { useVisualPresence } from '@/contexts/PresenceContext';
import { ServiceContainer } from '@/services/container';
import {
  pickImageFromCamera,
  pickImageFromGallery,
  saveAvatar,
  getAvatarPath,
} from '@/services/imageService';
import { useModuleConfig } from '@/contexts/ModuleConfigContext';
import type { UserProfile, AgeBracket, Gender } from '@/services/interfaces';
import {
  COUNTRIES,
  COUNTRY_FLAGS,
} from './profileSettingsConstants';
import { PickerModal } from './PickerModal';
import { lookupAddress, isGISCOSupported } from '@/services/addressLookupService';
import { DateTimePickerModal } from '@/components/DateTimePickerModal';
import { useScrollToField } from '@/hooks/useScrollToField';

// Auto-calculate ageBracket from birthDate
function calculateAgeBracket(birthDateString: string): AgeBracket | undefined {
  const birthDate = new Date(birthDateString + 'T00:00:00');
  if (isNaN(birthDate.getTime())) return undefined;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  if (age < 18) return undefined;

  const brackets: [number, AgeBracket][] = [
    [18, '18-24'], [25, '25-34'], [35, '35-44'], [45, '45-54'], [55, '55-64'],
    [65, '65-69'], [70, '70-74'], [75, '75-79'], [80, '80-84'], [85, '85-89'],
    [90, '90-94'], [95, '95-99'], [100, '100-104'], [105, '105-110'],
  ];
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (age >= brackets[i][0]) return brackets[i][1];
  }
  return undefined;
}

/** Wrapper to show presence + trustLevel on consent contact avatar */
function ConsentContactAvatar({ name, jid }: { name: string; jid: string }) {
  const presence = useVisualPresence(jid);
  const [trustLevel, setTrustLevel] = useState(0);
  useEffect(() => {
    if (!jid) return;
    ServiceContainer.database.getContact(jid).then(contact => {
      if (contact) setTrustLevel(contact.trustLevel ?? 0);
    }).catch(() => {});
  }, [jid]);
  return <ContactAvatar name={name} size={40} trustLevel={trustLevel} presence={presence} />;
}

const GENDER_OPTIONS: { value: Gender; labelKey: string }[] = [
  { value: 'male', labelKey: 'demographics.gender.male' },
  { value: 'female', labelKey: 'demographics.gender.female' },
  { value: 'other', labelKey: 'demographics.gender.other' },
];

export function ProfileSettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { accentColor } = useAccentColor();
  const themeColors = useColors();
  const labelStyle = useLabelStyle();
  const fieldTextStyle = useFieldTextStyle();
  const { triggerFeedback } = useFeedback();
  const screenIsFocused = useIsFocused();
  const { isVoiceSessionActive } = useVoiceFocusContext();
  const { refresh: refreshModules } = useModuleConfig();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Section 1: "Wie ben je?"
  const [displayFirstName, setDisplayFirstName] = useState('');
  const [displayLastName, setDisplayLastName] = useState('');
  const [gender, setGender] = useState<Gender | undefined>();
  const [birthDate, setBirthDate] = useState<string | undefined>(undefined);
  const [weddingDate, setWeddingDate] = useState<string | undefined>(undefined);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [showWeddingDatePicker, setShowWeddingDatePicker] = useState(false);

  // Section 2: "Waar woon je?" (with GISCO auto-lookup)
  const [addressCountryCode, setAddressCountryCode] = useState<string | undefined>();
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [addressHouseNumber, setAddressHouseNumber] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressProvince, setAddressProvince] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Section 3: "Hoe bereiken we je?"
  const [personalEmail, setPersonalEmail] = useState('');
  const [personalMobile, setPersonalMobile] = useState('');
  const [personalLandline, setPersonalLandline] = useState('');

  // General state
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Shared data consent state
  const [sharedWithContacts, setSharedWithContacts] = useState<Array<{
    contactJid: string;
    contactName: string;
    isSharingEnabled: boolean;
  }>>([]);

  const [notification, setNotification] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
    onRetry?: () => void;
  } | null>(null);

  // ScrollView ref for scrolling to fields
  const scrollViewRef = useRef<ScrollView>(null);
  const lastNameInputRef = useRef<TextInput>(null);

  // Scroll-to-field hook for keyboard/modal-return auto-scrolling
  const { scrollRef, registerField, scrollToField, getFieldFocusHandler, handleScroll: handleScrollToField } = useScrollToField();

  // Refs to track latest values for beforeRemove (avoids stale closures)
  const profileRef = useRef(profile);
  profileRef.current = profile;

  // Single active picker state (only one picker can be open at a time)
  type PickerType = 'country' | 'gender' | null;
  const [activePicker, setActivePicker] = useState<PickerType>(null);
  const closePicker = useCallback(() => setActivePicker(null), []);

  // Load current user profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { ServiceContainer } = await import('@/services/container');
        const loadedProfile = await ServiceContainer.database.getUserProfile();

        if (loadedProfile) {
          setProfile(loadedProfile);
          // Section 1: "Wie ben je?"
          setDisplayFirstName(loadedProfile.firstName);
          setDisplayLastName(loadedProfile.lastName);
          setGender(loadedProfile.gender as Gender | undefined);
          setBirthDate(loadedProfile.birthDate || undefined);
          setWeddingDate(loadedProfile.weddingDate || undefined);

          // Section 2: "Waar woon je?"
          setAddressCountryCode(loadedProfile.countryCode || loadedProfile.addressCountry || undefined);
          setAddressPostalCode(loadedProfile.addressPostalCode || '');
          // Parse house number from addressStreet if present (e.g. "Wolfstraat 30" → street="Wolfstraat", number="30")
          const storedStreet = loadedProfile.addressStreet || '';
          setAddressStreet(storedStreet);
          setAddressHouseNumber(''); // House number is UI-only for GISCO lookup
          setAddressCity(loadedProfile.addressCity || loadedProfile.city || '');
          setAddressProvince(loadedProfile.addressProvince || '');

          // Section 3: "Hoe bereiken we je?"
          setPersonalEmail(loadedProfile.email || '');
          setPersonalMobile(loadedProfile.mobileNumber || '');
          setPersonalLandline(loadedProfile.landlineNumber || '');

          if (loadedProfile.photoPath) {
            setPhotoUrl(`file://${loadedProfile.photoPath}`);
          } else {
            const savedPath = await getAvatarPath('my_profile');
            if (savedPath) {
              setPhotoUrl(`file://${savedPath}`);
            }
          }
        }

        // Load consent data (shared with contacts)
        const consents = await ServiceContainer.database.getAllConsents();
        if (consents.length > 0) {
          const contacts = await ServiceContainer.database.getContactsOnce();
          const sharedData = consents.map(c => {
            const contact = contacts.find(ct => ct.jid === c.contactJid);
            return {
              contactJid: c.contactJid,
              contactName: contact
                ? `${contact.firstName} ${contact.lastName}`.trim()
                : c.contactJid,
              isSharingEnabled: c.isSharingEnabled,
            };
          });
          setSharedWithContacts(sharedData);
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, []);

  const saveProfile = useCallback(async (updates: Partial<UserProfile>): Promise<boolean> => {
    const currentProfile = profileRef.current;
    if (!currentProfile) return false;

    const updatedProfile = { ...currentProfile, ...updates };

    // Update local state and ref immediately
    setProfile(updatedProfile);
    profileRef.current = updatedProfile;

    // Save to database and wait for completion
    setSaving(true);
    try {
      const { ServiceContainer } = await import('@/services/container');
      await ServiceContainer.database.saveUserProfile(updatedProfile);
      console.log('[ProfileSettings] Profile saved:', Object.keys(updates));

      // Broadcast profile update to consented contacts (fire-and-forget)
      void ServiceContainer.profileSync?.broadcastProfileUpdate();

      return true;
    } catch (error) {
      console.error('Failed to save profile:', error);
      setNotification({ type: 'error', title: t('errors.genericTitle'), message: t('errors.genericError') });
      return false;
    } finally {
      setSaving(false);
    }
  }, [t]);

  // ── Photo handling ──

  const handleChangePhoto = useCallback(() => {
    void triggerFeedback('tap');
    Alert.alert(
      t('profile.changePhoto'),
      t('profile.selectSource'),
      [
        {
          text: t('chat.camera'),
          onPress: async () => {
            try {
              setSavingPhoto(true);
              const image = await pickImageFromCamera();
              if (image) {
                const savedPath = await saveAvatar(image, 'my_profile');
                setPhotoUrl(`file://${savedPath}`);
                await saveProfile({ photoPath: savedPath });
                setNotification({ type: 'success', title: t('profile.photoSaved'), message: '' });
              }
            } catch (error) {
              console.error('Failed to save photo:', error);
              setNotification({ type: 'error', title: t('errors.genericTitle'), message: t('errors.genericError') });
            } finally {
              setSavingPhoto(false);
            }
          },
        },
        {
          text: t('chat.gallery'),
          onPress: async () => {
            try {
              setSavingPhoto(true);
              const image = await pickImageFromGallery();
              if (image) {
                const savedPath = await saveAvatar(image, 'my_profile');
                setPhotoUrl(`file://${savedPath}`);
                await saveProfile({ photoPath: savedPath });
                setNotification({ type: 'success', title: t('profile.photoSaved'), message: '' });
              }
            } catch (error) {
              console.error('Failed to save photo:', error);
              setNotification({ type: 'error', title: t('errors.genericTitle'), message: t('errors.genericError') });
            } finally {
              setSavingPhoto(false);
            }
          },
        },
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
      ]
    );
  }, [t, saveProfile, triggerFeedback]);

  // ── Section 1: "Wie ben je?" handlers ──

  const handleNameBlur = useCallback(async (field: 'firstName' | 'lastName', value: string) => {
    const trimmed = value.trim();
    if (field === 'firstName') {
      setDisplayFirstName(trimmed);
      if (trimmed.length >= 2) {
        const saved = await saveProfile({ firstName: trimmed });
        if (saved) setNotification({ type: 'success', title: t('profile.personal.saved'), message: '' });
      }
    } else {
      setDisplayLastName(trimmed);
      const saved = await saveProfile({ lastName: trimmed });
      if (saved) setNotification({ type: 'success', title: t('profile.personal.saved'), message: '' });
    }
  }, [saveProfile, t]);

  const handleGenderSelect = useCallback(async (selectedGender: string) => {
    void triggerFeedback('tap');
    const g = selectedGender as Gender;
    setGender(g);
    await saveProfile({ gender: g });
  }, [saveProfile, triggerFeedback]);

  const handleBirthDatePickerChange = useCallback((_event: import('@react-native-community/datetimepicker').DateTimePickerEvent, selectedDate?: Date) => {
    if (!selectedDate) return;
    const iso = selectedDate.toISOString().split('T')[0]; // "YYYY-MM-DD"
    setBirthDate(iso);
    const updates: Partial<UserProfile> = { birthDate: iso };
    // Auto-calculate ageBracket
    const bracket = calculateAgeBracket(iso);
    if (bracket) {
      updates.ageBracket = bracket;
    }
    void saveProfile(updates).then((saved) => {
      if (saved) setNotification({ type: 'success', title: t('profile.personal.saved'), message: '' });
    });
  }, [saveProfile, t]);

  const handleWeddingDatePickerChange = useCallback((_event: import('@react-native-community/datetimepicker').DateTimePickerEvent, selectedDate?: Date) => {
    if (!selectedDate) return;
    const iso = selectedDate.toISOString().split('T')[0]; // "YYYY-MM-DD"
    setWeddingDate(iso);
    void saveProfile({ weddingDate: iso }).then((saved) => {
      if (saved) setNotification({ type: 'success', title: t('profile.personal.saved'), message: '' });
    });
  }, [saveProfile, t]);

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

  // Format date for display in touchable field
  const formatDateDisplay = useCallback((isoDate: string | undefined): string => {
    if (!isoDate) return '-';
    const d = new Date(isoDate + 'T00:00:00');
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(pickerLocale, {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }, [pickerLocale]);

  // Parse ISO string to Date for picker value
  const parseDateValue = useCallback((isoDate: string | undefined): Date => {
    if (!isoDate) return new Date();
    const d = new Date(isoDate + 'T00:00:00');
    return isNaN(d.getTime()) ? new Date() : d;
  }, []);

  // ── Section 2: "Waar woon je?" handlers ──

  const handleCountrySelect = useCallback(async (countryCode: string) => {
    void triggerFeedback('tap');
    setAddressCountryCode(countryCode);
    // Clear address fields when country changes
    setAddressPostalCode('');
    setAddressHouseNumber('');
    setAddressStreet('');
    setAddressCity('');
    setAddressProvince('');
    const saved = await saveProfile({
      countryCode,
      addressCountry: countryCode,
      addressPostalCode: '',
      addressStreet: '',
      addressCity: '',
      addressProvince: '',
      city: '',
    });
    // Refresh enabled modules based on new country (e.g., Nu.nl for Netherlands)
    if (saved) {
      await refreshModules();
    }
  }, [saveProfile, triggerFeedback, refreshModules]);

  // GISCO address auto-lookup
  const handleAddressLookup = useCallback(async () => {
    if (!addressCountryCode || !addressPostalCode.trim()) return;
    if (!isGISCOSupported(addressCountryCode)) return;

    setIsLookingUp(true);
    try {
      const result = await lookupAddress(
        addressCountryCode,
        addressPostalCode.trim(),
        addressHouseNumber.trim() || undefined,
      );
      if (result) {
        // Combine street + house number for display
        const fullStreet = addressHouseNumber.trim()
          ? `${result.street} ${addressHouseNumber.trim()}`
          : result.street;
        setAddressStreet(fullStreet);
        setAddressCity(result.city);
        setAddressProvince(result.province);
      }
    } catch {
      // Silent fallback — user fills manually
    } finally {
      setIsLookingUp(false);
    }
  }, [addressCountryCode, addressPostalCode, addressHouseNumber]);

  const handleAddressFieldBlur = useCallback(async (field: string, value: string) => {
    const updates: Partial<UserProfile> = {};
    switch (field) {
      case 'addressPostalCode':
        updates.addressPostalCode = value.trim();
        break;
      case 'addressStreet':
        updates.addressStreet = value.trim();
        break;
      case 'addressCity':
        updates.addressCity = value.trim();
        updates.city = value.trim(); // Keep city in sync
        break;
      case 'addressProvince':
        updates.addressProvince = value.trim();
        break;
    }
    const saved = await saveProfile(updates);
    if (saved) setNotification({ type: 'success', title: t('profile.personal.saved'), message: '' });
  }, [saveProfile, t]);

  // ── Section 3: "Hoe bereiken we je?" handlers ──

  const handleContactFieldBlur = useCallback(async (field: string, value: string) => {
    const updates: Partial<UserProfile> = {};
    switch (field) {
      case 'email': updates.email = value.trim(); break;
      case 'mobileNumber': updates.mobileNumber = value.trim(); break;
      case 'landlineNumber': updates.landlineNumber = value.trim(); break;
    }
    const saved = await saveProfile(updates);
    if (saved) setNotification({ type: 'success', title: t('profile.personal.saved'), message: '' });
  }, [saveProfile, t]);

  // ── Consent handler ──

  const handleToggleConsent = useCallback(async (contactJid: string, currentEnabled: boolean) => {
    void triggerFeedback('tap');
    const newEnabled = !currentEnabled;
    try {
      const { ServiceContainer } = await import('@/services/container');
      await ServiceContainer.database.setConsentForContact(contactJid, newEnabled);
      setSharedWithContacts(prev =>
        prev.map(c =>
          c.contactJid === contactJid
            ? { ...c, isSharingEnabled: newEnabled }
            : c,
        ),
      );
      setNotification({
        type: 'success',
        title: newEnabled
          ? t('profile.sharing.enabled')
          : t('profile.sharing.disabled'),
        message: '',
      });
    } catch (error) {
      console.error('Failed to toggle consent:', error);
    }
  }, [triggerFeedback, t]);

  // ── Picker options ──

  const countryOptions = COUNTRIES.map(code => ({
    value: code,
    label: `${COUNTRY_FLAGS[code]} ${t(`demographics.countries.${code}`, code)}`,
  }));

  const genderOptions = GENDER_OPTIONS.map(opt => ({
    value: opt.value,
    label: t(opt.labelKey),
  }));

  // ── Voice focus items ──

  const voiceFocusItems = useMemo(() => {
    if (!screenIsFocused) return [];

    let index = 0;
    return [
      {
        id: 'photo',
        label: t('profile.changePhoto'),
        index: index++,
        onSelect: handleChangePhoto,
      },
      {
        id: 'firstName',
        label: t('onboarding.firstNameLabel'),
        index: index++,
        onSelect: () => {},
      },
      {
        id: 'country',
        label: t('demographics.countryLabel'),
        index: index++,
        onSelect: () => setActivePicker('country'),
      },
    ];
  }, [
    screenIsFocused,
    t,
    handleChangePhoto,
  ]);

  const { scrollRef: voiceScrollRef } = useVoiceFocusList(
    'profile-settings-list',
    voiceFocusItems
  );

  if (loading) {
    return (
      <LoadingView fullscreen />
    );
  }



  // Required field indicator
  const requiredMark = <Text style={{ color: colors.error, fontWeight: '700' }}> *</Text>;

  return (
    <KeyboardAvoidingView
      style={[styles.keyboardAvoidingContainer, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 0}
    >
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
      <ScrollViewWithIndicator
        ref={(ref) => {
          scrollViewRef.current = ref;
          (scrollRef as React.MutableRefObject<ScrollView | null>).current = ref;
          if (voiceScrollRef) {
            (voiceScrollRef as React.MutableRefObject<ScrollView | null>).current = ref;
          }
        }}
        style={[styles.container, { backgroundColor: themeColors.background }]}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScroll={handleScrollToField}
        scrollEventThrottle={16}
      >
      {/* ── Section 1: "Wie ben je?" ─────────────────────────── */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>{t('onboarding.profileStep1.title')}</Text>

        {/* First name */}
        <View style={styles.fieldContainer} ref={registerField('displayFirstName')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('onboarding.firstNameLabel')}{requiredMark}
          </Text>
          <TextInput
            style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
            value={displayFirstName}
            onChangeText={setDisplayFirstName}
            onBlur={() => handleNameBlur('firstName', displayFirstName)}
            onFocus={getFieldFocusHandler('displayFirstName')}
            placeholder={t('onboarding.firstNamePlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            maxLength={50}
            returnKeyType="next"
            onSubmitEditing={() => lastNameInputRef.current?.focus()}
            accessibilityLabel={t('onboarding.firstNameLabel')}
          />
        </View>

        {/* Last name */}
        <View style={styles.fieldContainer} ref={registerField('displayLastName')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('onboarding.lastNameLabel')}{requiredMark}
          </Text>
          <TextInput
            ref={lastNameInputRef}
            style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
            value={displayLastName}
            onChangeText={setDisplayLastName}
            onBlur={() => handleNameBlur('lastName', displayLastName)}
            onFocus={getFieldFocusHandler('displayLastName')}
            placeholder={t('onboarding.lastNamePlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            maxLength={50}
            returnKeyType="done"
            accessibilityLabel={t('onboarding.lastNameLabel')}
          />
        </View>

        {/* Gender */}
        <View style={styles.fieldContainer} ref={registerField('gender')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('demographics.genderLabel')}{requiredMark}
          </Text>
          <HapticTouchable hapticDisabled
            style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            onPress={() => { Keyboard.dismiss(); setTimeout(() => setActivePicker('gender'), 100); }}
            accessibilityRole="button"
            accessibilityLabel={t('demographics.genderLabel')}
          >
            <Text style={[styles.pickerValue, gender ? { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle } : { color: themeColors.textTertiary }]}>
              {gender
                ? t(`demographics.gender.${gender}`)
                : t('demographics.selectGender')}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </HapticTouchable>
        </View>

        {/* Birth date */}
        <View style={styles.fieldContainer} ref={registerField('birthDate')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('profile.personal.birthDateLabel')}{requiredMark}
          </Text>
          <HapticTouchable hapticDisabled
            style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowBirthDatePicker(true), 100); }}
            accessibilityRole="button"
            accessibilityLabel={t('profile.personal.birthDateLabel')}
          >
            <Text style={[styles.pickerValue, birthDate ? { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle } : { color: themeColors.textTertiary }]}>
              {formatDateDisplay(birthDate)}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </HapticTouchable>
        </View>

        {/* Wedding date */}
        <View style={styles.fieldContainer} ref={registerField('weddingDate')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('profile.personal.weddingDateLabel')}
          </Text>
          <HapticTouchable hapticDisabled
            style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowWeddingDatePicker(true), 100); }}
            accessibilityRole="button"
            accessibilityLabel={t('profile.personal.weddingDateLabel')}
          >
            <Text style={[styles.pickerValue, weddingDate ? { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle } : { color: themeColors.textTertiary }]}>
              {formatDateDisplay(weddingDate)}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </HapticTouchable>
        </View>
      </View>

      {/* ── Section 2: "Waar woon je?" ─────────────────────────── */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>{t('onboarding.profileStep2.title')}</Text>

        {/* Country */}
        <View style={styles.fieldContainer} ref={registerField('country')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('demographics.countryLabel')}{requiredMark}
          </Text>
          <HapticTouchable hapticDisabled
            style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            onPress={() => { Keyboard.dismiss(); setTimeout(() => setActivePicker('country'), 100); }}
            accessibilityRole="button"
            accessibilityLabel={t('demographics.countryLabel')}
          >
            <Text style={[styles.pickerValue, addressCountryCode ? { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle } : { color: themeColors.textTertiary }]}>
              {addressCountryCode
                ? `${COUNTRY_FLAGS[addressCountryCode] || ''} ${t(`demographics.countries.${addressCountryCode}`, addressCountryCode)}`
                : t('demographics.selectCountry')}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </HapticTouchable>
        </View>

        {/* Postcode + Huisnummer row */}
        <View style={styles.rowFields}>
          <View style={[styles.fieldContainer, { flex: 1, marginRight: spacing.sm }]} ref={registerField('addressPostalCode')}>
            <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
              {t('onboarding.personalDetails.addressPostalCode')}{requiredMark}
            </Text>
            <TextInput
              style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
              value={addressPostalCode}
              onChangeText={setAddressPostalCode}
              onBlur={() => {
                void handleAddressFieldBlur('addressPostalCode', addressPostalCode);
                void handleAddressLookup();
              }}
              onFocus={getFieldFocusHandler('addressPostalCode')}
              placeholder={t('onboarding.personalDetails.postalCodePlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              autoCapitalize="characters"
              returnKeyType="next"
              accessibilityLabel={t('onboarding.personalDetails.addressPostalCode')}
            />
          </View>
          <View style={[styles.fieldContainer, { flex: 1 }]} ref={registerField('addressHouseNumber')}>
            <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
              {t('onboarding.profileStep2.houseNumber')}{requiredMark}
            </Text>
            <TextInput
              style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
              value={addressHouseNumber}
              onChangeText={setAddressHouseNumber}
              onBlur={() => void handleAddressLookup()}
              onFocus={getFieldFocusHandler('addressHouseNumber')}
              placeholder={t('onboarding.profileStep2.houseNumberPlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              keyboardType="default"
              returnKeyType="next"
              accessibilityLabel={t('onboarding.profileStep2.houseNumber')}
            />
          </View>
        </View>

        {/* GISCO lookup indicator */}
        {isLookingUp && (
          <View style={styles.lookupIndicator}>
            <ActivityIndicator size="small" color={accentColor.primary} />
            <Text style={[styles.lookupText, { color: themeColors.textTertiary }]}>
              {t('onboarding.profileStep2.lookingUp')}
            </Text>
          </View>
        )}

        {/* Street */}
        <View style={styles.fieldContainer} ref={registerField('addressStreet')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('onboarding.personalDetails.addressStreet')}
          </Text>
          <TextInput
            style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
            value={addressStreet}
            onChangeText={setAddressStreet}
            onBlur={() => handleAddressFieldBlur('addressStreet', addressStreet)}
            onFocus={getFieldFocusHandler('addressStreet')}
            placeholder={t('onboarding.personalDetails.streetPlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            returnKeyType="next"
            accessibilityLabel={t('onboarding.personalDetails.addressStreet')}
          />
        </View>

        {/* City */}
        <View style={styles.fieldContainer} ref={registerField('addressCity')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('onboarding.personalDetails.addressCity')}{requiredMark}
          </Text>
          <TextInput
            style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
            value={addressCity}
            onChangeText={setAddressCity}
            onBlur={() => handleAddressFieldBlur('addressCity', addressCity)}
            onFocus={getFieldFocusHandler('addressCity')}
            placeholder={t('onboarding.personalDetails.cityPlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            returnKeyType="next"
            accessibilityLabel={t('onboarding.personalDetails.addressCity')}
          />
        </View>

        {/* Province */}
        <View style={styles.fieldContainer} ref={registerField('addressProvince')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('onboarding.profileStep2.provinceLabel')}
          </Text>
          <TextInput
            style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
            value={addressProvince}
            onChangeText={setAddressProvince}
            onBlur={() => handleAddressFieldBlur('addressProvince', addressProvince)}
            onFocus={getFieldFocusHandler('addressProvince')}
            placeholder={t('onboarding.profileStep2.provincePlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            returnKeyType="done"
            accessibilityLabel={t('onboarding.profileStep2.provinceLabel')}
          />
        </View>
      </View>

      {/* ── Section 3: "Hoe bereiken we je?" ─────────────────────────── */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>{t('onboarding.profileStep3.title')}</Text>
        <Text style={[styles.sectionSubtitle, { color: themeColors.textTertiary }]}>{t('profile.personal.subtitle')}</Text>

        {/* Email */}
        <View style={styles.fieldContainer} ref={registerField('personalEmail')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>{t('profile.personal.emailLabel')}</Text>
          <TextInput
            style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
            value={personalEmail}
            onChangeText={setPersonalEmail}
            onBlur={() => handleContactFieldBlur('email', personalEmail)}
            onFocus={getFieldFocusHandler('personalEmail')}
            placeholder={t('profile.personal.emailPlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel={t('profile.personal.emailLabel')}
          />
        </View>

        {/* Mobile number */}
        <View style={styles.fieldContainer} ref={registerField('personalMobile')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>{t('profile.personal.mobileLabel')}</Text>
          <TextInput
            style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
            value={personalMobile}
            onChangeText={setPersonalMobile}
            onBlur={() => handleContactFieldBlur('mobileNumber', personalMobile)}
            onFocus={getFieldFocusHandler('personalMobile')}
            placeholder={t('profile.personal.mobilePlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            keyboardType="phone-pad"
            returnKeyType="done"
            accessibilityLabel={t('profile.personal.mobileLabel')}
          />
        </View>

        {/* Landline number */}
        <View style={styles.fieldContainer} ref={registerField('personalLandline')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>{t('profile.personal.landlineLabel')}</Text>
          <TextInput
            style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
            value={personalLandline}
            onChangeText={setPersonalLandline}
            onBlur={() => handleContactFieldBlur('landlineNumber', personalLandline)}
            onFocus={getFieldFocusHandler('personalLandline')}
            placeholder={t('profile.personal.landlinePlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            keyboardType="phone-pad"
            returnKeyType="done"
            accessibilityLabel={t('profile.personal.landlineLabel')}
          />
        </View>
      </View>

      {/* ── Gedeeld met (Shared with) ─────────────────────────── */}
      {sharedWithContacts.length > 0 && (
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.sectionTitle, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('profile.sharing.title')}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
            {t('profile.sharing.subtitle')}
          </Text>

          {sharedWithContacts.map(item => (
            <View
              key={item.contactJid}
              style={[styles.consentRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            >
              <View style={styles.consentInfo}>
                <ConsentContactAvatar
                  name={item.contactName}
                  jid={item.contactJid}
                />
                <Text style={[styles.consentName, { color: themeColors.textPrimary }]}>
                  {item.contactName}
                </Text>
              </View>
              <Switch
                value={item.isSharingEnabled}
                onValueChange={() => handleToggleConsent(item.contactJid, item.isSharingEnabled)}
                trackColor={{ false: themeColors.border, true: accentColor.primaryLight }}
                thumbColor={item.isSharingEnabled ? accentColor.primary : themeColors.surface}
                accessibilityLabel={t('profile.sharing.toggleLabel', { name: item.contactName })}
                accessibilityRole="switch"
              />
            </View>
          ))}
        </View>
      )}

      {/* Dev mode: Show UUID */}
      {__DEV__ && profile?.userUuid && (
        <View style={[styles.devSection, { backgroundColor: themeColors.surface, borderColor: accentColor.primary }]}>
          <Text style={[styles.devTitle, { color: accentColor.primary }]}>🔧 Dev Info</Text>
          <Text style={[styles.devLabel, { color: themeColors.textSecondary }]}>UUID (stable):</Text>
          <Text style={[styles.devValue, { color: themeColors.textPrimary }]} selectable>{profile.userUuid}</Text>
          <Text style={[styles.devLabel, { color: themeColors.textSecondary }]}>JID:</Text>
          <Text style={[styles.devValue, { color: themeColors.textPrimary }]} selectable>{profile.jid}</Text>
          <Text style={[styles.devLabel, { color: themeColors.textSecondary }]}>Subscription:</Text>
          <Text style={[styles.devValue, { color: themeColors.textPrimary }]}>{profile.subscriptionTier}</Text>
        </View>
      )}

      {/* Picker modals */}
      <PickerModal
        visible={activePicker === 'country'}
        title={t('demographics.selectCountry')}
        options={countryOptions}
        selectedValue={addressCountryCode}
        onSelect={handleCountrySelect}
        onClose={() => { closePicker(); scrollToField('country', { isModalReturn: true }); }}
      />

      <PickerModal
        visible={activePicker === 'gender'}
        title={t('demographics.selectGender')}
        options={genderOptions}
        selectedValue={gender}
        onSelect={handleGenderSelect}
        onClose={() => { closePicker(); scrollToField('gender', { isModalReturn: true }); }}
      />

      {/* Date picker modals */}
      <DateTimePickerModal
        visible={showBirthDatePicker}
        title={t('profile.personal.birthDateLabel')}
        value={parseDateValue(birthDate)}
        mode="date"
        moduleId="settings"
        onChange={handleBirthDatePickerChange}
        onClose={() => { setShowBirthDatePicker(false); scrollToField('birthDate', { isModalReturn: true }); }}
        maximumDate={new Date()}
        minimumDate={new Date(1900, 0, 1)}
        locale={pickerLocale}
      />

      <DateTimePickerModal
        visible={showWeddingDatePicker}
        title={t('profile.personal.weddingDateLabel')}
        value={parseDateValue(weddingDate)}
        mode="date"
        moduleId="settings"
        onChange={handleWeddingDatePickerChange}
        onClose={() => { setShowWeddingDatePicker(false); scrollToField('weddingDate', { isModalReturn: true }); }}
        maximumDate={new Date(new Date().getFullYear() + 5, 11, 31)}
        minimumDate={new Date(1940, 0, 1)}
        locale={pickerLocale}
      />

      </ScrollViewWithIndicator>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.small,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  fieldHint: {
    ...typography.small,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  textInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    minHeight: touchTargets.comfortable,
  },
  pickerRow: {
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
  pickerValue: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  editIcon: {
    fontSize: 18,
    marginLeft: spacing.sm,
  },
  rowFields: {
    flexDirection: 'row',
  },
  lookupIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  lookupText: {
    ...typography.small,
  },
  // Consent / Shared with section styles
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: touchTargets.minimum,
  },
  consentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  consentName: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  devSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  devTitle: {
    ...typography.label,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  devLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  devValue: {
    ...typography.small,
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
});
