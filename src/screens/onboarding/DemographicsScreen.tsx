/**
 * Demographics Screen (Onboarding)
 *
 * Collects required demographic data for free users:
 * - Country of origin
 * - Region/Province
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
 */

import React, { useCallback, useState } from 'react';
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
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, typography, spacing, borderRadius, touchTargets } from '@/theme';
import { Button, ProgressIndicator } from '@/components';
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
  const { t } = useTranslation();
  const { name } = route.params;

  const [countryCode, setCountryCode] = useState<string | undefined>();
  const [regionCode, setRegionCode] = useState<string | undefined>();
  const [city, setCity] = useState<string>('');
  const [ageBracket, setAgeBracket] = useState<AgeBracket | undefined>();

  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [regionPickerVisible, setRegionPickerVisible] = useState(false);
  const [agePickerVisible, setAgePickerVisible] = useState(false);

  const handleCountrySelect = useCallback((code: string) => {
    setCountryCode(code);
    // Clear region when country changes
    setRegionCode(undefined);
  }, []);

  const handleContinue = useCallback(async () => {
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

    if (!city.trim()) {
      Alert.alert(t('demographics.required'), t('demographics.enterCity'));
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
          city: city.trim(),
          ageBracket,
        });
      }

      // Navigate to navigation tutorial
      navigation.navigate('NavigationTutorial', { name });
    } catch (error) {
      console.error('Failed to save demographics:', error);
      Alert.alert(t('errors.genericError'));
    }
  }, [countryCode, regionCode, ageBracket, name, navigation, t]);

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
  const isComplete = countryCode && (!hasRegions || regionCode) && city.trim() && ageBracket;

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

        {/* City input field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>{t('demographics.cityLabel')}</Text>
          <TextInput
            style={styles.textInput}
            value={city}
            onChangeText={setCity}
            placeholder={t('demographics.enterCity')}
            placeholderTextColor={colors.textTertiary}
            maxLength={100}
            autoCapitalize="words"
            autoCorrect={false}
            accessibilityLabel={t('demographics.cityLabel')}
            accessibilityHint={t('demographics.enterCity')}
          />
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
