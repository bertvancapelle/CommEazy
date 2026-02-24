/**
 * Demographics Constants
 *
 * ISO 3166-1 countries and ISO 3166-2 regions for supported markets.
 * Used for freemium ad targeting (required for free users).
 *
 * Senior-inclusive: Large touch targets, clear labels in local language.
 *
 * @see services/interfaces.ts for types
 */

import type { AgeBracket, SupportedLanguage } from '@/services/interfaces';

// ============================================================
// Age Brackets
// ============================================================

export interface AgeBracketOption {
  value: AgeBracket;
  labelKey: string; // i18n key
}

export const AGE_BRACKETS: AgeBracketOption[] = [
  { value: '18-24', labelKey: 'demographics.age.18_24' },
  { value: '25-34', labelKey: 'demographics.age.25_34' },
  { value: '35-44', labelKey: 'demographics.age.35_44' },
  { value: '45-54', labelKey: 'demographics.age.45_54' },
  { value: '55-64', labelKey: 'demographics.age.55_64' },
  { value: '65+', labelKey: 'demographics.age.65_plus' },
];

// ============================================================
// Languages (ISO 639-1)
// ============================================================

export interface LanguageOption {
  code: string;        // ISO 639-1 (lowercase: 'nl', 'en', 'de', 'fr', 'es')
  nameKey: string;     // i18n key for translated name
  nativeName: string;  // Name in the language itself
  icon: string;        // Emoji icon (speech bubble or globe, not flag)
}

/**
 * Supported languages for CommEazy content search
 * Used for Radio, Podcast and Books modules where content is language-based
 *
 * Note: No flags here — languages are not tied to specific countries
 * (e.g., Spanish is spoken in Spain, Mexico, Argentina, etc.)
 *
 * Matches all 13 app languages — users should be able to search in their own language
 */
export const LANGUAGES: LanguageOption[] = [
  { code: 'nl', nameKey: 'demographics.language.nl', nativeName: 'Nederlands', icon: '🗣️' },
  { code: 'en', nameKey: 'demographics.language.en', nativeName: 'English', icon: '🗣️' },
  { code: 'de', nameKey: 'demographics.language.de', nativeName: 'Deutsch', icon: '🗣️' },
  { code: 'fr', nameKey: 'demographics.language.fr', nativeName: 'Français', icon: '🗣️' },
  { code: 'es', nameKey: 'demographics.language.es', nativeName: 'Español', icon: '🗣️' },
  { code: 'it', nameKey: 'demographics.language.it', nativeName: 'Italiano', icon: '🗣️' },
  { code: 'no', nameKey: 'demographics.language.no', nativeName: 'Norsk', icon: '🗣️' },
  { code: 'sv', nameKey: 'demographics.language.sv', nativeName: 'Svenska', icon: '🗣️' },
  { code: 'da', nameKey: 'demographics.language.da', nativeName: 'Dansk', icon: '🗣️' },
  { code: 'pt', nameKey: 'demographics.language.pt', nativeName: 'Português', icon: '🗣️' },
  { code: 'pl', nameKey: 'demographics.language.pl', nativeName: 'Polski', icon: '🗣️' },
];

// ============================================================
// Countries (ISO 3166-1 alpha-2)
// ============================================================

export interface CountryOption {
  code: string;        // ISO 3166-1 alpha-2
  nameKey: string;     // i18n key for translated name
  nativeName: string;  // Name in local language (fallback)
  flag: string;        // Emoji flag
}

/**
 * Supported countries for CommEazy
 * Matches the 5 supported languages: NL, EN (UK/US), DE, FR, ES
 */
export const COUNTRIES: CountryOption[] = [
  // Benelux
  { code: 'NL', nameKey: 'demographics.country.NL', nativeName: 'Nederland', flag: '🇳🇱' },
  { code: 'BE', nameKey: 'demographics.country.BE', nativeName: 'België', flag: '🇧🇪' },
  { code: 'LU', nameKey: 'demographics.country.LU', nativeName: 'Luxembourg', flag: '🇱🇺' },

  // German-speaking
  { code: 'DE', nameKey: 'demographics.country.DE', nativeName: 'Deutschland', flag: '🇩🇪' },
  { code: 'AT', nameKey: 'demographics.country.AT', nativeName: 'Österreich', flag: '🇦🇹' },
  { code: 'CH', nameKey: 'demographics.country.CH', nativeName: 'Schweiz', flag: '🇨🇭' },

  // French-speaking
  { code: 'FR', nameKey: 'demographics.country.FR', nativeName: 'France', flag: '🇫🇷' },

  // Spanish-speaking
  { code: 'ES', nameKey: 'demographics.country.ES', nativeName: 'España', flag: '🇪🇸' },

  // English-speaking
  { code: 'GB', nameKey: 'demographics.country.GB', nativeName: 'United Kingdom', flag: '🇬🇧' },
  { code: 'IE', nameKey: 'demographics.country.IE', nativeName: 'Ireland', flag: '🇮🇪' },
  { code: 'US', nameKey: 'demographics.country.US', nativeName: 'United States', flag: '🇺🇸' },
];

