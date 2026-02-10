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
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
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
  const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);

  const phoneInputRef = useRef<RNTextInput>(null);

  const handleSendCode = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const fullPhoneNumber = `${countryCode}${phoneNumber}`;
      const confirmationResult = await auth().signInWithPhoneNumber(fullPhoneNumber);
      setConfirmation(confirmationResult);
      setStep('code');
    } catch (err: any) {
      console.log('Firebase phone auth error:', err.code, err.message);
      if (err.code === 'auth/invalid-phone-number') {
        setError(t('errors.invalidPhone'));
      } else if (err.code === 'auth/too-many-requests') {
        setError(t('errors.tooManyRequests'));
      } else {
        setError(t('errors.E500'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (!confirmation) {
        throw new Error('No confirmation result');
      }
      await confirmation.confirm(verificationCode);
      navigation.navigate('NameInput');
    } catch (err: any) {
      console.log('Firebase verify error:', err.code, err.message);
      if (err.code === 'auth/invalid-verification-code') {
        setError(t('errors.invalidCode'));
      } else {
        setError(t('errors.E500'));
      }
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
