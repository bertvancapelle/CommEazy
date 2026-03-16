/**
 * PersonalDetailsScreen — Onboarding step for personal contact details
 *
 * Collects: email, mobile, landline, address, birthDate, weddingDate.
 * All data is saved together with firstName/lastName to the user profile
 * at the end of this screen (single saveUserProfile call).
 *
 * Required fields: email, mobile, address (street, postalCode, city, country), birthDate
 * Optional fields: landline, weddingDate
 */

import React, { useCallback, useReducer, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useFeedback } from '@/hooks/useFeedback';
import type { OnboardingStackParams } from '@/navigation';
import { ServiceContainer } from '@/services/container';
import { SeniorDatePicker } from '@/components/SeniorDatePicker';
import { Button, TextInput, ProgressIndicator, ErrorView, HapticTouchable, ScrollViewWithIndicator, Icon } from '@/components';

type Props = NativeStackScreenProps<OnboardingStackParams, 'PersonalDetails'>;

const COUNTRY_CODES = [
  { code: '+31', country: 'NL' },
  { code: '+32', country: 'BE' },
  { code: '+49', country: 'DE' },
  { code: '+33', country: 'FR' },
  { code: '+34', country: 'ES' },
  { code: '+44', country: 'UK' },
  { code: '+1', country: 'US' },
];

const ADDRESS_COUNTRIES = [
  { code: 'NL', label: '🇳🇱 Nederland' },
  { code: 'BE', label: '🇧🇪 België' },
  { code: 'DE', label: '🇩🇪 Deutschland' },
  { code: 'FR', label: '🇫🇷 France' },
  { code: 'ES', label: '🇪🇸 España' },
  { code: 'GB', label: '🇬🇧 United Kingdom' },
  { code: 'US', label: '🇺🇸 United States' },
  { code: 'LU', label: '🇱🇺 Luxembourg' },
  { code: 'AT', label: '🇦🇹 Österreich' },
  { code: 'CH', label: '🇨🇭 Schweiz' },
];

interface FormState {
  email: string;
  mobileNumber: string;
  mobileCountryCode: string;
  landlineNumber: string;
  landlineCountryCode: string;
  addressStreet: string;
  addressPostalCode: string;
  addressCity: string;
  addressCountry: string;
  birthDate: string | undefined;
  weddingDate: string | undefined;
}

type FormAction =
  | { type: 'SET_FIELD'; field: keyof FormState; value: string | undefined };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    default:
      return state;
  }
}

