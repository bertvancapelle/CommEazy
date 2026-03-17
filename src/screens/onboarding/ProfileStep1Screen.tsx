/**
 * ProfileStep1Screen — "Wie ben je?"
 *
 * Collects: firstName*, lastName*, gender*, birthDate*, weddingDate (optional)
 * Saves firstName/lastName to profile immediately so downstream screens can use it.
 *
 * Part of the 3-step onboarding profile wizard:
 *   PinSetup → ProfileStep1 → ProfileStep2 → ProfileStep3 → NavigationTutorial
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
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
import { Button, TextInput, ProgressIndicator, ErrorView, HapticTouchable, ScrollViewWithIndicator, DateTimePickerModal } from '@/components';
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

  const lastNameRef = useRef<RNTextInput>(null);

  const isValid = Boolean(
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 1 &&
    gender &&
    birthDate,
  );

  const handleContinue = useCallback(async () => {
    void triggerFeedback('tap');

    if (!isValid) {
      setNotification({
        type: 'warning',
        title: t('onboarding.profileStep1.incompleteTitle'),
        message: t('onboarding.profileStep1.incompleteMessage'),
      });
      return;
    }

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
  }, [firstName, lastName, gender, birthDate, weddingDate, isValid, navigation, t, triggerFeedback]);

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
          <View ref={registerField('firstName')}>
            <TextInput
              label={t('onboarding.firstName')}
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
          <View ref={registerField('lastName')}>
            <TextInput
              ref={lastNameRef}
              label={t('onboarding.lastName')}
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
          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
              {t('demographics.genderLabel')}
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
          <View ref={registerField('birthDate')} style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
              {t('onboarding.personalDetails.birthDate')}
            </Text>
            <HapticTouchable hapticDisabled
              style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              onPress={() => setShowBirthDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.personalDetails.birthDate')}
            >
              <Text style={[styles.pickerValue, birthDate ? { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle } : { color: themeColors.textTertiary }]}>
                {formatDateDisplay(birthDate)}
              </Text>
              <Text style={styles.editIcon}>✏️</Text>
            </HapticTouchable>
          </View>

          {/* Wedding date (optional) */}
          <View ref={registerField('weddingDate')} style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
              {t('onboarding.personalDetails.weddingDate')}
            </Text>
            <HapticTouchable hapticDisabled
              style={[styles.pickerRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              onPress={() => setShowWeddingDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.personalDetails.weddingDate')}
            >
              <Text style={[styles.pickerValue, weddingDate ? { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle } : { color: themeColors.textTertiary }]}>
                {formatDateDisplay(weddingDate)}
              </Text>
              <Text style={styles.editIcon}>✏️</Text>
            </HapticTouchable>
            <Text style={[styles.optionalHint, { color: themeColors.textTertiary }]}>
              {t('common.optional')}
            </Text>
          </View>

          {/* Date picker modals */}
          <DateTimePickerModal
            visible={showBirthDatePicker}
            title={t('onboarding.personalDetails.birthDate')}
            value={parseDateValue(birthDate)}
            mode="date"
            moduleId="settings"
            onChange={(_event, selectedDate) => {
              if (selectedDate) {
                setBirthDate(selectedDate.toISOString().split('T')[0]);
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
                setWeddingDate(selectedDate.toISOString().split('T')[0]);
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
  editIcon: {
    fontSize: 18,
    marginLeft: spacing.sm,
  },
  optionalHint: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
