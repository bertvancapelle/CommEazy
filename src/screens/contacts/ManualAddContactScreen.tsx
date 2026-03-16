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

import React, { useCallback, useEffect, useReducer, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
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
import { ModuleHeader, ModuleScreenLayout, HapticTouchable, ScrollViewWithIndicator, ErrorView, PanelAwareModal, Icon } from '@/components';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  STANDARD_CATEGORIES,
  CUSTOM_CATEGORIES_STORAGE_KEY,
  type AgendaCategoryDef,
  type CustomCategory,
} from '@/constants/agendaCategories';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const insets = useSafeAreaInsets();

  // Save-time reminder modal state (shown when email is missing)
  const [showEmailReminder, setShowEmailReminder] = useState(false);
  const [pendingReminderEmail, setPendingReminderEmail] = useState('');

  // Form state consolidated into a single reducer
  interface FormState {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    countryCode: string;
    mobileNumber: string;
    mobileCountryCode: string;
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
    mobileNumber: '',
    mobileCountryCode: '+31',
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
  const { firstName, lastName, phoneNumber, countryCode, mobileNumber, mobileCountryCode, email, street, postalCode, city, country, birthDate, weddingDate, deathDate } = form;

  const [showCountryCodes, setShowCountryCodes] = useState(false);
  const [showMobileCountryCodes, setShowMobileCountryCodes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
  } | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

  // Load custom categories on mount
  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY).then(json => {
      if (json) {
        try { setCustomCategories(JSON.parse(json)); } catch { /* ignore */ }
      }
    });
  }, []);

  // All available categories (standard + custom)
  const allCategories = useMemo((): (AgendaCategoryDef | CustomCategory)[] => {
    return [...STANDARD_CATEGORIES, ...customCategories];
  }, [customCategories]);

  // Toggle a category
  const handleToggleCategory = useCallback((categoryId: string) => {
    void triggerFeedback('tap');
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      }
      return [...prev, categoryId];
    });
  }, [triggerFeedback]);

  const isValidPhone = useCallback((phone: string): boolean => {
    // Basic validation: at least 6 digits
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length >= 6 && digitsOnly.length <= 15;
  }, []);

  const isValidFirstName = useCallback((n: string): boolean => {
    return n.trim().length >= 1;
  }, []);

  const hasValidPhone = isValidPhone(phoneNumber) || isValidPhone(mobileNumber);
  const canSave = isValidFirstName(firstName) && hasValidPhone && selectedCategories.length > 0;

  // ── Dirty state — determines Cancel behavior ──
  const isDirty = useMemo(() => {
    return (
      firstName.trim().length > 0 ||
      lastName.trim().length > 0 ||
      phoneNumber.trim().length > 0 ||
      mobileNumber.trim().length > 0 ||
      email.trim().length > 0 ||
      street.trim().length > 0 ||
      postalCode.trim().length > 0 ||
      city.trim().length > 0 ||
      country.trim().length > 0 ||
      birthDate !== undefined ||
      weddingDate !== undefined ||
      deathDate !== undefined ||
      selectedCategories.length > 0
    );
  }, [firstName, lastName, phoneNumber, mobileNumber, email, street, postalCode, city, country, birthDate, weddingDate, deathDate, selectedCategories]);

  // Cancel with unsaved changes guard
  const handleCancel = useCallback(() => {
    if (isDirty) {
      Alert.alert(
        t('common.formActions.discardTitle'),
        t('common.formActions.discardMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.formActions.discard'), style: 'destructive', onPress: () => navigation.goBack() },
        ],
      );
    } else {
      navigation.goBack();
    }
  }, [isDirty, navigation, t]);

  // Performs the actual save to database
  const performSave = useCallback(async (emailOverride?: string) => {
    setSaving(true);

    try {
      const fullPhoneNumber = phoneNumber.trim() ? `${countryCode}${phoneNumber.replace(/\D/g, '')}` : undefined;
      const fullMobileNumber = mobileNumber.trim() ? `${mobileCountryCode}${mobileNumber.replace(/\D/g, '')}` : undefined;

      // Generate a JID from phone number (simplified - in production use server)
      const primaryNumber = fullPhoneNumber || fullMobileNumber || '';
      const jid = `${primaryNumber.replace(/\+/g, '')}@commeazy.app`;

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

      // Use emailOverride from reminder modal if provided, otherwise form value
      const finalEmail = emailOverride?.trim() || email.trim() || undefined;

      const contactData = {
        jid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: fullPhoneNumber,
        mobileNumber: fullMobileNumber,
        email: finalEmail,
        address,
        birthDate,
        weddingDate,
        deathDate,
        categories: selectedCategories.length > 0 ? JSON.stringify(selectedCategories) : undefined,
        publicKey: '', // Will be set when contact shares their key
        verified: false,
        lastSeen: Date.now(),
      };

      await ServiceContainer.database.saveContact(contactData);

      navigation.goBack();
    } catch (error) {
      console.error('Failed to save contact:', error);
      setNotification({ type: 'error', title: t('errors.genericTitle'), message: t('errors.genericError') });
    } finally {
      setSaving(false);
    }
  }, [countryCode, phoneNumber, mobileCountryCode, mobileNumber, firstName, lastName, email, street, postalCode, city, country, birthDate, weddingDate, deathDate, selectedCategories, navigation, t]);

  // Save handler: shows reminder modal if email is missing
  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;

    void triggerFeedback('tap');

    // If email is missing, show reminder modal
    if (!email.trim()) {
      setPendingReminderEmail('');
      setShowEmailReminder(true);
      return;
    }

    // Email present — save directly
    await performSave();
  }, [canSave, saving, email, triggerFeedback, performSave]);

  // Reminder modal: save with email added from modal
  const handleReminderSave = useCallback(async () => {
    setShowEmailReminder(false);
    await performSave(pendingReminderEmail);
  }, [pendingReminderEmail, performSave]);

  // Reminder modal: skip — save without email
  const handleReminderSkip = useCallback(async () => {
    setShowEmailReminder(false);
    await performSave();
  }, [performSave]);

  const toggleCountryCodes = useCallback(() => {
    void triggerFeedback('tap');
    setShowCountryCodes((prev) => !prev);
    setShowMobileCountryCodes(false);
  }, [triggerFeedback]);

  const selectCountryCode = useCallback((code: string) => {
    void triggerFeedback('tap');
    setField('countryCode', code);
    setShowCountryCodes(false);
  }, [triggerFeedback, setField]);

  const toggleMobileCountryCodes = useCallback(() => {
    void triggerFeedback('tap');
    setShowMobileCountryCodes((prev) => !prev);
    setShowCountryCodes(false);
  }, [triggerFeedback]);

  const selectMobileCountryCode = useCallback((code: string) => {
    void triggerFeedback('tap');
    setField('mobileCountryCode', code);
    setShowMobileCountryCodes(false);
  }, [triggerFeedback, setField]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ModuleScreenLayout
        moduleId="contacts"
        moduleBlock={
          <ModuleHeader
            moduleId="contacts"
            icon="contacts"
            title={t('contacts.add.manualTitle', 'Bekende toevoegen')}
            showGridButton={false}
            formMode={true}
            onCancel={handleCancel}
            onSave={() => void handleSave()}
            saveDisabled={!canSave || saving}
            skipSafeArea
          />
        }
        controlsBlock={<></>}
        contentBlock={
          <>
      {notification && (
        <ErrorView
          type={notification.type}
          title={notification.title}
          message={notification.message}
          autoDismiss={notification.type === 'success' || notification.type === 'info' ? 3000 : undefined}
          onDismiss={() => setNotification(null)}
        />
      )}

      <ScrollViewWithIndicator
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

        {/* Landline phone number input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t('contacts.landlineLabel')}</Text>
          <View style={styles.phoneInputContainer}>
            {/* Country code selector */}
            <HapticTouchable hapticDisabled
              style={[styles.countryCodeButton, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
              onPress={toggleCountryCodes}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.countryCode')}
              accessibilityHint={t('accessibility.selectCountryCode')}
            >
              <Text style={[styles.countryCodeText, { color: themeColors.textPrimary }]}>{countryCode}</Text>
              <Text style={[styles.dropdownIcon, { color: themeColors.textSecondary }]}>▼</Text>
            </HapticTouchable>

            {/* Landline number */}
            <TextInput
              style={[styles.phoneInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              placeholder={t('contacts.landlinePlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              value={phoneNumber}
              onChangeText={(v) => setField('phoneNumber', v)}
              keyboardType="phone-pad"
              returnKeyType="done"
              accessibilityLabel={t('contacts.landlineLabel')}
              accessibilityHint={t('accessibility.enterPhoneNumber')}
            />
          </View>

          {/* Country code dropdown */}
          {showCountryCodes && (
            <View style={[styles.countryCodeDropdown, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              {COUNTRY_CODES.map((item) => (
                <HapticTouchable hapticDisabled
                  key={item.code}
                  style={[styles.countryCodeOption, { borderBottomColor: themeColors.divider }]}
                  onPress={() => selectCountryCode(item.code)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.country} ${item.code}`}
                >
                  <Text style={[styles.countryCodeOptionText, { color: themeColors.textPrimary }]}>
                    {item.country} {item.code}
                  </Text>
                </HapticTouchable>
              ))}
            </View>
          )}
        </View>

        {/* Mobile phone number input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t('contacts.mobileLabel')}</Text>
          <View style={styles.phoneInputContainer}>
            {/* Country code selector */}
            <HapticTouchable hapticDisabled
              style={[styles.countryCodeButton, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
              onPress={toggleMobileCountryCodes}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.countryCode')}
              accessibilityHint={t('accessibility.selectCountryCode')}
            >
              <Text style={[styles.countryCodeText, { color: themeColors.textPrimary }]}>{mobileCountryCode}</Text>
              <Text style={[styles.dropdownIcon, { color: themeColors.textSecondary }]}>▼</Text>
            </HapticTouchable>

            {/* Mobile number */}
            <TextInput
              style={[styles.phoneInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              placeholder={t('contacts.mobilePlaceholder')}
              placeholderTextColor={themeColors.textTertiary}
              value={mobileNumber}
              onChangeText={(v) => setField('mobileNumber', v)}
              keyboardType="phone-pad"
              returnKeyType="done"
              accessibilityLabel={t('contacts.mobileLabel')}
              accessibilityHint={t('accessibility.enterMobileNumber')}
            />
          </View>

          {/* Mobile country code dropdown */}
          {showMobileCountryCodes && (
            <View style={[styles.countryCodeDropdown, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              {COUNTRY_CODES.map((item) => (
                <HapticTouchable hapticDisabled
                  key={item.code}
                  style={[styles.countryCodeOption, { borderBottomColor: themeColors.divider }]}
                  onPress={() => selectMobileCountryCode(item.code)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.country} ${item.code}`}
                >
                  <Text style={[styles.countryCodeOptionText, { color: themeColors.textPrimary }]}>
                    {item.country} {item.code}
                  </Text>
                </HapticTouchable>
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

        {/* Agenda categories section (required — min 1) */}
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
          {t('contacts.categories.title', 'Agenda categorieën')} *
        </Text>
        <Text style={[styles.categoriesHint, { color: selectedCategories.length === 0 ? themeColors.error : themeColors.textSecondary }]}>
          {t('contacts.categories.required', 'Kies minimaal één categorie')}
        </Text>
        <View style={styles.categoryGrid}>
          {allCategories.map(cat => {
            const isSelected = selectedCategories.includes(cat.id);
            return (
              <HapticTouchable
                key={cat.id}
                style={styles.categoryGridItem}
                onPress={() => handleToggleCategory(cat.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={cat.nameKey ? t(cat.nameKey) : ('name' in cat ? (cat as CustomCategory).name : cat.id)}
              >
                <View
                  style={[
                    styles.categoryCircle,
                    {
                      backgroundColor: isSelected ? themeColors.primary : themeColors.background,
                      borderColor: isSelected ? themeColors.primary : themeColors.border,
                    },
                  ]}
                >
                  <Text style={styles.categoryEmoji}>{cat.icon}</Text>
                </View>
                <Text
                  style={[
                    styles.categoryLabel,
                    { color: isSelected ? themeColors.primary : themeColors.textPrimary },
                  ]}
                  numberOfLines={2}
                >
                  {cat.nameKey ? t(cat.nameKey) : ('name' in cat ? (cat as CustomCategory).name : cat.id)}
                </Text>
              </HapticTouchable>
            );
          })}
        </View>

        {/* Hint text */}
        <Text style={[styles.hintText, { color: themeColors.textSecondary }]}>{t('contacts.addHint')}</Text>

        {/* Hint about trust level */}
        <Text style={[styles.hintNote, { color: themeColors.textTertiary }]}>
          {t('contacts.add.manualHint', 'Dit contact wordt opgeslagen zonder versleuteling. Nodig iemand uit voor beveiligde berichten.')}
        </Text>
      </ScrollViewWithIndicator>

            {/* Save-time reminder modal: prompts for missing email */}
            <PanelAwareModal
              visible={showEmailReminder}
              animationType="slide"
              presentationStyle="pageSheet"
              onRequestClose={() => setShowEmailReminder(false)}
            >
              <LiquidGlassView moduleId="contacts" style={[styles.reminderModal, { backgroundColor: themeColors.background }]}>
                <View style={[styles.reminderHeader, { paddingTop: insets.top + spacing.md }]}>
                  <Icon name="mail" size={40} color={themeColors.primary} />
                  <Text style={[styles.reminderTitle, { color: themeColors.textPrimary }]}>
                    {t('contacts.emailReminder.title', 'E-mailadres aanvullen?')}
                  </Text>
                  <Text style={[styles.reminderSubtitle, { color: themeColors.textSecondary }]}>
                    {t('contacts.emailReminder.subtitle', 'Zonder e-mailadres kan dit contact geen groepsberichten via e-mail ontvangen.')}
                  </Text>
                </View>

                <View style={styles.reminderContent}>
                  <Text style={[styles.reminderLabel, { color: themeColors.textPrimary }]}>
                    {t('contacts.emailLabel')}
                  </Text>
                  <TextInput
                    style={[styles.reminderInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                    placeholder={t('contacts.emailPlaceholder')}
                    placeholderTextColor={themeColors.textTertiary}
                    value={pendingReminderEmail}
                    onChangeText={setPendingReminderEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    accessibilityLabel={t('contacts.emailLabel')}
                  />
                </View>

                <View style={[styles.reminderActions, { paddingBottom: insets.bottom + spacing.md }]}>
                  <HapticTouchable
                    style={[styles.reminderButton, styles.reminderSkipButton, { borderColor: themeColors.border }]}
                    onPress={() => void handleReminderSkip()}
                    accessibilityRole="button"
                    accessibilityLabel={t('contacts.emailReminder.skip', 'Overslaan')}
                  >
                    <Text style={[styles.reminderButtonText, { color: themeColors.textSecondary }]}>
                      {t('contacts.emailReminder.skip', 'Overslaan')}
                    </Text>
                  </HapticTouchable>

                  <HapticTouchable
                    style={[styles.reminderButton, { backgroundColor: pendingReminderEmail.trim() ? themeColors.primary : themeColors.border }]}
                    onPress={() => void handleReminderSave()}
                    disabled={!pendingReminderEmail.trim()}
                    accessibilityRole="button"
                    accessibilityLabel={t('contacts.emailReminder.save', 'Opslaan')}
                    accessibilityState={{ disabled: !pendingReminderEmail.trim() }}
                  >
                    <Text style={[styles.reminderButtonText, { color: pendingReminderEmail.trim() ? themeColors.textOnPrimary : themeColors.textTertiary }]}>
                      {t('contacts.emailReminder.save', 'Opslaan')}
                    </Text>
                  </HapticTouchable>
                </View>
              </LiquidGlassView>
            </PanelAwareModal>
          </>
        }
      />
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
  hintNote: {
    ...typography.label,
    textAlign: 'center',
    marginTop: spacing.lg,
    fontStyle: 'italic',
  },
  // Category grid
  categoriesHint: {
    ...typography.label,
    marginBottom: spacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  categoryGridItem: {
    flexBasis: '30%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  categoryCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  categoryEmoji: {
    fontSize: 24,
  },
  categoryLabel: {
    ...typography.label,
    textAlign: 'center',
    fontWeight: '600',
  },
  // Email reminder modal
  reminderModal: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  reminderHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  reminderTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  reminderSubtitle: {
    ...typography.body,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  reminderContent: {
    marginBottom: spacing.xl,
  },
  reminderLabel: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  reminderInput: {
    ...typography.input,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
    borderWidth: 1,
  },
  reminderActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  reminderButton: {
    flex: 1,
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderSkipButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  reminderButtonText: {
    ...typography.button,
  },
});
