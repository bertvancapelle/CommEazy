/**
 * Phone Verification Screen
 *
 * Phone number input + SMS code verification.
 * Senior-friendly: large inputs, no timeout, voice call fallback.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing } from '@/theme';
import { Button, TextInput, ProgressIndicator, PinInput } from '@/components';
import type { OnboardingStackParams } from '@/navigation';

type Props = NativeStackScreenProps<OnboardingStackParams, 'PhoneVerification'>;

type VerificationStep = 'phone' | 'code';

export function PhoneVerificationScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<VerificationStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+31');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneInputRef = useRef<RNTextInput>(null);

  const handleSendCode = async () => {
    setError(null);
    setIsLoading(true);

    try {
      // TODO: Integrate Firebase Auth
      // await auth().signInWithPhoneNumber(`${countryCode}${phoneNumber}`);

      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      setStep('code');
    } catch (err) {
      setError(t('errors.E500'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError(null);
    setIsLoading(true);

    try {
      // TODO: Integrate Firebase Auth verification
      // await confirmationResult.confirm(verificationCode);

      // Simulate verification for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      navigation.navigate('NameInput');
    } catch (err) {
      setError(t('errors.E500'));
      setVerificationCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setVerificationCode('');
    await handleSendCode();
  };

  const handleRequestVoiceCall = async () => {
    setError(null);
    setIsLoading(true);

    try {
      // TODO: Implement voice call fallback
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      setError(t('errors.genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  const isPhoneValid = phoneNumber.length >= 9;
  const isCodeComplete = verificationCode.length === 6;

  return (
    <SafeAreaView style={styles.container}>
      <ProgressIndicator currentStep={2} totalSteps={5} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'phone' ? (
            <View style={styles.content}>
              <Text style={styles.title}>{t('onboarding.phoneNumber')}</Text>
              <Text style={styles.hint}>{t('onboarding.phoneHint')}</Text>

              <View style={styles.phoneInputContainer}>
                <TextInput
                  value={countryCode}
                  onChangeText={setCountryCode}
                  keyboardType="phone-pad"
                  containerStyle={styles.countryCodeInput}
                  accessibilityLabel={t('accessibility.countryCode')}
                />
                <TextInput
                  ref={phoneInputRef}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  placeholder="6 12345678"
                  containerStyle={styles.phoneNumberInput}
                  autoFocus
                  accessibilityLabel={t('onboarding.phoneNumber')}
                  error={error ?? undefined}
                />
              </View>
            </View>
          ) : (
            <View style={styles.content}>
              <Text style={styles.title}>{t('onboarding.verifyCode')}</Text>
              <Text style={styles.hint}>
                {t('onboarding.codeSent', { phone: `${countryCode} ${phoneNumber}` })}
              </Text>

              <PinInput
                value={verificationCode}
                onChange={setVerificationCode}
                length={6}
                error={Boolean(error)}
                secureTextEntry={false}
                accessibilityLabel={t('onboarding.verifyCode')}
              />

              {error && (
                <Text style={styles.errorText}>{error}</Text>
              )}

              <View style={styles.fallbackContainer}>
                <Button
                  title={t('onboarding.resendCode')}
                  onPress={handleResendCode}
                  variant="text"
                  disabled={isLoading}
                />
                <Button
                  title={t('onboarding.voiceCallFallback')}
                  onPress={handleRequestVoiceCall}
                  variant="text"
                  disabled={isLoading}
                />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={t('onboarding.continue')}
            onPress={step === 'phone' ? handleSendCode : handleVerifyCode}
            disabled={step === 'phone' ? !isPhoneValid : !isCodeComplete}
            loading={isLoading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  countryCodeInput: {
    width: 80,
  },
  phoneNumberInput: {
    flex: 1,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  fallbackContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
