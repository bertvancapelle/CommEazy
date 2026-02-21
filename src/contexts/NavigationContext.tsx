/**
 * NavigationContext — Device-aware navigation state provider
 *
 * Provides adaptive navigation state for iPhone (wheel) and iPad (sidebar).
 * Manages module list, active module, and device-specific navigation state.
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

import { useDeviceType, type DeviceInfo } from '@/hooks/useDeviceType';
import { useModuleConfig } from '@/contexts/ModuleConfigContext';
import type {
  NavigationDestination,
  ModuleDefinition,
  ModuleIconType,
} from '@/types/navigation';
import { getSidebarGroup, isDynamicDestination, getModuleIdFromDest } from '@/types/navigation';
import { getModuleById } from '@/config/moduleRegistry';

// ============================================================
// Static Module Definitions
// ============================================================

/**
 * Built-in module definitions
 * These are always available regardless of country/settings
 */
const STATIC_MODULES: ModuleDefinition[] = [
  {
    id: 'menu',
    labelKey: 'navigation.menu',
    icon: 'menu',
    color: '#455A64',
    sidebarGroup: 'footer',
  },
  {
    id: 'chats',
    labelKey: 'navigation.chats',
    icon: 'chat',
    color: '#4CAF50',
    sidebarGroup: 'primary',
  },
  {
    id: 'contacts',
    labelKey: 'navigation.contacts',
    icon: 'contacts',
    color: '#2196F3',
    sidebarGroup: 'primary',
  },
  {
    id: 'groups',
    labelKey: 'navigation.groups',
    icon: 'groups',
    color: '#9C27B0',
    sidebarGroup: 'primary',
  },
  {
    id: 'calls',
    labelKey: 'navigation.calls',
    icon: 'phone',
    color: '#FF5722',
    sidebarGroup: 'primary',
  },
  {
    id: 'radio',
    labelKey: 'modules.radio.title',
    icon: 'radio',
    color: '#00897B',
    sidebarGroup: 'secondary',
  },
  {
    id: 'podcast',
    labelKey: 'modules.podcast.title',
    icon: 'podcast',
    color: '#7B1FA2',
    sidebarGroup: 'secondary',
  },
  {
    id: 'books',
    labelKey: 'modules.books.title',
    icon: 'book',
    color: '#FF8F00',
    sidebarGroup: 'secondary',
  },
  {
    id: 'weather',
    labelKey: 'modules.weather.title',
    icon: 'weather',
    color: '#0288D1',
    sidebarGroup: 'secondary',
  },
  {
    id: 'settings',
    labelKey: 'navigation.settings',
    icon: 'settings',
    color: '#607D8B',
    sidebarGroup: 'footer',
  },
  {
    id: 'help',
    labelKey: 'navigation.help',
    icon: 'help',
    color: '#795548',
    sidebarGroup: 'footer',
  },
];

// ============================================================
// Context Types
// ============================================================

/** Callback type for actual navigation (provided by component inside NavigationContainer) */
export type NavigateCallback = (screenName: string) => void;

interface NavigationContextValue {
  // Device info
  device: DeviceInfo;

  // Modules
  /** All available modules (static + enabled dynamic) */
  modules: ModuleDefinition[];
  /** Get modules grouped by sidebar section */
  getModulesByGroup: () => {
    primary: ModuleDefinition[];
    secondary: ModuleDefinition[];
    dynamic: ModuleDefinition[];
    footer: ModuleDefinition[];
  };

  // Active state
  /** Currently active module ID */
  activeModule: NavigationDestination | null;
  /** Set active module */
  setActiveModule: (id: NavigationDestination | null) => void;

  // Navigation
  /** Navigate to a module */
  navigateTo: (destination: NavigationDestination) => void;
  /** Register navigation callback (called from inside NavigationContainer) */
  setNavigateCallback: (callback: NavigateCallback | null) => void;

  // iPhone-specific (wheel menu)
  /** Is the wheel menu currently visible (iPhone only) */
  isWheelOpen: boolean;
  /** Open the wheel menu (iPhone only) */
  openWheel: () => void;
  /** Close the wheel menu (iPhone only) */
  closeWheel: () => void;

  // iPad-specific (sidebar)
  /** Is the sidebar collapsed (iPad only, portrait mode) */
  isSidebarCollapsed: boolean;
  /** Toggle sidebar collapsed state (iPad only) */
  toggleSidebar: () => void;
}

// ============================================================
// Context
// ============================================================

