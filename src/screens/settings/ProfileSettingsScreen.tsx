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
 * - Language selector
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
  Platform,
  KeyboardAvoidingView,
  Switch,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';
import { useNavigation, useIsFocused } from '@react-navigation/native';

import { colors, typography, spacing, borderRadius, touchTargets } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { ContactAvatar, LoadingView, ScrollViewWithIndicator, ErrorView } from '@/components';
import { useVoiceFocusList, useVoiceFocusContext } from '@/contexts/VoiceFocusContext';
import {
  pickImageFromCamera,
  pickImageFromGallery,
  saveAvatar,
  getAvatarPath,
} from '@/services/imageService';
import { useModuleConfig } from '@/contexts/ModuleConfigContext';
import type { UserProfile, AgeBracket, SupportedLanguage, Gender } from '@/services/interfaces';
import {
  SUPPORTED_LANGUAGES,
  COUNTRIES,
  COUNTRY_FLAGS,
  LANGUAGE_FLAGS,
} from './profileSettingsConstants';
import { PickerModal } from './PickerModal';
import { lookupAddress, isGISCOSupported } from '@/services/addressLookupService';
import { SeniorDatePicker } from '@/components/SeniorDatePicker';

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

  // Refs to track latest values for beforeRemove (avoids stale closures)
  const profileRef = useRef(profile);
  profileRef.current = profile;

  // Single active picker state (only one picker can be open at a time)
  type PickerType = 'language' | 'country' | 'gender' | null;
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

  const handleBirthDateChange = useCallback(async (date: string | undefined) => {
    setBirthDate(date);
    const updates: Partial<UserProfile> = { birthDate: date || '' };
    // Auto-calculate ageBracket
    if (date) {
      const bracket = calculateAgeBracket(date);
      if (bracket) {
        updates.ageBracket = bracket;
      }
    }
    const saved = await saveProfile(updates);
    if (saved) setNotification({ type: 'success', title: t('profile.personal.saved'), message: '' });
  }, [saveProfile, t]);

  const handleWeddingDateChange = useCallback(async (date: string | undefined) => {
    setWeddingDate(date);
    const saved = await saveProfile({ weddingDate: date || '' });
    if (saved) setNotification({ type: 'success', title: t('profile.personal.saved'), message: '' });
  }, [saveProfile, t]);

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

  // ── Language handler ──

  const handleLanguageSelect = useCallback(async (language: string) => {
    void triggerFeedback('tap');
    await i18n.changeLanguage(language);
    await saveProfile({ language: language as SupportedLanguage });
  }, [i18n, saveProfile, triggerFeedback]);

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

  const languageOptions = SUPPORTED_LANGUAGES.map(lang => ({
    value: lang,
    label: `${LANGUAGE_FLAGS[lang]} ${t(`profile.language.${lang}`)}`,
  }));

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
        id: 'language',
        label: t('settings.language'),
        index: index++,
        onSelect: () => setActivePicker('language'),
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

  const displayName = `${displayFirstName} ${displayLastName}`.trim();

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
          if (voiceScrollRef) {
            (voiceScrollRef as React.MutableRefObject<ScrollView | null>).current = ref;
          }
        }}
        style={[styles.container, { backgroundColor: themeColors.background }]}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
      {/* Profile photo + name display */}
      <View style={styles.profileSection}>
        <HapticTouchable hapticDisabled
          onPress={handleChangePhoto}
          activeOpacity={0.8}
          disabled={savingPhoto}
          accessibilityRole="button"
          accessibilityLabel={t('profile.changePhoto')}
          accessibilityHint={t('profile.tapToChange')}
        >
          <View style={styles.avatarContainer}>
            <ContactAvatar
              name={displayName}
              photoUrl={photoUrl ?? undefined}
              size={120}
            />
            <View style={[styles.cameraIconContainer, { backgroundColor: accentColor.primary, borderColor: themeColors.background }]}>
              {savingPhoto ? (
                <ActivityIndicator size="small" color={themeColors.textOnPrimary} />
              ) : (
                <Text style={styles.cameraIcon}>📷</Text>
              )}
            </View>
          </View>
        </HapticTouchable>
        {/* Full name displayed under photo */}
        {displayName ? (
          <Text style={[styles.displayName, { color: themeColors.textPrimary }]}>{displayName}</Text>
        ) : null}
      </View>

      {/* Language section */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('settings.language')}</Text>
        <HapticTouchable hapticDisabled
          style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          onPress={() => setActivePicker('language')}
          accessibilityRole="button"
          accessibilityHint={t('profile.tapToChange')}
        >
          <Text style={[styles.pickerValue, { color: accentColor.primary }]}>
            {t(`profile.language.${i18n.language as SupportedLanguage}`)}
          </Text>
          <Text style={styles.editIcon}>✏️</Text>
        </HapticTouchable>
        <Text style={[styles.fieldHint, { color: themeColors.textTertiary }]}>{t('profile.languageHint')}</Text>
      </View>

      {/* Phone number (read-only) */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('onboarding.phoneLabel')}</Text>
        <View style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Text style={[styles.pickerValue, { color: accentColor.primary }]}>{profile?.phoneNumber || '—'}</Text>
          <Text style={styles.readOnlyIcon}>🔒</Text>
        </View>
        <Text style={[styles.fieldHint, { color: themeColors.textTertiary }]}>{t('profile.phoneReadOnly')}</Text>
      </View>

      {/* ── Section 1: "Wie ben je?" ─────────────────────────── */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('onboarding.profileStep1.title')}</Text>

        {/* First name */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('onboarding.firstNameLabel')}{requiredMark}
          </Text>
          <TextInput
            style={[styles.textInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
            value={displayFirstName}
            onChangeText={setDisplayFirstName}
            onBlur={() => handleNameBlur('firstName', displayFirstName)}
            placeholder={t('onboarding.firstNamePlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            maxLength={50}
            returnKeyType="next"
            onSubmitEditing={() => lastNameInputRef.current?.focus()}
            accessibilityLabel={t('onboarding.firstNameLabel')}
          />
        </View>

        {/* Last name */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('onboarding.lastNameLabel')}
          </Text>
          <TextInput
            ref={lastNameInputRef}
            style={[styles.textInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
            value={displayLastName}
            onChangeText={setDisplayLastName}
            onBlur={() => handleNameBlur('lastName', displayLastName)}
            placeholder={t('onboarding.lastNamePlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            maxLength={50}
            returnKeyType="done"
            accessibilityLabel={t('onboarding.lastNameLabel')}
          />
        </View>

        {/* Gender */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('demographics.genderLabel')}
          </Text>
          <HapticTouchable hapticDisabled
            style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            onPress={() => setActivePicker('gender')}
            accessibilityRole="button"
            accessibilityLabel={t('demographics.genderLabel')}
          >
            <Text style={[styles.pickerValue, gender ? { color: accentColor.primary } : { color: themeColors.textTertiary }]}>
              {gender
                ? t(`demographics.gender.${gender}`)
                : t('demographics.selectGender')}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </HapticTouchable>
        </View>

        {/* Birth date */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('profile.personal.birthDateLabel')}
          </Text>
          <SeniorDatePicker
            value={birthDate}
            onChange={handleBirthDateChange}
            accessibilityLabel={t('profile.personal.birthDateLabel')}
            maxYear={new Date().getFullYear()}
            minYear={1900}
          />
        </View>

        {/* Wedding date */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('profile.personal.weddingDateLabel')}
          </Text>
          <SeniorDatePicker
            value={weddingDate}
            onChange={handleWeddingDateChange}
            accessibilityLabel={t('profile.personal.weddingDateLabel')}
            maxYear={new Date().getFullYear() + 5}
            minYear={1940}
          />
        </View>
      </View>

      {/* ── Section 2: "Waar woon je?" ─────────────────────────── */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('onboarding.profileStep2.title')}</Text>

        {/* Country */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('demographics.countryLabel')}{requiredMark}
          </Text>
          <HapticTouchable hapticDisabled
            style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            onPress={() => setActivePicker('country')}
            accessibilityRole="button"
            accessibilityLabel={t('demographics.countryLabel')}
          >
            <Text style={[styles.pickerValue, addressCountryCode ? { color: accentColor.primary } : { color: themeColors.textTertiary }]}>
              {addressCountryCode
                ? `${COUNTRY_FLAGS[addressCountryCode] || ''} ${t(`demographics.countries.${addressCountryCode}`, addressCountryCode)}`
                : t('demographics.selectCountry')}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </HapticTouchable>
        </View>

        {/* Postcode + Huisnummer row */}
        <View style={styles.rowFields}>
          <View style={[styles.fieldContainer, { flex: 1, marginRight: spacing.sm }]}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
              {t('onboarding.personalDetails.addressPostalCode')}{requiredMark}
            </Text>
            <TextInput
              style={[styles.textInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
              value={addressPostalCode}
              onChangeText={setAddressPostalCode}
              onBlur={() => {
                void handleAddressFieldBlur('addressPostalCode', addressPostalCode);
                void handleAddressLookup();
              }}
              placeholder={t('onboarding.personalDetails.postalCodePlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              autoCapitalize="characters"
              returnKeyType="next"
              accessibilityLabel={t('onboarding.personalDetails.addressPostalCode')}
            />
          </View>
          <View style={[styles.fieldContainer, { flex: 1 }]}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
              {t('onboarding.profileStep2.houseNumber')}
            </Text>
            <TextInput
              style={[styles.textInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
              value={addressHouseNumber}
              onChangeText={setAddressHouseNumber}
              onBlur={() => void handleAddressLookup()}
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
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('onboarding.personalDetails.addressStreet')}
          </Text>
          <TextInput
            style={[styles.textInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
            value={addressStreet}
            onChangeText={setAddressStreet}
            onBlur={() => handleAddressFieldBlur('addressStreet', addressStreet)}
            placeholder={t('onboarding.personalDetails.streetPlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            returnKeyType="next"
            accessibilityLabel={t('onboarding.personalDetails.addressStreet')}
          />
        </View>

        {/* City */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('onboarding.personalDetails.addressCity')}{requiredMark}
          </Text>
          <TextInput
            style={[styles.textInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
            value={addressCity}
            onChangeText={setAddressCity}
            onBlur={() => handleAddressFieldBlur('addressCity', addressCity)}
            placeholder={t('onboarding.personalDetails.cityPlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            returnKeyType="next"
            accessibilityLabel={t('onboarding.personalDetails.addressCity')}
          />
        </View>

        {/* Province */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('onboarding.profileStep2.provinceLabel')}
          </Text>
          <TextInput
            style={[styles.textInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
            value={addressProvince}
            onChangeText={setAddressProvince}
            onBlur={() => handleAddressFieldBlur('addressProvince', addressProvince)}
            placeholder={t('onboarding.profileStep2.provincePlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            returnKeyType="done"
            accessibilityLabel={t('onboarding.profileStep2.provinceLabel')}
          />
        </View>
      </View>

      {/* ── Section 3: "Hoe bereiken we je?" ─────────────────────────── */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('onboarding.profileStep3.title')}</Text>
        <Text style={[styles.sectionSubtitle, { color: themeColors.textTertiary }]}>{t('profile.personal.subtitle')}</Text>

        {/* Email */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('profile.personal.emailLabel')}</Text>
          <TextInput
            style={[styles.textInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
            value={personalEmail}
            onChangeText={setPersonalEmail}
            onBlur={() => handleContactFieldBlur('email', personalEmail)}
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
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('profile.personal.mobileLabel')}</Text>
          <TextInput
            style={[styles.textInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
            value={personalMobile}
            onChangeText={setPersonalMobile}
            onBlur={() => handleContactFieldBlur('mobileNumber', personalMobile)}
            placeholder={t('profile.personal.mobilePlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            keyboardType="phone-pad"
            returnKeyType="done"
            accessibilityLabel={t('profile.personal.mobileLabel')}
          />
        </View>

        {/* Landline number */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('profile.personal.landlineLabel')}</Text>
          <TextInput
            style={[styles.textInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
            value={personalLandline}
            onChangeText={setPersonalLandline}
            onBlur={() => handleContactFieldBlur('landlineNumber', personalLandline)}
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
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
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
                <ContactAvatar
                  name={item.contactName}
                  size={40}
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
        visible={activePicker === 'language'}
        title={t('profile.selectLanguage')}
        options={languageOptions}
        selectedValue={i18n.language}
        onSelect={handleLanguageSelect}
        onClose={closePicker}
      />

      <PickerModal
        visible={activePicker === 'country'}
        title={t('demographics.selectCountry')}
        options={countryOptions}
        selectedValue={addressCountryCode}
        onSelect={handleCountrySelect}
        onClose={closePicker}
      />

      <PickerModal
        visible={activePicker === 'gender'}
        title={t('demographics.selectGender')}
        options={genderOptions}
        selectedValue={gender}
        onSelect={handleGenderSelect}
        onClose={closePicker}
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
  profileSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    position: 'relative',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  cameraIcon: {
    fontSize: 16,
  },
  displayName: {
    ...typography.h3,
    marginTop: spacing.sm,
    textAlign: 'center',
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
  readOnlyIcon: {
    fontSize: 16,
    marginLeft: spacing.sm,
    opacity: 0.5,
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
