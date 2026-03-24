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
import { ContactAvatar, LoadingView, ScrollViewWithIndicator, ErrorView, Icon } from '@/components';
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

  // ── View/Edit mode ──
  const [isEditing, setIsEditing] = useState(false);

  // Section 1: "Wie ben je?"
  const [displayFirstName, setDisplayFirstName] = useState('');
  const [displayLastName, setDisplayLastName] = useState('');
  const [gender, setGender] = useState<Gender | undefined>();
  const [birthDate, setBirthDate] = useState<string | undefined>(undefined);
  const [weddingDate, setWeddingDate] = useState<string | undefined>(undefined);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [showWeddingDatePicker, setShowWeddingDatePicker] = useState(false);

  // Local Date state for pickers — avoids string→Date roundtrip that causes spinner jumping
  const [tempBirthDate, setTempBirthDate] = useState<Date>(new Date());
  const [tempWeddingDate, setTempWeddingDate] = useState<Date>(new Date());

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

  // Snapshot of original values for cancel/dirty check
  interface EditSnapshot {
    displayFirstName: string;
    displayLastName: string;
    gender: Gender | undefined;
    birthDate: string | undefined;
    weddingDate: string | undefined;
    addressCountryCode: string | undefined;
    addressPostalCode: string;
    addressHouseNumber: string;
    addressStreet: string;
    addressCity: string;
    addressProvince: string;
    personalEmail: string;
    personalMobile: string;
    personalLandline: string;
  }
  const snapshotRef = useRef<EditSnapshot | null>(null);

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

  // Validation: tracks which required field is currently invalid (light-red highlight)
  // Cleared reactively when the user fills the field
  const [invalidField, setInvalidField] = useState<string | null>(null);

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

  // ── View/Edit mode handlers ──

  const takeSnapshot = useCallback((): EditSnapshot => ({
    displayFirstName,
    displayLastName,
    gender,
    birthDate,
    weddingDate,
    addressCountryCode,
    addressPostalCode,
    addressHouseNumber,
    addressStreet,
    addressCity,
    addressProvince,
    personalEmail,
    personalMobile,
    personalLandline,
  }), [displayFirstName, displayLastName, gender, birthDate, weddingDate,
    addressCountryCode, addressPostalCode, addressHouseNumber, addressStreet,
    addressCity, addressProvince, personalEmail, personalMobile, personalLandline]);

  // On-demand dirty check — avoids re-renders on every keystroke that useMemo would cause
  // (useMemo with 14 field dependencies triggers re-render when isDirty flips true/false,
  // which can cause TextInput cursor jumping on the first keystroke)
  const getIsDirty = useCallback(() => {
    const snap = snapshotRef.current;
    if (!snap) return false;
    return (
      displayFirstName !== snap.displayFirstName ||
      displayLastName !== snap.displayLastName ||
      gender !== snap.gender ||
      birthDate !== snap.birthDate ||
      weddingDate !== snap.weddingDate ||
      addressCountryCode !== snap.addressCountryCode ||
      addressPostalCode !== snap.addressPostalCode ||
      addressHouseNumber !== snap.addressHouseNumber ||
      addressStreet !== snap.addressStreet ||
      addressCity !== snap.addressCity ||
      addressProvince !== snap.addressProvince ||
      personalEmail !== snap.personalEmail ||
      personalMobile !== snap.personalMobile ||
      personalLandline !== snap.personalLandline
    );
  }, [displayFirstName, displayLastName, gender, birthDate, weddingDate,
    addressCountryCode, addressPostalCode, addressHouseNumber, addressStreet,
    addressCity, addressProvince, personalEmail, personalMobile, personalLandline]);

  const handleStartEdit = useCallback(() => {
    void triggerFeedback('tap');
    snapshotRef.current = takeSnapshot();
    setIsEditing(true);
  }, [triggerFeedback, takeSnapshot]);

  const restoreSnapshot = useCallback(() => {
    const snap = snapshotRef.current;
    if (!snap) return;
    setDisplayFirstName(snap.displayFirstName);
    setDisplayLastName(snap.displayLastName);
    setGender(snap.gender);
    setBirthDate(snap.birthDate);
    setWeddingDate(snap.weddingDate);
    setAddressCountryCode(snap.addressCountryCode);
    setAddressPostalCode(snap.addressPostalCode);
    setAddressHouseNumber(snap.addressHouseNumber);
    setAddressStreet(snap.addressStreet);
    setAddressCity(snap.addressCity);
    setAddressProvince(snap.addressProvince);
    setPersonalEmail(snap.personalEmail);
    setPersonalMobile(snap.personalMobile);
    setPersonalLandline(snap.personalLandline);
  }, []);

  const handleCancelEdit = useCallback(() => {
    void triggerFeedback('tap');
    if (getIsDirty()) {
      Alert.alert(
        t('common.formActions.discardTitle'),
        t('common.formActions.discardMessage'),
        [
          { text: t('common.formActions.keepEditing'), style: 'cancel' },
          {
            text: t('common.formActions.discard'),
            style: 'destructive',
            onPress: () => { restoreSnapshot(); setIsEditing(false); },
          },
        ],
      );
    } else {
      restoreSnapshot();
      setIsEditing(false);
    }
  }, [getIsDirty, restoreSnapshot, t, triggerFeedback]);

  const handleSave = useCallback(async () => {
    void triggerFeedback('tap');
    Keyboard.dismiss();

    // Validate required fields — scroll to first empty field + highlight
    const requiredFields: { key: string; value: string | undefined }[] = [
      { key: 'displayFirstName', value: displayFirstName.trim() },
      { key: 'displayLastName', value: displayLastName.trim() },
      { key: 'gender', value: gender },
      { key: 'birthDate', value: birthDate },
      { key: 'country', value: addressCountryCode },
      { key: 'addressPostalCode', value: addressPostalCode.trim() },
      { key: 'addressHouseNumber', value: addressHouseNumber.trim() },
      { key: 'addressCity', value: addressCity.trim() },
    ];
    const firstEmpty = requiredFields.find(f => !f.value);
    if (firstEmpty) {
      void triggerFeedback('warning');
      setInvalidField(firstEmpty.key);
      setNotification({
        type: 'error',
        title: t('profile.validation.requiredTitle'),
        message: t('profile.validation.requiredMessage'),
      });
      // Scroll to the first empty required field
      scrollToField(firstEmpty.key, { isModalReturn: false });
      return;
    }

    // Clear any previous validation error
    setInvalidField(null);

    const updates: Partial<UserProfile> = {
      firstName: displayFirstName.trim(),
      lastName: displayLastName.trim(),
      gender,
      birthDate: birthDate || '',
      weddingDate: weddingDate || '',
      countryCode: addressCountryCode,
      addressCountry: addressCountryCode,
      addressPostalCode: addressPostalCode.trim(),
      addressStreet: addressStreet.trim(),
      addressCity: addressCity.trim(),
      addressProvince: addressProvince.trim(),
      city: addressCity.trim(),
      email: personalEmail.trim(),
      mobileNumber: personalMobile.trim(),
      landlineNumber: personalLandline.trim(),
    };

    // Auto-calculate ageBracket from birthDate
    if (birthDate) {
      const bracket = calculateAgeBracket(birthDate);
      if (bracket) updates.ageBracket = bracket;
    }

    const saved = await saveProfile(updates);
    if (saved) {
      setNotification({ type: 'success', title: t('profile.personal.saved'), message: '' });
      // Refresh modules if country changed (e.g., enable Nu.nl for Netherlands)
      const snap = snapshotRef.current;
      if (snap && addressCountryCode !== snap.addressCountryCode) {
        await refreshModules();
      }
      setIsEditing(false);
      snapshotRef.current = null;
    }
  }, [displayFirstName, displayLastName, gender, birthDate, weddingDate,
    addressCountryCode, addressPostalCode, addressHouseNumber, addressStreet, addressCity,
    addressProvince, personalEmail, personalMobile, personalLandline,
    saveProfile, refreshModules, scrollToField, t, triggerFeedback]);

  // Clear validation highlight reactively when the invalid field is filled
  useEffect(() => {
    if (!invalidField) return;
    const fieldValues: Record<string, string | undefined> = {
      displayFirstName: displayFirstName.trim(),
      displayLastName: displayLastName.trim(),
      gender,
      birthDate,
      country: addressCountryCode,
      addressPostalCode: addressPostalCode.trim(),
      addressHouseNumber: addressHouseNumber.trim(),
      addressCity: addressCity.trim(),
    };
    if (fieldValues[invalidField]) {
      setInvalidField(null);
    }
  }, [invalidField, displayFirstName, displayLastName, gender, birthDate,
    addressCountryCode, addressPostalCode, addressHouseNumber, addressCity]);

  // ── Section 1: "Wie ben je?" handlers (edit mode only) ──

  const handleGenderSelect = useCallback((selectedGender: string) => {
    void triggerFeedback('tap');
    setGender(selectedGender as Gender);
  }, [triggerFeedback]);

  const handleBirthDatePickerChange = useCallback((_event: import('@react-native-community/datetimepicker').DateTimePickerEvent, selectedDate?: Date) => {
    if (!selectedDate) return;
    setTempBirthDate(selectedDate);
  }, []);

  const handleBirthDatePickerClose = useCallback(() => {
    // Commit temp date to string state when picker closes
    // Use local date components to avoid UTC timezone shift (toISOString converts to UTC,
    // which in CET/CEST causes the date to shift back by 1 day)
    const y = tempBirthDate.getFullYear();
    const m = String(tempBirthDate.getMonth() + 1).padStart(2, '0');
    const d = String(tempBirthDate.getDate()).padStart(2, '0');
    setBirthDate(`${y}-${m}-${d}`);
    setShowBirthDatePicker(false);
    scrollToField('birthDate', { isModalReturn: true });
  }, [tempBirthDate, scrollToField]);

  const handleWeddingDatePickerChange = useCallback((_event: import('@react-native-community/datetimepicker').DateTimePickerEvent, selectedDate?: Date) => {
    if (!selectedDate) return;
    setTempWeddingDate(selectedDate);
  }, []);

  const handleWeddingDatePickerClose = useCallback(() => {
    // Commit temp date to string state when picker closes
    // Use local date components to avoid UTC timezone shift
    const y = tempWeddingDate.getFullYear();
    const m = String(tempWeddingDate.getMonth() + 1).padStart(2, '0');
    const d = String(tempWeddingDate.getDate()).padStart(2, '0');
    setWeddingDate(`${y}-${m}-${d}`);
    setShowWeddingDatePicker(false);
    scrollToField('weddingDate', { isModalReturn: true });
  }, [tempWeddingDate, scrollToField]);

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

  // ── Section 2: "Waar woon je?" handlers (edit mode only, no auto-save) ──

  const handleCountrySelect = useCallback((countryCode: string) => {
    void triggerFeedback('tap');
    setAddressCountryCode(countryCode);
    // Clear address fields when country changes
    setAddressPostalCode('');
    setAddressHouseNumber('');
    setAddressStreet('');
    setAddressCity('');
    setAddressProvince('');
  }, [triggerFeedback]);

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

  // Note: Section 2 & 3 no longer auto-save on blur.
  // All changes are batch-saved via handleSave when user taps "Opslaan".

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

      {/* Fixed edit bar — always visible above ScrollView */}
      <View style={[styles.fixedEditBar, { backgroundColor: themeColors.background, borderBottomColor: themeColors.border }]}>
        {isEditing ? (
          <>
            <HapticTouchable hapticDisabled
              style={[styles.fixedEditBarButton, { backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.border }]}
              onPress={handleCancelEdit}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={[styles.fixedEditBarButtonText, { color: themeColors.textPrimary }]}>{t('common.cancel')}</Text>
            </HapticTouchable>
            <HapticTouchable hapticDisabled
              style={[styles.fixedEditBarButton, { backgroundColor: accentColor.primary }]}
              onPress={() => void handleSave()}
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
            >
              <Icon name="checkmark" size={22} color={colors.textOnPrimary} />
              <Text style={[styles.fixedEditBarButtonText, { color: colors.textOnPrimary }]}>{t('common.save')}</Text>
            </HapticTouchable>
          </>
        ) : (
          <HapticTouchable hapticDisabled
            style={[styles.fixedEditBarButton, { flex: 1, backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.border }]}
            onPress={handleStartEdit}
            accessibilityRole="button"
            accessibilityLabel={t('common.edit')}
          >
            <Icon name="pencil" size={22} color={accentColor.primary} />
            <Text style={[styles.fixedEditBarButtonText, { color: accentColor.primary }]}>{t('common.edit')}</Text>
          </HapticTouchable>
        )}
      </View>

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
        <View style={[styles.fieldContainer, invalidField === 'displayFirstName' && styles.invalidFieldHighlight]} ref={registerField('displayFirstName')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('onboarding.firstName')}{requiredMark}
          </Text>
          {isEditing ? (
            <TextInput
              style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
              value={displayFirstName}
              onChangeText={setDisplayFirstName}
              onFocus={getFieldFocusHandler('displayFirstName')}
              placeholder={t('onboarding.firstNamePlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              maxLength={50}
              returnKeyType="next"
              onSubmitEditing={() => lastNameInputRef.current?.focus()}
              accessibilityLabel={t('onboarding.firstName')}
            />
          ) : (
            <Text style={[styles.readOnlyValue, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}>
              {displayFirstName || '-'}
            </Text>
          )}
        </View>

        {/* Last name */}
        <View style={[styles.fieldContainer, invalidField === 'displayLastName' && styles.invalidFieldHighlight]} ref={registerField('displayLastName')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('onboarding.lastName')}{requiredMark}
          </Text>
          {isEditing ? (
            <TextInput
              ref={lastNameInputRef}
              style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
              value={displayLastName}
              onChangeText={setDisplayLastName}
              onFocus={getFieldFocusHandler('displayLastName')}
              placeholder={t('onboarding.lastNamePlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              maxLength={50}
              returnKeyType="done"
              accessibilityLabel={t('onboarding.lastName')}
            />
          ) : (
            <Text style={[styles.readOnlyValue, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}>
              {displayLastName || '-'}
            </Text>
          )}
        </View>

        {/* Gender */}
        <View style={[styles.fieldContainer, invalidField === 'gender' && styles.invalidFieldHighlight]} ref={registerField('gender')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('demographics.genderLabel')}{requiredMark}
          </Text>
          {isEditing ? (
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
              <Icon name="chevron-right" size={20} color={themeColors.textTertiary} />
            </HapticTouchable>
          ) : (
            <Text style={[styles.readOnlyValue, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}>
              {gender ? t(`demographics.gender.${gender}`) : '-'}
            </Text>
          )}
        </View>

        {/* Birth date */}
        <View style={[styles.fieldContainer, invalidField === 'birthDate' && styles.invalidFieldHighlight]} ref={registerField('birthDate')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('profile.personal.birthDateLabel')}{requiredMark}
          </Text>
          {isEditing ? (
            <HapticTouchable hapticDisabled
              style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              onPress={() => {
                Keyboard.dismiss();
                // Initialize temp date from current string value
                setTempBirthDate(parseDateValue(birthDate));
                setTimeout(() => setShowBirthDatePicker(true), 100);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('profile.personal.birthDateLabel')}
            >
              <Text style={[styles.pickerValue, birthDate ? { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle } : { color: themeColors.textTertiary }]}>
                {formatDateDisplay(birthDate)}
              </Text>
              <Icon name="chevron-right" size={20} color={themeColors.textTertiary} />
            </HapticTouchable>
          ) : (
            <Text style={[styles.readOnlyValue, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}>
              {formatDateDisplay(birthDate)}
            </Text>
          )}
        </View>

        {/* Wedding date */}
        <View style={styles.fieldContainer} ref={registerField('weddingDate')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('profile.personal.weddingDateLabel')}
          </Text>
          {isEditing ? (
            <HapticTouchable hapticDisabled
              style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              onPress={() => {
                Keyboard.dismiss();
                // Initialize temp date from current string value
                setTempWeddingDate(parseDateValue(weddingDate));
                setTimeout(() => setShowWeddingDatePicker(true), 100);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('profile.personal.weddingDateLabel')}
            >
              <Text style={[styles.pickerValue, weddingDate ? { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle } : { color: themeColors.textTertiary }]}>
                {formatDateDisplay(weddingDate)}
              </Text>
              <Icon name="chevron-right" size={20} color={themeColors.textTertiary} />
            </HapticTouchable>
          ) : (
            <Text style={[styles.readOnlyValue, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}>
              {formatDateDisplay(weddingDate)}
            </Text>
          )}
        </View>
      </View>

      {/* ── Section 2: "Waar woon je?" ─────────────────────────── */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>{t('onboarding.profileStep2.title')}</Text>

        {/* Country */}
        <View style={[styles.fieldContainer, invalidField === 'country' && styles.invalidFieldHighlight]} ref={registerField('country')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('demographics.countryLabel')}{requiredMark}
          </Text>
          {isEditing ? (
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
              <Icon name="chevron-right" size={20} color={themeColors.textTertiary} />
            </HapticTouchable>
          ) : (
            <Text style={[styles.readOnlyValue, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}>
              {addressCountryCode
                ? `${COUNTRY_FLAGS[addressCountryCode] || ''} ${t(`demographics.countries.${addressCountryCode}`, addressCountryCode)}`
                : '-'}
            </Text>
          )}
        </View>

        {/* Postcode + Huisnummer row */}
        <View style={styles.rowFields}>
          <View style={[styles.fieldContainer, { flex: 1, marginRight: spacing.sm }, invalidField === 'addressPostalCode' && styles.invalidFieldHighlight]} ref={registerField('addressPostalCode')}>
            <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
              {t('onboarding.personalDetails.addressPostalCode')}{requiredMark}
            </Text>
            {isEditing ? (
              <TextInput
                style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
                value={addressPostalCode}
                onChangeText={setAddressPostalCode}
                onBlur={() => void handleAddressLookup()}
                onFocus={getFieldFocusHandler('addressPostalCode')}
                placeholder={t('onboarding.personalDetails.postalCodePlaceholder')}
                placeholderTextColor={themeColors.textTertiary}
                autoCapitalize="characters"
                returnKeyType="next"
                accessibilityLabel={t('onboarding.personalDetails.addressPostalCode')}
              />
            ) : (
              <Text style={[styles.readOnlyValue, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}>
                {addressPostalCode || '-'}
              </Text>
            )}
          </View>
          <View style={[styles.fieldContainer, { flex: 1 }, invalidField === 'addressHouseNumber' && styles.invalidFieldHighlight]} ref={registerField('addressHouseNumber')}>
            <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
              {t('onboarding.profileStep2.houseNumber')}{requiredMark}
            </Text>
            {isEditing ? (
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
            ) : (
              <Text style={[styles.readOnlyValue, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}>
                {addressHouseNumber || '-'}
              </Text>
            )}
          </View>
        </View>

        {/* GISCO lookup indicator */}
        {isEditing && isLookingUp && (
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
          {isEditing ? (
            <TextInput
              style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
              value={addressStreet}
              onChangeText={setAddressStreet}
              onFocus={getFieldFocusHandler('addressStreet')}
              placeholder={t('onboarding.personalDetails.streetPlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              returnKeyType="next"
              accessibilityLabel={t('onboarding.personalDetails.addressStreet')}
            />
          ) : (
            <Text style={[styles.readOnlyValue, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}>
              {addressStreet || '-'}
            </Text>
          )}
        </View>

        {/* City */}
        <View style={[styles.fieldContainer, invalidField === 'addressCity' && styles.invalidFieldHighlight]} ref={registerField('addressCity')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('onboarding.personalDetails.addressCity')}{requiredMark}
          </Text>
          {isEditing ? (
            <TextInput
              style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
              value={addressCity}
              onChangeText={setAddressCity}
              onFocus={getFieldFocusHandler('addressCity')}
              placeholder={t('onboarding.personalDetails.cityPlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              returnKeyType="next"
              accessibilityLabel={t('onboarding.personalDetails.addressCity')}
            />
          ) : (
            <Text style={[styles.readOnlyValue, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}>
              {addressCity || '-'}
            </Text>
          )}
        </View>

        {/* Province */}
        <View style={styles.fieldContainer} ref={registerField('addressProvince')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('onboarding.profileStep2.provinceLabel')}
          </Text>
          {isEditing ? (
            <TextInput
              style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
              value={addressProvince}
              onChangeText={setAddressProvince}
              onFocus={getFieldFocusHandler('addressProvince')}
              placeholder={t('onboarding.profileStep2.provincePlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              returnKeyType="done"
              accessibilityLabel={t('onboarding.profileStep2.provinceLabel')}
            />
          ) : (
            <Text style={[styles.readOnlyValue, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}>
              {addressProvince || '-'}
            </Text>
          )}
        </View>
      </View>

      {/* ── Section 3: "Hoe bereiken we je?" ─────────────────────────── */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>{t('onboarding.profileStep3.title')}</Text>
        <Text style={[styles.sectionSubtitle, { color: themeColors.textTertiary }]}>{t('profile.personal.subtitle')}</Text>

        {/* Email */}
        <View style={styles.fieldContainer} ref={registerField('personalEmail')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>{t('profile.personal.emailLabel')}</Text>
          {isEditing ? (
            <TextInput
              style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
              value={personalEmail}
              onChangeText={setPersonalEmail}
              onFocus={getFieldFocusHandler('personalEmail')}
              placeholder={t('profile.personal.emailPlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              accessibilityLabel={t('profile.personal.emailLabel')}
            />
          ) : (
            <Text style={[styles.readOnlyValue, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}>
              {personalEmail || '-'}
            </Text>
          )}
        </View>

        {/* Mobile number */}
        <View style={styles.fieldContainer} ref={registerField('personalMobile')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>{t('profile.personal.mobileLabel')}</Text>
          {isEditing ? (
            <TextInput
              style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
              value={personalMobile}
              onChangeText={setPersonalMobile}
              onFocus={getFieldFocusHandler('personalMobile')}
              placeholder={t('profile.personal.mobilePlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              keyboardType="phone-pad"
              returnKeyType="done"
              accessibilityLabel={t('profile.personal.mobileLabel')}
            />
          ) : (
            <Text style={[styles.readOnlyValue, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}>
              {personalMobile || '-'}
            </Text>
          )}
        </View>

        {/* Landline number */}
        <View style={styles.fieldContainer} ref={registerField('personalLandline')}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>{t('profile.personal.landlineLabel')}</Text>
          {isEditing ? (
            <TextInput
              style={[styles.textInput, { borderColor: themeColors.border, color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle, backgroundColor: themeColors.surface }]}
              value={personalLandline}
              onChangeText={setPersonalLandline}
              onFocus={getFieldFocusHandler('personalLandline')}
              placeholder={t('profile.personal.landlinePlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              keyboardType="phone-pad"
              returnKeyType="done"
              accessibilityLabel={t('profile.personal.landlineLabel')}
            />
          ) : (
            <Text style={[styles.readOnlyValue, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}>
              {personalLandline || '-'}
            </Text>
          )}
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

      </ScrollViewWithIndicator>

      {/* Picker modals — MUST be outside ScrollView for correct rendering */}
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

      {/* Date picker modals — use local Date state to avoid spinner jumping */}
      <DateTimePickerModal
        visible={showBirthDatePicker}
        title={t('profile.personal.birthDateLabel')}
        value={tempBirthDate}
        mode="date"
        moduleId="settings"
        onChange={handleBirthDatePickerChange}
        onClose={handleBirthDatePickerClose}
        maximumDate={new Date()}
        minimumDate={new Date(1900, 0, 1)}
        locale={pickerLocale}
      />

      <DateTimePickerModal
        visible={showWeddingDatePicker}
        title={t('profile.personal.weddingDateLabel')}
        value={tempWeddingDate}
        mode="date"
        moduleId="settings"
        onChange={handleWeddingDatePickerChange}
        onClose={handleWeddingDatePickerClose}
        maximumDate={new Date(new Date().getFullYear() + 5, 11, 31)}
        minimumDate={new Date(1940, 0, 1)}
        locale={pickerLocale}
      />

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
  invalidFieldHighlight: {
    backgroundColor: 'rgba(255, 0, 0, 0.08)',
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginHorizontal: -spacing.xs,
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
  // ── View/Edit bar styles ──
  fixedEditBar: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fixedEditBarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
  },
  fixedEditBarButtonText: {
    ...typography.button,
    fontSize: 16,
  },
  readOnlyValue: {
    ...typography.body,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
    justifyContent: 'center',
  },
});
