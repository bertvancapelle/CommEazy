/**
 * ProfileStep3Screen — "Hoe bereiken we je?"
 *
 * Collects: landline (optional), mobile (optional), email (optional)
 * All fields are optional — this step can be skipped entirely.
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
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useLabelStyle, useFieldTextStyle } from '@/contexts/FieldTextStyleContext';
import { Button, TextInput, ProgressIndicator, ErrorView, HapticTouchable, ScrollViewWithIndicator, Icon } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import { ServiceContainer } from '@/services/container';
import type { OnboardingStackParams } from '@/navigation';

type Props = NativeStackScreenProps<OnboardingStackParams, 'ProfileStep3'>;

const COUNTRY_CODES = [
  { code: '+31', country: 'NL' },
  { code: '+32', country: 'BE' },
  { code: '+49', country: 'DE' },
  { code: '+33', country: 'FR' },
  { code: '+34', country: 'ES' },
  { code: '+44', country: 'UK' },
  { code: '+1', country: 'US' },
];

export function ProfileStep3Screen({ navigation }: Props) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const labelStyle = useLabelStyle();
  const fieldTextStyle = useFieldTextStyle();
  const { triggerFeedback } = useFeedback();

  const [landlineNumber, setLandlineNumber] = useState('');
  const [landlineCountryCode, setLandlineCountryCode] = useState('+31');
  const [mobileNumber, setMobileNumber] = useState('');
  const [mobileCountryCode, setMobileCountryCode] = useState('+31');
  const [email, setEmail] = useState('');

  const [showLandlineCountryCodes, setShowLandlineCountryCodes] = useState(false);
  const [showMobileCountryCodes, setShowMobileCountryCodes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
  } | null>(null);

  const mobileRef = useRef<RNTextInput>(null);
  const emailRef = useRef<RNTextInput>(null);

  const handleContinue = useCallback(async () => {
    void triggerFeedback('tap');

    setIsSaving(true);
    try {
      const profile = await ServiceContainer.database.getUserProfile();
      if (profile) {
        const fullLandline = landlineNumber.trim()
          ? `${landlineCountryCode}${landlineNumber.replace(/\D/g, '')}`
          : undefined;
        const fullMobile = mobileNumber.trim()
          ? `${mobileCountryCode}${mobileNumber.replace(/\D/g, '')}`
          : undefined;

        await ServiceContainer.database.saveUserProfile({
          ...profile,
          landlineNumber: fullLandline,
          mobileNumber: fullMobile,
          email: email.trim() || undefined,
        });
      }

      navigation.navigate('NavigationTutorial');
    } catch (error) {
      console.error('[ProfileStep3] Save failed:', (error as Error).message);
      setNotification({
        type: 'error',
        title: t('errors.genericTitle'),
        message: t('errors.genericError'),
      });
    } finally {
      setIsSaving(false);
    }
  }, [landlineNumber, landlineCountryCode, mobileNumber, mobileCountryCode, email, navigation, t, triggerFeedback]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ProgressIndicator currentStep={6} totalSteps={8} />

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
            {t('onboarding.profileStep3.title')}
          </Text>
          <Text style={[styles.hint, { color: themeColors.textSecondary }]}>
            {t('onboarding.profileStep3.hint')}
          </Text>
          <Text style={[styles.optionalNote, { color: themeColors.textTertiary }]}>
            {t('onboarding.profileStep3.allOptional')}
          </Text>

          {notification && (
            <ErrorView
              type={notification.type}
              title={notification.title}
              message={notification.message}
              onDismiss={() => setNotification(null)}
            />
          )}

          {/* Landline */}
          <View style={styles.phoneRow}>
            <View style={styles.countryCodeWrapper}>
              <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
                {t('onboarding.personalDetails.landlineCountryCode')}
              </Text>
              <HapticTouchable
                onPress={() => setShowLandlineCountryCodes(!showLandlineCountryCodes)}
                style={[styles.countryCodeButton, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
                accessibilityLabel={t('accessibility.countryCode')}
              >
                <Text style={[styles.countryCodeText, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}>{landlineCountryCode}</Text>
                <Icon name="chevron-down" size={16} color={themeColors.textSecondary} />
              </HapticTouchable>
              {showLandlineCountryCodes && (
                <View style={[styles.countryCodeDropdown, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                  {COUNTRY_CODES.map((item) => (
                    <HapticTouchable
                      key={item.code}
                      style={[styles.countryCodeOption, { borderBottomColor: themeColors.divider }]}
                      onPress={() => {
                        setLandlineCountryCode(item.code);
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
                label={t('onboarding.personalDetails.landlineNumber')}
                value={landlineNumber}
                onChangeText={setLandlineNumber}
                placeholder={t('onboarding.personalDetails.landlinePlaceholder')}
                hint={t('common.optional')}
                keyboardType="phone-pad"
                returnKeyType="next"
                onSubmitEditing={() => mobileRef.current?.focus()}
                accessibilityLabel={t('onboarding.personalDetails.landlineNumber')}
              />
            </View>
          </View>

          {/* Mobile */}
          <View style={styles.phoneRow}>
            <View style={styles.countryCodeWrapper}>
              <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
                {t('onboarding.personalDetails.mobileCountryCode')}
              </Text>
              <HapticTouchable
                onPress={() => setShowMobileCountryCodes(!showMobileCountryCodes)}
                style={[styles.countryCodeButton, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
                accessibilityLabel={t('accessibility.countryCode')}
              >
                <Text style={[styles.countryCodeText, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}>{mobileCountryCode}</Text>
                <Icon name="chevron-down" size={16} color={themeColors.textSecondary} />
              </HapticTouchable>
              {showMobileCountryCodes && (
                <View style={[styles.countryCodeDropdown, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                  {COUNTRY_CODES.map((item) => (
                    <HapticTouchable
                      key={item.code}
                      style={[styles.countryCodeOption, { borderBottomColor: themeColors.divider }]}
                      onPress={() => {
                        setMobileCountryCode(item.code);
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
                value={mobileNumber}
                onChangeText={setMobileNumber}
                placeholder={t('onboarding.personalDetails.mobilePlaceholder')}
                hint={t('common.optional')}
                keyboardType="phone-pad"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                accessibilityLabel={t('onboarding.personalDetails.mobileNumber')}
              />
            </View>
          </View>

          {/* Email */}
          <TextInput
            ref={emailRef}
            label={t('onboarding.personalDetails.email')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('onboarding.personalDetails.emailPlaceholder')}
            hint={t('common.optional')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel={t('onboarding.personalDetails.email')}
          />

          {/* Privacy note */}
          <View style={[styles.privacyNote, { backgroundColor: themeColors.backgroundSecondary }]}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <Text style={[styles.privacyText, { color: themeColors.textSecondary }]}>
              {t('onboarding.profileStep3.privacyNote')}
            </Text>
          </View>

          {/* Extra bottom padding */}
          <View style={{ height: spacing.xxl }} />
        </ScrollViewWithIndicator>

        <View style={styles.footer}>
          <Button
            title={t('onboarding.continue')}
            onPress={handleContinue}
            loading={isSaving}
          />
          <Button
            title={t('onboarding.profileStep3.skipButton')}
            onPress={() => navigation.navigate('NavigationTutorial')}
            variant="text"
            style={styles.skipButton}
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
    marginBottom: spacing.xs,
  },
  optionalNote: {
    ...typography.small,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
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
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    flex: 1,
  },
  skipButton: {
    marginTop: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
