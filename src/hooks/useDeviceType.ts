/**
 * useDeviceType — Device type detection hook
 *
 * Detects whether the app is running on iPhone or iPad,
 * and provides information about screen orientation and size classes.
 *
 * Used by AdaptiveNavigation to select the appropriate navigation strategy:
 * - iPhone: WheelNavigationMenu (hold-to-navigate)
 * - iPad: Sidebar navigation (always visible or slide-in)
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import { useMemo } from 'react';
import { useWindowDimensions, Platform } from 'react-native';

// ============================================================
// Types
// ============================================================

export type DeviceType = 'phone' | 'tablet';

export interface DeviceInfo {
  /** Device type: 'phone' (iPhone) or 'tablet' (iPad) */
  deviceType: DeviceType;

  /** True if screen is in landscape orientation */
  isLandscape: boolean;

  /** Current screen width in points */
  screenWidth: number;

  /** Current screen height in points */
  screenHeight: number;

  /**
   * Compact width class:
   * - True for iPhone (any orientation)
   * - True for iPad in Slide Over mode (width < 400pt)
   * - False for iPad in regular/split view
   */
  isCompact: boolean;

  /**
   * Regular width class:
   * - True for iPad in full-screen or split view (width >= 400pt)
   * - False for iPhone or iPad in Slide Over
   */
  isRegular: boolean;

  /** True if this is an iPad */
  isTablet: boolean;

  /** True if this is an iPhone */
  isPhone: boolean;
}

// ============================================================
// Constants
// ============================================================

/**
 * Minimum width to be considered "regular" width class on iPad.
 * Below this, iPad is in Slide Over mode and behaves like compact.
 */
const COMPACT_WIDTH_THRESHOLD = 400;

/**
 * Minimum screen dimension to detect tablet on Android.
 * iOS uses Platform.isPad instead.
 */
const ANDROID_TABLET_MIN_DIMENSION = 600;

// ============================================================
// Hook
// ============================================================

/**
 * Hook to detect device type and screen characteristics.
 *
 * @returns DeviceInfo object with device type and screen information
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { deviceType, isLandscape, isCompact } = useDeviceType();
 *
 *   if (deviceType === 'tablet' && !isCompact) {
 *     return <SidebarLayout />;
 *   }
 *   return <PhoneLayout />;
 * }
 * ```
 */
export function useDeviceType(): DeviceInfo {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    // iPad detection
    // iOS: Use Platform.isPad (reliable)
    // Android: Use screen size heuristic (min dimension >= 600pt)
    const isTablet =
      Platform.OS === 'ios'
        ? Platform.isPad === true
        : Math.min(width, height) >= ANDROID_TABLET_MIN_DIMENSION;

    const isLandscape = width > height;

    // Compact = iPhone OR iPad in Slide Over mode (very narrow)
    // Regular = iPad in normal view (full-screen or split)
    const isCompact = !isTablet || width < COMPACT_WIDTH_THRESHOLD;
    const isRegular = isTablet && width >= COMPACT_WIDTH_THRESHOLD;

    return {
      deviceType: isTablet ? 'tablet' : 'phone',
      isLandscape,
      screenWidth: width,
      screenHeight: height,
      isCompact,
      isRegular,
      isTablet,
      isPhone: !isTablet,
    };
  }, [width, height]);
}

export default useDeviceType;
