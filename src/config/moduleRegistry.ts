/**
 * Module Registry — Central registry for country-specific modules
 *
 * This file defines all available country-specific modules.
 * To add a new module:
 * 1. Add module definition to COUNTRY_MODULES array
 * 2. Add i18n keys in all 5 language files
 * 3. Create the module screen component
 *
 * @see .claude/plans/COUNTRY_SPECIFIC_MODULES.md
 */

import type { CountryModuleDefinition } from '@/types/modules';

// ============================================================
// Module Definitions
// ============================================================

/**
 * All available country-specific modules
 *
 * Each module is associated with a country and will be:
 * - Auto-enabled for users from that country
 * - Available for opt-in by users from other countries
 */
export const COUNTRY_MODULES: CountryModuleDefinition[] = [
  // ============================================================
  // Netherlands (NL)
  // ============================================================
  {
    id: 'nunl',
    countryCode: 'NL',
    labelKey: 'modules.nunl.title',
    icon: 'news',
    color: '#E65100', // nu.nl orange
    rssBaseUrl: 'https://www.nu.nl/rss',
    supportsFullTextExtraction: true,
    contentLicense: 'nu.nl - Sanoma Media Netherlands',
    categories: [
      {
        id: 'algemeen',
        labelKey: 'modules.nunl.categories.algemeen',
        rssPath: '/Algemeen',
        icon: '📰',
      },
      {
        id: 'sport',
        labelKey: 'modules.nunl.categories.sport',
        rssPath: '/Sport',
        icon: '⚽',
      },
      {
        id: 'tech',
        labelKey: 'modules.nunl.categories.tech',
        rssPath: '/Tech',
        icon: '💻',
      },
      {
        id: 'economie',
        labelKey: 'modules.nunl.categories.economie',
        rssPath: '/Economie',
        icon: '📈',
      },
      {
        id: 'film',
        labelKey: 'modules.nunl.categories.film',
        rssPath: '/Film',
        icon: '🎬',
      },
      {
        id: 'muziek',
        labelKey: 'modules.nunl.categories.muziek',
        rssPath: '/Muziek',
        icon: '🎵',
      },
      {
        id: 'wetenschap',
        labelKey: 'modules.nunl.categories.wetenschap',
        rssPath: '/Wetenschap',
        icon: '🔬',
      },
      {
        id: 'opmerkelijk',
        labelKey: 'modules.nunl.categories.opmerkelijk',
        rssPath: '/Opmerkelijk',
        icon: '😮',
      },
      {
        id: 'achterklap',
        labelKey: 'modules.nunl.categories.achterklap',
        rssPath: '/Achterklap',
        icon: '🗣️',
      },
    ],
  },

  // Future modules can be added here:
  // - NOS Nieuws (NL)
  // - RTL Nieuws (NL)
  // - VRT NWS (BE)
  // - BBC News (GB)
  // - Tagesschau (DE)
  // - France Info (FR)
  // - RTVE (ES)
];

// ============================================================
// Registry Functions
// ============================================================

/**
 * Get all modules available for a specific country
 * These are auto-enabled for users from this country
 */
export function getModulesForCountry(
  countryCode: string
): CountryModuleDefinition[] {
  return COUNTRY_MODULES.filter(
    (m) => m.countryCode.toUpperCase() === countryCode.toUpperCase()
  );
}

/**
 * Get a module by its ID
 */
export function getModuleById(
  id: string
): CountryModuleDefinition | undefined {
  return COUNTRY_MODULES.find((m) => m.id === id);
}

/**
 * Get all available modules (for settings/discovery)
 */
export function getAllAvailableModules(): CountryModuleDefinition[] {
  return COUNTRY_MODULES;
}

/**
 * Get all unique country codes that have modules
 */
export function getCountriesWithModules(): string[] {
  const countries = new Set(COUNTRY_MODULES.map((m) => m.countryCode));
  return Array.from(countries);
}

/**
 * Group modules by country (for settings display)
 */
export function getModulesGroupedByCountry(): Record<
  string,
  CountryModuleDefinition[]
> {
  const groups: Record<string, CountryModuleDefinition[]> = {};

  for (const module of COUNTRY_MODULES) {
    if (!groups[module.countryCode]) {
      groups[module.countryCode] = [];
    }
    groups[module.countryCode].push(module);
  }

  return groups;
}

/**
 * Check if a module exists
 */
export function moduleExists(id: string): boolean {
  return COUNTRY_MODULES.some((m) => m.id === id);
}

/**
 * Get the default category for a module
 */
export function getDefaultCategory(
  moduleId: string
): string | undefined {
  const module = getModuleById(moduleId);
  return module?.categories[0]?.id;
}
