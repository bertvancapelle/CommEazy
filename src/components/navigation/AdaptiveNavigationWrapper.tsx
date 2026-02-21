/**
 * AdaptiveNavigationWrapper — Device-adaptive navigation wrapper
 *
 * Provides the appropriate navigation UI based on device type:
 * - iPhone: HoldToNavigateWrapper with WheelNavigationMenu
 * - iPad: Split View with two independent module panels
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React, { useEffect, type ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';

import { useDeviceType } from '@/hooks/useDeviceType';
import { useNavigationContextSafe } from '@/contexts/NavigationContext';
import { SplitViewProvider } from '@/contexts/SplitViewContext';
import { SplitViewLayout } from './SplitViewLayout';
import { HoldToNavigateWrapper } from '@/components/HoldToNavigateWrapper';

// ============================================================
// Types
// ============================================================

export interface AdaptiveNavigationWrapperProps {
  /** Main content to render (used on iPhone, ignored on iPad Split View) */
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
  const navigation = useNavigation<NavigationProp<Record<string, undefined>>>();
  const navContext = useNavigationContextSafe();

  // Register navigation callback with context
  useEffect(() => {
    if (navContext && navigation) {
      navContext.setNavigateCallback((screenName: string) => {
        navigation.navigate(screenName as never);
      });

      return () => {
        navContext.setNavigateCallback(null);
      };
    }
  }, [navContext, navigation]);

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
  // iPad: Split View with two module panels
  // ============================================================

  return (
    <SplitViewProvider>
      <SplitViewLayout />
    </SplitViewProvider>
  );
}

export default AdaptiveNavigationWrapper;
