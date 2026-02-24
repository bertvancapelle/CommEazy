/**
 * AdaptiveNavigationWrapper — Device-adaptive navigation wrapper
 *
 * Provides the appropriate navigation UI based on device type:
 * - iPhone: HoldToNavigateWrapper with WheelNavigationMenu
 * - iPad: Split View with two independent module panels
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React, { useEffect, useCallback, type ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';

import { useDeviceType } from '@/hooks/useDeviceType';
import { useNavigationContextSafe } from '@/contexts/NavigationContext';
import { SplitViewProvider, useSplitViewContext, type PanelId } from '@/contexts/SplitViewContext';
import { WheelMenuProvider, useWheelMenuContext } from '@/contexts/WheelMenuContext';
import { SplitViewLayout } from './SplitViewLayout';
import { HoldToNavigateWrapper } from '@/components/HoldToNavigateWrapper';
import { WheelNavigationMenu } from '@/components/WheelNavigationMenu';
import type { NavigationDestination } from '@/types/navigation';

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
  // iPhone: Use existing HoldToNavigateWrapper with WheelMenuProvider
  // WheelMenuProvider is needed for module icon tap → wheel menu
  // ============================================================

  if (device.isPhone || !enabled) {
    return (
      <WheelMenuProvider>
        <PhoneNavigationWithWheelMenu enabled={enabled}>
          {children}
        </PhoneNavigationWithWheelMenu>
      </WheelMenuProvider>
    );
  }

  // ============================================================
  // iPad: Split View with two module panels
  // ============================================================

  return (
    <SplitViewProvider>
      <WheelMenuProvider>
        <SplitViewWithWheelMenu />
      </WheelMenuProvider>
    </SplitViewProvider>
  );
}

// ============================================================
// iPad Split View with WheelNavigationMenu overlay
// ============================================================

/**
 * Inner component that renders Split View + WheelNavigationMenu
 * Must be inside both SplitViewProvider and WheelMenuProvider
 */
function SplitViewWithWheelMenu() {
  const { setPanelModule } = useSplitViewContext();
  // Destructure individual functions to avoid dependency on whole context object
  const {
    isOpen,
    request,
    closeMenu,
    handleNavigate,
    setNavigationHandler,
  } = useWheelMenuContext();

  // Register navigation handler for wheel menu
  // Note: setNavigationHandler is stable (wrapped in useCallback in context)
  useEffect(() => {
    setNavigationHandler((panelId: PanelId | null, destination: NavigationDestination) => {
      if (panelId) {
        // Navigate within the specific panel
        setPanelModule(panelId, destination);
      }
    });

    return () => {
      setNavigationHandler(null);
    };
  }, [setNavigationHandler, setPanelModule]);

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
  children: ReactNode;
  enabled: boolean;
}

/**
 * Phone navigation wrapper that includes WheelNavigationMenu overlay
 * Must be inside WheelMenuProvider
 */
function PhoneNavigationWithWheelMenu({ children, enabled }: PhoneNavigationProps) {
  const navigation = useNavigation<NavigationProp<Record<string, undefined>>>();
  const {
    isOpen,
    request,
    closeMenu,
    handleNavigate,
    setNavigationHandler,
  } = useWheelMenuContext();

  // Register navigation handler for wheel menu
  useEffect(() => {
    setNavigationHandler((_panelId: PanelId | null, destination: NavigationDestination) => {
      // On iPhone, navigate using React Navigation
      // Map static destination to screen name
      const staticScreenMap: Record<string, string> = {
        chats: 'ChatsTab',
        contacts: 'ContactsTab',
        groups: 'GroupsTab',
        radio: 'RadioTab',
        podcast: 'PodcastTab',
        books: 'BooksTab',
        calls: 'CallsTab',
        settings: 'SettingsTab',
        weather: 'WeatherTab',
        appleMusic: 'AppleMusicTab',
        help: 'HelpTab',  // TODO: HelpTab not yet implemented
      };

      // Handle dynamic modules (format: 'module:{moduleId}')
      if (destination.startsWith('module:')) {
        const moduleId = destination.replace('module:', '');
        // Convert moduleId to tab name (e.g., 'nunl' -> 'NuNlTab')
        const dynamicTabMap: Record<string, string> = {
          nunl: 'NuNlTab',
          // Add more dynamic modules here as they are implemented
        };
        const tabName = dynamicTabMap[moduleId] ?? `${moduleId.charAt(0).toUpperCase()}${moduleId.slice(1)}Tab`;
        navigation.navigate(tabName as never);
        return;
      }

      // Handle static modules
      const screenName = staticScreenMap[destination];
      if (screenName) {
        navigation.navigate(screenName as never);
      }
    });

    return () => {
      setNavigationHandler(null);
    };
  }, [setNavigationHandler, navigation]);

  return (
    <>
      <HoldToNavigateWrapper enabled={enabled}>
        {children}
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
