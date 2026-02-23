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
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
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
  const themeColors = useColors();
  const currentLanguage = i18n.language as SupportedLanguage;

  const handleLanguageSelect = (lang: SupportedLanguage) => {
    triggerHaptic();
    void i18n.changeLanguage(lang);
    navigation.navigate('Welcome');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.icon}>🌐</Text>
          {/* Show the prompt in the user's current detected language first */}
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{CHOOSE_LANGUAGE_TEXTS[currentLanguage]}</Text>
          {/* Show alternative translations so ALL users can understand */}
          <View style={styles.alternativeTexts}>
            {(Object.entries(CHOOSE_LANGUAGE_TEXTS) as [SupportedLanguage, string][])
              .filter(([lang]) => lang !== currentLanguage)
              .slice(0, 2) // Show 2 alternatives to keep it clean
              .map(([lang, text]) => (
                <Text key={lang} style={[styles.titleTranslated, { color: themeColors.textSecondary }]}>{text}</Text>
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
                  { borderColor: themeColors.border, backgroundColor: themeColors.background },
                  currentLanguage === code && { borderColor: themeColors.primary, backgroundColor: themeColors.backgroundSecondary },
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
                    { color: themeColors.textPrimary },
                    currentLanguage === code && { color: themeColors.primary, fontWeight: '700' },
                  ]}
                >
                  {name}
                </Text>
                {currentLanguage === code && (
                  <Text style={[styles.checkmark, { color: themeColors.primary }]}>✓</Text>
                )}
              </TouchableOpacity>
            )
          )}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.autoDetected, { color: themeColors.textTertiary }]}>
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
    textAlign: 'center',
  },
  titleTranslated: {
    ...typography.body,
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
    borderRadius: borderRadius.md,
  },
  flag: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  languageName: {
    ...typography.body,
    flex: 1,
  },
  checkmark: {
    ...typography.h3,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  autoDetected: {
    ...typography.small,
  },
});
