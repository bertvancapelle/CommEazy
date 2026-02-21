/**
 * ModuleConfigContext — Manages enabled country-specific modules
 *
 * Provides:
 * - List of enabled modules for current user
 * - Auto-enable modules based on user's country
 * - Manual enable/disable for opt-in modules
 * - Menu modules sorted by 24h usage time
 *
 * @see .claude/plans/COUNTRY_SPECIFIC_MODULES.md
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EnabledModule, CountryModuleDefinition } from '@/types/modules';
import {
  getModulesForCountry,
  getAllAvailableModules,
  getModuleById,
} from '@/config/moduleRegistry';
import { moduleUsageService } from '@/services/moduleUsageService';
import { ServiceContainer } from '@/services/container';

// ============================================================
// Constants
// ============================================================

const STORAGE_KEY = 'enabled_modules';

// ============================================================
// Context Types
// ============================================================

interface ModuleConfigContextValue {
  /** All enabled modules for current user */
  enabledModules: EnabledModule[];

  /** Check if a module is enabled */
  isModuleEnabled: (moduleId: string) => boolean;

  /** Enable a module (opt-in from settings) */
  enableModule: (moduleId: string) => Promise<void>;

  /** Disable a module */
  disableModule: (moduleId: string) => Promise<void>;

  /** Get modules to show in WheelNavigationMenu (sorted by 24h usage) */
  getMenuModules: () => string[];

  /** Get module definition for an enabled module */
  getEnabledModuleDefinition: (moduleId: string) => CountryModuleDefinition | undefined;

  /** User's country code from profile */
  userCountryCode: string | null;

  /** Loading state */
  isLoading: boolean;

  /** Refresh enabled modules (e.g., after country change) */
  refresh: () => Promise<void>;
}

// ============================================================
// Context
// ============================================================

const ModuleConfigContext = createContext<ModuleConfigContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface ModuleConfigProviderProps {
  children: ReactNode;
}

