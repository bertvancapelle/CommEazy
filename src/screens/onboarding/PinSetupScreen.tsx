/**
 * PIN Setup Screen
 *
 * User creates a 6-digit PIN for backup encryption.
 * Large keypad, senior-friendly.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing } from '@/theme';
import { Button, ProgressIndicator, PinInput } from '@/components';
import type { OnboardingStackParams } from '@/navigation';

type Props = NativeStackScreenProps<OnboardingStackParams, 'PinSetup'>;

type PinStep = 'create' | 'confirm';

export function PinSetupScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { name } = route.params;
  const [step, setStep] = useState<PinStep>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePinChange = (value: string) => {
    setError(null);
    if (step === 'create') {
      setPin(value);
    } else {
      setConfirmPin(value);
    }
  };

  const handleContinue = async () => {
    if (step === 'create') {
      setStep('confirm');
      return;
    }

    // Confirm step
    if (pin !== confirmPin) {
      setError(t('onboarding.pinMismatch'));
      setConfirmPin('');
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Generate key pair and create encrypted backup
      // const encryptionService = container.get<EncryptionService>('encryption');
      // await encryptionService.generateKeyPair();
      // await encryptionService.createBackup(pin);

      await new Promise(resolve => setTimeout(resolve, 1000));
      navigation.navigate('Completion', { name });
    } catch (err) {
      setError(t('errors.genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('create');
      setConfirmPin('');
      setError(null);
    } else {
      navigation.goBack();
    }
  };

  const currentPin = step === 'create' ? pin : confirmPin;
  const isComplete = currentPin.length === 6;

  return (
    <SafeAreaView style={styles.container}>
      <ProgressIndicator currentStep={4} totalSteps={5} />

      <View style={styles.content}>
        <Text style={styles.title}>
          {step === 'create' ? t('onboarding.createPin') : t('onboarding.confirmPin')}
        </Text>
        <Text style={styles.hint}>{t('onboarding.pinHint')}</Text>

        <View style={styles.pinContainer}>
          <PinInput
            value={currentPin}
            onChange={handlePinChange}
            length={6}
            error={Boolean(error)}
            accessibilityLabel={
              step === 'create' ? t('onboarding.createPin') : t('onboarding.confirmPin')
            }
          />
        </View>

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>{t('onboarding.pinWarning')}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        {step === 'confirm' && (
          <Button
            title={t('accessibility.backButton')}
            onPress={handleBack}
            variant="text"
            style={styles.backButton}
          />
        )}
        <Button
          title={step === 'create' ? t('onboarding.continue') : t('onboarding.finish')}
          onPress={handleContinue}
          disabled={!isComplete}
          loading={isLoading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    textAlign: 'center',
  },
  hint: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  pinContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  warningBox: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.lg,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  warningText: {
    ...typography.small,
    color: colors.textSecondary,
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
});
