/**
 * AdaptiveNavigationWrapper — Device-adaptive navigation wrapper
 *
 * Provides the appropriate navigation UI based on device type:
 * - iPhone: PaneProvider(1 pane) → SinglePaneLayout + HoldToNavigateWrapper
 * - iPad: PaneProvider(2 panes) → SplitViewLayout
 *
 * Both paths use the same pane infrastructure (PaneContext → ModulePanel → PanelNavigator).
 * Navigation back to HomeScreen grid uses the Grid button in ModuleHeader
 * or 1-finger long-press (via HoldToNavigateWrapper).
 *
 * @see .claude/plans/sunny-yawning-sunset.md
 */

import React from 'react';

import { useDeviceType } from '@/hooks/useDeviceType';
import { PaneProvider } from '@/contexts/PaneContext';
import { SplitViewLayout } from './SplitViewLayout';
import { SinglePaneLayout } from './SinglePaneLayout';
import { HoldToNavigateWrapper } from '@/components/HoldToNavigateWrapper';

// ============================================================
// Types
// ============================================================

export interface AdaptiveNavigationWrapperProps {
  /** Enable navigation (default: true) */
  enabled?: boolean;
}

// ============================================================
// Component
// ============================================================

export function AdaptiveNavigationWrapper({
  enabled = true,
}: AdaptiveNavigationWrapperProps) {
  const device = useDeviceType();

  // ============================================================
  // iPhone: Single pane with HoldToNavigateWrapper
  // ============================================================

  if (device.isPhone || !enabled) {
    return (
      <PaneProvider paneCount={1}>
        <HoldToNavigateWrapper enabled={enabled}>
          <SinglePaneLayout />
        </HoldToNavigateWrapper>
      </PaneProvider>
    );
  }

  // ============================================================
  // iPad: Two panes with SplitViewLayout
  // ============================================================

  return (
    <PaneProvider paneCount={2}>
      <SplitViewLayout />
    </PaneProvider>
  );
}

export default AdaptiveNavigationWrapper;
