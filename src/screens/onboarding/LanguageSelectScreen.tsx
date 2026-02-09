/**
 * Language Selection Screen
 *
 * First screen in onboarding flow.
 * Auto-detects device language, allows manual override.
 *
 * Design: One thing per screen — only language selection here.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, touchTargets, borderRadius, spacing } from '@/theme';
import { SUPPORTED_LANGUAGES } from '@/locales';
import type { SupportedLanguage } from '@/services/interfaces';
import type { OnboardingStackParams } from '@/navigation';

type Props = NativeStackScreenProps<OnboardingStackParams, 'LanguageSelect'>;

const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  nl: '🇳🇱',
  en: '🇬🇧',
  de: '🇩🇪',
  fr: '🇫🇷',
  es: '🇪🇸',
};

export function LanguageSelectScreen({ navigation }: Props) {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language as SupportedLanguage;

  const handleLanguageSelect = (lang: SupportedLanguage) => {
    void i18n.changeLanguage(lang);
    navigation.navigate('Welcome');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.icon}>🌐</Text>
          <Text style={styles.title}>Choose your language</Text>
          <Text style={styles.titleTranslated}>Kies je taal</Text>
        </View>

        <View style={styles.languages}>
          {(Object.entries(SUPPORTED_LANGUAGES) as [SupportedLanguage, string][]).map(
            ([code, name]) => (
              <TouchableOpacity
                key={code}
                style={[
                  styles.languageButton,
                  currentLanguage === code && styles.languageButtonSelected,
                ]}
                onPress={() => handleLanguageSelect(code)}
                accessibilityLabel={name}
                accessibilityRole="button"
                accessibilityState={{ selected: currentLanguage === code }}
              >
                <Text style={styles.flag}>{LANGUAGE_FLAGS[code]}</Text>
                <Text
                  style={[
                    styles.languageName,
                    currentLanguage === code && styles.languageNameSelected,
                  ]}
                >
                  {name}
                </Text>
                {currentLanguage === code && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            )
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.autoDetected}>
            Auto-detected: {SUPPORTED_LANGUAGES[currentLanguage]}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  titleTranslated: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  languages: {
    gap: spacing.md,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  languageButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundSecondary,
  },
  flag: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  languageName: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  languageNameSelected: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  checkmark: {
    ...typography.h3,
    color: colors.primary,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  autoDetected: {
    ...typography.small,
    color: colors.textTertiary,
  },
});
