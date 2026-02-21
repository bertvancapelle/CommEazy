/**
 * AdaptiveNavigationWrapper — Device-adaptive navigation wrapper
 *
 * Provides the appropriate navigation UI based on device type:
 * - iPhone: HoldToNavigateWrapper with WheelNavigationMenu
 * - iPad: Sidebar navigation (always visible in landscape, collapsible in portrait)
 *
 * This component should wrap the main navigation content.
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React, { useState, useCallback, type ReactNode } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeviceType } from '@/hooks/useDeviceType';
import { useAccentColorContext } from '@/contexts/AccentColorContext';
import { Sidebar } from './Sidebar';
import { HoldToNavigateWrapper } from '@/components/HoldToNavigateWrapper';
import { colors, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon } from '@/components/Icon';

// ============================================================
// Types
// ============================================================

export interface AdaptiveNavigationWrapperProps {
  /** Main content to render */
  children: ReactNode;

  /** Enable navigation (default: true) */
  enabled?: boolean;
}

// ============================================================
// Component
// ============================================================

export function AdaptiveNavigationWrapper({
  children,
  enabled = true,
}: AdaptiveNavigationWrapperProps) {
  const device = useDeviceType();
  const insets = useSafeAreaInsets();
  const { accentColor } = useAccentColorContext();

  // Sidebar collapsed state (for iPad portrait)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Toggle sidebar for iPad portrait mode
  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  // ============================================================
  // iPhone: Use existing HoldToNavigateWrapper
  // ============================================================

  if (device.isPhone || !enabled) {
    return (
      <HoldToNavigateWrapper enabled={enabled}>
        {children}
      </HoldToNavigateWrapper>
    );
  }

  // ============================================================
  // iPad: Sidebar + Content layout
  // ============================================================

  // In landscape (regular width), sidebar is always visible
  // In portrait (compact width), sidebar can be toggled
  const showCollapsedToggle = device.isCompact && device.isTablet;

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <Sidebar isCollapsed={isSidebarCollapsed && showCollapsedToggle} />

      {/* Main Content */}
      <View style={styles.content}>
        {/* Collapsed sidebar toggle button (portrait mode only) */}
        {showCollapsedToggle && (
          <TouchableOpacity
            style={[
              styles.toggleButton,
              { top: insets.top + spacing.sm },
            ]}
            onPress={toggleSidebar}
            accessibilityRole="button"
            accessibilityLabel={isSidebarCollapsed ? 'Open menu' : 'Close menu'}
          >
            <Icon
              name={isSidebarCollapsed ? 'menu' : 'chevron-left'}
              size={24}
              color={accentColor.primary}
            />
          </TouchableOpacity>
        )}

        {/* Content with HoldToNavigateWrapper for voice commands */}
        <HoldToNavigateWrapper
          enabled={enabled}
          // On iPad, we still want voice commands but not the wheel menu
          // The wheel menu will be hidden because we're on tablet
        >
          {children}
        </HoldToNavigateWrapper>
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    position: 'relative',
  },
  toggleButton: {
    position: 'absolute',
    left: spacing.sm,
    zIndex: 10,
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default AdaptiveNavigationWrapper;
