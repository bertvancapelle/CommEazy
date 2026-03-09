/**
 * Navigation types — Single source of truth for navigation destinations
 *
 * All navigation-related types, constants, and helpers.
 * Consolidated single source of truth for all module navigation types,
 * constants, and helpers used by HomeScreen grid and iPad panels.
 *
 * @see src/screens/HomeScreen.tsx — Grid navigation (primary)
 * @see .claude/plans/HOMESCREEN_GRID_NAVIGATION.md
 */

import type { IconName } from '@/components/Icon';

// ============================================================
// Navigation Destinations
// ============================================================

/**
 * Static navigation destinations (built-in modules)
 */
export type StaticNavigationDestination =
  | 'home'         // HomeScreen grid (start screen)
  | 'menu'         // iPad Split View: Menu module (initial left panel)
  | 'chats'
  | 'contacts'
  | 'groups'
  | 'settings'
  | 'help'
  | 'calls'        // Combined voice + video calling
  | 'podcast'
  | 'radio'
  | 'books'
  | 'weather'
  | 'appleMusic'   // Apple Music integration
  | 'camera'       // Camera module (photo/video capture)
  | 'photoAlbum'   // Photo Album (view, send, delete photos)
  | 'askAI'        // Ask AI assistant module
  | 'mail'         // E-mail module
  | 'agenda';      // Agenda module (appointments, reminders, medication)

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
  | 'menu'         // iPad Split View: Menu icon
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
  | 'news'         // For country-specific news modules
  | 'weather'      // Weather module
  | 'appleMusic'   // Apple Music module
  | 'camera'       // Camera module
  | 'image'        // Photo Album module
  | 'chatbubble'   // Ask AI module
  | 'mail'         // E-mail module
  | 'calendar';    // Agenda module

/**
 * Map ModuleIconType to IconName for unified SVG icons
 */
export function mapModuleIconToIconName(type: ModuleIconType): IconName {
  switch (type) {
    case 'menu':
      return 'grid';
    case 'chat':
      return 'chat';
    case 'contacts':
      return 'contacts';
    case 'groups':
      return 'groups';
    case 'settings':
      return 'settings';
    case 'help':
      return 'help';
    case 'phone':
      return 'phone';
    case 'video':
      return 'videocam';
    case 'book':
      return 'book';
    case 'headphones':
      return 'headphones';
    case 'podcast':
      return 'podcast';
    case 'radio':
      return 'radio';
    case 'news':
      return 'news';
    case 'weather':
      return 'weather';
    case 'appleMusic':
      return 'appleMusic';
    case 'camera':
      return 'camera';
    case 'image':
      return 'image';
    case 'chatbubble':
      return 'chatbubble';
    case 'mail':
      return 'mail';
    case 'calendar':
      return 'calendar';
    default:
      return 'info'; // fallback
  }
}

// ============================================================
// Module Definitions
// ============================================================

/**
 * Module item definition for navigation
 */
export interface ModuleItem {
  id: NavigationDestination;
  labelKey: string;
  icon: ModuleIconType;
  /** @deprecated Colors now come from useModuleColor() hook */
  color?: string;
  /** Custom logo component to render instead of icon (for branded modules) */
  customLogo?: React.ReactNode;
}

/**
 * Static module definitions — built-in modules with icon and label info
 * Colors come from ModuleColorsContext via useModuleColor() hook
 */
export const STATIC_MODULE_DEFINITIONS: Record<StaticNavigationDestination, Omit<ModuleItem, 'id'>> = {
  home: { labelKey: 'navigation.home', icon: 'menu' },
  menu: { labelKey: 'navigation.menu', icon: 'menu' },
  chats: { labelKey: 'navigation.chats', icon: 'chat' },
  contacts: { labelKey: 'navigation.contacts', icon: 'contacts' },
  groups: { labelKey: 'navigation.groups', icon: 'groups' },
  calls: { labelKey: 'navigation.calls', icon: 'phone' },
  podcast: { labelKey: 'navigation.podcast', icon: 'podcast' },
  radio: { labelKey: 'navigation.radio', icon: 'radio' },
  books: { labelKey: 'navigation.books', icon: 'book' },
  weather: { labelKey: 'navigation.weather', icon: 'weather' },
  appleMusic: { labelKey: 'navigation.appleMusic', icon: 'appleMusic' },
  camera: { labelKey: 'navigation.camera', icon: 'camera' },
  photoAlbum: { labelKey: 'navigation.photoAlbum', icon: 'image' },
  askAI: { labelKey: 'navigation.askAI', icon: 'chatbubble' },
  mail: { labelKey: 'navigation.mail', icon: 'mail' },
  agenda: { labelKey: 'navigation.agenda', icon: 'calendar' },
  settings: { labelKey: 'navigation.settings', icon: 'settings' },
  help: { labelKey: 'navigation.help', icon: 'help' },
};

// ============================================================
// Sidebar Groups (iPad)
// ============================================================

/**
 * Module groups for sidebar organization
 */
export const MODULE_SIDEBAR_GROUPS = {
  primary: ['chats', 'contacts', 'groups', 'calls'] as const,
  secondary: ['radio', 'podcast', 'books', 'weather', 'agenda'] as const,
  footer: ['menu', 'settings', 'help'] as const,
} as const;

/**
 * Get sidebar group for a module
 */
export function getSidebarGroup(
  moduleId: NavigationDestination
): 'primary' | 'secondary' | 'footer' | 'dynamic' {
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

  return 'secondary';
}
