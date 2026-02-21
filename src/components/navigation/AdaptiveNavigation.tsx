/**
 * AdaptiveNavigation — Device-adaptive navigation wrapper
 *
 * Automatically switches between:
 * - iPhone: WheelNavigationMenu (hold-to-navigate)
 * - iPad: Sidebar navigation (always visible or collapsible)
 *
 * Wraps the app's main content and provides the appropriate
 * navigation UI based on device type.
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React, { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

import { useNavigationContext, useNavigationContextSafe } from '@/contexts/NavigationContext';
import { useDeviceType } from '@/hooks/useDeviceType';
import { Sidebar } from './Sidebar';
// WheelNavigationMenu is imported dynamically or passed as prop
// to avoid circular dependencies

// ============================================================
// Types
// ============================================================

export interface AdaptiveNavigationProps {
  /** Main content to render */
  children: ReactNode;

  /**
   * WheelNavigationMenu component (passed to avoid circular deps)
   * Only rendered on iPhone
   */
  WheelMenu?: React.ComponentType;

  /**
   * Show sidebar on iPad (default: true)
   * Set to false to hide sidebar on specific screens
   */
  showSidebar?: boolean;

  /**
   * Show wheel menu on iPhone (default: true)
   * Set to false to hide wheel on specific screens (e.g., onboarding)
   */
  showWheel?: boolean;
}

// ============================================================
// Component
// ============================================================

export function AdaptiveNavigation({
  children,
  WheelMenu,
  showSidebar = true,
  showWheel = true,
}: AdaptiveNavigationProps) {
  const device = useDeviceType();
  const navContext = useNavigationContextSafe();

  // Get sidebar collapsed state from context (or default)
  const isSidebarCollapsed = navContext?.isSidebarCollapsed ?? false;

  // ============================================================
  // iPad Layout: Sidebar + Content
  // ============================================================

  if (device.isTablet && showSidebar) {
    return (
      <View style={styles.tabletContainer}>
        {/* Sidebar */}
        <Sidebar isCollapsed={isSidebarCollapsed} />

        {/* Main Content */}
        <View style={styles.tabletContent}>
          {children}
        </View>
      </View>
    );
  }

  // ============================================================
  // iPhone Layout: Content + Wheel Overlay
  // ============================================================

  return (
    <View style={styles.phoneContainer}>
      {/* Main Content */}
      {children}

      {/* Wheel Menu Overlay (iPhone only) */}
      {device.isPhone && showWheel && WheelMenu && (
        <WheelMenu />
      )}
    </View>
  );
}

// ============================================================
// Split View Layout (for iPad detail views)
// ============================================================

export interface SplitViewLayoutProps {
  /** Master/list view content */
  master: ReactNode;

  /** Detail view content */
  detail: ReactNode;

  /** Master view width ratio (0-1, default: 0.35) */
  masterRatio?: number;

  /** Show master view (for collapsible behavior) */
  showMaster?: boolean;
}

/**
 * SplitViewLayout — iPad split view with master/detail
 *
 * Use this inside AdaptiveNavigation for screens that need
 * a list/detail split layout (e.g., chat list + chat detail).
 */
export function SplitViewLayout({
  master,
  detail,
  masterRatio = 0.35,
  showMaster = true,
}: SplitViewLayoutProps) {
  const device = useDeviceType();

  // On iPhone, only show one view at a time (handled by navigation)
  if (device.isPhone) {
    return <>{detail}</>;
  }

  // On iPad, show split view
  return (
    <View style={styles.splitContainer}>
      {showMaster && (
        <View style={[styles.masterView, { flex: masterRatio }]}>
          {master}
        </View>
      )}
      <View style={[styles.detailView, { flex: showMaster ? (1 - masterRatio) : 1 }]}>
        {detail}
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  // Phone layout
  phoneContainer: {
    flex: 1,
  },

  // Tablet layout
  tabletContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  tabletContent: {
    flex: 1,
  },

  // Split view
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  masterView: {
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  detailView: {
    flex: 1,
  },
});

export default AdaptiveNavigation;
