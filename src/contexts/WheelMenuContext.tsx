/**
 * WheelMenuContext — Portal-like rendering for WheelNavigationMenu
 *
 * Solves the iPad Split View problem where WheelNavigationMenu rendered inside
 * a ModulePanel only covers that panel instead of the full screen.
 *
 * This context allows panels to request the menu to open, while the actual
 * WheelNavigationMenu is rendered at the app root level (full-screen overlay).
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

import type { NavigationDestination } from '@/types/navigation';
import type { PanelId } from './SplitViewContext';

// ============================================================
// Types
// ============================================================

export interface WheelMenuRequest {
  /** Which panel requested the menu (for iPad Split View) */
  panelId: PanelId | null;
  /** Current module in the requesting panel */
  activeScreen: NavigationDestination;
}

export interface WheelMenuContextValue {
  /** Whether the wheel menu is currently open */
  isOpen: boolean;
  /** Current menu request (panel + active screen) */
  request: WheelMenuRequest | null;
  /** Open the wheel menu for a specific panel */
  openMenu: (panelId: PanelId | null, activeScreen: NavigationDestination) => void;
  /** Close the wheel menu */
  closeMenu: () => void;
  /** Handle navigation selection — calls the registered handler */
  handleNavigate: (destination: NavigationDestination) => void;
  /** Register navigation handler (called by the consumer) */
  setNavigationHandler: (handler: ((panelId: PanelId | null, destination: NavigationDestination) => void) | null) => void;
}

// ============================================================
// Context
// ============================================================

const WheelMenuContext = createContext<WheelMenuContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

export interface WheelMenuProviderProps {
  children: ReactNode;
}

export function WheelMenuProvider({ children }: WheelMenuProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [request, setRequest] = useState<WheelMenuRequest | null>(null);
  const [navigationHandler, setNavigationHandlerState] = useState<
    ((panelId: PanelId | null, destination: NavigationDestination) => void) | null
  >(null);

  const openMenu = useCallback((panelId: PanelId | null, activeScreen: NavigationDestination) => {
    setRequest({ panelId, activeScreen });
    setIsOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    // Keep request for animation, clear after close animation
    setTimeout(() => setRequest(null), 200);
  }, []);

  const handleNavigate = useCallback((destination: NavigationDestination) => {
    if (navigationHandler && request) {
      navigationHandler(request.panelId, destination);
    }
    closeMenu();
  }, [navigationHandler, request, closeMenu]);

  const setNavigationHandler = useCallback(
    (handler: ((panelId: PanelId | null, destination: NavigationDestination) => void) | null) => {
      setNavigationHandlerState(() => handler);
    },
    []
  );

  const value = useMemo<WheelMenuContextValue>(
    () => ({
      isOpen,
      request,
      openMenu,
      closeMenu,
      handleNavigate,
      setNavigationHandler,
    }),
    [isOpen, request, openMenu, closeMenu, handleNavigate, setNavigationHandler]
  );

  return (
    <WheelMenuContext.Provider value={value}>
      {children}
    </WheelMenuContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Use wheel menu context
 * @throws Error if used outside WheelMenuProvider
 */
export function useWheelMenuContext(): WheelMenuContextValue {
  const context = useContext(WheelMenuContext);
  if (!context) {
    throw new Error('useWheelMenuContext must be used within WheelMenuProvider');
  }
  return context;
}

/**
 * Use wheel menu context (safe version)
 * Returns null if used outside WheelMenuProvider
 */
export function useWheelMenuContextSafe(): WheelMenuContextValue | null {
  return useContext(WheelMenuContext);
}
