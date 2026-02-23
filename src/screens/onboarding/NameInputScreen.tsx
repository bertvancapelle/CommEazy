/**
 * Name Input Screen
 *
 * User enters their display name.
 * Photo is optional (skip button prominent).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
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
  const [name, setName] = useState('');

  const handleContinue = () => {
    void triggerFeedback('tap');
    // TODO: Save name to user profile
    navigation.navigate('PinSetup', { name });
  };

  const isValid = name.trim().length >= 2;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ProgressIndicator currentStep={3} totalSteps={5} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{t('onboarding.yourName')}</Text>
          <Text style={[styles.hint, { color: themeColors.textSecondary }]}>{t('onboarding.nameHint')}</Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('onboarding.namePlaceholder')}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            accessibilityLabel={t('onboarding.yourName')}
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
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
