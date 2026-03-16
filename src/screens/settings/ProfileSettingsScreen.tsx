/**
 * ProfileSettingsScreen — Edit your profile
 *
 * Allows users to edit:
 * - Profile photo
 * - Display name
 * - Demographics (country, region, age bracket) - required for free users
 *
 * Shows (read-only):
 * - Phone number (changed via re-verification)
 * - UUID (dev mode only)
 *
 * Senior-inclusive design:
 * - Large tappable elements (60pt+ touch targets)
 * - Clear labels and hints
 * - Simple picker interfaces
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
  Modal,
  Switch,
  NativeSyntheticEvent,
  TextInputFocusEventData,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';
import { useNavigation, useIsFocused } from '@react-navigation/native';

import { colors, typography, spacing, borderRadius, touchTargets } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { ContactAvatar, LoadingView, ScrollViewWithIndicator, ErrorView, LiquidGlassView } from '@/components';
import { useVoiceFocusList, useVoiceFocusContext } from '@/contexts/VoiceFocusContext';
import {
  pickImageFromCamera,
  pickImageFromGallery,
  saveAvatar,
  getAvatarPath,
} from '@/services/imageService';
import { useModuleConfig } from '@/contexts/ModuleConfigContext';
import type { UserProfile, AgeBracket, SupportedLanguage, Gender } from '@/services/interfaces';
import type { WeatherLocation } from '@/types/weather';
import {
  SUPPORTED_LANGUAGES,
  COUNTRIES,
  COUNTRY_FLAGS,
  LANGUAGE_FLAGS,
  REGIONS_BY_COUNTRY,
  AGE_BRACKETS,
  GENDERS,
} from './profileSettingsConstants';
import { PickerModal } from './PickerModal';
import { CitySearchInline } from './CityPickerModal';

// Field identifiers for validation and scrolling
type FieldId = 'name' | 'country' | 'region' | 'city' | 'age' | 'gender';

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
  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasShownValidationAlert, setHasShownValidationAlert] = useState(false);
  const [cityInput, setCityInput] = useState(''); // Local state for city input

  // Personal data fields (shareable with contacts via consent)
  const [personalEmail, setPersonalEmail] = useState('');
  const [personalMobile, setPersonalMobile] = useState('');
  const [personalLandline, setPersonalLandline] = useState('');
  const [personalStreet, setPersonalStreet] = useState('');
  const [personalPostalCode, setPersonalPostalCode] = useState('');
  const [personalCity, setPersonalCity] = useState('');
  const [personalCountry, setPersonalCountry] = useState('');
  const [birthDate, setBirthDate] = useState<string | undefined>(undefined);
  const [weddingDate, setWeddingDate] = useState<string | undefined>(undefined);
  const [activeDatePicker, setActiveDatePicker] = useState<'birth' | 'wedding' | null>(null);

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

  // Field position refs for scrolling to empty fields
  const fieldPositions = useRef<Record<FieldId, number>>({
    name: 0,
    country: 0,
    region: 0,
    city: 0,
    age: 0,
    gender: 0,
  });

  // Ref for demographics section to calculate absolute positions
  const demographicsSectionRef = useRef<View>(null);
  const demographicsSectionY = useRef<number>(0);

  // Refs to track latest values for beforeRemove (avoids stale closures)
  const cityInputRef2 = useRef(cityInput);
  const profileRef = useRef(profile);
  cityInputRef2.current = cityInput;
  profileRef.current = profile;

  // Single active picker state (only one picker can be open at a time)
  type PickerType = 'language' | 'country' | 'region' | 'city' | 'age' | 'gender' | null;
  const [activePicker, setActivePicker] = useState<PickerType>(null);
  const closePicker = useCallback(() => setActivePicker(null), []);

  // Helper to find first missing field
  const getFirstMissingField = useCallback((
    name: string,
    userProfile: UserProfile | null,
    city: string
  ): FieldId | null => {
    if (!name || name.trim().length < 2) return 'name';
    if (!userProfile?.countryCode) return 'country';
    if (!userProfile?.regionCode) return 'region';
    if (!city.trim()) return 'city';
    if (!userProfile?.ageBracket) return 'age';
    if (!userProfile?.gender) return 'gender';
    return null;
  }, []);

  // Scroll to a specific field (using absolute Y position)
  const scrollToField = useCallback((fieldId: FieldId) => {
    // For demographics fields, add the section's Y offset
    const isDemographicsField = ['country', 'region', 'city', 'age', 'gender'].includes(fieldId);
    const baseY = fieldPositions.current[fieldId];
    const absoluteY = isDemographicsField ? demographicsSectionY.current + baseY : baseY;

    console.log('[scrollToField]', fieldId, 'baseY:', baseY, 'sectionY:', demographicsSectionY.current, 'absoluteY:', absoluteY);

    if (scrollViewRef.current && absoluteY > 0) {
      // Scroll with some offset so the field is visible at top of screen
      scrollViewRef.current.scrollTo({ y: Math.max(0, absoluteY - 120), animated: true });
    }
  }, []);

  // Open the picker for a specific field
  const openPickerForField = useCallback((fieldId: FieldId) => {
    switch (fieldId) {
      case 'name':
        setTempName(displayName);
        setEditingName(true);
        break;
      case 'country':
        setActivePicker('country');
        break;
      case 'region':
        setActivePicker('region');
        break;
      case 'city':
        // Toggle inline city search panel
        setActivePicker('city');
        break;
      case 'age':
        setActivePicker('age');
        break;
      case 'gender':
        setActivePicker('gender');
        break;
    }
  }, [displayName]);

  // Load current user profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { ServiceContainer } = await import('@/services/container');
        const loadedProfile = await ServiceContainer.database.getUserProfile();

        if (loadedProfile) {
          setProfile(loadedProfile);
          setDisplayName(loadedProfile.name);
          setCityInput(loadedProfile.city || '');

          // Load personal data fields
          setPersonalEmail(loadedProfile.email || '');
          setPersonalMobile(loadedProfile.mobileNumber || '');
          setPersonalLandline(loadedProfile.landlineNumber || '');
          setPersonalStreet(loadedProfile.addressStreet || '');
          setPersonalPostalCode(loadedProfile.addressPostalCode || '');
          setPersonalCity(loadedProfile.addressCity || '');
          setPersonalCountry(loadedProfile.addressCountry || '');
          setBirthDate(loadedProfile.birthDate || undefined);
          setWeddingDate(loadedProfile.weddingDate || undefined);

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

  // Show validation alert when profile loads with missing fields
  useEffect(() => {
    if (loading || hasShownValidationAlert || !profile) return;

    const firstMissing = getFirstMissingField(displayName, profile, cityInput);
    if (firstMissing) {
      setHasShownValidationAlert(true);

      // Small delay to ensure layout is complete
      setTimeout(() => {
        setNotification({
          type: 'warning',
          title: t('validation.profileIncomplete'),
          message: t('validation.profileIncompleteMessage'),
        });
        // Scroll to the first missing field and open its picker
        scrollToField(firstMissing);
        // Small delay before opening picker to allow scroll to complete
        setTimeout(() => {
          openPickerForField(firstMissing);
        }, 300);
      }, 500);
    }
  }, [loading, hasShownValidationAlert, profile, displayName, cityInput, getFirstMissingField, scrollToField, openPickerForField, t]);

  // Save city when leaving screen (beforeRemove event)
  // This ensures city is saved even if user taps back without blurring the input
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Use refs to get latest values (avoids stale closure)
      const currentCity = cityInputRef2.current.trim();
      const currentProfile = profileRef.current;

      // Check if city needs to be saved
      if (currentProfile && currentCity !== (currentProfile.city || '')) {
        // Prevent default behavior (leaving the screen)
        e.preventDefault();

        console.log('[ProfileSettings] Saving city on beforeRemove:', currentCity);

        // Save synchronously by blocking navigation
        (async () => {
          try {
            const { ServiceContainer } = await import('@/services/container');
            await ServiceContainer.database.saveUserProfile({
              ...currentProfile,
              city: currentCity,
            });
            console.log('[ProfileSettings] City saved, now navigating back');
          } catch (error) {
            console.error('Failed to save city on leave:', error);
          }

          // Now allow navigation to proceed
          navigation.dispatch(e.data.action);
        })();
      }
    });

    return unsubscribe;
  }, [navigation]);

  const saveProfile = useCallback(async (updates: Partial<UserProfile>): Promise<boolean> => {
    // Use ref to get latest profile (avoids stale closure)
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
      console.log('[ProfileSettings] Profile saved:', updates);

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

  const handleEditName = useCallback(() => {
    void triggerFeedback('tap');
    setTempName(displayName);
    setEditingName(true);
  }, [displayName, triggerFeedback]);

  const handleSaveName = useCallback(async () => {
    void triggerFeedback('tap');
    const trimmedName = tempName.trim();
    if (trimmedName.length < 2) {
      setNotification({ type: 'warning', title: t('errors.genericTitle'), message: t('onboarding.nameMinLength') });
      return;
    }
    setDisplayName(trimmedName);
    setEditingName(false);
    await saveProfile({ name: trimmedName });
  }, [tempName, saveProfile, t, triggerFeedback]);

  const handleCountrySelect = useCallback(async (countryCode: string) => {
    void triggerFeedback('tap');
    // When country changes, clear region
    const saved = await saveProfile({ countryCode, regionCode: undefined });
    // Refresh enabled modules based on new country (e.g., Nu.nl for Netherlands)
    if (saved) {
      console.info('[ProfileSettingsScreen] Country changed to', countryCode, '- refreshing modules');
      await refreshModules();
    }
  }, [saveProfile, triggerFeedback, refreshModules]);

  const handleRegionSelect = useCallback(async (regionCode: string) => {
    void triggerFeedback('tap');
    await saveProfile({ regionCode });
  }, [saveProfile, triggerFeedback]);

  // City selection from weather API search
  const handleCitySelect = useCallback(async (location: WeatherLocation) => {
    void triggerFeedback('tap');
    const cityName = location.name;
    setCityInput(cityName);
    cityInputRef2.current = cityName;
    await saveProfile({ city: cityName });
  }, [saveProfile, triggerFeedback]);

  // Scroll to ensure focused input is visible above keyboard
  const handleInputFocus = useCallback((
    event: NativeSyntheticEvent<TextInputFocusEventData>,
    fieldId: FieldId
  ) => {
    // Wait for keyboard to appear, then scroll to field
    setTimeout(() => {
      const yPosition = fieldPositions.current[fieldId];
      if (scrollViewRef.current && yPosition > 0) {
        // Scroll so field is in upper third of visible area (above keyboard)
        scrollViewRef.current.scrollTo({
          y: Math.max(0, yPosition - 150),
          animated: true,
        });
      }
    }, 300);
  }, []);

  const handleAgeSelect = useCallback(async (ageBracket: string) => {
    void triggerFeedback('tap');
    await saveProfile({ ageBracket: ageBracket as AgeBracket });
  }, [saveProfile, triggerFeedback]);

  const handleLanguageSelect = useCallback(async (language: string) => {
    void triggerFeedback('tap');
    // Change the app language immediately
    await i18n.changeLanguage(language);
    // Save to profile
    await saveProfile({ language: language as SupportedLanguage });
  }, [i18n, saveProfile, triggerFeedback]);

  const handleGenderSelect = useCallback(async (gender: string) => {
    void triggerFeedback('tap');
    await saveProfile({ gender: gender as Gender });
  }, [saveProfile, triggerFeedback]);

  // Personal data save handlers (save on blur)
  const handlePersonalFieldBlur = useCallback(async (field: string, value: string) => {
    const updates: Partial<UserProfile> = {};
    switch (field) {
      case 'email': updates.email = value.trim(); break;
      case 'mobileNumber': updates.mobileNumber = value.trim(); break;
      case 'landlineNumber': updates.landlineNumber = value.trim(); break;
      case 'addressStreet': updates.addressStreet = value.trim(); break;
      case 'addressPostalCode': updates.addressPostalCode = value.trim(); break;
      case 'addressCity': updates.addressCity = value.trim(); break;
      case 'addressCountry': updates.addressCountry = value.trim(); break;
    }
    const saved = await saveProfile(updates);
    if (saved) {
      setNotification({ type: 'success', title: t('profile.personal.saved'), message: '' });
    }
  }, [saveProfile, t]);

  const handleDateChange = useCallback(async (type: 'birth' | 'wedding', event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'set' && date) {
      const isoDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
      if (type === 'birth') {
        setBirthDate(isoDate);
        await saveProfile({ birthDate: isoDate });
      } else {
        setWeddingDate(isoDate);
        await saveProfile({ weddingDate: isoDate });
      }
      setNotification({ type: 'success', title: t('profile.personal.saved'), message: '' });
    }
    setActiveDatePicker(null);
  }, [saveProfile, t]);

  const handleClearDate = useCallback(async (type: 'birth' | 'wedding') => {
    void triggerFeedback('tap');
    if (type === 'birth') {
      setBirthDate(undefined);
      await saveProfile({ birthDate: '' });
    } else {
      setWeddingDate(undefined);
      await saveProfile({ weddingDate: '' });
    }
    setNotification({ type: 'success', title: t('profile.personal.saved'), message: '' });
  }, [saveProfile, t, triggerFeedback]);

  // Format ISO date (YYYY-MM-DD) to localized display
  const formatDate = useCallback((isoDate: string | undefined): string => {
    if (!isoDate) return '';
    try {
      const date = new Date(isoDate + 'T00:00:00');
      return date.toLocaleDateString(i18n.language, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  }, [i18n.language]);

  // Toggle consent for sharing data with a contact
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

  // Build picker options with flag emojis
  const languageOptions = SUPPORTED_LANGUAGES.map(lang => ({
    value: lang,
    label: `${LANGUAGE_FLAGS[lang]} ${t(`profile.language.${lang}`)}`,
  }));

  const countryOptions = COUNTRIES.map(code => ({
    value: code,
    label: `${COUNTRY_FLAGS[code]} ${t(`demographics.countries.${code}`, code)}`,
  }));

  const regionOptions = profile?.countryCode && REGIONS_BY_COUNTRY[profile.countryCode]
    ? REGIONS_BY_COUNTRY[profile.countryCode].map(code => ({
        value: code,
        label: t(`demographics.regions.${code}`, code),
      }))
    : [];

  const ageOptions = AGE_BRACKETS.map(bracket => ({
    value: bracket,
    label: t(`demographics.age.${bracket.replace('-', '_').replace('+', '_plus')}`, bracket),
  }));

  const genderOptions = GENDERS.map(gender => ({
    value: gender,
    label: t(`demographics.gender.${gender}`),
  }));

  // Voice focus items for voice navigation
  const voiceFocusItems = useMemo(() => {
    if (!screenIsFocused) return [];

    let index = 0;
    const items = [
      {
        id: 'photo',
        label: t('profile.changePhoto'),
        index: index++,
        onSelect: handleChangePhoto,
      },
      {
        id: 'name',
        label: t('onboarding.nameLabel'),
        index: index++,
        onSelect: handleEditName,
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

    // Add region if country is selected
    if (profile?.countryCode && REGIONS_BY_COUNTRY[profile.countryCode]) {
      items.push({
        id: 'region',
        label: t('demographics.regionLabel'),
        index: index++,
        onSelect: () => setActivePicker('region'),
      });
    }

    items.push(
      {
        id: 'city',
        label: t('demographics.cityLabel'),
        index: index++,
        onSelect: () => setActivePicker('city'),
      },
      {
        id: 'age',
        label: t('demographics.ageLabel'),
        index: index++,
        onSelect: () => setActivePicker('age'),
      },
      {
        id: 'gender',
        label: t('demographics.genderLabel'),
        index: index++,
        onSelect: () => setActivePicker('gender'),
      }
    );

    return items;
  }, [
    screenIsFocused,
    t,
    profile?.countryCode,
    handleChangePhoto,
    handleEditName,
  ]);

  const { scrollRef: voiceScrollRef, isFocused: isItemFocused, getFocusStyle } = useVoiceFocusList(
    'profile-settings-list',
    voiceFocusItems
  );

  if (loading) {
    return (
      <LoadingView fullscreen />
    );
  }

  const isFreeUser = profile?.subscriptionTier !== 'premium';
  const missingDemographics = isFreeUser && (!profile?.countryCode || !profile?.regionCode || !cityInput.trim() || !profile?.ageBracket || !profile?.gender);

  // Check if profile is complete (all required fields filled)
  // Use cityInput for real-time validation
  const isProfileComplete = Boolean(
    displayName.trim().length >= 2 &&
    profile?.countryCode &&
    profile?.regionCode &&
    cityInput.trim() &&
    profile?.ageBracket &&
    profile?.gender
  );

  // Check which fields are empty (for error styling)
  // Use cityInput for real-time validation (before blur saves to profile)
  const isNameEmpty = !displayName || displayName.trim().length < 2;
  const isCountryEmpty = !profile?.countryCode;
  const isRegionEmpty = !profile?.regionCode;
  const isCityEmpty = !cityInput.trim();
  const isAgeEmpty = !profile?.ageBracket;
  const isGenderEmpty = !profile?.gender;

  return (
    <KeyboardAvoidingView
      style={[styles.keyboardAvoidingContainer, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
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
          // Combine both refs for scroll functionality
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
      {/* Profile photo section */}
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
      </View>

      {/* Name section */}
      <View
        style={[styles.section, { backgroundColor: themeColors.surface }]}
        onLayout={(e) => { fieldPositions.current.name = e.nativeEvent.layout.y; }}
      >
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('onboarding.nameLabel')}</Text>
        {editingName ? (
          <View style={styles.editNameContainer}>
            <TextInput
              style={[styles.nameInput, { borderColor: accentColor.primary, color: themeColors.textPrimary, backgroundColor: themeColors.background }, isNameEmpty && styles.inputError]}
              value={tempName}
              onChangeText={setTempName}
              autoFocus
              maxLength={50}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
              onFocus={(e) => handleInputFocus(e, 'name')}
              accessibilityLabel={t('onboarding.nameLabel')}
              accessibilityHint={t('profile.enterYourName')}
            />
            <HapticTouchable hapticDisabled
              style={[styles.saveButton, { backgroundColor: accentColor.primary }]}
              onPress={handleSaveName}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={saving ? t('common.saving') : t('common.done')}
              accessibilityState={{ disabled: saving }}
            >
              <Text style={[styles.saveButtonText, { color: themeColors.textOnPrimary }]}>
                {saving ? t('common.saving') : t('common.done')}
              </Text>
            </HapticTouchable>
          </View>
        ) : (
          <HapticTouchable hapticDisabled
            style={[styles.fieldRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }, isNameEmpty && styles.fieldRowError]}
            onPress={handleEditName}
            accessibilityRole="button"
            accessibilityHint={t('profile.tapToChange')}
          >
            <Text style={[styles.fieldValue, { color: accentColor.primary }]}>{displayName}</Text>
            <Text style={styles.editIcon}>✏️</Text>
          </HapticTouchable>
        )}
      </View>

      {/* Language section - changes UI immediately */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('settings.language')}</Text>
        <HapticTouchable hapticDisabled
          style={[styles.fieldRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          onPress={() => setActivePicker('language')}
          accessibilityRole="button"
          accessibilityHint={t('profile.tapToChange')}
        >
          <Text style={[styles.fieldValue, { color: accentColor.primary }]}>
            {t(`profile.language.${i18n.language as SupportedLanguage}`)}
          </Text>
          <Text style={styles.editIcon}>✏️</Text>
        </HapticTouchable>
        <Text style={[styles.fieldHint, { color: themeColors.textTertiary }]}>{t('profile.languageHint')}</Text>
      </View>

      {/* Phone number (read-only) */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('onboarding.phoneLabel')}</Text>
        <View style={[styles.fieldRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Text style={[styles.fieldValue, { color: accentColor.primary }]}>{profile?.phoneNumber || '—'}</Text>
          <Text style={styles.readOnlyIcon}>🔒</Text>
        </View>
        <Text style={[styles.fieldHint, { color: themeColors.textTertiary }]}>{t('profile.phoneReadOnly')}</Text>
      </View>

      {/* Demographics section */}
      <View
        ref={demographicsSectionRef}
        style={[styles.section, { backgroundColor: themeColors.surface }]}
        onLayout={(e) => { demographicsSectionY.current = e.nativeEvent.layout.y; }}
      >
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('demographics.title')}</Text>
        {isFreeUser && (
          <Text style={[styles.sectionSubtitle, { color: themeColors.textTertiary }]}>{t('demographics.required')}</Text>
        )}
        {!isFreeUser && (
          <Text style={[styles.sectionSubtitle, { color: themeColors.textTertiary }]}>{t('demographics.premiumNote')}</Text>
        )}

        {/* Country */}
        <View
          style={styles.fieldContainer}
          onLayout={(e) => { fieldPositions.current.country = e.nativeEvent.layout.y; }}
        >
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('demographics.countryLabel')}</Text>
          <HapticTouchable hapticDisabled
            style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }, isCountryEmpty && styles.pickerRowError]}
            onPress={() => setActivePicker('country')}
            accessibilityRole="button"
            accessibilityLabel={t('demographics.countryLabel')}
          >
            <Text style={[styles.pickerValue, { color: themeColors.textPrimary }, profile?.countryCode && { color: accentColor.primary }, !profile?.countryCode && { color: themeColors.textTertiary }]}>
              {profile?.countryCode
                ? `${COUNTRY_FLAGS[profile.countryCode]} ${t(`demographics.countries.${profile.countryCode}`, profile.countryCode)}`
                : t('demographics.selectCountry')}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </HapticTouchable>
        </View>

        {/* Region (only if country selected) */}
        {profile?.countryCode && REGIONS_BY_COUNTRY[profile.countryCode] && (
          <View
            style={styles.fieldContainer}
            onLayout={(e) => { fieldPositions.current.region = e.nativeEvent.layout.y; }}
          >
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('demographics.regionLabel')}</Text>
            <HapticTouchable hapticDisabled
              style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }, isRegionEmpty && styles.pickerRowError]}
              onPress={() => setActivePicker('region')}
              accessibilityRole="button"
              accessibilityLabel={t('demographics.regionLabel')}
            >
              <Text style={[styles.pickerValue, { color: themeColors.textPrimary }, profile?.regionCode && { color: accentColor.primary }, !profile?.regionCode && { color: themeColors.textTertiary }]}>
                {profile?.regionCode
                  ? t(`demographics.regions.${profile.regionCode}`, profile.regionCode)
                  : t('demographics.selectRegion')}
              </Text>
              <Text style={styles.editIcon}>✏️</Text>
            </HapticTouchable>
          </View>
        )}

        {/* City picker */}
        <View
          style={styles.fieldContainer}
          onLayout={(e) => { fieldPositions.current.city = e.nativeEvent.layout.y; }}
        >
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('demographics.cityLabel')}</Text>
          <HapticTouchable hapticDisabled
            style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }, isCityEmpty && styles.pickerRowError]}
            onPress={() => setActivePicker(activePicker === 'city' ? null : 'city')}
            accessibilityRole="button"
            accessibilityLabel={t('demographics.cityLabel')}
          >
            <Text style={[styles.pickerValue, { color: themeColors.textPrimary }, cityInput && { color: accentColor.primary }, !cityInput && { color: themeColors.textTertiary }]}>
              {cityInput || t('demographics.selectCity')}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </HapticTouchable>

          {/* Inline city search — rendered below the field, not in a modal */}
          <CitySearchInline
            visible={activePicker === 'city'}
            onSelect={handleCitySelect}
            onClose={closePicker}
            language={i18n.language}
            countryCode={profile?.countryCode}
          />
        </View>

        {/* Age bracket */}
        <View
          style={styles.fieldContainer}
          onLayout={(e) => { fieldPositions.current.age = e.nativeEvent.layout.y; }}
        >
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('demographics.ageLabel')}</Text>
          <HapticTouchable hapticDisabled
            style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }, isAgeEmpty && styles.pickerRowError]}
            onPress={() => setActivePicker('age')}
            accessibilityRole="button"
            accessibilityLabel={t('demographics.ageLabel')}
          >
            <Text style={[styles.pickerValue, { color: themeColors.textPrimary }, profile?.ageBracket && { color: accentColor.primary }, !profile?.ageBracket && { color: themeColors.textTertiary }]}>
              {profile?.ageBracket
                ? t(`demographics.age.${profile.ageBracket.replace('-', '_').replace('+', '_plus')}`, profile.ageBracket)
                : t('demographics.selectAge')}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </HapticTouchable>
        </View>

        {/* Gender */}
        <View
          style={styles.fieldContainer}
          onLayout={(e) => { fieldPositions.current.gender = e.nativeEvent.layout.y; }}
        >
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('demographics.genderLabel')}</Text>
          <HapticTouchable hapticDisabled
            style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }, isGenderEmpty && styles.pickerRowError]}
            onPress={() => setActivePicker('gender')}
            accessibilityRole="button"
            accessibilityLabel={t('demographics.genderLabel')}
          >
            <Text style={[styles.pickerValue, { color: themeColors.textPrimary }, profile?.gender && { color: accentColor.primary }, !profile?.gender && { color: themeColors.textTertiary }]}>
              {profile?.gender
                ? t(`demographics.gender.${profile.gender}`)
                : t('demographics.selectGender')}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </HapticTouchable>
        </View>

        {missingDemographics && (
          <View style={[styles.warningBox, { backgroundColor: themeColors.warning + '20' }]}>
            <Text style={[styles.warningText, { color: themeColors.warning }]}>
              ⚠️ {t('demographics.required')}
            </Text>
          </View>
        )}
      </View>

      {/* Personal data section (shareable with contacts via consent) */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('profile.personal.title')}</Text>
        <Text style={[styles.sectionSubtitle, { color: themeColors.textTertiary }]}>{t('profile.personal.subtitle')}</Text>

        {/* Email */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('profile.personal.emailLabel')}</Text>
          <TextInput
            style={[styles.personalInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
            value={personalEmail}
            onChangeText={setPersonalEmail}
            onBlur={() => handlePersonalFieldBlur('email', personalEmail)}
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
            style={[styles.personalInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
            value={personalMobile}
            onChangeText={setPersonalMobile}
            onBlur={() => handlePersonalFieldBlur('mobileNumber', personalMobile)}
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
            style={[styles.personalInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
            value={personalLandline}
            onChangeText={setPersonalLandline}
            onBlur={() => handlePersonalFieldBlur('landlineNumber', personalLandline)}
            placeholder={t('profile.personal.landlinePlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            keyboardType="phone-pad"
            returnKeyType="done"
            accessibilityLabel={t('profile.personal.landlineLabel')}
          />
        </View>

        {/* Address sub-section */}
        <Text style={[styles.fieldLabel, { color: themeColors.textPrimary, marginTop: spacing.sm }]}>{t('profile.personal.addressTitle')}</Text>

        {/* Street */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('profile.personal.streetLabel')}</Text>
          <TextInput
            style={[styles.personalInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
            value={personalStreet}
            onChangeText={setPersonalStreet}
            onBlur={() => handlePersonalFieldBlur('addressStreet', personalStreet)}
            placeholder={t('profile.personal.streetPlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            returnKeyType="done"
            accessibilityLabel={t('profile.personal.streetLabel')}
          />
        </View>

        {/* Postal code + City row */}
        <View style={styles.personalRowFields}>
          <View style={[styles.fieldContainer, { flex: 1, marginRight: spacing.sm }]}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('profile.personal.postalCodeLabel')}</Text>
            <TextInput
              style={[styles.personalInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
              value={personalPostalCode}
              onChangeText={setPersonalPostalCode}
              onBlur={() => handlePersonalFieldBlur('addressPostalCode', personalPostalCode)}
              placeholder={t('profile.personal.postalCodePlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              returnKeyType="done"
              accessibilityLabel={t('profile.personal.postalCodeLabel')}
            />
          </View>
          <View style={[styles.fieldContainer, { flex: 2 }]}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('profile.personal.cityLabel')}</Text>
            <TextInput
              style={[styles.personalInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
              value={personalCity}
              onChangeText={setPersonalCity}
              onBlur={() => handlePersonalFieldBlur('addressCity', personalCity)}
              placeholder={t('profile.personal.cityPlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              returnKeyType="done"
              accessibilityLabel={t('profile.personal.cityLabel')}
            />
          </View>
        </View>

        {/* Country */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('profile.personal.countryLabel')}</Text>
          <TextInput
            style={[styles.personalInput, { borderColor: themeColors.border, color: themeColors.textPrimary, backgroundColor: themeColors.surface }]}
            value={personalCountry}
            onChangeText={setPersonalCountry}
            onBlur={() => handlePersonalFieldBlur('addressCountry', personalCountry)}
            placeholder={t('profile.personal.countryPlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            returnKeyType="done"
            accessibilityLabel={t('profile.personal.countryLabel')}
          />
        </View>

        {/* Important dates sub-section */}
        <Text style={[styles.fieldLabel, { color: themeColors.textPrimary, marginTop: spacing.sm }]}>{t('profile.personal.datesTitle')}</Text>

        {/* Birth date */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('profile.personal.birthDateLabel')}</Text>
          <View style={styles.dateFieldRow}>
            <HapticTouchable hapticDisabled
              style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border, flex: 1 }]}
              onPress={() => { void triggerFeedback('tap'); setActiveDatePicker('birth'); }}
              accessibilityRole="button"
              accessibilityLabel={t('profile.personal.birthDateLabel')}
            >
              <Text style={[styles.pickerValue, birthDate ? { color: accentColor.primary } : { color: themeColors.textTertiary }]}>
                {birthDate ? formatDate(birthDate) : t('profile.personal.selectDate')}
              </Text>
              <Text style={styles.editIcon}>📅</Text>
            </HapticTouchable>
            {birthDate && (
              <HapticTouchable hapticDisabled
                style={styles.clearDateButton}
                onPress={() => handleClearDate('birth')}
                accessibilityRole="button"
                accessibilityLabel={t('profile.personal.clearDate')}
              >
                <Text style={[styles.clearDateText, { color: themeColors.textSecondary }]}>✕</Text>
              </HapticTouchable>
            )}
          </View>
        </View>

        {/* Wedding date */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('profile.personal.weddingDateLabel')}</Text>
          <View style={styles.dateFieldRow}>
            <HapticTouchable hapticDisabled
              style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border, flex: 1 }]}
              onPress={() => { void triggerFeedback('tap'); setActiveDatePicker('wedding'); }}
              accessibilityRole="button"
              accessibilityLabel={t('profile.personal.weddingDateLabel')}
            >
              <Text style={[styles.pickerValue, weddingDate ? { color: accentColor.primary } : { color: themeColors.textTertiary }]}>
                {weddingDate ? formatDate(weddingDate) : t('profile.personal.selectDate')}
              </Text>
              <Text style={styles.editIcon}>📅</Text>
            </HapticTouchable>
            {weddingDate && (
              <HapticTouchable hapticDisabled
                style={styles.clearDateButton}
                onPress={() => handleClearDate('wedding')}
                accessibilityRole="button"
                accessibilityLabel={t('profile.personal.clearDate')}
              >
                <Text style={[styles.clearDateText, { color: themeColors.textSecondary }]}>✕</Text>
              </HapticTouchable>
            )}
          </View>
        </View>
      </View>

      {/* Date picker modals */}
      {activeDatePicker && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setActiveDatePicker(null)}
        >
          <View style={styles.datePickerOverlay}>
            <View style={[styles.datePickerContainer, { backgroundColor: themeColors.surface }]}>
              <View style={[styles.datePickerHeader, { borderBottomColor: themeColors.border }]}>
                <Text style={[styles.datePickerTitle, { color: themeColors.textPrimary }]}>
                  {activeDatePicker === 'birth'
                    ? t('profile.personal.birthDateLabel')
                    : t('profile.personal.weddingDateLabel')}
                </Text>
                <HapticTouchable
                  style={[styles.datePickerDoneButton, { backgroundColor: accentColor.primary }]}
                  onPress={() => setActiveDatePicker(null)}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.done')}
                >
                  <Text style={[styles.datePickerDoneText, { color: themeColors.textOnPrimary }]}>
                    {t('common.done')}
                  </Text>
                </HapticTouchable>
              </View>
              <DateTimePicker
                value={
                  activeDatePicker === 'birth' && birthDate
                    ? new Date(birthDate + 'T00:00:00')
                    : activeDatePicker === 'wedding' && weddingDate
                      ? new Date(weddingDate + 'T00:00:00')
                      : new Date()
                }
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => handleDateChange(activeDatePicker, event, date)}
                maximumDate={new Date()}
                locale={i18n.language}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* ── Gedeeld met (Shared with) ─────────────────────────── */}
      {sharedWithContacts.length > 0 && (
        <View style={styles.section}>
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
        selectedValue={profile?.countryCode}
        onSelect={handleCountrySelect}
        onClose={closePicker}
      />

      <PickerModal
        visible={activePicker === 'region'}
        title={t('demographics.selectRegion')}
        options={regionOptions}
        selectedValue={profile?.regionCode}
        onSelect={handleRegionSelect}
        onClose={closePicker}
      />

      <PickerModal
        visible={activePicker === 'age'}
        title={t('demographics.selectAge')}
        options={ageOptions}
        selectedValue={profile?.ageBracket}
        onSelect={handleAgeSelect}
        onClose={closePicker}
      />

      <PickerModal
        visible={activePicker === 'gender'}
        title={t('demographics.selectGender')}
        options={genderOptions}
        selectedValue={profile?.gender}
        onSelect={handleGenderSelect}
        onClose={closePicker}
      />

      {/* CitySearchInline is now rendered inline below the city field — no modal needed */}
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
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: touchTargets.comfortable,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldValue: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  fieldHint: {
    ...typography.small,
    color: colors.textTertiary,
    marginTop: spacing.xs,
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
  editNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameInput: {
    ...typography.body,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  saveButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
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
  warningBox: {
    backgroundColor: colors.warning + '20',
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  warningText: {
    ...typography.small,
    color: colors.warning,
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
  // Error styles for empty required fields
  fieldRowError: {
    backgroundColor: colors.errorBackground,
    borderColor: colors.errorBorder,
  },
  pickerRowError: {
    backgroundColor: colors.errorBackground,
    borderColor: colors.errorBorder,
  },
  inputError: {
    backgroundColor: colors.errorBackground,
    borderColor: colors.errorBorder,
  },
  // Personal data section styles
  personalInput: {
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
  personalRowFields: {
    flexDirection: 'row',
  },
  dateFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearDateButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  clearDateText: {
    fontSize: 20,
    fontWeight: '600',
  },
  // Date picker modal styles
  datePickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  datePickerContainer: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingBottom: spacing.xl,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  datePickerTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  datePickerDoneButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  datePickerDoneText: {
    ...typography.body,
    fontWeight: '600',
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
});
