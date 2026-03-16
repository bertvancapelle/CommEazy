/**
 * ProfileStep2Screen — "Waar woon je?"
 *
 * Collects: country*, street*, postalCode*, city*, province*
 * Also saves demographics (countryCode, regionCode, city, ageBracket) for ad targeting.
 *
 * Part of the 3-step onboarding profile wizard:
 *   PinSetup → ProfileStep1 → ProfileStep2 → ProfileStep3 → NavigationTutorial
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { Button, TextInput, ProgressIndicator, ErrorView, HapticTouchable, ScrollViewWithIndicator, Icon } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import { ServiceContainer } from '@/services/container';
import type { OnboardingStackParams } from '@/navigation';

type Props = NativeStackScreenProps<OnboardingStackParams, 'ProfileStep2'>;

// Country data with flag emojis
const COUNTRIES = ['NL', 'BE', 'LU', 'DE', 'AT', 'CH', 'FR', 'ES', 'GB', 'IE', 'US'] as const;

const COUNTRY_FLAGS: Record<string, string> = {
  NL: '🇳🇱', BE: '🇧🇪', LU: '🇱🇺', DE: '🇩🇪', AT: '🇦🇹',
  CH: '🇨🇭', FR: '🇫🇷', ES: '🇪🇸', GB: '🇬🇧', IE: '🇮🇪', US: '🇺🇸',
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
  const themeColors = useColors();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[pickerStyles.container, { backgroundColor: themeColors.background }]}>
        <View style={[pickerStyles.header, { borderBottomColor: themeColors.border }]}>
          <Text style={[pickerStyles.title, { color: themeColors.textPrimary }]}>{title}</Text>
          <HapticTouchable hapticDisabled
            onPress={onClose}
            style={pickerStyles.closeButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={[pickerStyles.closeText, { color: themeColors.textSecondary }]}>✕</Text>
          </HapticTouchable>
        </View>
        <ScrollViewWithIndicator style={pickerStyles.optionsList}>
          {options.map((option) => (
            <HapticTouchable hapticDisabled
              key={option.value}
              style={[
                pickerStyles.option,
                { borderBottomColor: themeColors.border },
                selectedValue === option.value && { backgroundColor: themeColors.primaryLight },
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
                  { color: themeColors.textPrimary },
                  selectedValue === option.value && { color: themeColors.primary, fontWeight: '600' },
                ]}
              >
                {option.label}
              </Text>
              {selectedValue === option.value && (
                <Text style={[pickerStyles.checkmark, { color: themeColors.primary }]}>✓</Text>
              )}
            </HapticTouchable>
          ))}
        </ScrollViewWithIndicator>
      </View>
    </Modal>
  );
}

export function ProfileStep2Screen({ navigation }: Props) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();

  const [countryCode, setCountryCode] = useState<string | undefined>();
  const [addressStreet, setAddressStreet] = useState('');
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [regionCode, setRegionCode] = useState<string | undefined>();

  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [regionPickerVisible, setRegionPickerVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
  } | null>(null);

  const postalRef = useRef<RNTextInput>(null);
  const cityRef = useRef<RNTextInput>(null);

  const handleCountrySelect = useCallback((code: string) => {
    void triggerFeedback('tap');
    setCountryCode(code);
    setRegionCode(undefined);
  }, [triggerFeedback]);

  // Check if country has regions
  const hasRegions = countryCode && REGIONS_BY_COUNTRY[countryCode] && REGIONS_BY_COUNTRY[countryCode].length > 1;

  const isValid = Boolean(
    countryCode &&
    addressStreet.trim() &&
    addressPostalCode.trim() &&
    addressCity.trim() &&
    (!hasRegions || regionCode),
  );

  const handleContinue = useCallback(async () => {
    void triggerFeedback('tap');

    if (!isValid) {
      setNotification({
        type: 'warning',
        title: t('onboarding.profileStep2.incompleteTitle'),
        message: t('onboarding.profileStep2.incompleteMessage'),
      });
      return;
    }

    setIsSaving(true);
    try {
      const profile = await ServiceContainer.database.getUserProfile();
      if (profile) {
        await ServiceContainer.database.saveUserProfile({
          ...profile,
          // Address fields
          addressStreet: addressStreet.trim(),
          addressPostalCode: addressPostalCode.trim(),
          addressCity: addressCity.trim(),
          addressCountry: countryCode,
          addressProvince: regionCode || undefined,
          // Demographics (for ad targeting)
          countryCode,
          regionCode: regionCode || countryCode, // Use country code for countries without regions (LU)
          city: addressCity.trim(),
        });
      }

      navigation.navigate('ProfileStep3');
    } catch (error) {
      console.error('[ProfileStep2] Save failed:', (error as Error).message);
      setNotification({
        type: 'error',
        title: t('errors.genericTitle'),
        message: t('errors.genericError'),
      });
    } finally {
      setIsSaving(false);
    }
  }, [countryCode, regionCode, addressStreet, addressPostalCode, addressCity, isValid, navigation, t, triggerFeedback]);

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ProgressIndicator currentStep={5} totalSteps={8} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollViewWithIndicator
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            {t('onboarding.profileStep2.title')}
          </Text>
          <Text style={[styles.hint, { color: themeColors.textSecondary }]}>
            {t('onboarding.profileStep2.hint')}
          </Text>

          {notification && (
            <ErrorView
              type={notification.type}
              title={notification.title}
              message={notification.message}
              onDismiss={() => setNotification(null)}
            />
          )}

          {/* Country picker */}
          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
              {t('demographics.countryLabel')}
            </Text>
            <HapticTouchable
              onPress={() => setCountryPickerVisible(true)}
              style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('demographics.countryLabel')}
            >
              <Text style={[styles.pickerValue, { color: countryCode ? themeColors.textPrimary : themeColors.textTertiary }]}>
                {countryCode
                  ? `${COUNTRY_FLAGS[countryCode]} ${t(`demographics.countries.${countryCode}`, countryCode)}`
                  : t('demographics.selectCountry')}
              </Text>
              <Text style={[styles.editIcon, { color: themeColors.textSecondary }]}>✏️</Text>
            </HapticTouchable>
          </View>

          {/* Province/Region picker (only if country has regions) */}
          {countryCode && hasRegions && (
            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
                {t('onboarding.profileStep2.provinceLabel')}
              </Text>
              <HapticTouchable
                onPress={() => setRegionPickerVisible(true)}
                style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.profileStep2.provinceLabel')}
              >
                <Text style={[styles.pickerValue, { color: regionCode ? themeColors.textPrimary : themeColors.textTertiary }]}>
                  {regionCode
                    ? t(`demographics.regions.${regionCode}`, regionCode)
                    : t('onboarding.profileStep2.selectProvince')}
                </Text>
                <Text style={[styles.editIcon, { color: themeColors.textSecondary }]}>✏️</Text>
              </HapticTouchable>
            </View>
          )}

          {/* Street */}
          <TextInput
            label={t('onboarding.personalDetails.addressStreet')}
            value={addressStreet}
            onChangeText={setAddressStreet}
            placeholder={t('onboarding.personalDetails.streetPlaceholder')}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => postalRef.current?.focus()}
            accessibilityLabel={t('onboarding.personalDetails.addressStreet')}
          />

          {/* Postal code + City row */}
          <View style={styles.addressRow}>
            <View style={styles.postalCodeWrapper}>
              <TextInput
                ref={postalRef}
                label={t('onboarding.personalDetails.addressPostalCode')}
                value={addressPostalCode}
                onChangeText={setAddressPostalCode}
                placeholder={t('onboarding.personalDetails.postalCodePlaceholder')}
                autoCapitalize="characters"
                returnKeyType="next"
                onSubmitEditing={() => cityRef.current?.focus()}
                accessibilityLabel={t('onboarding.personalDetails.addressPostalCode')}
              />
            </View>
            <View style={styles.cityWrapper}>
              <TextInput
                ref={cityRef}
                label={t('onboarding.personalDetails.addressCity')}
                value={addressCity}
                onChangeText={setAddressCity}
                placeholder={t('onboarding.personalDetails.cityPlaceholder')}
                autoCapitalize="words"
                returnKeyType="done"
                accessibilityLabel={t('onboarding.personalDetails.addressCity')}
              />
            </View>
          </View>

          {/* Extra bottom padding */}
          <View style={{ height: spacing.xxl }} />
        </ScrollViewWithIndicator>

        <View style={styles.footer}>
          <Button
            title={t('onboarding.continue')}
            onPress={handleContinue}
            disabled={!isValid || isSaving}
            loading={isSaving}
          />
        </View>
      </KeyboardAvoidingView>

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
        title={t('onboarding.profileStep2.selectProvince')}
        options={regionOptions}
        selectedValue={regionCode}
        onSelect={setRegionCode}
        onClose={() => setRegionPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const pickerStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  title: {
    ...typography.h3,
  },
  closeButton: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    ...typography.h3,
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
  },
  optionText: {
    ...typography.body,
    flex: 1,
  },
  checkmark: {
    ...typography.h3,
    marginLeft: spacing.sm,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.body,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    minHeight: touchTargets.comfortable,
  },
  pickerValue: {
    ...typography.body,
    flex: 1,
  },
  editIcon: {
    fontSize: 18,
    marginLeft: spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  postalCodeWrapper: {
    width: 130,
  },
  cityWrapper: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
