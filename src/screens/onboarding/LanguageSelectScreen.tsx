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
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
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

// Pre-translation strings for language selection screen
// These must be shown BEFORE the user selects a language
// so we show the prompt in all 5 supported languages
const CHOOSE_LANGUAGE_TEXTS: Record<SupportedLanguage, string> = {
  en: 'Choose your language',
  nl: 'Kies je taal',
  de: 'Wähle deine Sprache',
  fr: 'Choisissez votre langue',
  es: 'Elige tu idioma',
};

// Auto-detected label in all 5 languages
const AUTO_DETECTED_TEXTS: Record<SupportedLanguage, string> = {
  en: 'Auto-detected',
  nl: 'Automatisch gedetecteerd',
  de: 'Automatisch erkannt',
  fr: 'Détecté automatiquement',
  es: 'Detectado automáticamente',
};

// Haptic feedback helper - senior-inclusive: provides tactile confirmation
const triggerHaptic = () => {
  const options = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  const hapticType = Platform.select({
    ios: 'impactMedium',
    android: 'effectClick',
    default: 'impactMedium',
  }) as string;

  ReactNativeHapticFeedback.trigger(hapticType, options);
};

export function LanguageSelectScreen({ navigation }: Props) {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language as SupportedLanguage;

  const handleLanguageSelect = (lang: SupportedLanguage) => {
    triggerHaptic();
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
          {/* Show the prompt in the user's current detected language first */}
          <Text style={styles.title}>{CHOOSE_LANGUAGE_TEXTS[currentLanguage]}</Text>
          {/* Show alternative translations so ALL users can understand */}
          <View style={styles.alternativeTexts}>
            {(Object.entries(CHOOSE_LANGUAGE_TEXTS) as [SupportedLanguage, string][])
              .filter(([lang]) => lang !== currentLanguage)
              .slice(0, 2) // Show 2 alternatives to keep it clean
              .map(([lang, text]) => (
                <Text key={lang} style={styles.titleTranslated}>{text}</Text>
              ))}
          </View>
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
            {AUTO_DETECTED_TEXTS[currentLanguage]}: {SUPPORTED_LANGUAGES[currentLanguage]}
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
  alternativeTexts: {
    marginTop: spacing.sm,
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
