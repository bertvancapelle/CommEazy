/**
 * ProfileStep2Screen — "Waar woon je?"
 *
 * New field order optimized for GISCO Address API auto-lookup:
 *   Land* → Postcode* → Huisnummer* → [auto-lookup] → Straat → Stad → Provincie
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
  Keyboard,
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
import { Button, TextInput, ProgressIndicator, ErrorView, HapticTouchable, ScrollViewWithIndicator, PanelAwareModal, Icon } from '@/components';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { ModalLayout } from '@/components/ModalLayout';
import { useFeedback } from '@/hooks/useFeedback';
import { useScrollToField } from '@/hooks/useScrollToField';
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
      <LiquidGlassView moduleId="settings" style={pickerStyles.container} cornerRadius={0}>
        <ModalLayout
          headerBlock={
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
          }
          contentBlock={
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
          }
        />
      </LiquidGlassView>
    </PanelAwareModal>
  );
}

export function ProfileStep2Screen({ navigation }: Props) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const labelStyle = useLabelStyle();
  const fieldTextStyle = useFieldTextStyle();
  const { triggerFeedback } = useFeedback();
  const { scrollRef, registerField, scrollToField, getFieldFocusHandler, handleScroll: handleScrollToField } = useScrollToField();

  // Validation: tracks which required field is currently invalid (light-red highlight)
  const [invalidField, setInvalidField] = useState<string | null>(null);

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

  // Required: country, postcode, houseNumber
  const isValid = Boolean(
    countryCode &&
    addressPostalCode.trim() &&
    houseNumber.trim(),
  );

  const handleContinue = useCallback(async () => {
    void triggerFeedback('tap');
    Keyboard.dismiss();

    // Validate required fields — scroll to first empty field + highlight
    const requiredFields: { key: string; value: string | undefined }[] = [
      { key: 'country', value: countryCode },
      { key: 'postalCode', value: addressPostalCode.trim() || undefined },
      { key: 'houseNumber', value: houseNumber.trim() || undefined },
    ];
    const firstEmpty = requiredFields.find(f => !f.value);
    if (firstEmpty) {
      void triggerFeedback('warning');
      setInvalidField(firstEmpty.key);
      scrollToField(firstEmpty.key, { isModalReturn: false });
      return;
    }

    // Clear any previous validation error
    setInvalidField(null);

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
  }, [countryCode, addressStreet, addressPostalCode, houseNumber, addressCity, addressProvince, navigation, scrollToField, t, triggerFeedback]);

  // Build picker options
  const countryOptions = COUNTRIES.map(code => ({
    value: code,
    label: `${COUNTRY_FLAGS[code]} ${t(`demographics.countries.${code}`, code)}`,
  }));

  // Clear validation highlight reactively when the invalid field is filled
  useEffect(() => {
    if (!invalidField) return;
    const fieldValues: Record<string, string | undefined> = {
      country: countryCode,
      postalCode: addressPostalCode.trim() || undefined,
      houseNumber: houseNumber.trim() || undefined,
    };
    if (fieldValues[invalidField]) {
      setInvalidField(null);
    }
  }, [invalidField, countryCode, addressPostalCode, houseNumber]);

  // Red asterisk for required fields
  const requiredMark = <Text style={{ color: '#D32F2F', fontWeight: '700' }}> *</Text>;

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
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScrollToField}
          scrollEventThrottle={16}
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
          <View style={[styles.inputGroup, invalidField === 'country' && styles.invalidFieldHighlight]} ref={registerField('country')}>
            <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
              {t('demographics.countryLabel')}{requiredMark}
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
              <Icon name="chevron-right" size={20} color={themeColors.textTertiary} />
            </HapticTouchable>
          </View>

          {/* 2. Postcode + House number row */}
          <View style={styles.addressRow}>
            <View style={[styles.postalCodeWrapper, invalidField === 'postalCode' && styles.invalidFieldHighlight]} ref={registerField('postalCode')}>
              <TextInput
                label={<Text>{t('onboarding.personalDetails.addressPostalCode')}{requiredMark}</Text>}
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
                onFocus={getFieldFocusHandler('postalCode')}
                accessibilityLabel={t('onboarding.personalDetails.addressPostalCode')}
              />
            </View>
            <View style={[styles.houseNumberWrapper, invalidField === 'houseNumber' && styles.invalidFieldHighlight]} ref={registerField('houseNumber')}>
              <TextInput
                ref={houseNumberRef}
                label={<Text>{t('onboarding.profileStep2.houseNumber')}{requiredMark}</Text>}
                value={houseNumber}
                onChangeText={(text) => {
                  setHouseNumber(text);
                  lastLookupKey.current = ''; // Reset so next blur triggers lookup
                }}
                placeholder={t('onboarding.profileStep2.houseNumberPlaceholder')}
                returnKeyType="next"
                onSubmitEditing={() => streetRef.current?.focus()}
                onBlur={handleHouseNumberBlur}
                onFocus={getFieldFocusHandler('houseNumber')}
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

          {/* 4. City (auto-filled or manual) */}
          <TextInput
            ref={cityRef}
            label={t('onboarding.personalDetails.addressCity')}
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
        onClose={() => {
          setCountryPickerVisible(false);
          scrollToField('country', { isModalReturn: true });
        }}
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
  invalidFieldHighlight: {
    backgroundColor: 'rgba(255, 0, 0, 0.08)',
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginHorizontal: -spacing.xs,
  },
});
