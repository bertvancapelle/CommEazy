/**
 * Profile Settings Constants
 *
 * Extracted from ProfileSettingsScreen for better separation of concerns.
 *
 * Contains:
 * - Supported languages list
 * - Country/region data with flag emojis
 * - Language flag emojis
 */

import type { SupportedLanguage } from '@/services/interfaces';

// ============================================================
// Supported Languages
// ============================================================

// Supported languages (matches SupportedLanguage type from interfaces)
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['nl', 'en', 'de', 'fr', 'es', 'it', 'pl', 'no', 'sv', 'da'];

// ============================================================
// Country Data
// ============================================================

// Country and region data with flag emojis
export const COUNTRIES = ['NL', 'BE', 'LU', 'DE', 'AT', 'CH', 'FR', 'ES', 'GB', 'IE', 'US'] as const;

// Flag emojis for countries
export const COUNTRY_FLAGS: Record<string, string> = {
  NL: '🇳🇱',
  BE: '🇧🇪',
  LU: '🇱🇺',
  DE: '🇩🇪',
  AT: '🇦🇹',
  CH: '🇨🇭',
  FR: '🇫🇷',
  ES: '🇪🇸',
  GB: '🇬🇧',
  IE: '🇮🇪',
  US: '🇺🇸',
};

// Flag emojis for languages
export const LANGUAGE_FLAGS: Record<string, string> = {
  nl: '🇳🇱',
  en: '🇬🇧',
  de: '🇩🇪',
  fr: '🇫🇷',
  es: '🇪🇸',
  it: '🇮🇹',
  pl: '🇵🇱',
  no: '🇳🇴',
  sv: '🇸🇪',
  da: '🇩🇰',
};

