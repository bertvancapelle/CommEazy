/**
 * Demographics Screen (Onboarding)
 *
 * Collects required demographic data for free users:
 * - Country of origin
 * - Region/Province
 * - City (via weather API geocoding)
 * - Age bracket
 *
 * This data is required for ad targeting (free tier).
 * Premium users can skip or fill in later.
 *
 * Senior-inclusive design:
 * - Large touch targets (60pt+)
 * - Clear labels with bold formatting
 * - Simple picker modals
 * - Flag emojis for country recognition
 * - City search with metadata for disambiguation
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { weatherService } from '@/services/weatherService';
import type { WeatherLocation } from '@/types/weather';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, typography, spacing, borderRadius, touchTargets } from '@/theme';
import { Button, ProgressIndicator } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import type { OnboardingStackParams } from '@/navigation';
import type { AgeBracket } from '@/services/interfaces';

type Props = NativeStackScreenProps<OnboardingStackParams, 'Demographics'>;

// Country and region data with flag emojis
const COUNTRIES = ['NL', 'BE', 'LU', 'DE', 'AT', 'CH', 'FR', 'ES', 'GB', 'IE', 'US'] as const;

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

const AGE_BRACKETS: AgeBracket[] = [
  '18-24', '25-34', '35-44', '45-54', '55-64',
  '65-69', '70-74', '75-79', '80-84', '85-89',
  '90-94', '95-99', '100-104', '105-110'
];

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
                selectedValue === option.value && pickerStyles.optionSelected,
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
                  selectedValue === option.value && pickerStyles.optionTextSelected,
                ]}
              >
                {option.label}
              </Text>
              {selectedValue === option.value && (
                <Text style={pickerStyles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// Helper function to format city display with disambiguation metadata
function formatCityDisplay(location: WeatherLocation): string {
  const parts = [location.name];

  // Add admin1 (state/province) if different from city name
  if (location.admin1 && location.admin1 !== location.name) {
    parts.push(location.admin1);
  }

  // Add country
  if (location.country) {
    parts.push(location.country);
  }

  return parts.join(', ');
}

// City Picker Modal with search functionality
interface CityPickerModalProps {
  visible: boolean;
  onSelect: (location: WeatherLocation) => void;
  onClose: () => void;
  language: string;
  countryCode?: string; // ISO 3166-1 alpha-2 country code to filter results
}

function CityPickerModal({ visible, onSelect, onClose, language, countryCode }: CityPickerModalProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WeatherLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setSearchError(null);

    // Debounce search by 500ms
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await weatherService.searchLocations(searchQuery, language, countryCode);
        setSearchResults(results);
        if (results.length === 0) {
          setSearchError(t('demographics.noCitiesFound'));
        }
      } catch (error) {
        console.error('[DemographicsScreen] City search failed:', error);
        setSearchError(t('demographics.citySearchError'));
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, language, countryCode, t]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSearchResults([]);
      setSearchError(null);
    }
  }, [visible]);

  const handleSelectCity = (location: WeatherLocation) => {
    onSelect(location);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={cityPickerStyles.container}>
        <View style={cityPickerStyles.header}>
          <Text style={cityPickerStyles.title}>{t('demographics.selectCity')}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={cityPickerStyles.closeButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={cityPickerStyles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Search input */}
        <View style={cityPickerStyles.searchContainer}>
          <TextInput
            style={cityPickerStyles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('demographics.citySearchPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus={true}
            accessibilityLabel={t('demographics.citySearchPlaceholder')}
          />
          {isSearching && (
            <ActivityIndicator
              style={cityPickerStyles.searchSpinner}
              size="small"
              color={colors.primary}
            />
          )}
        </View>

        {/* Search hint */}
        {searchQuery.length === 0 && (
          <View style={cityPickerStyles.hintContainer}>
            <Text style={cityPickerStyles.hintText}>
              {t('demographics.citySearchHint')}
            </Text>
          </View>
        )}

        {/* Search error */}
        {searchError && !isSearching && (
          <View style={cityPickerStyles.errorContainer}>
            <Text style={cityPickerStyles.errorText}>{searchError}</Text>
          </View>
        )}

        {/* Search results */}
        <ScrollView style={cityPickerStyles.resultsList}>
          {searchResults.map((location) => (
            <TouchableOpacity
              key={location.id}
              style={cityPickerStyles.resultItem}
              onPress={() => handleSelectCity(location)}
              accessibilityRole="button"
              accessibilityLabel={formatCityDisplay(location)}
            >
              <View style={cityPickerStyles.resultContent}>
                <Text style={cityPickerStyles.cityName}>{location.name}</Text>
                <Text style={cityPickerStyles.cityMeta}>
                  {[location.admin1, location.country].filter(Boolean).join(', ')}
                </Text>
              </View>
              <Text style={cityPickerStyles.selectIcon}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const cityPickerStyles = StyleSheet.create({
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
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
  searchSpinner: {
    marginLeft: spacing.sm,
  },
  hintContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  hintText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultContent: {
    flex: 1,
  },
  cityName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  cityMeta: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  selectIcon: {
    ...typography.h2,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
  },
});

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

export function DemographicsScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { triggerFeedback } = useFeedback();
  const { name } = route.params;

  const [countryCode, setCountryCode] = useState<string | undefined>();
  const [regionCode, setRegionCode] = useState<string | undefined>();
  const [selectedCity, setSelectedCity] = useState<WeatherLocation | undefined>();
  const [ageBracket, setAgeBracket] = useState<AgeBracket | undefined>();

  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [regionPickerVisible, setRegionPickerVisible] = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [agePickerVisible, setAgePickerVisible] = useState(false);

  const handleCountrySelect = useCallback((code: string) => {
    void triggerFeedback('tap');
    setCountryCode(code);
    // Clear region when country changes
    setRegionCode(undefined);
  }, [triggerFeedback]);

  const handleContinue = useCallback(async () => {
    void triggerFeedback('tap');
    // Validate all fields are filled
    if (!countryCode) {
      Alert.alert(t('demographics.required'), t('demographics.selectCountry'));
      return;
    }

    // Check if country has regions and region is required
    const hasRegions = countryCode && REGIONS_BY_COUNTRY[countryCode] && REGIONS_BY_COUNTRY[countryCode].length > 1;
    if (hasRegions && !regionCode) {
      Alert.alert(t('demographics.required'), t('demographics.selectRegion'));
      return;
    }

    if (!selectedCity) {
      Alert.alert(t('demographics.required'), t('demographics.selectCity'));
      return;
    }

    if (!ageBracket) {
      Alert.alert(t('demographics.required'), t('demographics.selectAge'));
      return;
    }

    // Save demographics to profile
    try {
      const { ServiceContainer } = await import('@/services/container');
      const profile = await ServiceContainer.database.getUserProfile();

      if (profile) {
        await ServiceContainer.database.saveUserProfile({
          ...profile,
          countryCode,
          regionCode: regionCode || countryCode, // Use country code for countries without regions (LU)
          city: selectedCity.name,
          // Store city coordinates for weather module integration
          cityLatitude: selectedCity.latitude,
          cityLongitude: selectedCity.longitude,
          ageBracket,
        });
      }

      // Navigate to navigation tutorial
      navigation.navigate('NavigationTutorial', { name });
    } catch (error) {
      console.error('Failed to save demographics:', error);
      Alert.alert(t('errors.genericError'));
    }
  }, [countryCode, regionCode, selectedCity, ageBracket, name, navigation, t, triggerFeedback]);

  // Build picker options
  const countryOptions = COUNTRIES.map(code => ({
    value: code,
    label: `${COUNTRY_FLAGS[code]} ${t(`demographics.countries.${code}`, code)}`,
  }));

  const regionOptions = countryCode && REGIONS_BY_COUNTRY[countryCode]
    ? REGIONS_BY_COUNTRY[countryCode].map(code => ({
        value: code,
        label: t(`demographics.regions.${code}`, code),
      }))
    : [];

  const ageOptions = AGE_BRACKETS.map(bracket => ({
    value: bracket,
    label: t(`demographics.age.${bracket.replace('-', '_').replace('+', '_plus')}`, bracket),
  }));

  // Check if all required fields are filled
  const hasRegions = countryCode && REGIONS_BY_COUNTRY[countryCode] && REGIONS_BY_COUNTRY[countryCode].length > 1;
  const isComplete = countryCode && (!hasRegions || regionCode) && selectedCity && ageBracket;

  return (
    <SafeAreaView style={styles.container}>
      <ProgressIndicator currentStep={5} totalSteps={6} />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>{t('demographics.title')}</Text>
        <Text style={styles.subtitle}>{t('demographics.subtitle')}</Text>
        <Text style={styles.required}>{t('demographics.required')}</Text>

        {/* Country picker */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>{t('demographics.countryLabel')}</Text>
          <TouchableOpacity
            style={styles.pickerRow}
            onPress={() => setCountryPickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('demographics.countryLabel')}
          >
            <Text style={[styles.pickerValue, !countryCode && styles.pickerPlaceholder]}>
              {countryCode
                ? `${COUNTRY_FLAGS[countryCode]} ${t(`demographics.countries.${countryCode}`, countryCode)}`
                : t('demographics.selectCountry')}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
        </View>

        {/* Region picker (only if country has regions) */}
        {countryCode && hasRegions && (
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{t('demographics.regionLabel')}</Text>
            <TouchableOpacity
              style={styles.pickerRow}
              onPress={() => setRegionPickerVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t('demographics.regionLabel')}
            >
              <Text style={[styles.pickerValue, !regionCode && styles.pickerPlaceholder]}>
                {regionCode
                  ? t(`demographics.regions.${regionCode}`, regionCode)
                  : t('demographics.selectRegion')}
              </Text>
              <Text style={styles.editIcon}>✏️</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* City picker (via weather API geocoding) */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>{t('demographics.cityLabel')}</Text>
          <TouchableOpacity
            style={styles.pickerRow}
            onPress={() => setCityPickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('demographics.cityLabel')}
          >
            <Text style={[styles.pickerValue, !selectedCity && styles.pickerPlaceholder]}>
              {selectedCity
                ? formatCityDisplay(selectedCity)
                : t('demographics.selectCity')}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
        </View>

        {/* Age bracket picker */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>{t('demographics.ageLabel')}</Text>
          <TouchableOpacity
            style={styles.pickerRow}
            onPress={() => setAgePickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('demographics.ageLabel')}
          >
            <Text style={[styles.pickerValue, !ageBracket && styles.pickerPlaceholder]}>
              {ageBracket
                ? t(`demographics.age.${ageBracket.replace('-', '_').replace('+', '_plus')}`, ageBracket)
                : t('demographics.selectAge')}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy note */}
        <View style={styles.privacyNote}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={styles.privacyText}>{t('onboarding.privacyIntro')}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={t('onboarding.continue')}
          onPress={handleContinue}
          disabled={!isComplete}
          accessibilityLabel={t('onboarding.continue')}
        />
      </View>

      {/* Picker modals */}
      <PickerModal
        visible={countryPickerVisible}
        title={t('demographics.selectCountry')}
        options={countryOptions}
        selectedValue={countryCode}
        onSelect={handleCountrySelect}
        onClose={() => setCountryPickerVisible(false)}
      />

      <PickerModal
        visible={regionPickerVisible}
        title={t('demographics.selectRegion')}
        options={regionOptions}
        selectedValue={regionCode}
        onSelect={setRegionCode}
        onClose={() => setRegionPickerVisible(false)}
      />

      <PickerModal
        visible={agePickerVisible}
        title={t('demographics.selectAge')}
        options={ageOptions}
        selectedValue={ageBracket}
        onSelect={(value) => setAgeBracket(value as AgeBracket)}
        onClose={() => setAgePickerVisible(false)}
      />

      <CityPickerModal
        visible={cityPickerVisible}
        onSelect={setSelectedCity}
        onClose={() => setCityPickerVisible(false)}
        language={i18n.language}
        countryCode={countryCode}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  required: {
    ...typography.small,
    color: colors.warning,
    marginBottom: spacing.xl,
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
  pickerPlaceholder: {
    color: colors.textTertiary,
  },
  editIcon: {
    fontSize: 18,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  privacyIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  privacyText: {
    ...typography.small,
    color: colors.textSecondary,
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
