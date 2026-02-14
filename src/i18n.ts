import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';

import nl from './locales/nl.json';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';

const resources = {
  nl: { translation: nl },
  en: { translation: en },
  de: { translation: de },
  fr: { translation: fr },
  es: { translation: es },
};

const getDeviceLanguage = (): string => {
  try {
    const locales = RNLocalize.getLocales();
    if (locales.length > 0) {
      const languageCode = locales[0].languageCode;
      if (Object.keys(resources).includes(languageCode)) {
        return languageCode;
      }
    }
  } catch (error) {
    // Native module might not be ready yet
    console.warn('[i18n] Failed to get device language:', error);
  }
  return 'nl'; // Default to Dutch
};

i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: 'nl',
  // Use v3 format for Hermes compatibility (no Intl.PluralRules)
  compatibilityJSON: 'v3',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
