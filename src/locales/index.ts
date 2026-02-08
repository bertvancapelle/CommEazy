/**
 * CommEazy i18n Configuration
 *
 * 5 languages at launch: NL, EN, DE, FR, ES
 * - Device language detection on first launch
 * - Language selector in onboarding + Settings
 * - Fallback: English
 * - All strings via t() — no hardcoded text
 *
 * @see cross-cutting/ERROR_TAXONOMY.md for error messages
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';
import type { SupportedLanguage } from '../services/interfaces';

import nl from './nl.json';
import en from './en.json';
import de from './de.json';
import fr from './fr.json';
import es from './es.json';

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, string> = {
  nl: 'Nederlands',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
};

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/**
 * Detect best language from device settings.
 * Falls back to English if device language is unsupported.
 */
function detectDeviceLanguage(): SupportedLanguage {
  const locales = RNLocalize.getLocales();
  const supported = Object.keys(SUPPORTED_LANGUAGES);

  for (const locale of locales) {
    const lang = locale.languageCode as SupportedLanguage;
    if (supported.includes(lang)) {
      return lang;
    }
  }

  return DEFAULT_LANGUAGE;
}

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      nl: { translation: nl },
      en: { translation: en },
      de: { translation: de },
      fr: { translation: fr },
      es: { translation: es },
    },
    lng: detectDeviceLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false, // React Native handles escaping
    },
    // Prevent key showing as fallback — force English text
    returnNull: false,
    returnEmptyString: false,
  });

export default i18n;
