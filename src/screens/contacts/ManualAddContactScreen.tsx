/**
 * ManualAddContactScreen — Add a known contact manually (no CommEazy account)
 *
 * This is the "Bekende toevoegen" option from AddContactScreen.
 * For contacts without CommEazy — saves name + phone, no E2E encryption.
 *
 * Senior-inclusive design:
 * - Large input fields (60pt+)
 * - Clear labels above fields
 * - Country code selector
 * - Validation feedback
 * - firstName + lastName fields (v14)
 * - Email, address, and date fields
 *
 * @see TRUST_AND_ATTESTATION_PLAN.md section 4.2
 */

import React, { useCallback, useReducer, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useFeedback } from '@/hooks/useFeedback';
import type { ContactStackParams } from '@/navigation';
import { ServiceContainer } from '@/services/container';
import { SeniorDatePicker } from '@/components/SeniorDatePicker';

type NavigationProp = NativeStackNavigationProp<ContactStackParams, 'ManualAddContact'>;

// Common country codes
const COUNTRY_CODES = [
  { code: '+31', country: 'NL' },
  { code: '+32', country: 'BE' },
  { code: '+49', country: 'DE' },
  { code: '+33', country: 'FR' },
  { code: '+34', country: 'ES' },
  { code: '+44', country: 'UK' },
  { code: '+1', country: 'US' },
];

