/**
 * Profile Settings Constants
 *
 * Extracted from ProfileSettingsScreen for better separation of concerns.
 *
 * Contains:
 * - Supported languages list
 * - Country/region data with flag emojis
 * - Age brackets
 * - Gender options
 */

import type { AgeBracket, SupportedLanguage, Gender } from '@/services/interfaces';

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

// ============================================================
// Region Data
// ============================================================

export const REGIONS_BY_COUNTRY: Record<string, string[]> = {
  NL: ['NL-DR', 'NL-FL', 'NL-FR', 'NL-GE', 'NL-GR', 'NL-LI', 'NL-NB', 'NL-NH', 'NL-OV', 'NL-UT', 'NL-ZE', 'NL-ZH'],
  BE: ['BE-VLG', 'BE-WAL', 'BE-BRU'],
  DE: ['DE-BW', 'DE-BY', 'DE-BE', 'DE-BB', 'DE-HB', 'DE-HH', 'DE-HE', 'DE-MV', 'DE-NI', 'DE-NW', 'DE-RP', 'DE-SL', 'DE-SN', 'DE-ST', 'DE-SH', 'DE-TH'],
  AT: ['AT-1', 'AT-2', 'AT-3', 'AT-4', 'AT-5', 'AT-6', 'AT-7', 'AT-8', 'AT-9'],
  CH: ['CH-ZH', 'CH-BE', 'CH-LU', 'CH-UR', 'CH-SZ', 'CH-OW', 'CH-NW', 'CH-GL', 'CH-ZG', 'CH-FR', 'CH-SO', 'CH-BS', 'CH-BL', 'CH-SH', 'CH-AR', 'CH-AI', 'CH-SG', 'CH-GR', 'CH-AG', 'CH-TG', 'CH-TI', 'CH-VD', 'CH-VS', 'CH-NE', 'CH-GE', 'CH-JU'],
  FR: ['FR-IDF', 'FR-CVL', 'FR-BFC', 'FR-NOR', 'FR-HDF', 'FR-GES', 'FR-PDL', 'FR-BRE', 'FR-NAQ', 'FR-OCC', 'FR-ARA', 'FR-PAC', 'FR-COR'],
  ES: ['ES-AN', 'ES-AR', 'ES-AS', 'ES-CN', 'ES-CB', 'ES-CL', 'ES-CM', 'ES-CT', 'ES-EX', 'ES-GA', 'ES-IB', 'ES-RI', 'ES-MD', 'ES-MC', 'ES-NC', 'ES-PV', 'ES-VC'],
  GB: ['GB-ENG', 'GB-SCT', 'GB-WLS', 'GB-NIR'],
  IE: ['IE-L', 'IE-M', 'IE-C', 'IE-U'],
  US: ['US-CA', 'US-TX', 'US-FL', 'US-NY', 'US-PA', 'US-IL', 'US-OH', 'US-GA', 'US-NC', 'US-MI'],
  LU: ['LU'],
};

// ============================================================
// Age & Gender Data
// ============================================================

// Extended age brackets up to 110 years (in 5-year intervals)
export const AGE_BRACKETS: AgeBracket[] = [
  '18-24', '25-34', '35-44', '45-54', '55-64',
  '65-69', '70-74', '75-79', '80-84', '85-89',
  '90-94', '95-99', '100-104', '105-110'
];

// Gender options
export const GENDERS: Gender[] = ['male', 'female', 'other'];
