/**
 * Country-Specific Module Types
 *
 * Type definitions for the country-specific module framework.
 * Modules are content sources (news, weather, etc.) that can be
 * country-specific and shown based on user profile or opt-in.
 *
 * @see .claude/plans/COUNTRY_SPECIFIC_MODULES.md
 */

import type { NavigationDestination } from '@/components/WheelNavigationMenu';

// ============================================================
// Module Icon Types
// ============================================================

/**
 * Icon types available for country modules
 * Extends the existing WheelNavigationMenu icon system
 */
export type ModuleIconType =
  | 'news'        // Newspaper icon for news modules
  | 'weather'     // Weather icon for weather modules
  | 'sports'      // Sports icon for sports modules
  | 'tv'          // TV icon for streaming modules
  | 'newspaper';  // Alternative news icon

// ============================================================
// Module Category (for content filtering)
// ============================================================

/**
 * A content category within a module (e.g., Sport, Tech, Economy)
 */
export interface ModuleCategory {
  /** Unique identifier (e.g., 'sport', 'tech') */
  id: string;
  /** i18n key for the category label */
  labelKey: string;
  /** Path appended to rssBaseUrl (e.g., '/Sport') */
  rssPath: string;
  /** Optional emoji icon for visual distinction */
  icon?: string;
}

// ============================================================
// Country Module Definition
// ============================================================

/**
 * Definition of a country-specific module
 *
 * @example
 * const nuNlModule: CountryModuleDefinition = {
 *   id: 'nunl',
 *   countryCode: 'NL',
 *   labelKey: 'modules.nunl.title',
 *   icon: 'news',
 *   color: '#E65100',
 *   rssBaseUrl: 'https://www.nu.nl/rss',
 *   categories: [...],
 *   supportsFullTextExtraction: true,
 * };
 */
export interface CountryModuleDefinition {
  /** Unique module identifier (e.g., 'nunl', 'nos', 'bbc') */
  id: string;

  /** ISO 3166-1 alpha-2 country code (e.g., 'NL', 'BE', 'GB') */
  countryCode: string;

  /** i18n key for the module title */
  labelKey: string;

  /** Icon type for WheelNavigationMenu */
  icon: ModuleIconType;

  /** Accent color for the module (hex) */
  color: string;

  /** Base URL for RSS feeds */
  rssBaseUrl: string;

  /** Available content categories */
  categories: ModuleCategory[];

  /** Whether full article text can be extracted for TTS */
  supportsFullTextExtraction: boolean;

  /** Optional content license/attribution requirements */
  contentLicense?: string;
}

// ============================================================
// Enabled Module (User State)
// ============================================================

/**
 * Represents a module enabled by/for the user
 */
export interface EnabledModule {
  /** Module ID (references CountryModuleDefinition.id) */
  moduleId: string;

  /** Timestamp when module was enabled */
  enabledAt: number;

  /** True if auto-enabled based on user's country */
  isAutoEnabled: boolean;
}

// ============================================================
// Module Session Tracking (24h Usage)
// ============================================================

/**
 * A single usage session for a module
 * Used to calculate 24-hour rolling usage time
 */
export interface ModuleSession {
  /** Module ID */
  moduleId: string;

  /** Session start timestamp (ms since epoch) */
  startedAt: number;

  /** Session end timestamp (undefined if still active) */
  endedAt?: number;
}

/**
 * Usage data stored in UserProfile
 */
export interface ModuleUsageData {
  /** All sessions (pruned to last 24 hours) */
  sessions: ModuleSession[];
}

// ============================================================
// News Article (for news modules)
// ============================================================

/**
 * A news article parsed from RSS feed
 */
export interface NewsArticle {
  /** Unique identifier (guid or link) */
  id: string;

  /** Article title */
  title: string;

  /** RSS description (summary) */
  description: string;

  /** Full article URL */
  link: string;

  /** Publication date */
  pubDate: Date;

  /** Image URL (if available) */
  imageUrl?: string;

  /** Category ID this article belongs to */
  category: string;

  /** Module ID this article comes from */
  moduleId: string;
}

// ============================================================
// Navigation Integration
// ============================================================

/**
 * Dynamic navigation destination for country modules
 * Format: 'module:{moduleId}'
 */
export type DynamicModuleDestination = `module:${string}`;

/**
 * Check if a navigation destination is a dynamic module
 */
export function isDynamicModuleDestination(
  destination: NavigationDestination | DynamicModuleDestination
): destination is DynamicModuleDestination {
  return typeof destination === 'string' && destination.startsWith('module:');
}

/**
 * Extract module ID from dynamic destination
 */
export function getModuleIdFromDestination(
  destination: DynamicModuleDestination
): string {
  return destination.replace('module:', '');
}

/**
 * Create dynamic destination from module ID
 */
export function createModuleDestination(
  moduleId: string
): DynamicModuleDestination {
  return `module:${moduleId}`;
}
