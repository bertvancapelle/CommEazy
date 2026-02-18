/**
 * useModuleUsage — Track and persist module usage for smart navigation ordering
 *
 * Tracks how often each module is accessed and persists to UserProfile.
 * Used by WheelNavigationMenu to show most-used modules first.
 *
 * Features:
 * - Persists usage counts to database (survives app restarts)
 * - Returns sorted modules by usage frequency
 * - Scalable for future module additions
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import { useCallback, useMemo, useEffect, useState } from 'react';
import { ServiceContainer } from '@/services/container';
import type { NavigationDestination } from '@/components/WheelNavigationMenu';

// Module usage counts stored in UserProfile
export interface ModuleUsageCounts {
  [moduleId: string]: number;
}

// Return type for the hook
interface UseModuleUsageReturn {
  /** Record module was accessed - call when navigating to a module */
  recordModuleUsage: (moduleId: NavigationDestination) => void;
  /** Get modules sorted by usage (most used first), excluding a specific module */
  getTopModules: (excludeModule: NavigationDestination | undefined, count: number) => NavigationDestination[];
  /** Get remaining modules not in top N */
  getRemainingModules: (excludeModule: NavigationDestination | undefined, topCount: number) => NavigationDestination[];
  /** Raw usage counts for debugging */
  usageCounts: ModuleUsageCounts;
  /** Whether data is loaded from database */
  isLoaded: boolean;
}

// All available modules - this list can grow as functionality expands
export const ALL_MODULES: NavigationDestination[] = [
  'chats',
  'contacts',
  'groups',
  'calls',
  'videocall',
  'podcast',
  'radio',
  'books',
  'settings',
  'help',
];

// Default ordering when no usage data exists
// Note: Menu shows 1 active module (top) + 4 other modules on first page
// Radio is prioritized as a key media feature for seniors
const DEFAULT_MODULE_ORDER: NavigationDestination[] = [
  'chats',      // Most common use case
  'contacts',   // Second most common
  'radio',      // Radio - key media feature, visible on first page
  'calls',      // Phone calls
  'groups',     // Groups
  'videocall',  // Video calls
  'books',      // Books - e-books from Gutenberg with optional TTS
  'podcast',    // Podcasts
  'settings',   // Settings
  'help',       // Help
];

export function useModuleUsage(): UseModuleUsageReturn {
  const [usageCounts, setUsageCounts] = useState<ModuleUsageCounts>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load usage counts from database on mount
  useEffect(() => {
    const loadUsage = async () => {
      try {
        // Wait for ServiceContainer to be initialized
        if (!ServiceContainer.isInitialized) {
          // Not initialized yet - use default order, will reload when ready
          setIsLoaded(true);
          return;
        }

        const db = ServiceContainer.database;
        const profile = await db.getUserProfile();

        if (profile?.moduleUsageCounts) {
          setUsageCounts(profile.moduleUsageCounts);
        }
        setIsLoaded(true);
      } catch (error) {
        console.error('[useModuleUsage] Failed to load usage counts:', error);
        setIsLoaded(true);
      }
    };

    loadUsage();
  }, []);

  // Record that a module was used
  const recordModuleUsage = useCallback(async (moduleId: NavigationDestination) => {
    setUsageCounts(prevCounts => {
      const newCounts = {
        ...prevCounts,
        [moduleId]: (prevCounts[moduleId] || 0) + 1,
      };

      // Persist to database asynchronously (if ServiceContainer is ready)
      if (ServiceContainer.isInitialized) {
        (async () => {
          try {
            const db = ServiceContainer.database;
            const profile = await db.getUserProfile();

            if (profile) {
              await db.saveUserProfile({
                ...profile,
                moduleUsageCounts: newCounts,
              });
            }
          } catch (error) {
            console.error('[useModuleUsage] Failed to save usage counts:', error);
          }
        })();
      }

      return newCounts;
    });
  }, []);

  // Get modules sorted by usage, excluding a specific module
  const getTopModules = useCallback((
    excludeModule: NavigationDestination | undefined,
    count: number
  ): NavigationDestination[] => {
    // Filter out the excluded module - always create a new array
    const availableModules = excludeModule
      ? ALL_MODULES.filter(m => m !== excludeModule)
      : [...ALL_MODULES];

    // If no usage data, use default ordering
    if (Object.keys(usageCounts).length === 0) {
      const defaultFiltered = DEFAULT_MODULE_ORDER.filter(m => m !== excludeModule);
      return defaultFiltered.slice(0, count);
    }

    // Sort by usage count (descending), then by default order for ties
    // Use slice() to create a copy before sorting (sort mutates in place)
    const sorted = [...availableModules].sort((a, b) => {
      const countA = usageCounts[a] || 0;
      const countB = usageCounts[b] || 0;

      if (countA !== countB) {
        return countB - countA; // Higher count first
      }

      // For ties, use default ordering
      const defaultIndexA = DEFAULT_MODULE_ORDER.indexOf(a);
      const defaultIndexB = DEFAULT_MODULE_ORDER.indexOf(b);
      return defaultIndexA - defaultIndexB;
    });

    return sorted.slice(0, count);
  }, [usageCounts]);

  // Get remaining modules not in top N
  const getRemainingModules = useCallback((
    excludeModule: NavigationDestination | undefined,
    topCount: number
  ): NavigationDestination[] => {
    const topModules = getTopModules(excludeModule, topCount);

    // Filter out excluded module and top modules
    const remaining = ALL_MODULES.filter(m =>
      m !== excludeModule && !topModules.includes(m)
    );

    // Sort remaining by usage count too
    if (Object.keys(usageCounts).length === 0) {
      const defaultFiltered = DEFAULT_MODULE_ORDER.filter(m =>
        m !== excludeModule && !topModules.includes(m)
      );
      return defaultFiltered;
    }

    // Use spread to create copy before sorting
    return [...remaining].sort((a, b) => {
      const countA = usageCounts[a] || 0;
      const countB = usageCounts[b] || 0;

      if (countA !== countB) {
        return countB - countA;
      }

      const defaultIndexA = DEFAULT_MODULE_ORDER.indexOf(a);
      const defaultIndexB = DEFAULT_MODULE_ORDER.indexOf(b);
      return defaultIndexA - defaultIndexB;
    });
  }, [usageCounts, getTopModules]);

  return {
    recordModuleUsage,
    getTopModules,
    getRemainingModules,
    usageCounts,
    isLoaded,
  };
}
