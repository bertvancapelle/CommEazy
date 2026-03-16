/**
 * Name Input Screen
 *
 * User enters their first and last name.
 */

import React, { useState, useRef } from 'react';
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
import { typography, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { Button, TextInput, ProgressIndicator } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import type { OnboardingStackParams } from '@/navigation';

type Props = NativeStackScreenProps<OnboardingStackParams, 'NameInput'>;

export function NameInputScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const lastNameRef = useRef<RNTextInput>(null);

  const handleContinue = () => {
    void triggerFeedback('tap');
    navigation.navigate('PinSetup', { firstName: firstName.trim(), lastName: lastName.trim() });
  };

  const isValid = firstName.trim().length >= 2 && lastName.trim().length >= 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ProgressIndicator currentStep={3} totalSteps={6} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{t('onboarding.yourName')}</Text>
          <Text style={[styles.hint, { color: themeColors.textSecondary }]}>{t('onboarding.nameHint')}</Text>

          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('onboarding.firstName')}</Text>
          <TextInput
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

          <View style={styles.fieldSpacer} />

          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('onboarding.lastName')}</Text>
          <TextInput
            ref={lastNameRef}
            value={lastName}
            onChangeText={setLastName}
            placeholder={t('onboarding.lastNamePlaceholder')}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => isValid && handleContinue()}
            accessibilityLabel={t('onboarding.lastName')}
          />
        </View>

        <View style={styles.footer}>
          <Button
            title={t('onboarding.continue')}
            onPress={handleContinue}
            disabled={!isValid}
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
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.body,
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  fieldSpacer: {
    height: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