export function PersonalDetailsScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();
  const { firstName, lastName } = route.params;

  const [form, dispatch] = useReducer(formReducer, {
    email: '',
    mobileNumber: '',
    mobileCountryCode: '+31',
    landlineNumber: '',
    landlineCountryCode: '+31',
    addressStreet: '',
    addressPostalCode: '',
    addressCity: '',
    addressCountry: '',
    birthDate: undefined,
    weddingDate: undefined,
  });

  const [notification, setNotification] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showMobileCountryCodes, setShowMobileCountryCodes] = useState(false);
  const [showLandlineCountryCodes, setShowLandlineCountryCodes] = useState(false);
  const [showAddressCountries, setShowAddressCountries] = useState(false);

  // Refs for keyboard navigation
  const mobileRef = useRef<RNTextInput>(null);
  const landlineRef = useRef<RNTextInput>(null);
  const streetRef = useRef<RNTextInput>(null);
  const postalRef = useRef<RNTextInput>(null);
  const cityRef = useRef<RNTextInput>(null);

  const setField = useCallback((field: keyof FormState, value: string | undefined) => {
    dispatch({ type: 'SET_FIELD', field, value });
  }, []);

  // Validation
  const isValid = Boolean(
    form.email.trim() &&
    form.mobileNumber.trim() &&
    form.addressStreet.trim() &&
    form.addressPostalCode.trim() &&
    form.addressCity.trim() &&
    form.addressCountry &&
    form.birthDate,
  );

  const handleSave = useCallback(async () => {
    void triggerFeedback('tap');

    if (!isValid) {
      setNotification({
        type: 'warning',
        title: t('onboarding.personalDetails.incompleteTitle'),
        message: t('onboarding.personalDetails.incompleteMessage'),
      });
      return;
    }

    setIsSaving(true);
    try {
      const profile = await ServiceContainer.database.getUserProfile();
      const fullMobile = form.mobileNumber.trim()
        ? `${form.mobileCountryCode}${form.mobileNumber.replace(/\D/g, '')}`
        : undefined;
      const fullLandline = form.landlineNumber.trim()
        ? `${form.landlineCountryCode}${form.landlineNumber.replace(/\D/g, '')}`
        : undefined;

      await ServiceContainer.database.saveUserProfile({
        ...profile,
        firstName,
        lastName,
        email: form.email.trim(),
        mobileNumber: fullMobile,
        landlineNumber: fullLandline,
        addressStreet: form.addressStreet.trim(),
        addressPostalCode: form.addressPostalCode.trim(),
        addressCity: form.addressCity.trim(),
        addressCountry: form.addressCountry,
        birthDate: form.birthDate,
        weddingDate: form.weddingDate,
      });

      navigation.navigate('NavigationTutorial', { firstName, lastName });
    } catch (error) {
      console.error('[PersonalDetails] Save failed:', error);
      setNotification({
        type: 'error',
        title: t('errors.genericTitle'),
        message: t('errors.genericError'),
      });
    } finally {
      setIsSaving(false);
    }
  }, [form, firstName, lastName, isValid, navigation, t, triggerFeedback]);

  const selectedCountryLabel = ADDRESS_COUNTRIES.find(c => c.code === form.addressCountry)?.label;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ProgressIndicator currentStep={5} totalSteps={6} />

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
            {t('onboarding.personalDetails.title')}
          </Text>
          <Text style={[styles.hint, { color: themeColors.textSecondary }]}>
            {t('onboarding.personalDetails.hint')}
          </Text>

          {notification && (
            <ErrorView
              type={notification.type}
              title={notification.title}
              message={notification.message}
              onDismiss={() => setNotification(null)}
            />
          )}

          {/* Email */}
          <TextInput
            label={t('onboarding.personalDetails.email')}
            value={form.email}
            onChangeText={(v) => setField('email', v)}
            placeholder={t('onboarding.personalDetails.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => mobileRef.current?.focus()}
            accessibilityLabel={t('onboarding.personalDetails.email')}
          />

          {/* Mobile number */}
          <View style={styles.phoneRow}>
            <View style={styles.countryCodeWrapper}>
              <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
                {t('onboarding.personalDetails.mobileCountryCode')}
              </Text>
              <HapticTouchable
                onPress={() => setShowMobileCountryCodes(!showMobileCountryCodes)}
                style={[styles.countryCodeButton, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
                accessibilityLabel={t('accessibility.countryCode')}
              >
                <Text style={[styles.countryCodeText, { color: themeColors.textPrimary }]}>{form.mobileCountryCode}</Text>
                <Icon name="chevron-down" size={16} color={themeColors.textSecondary} />
              </HapticTouchable>
              {showMobileCountryCodes && (
                <View style={[styles.countryCodeDropdown, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                  {COUNTRY_CODES.map((item) => (
                    <HapticTouchable
                      key={item.code}
                      style={[styles.countryCodeOption, { borderBottomColor: themeColors.divider }]}
                      onPress={() => {
                        setField('mobileCountryCode', item.code);
                        setShowMobileCountryCodes(false);
                      }}
                    >
                      <Text style={[styles.countryCodeOptionText, { color: themeColors.textPrimary }]}>
                        {item.code} ({item.country})
                      </Text>
                    </HapticTouchable>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.phoneNumberWrapper}>
              <TextInput
                ref={mobileRef}
                label={t('onboarding.personalDetails.mobileNumber')}
                value={form.mobileNumber}
                onChangeText={(v) => setField('mobileNumber', v)}
                placeholder={t('onboarding.personalDetails.mobilePlaceholder')}
                keyboardType="phone-pad"
                returnKeyType="next"
                onSubmitEditing={() => landlineRef.current?.focus()}
                accessibilityLabel={t('onboarding.personalDetails.mobileNumber')}
              />
            </View>
          </View>

          {/* Landline (optional) */}
          <View style={styles.phoneRow}>
            <View style={styles.countryCodeWrapper}>
              <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
                {t('onboarding.personalDetails.landlineCountryCode')}
              </Text>
              <HapticTouchable
                onPress={() => setShowLandlineCountryCodes(!showLandlineCountryCodes)}
                style={[styles.countryCodeButton, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
                accessibilityLabel={t('accessibility.countryCode')}
              >
                <Text style={[styles.countryCodeText, { color: themeColors.textPrimary }]}>{form.landlineCountryCode}</Text>
                <Icon name="chevron-down" size={16} color={themeColors.textSecondary} />
              </HapticTouchable>
              {showLandlineCountryCodes && (
                <View style={[styles.countryCodeDropdown, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                  {COUNTRY_CODES.map((item) => (
                    <HapticTouchable
                      key={item.code}
                      style={[styles.countryCodeOption, { borderBottomColor: themeColors.divider }]}
                      onPress={() => {
                        setField('landlineCountryCode', item.code);
                        setShowLandlineCountryCodes(false);
                      }}
                    >
                      <Text style={[styles.countryCodeOptionText, { color: themeColors.textPrimary }]}>
                        {item.code} ({item.country})
                      </Text>
                    </HapticTouchable>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.phoneNumberWrapper}>
              <TextInput
                ref={landlineRef}
                label={t('onboarding.personalDetails.landlineNumber')}
                value={form.landlineNumber}
                onChangeText={(v) => setField('landlineNumber', v)}
                placeholder={t('onboarding.personalDetails.landlinePlaceholder')}
                hint={t('common.optional')}
                keyboardType="phone-pad"
                returnKeyType="next"
                onSubmitEditing={() => streetRef.current?.focus()}
                accessibilityLabel={t('onboarding.personalDetails.landlineNumber')}
              />
            </View>
          </View>

          {/* Address section */}
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
            {t('onboarding.personalDetails.addressSection')}
          </Text>

          <TextInput
            ref={streetRef}
            label={t('onboarding.personalDetails.addressStreet')}
            value={form.addressStreet}
            onChangeText={(v) => setField('addressStreet', v)}
            placeholder={t('onboarding.personalDetails.streetPlaceholder')}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => postalRef.current?.focus()}
            accessibilityLabel={t('onboarding.personalDetails.addressStreet')}
          />

          <View style={styles.addressRow}>
            <View style={styles.postalCodeWrapper}>
              <TextInput
                ref={postalRef}
                label={t('onboarding.personalDetails.addressPostalCode')}
                value={form.addressPostalCode}
                onChangeText={(v) => setField('addressPostalCode', v)}
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
                value={form.addressCity}
                onChangeText={(v) => setField('addressCity', v)}
                placeholder={t('onboarding.personalDetails.cityPlaceholder')}
                autoCapitalize="words"
                returnKeyType="done"
                accessibilityLabel={t('onboarding.personalDetails.addressCity')}
              />
            </View>
          </View>

          {/* Country picker */}
          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
              {t('onboarding.personalDetails.addressCountry')}
            </Text>
            <HapticTouchable
              onPress={() => setShowAddressCountries(!showAddressCountries)}
              style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              accessibilityLabel={t('onboarding.personalDetails.addressCountry')}
            >
              <Text style={[styles.pickerValue, { color: selectedCountryLabel ? themeColors.textPrimary : themeColors.textTertiary }]}>
                {selectedCountryLabel || t('onboarding.personalDetails.selectCountry')}
              </Text>
              <Icon name="chevron-down" size={20} color={themeColors.textSecondary} />
            </HapticTouchable>
            {showAddressCountries && (
              <View style={[styles.countryCodeDropdown, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                {ADDRESS_COUNTRIES.map((item) => (
                  <HapticTouchable
                    key={item.code}
                    style={[styles.countryCodeOption, { borderBottomColor: themeColors.divider }]}
                    onPress={() => {
                      setField('addressCountry', item.code);
                      setShowAddressCountries(false);
                    }}
                  >
                    <Text style={[styles.countryCodeOptionText, { color: themeColors.textPrimary }]}>
                      {item.label}
                    </Text>
                  </HapticTouchable>
                ))}
              </View>
            )}
          </View>

          {/* Dates section */}
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
            {t('onboarding.personalDetails.datesSection')}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
              {t('onboarding.personalDetails.birthDate')}
            </Text>
            <SeniorDatePicker
              value={form.birthDate}
              onChange={(v) => setField('birthDate', v)}
              accessibilityLabel={t('onboarding.personalDetails.birthDate')}
              minYear={1900}
              allowClear={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
              {t('onboarding.personalDetails.weddingDate')}
            </Text>
            <SeniorDatePicker
              value={form.weddingDate}
              onChange={(v) => setField('weddingDate', v)}
              accessibilityLabel={t('onboarding.personalDetails.weddingDate')}
              minYear={1940}
            />
            <Text style={[styles.optionalHint, { color: themeColors.textTertiary }]}>
              {t('common.optional')}
            </Text>
          </View>

          {/* Extra bottom padding for scroll comfort */}
          <View style={{ height: spacing.xxl }} />
        </ScrollViewWithIndicator>

        <View style={styles.footer}>
          <Button
            title={t('onboarding.continue')}
            onPress={handleSave}
            disabled={!isValid || isSaving}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
  sectionTitle: {
    ...typography.label,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  countryCodeWrapper: {
    width: 100,
  },
  phoneNumberWrapper: {
    flex: 1,
  },
  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    minHeight: touchTargets.comfortable,
  },
  countryCodeText: {
    ...typography.body,
  },
  countryCodeDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 10,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginTop: 2,
    overflow: 'hidden',
  },
  countryCodeOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
  },
  countryCodeOptionText: {
    ...typography.body,
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
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: touchTargets.comfortable,
  },
  pickerValue: {
    ...typography.body,
    flex: 1,
  },
  optionalHint: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