const NavigationContext = createContext<NavigationContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const device = useDeviceType();
  const { enabledModules, getEnabledModuleDefinition } = useModuleConfig();

  // ============================================================
  // State
  // ============================================================

  const [activeModule, setActiveModule] = useState<NavigationDestination | null>(null);
  const [isWheelOpen, setIsWheelOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Navigation callback - set by component inside NavigationContainer
  const navigateCallbackRef = useRef<NavigateCallback | null>(null);

  const setNavigateCallback = useCallback((callback: NavigateCallback | null) => {
    navigateCallbackRef.current = callback;
  }, []);

  // ============================================================
  // Modules
  // ============================================================

  /**
   * Combine static modules with enabled dynamic modules
   */
  const modules = useMemo((): ModuleDefinition[] => {
    // Start with static modules
    const allModules = [...STATIC_MODULES];

    // Add enabled dynamic modules
    for (const enabled of enabledModules) {
      const moduleDef = getModuleById(enabled.moduleId);
      if (moduleDef) {
        // Map country module to navigation module definition
        const iconMap: Record<string, ModuleIconType> = {
          news: 'news',
          weather: 'weather',
          radio: 'radio',
          podcast: 'podcast',
          book: 'book',
        };

        allModules.push({
          id: `module:${moduleDef.id}` as NavigationDestination,
          labelKey: moduleDef.labelKey,
          icon: iconMap[moduleDef.icon] || 'news',
          color: moduleDef.color,
          sidebarGroup: 'secondary', // Dynamic modules go in secondary
        });
      }
    }

    return allModules;
  }, [enabledModules, getEnabledModuleDefinition]);

  /**
   * Group modules by sidebar section
   */
  const getModulesByGroup = useCallback(() => {
    const groups = {
      primary: [] as ModuleDefinition[],
      secondary: [] as ModuleDefinition[],
      dynamic: [] as ModuleDefinition[],
      footer: [] as ModuleDefinition[],
    };

    for (const module of modules) {
      const group = getSidebarGroup(module.id);
      if (group === 'dynamic') {
        groups.dynamic.push(module);
      } else {
        groups[group].push(module);
      }
    }

    return groups;
  }, [modules]);

  // ============================================================
  // Navigation
  // ============================================================

  /**
   * Navigate to a module
   */
  const navigateTo = useCallback(
    (destination: NavigationDestination) => {
      setActiveModule(destination);

      // Close wheel on iPhone after navigation
      if (device.isPhone) {
        setIsWheelOpen(false);
      }

      // Map destination to screen name
      let screenName: string;

      if (isDynamicDestination(destination)) {
        // Dynamic module: extract module ID and navigate to module screen
        const moduleId = getModuleIdFromDest(destination);
        // Dynamic modules typically have their own screen or use a generic ModuleScreen
        screenName = moduleId.charAt(0).toUpperCase() + moduleId.slice(1) + 'Screen';
      } else {
        // Static destination: map to screen name
        const screenMap: Record<string, string> = {
          chats: 'ChatsTab',
          contacts: 'ContactsTab',
          groups: 'GroupsTab',
          calls: 'CallsTab',
          settings: 'SettingsTab',
          help: 'Help',
          radio: 'RadioTab',
          podcast: 'PodcastTab',
          books: 'BooksTab',
          weather: 'WeatherTab',
        };
        screenName = screenMap[destination] || destination;
      }

      // Navigate using callback if available
      if (navigateCallbackRef.current) {
        try {
          navigateCallbackRef.current(screenName);
        } catch (error) {
          console.warn('[NavigationContext] Failed to navigate to:', screenName, error);
        }
      } else {
        console.warn('[NavigationContext] No navigation callback registered');
      }
    },
    [device.isPhone]
  );

  // ============================================================
  // Wheel Menu (iPhone)
  // ============================================================

  const openWheel = useCallback(() => {
    if (device.isPhone) {
      setIsWheelOpen(true);
    }
  }, [device.isPhone]);

  const closeWheel = useCallback(() => {
    setIsWheelOpen(false);
  }, []);

  // ============================================================
  // Sidebar (iPad)
  // ============================================================

  const toggleSidebar = useCallback(() => {
    if (device.isTablet) {
      setIsSidebarCollapsed((prev) => !prev);
    }
  }, [device.isTablet]);

  // ============================================================
  // Context Value
  // ============================================================

  const value = useMemo<NavigationContextValue>(
    () => ({
      device,
      modules,
      getModulesByGroup,
      activeModule,
      setActiveModule,
      navigateTo,
      setNavigateCallback,
      isWheelOpen,
      openWheel,
      closeWheel,
      isSidebarCollapsed,
      toggleSidebar,
    }),
    [
      device,
      modules,
      getModulesByGroup,
      activeModule,
      navigateTo,
      setNavigateCallback,
      isWheelOpen,
      openWheel,
      closeWheel,
      isSidebarCollapsed,
      toggleSidebar,
    ]
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

/**
 * Use navigation context
 * @throws Error if used outside NavigationProvider
 */
export function useNavigationContext(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigationContext must be used within NavigationProvider');
  }
  return context;
}

/**
 * Use navigation context (safe version)
 * Returns null if used outside NavigationProvider
 */
export function useNavigationContextSafe(): NavigationContextValue | null {
  return useContext(NavigationContext);
}
