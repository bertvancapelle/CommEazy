/**
 * Navigation types — Shared navigation type definitions
 *
 * Contains types used by both WheelNavigationMenu (iPhone) and Sidebar (iPad).
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

// ============================================================
// Navigation Destinations
// ============================================================

/**
 * Static navigation destinations (built-in modules)
 */
export type StaticNavigationDestination =
  | 'menu'      // iPad Split View: Menu module (initial left panel)
  | 'chats'
  | 'contacts'
  | 'groups'
  | 'settings'
  | 'help'
  | 'calls'     // Combined voice + video calling
  | 'podcast'
  | 'radio'
  | 'books'
  | 'weather';

/**
 * Dynamic navigation destinations for country-specific modules
 * Format: 'module:{moduleId}' (e.g., 'module:nunl')
 */
export type DynamicNavigationDestination = `module:${string}`;

/**
 * Combined navigation destination type
 */
export type NavigationDestination =
  | StaticNavigationDestination
  | DynamicNavigationDestination;

// ============================================================
// Helpers
// ============================================================

/**
 * Check if destination is a dynamic module
 */
export function isDynamicDestination(
  dest: NavigationDestination
): dest is DynamicNavigationDestination {
  return dest.startsWith('module:');
}

/**
 * Extract module ID from dynamic destination
 * @param dest - Dynamic destination like 'module:nunl'
 * @returns Module ID like 'nunl'
 */
export function getModuleIdFromDest(dest: DynamicNavigationDestination): string {
  return dest.replace('module:', '');
}

// ============================================================
// Icon Types
// ============================================================

/**
 * All available icon types for modules
 */
export type ModuleIconType =
  | 'menu'      // iPad Split View: Menu icon
  | 'chat'
  | 'contacts'
  | 'groups'
  | 'settings'
  | 'help'
  | 'phone'
  | 'video'
  | 'book'
  | 'headphones'
  | 'podcast'
  | 'radio'
  | 'news'      // For country-specific news modules
  | 'weather';  // Weather module

// ============================================================
// Module Definitions
// ============================================================

/**
 * Module item definition for navigation
 */
export interface ModuleDefinition {
  /** Unique module ID (e.g., 'chats', 'module:nunl') */
  id: NavigationDestination;

  /** i18n key for the module label */
  labelKey: string;

  /** Icon type to display */
  icon: ModuleIconType;

  /** Brand color for the module */
  color: string;

  /** Optional custom logo component (for branded modules like nu.nl) */
  customLogo?: React.ReactNode;

  /**
   * Sidebar group for iPad layout
   * - primary: Main communication modules (chats, contacts, groups, calls)
   * - secondary: Media/content modules (radio, podcast, books, weather)
   * - footer: System modules (settings, help)
   */
  sidebarGroup?: 'primary' | 'secondary' | 'footer';
}

/**
 * Module groups for sidebar organization
 */
export const MODULE_SIDEBAR_GROUPS = {
  primary: ['chats', 'contacts', 'groups', 'calls'] as const,
  secondary: ['radio', 'podcast', 'books', 'weather'] as const,
  footer: ['menu', 'settings', 'help'] as const,
} as const;

/**
 * Get sidebar group for a module
 */
export function getSidebarGroup(
  moduleId: NavigationDestination
): 'primary' | 'secondary' | 'footer' | 'dynamic' {
  // Dynamic modules go in secondary group
  if (isDynamicDestination(moduleId)) {
    return 'dynamic';
  }

  if ((MODULE_SIDEBAR_GROUPS.primary as readonly string[]).includes(moduleId)) {
    return 'primary';
  }
  if ((MODULE_SIDEBAR_GROUPS.secondary as readonly string[]).includes(moduleId)) {
    return 'secondary';
  }
  if ((MODULE_SIDEBAR_GROUPS.footer as readonly string[]).includes(moduleId)) {
    return 'footer';
  }

  // Fallback
  return 'secondary';
}
