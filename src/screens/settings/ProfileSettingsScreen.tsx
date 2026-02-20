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
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  TextInputFocusEventData,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useIsFocused } from '@react-navigation/native';

import { colors, typography, spacing, borderRadius, touchTargets } from '@/theme';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { ContactAvatar, VoiceFocusable } from '@/components';
import { useVoiceFocusList, useVoiceFocusContext } from '@/contexts/VoiceFocusContext';
import {
  pickImageFromCamera,
  pickImageFromGallery,
  saveAvatar,
  getAvatarPath,
} from '@/services/imageService';
import type { UserProfile, AgeBracket, SupportedLanguage, Gender } from '@/services/interfaces';

// Supported languages (matches SupportedLanguage type from interfaces)
const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['nl', 'en', 'de', 'fr', 'es', 'it', 'pl', 'no', 'sv', 'da'];

// Country and region data with flag emojis
const COUNTRIES = ['NL', 'BE', 'LU', 'DE', 'AT', 'CH', 'FR', 'ES', 'GB', 'IE', 'US'] as const;

// Flag emojis for countries
const COUNTRY_FLAGS: Record<string, string> = {
  NL: '🇳🇱',
  BE: '🇧🇪',
  LU: '🇱🇺',
  DE: '🇩🇪',
  AT: '🇦🇹',
  CH: '🇨🇭',
  FR: '🇫🇷',
  ES: '🇪🇸',
  GB: '🇬🇧',
  IE: '🇮🇪',
  US: '🇺🇸',
};

// Flag emojis for languages
const LANGUAGE_FLAGS: Record<string, string> = {
  nl: '🇳🇱',
  en: '🇬🇧',
  de: '🇩🇪',
  fr: '🇫🇷',
  es: '🇪🇸',
  it: '🇮🇹',
  pl: '🇵🇱',
  no: '🇳🇴',
  sv: '🇸🇪',
  da: '🇩🇰',
};

const REGIONS_BY_COUNTRY: Record<string, string[]> = {
  NL: ['NL-DR', 'NL-FL', 'NL-FR', 'NL-GE', 'NL-GR', 'NL-LI', 'NL-NB', 'NL-NH', 'NL-OV', 'NL-UT', 'NL-ZE', 'NL-ZH'],
  BE: ['BE-VLG', 'BE-WAL', 'BE-BRU'],
  DE: ['DE-BW', 'DE-BY', 'DE-BE', 'DE-BB', 'DE-HB', 'DE-HH', 'DE-HE', 'DE-MV', 'DE-NI', 'DE-NW', 'DE-RP', 'DE-SL', 'DE-SN', 'DE-ST', 'DE-SH', 'DE-TH'],
  AT: ['AT-1', 'AT-2', 'AT-3', 'AT-4', 'AT-5', 'AT-6', 'AT-7', 'AT-8', 'AT-9'],
  CH: ['CH-ZH', 'CH-BE', 'CH-LU', 'CH-UR', 'CH-SZ', 'CH-OW', 'CH-NW', 'CH-GL', 'CH-ZG', 'CH-FR', 'CH-SO', 'CH-BS', 'CH-BL', 'CH-SH', 'CH-AR', 'CH-AI', 'CH-SG', 'CH-GR', 'CH-AG', 'CH-TG', 'CH-TI', 'CH-VD', 'CH-VS', 'CH-NE', 'CH-GE', 'CH-JU'],
  FR: ['FR-IDF', 'FR-CVL', 'FR-BFC', 'FR-NOR', 'FR-HDF', 'FR-GES', 'FR-PDL', 'FR-BRE', 'FR-NAQ', 'FR-OCC', 'FR-ARA', 'FR-PAC', 'FR-COR'],
  ES: ['ES-AN', 'ES-AR', 'ES-AS', 'ES-CN', 'ES-CB', 'ES-CL', 'ES-CM', 'ES-CT', 'ES-EX', 'ES-GA', 'ES-IB', 'ES-RI', 'ES-MD', 'ES-MC', 'ES-NC', 'ES-PV', 'ES-VC'],
  GB: ['GB-ENG', 'GB-SCT', 'GB-WLS', 'GB-NIR'],
  IE: ['IE-L', 'IE-M', 'IE-C', 'IE-U'],
  US: ['US-CA', 'US-TX', 'US-FL', 'US-NY', 'US-PA', 'US-IL', 'US-OH', 'US-GA', 'US-NC', 'US-MI'],
  LU: ['LU'],
};

