/**
 * ProfileStep1Screen — "Wie ben je?"
 *
 * Collects: firstName*, lastName*, gender*, birthDate*, weddingDate (optional)
 * Saves firstName/lastName to profile immediately so downstream screens can use it.
 *
 * Part of the 3-step onboarding profile wizard:
 *   PinSetup → ProfileStep1 → ProfileStep2 → ProfileStep3 → NavigationTutorial
 */

import React, { useState, useRef, useCallback } from 'react';
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

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { Button, TextInput, ProgressIndicator, ErrorView, HapticTouchable, ScrollViewWithIndicator } from '@/components';
import { SeniorDatePicker } from '@/components/SeniorDatePicker';
import { useFeedback } from '@/hooks/useFeedback';
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
  const { t } = useTranslation();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<Gender | undefined>();
  const [birthDate, setBirthDate] = useState<string | undefined>();
  const [weddingDate, setWeddingDate] = useState<string | undefined>();

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
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
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
            accessibilityLabel={t('onboarding.firstName')}
          />

          {/* Last name */}
          <TextInput
            ref={lastNameRef}
            label={t('onboarding.lastName')}
            value={lastName}
            onChangeText={setLastName}
            placeholder={t('onboarding.lastNamePlaceholder')}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel={t('onboarding.lastName')}
          />

          {/* Gender */}
          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
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
          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
              {t('onboarding.personalDetails.birthDate')}
            </Text>
            <SeniorDatePicker
              value={birthDate}
              onChange={setBirthDate}
              accessibilityLabel={t('onboarding.personalDetails.birthDate')}
              minYear={1900}
              allowClear={false}
            />
          </View>

          {/* Wedding date (optional) */}
          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
              {t('onboarding.personalDetails.weddingDate')}
            </Text>
            <SeniorDatePicker
              value={weddingDate}
              onChange={setWeddingDate}
              accessibilityLabel={t('onboarding.personalDetails.weddingDate')}
              minYear={1940}
            />
            <Text style={[styles.optionalHint, { color: themeColors.textTertiary }]}>
              {t('common.optional')}
            </Text>
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
  optionalHint: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
