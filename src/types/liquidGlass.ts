/**
 * Liquid Glass Type Definitions
 *
 * Type definitions for Apple's Liquid Glass design system (iOS/iPadOS 26+).
 * CommEazy uses progressive enhancement: Liquid Glass on supported devices,
 * solid color fallback on iOS <26 and Android.
 *
 * @see .claude/CLAUDE.md section 16 - Apple Liquid Glass Compliance
 * @see .claude/plans/LIQUID_GLASS_IMPLEMENTATION.md
 */

// ============================================================
// Platform Support
// ============================================================

/**
 * Minimum iOS version required for Liquid Glass support
 */
export const LIQUID_GLASS_MIN_IOS_VERSION = 26;

/**
 * Glass effect style variants
 * Maps to UIGlassEffect.Style in iOS 26+
 */
export type GlassStyle = 'regular' | 'clear';

/**
 * Platform support status for Liquid Glass
 */
export interface LiquidGlassPlatformSupport {
  /** True if running on iOS 26+ */
  isSupported: boolean;
  /** iOS version number (e.g., 26.0), null on Android */
  iosVersion: number | null;
  /** Platform identifier */
  platform: 'ios' | 'android';
}

// ============================================================
// User Settings
// ============================================================

/**
 * User-configurable Liquid Glass settings
 * Stored in AsyncStorage under key 'liquid_glass_settings'
 */
export interface LiquidGlassSettings {
  /**
   * Tint intensity (0-100)
   * 0 = fully transparent glass (minimal tint)
   * 100 = maximum tint color saturation
   * Default: 50
   */
  tintIntensity: number;

  /**
   * User has explicitly disabled Liquid Glass
   * Even on supported devices, user can choose solid colors
   * Default: false
   */
  forceDisabled: boolean;
}

/**
 * Default Liquid Glass settings
 */
export const DEFAULT_LIQUID_GLASS_SETTINGS: LiquidGlassSettings = {
  tintIntensity: 50,
  forceDisabled: false,
};

/**
 * AsyncStorage key for Liquid Glass settings
 */
export const LIQUID_GLASS_STORAGE_KEY = 'liquid_glass_settings';

// ============================================================
// Module Tint Colors
// ============================================================

/**
 * Module identifier for color mapping
 * Matches NavigationDestination from navigation types
 * Also includes aliases used by ModuleHeader
 */
export type ModuleColorId =
  | 'chats'
  | 'messages'     // Alias for chats
  | 'contacts'
  | 'groups'
  | 'calls'
  | 'videocall'    // Video calling variant
  | 'settings'
  | 'radio'
  | 'podcast'
  | 'books'
  | 'audiobook'    // Alias for books
  | 'ebook'        // E-book reader
  | 'weather'
  | 'nunl'         // nu.nl news module
  | 'appleMusic'   // Apple Music module
  | 'help'
  | 'menu';

/**
 * Tint color definition for a module
 */
export interface ModuleTintColor {
  /** Module identifier */
  moduleId: ModuleColorId;
  /** Primary tint color (hex) - used for Liquid Glass tint */
  tintColor: string;
  /** Fallback solid color (hex) - used on unsupported platforms */
  fallbackColor: string;
  /** Light variant for text/icons on this background */
  lightColor: string;
}

/**
 * Module tint color registry
 * Maps module IDs to their Liquid Glass tint colors
 *
 * Colors match WheelNavigationMenu module colors for consistency
 */
