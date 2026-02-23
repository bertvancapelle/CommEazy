/**
 * PIN Setup Screen
 *
 * User creates a 6-digit PIN for backup encryption.
 * Large keypad, senior-friendly.
 *
 * Senior-inclusive improvements:
 * - Button always visible during create step
 * - Auto-verify on last digit during confirm step
 * - Show digits (not dots) on mismatch error
 * - Digits briefly visible when typing
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { typography, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { Button, ProgressIndicator, PinInput } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import type { OnboardingStackParams } from '@/navigation';

type Props = NativeStackScreenProps<OnboardingStackParams, 'PinSetup'>;

type PinStep = 'create' | 'confirm';

export function PinSetupScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();
  const { name } = route.params;
  const [step, setStep] = useState<PinStep>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDigitsOnError, setShowDigitsOnError] = useState(false);
  const [clearCounter, setClearCounter] = useState(0);
  const isVerifyingRef = useRef(false);

  const currentPin = step === 'create' ? pin : confirmPin;
  const isComplete = currentPin.length === 6;

  // Auto-verify when confirm PIN is complete
  useEffect(() => {
    if (step === 'confirm' && confirmPin.length === 6 && !isVerifyingRef.current) {
      isVerifyingRef.current = true;
      verifyAndComplete();
    }
  }, [confirmPin, step]);

  const handlePinChange = (value: string) => {
    setError(null);
    setShowDigitsOnError(false);

    if (step === 'create') {
      setPin(value);
      // Dismiss keyboard when 6 digits entered so button is visible
      if (value.length === 6) {
        Keyboard.dismiss();
      }
    } else {
      setConfirmPin(value);
    }
  };

  const verifyAndComplete = async () => {
    Keyboard.dismiss();

    // Check if PINs match
    if (pin !== confirmPin) {
      setError(t('onboarding.pinMismatch'));
      setShowDigitsOnError(true);
      isVerifyingRef.current = false;
      // Don't clear confirmPin - show the digits so user can see the mismatch
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Store PIN securely for backup encryption
      await new Promise(resolve => setTimeout(resolve, 500));
      // Navigate to Demographics (required for free users)
      navigation.navigate('Demographics', { name });
    } catch (err) {
      setError(t('errors.genericError'));
      isVerifyingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    void triggerFeedback('tap');
    Keyboard.dismiss();

    if (step === 'create') {
      // Move to confirm step
      setStep('confirm');
      setConfirmPin('');
      setError(null);
      setShowDigitsOnError(false);
      isVerifyingRef.current = false;
      return;
    }

    // In confirm step, if button is pressed (shouldn't happen normally
    // since auto-verify triggers, but handle it anyway)
    if (!isVerifyingRef.current) {
      isVerifyingRef.current = true;
      await verifyAndComplete();
    }
  };

  const handleBack = () => {
    void triggerFeedback('tap');
    if (step === 'confirm') {
      setStep('create');
      setConfirmPin('');
      setError(null);
      setShowDigitsOnError(false);
      isVerifyingRef.current = false;
    } else {
      navigation.goBack();
    }
  };

  const handleClear = () => {
    void triggerFeedback('tap');
    if (step === 'create') {
      setPin('');
    } else {
      setConfirmPin('');
    }
    setError(null);
    setShowDigitsOnError(false);
    setClearCounter(c => c + 1);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.inner}>
          <ProgressIndicator currentStep={4} totalSteps={6} />

          <View style={styles.content}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {step === 'create' ? t('onboarding.createPin') : t('onboarding.confirmPin')}
            </Text>
            <Text style={[styles.hint, { color: themeColors.textSecondary }]}>{t('onboarding.pinHint')}</Text>

            <View style={styles.pinContainer}>
              <PinInput
                key={`${step}-${clearCounter}`}
                value={currentPin}
                onChange={handlePinChange}
                length={6}
                error={Boolean(error)}
                showAllDigits={showDigitsOnError}
                autoFocus={true}
                accessibilityLabel={
                  step === 'create' ? t('onboarding.createPin') : t('onboarding.confirmPin')
                }
              />
            </View>

            {currentPin.length > 0 && (
              <Button
                title={t('onboarding.clearPin')}
                onPress={handleClear}
                variant="text"
                style={styles.clearButton}
              />
            )}

            {error && (
              <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
            )}

            {step === 'create' && (
              <Text style={[styles.warningText, { color: themeColors.textSecondary }]}>{t('onboarding.pinWarning')}</Text>
            )}
          </View>

          <View style={[styles.footer, { backgroundColor: themeColors.background }]}>
            {step === 'confirm' && (
              <Button
                title={t('accessibility.backButton')}
                onPress={handleBack}
                variant="text"
                style={styles.backButton}
              />
            )}

            {/* Always show button in create step; hide in confirm step (auto-verify) unless error */}
            {(step === 'create' || error) && (
              <Button
                title={step === 'create' ? t('onboarding.continue') : t('errors.tryAgain')}
                onPress={step === 'create' ? handleContinue : handleBack}
                disabled={step === 'create' && !isComplete}
                loading={isLoading}
              />
            )}

            {step === 'confirm' && !error && (
              <View style={styles.autoVerifyHint}>
                <Text style={[styles.autoVerifyText, { color: themeColors.textSecondary }]}>
                  {isLoading ? t('common.loading') : ''}
                </Text>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  hint: {
    ...typography.body,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  pinContainer: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  clearButton: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  warningText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  autoVerifyHint: {
    height: 56, // Same height as button to prevent layout shift
    justifyContent: 'center',
    alignItems: 'center',
  },
  autoVerifyText: {
    ...typography.body,
  },
});