// Extended age brackets up to 110 years (in 5-year intervals)
const AGE_BRACKETS: AgeBracket[] = [
  '18-24', '25-34', '35-44', '45-54', '55-64',
  '65-69', '70-74', '75-79', '80-84', '85-89',
  '90-94', '95-99', '100-104', '105-110'
];

// Gender options
const GENDERS: Gender[] = ['male', 'female', 'other'];

interface PickerModalProps {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

function PickerModal({ visible, title, options, selectedValue, onSelect, onClose }: PickerModalProps) {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={pickerStyles.container}>
        <View style={pickerStyles.header}>
          <Text style={pickerStyles.title}>{title}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={pickerStyles.closeButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={pickerStyles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={pickerStyles.optionsList}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                pickerStyles.option,
                selectedValue === option.value && { backgroundColor: accentColor.primaryLight + '20' },
              ]}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: selectedValue === option.value }}
            >
              <Text
                style={[
                  pickerStyles.optionText,
                  selectedValue === option.value && { color: accentColor.primary, fontWeight: '600' },
                ]}
              >
                {option.label}
              </Text>
              {selectedValue === option.value && (
                <Text style={[pickerStyles.checkmark, { color: accentColor.primary }]}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  optionsList: {
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionSelected: {
    backgroundColor: colors.primaryLight,
  },
  optionText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  checkmark: {
    ...typography.h3,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
});

// Field identifiers for validation and scrolling
type FieldId = 'name' | 'country' | 'region' | 'city' | 'age' | 'gender';

export function ProfileSettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { accentColor } = useAccentColor();
  const { triggerFeedback } = useFeedback();
  const screenIsFocused = useIsFocused();
  const { isVoiceSessionActive } = useVoiceFocusContext();
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

  // City input ref for keyboard handling
  const cityInputRef = useRef<TextInput>(null);

  // Ref for demographics section to calculate absolute positions
  const demographicsSectionRef = useRef<View>(null);
  const demographicsSectionY = useRef<number>(0);

  // Refs to track latest values for beforeRemove (avoids stale closures)
  const cityInputRef2 = useRef(cityInput);
  const profileRef = useRef(profile);
  cityInputRef2.current = cityInput;
  profileRef.current = profile;

  // Picker modals
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [regionPickerVisible, setRegionPickerVisible] = useState(false);
  const [agePickerVisible, setAgePickerVisible] = useState(false);
  const [genderPickerVisible, setGenderPickerVisible] = useState(false);

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
        setCountryPickerVisible(true);
        break;
      case 'region':
        setRegionPickerVisible(true);
        break;
      case 'city':
        // City is a text input, focus it
        cityInputRef.current?.focus();
        break;
      case 'age':
        setAgePickerVisible(true);
        break;
      case 'gender':
        setGenderPickerVisible(true);
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

          if (loadedProfile.photoPath) {
            setPhotoUrl(`file://${loadedProfile.photoPath}`);
          } else {
            const savedPath = await getAvatarPath('my_profile');
            if (savedPath) {
              setPhotoUrl(`file://${savedPath}`);
            }
          }
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
        Alert.alert(
          t('validation.profileIncomplete'),
          t('validation.profileIncompleteMessage'),
          [
            {
              text: t('validation.stayOnPage'),
              onPress: () => {
                // Scroll to the first missing field and open its picker
                scrollToField(firstMissing);
                // Small delay before opening picker to allow scroll to complete
                setTimeout(() => {
                  openPickerForField(firstMissing);
                }, 300);
              },
            },
          ]
        );
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
      return true;
    } catch (error) {
      console.error('Failed to save profile:', error);
      Alert.alert(t('errors.genericError'));
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
                Alert.alert(t('profile.photoSaved'));
              }
            } catch (error) {
              console.error('Failed to save photo:', error);
              Alert.alert(t('errors.genericError'));
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
                Alert.alert(t('profile.photoSaved'));
              }
            } catch (error) {
              console.error('Failed to save photo:', error);
              Alert.alert(t('errors.genericError'));
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
      Alert.alert(t('errors.genericError'), t('onboarding.nameMinLength'));
      return;
    }
    setDisplayName(trimmedName);
    setEditingName(false);
    await saveProfile({ name: trimmedName });
  }, [tempName, saveProfile, t, triggerFeedback]);

  const handleCountrySelect = useCallback(async (countryCode: string) => {
    void triggerFeedback('tap');
    // When country changes, clear region
    await saveProfile({ countryCode, regionCode: undefined });
  }, [saveProfile, triggerFeedback]);

  const handleRegionSelect = useCallback(async (regionCode: string) => {
    void triggerFeedback('tap');
    await saveProfile({ regionCode });
  }, [saveProfile, triggerFeedback]);

  // City is handled with local state to avoid saving on every keystroke
  const handleCityChange = useCallback((newCity: string) => {
    setCityInput(newCity);
  }, []);

  // Save city when input loses focus
  const handleCityBlur = useCallback(async () => {
    const trimmedCity = cityInput.trim();
    const currentProfile = profileRef.current;
    if (trimmedCity !== (currentProfile?.city || '')) {
      const success = await saveProfile({ city: trimmedCity });
      if (success) {
        // Update ref so beforeRemove knows city is already saved
        cityInputRef2.current = trimmedCity;
      }
    }
  }, [cityInput, saveProfile]);

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
        onSelect: () => setLanguagePickerVisible(true),
      },
      {
        id: 'country',
        label: t('demographics.countryLabel'),
        index: index++,
        onSelect: () => setCountryPickerVisible(true),
      },
    ];

    // Add region if country is selected
    if (profile?.countryCode && REGIONS_BY_COUNTRY[profile.countryCode]) {
      items.push({
        id: 'region',
        label: t('demographics.regionLabel'),
        index: index++,
        onSelect: () => setRegionPickerVisible(true),
      });
    }

    items.push(
      {
        id: 'city',
        label: t('demographics.cityLabel'),
        index: index++,
        onSelect: () => cityInputRef.current?.focus(),
      },
      {
        id: 'age',
        label: t('demographics.ageLabel'),
        index: index++,
        onSelect: () => setAgePickerVisible(true),
      },
      {
        id: 'gender',
        label: t('demographics.genderLabel'),
        index: index++,
        onSelect: () => setGenderPickerVisible(true),
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
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
      style={styles.keyboardAvoidingContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        ref={(ref) => {
          // Combine both refs for scroll functionality
          scrollViewRef.current = ref;
          if (voiceScrollRef) {
            (voiceScrollRef as React.MutableRefObject<ScrollView | null>).current = ref;
          }
        }}
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
      {/* Profile photo section */}
      <View style={styles.profileSection}>
        <TouchableOpacity
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
            <View style={styles.cameraIconContainer}>
              {savingPhoto ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.cameraIcon}>📷</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Name section */}
      <View
        style={styles.section}
        onLayout={(e) => { fieldPositions.current.name = e.nativeEvent.layout.y; }}
      >
        <Text style={styles.sectionTitle}>{t('onboarding.nameLabel')}</Text>
        {editingName ? (
          <View style={styles.editNameContainer}>
            <TextInput
              style={[styles.nameInput, isNameEmpty && styles.inputError]}
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
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveName}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={saving ? t('common.saving') : t('common.done')}
              accessibilityState={{ disabled: saving }}
            >
              <Text style={styles.saveButtonText}>
                {saving ? t('common.saving') : t('common.done')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.fieldRow, isNameEmpty && styles.fieldRowError]}
            onPress={handleEditName}
            accessibilityRole="button"
            accessibilityHint={t('profile.tapToChange')}
          >
            <Text style={[styles.fieldValue, { color: accentColor.primary }]}>{displayName}</Text>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Language section - changes UI immediately */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        <TouchableOpacity
          style={styles.fieldRow}
          onPress={() => setLanguagePickerVisible(true)}
          accessibilityRole="button"
          accessibilityHint={t('profile.tapToChange')}
        >
          <Text style={[styles.fieldValue, { color: accentColor.primary }]}>
            {t(`profile.language.${i18n.language as SupportedLanguage}`)}
          </Text>
          <Text style={styles.editIcon}>✏️</Text>
        </TouchableOpacity>
        <Text style={styles.fieldHint}>{t('profile.languageHint')}</Text>
      </View>

      {/* Phone number (read-only) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('onboarding.phoneLabel')}</Text>
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldValue, { color: accentColor.primary }]}>{profile?.phoneNumber || '—'}</Text>
          <Text style={styles.readOnlyIcon}>🔒</Text>
        </View>
        <Text style={styles.fieldHint}>{t('profile.phoneReadOnly')}</Text>
      </View>

      {/* Demographics section */}
      <View
        ref={demographicsSectionRef}
        style={styles.section}
        onLayout={(e) => { demographicsSectionY.current = e.nativeEvent.layout.y; }}
      >
        <Text style={styles.sectionTitle}>{t('demographics.title')}</Text>
        {isFreeUser && (
          <Text style={styles.sectionSubtitle}>{t('demographics.required')}</Text>
        )}
        {!isFreeUser && (
          <Text style={styles.sectionSubtitle}>{t('demographics.premiumNote')}</Text>
        )}

        {/* Country */}
        <View
          style={styles.fieldContainer}
          onLayout={(e) => { fieldPositions.current.country = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.fieldLabel}>{t('demographics.countryLabel')}</Text>
          <TouchableOpacity
            style={[styles.pickerRow, isCountryEmpty && styles.pickerRowError]}
            onPress={() => setCountryPickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('demographics.countryLabel')}
          >
            <Text style={[styles.pickerValue, profile?.countryCode && { color: accentColor.primary }, !profile?.countryCode && styles.pickerPlaceholder]}>
              {profile?.countryCode
                ? `${COUNTRY_FLAGS[profile.countryCode]} ${t(`demographics.countries.${profile.countryCode}`, profile.countryCode)}`
                : t('demographics.selectCountry')}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
        </View>

        {/* Region (only if country selected) */}
        {profile?.countryCode && REGIONS_BY_COUNTRY[profile.countryCode] && (
          <View
            style={styles.fieldContainer}
            onLayout={(e) => { fieldPositions.current.region = e.nativeEvent.layout.y; }}
          >
            <Text style={styles.fieldLabel}>{t('demographics.regionLabel')}</Text>
            <TouchableOpacity
              style={[styles.pickerRow, isRegionEmpty && styles.pickerRowError]}
              onPress={() => setRegionPickerVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t('demographics.regionLabel')}
            >
              <Text style={[styles.pickerValue, profile?.regionCode && { color: accentColor.primary }, !profile?.regionCode && styles.pickerPlaceholder]}>
                {profile?.regionCode
                  ? t(`demographics.regions.${profile.regionCode}`, profile.regionCode)
                  : t('demographics.selectRegion')}
              </Text>
              <Text style={styles.editIcon}>✏️</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* City input */}
        <View
          style={styles.fieldContainer}
          onLayout={(e) => { fieldPositions.current.city = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.fieldLabel}>{t('demographics.cityLabel')}</Text>
          <TextInput
            ref={cityInputRef}
            style={[styles.textInput, isCityEmpty && styles.inputError, { color: accentColor.primary }]}
            value={cityInput}
            onChangeText={handleCityChange}
            onBlur={handleCityBlur}
            onFocus={(e) => handleInputFocus(e, 'city')}
            placeholder={t('demographics.enterCity')}
            placeholderTextColor={colors.textTertiary}
            maxLength={100}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel={t('demographics.cityLabel')}
            accessibilityHint={t('demographics.enterCity')}
          />
        </View>

        {/* Age bracket */}
        <View
          style={styles.fieldContainer}
          onLayout={(e) => { fieldPositions.current.age = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.fieldLabel}>{t('demographics.ageLabel')}</Text>
          <TouchableOpacity
            style={[styles.pickerRow, isAgeEmpty && styles.pickerRowError]}
            onPress={() => setAgePickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('demographics.ageLabel')}
          >
            <Text style={[styles.pickerValue, profile?.ageBracket && { color: accentColor.primary }, !profile?.ageBracket && styles.pickerPlaceholder]}>
              {profile?.ageBracket
                ? t(`demographics.age.${profile.ageBracket.replace('-', '_').replace('+', '_plus')}`, profile.ageBracket)
                : t('demographics.selectAge')}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
        </View>

        {/* Gender */}
        <View
          style={styles.fieldContainer}
          onLayout={(e) => { fieldPositions.current.gender = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.fieldLabel}>{t('demographics.genderLabel')}</Text>
          <TouchableOpacity
            style={[styles.pickerRow, isGenderEmpty && styles.pickerRowError]}
            onPress={() => setGenderPickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('demographics.genderLabel')}
          >
            <Text style={[styles.pickerValue, profile?.gender && { color: accentColor.primary }, !profile?.gender && styles.pickerPlaceholder]}>
              {profile?.gender
                ? t(`demographics.gender.${profile.gender}`)
                : t('demographics.selectGender')}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
        </View>

        {missingDemographics && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ {t('demographics.required')}
            </Text>
          </View>
        )}
      </View>

      {/* Dev mode: Show UUID */}
      {__DEV__ && profile?.userUuid && (
        <View style={styles.devSection}>
          <Text style={styles.devTitle}>🔧 Dev Info</Text>
          <Text style={styles.devLabel}>UUID (stable):</Text>
          <Text style={styles.devValue} selectable>{profile.userUuid}</Text>
          <Text style={styles.devLabel}>JID:</Text>
          <Text style={styles.devValue} selectable>{profile.jid}</Text>
          <Text style={styles.devLabel}>Subscription:</Text>
          <Text style={styles.devValue}>{profile.subscriptionTier}</Text>
        </View>
      )}

      {/* Picker modals */}
      <PickerModal
        visible={languagePickerVisible}
        title={t('profile.selectLanguage')}
        options={languageOptions}
        selectedValue={i18n.language}
        onSelect={handleLanguageSelect}
        onClose={() => setLanguagePickerVisible(false)}
      />

      <PickerModal
        visible={countryPickerVisible}
        title={t('demographics.selectCountry')}
        options={countryOptions}
        selectedValue={profile?.countryCode}
        onSelect={handleCountrySelect}
        onClose={() => setCountryPickerVisible(false)}
      />

      <PickerModal
        visible={regionPickerVisible}
        title={t('demographics.selectRegion')}
        options={regionOptions}
        selectedValue={profile?.regionCode}
        onSelect={handleRegionSelect}
        onClose={() => setRegionPickerVisible(false)}
      />

      <PickerModal
        visible={agePickerVisible}
        title={t('demographics.selectAge')}
        options={ageOptions}
        selectedValue={profile?.ageBracket}
        onSelect={handleAgeSelect}
        onClose={() => setAgePickerVisible(false)}
      />

      <PickerModal
        visible={genderPickerVisible}
        title={t('demographics.selectGender')}
        options={genderOptions}
        selectedValue={profile?.gender}
        onSelect={handleGenderSelect}
        onClose={() => setGenderPickerVisible(false)}
      />
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
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
  textInput: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    minHeight: touchTargets.comfortable,
  },
  pickerValue: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  pickerPlaceholder: {
    color: colors.textTertiary,
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
});