export function ModuleConfigProvider({ children }: ModuleConfigProviderProps) {
  const [enabledModules, setEnabledModules] = useState<EnabledModule[]>([]);
  const [userCountryCode, setUserCountryCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================
  // Load user country and enabled modules
  // ============================================================

  const loadUserCountry = useCallback(async (): Promise<string | null> => {
    try {
      if (ServiceContainer.isInitialized) {
        const profile = await ServiceContainer.database.getUserProfile();
        // Use countryCode from profile (ISO 3166-1 alpha-2 code like 'NL', 'BE', 'DE')
        return profile?.countryCode ?? null;
      }
    } catch (error) {
      console.warn('[ModuleConfigContext] Failed to load user country:', error);
    }
    return null;
  }, []);

  const loadEnabledModules = useCallback(async (): Promise<EnabledModule[]> => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('[ModuleConfigContext] Failed to load enabled modules:', error);
    }
    return [];
  }, []);

  const saveEnabledModules = useCallback(async (modules: EnabledModule[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
    } catch (error) {
      console.error('[ModuleConfigContext] Failed to save enabled modules:', error);
    }
  }, []);

  // ============================================================
  // Auto-enable modules for user's country
  // ============================================================

  const autoEnableCountryModules = useCallback(
    (countryCode: string, existingModules: EnabledModule[]): EnabledModule[] => {
      const countryModules = getModulesForCountry(countryCode);
      const existingIds = new Set(existingModules.map((m) => m.moduleId));
      const now = Date.now();

      const newAutoEnabled: EnabledModule[] = countryModules
        .filter((cm) => !existingIds.has(cm.id))
        .map((cm) => ({
          moduleId: cm.id,
          enabledAt: now,
          isAutoEnabled: true,
        }));

      if (newAutoEnabled.length > 0) {
        console.info(
          '[ModuleConfigContext] Auto-enabled',
          newAutoEnabled.length,
          'modules for country',
          countryCode
        );
      }

      return [...existingModules, ...newAutoEnabled];
    },
    []
  );

  // ============================================================
  // Initialize
  // ============================================================

  const initialize = useCallback(async () => {
    setIsLoading(true);

    try {
      // Load in parallel
      const [country, storedModules] = await Promise.all([
        loadUserCountry(),
        loadEnabledModules(),
      ]);

      setUserCountryCode(country);

      // Auto-enable country modules if we have a country
      let finalModules = storedModules;
      if (country) {
        finalModules = autoEnableCountryModules(country, storedModules);
        // Save if we added new auto-enabled modules
        if (finalModules.length !== storedModules.length) {
          await saveEnabledModules(finalModules);
        }
      }

      setEnabledModules(finalModules);
      console.debug('[ModuleConfigContext] Initialized with', finalModules.length, 'modules');
    } catch (error) {
      console.error('[ModuleConfigContext] Initialization failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadUserCountry, loadEnabledModules, autoEnableCountryModules, saveEnabledModules]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // ============================================================
  // Context Methods
  // ============================================================

  const isModuleEnabled = useCallback(
    (moduleId: string): boolean => {
      return enabledModules.some((m) => m.moduleId === moduleId);
    },
    [enabledModules]
  );

  const enableModule = useCallback(
    async (moduleId: string): Promise<void> => {
      if (isModuleEnabled(moduleId)) return;

      const newModule: EnabledModule = {
        moduleId,
        enabledAt: Date.now(),
        isAutoEnabled: false,
      };

      const updated = [...enabledModules, newModule];
      setEnabledModules(updated);
      await saveEnabledModules(updated);

      console.info('[ModuleConfigContext] Enabled module:', moduleId);
    },
    [enabledModules, isModuleEnabled, saveEnabledModules]
  );

  const disableModule = useCallback(
    async (moduleId: string): Promise<void> => {
      const updated = enabledModules.filter((m) => m.moduleId !== moduleId);
      setEnabledModules(updated);
      await saveEnabledModules(updated);

      console.info('[ModuleConfigContext] Disabled module:', moduleId);
    },
    [enabledModules, saveEnabledModules]
  );

  const getMenuModules = useCallback((): string[] => {
    // Get enabled module IDs
    const enabledIds = enabledModules.map((m) => m.moduleId);

    // Get usage data for sorting
    const usageData = moduleUsageService.getModulesByUsage();
    const usageMap = new Map(usageData.map((u) => [u.moduleId, u.seconds]));

    // Sort by 24h usage time (descending)
    const sorted = [...enabledIds].sort((a, b) => {
      const usageA = usageMap.get(a) ?? 0;
      const usageB = usageMap.get(b) ?? 0;
      return usageB - usageA;
    });

    return sorted;
  }, [enabledModules]);

  const getEnabledModuleDefinition = useCallback(
    (moduleId: string): CountryModuleDefinition | undefined => {
      if (!isModuleEnabled(moduleId)) return undefined;
      return getModuleById(moduleId);
    },
    [isModuleEnabled]
  );

  const refresh = useCallback(async () => {
    await initialize();
  }, [initialize]);

  // ============================================================
  // Context Value
  // ============================================================

  const value = useMemo<ModuleConfigContextValue>(
    () => ({
      enabledModules,
      isModuleEnabled,
      enableModule,
      disableModule,
      getMenuModules,
      getEnabledModuleDefinition,
      userCountryCode,
      isLoading,
      refresh,
    }),
    [
      enabledModules,
      isModuleEnabled,
      enableModule,
      disableModule,
      getMenuModules,
      getEnabledModuleDefinition,
      userCountryCode,
      isLoading,
      refresh,
    ]
  );

  return (
    <ModuleConfigContext.Provider value={value}>
      {children}
    </ModuleConfigContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useModuleConfig(): ModuleConfigContextValue {
  const context = useContext(ModuleConfigContext);
  if (!context) {
    throw new Error('useModuleConfig must be used within ModuleConfigProvider');
  }
  return context;
}

/**
 * Hook to get available modules for discovery (settings)
 * Returns all modules grouped by country with enable status
 */
export function useAvailableModules(): {
  modulesByCountry: Record<string, Array<CountryModuleDefinition & { isEnabled: boolean }>>;
  userCountryCode: string | null;
} {
  const { enabledModules, userCountryCode } = useModuleConfig();

  const modulesByCountry = useMemo(() => {
    const allModules = getAllAvailableModules();
    const enabledIds = new Set(enabledModules.map((m) => m.moduleId));

    const groups: Record<string, Array<CountryModuleDefinition & { isEnabled: boolean }>> = {};

    for (const module of allModules) {
      if (!groups[module.countryCode]) {
        groups[module.countryCode] = [];
      }
      groups[module.countryCode].push({
        ...module,
        isEnabled: enabledIds.has(module.id),
      });
    }

    return groups;
  }, [enabledModules]);

  return { modulesByCountry, userCountryCode };
}
