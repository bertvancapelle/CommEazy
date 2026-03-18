/**
 * ProfileStep2Screen — "Waar woon je?"
 *
 * New field order optimized for GISCO Address API auto-lookup:
 *   Land* → Postcode* → Huisnummer → [auto-lookup] → Straat → Stad* → Provincie
 *
 * When country is EU + exactly 1 GISCO result: auto-fills street, city, province.
 * Otherwise: fields stay empty for manual entry (silent fallback).
 *
 * Part of the 3-step onboarding profile wizard:
 *   PinSetup → ProfileStep1 → ProfileStep2 → ProfileStep3 → NavigationTutorial
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useLabelStyle, useFieldTextStyle, useModalTextStyle } from '@/contexts/FieldTextStyleContext';
import { Button, TextInput, ProgressIndicator, ErrorView, HapticTouchable, ScrollViewWithIndicator, PanelAwareModal } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import { ServiceContainer } from '@/services/container';
import { lookupAddress, isGISCOSupported } from '@/services/addressLookupService';
import type { OnboardingStackParams } from '@/navigation';

type Props = NativeStackScreenProps<OnboardingStackParams, 'ProfileStep2'>;

// Country data with flag emojis
const COUNTRIES = ['NL', 'BE', 'LU', 'DE', 'AT', 'CH', 'FR', 'ES', 'GB', 'IE', 'US'] as const;

const COUNTRY_FLAGS: Record<string, string> = {
  NL: '🇳🇱', BE: '🇧🇪', LU: '🇱🇺', DE: '🇩🇪', AT: '🇦🇹',
  CH: '🇨🇭', FR: '🇫🇷', ES: '🇪🇸', GB: '🇬🇧', IE: '🇮🇪', US: '🇺🇸',
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
  const modalTextStyle = useModalTextStyle();
  return (
    <PanelAwareModal
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
                  { color: modalTextStyle.color, fontWeight: modalTextStyle.fontWeight, fontStyle: modalTextStyle.fontStyle },
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
    </PanelAwareModal>
  );
}

export function ProfileStep2Screen({ navigation }: Props) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const labelStyle = useLabelStyle();
  const fieldTextStyle = useFieldTextStyle();
  const { triggerFeedback } = useFeedback();

  // Fields in new order: Land → Postcode → Huisnummer → Straat → Stad → Provincie
  const [countryCode, setCountryCode] = useState<string | undefined>();
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressProvince, setAddressProvince] = useState('');

  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
  } | null>(null);

  const houseNumberRef = useRef<RNTextInput>(null);
  const streetRef = useRef<RNTextInput>(null);
  const cityRef = useRef<RNTextInput>(null);
  const provinceRef = useRef<RNTextInput>(null);

  // Track whether auto-lookup has been attempted for current postcode+housenumber
  const lastLookupKey = useRef('');

  const handleCountrySelect = useCallback((code: string) => {
    void triggerFeedback('tap');
    setCountryCode(code);
    // Reset address fields when country changes
    setAddressStreet('');
    setAddressCity('');
    setAddressProvince('');
    lastLookupKey.current = '';
  }, [triggerFeedback]);

  // Auto-lookup when postcode changes (and country is GISCO-supported)
  const performLookup = useCallback(async () => {
    if (!countryCode || !addressPostalCode.trim()) return;
    if (!isGISCOSupported(countryCode)) return;

    const lookupKey = `${countryCode}:${addressPostalCode.trim()}:${houseNumber.trim()}`;
    if (lookupKey === lastLookupKey.current) return;
    lastLookupKey.current = lookupKey;

    setIsLookingUp(true);
    const result = await lookupAddress(countryCode, addressPostalCode.trim(), houseNumber.trim() || undefined);
    setIsLookingUp(false);

    if (result) {
      // Auto-fill: combine street + house number if API returned a street
      if (result.street) {
        setAddressStreet(
          houseNumber.trim()
            ? `${result.street} ${houseNumber.trim()}`
            : result.street,
        );
      }
      if (result.city) setAddressCity(result.city);
      if (result.province) setAddressProvince(result.province);
    }
    // If no result: fields stay as-is (empty or user-edited) — silent fallback
  }, [countryCode, addressPostalCode, houseNumber]);

  // Trigger lookup when postcode field loses focus or house number field loses focus
  const handlePostalCodeBlur = useCallback(() => {
    if (addressPostalCode.trim().length >= 3) {
      void performLookup();
    }
  }, [addressPostalCode, performLookup]);

  const handleHouseNumberBlur = useCallback(() => {
    if (addressPostalCode.trim().length >= 3) {
      void performLookup();
    }
  }, [addressPostalCode, performLookup]);

  // Required: country, postcode, city
  const isValid = Boolean(
    countryCode &&
    addressPostalCode.trim() &&
    addressCity.trim(),
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
          addressStreet: addressStreet.trim() || undefined,
          addressPostalCode: addressPostalCode.trim(),
          addressCity: addressCity.trim(),
          addressCountry: countryCode,
          addressProvince: addressProvince.trim() || undefined,
          // Demographics (for ad targeting)
          countryCode,
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
  }, [countryCode, addressStreet, addressPostalCode, addressCity, addressProvince, isValid, navigation, t, triggerFeedback]);

  // Build picker options
  const countryOptions = COUNTRIES.map(code => ({
    value: code,
    label: `${COUNTRY_FLAGS[code]} ${t(`demographics.countries.${code}`, code)}`,
  }));

  // Show GISCO indicator when country is EU
  const showGISCOHint = countryCode && isGISCOSupported(countryCode);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ProgressIndicator currentStep={5} totalSteps={8} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 100}
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

          {/* 1. Country picker (required) */}
          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
              {t('demographics.countryLabel')} <Text style={styles.requiredStar}>*</Text>
            </Text>
            <HapticTouchable
              onPress={() => setCountryPickerVisible(true)}
              style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('demographics.countryLabel')}
            >
              <Text style={[styles.pickerValue, countryCode ? { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle } : { color: themeColors.textTertiary }]}>
                {countryCode
                  ? `${COUNTRY_FLAGS[countryCode]} ${t(`demographics.countries.${countryCode}`, countryCode)}`
                  : t('demographics.selectCountry')}
              </Text>
              <Text style={[styles.editIcon, { color: themeColors.textSecondary }]}>✏️</Text>
            </HapticTouchable>
          </View>

          {/* 2. Postcode + House number row */}
          <View style={styles.addressRow}>
            <View style={styles.postalCodeWrapper}>
              <TextInput
                label={`${t('onboarding.personalDetails.addressPostalCode')} *`}
                value={addressPostalCode}
                onChangeText={(text) => {
                  setAddressPostalCode(text);
                  lastLookupKey.current = ''; // Reset so next blur triggers lookup
                }}
                placeholder={t('onboarding.personalDetails.postalCodePlaceholder')}
                autoCapitalize="characters"
                returnKeyType="next"
                onSubmitEditing={() => houseNumberRef.current?.focus()}
                onBlur={handlePostalCodeBlur}
                accessibilityLabel={t('onboarding.personalDetails.addressPostalCode')}
              />
            </View>
            <View style={styles.houseNumberWrapper}>
              <TextInput
                ref={houseNumberRef}
                label={t('onboarding.profileStep2.houseNumber')}
                value={houseNumber}
                onChangeText={(text) => {
                  setHouseNumber(text);
                  lastLookupKey.current = ''; // Reset so next blur triggers lookup
                }}
                placeholder={t('onboarding.profileStep2.houseNumberPlaceholder')}
                returnKeyType="next"
                onSubmitEditing={() => streetRef.current?.focus()}
                onBlur={handleHouseNumberBlur}
                accessibilityLabel={t('onboarding.profileStep2.houseNumber')}
              />
            </View>
          </View>

          {/* GISCO lookup indicator */}
          {isLookingUp && showGISCOHint && (
            <View style={styles.lookupRow}>
              <ActivityIndicator size="small" color={themeColors.primary} />
              <Text style={[styles.lookupText, { color: themeColors.textTertiary }]}>
                {t('onboarding.profileStep2.lookingUp')}
              </Text>
            </View>
          )}

          {/* 3. Street (auto-filled or manual) */}
          <TextInput
            ref={streetRef}
            label={t('onboarding.personalDetails.addressStreet')}
            value={addressStreet}
            onChangeText={setAddressStreet}
            placeholder={t('onboarding.personalDetails.streetPlaceholder')}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => cityRef.current?.focus()}
            accessibilityLabel={t('onboarding.personalDetails.addressStreet')}
          />

          {/* 4. City (auto-filled or manual, required) */}
          <TextInput
            ref={cityRef}
            label={`${t('onboarding.personalDetails.addressCity')} *`}
            value={addressCity}
            onChangeText={setAddressCity}
            placeholder={t('onboarding.personalDetails.cityPlaceholder')}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => provinceRef.current?.focus()}
            accessibilityLabel={t('onboarding.personalDetails.addressCity')}
          />

          {/* 5. Province (auto-filled or manual) */}
          <TextInput
            ref={provinceRef}
            label={t('onboarding.profileStep2.provinceLabel')}
            value={addressProvince}
            onChangeText={setAddressProvince}
            placeholder={t('onboarding.profileStep2.provincePlaceholder')}
            autoCapitalize="words"
            returnKeyType="done"
            accessibilityLabel={t('onboarding.profileStep2.provinceLabel')}
          />

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

      {/* Country picker modal */}
      <PickerModal
        visible={countryPickerVisible}
        title={t('demographics.selectCountry')}
        options={countryOptions}
        selectedValue={countryCode}
        onSelect={handleCountrySelect}
        onClose={() => setCountryPickerVisible(false)}
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
  requiredStar: {
    color: '#D32F2F',
    fontWeight: '700',
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
    flex: 1,
  },
  houseNumberWrapper: {
    width: 110,
  },
  lookupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    marginTop: -spacing.xs,
  },
  lookupText: {
    ...typography.small,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