export const MODULE_TINT_COLORS: Record<ModuleColorId, ModuleTintColor> = {
  chats: {
    moduleId: 'chats',
    tintColor: '#4CAF50',      // Green
    fallbackColor: '#4CAF50',
    lightColor: '#FFFFFF',
  },
  contacts: {
    moduleId: 'contacts',
    tintColor: '#2196F3',      // Blue
    fallbackColor: '#2196F3',
    lightColor: '#FFFFFF',
  },
  groups: {
    moduleId: 'groups',
    tintColor: '#9C27B0',      // Purple
    fallbackColor: '#9C27B0',
    lightColor: '#FFFFFF',
  },
  calls: {
    moduleId: 'calls',
    tintColor: '#FF9800',      // Orange
    fallbackColor: '#FF9800',
    lightColor: '#FFFFFF',
  },
  settings: {
    moduleId: 'settings',
    tintColor: '#607D8B',      // Blue Grey
    fallbackColor: '#607D8B',
    lightColor: '#FFFFFF',
  },
  radio: {
    moduleId: 'radio',
    tintColor: '#00897B',      // Teal
    fallbackColor: '#00897B',
    lightColor: '#FFFFFF',
  },
  podcast: {
    moduleId: 'podcast',
    tintColor: '#7B1FA2',      // Deep Purple
    fallbackColor: '#7B1FA2',
    lightColor: '#FFFFFF',
  },
  books: {
    moduleId: 'books',
    tintColor: '#FF8F00',      // Amber
    fallbackColor: '#FF8F00',
    lightColor: '#FFFFFF',
  },
  weather: {
    moduleId: 'weather',
    tintColor: '#0288D1',      // Light Blue
    fallbackColor: '#0288D1',
    lightColor: '#FFFFFF',
  },
  help: {
    moduleId: 'help',
    tintColor: '#455A64',      // Dark Blue Grey
    fallbackColor: '#455A64',
    lightColor: '#FFFFFF',
  },
  menu: {
    moduleId: 'menu',
    tintColor: '#37474F',      // Blue Grey 800
    fallbackColor: '#37474F',
    lightColor: '#FFFFFF',
  },
  // Aliases and additional modules
  messages: {
    moduleId: 'messages',
    tintColor: '#4CAF50',      // Green (same as chats)
    fallbackColor: '#4CAF50',
    lightColor: '#FFFFFF',
  },
  videocall: {
    moduleId: 'videocall',
    tintColor: '#C62828',      // Red
    fallbackColor: '#C62828',
    lightColor: '#FFFFFF',
  },
  audiobook: {
    moduleId: 'audiobook',
    tintColor: '#FF8F00',      // Amber (same as books)
    fallbackColor: '#FF8F00',
    lightColor: '#FFFFFF',
  },
  ebook: {
    moduleId: 'ebook',
    tintColor: '#303F9F',      // Indigo
    fallbackColor: '#303F9F',
    lightColor: '#FFFFFF',
  },
  nunl: {
    moduleId: 'nunl',
    tintColor: '#E65100',      // nu.nl Orange
    fallbackColor: '#E65100',
    lightColor: '#FFFFFF',
  },
  appleMusic: {
    moduleId: 'appleMusic',
    tintColor: '#FC3C44',      // Apple Music Red/Pink
    fallbackColor: '#FC3C44',
    lightColor: '#FFFFFF',
  },
};

// ============================================================
// Accessibility
// ============================================================

/**
 * Accessibility state for Liquid Glass
 */
export interface LiquidGlassAccessibility {
  /**
   * System "Reduce Transparency" setting is enabled
   * When true, Liquid Glass should NOT be used (use solid colors)
   */
  reduceTransparencyEnabled: boolean;

  /**
   * System "Reduce Motion" setting is enabled
   * When true, glass effects should not animate
   */
  reduceMotionEnabled: boolean;
}

// ============================================================
// Context Value
// ============================================================

/**
 * Complete Liquid Glass context value
 * Provided by LiquidGlassContext to all children
 */
export interface LiquidGlassContextValue {
  /** Platform support status */
  platform: LiquidGlassPlatformSupport;

  /** User settings */
  settings: LiquidGlassSettings;

  /** Accessibility state */
  accessibility: LiquidGlassAccessibility;

  /**
   * Whether Liquid Glass effects should be rendered
   * True when: iOS 26+ AND not forceDisabled AND not reduceTransparencyEnabled
   */
  isEnabled: boolean;

  /**
   * Update tint intensity
   * @param intensity - Value 0-100
   */
  setTintIntensity: (intensity: number) => void;

  /**
   * Force disable Liquid Glass (user preference)
   * @param disabled - True to use solid colors even on iOS 26+
   */
  setForceDisabled: (disabled: boolean) => void;

  /**
   * Get tint color for a module
   * Returns tintColor if Liquid Glass enabled, fallbackColor otherwise
   */
  getModuleColor: (moduleId: ModuleColorId) => string;

  /**
   * Get the effective tint intensity (0-1 for native module)
   * Combines user setting with platform support
   */
  getEffectiveTintIntensity: () => number;
}

// ============================================================
// Component Props
// ============================================================

/**
 * Props for LiquidGlassView wrapper component
 */
export interface LiquidGlassViewProps {
  /** Module ID for automatic tint color lookup */
  moduleId?: ModuleColorId;

  /** Custom tint color (overrides moduleId lookup) */
  tintColor?: string;

  /** Fallback color for unsupported platforms */
  fallbackColor?: string;

  /** Override tint intensity (0-100) */
  tintIntensity?: number;

  /** Children to render inside the glass effect */
  children: React.ReactNode;

  /** Additional styles for the container */
  style?: object;
}

// ============================================================
// Native Module Types
// ============================================================

/**
 * Props passed to native iOS LiquidGlassView
 */
export interface NativeLiquidGlassProps {
  /** Tint color as hex string */
  tintColor: string;

  /** Tint intensity 0.0-1.0 */
  tintIntensity: number;

  /** Corner radius in points */
  cornerRadius?: number;
}

/**
 * Native module interface for LiquidGlassModule
 */
export interface LiquidGlassNativeModule {
  /**
   * Check if Liquid Glass is supported on current device
   * @returns Promise resolving to true on iOS 26+
   */
  isSupported(): Promise<boolean>;

  /**
   * Get current iOS version
   * @returns Promise resolving to version number or null
   */
  getIOSVersion(): Promise<number | null>;
}
