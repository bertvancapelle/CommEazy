/**
 * ProfileStep1Screen — "Wie ben je?"
 *
 * Collects: firstName*, lastName*, gender*, birthDate*, weddingDate (optional)
 * Saves firstName/lastName to profile immediately so downstream screens can use it.
 *
 * Part of the 3-step onboarding profile wizard:
 *   PinSetup → ProfileStep1 → ProfileStep2 → ProfileStep3 → NavigationTutorial
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useLabelStyle, useFieldTextStyle } from '@/contexts/FieldTextStyleContext';
import { Button, TextInput, ProgressIndicator, ErrorView, HapticTouchable, ScrollViewWithIndicator, DateTimePickerModal, Icon } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import { useScrollToField } from '@/hooks/useScrollToField';
import { ServiceContainer } from '@/services/container';
import type { OnboardingStackParams } from '@/navigation';
import type { Gender } from '@/services/interfaces';

type Props = NativeStackScreenProps<OnboardingStackParams, 'ProfileStep1'>;

const GENDER_OPTIONS: { value: Gender; labelKey: string }[] = [
  { value: 'male', labelKey: 'demographics.gender.male' },
  { value: 'female', labelKey: 'demographics.gender.female' },
  { value: 'other', labelKey: 'demographics.gender.other' },
];

export function ProfileStep1Screen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const labelStyle = useLabelStyle();
  const fieldTextStyle = useFieldTextStyle();
  const { triggerFeedback } = useFeedback();
  const { scrollRef, registerField, scrollToField, getFieldFocusHandler, handleScroll: handleScrollToField } = useScrollToField();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<Gender | undefined>();
  const [birthDate, setBirthDate] = useState<string | undefined>();
  const [weddingDate, setWeddingDate] = useState<string | undefined>();
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [showWeddingDatePicker, setShowWeddingDatePicker] = useState(false);

  // Locale mapping for native date picker
  const pickerLocale = useMemo(() => {
    const lang = i18n.language;
    const map: Record<string, string> = {
      nl: 'nl-NL', en: 'en-US', 'en-GB': 'en-GB', de: 'de-DE',
      fr: 'fr-FR', es: 'es-ES', it: 'it-IT', no: 'nb-NO',
      sv: 'sv-SE', da: 'da-DK', pt: 'pt-PT', 'pt-BR': 'pt-BR', pl: 'pl-PL',
    };
    return map[lang] || 'en-US';
  }, [i18n.language]);

  const formatDateDisplay = useCallback((isoDate: string | undefined): string => {
    if (!isoDate) return '-';
    const d = new Date(isoDate + 'T00:00:00');
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(pickerLocale, { day: 'numeric', month: 'long', year: 'numeric' });
  }, [pickerLocale]);

  const parseDateValue = useCallback((isoDate: string | undefined): Date => {
    if (!isoDate) return new Date();
    const d = new Date(isoDate + 'T00:00:00');
    return isNaN(d.getTime()) ? new Date() : d;
  }, []);

  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
  } | null>(null);

  // Validation: tracks which required field is currently invalid (light-red highlight)
  const [invalidField, setInvalidField] = useState<string | null>(null);

  const lastNameRef = useRef<RNTextInput>(null);

  const isValid = Boolean(
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 1 &&
    gender &&
    birthDate,
  );

  const handleContinue = useCallback(async () => {
    void triggerFeedback('tap');
    Keyboard.dismiss();

    // Validate required fields — scroll to first empty field + highlight
    const requiredFields: { key: string; value: string | undefined }[] = [
      { key: 'firstName', value: firstName.trim().length >= 2 ? firstName.trim() : undefined },
      { key: 'lastName', value: lastName.trim().length >= 1 ? lastName.trim() : undefined },
      { key: 'gender', value: gender },
      { key: 'birthDate', value: birthDate },
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
      // Save name, gender, dates to profile
      const profile = await ServiceContainer.database.getUserProfile();
      if (profile) {
        await ServiceContainer.database.saveUserProfile({
          ...profile,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          gender,
          birthDate,
          weddingDate,
        });
      }

      navigation.navigate('ProfileStep2');
    } catch (error) {
      console.error('[ProfileStep1] Save failed:', (error as Error).message);
      setNotification({
        type: 'error',
        title: t('errors.genericTitle'),
        message: t('errors.genericError'),
      });
    } finally {
      setIsSaving(false);
    }
  }, [firstName, lastName, gender, birthDate, weddingDate, isValid, navigation, scrollToField, t, triggerFeedback]);

  // Clear validation highlight reactively when the invalid field is filled
  useEffect(() => {
    if (!invalidField) return;
    const fieldValues: Record<string, string | undefined> = {
      firstName: firstName.trim().length >= 2 ? firstName.trim() : undefined,
      lastName: lastName.trim().length >= 1 ? lastName.trim() : undefined,
      gender,
      birthDate,
    };
    if (fieldValues[invalidField]) {
      setInvalidField(null);
    }
  }, [invalidField, firstName, lastName, gender, birthDate]);

  // Red asterisk for required fields
  const requiredMark = <Text style={{ color: '#D32F2F', fontWeight: '700' }}> *</Text>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ProgressIndicator currentStep={4} totalSteps={8} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
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
            {t('onboarding.profileStep1.title')}
          </Text>
          <Text style={[styles.hint, { color: themeColors.textSecondary }]}>
            {t('onboarding.profileStep1.hint')}
          </Text>

          {notification && (
            <ErrorView
              type={notification.type}
              title={notification.title}
              message={notification.message}
              onDismiss={() => setNotification(null)}
            />
          )}

          {/* First name */}
          <View style={[invalidField === 'firstName' && styles.invalidFieldHighlight]} ref={registerField('firstName')}>
            <TextInput
              label={<Text>{t('onboarding.firstName')}{requiredMark}</Text>}
              value={firstName}
              onChangeText={setFirstName}
              placeholder={t('onboarding.firstNamePlaceholder')}
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => lastNameRef.current?.focus()}
              onFocus={getFieldFocusHandler('firstName')}
              accessibilityLabel={t('onboarding.firstName')}
            />
          </View>

          {/* Last name */}
          <View style={[invalidField === 'lastName' && styles.invalidFieldHighlight]} ref={registerField('lastName')}>
            <TextInput
              ref={lastNameRef}
              label={<Text>{t('onboarding.lastName')}{requiredMark}</Text>}
              value={lastName}
              onChangeText={setLastName}
              placeholder={t('onboarding.lastNamePlaceholder')}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onFocus={getFieldFocusHandler('lastName')}
              accessibilityLabel={t('onboarding.lastName')}
            />
          </View>

          {/* Gender */}
          <View style={[styles.inputGroup, invalidField === 'gender' && styles.invalidFieldHighlight]} ref={registerField('gender')}>
            <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
              {t('demographics.genderLabel')}{requiredMark}
            </Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map((option) => {
                const isSelected = gender === option.value;
                return (
                  <HapticTouchable
                    key={option.value}
                    onPress={() => setGender(option.value)}
                    style={[
                      styles.genderOption,
                      {
                        backgroundColor: isSelected ? themeColors.primary : themeColors.surface,
                        borderColor: isSelected ? themeColors.primary : themeColors.border,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityLabel={t(option.labelKey)}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.genderText,
                        { color: isSelected ? themeColors.textOnPrimary : themeColors.textPrimary },
                      ]}
                    >
                      {t(option.labelKey)}
                    </Text>
                  </HapticTouchable>
                );
              })}
            </View>
          </View>

          {/* Birth date */}
          <View ref={registerField('birthDate')} style={[styles.inputGroup, invalidField === 'birthDate' && styles.invalidFieldHighlight]}>
            <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
              {t('onboarding.personalDetails.birthDate')}{requiredMark}
            </Text>
            <HapticTouchable hapticDisabled
              style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowBirthDatePicker(true), 100); }}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.personalDetails.birthDate')}
            >
              <Text style={[styles.pickerValue, birthDate ? { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle } : { color: themeColors.textTertiary }]}>
                {formatDateDisplay(birthDate)}
              </Text>
              <Icon name="chevron-right" size={20} color={themeColors.textTertiary} />
            </HapticTouchable>
          </View>

          {/* Wedding date (optional) */}
          <View ref={registerField('weddingDate')} style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
              {t('onboarding.personalDetails.weddingDate')}
            </Text>
            <HapticTouchable hapticDisabled
              style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowWeddingDatePicker(true), 100); }}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.personalDetails.weddingDate')}
            >
              <Text style={[styles.pickerValue, weddingDate ? { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle } : { color: themeColors.textTertiary }]}>
                {formatDateDisplay(weddingDate)}
              </Text>
              <Icon name="chevron-right" size={20} color={themeColors.textTertiary} />
            </HapticTouchable>
            <Text style={[styles.optionalHint, { color: themeColors.textTertiary }]}>
              {t('common.optional')}
            </Text>
          </View>

          {/* Extra bottom padding */}
          <View style={{ height: spacing.xxl }} />
        </ScrollViewWithIndicator>

        {/* Date picker modals — MUST be outside ScrollView for correct rendering */}
        <DateTimePickerModal
          visible={showBirthDatePicker}
          title={t('onboarding.personalDetails.birthDate')}
          value={parseDateValue(birthDate)}
          mode="date"
          moduleId="settings"
          onChange={(_event, selectedDate) => {
            if (selectedDate) {
              // Use local date components to avoid UTC timezone shift
              const y = selectedDate.getFullYear();
              const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const d = String(selectedDate.getDate()).padStart(2, '0');
              setBirthDate(`${y}-${m}-${d}`);
            }
          }}
          onClose={() => {
            setShowBirthDatePicker(false);
            scrollToField('birthDate', { isModalReturn: true });
          }}
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
          locale={pickerLocale}
        />

        <DateTimePickerModal
          visible={showWeddingDatePicker}
          title={t('onboarding.personalDetails.weddingDate')}
          value={parseDateValue(weddingDate)}
          mode="date"
          moduleId="settings"
          onChange={(_event, selectedDate) => {
            if (selectedDate) {
              // Use local date components to avoid UTC timezone shift
              const y = selectedDate.getFullYear();
              const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const d = String(selectedDate.getDate()).padStart(2, '0');
              setWeddingDate(`${y}-${m}-${d}`);
            }
          }}
          onClose={() => {
            setShowWeddingDatePicker(false);
            scrollToField('weddingDate', { isModalReturn: true });
          }}
          maximumDate={new Date(new Date().getFullYear() + 5, 11, 31)}
          minimumDate={new Date(1940, 0, 1)}
          locale={pickerLocale}
        />

        <View style={styles.footer}>
          <Button
            title={t('onboarding.continue')}
            onPress={handleContinue}
            disabled={!isValid || isSaving}
            loading={isSaving}
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
  fieldLabel: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  genderRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  genderOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    borderWidth: 2,
  },
  genderText: {
    ...typography.body,
    fontWeight: '600',
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
  optionalHint: {
    ...typography.small,
    marginTop: spacing.xs,
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
