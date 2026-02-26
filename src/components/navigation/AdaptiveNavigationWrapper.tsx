/**
 * AdaptiveNavigationWrapper — Device-adaptive navigation wrapper
 *
 * Provides the appropriate navigation UI based on device type:
 * - iPhone: PaneProvider(1 pane) → SinglePaneLayout with WheelNavigationMenu
 * - iPad: PaneProvider(2 panes) → SplitViewLayout with WheelNavigationMenu
 *
 * Both paths use the same pane infrastructure (PaneContext → ModulePanel → PanelNavigator).
 *
 * @see .claude/plans/sunny-yawning-sunset.md
 */

import React, { useEffect, useCallback } from 'react';

import { useDeviceType } from '@/hooks/useDeviceType';
import { PaneProvider, usePaneContext, type PaneId } from '@/contexts/PaneContext';
import { WheelMenuProvider, useWheelMenuContext } from '@/contexts/WheelMenuContext';
import { SplitViewLayout } from './SplitViewLayout';
import { SinglePaneLayout } from './SinglePaneLayout';
import { HoldToNavigateWrapper } from '@/components/HoldToNavigateWrapper';
import { WheelNavigationMenu } from '@/components/WheelNavigationMenu';
import type { NavigationDestination } from '@/types/navigation';

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
        <WheelMenuProvider>
          <PhoneNavigationWithWheelMenu enabled={enabled} />
        </WheelMenuProvider>
      </PaneProvider>
    );
  }

  // ============================================================
  // iPad: Two panes with SplitViewLayout
  // ============================================================

  return (
    <PaneProvider paneCount={2}>
      <WheelMenuProvider>
        <SplitViewWithWheelMenu />
      </WheelMenuProvider>
    </PaneProvider>
  );
}

// ============================================================
// iPad Split View with WheelNavigationMenu overlay
// ============================================================

/**
 * Inner component that renders Split View + WheelNavigationMenu
 * Must be inside both PaneProvider and WheelMenuProvider
 */
function SplitViewWithWheelMenu() {
  const { setPaneModule } = usePaneContext();
  const {
    isOpen,
    request,
    closeMenu,
    handleNavigate,
    setNavigationHandler,
  } = useWheelMenuContext();

  // Register navigation handler for wheel menu
  useEffect(() => {
    setNavigationHandler((panelId: PaneId | null, destination: NavigationDestination) => {
      if (panelId) {
        setPaneModule(panelId, destination);
      }
    });

    return () => {
      setNavigationHandler(null);
    };
  }, [setNavigationHandler, setPaneModule]);

  return (
    <>
      <SplitViewLayout />

      {/* WheelNavigationMenu rendered at root level for full-screen overlay */}
      <WheelNavigationMenu
        visible={isOpen}
        onNavigate={handleNavigate}
        onClose={closeMenu}
        activeScreen={request?.activeScreen}
      />
    </>
  );
}

// ============================================================
// iPhone Navigation with WheelMenu overlay
// ============================================================

interface PhoneNavigationProps {
  enabled: boolean;
}

/**
 * Phone navigation wrapper that includes WheelNavigationMenu overlay.
 * Uses SinglePaneLayout (pane-based) instead of MainTab.Navigator.
 * Must be inside PaneProvider and WheelMenuProvider.
 */
function PhoneNavigationWithWheelMenu({ enabled }: PhoneNavigationProps) {
  const { setPaneModule } = usePaneContext();
  const {
    isOpen,
    request,
    closeMenu,
    handleNavigate,
    setNavigationHandler,
  } = useWheelMenuContext();

  // Register navigation handler for wheel menu
  useEffect(() => {
    setNavigationHandler((_panelId: PaneId | null, destination: NavigationDestination) => {
      // On iPhone, navigate using pane context (single 'main' pane)
      setPaneModule('main', destination);
    });

    return () => {
      setNavigationHandler(null);
    };
  }, [setNavigationHandler, setPaneModule]);

  return (
    <>
      <HoldToNavigateWrapper enabled={enabled}>
        <SinglePaneLayout />
      </HoldToNavigateWrapper>

      {/* WheelNavigationMenu rendered at root level for full-screen overlay */}
      <WheelNavigationMenu
        visible={isOpen}
        onNavigate={handleNavigate}
        onClose={closeMenu}
        activeScreen={request?.activeScreen}
      />
    </>
  );
}

export default AdaptiveNavigationWrapper;