// ============================================================
// Regions (ISO 3166-2)
// ============================================================

export interface RegionOption {
  code: string;        // ISO 3166-2 (e.g., 'NL-NH')
  nameKey: string;     // i18n key
  nativeName: string;  // Name in local language
}

/**
 * Regions per country (ISO 3166-2)
 * Only main regions/provinces for simplicity
 */
export const REGIONS: Record<string, RegionOption[]> = {
  // Netherlands - Provinces
  NL: [
    { code: 'NL-DR', nameKey: 'demographics.region.NL-DR', nativeName: 'Drenthe' },
    { code: 'NL-FL', nameKey: 'demographics.region.NL-FL', nativeName: 'Flevoland' },
    { code: 'NL-FR', nameKey: 'demographics.region.NL-FR', nativeName: 'Friesland' },
    { code: 'NL-GE', nameKey: 'demographics.region.NL-GE', nativeName: 'Gelderland' },
    { code: 'NL-GR', nameKey: 'demographics.region.NL-GR', nativeName: 'Groningen' },
    { code: 'NL-LI', nameKey: 'demographics.region.NL-LI', nativeName: 'Limburg' },
    { code: 'NL-NB', nameKey: 'demographics.region.NL-NB', nativeName: 'Noord-Brabant' },
    { code: 'NL-NH', nameKey: 'demographics.region.NL-NH', nativeName: 'Noord-Holland' },
    { code: 'NL-OV', nameKey: 'demographics.region.NL-OV', nativeName: 'Overijssel' },
    { code: 'NL-UT', nameKey: 'demographics.region.NL-UT', nativeName: 'Utrecht' },
    { code: 'NL-ZE', nameKey: 'demographics.region.NL-ZE', nativeName: 'Zeeland' },
    { code: 'NL-ZH', nameKey: 'demographics.region.NL-ZH', nativeName: 'Zuid-Holland' },
  ],

  // Belgium - Regions
  BE: [
    { code: 'BE-VLG', nameKey: 'demographics.region.BE-VLG', nativeName: 'Vlaanderen' },
    { code: 'BE-WAL', nameKey: 'demographics.region.BE-WAL', nativeName: 'Wallonie' },
    { code: 'BE-BRU', nameKey: 'demographics.region.BE-BRU', nativeName: 'Bruxelles' },
  ],

  // Germany - Bundesländer
  DE: [
    { code: 'DE-BW', nameKey: 'demographics.region.DE-BW', nativeName: 'Baden-Württemberg' },
    { code: 'DE-BY', nameKey: 'demographics.region.DE-BY', nativeName: 'Bayern' },
    { code: 'DE-BE', nameKey: 'demographics.region.DE-BE', nativeName: 'Berlin' },
    { code: 'DE-BB', nameKey: 'demographics.region.DE-BB', nativeName: 'Brandenburg' },
    { code: 'DE-HB', nameKey: 'demographics.region.DE-HB', nativeName: 'Bremen' },
    { code: 'DE-HH', nameKey: 'demographics.region.DE-HH', nativeName: 'Hamburg' },
    { code: 'DE-HE', nameKey: 'demographics.region.DE-HE', nativeName: 'Hessen' },
    { code: 'DE-MV', nameKey: 'demographics.region.DE-MV', nativeName: 'Mecklenburg-Vorpommern' },
    { code: 'DE-NI', nameKey: 'demographics.region.DE-NI', nativeName: 'Niedersachsen' },
    { code: 'DE-NW', nameKey: 'demographics.region.DE-NW', nativeName: 'Nordrhein-Westfalen' },
    { code: 'DE-RP', nameKey: 'demographics.region.DE-RP', nativeName: 'Rheinland-Pfalz' },
    { code: 'DE-SL', nameKey: 'demographics.region.DE-SL', nativeName: 'Saarland' },
    { code: 'DE-SN', nameKey: 'demographics.region.DE-SN', nativeName: 'Sachsen' },
    { code: 'DE-ST', nameKey: 'demographics.region.DE-ST', nativeName: 'Sachsen-Anhalt' },
    { code: 'DE-SH', nameKey: 'demographics.region.DE-SH', nativeName: 'Schleswig-Holstein' },
    { code: 'DE-TH', nameKey: 'demographics.region.DE-TH', nativeName: 'Thüringen' },
  ],

  // France - Top regions (simplified)
  FR: [
    { code: 'FR-IDF', nameKey: 'demographics.region.FR-IDF', nativeName: 'Île-de-France' },
    { code: 'FR-ARA', nameKey: 'demographics.region.FR-ARA', nativeName: 'Auvergne-Rhône-Alpes' },
    { code: 'FR-NAQ', nameKey: 'demographics.region.FR-NAQ', nativeName: 'Nouvelle-Aquitaine' },
    { code: 'FR-OCC', nameKey: 'demographics.region.FR-OCC', nativeName: 'Occitanie' },
    { code: 'FR-HDF', nameKey: 'demographics.region.FR-HDF', nativeName: 'Hauts-de-France' },
    { code: 'FR-GES', nameKey: 'demographics.region.FR-GES', nativeName: 'Grand Est' },
    { code: 'FR-PAC', nameKey: 'demographics.region.FR-PAC', nativeName: 'Provence-Alpes-Côte d\'Azur' },
    { code: 'FR-PDL', nameKey: 'demographics.region.FR-PDL', nativeName: 'Pays de la Loire' },
    { code: 'FR-BRE', nameKey: 'demographics.region.FR-BRE', nativeName: 'Bretagne' },
    { code: 'FR-NOR', nameKey: 'demographics.region.FR-NOR', nativeName: 'Normandie' },
    { code: 'FR-BFC', nameKey: 'demographics.region.FR-BFC', nativeName: 'Bourgogne-Franche-Comté' },
    { code: 'FR-CVL', nameKey: 'demographics.region.FR-CVL', nativeName: 'Centre-Val de Loire' },
    { code: 'FR-COR', nameKey: 'demographics.region.FR-COR', nativeName: 'Corse' },
  ],

  // Spain - Autonomous Communities
  ES: [
    { code: 'ES-AN', nameKey: 'demographics.region.ES-AN', nativeName: 'Andalucía' },
    { code: 'ES-AR', nameKey: 'demographics.region.ES-AR', nativeName: 'Aragón' },
    { code: 'ES-AS', nameKey: 'demographics.region.ES-AS', nativeName: 'Asturias' },
    { code: 'ES-CN', nameKey: 'demographics.region.ES-CN', nativeName: 'Canarias' },
    { code: 'ES-CB', nameKey: 'demographics.region.ES-CB', nativeName: 'Cantabria' },
    { code: 'ES-CL', nameKey: 'demographics.region.ES-CL', nativeName: 'Castilla y León' },
    { code: 'ES-CM', nameKey: 'demographics.region.ES-CM', nativeName: 'Castilla-La Mancha' },
    { code: 'ES-CT', nameKey: 'demographics.region.ES-CT', nativeName: 'Catalunya' },
    { code: 'ES-EX', nameKey: 'demographics.region.ES-EX', nativeName: 'Extremadura' },
    { code: 'ES-GA', nameKey: 'demographics.region.ES-GA', nativeName: 'Galicia' },
    { code: 'ES-IB', nameKey: 'demographics.region.ES-IB', nativeName: 'Illes Balears' },
    { code: 'ES-RI', nameKey: 'demographics.region.ES-RI', nativeName: 'La Rioja' },
    { code: 'ES-MD', nameKey: 'demographics.region.ES-MD', nativeName: 'Madrid' },
    { code: 'ES-MC', nameKey: 'demographics.region.ES-MC', nativeName: 'Murcia' },
    { code: 'ES-NC', nameKey: 'demographics.region.ES-NC', nativeName: 'Navarra' },
    { code: 'ES-PV', nameKey: 'demographics.region.ES-PV', nativeName: 'País Vasco' },
    { code: 'ES-VC', nameKey: 'demographics.region.ES-VC', nativeName: 'Comunitat Valenciana' },
  ],

  // UK - Nations + Major regions
  GB: [
    { code: 'GB-ENG', nameKey: 'demographics.region.GB-ENG', nativeName: 'England' },
    { code: 'GB-SCT', nameKey: 'demographics.region.GB-SCT', nativeName: 'Scotland' },
    { code: 'GB-WLS', nameKey: 'demographics.region.GB-WLS', nativeName: 'Wales' },
    { code: 'GB-NIR', nameKey: 'demographics.region.GB-NIR', nativeName: 'Northern Ireland' },
  ],

  // Ireland - Provinces
  IE: [
    { code: 'IE-L', nameKey: 'demographics.region.IE-L', nativeName: 'Leinster' },
    { code: 'IE-M', nameKey: 'demographics.region.IE-M', nativeName: 'Munster' },
    { code: 'IE-C', nameKey: 'demographics.region.IE-C', nativeName: 'Connacht' },
    { code: 'IE-U', nameKey: 'demographics.region.IE-U', nativeName: 'Ulster (ROI)' },
  ],

  // Austria - Bundesländer
  AT: [
    { code: 'AT-1', nameKey: 'demographics.region.AT-1', nativeName: 'Burgenland' },
    { code: 'AT-2', nameKey: 'demographics.region.AT-2', nativeName: 'Kärnten' },
    { code: 'AT-3', nameKey: 'demographics.region.AT-3', nativeName: 'Niederösterreich' },
    { code: 'AT-4', nameKey: 'demographics.region.AT-4', nativeName: 'Oberösterreich' },
    { code: 'AT-5', nameKey: 'demographics.region.AT-5', nativeName: 'Salzburg' },
    { code: 'AT-6', nameKey: 'demographics.region.AT-6', nativeName: 'Steiermark' },
    { code: 'AT-7', nameKey: 'demographics.region.AT-7', nativeName: 'Tirol' },
    { code: 'AT-8', nameKey: 'demographics.region.AT-8', nativeName: 'Vorarlberg' },
    { code: 'AT-9', nameKey: 'demographics.region.AT-9', nativeName: 'Wien' },
  ],

  // Switzerland - Cantons (simplified to language regions)
  CH: [
    { code: 'CH-DE', nameKey: 'demographics.region.CH-DE', nativeName: 'Deutschschweiz' },
    { code: 'CH-FR', nameKey: 'demographics.region.CH-FR', nativeName: 'Romandie' },
    { code: 'CH-IT', nameKey: 'demographics.region.CH-IT', nativeName: 'Svizzera italiana' },
  ],

  // Luxembourg
  LU: [
    { code: 'LU-D', nameKey: 'demographics.region.LU-D', nativeName: 'Diekirch' },
    { code: 'LU-G', nameKey: 'demographics.region.LU-G', nativeName: 'Grevenmacher' },
    { code: 'LU-L', nameKey: 'demographics.region.LU-L', nativeName: 'Luxembourg' },
  ],

  // US - Simplified to major regions
  US: [
    { code: 'US-NE', nameKey: 'demographics.region.US-NE', nativeName: 'Northeast' },
    { code: 'US-SE', nameKey: 'demographics.region.US-SE', nativeName: 'Southeast' },
    { code: 'US-MW', nameKey: 'demographics.region.US-MW', nativeName: 'Midwest' },
    { code: 'US-SW', nameKey: 'demographics.region.US-SW', nativeName: 'Southwest' },
    { code: 'US-W', nameKey: 'demographics.region.US-W', nativeName: 'West' },
  ],
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get regions for a country code
 */
export function getRegionsForCountry(countryCode: string): RegionOption[] {
  return REGIONS[countryCode] || [];
}

/**
 * Get country by code
 */
export function getCountryByCode(code: string): CountryOption | undefined {
  return COUNTRIES.find(c => c.code === code);
}

/**
 * Get region by code
 */
export function getRegionByCode(regionCode: string): RegionOption | undefined {
  const countryCode = regionCode.split('-')[0];
  const regions = REGIONS[countryCode];
  return regions?.find(r => r.code === regionCode);
}

/**
 * Get language by code
 */
export function getLanguageByCode(code: string): LanguageOption | undefined {
  return LANGUAGES.find(l => l.code === code.toLowerCase());
}

/**
 * Detect language from app locale
 */
export function detectLanguageFromLocale(locale: string): string {
  const lang = locale.split('-')[0].toLowerCase();
  const supported = LANGUAGES.find(l => l.code === lang);
  return supported?.code || 'en';
}

/**
 * Detect likely country from device locale
 */
export function detectCountryFromLocale(locale: string): string {
  // Extract region from locale (e.g., 'nl-NL' -> 'NL', 'en-GB' -> 'GB')
  const parts = locale.split('-');
  if (parts.length >= 2) {
    const regionCode = parts[1].toUpperCase();
    if (COUNTRIES.some(c => c.code === regionCode)) {
      return regionCode;
    }
  }

  // Fallback: map language to most likely country
  const langToCountry: Record<string, string> = {
    nl: 'NL',
    de: 'DE',
    fr: 'FR',
    es: 'ES',
    en: 'GB',
  };

  const lang = parts[0].toLowerCase();
  return langToCountry[lang] || 'NL';
}