export function ManualAddContactScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { triggerFeedback } = useFeedback();
  const themeColors = useColors();

  // Form state consolidated into a single reducer
  interface FormState {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    countryCode: string;
    email: string;
    street: string;
    postalCode: string;
    city: string;
    country: string;
    birthDate: string | undefined;
    weddingDate: string | undefined;
    deathDate: string | undefined;
  }

  type FormAction =
    | { type: 'SET_FIELD'; field: keyof FormState; value: string | undefined }
    | { type: 'SET_COUNTRY_CODE'; value: string };

  const formReducer = useCallback((state: FormState, action: FormAction): FormState => {
    switch (action.type) {
      case 'SET_FIELD':
        return { ...state, [action.field]: action.value };
      case 'SET_COUNTRY_CODE':
        return { ...state, countryCode: action.value };
      default:
        return state;
    }
  }, []);

  const [form, dispatch] = useReducer(formReducer, {
    firstName: '',
    lastName: '',
    phoneNumber: '',
    countryCode: '+31',
    email: '',
    street: '',
    postalCode: '',
    city: '',
    country: '',
    birthDate: undefined,
    weddingDate: undefined,
    deathDate: undefined,
  });

  const setField = useCallback((field: keyof FormState, value: string | undefined) => {
    dispatch({ type: 'SET_FIELD', field, value });
  }, []);

  // Convenience accessors for backward compatibility
  const { firstName, lastName, phoneNumber, countryCode, email, street, postalCode, city, country, birthDate, weddingDate, deathDate } = form;

  const [showCountryCodes, setShowCountryCodes] = useState(false);
  const [saving, setSaving] = useState(false);

  const isValidPhone = useCallback((phone: string): boolean => {
    // Basic validation: at least 6 digits
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length >= 6 && digitsOnly.length <= 15;
  }, []);

  const isValidFirstName = useCallback((n: string): boolean => {
    return n.trim().length >= 1;
  }, []);

  const canSave = isValidFirstName(firstName) && isValidPhone(phoneNumber);

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;

    void triggerFeedback('tap');
    setSaving(true);

    try {
      const fullPhoneNumber = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;

      // Generate a JID from phone number (simplified - in production use server)
      const jid = `${fullPhoneNumber.replace(/\+/g, '')}@commeazy.app`;

      // Build address if any field is filled
      const hasAddress = street.trim() || postalCode.trim() || city.trim() || country.trim();
      const address = hasAddress
        ? {
            street: street.trim() || undefined,
            postalCode: postalCode.trim() || undefined,
            city: city.trim() || undefined,
            country: country.trim() || undefined,
          }
        : undefined;

      const contactData = {
        jid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: fullPhoneNumber,
        email: email.trim() || undefined,
        address,
        birthDate,
        weddingDate,
        deathDate,
        publicKey: '', // Will be set when contact shares their key
        verified: false,
        lastSeen: Date.now(),
      };

      if (__DEV__) {
        // In dev mode, just log and navigate back (mock data is in memory)
        console.log('[DEV] Would save contact:', contactData);
      } else {
        // Production: use real database service
        const db = ServiceContainer.database;
        await db.saveContact(contactData);
      }

      navigation.goBack();
    } catch (error) {
      console.error('Failed to save contact:', error);
      Alert.alert(t('errors.genericError'));
    } finally {
      setSaving(false);
    }
  }, [canSave, saving, countryCode, phoneNumber, firstName, lastName, email, street, postalCode, city, country, birthDate, weddingDate, deathDate, navigation, t, triggerFeedback]);

  const toggleCountryCodes = useCallback(() => {
    void triggerFeedback('tap');
    setShowCountryCodes((prev) => !prev);
  }, [triggerFeedback]);

  const selectCountryCode = useCallback((code: string) => {
    void triggerFeedback('tap');
    setField('countryCode', code);
    setShowCountryCodes(false);
  }, [triggerFeedback, setField]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* First name input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t('contacts.firstNameLabel')}</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.textPrimary, borderColor: themeColors.border }]}
            placeholder={t('contacts.firstNamePlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            value={firstName}
            onChangeText={(v) => setField('firstName', v)}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            accessibilityLabel={t('contacts.firstNameLabel')}
            accessibilityHint={t('accessibility.enterContactFirstName')}
          />
        </View>

        {/* Last name input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t('contacts.lastNameLabel')}</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.textPrimary, borderColor: themeColors.border }]}
            placeholder={t('contacts.lastNamePlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            value={lastName}
            onChangeText={(v) => setField('lastName', v)}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            accessibilityLabel={t('contacts.lastNameLabel')}
            accessibilityHint={t('accessibility.enterContactLastName')}
          />
        </View>

        {/* Phone number input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t('contacts.phoneLabel')}</Text>
          <View style={styles.phoneInputContainer}>
            {/* Country code selector */}
            <TouchableOpacity
              style={[styles.countryCodeButton, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
              onPress={toggleCountryCodes}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.countryCode')}
              accessibilityHint={t('accessibility.selectCountryCode')}
            >
              <Text style={[styles.countryCodeText, { color: themeColors.textPrimary }]}>{countryCode}</Text>
              <Text style={[styles.dropdownIcon, { color: themeColors.textSecondary }]}>▼</Text>
            </TouchableOpacity>

            {/* Phone number */}
            <TextInput
              style={[styles.phoneInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              placeholder={t('contacts.phonePlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              value={phoneNumber}
              onChangeText={(v) => setField('phoneNumber', v)}
              keyboardType="phone-pad"
              returnKeyType="done"
              accessibilityLabel={t('contacts.phoneLabel')}
              accessibilityHint={t('accessibility.enterPhoneNumber')}
            />
          </View>

          {/* Country code dropdown */}
          {showCountryCodes && (
            <View style={[styles.countryCodeDropdown, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              {COUNTRY_CODES.map((item) => (
                <TouchableOpacity
                  key={item.code}
                  style={[styles.countryCodeOption, { borderBottomColor: themeColors.divider }]}
                  onPress={() => selectCountryCode(item.code)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.country} ${item.code}`}
                >
                  <Text style={[styles.countryCodeOptionText, { color: themeColors.textPrimary }]}>
                    {item.country} {item.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Email input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t('contacts.emailLabel')}</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.textPrimary, borderColor: themeColors.border }]}
            placeholder={t('contacts.emailPlaceholder')}
            placeholderTextColor={themeColors.textTertiary}
            value={email}
            onChangeText={(v) => setField('email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            accessibilityLabel={t('contacts.emailLabel')}
          />
        </View>

        {/* Address section */}
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('contacts.address.title')}</Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t('contacts.address.street')}</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.textPrimary, borderColor: themeColors.border }]}
            placeholder={t('contacts.address.street')}
            placeholderTextColor={themeColors.textTertiary}
            value={street}
            onChangeText={(v) => setField('street', v)}
            autoCapitalize="words"
            returnKeyType="next"
            accessibilityLabel={t('contacts.address.street')}
          />
        </View>

        <View style={styles.addressRow}>
          <View style={[styles.inputGroup, styles.postalCodeField]}>
            <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t('contacts.address.postalCode')}</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              placeholder={t('contacts.address.postalCode')}
              placeholderTextColor={themeColors.textTertiary}
              value={postalCode}
              onChangeText={(v) => setField('postalCode', v)}
              autoCapitalize="characters"
              returnKeyType="next"
              accessibilityLabel={t('contacts.address.postalCode')}
            />
          </View>

          <View style={[styles.inputGroup, styles.cityField]}>
            <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t('contacts.address.city')}</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              placeholder={t('contacts.address.city')}
              placeholderTextColor={themeColors.textTertiary}
              value={city}
              onChangeText={(v) => setField('city', v)}
              autoCapitalize="words"
              returnKeyType="next"
              accessibilityLabel={t('contacts.address.city')}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t('contacts.address.country')}</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.textPrimary, borderColor: themeColors.border }]}
            placeholder={t('contacts.address.country')}
            placeholderTextColor={themeColors.textTertiary}
            value={country}
            onChangeText={(v) => setField('country', v)}
            autoCapitalize="words"
            returnKeyType="done"
            accessibilityLabel={t('contacts.address.country')}
          />
        </View>

        {/* Dates section */}
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t('contacts.dates.title')}</Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t('contacts.dates.birthDate')}</Text>
          <SeniorDatePicker
            value={birthDate}
            onChange={(v) => setField('birthDate', v)}
            accessibilityLabel={t('contacts.dates.birthDate')}
            minYear={1900}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t('contacts.dates.weddingDate')}</Text>
          <SeniorDatePicker
            value={weddingDate}
            onChange={(v) => setField('weddingDate', v)}
            accessibilityLabel={t('contacts.dates.weddingDate')}
            minYear={1940}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t('contacts.dates.deathDate')}</Text>
          <SeniorDatePicker
            value={deathDate}
            onChange={(v) => setField('deathDate', v)}
            accessibilityLabel={t('contacts.dates.deathDate')}
            minYear={1940}
          />
        </View>

        {/* Hint text */}
        <Text style={[styles.hintText, { color: themeColors.textSecondary }]}>{t('contacts.addHint')}</Text>

        {/* Save button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: canSave ? themeColors.primary : themeColors.disabled },
          ]}
          onPress={() => void handleSave()}
          disabled={!canSave || saving}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('contacts.save')}
          accessibilityState={{ disabled: !canSave }}
        >
          <Text
            style={[
              styles.saveButtonText,
              { color: canSave ? themeColors.textOnPrimary : themeColors.textTertiary },
            ]}
          >
            {saving ? t('common.saving') : t('contacts.save')}
          </Text>
        </TouchableOpacity>

        {/* Hint about trust level */}
        <Text style={[styles.hintNote, { color: themeColors.textTertiary }]}>
          {t('contacts.add.manualHint', 'Dit contact wordt opgeslagen zonder versleuteling. Nodig iemand uit voor beveiligde berichten.')}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  textInput: {
    ...typography.input,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: touchTargets.minimum,
    minWidth: 90,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between',
  },
  countryCodeText: {
    ...typography.input,
    color: colors.textPrimary,
  },
  dropdownIcon: {
    fontSize: 16,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  phoneInput: {
    ...typography.input,
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countryCodeDropdown: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  countryCodeOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    justifyContent: 'center',
  },
  countryCodeOptionText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  addressRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  postalCodeField: {
    flex: 1,
  },
  cityField: {
    flex: 2,
  },
  hintText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  hintNote: {
    ...typography.label,
    textAlign: 'center',
    marginTop: spacing.lg,
    fontStyle: 'italic',
  },
});
