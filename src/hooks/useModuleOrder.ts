/**
 * useModuleOrder — React hook for HomeScreen grid module ordering
 *
 * Provides the ordered list of modules for the HomeScreen grid.
 * Supports custom ordering via drag & drop, persisted in AsyncStorage.
 *
 * Falls back to DEFAULT_MODULE_ORDER when no custom order exists.
 * Automatically merges new modules added to ALL_MODULES that aren't
 * in the saved order (appends them at the end).
 *
 * @see src/services/moduleOrderService.ts
 * @see src/screens/HomeScreen.tsx
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { NavigationDestination } from '@/components/WheelNavigationMenu';
import { ALL_MODULES } from '@/hooks/useModuleUsage';
import {
  getModuleOrder,
  saveModuleOrder,
  resetModuleOrder as resetModuleOrderService,
} from '@/services/moduleOrderService';

// ============================================================
// Types
// ============================================================

export interface UseModuleOrderReturn {
  /** Ordered list of moduleIds (user order or DEFAULT_MODULE_ORDER) */
  orderedModules: NavigationDestination[];
  /** Whether custom order is loaded from storage */
  isLoaded: boolean;
  /** Update module order (after drag & drop) */
  updateOrder: (newOrder: NavigationDestination[]) => Promise<void>;
  /** Reset to default order */
  resetOrder: () => Promise<void>;
}

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[useModuleOrder]';

/**
 * Default ordering for the HomeScreen grid.
 * Communication modules first, then media, then utilities.
 */
const DEFAULT_MODULE_ORDER: NavigationDestination[] = [
  'chats',
  'contacts',
  'radio',
  'calls',
  'groups',
  'camera',
  'photoAlbum',
  'weather',
  'appleMusic',
  'books',
  'podcast',
  'askAI',
  'agenda',
  'mail',
  'settings',
  'help',
];

// ============================================================
// Hook
// ============================================================

export function useModuleOrder(): UseModuleOrderReturn {
  const [customOrder, setCustomOrder] = useState<NavigationDestination[] | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved order on mount
  useEffect(() => {
    const load = async () => {
      try {
        const saved = await getModuleOrder();
        if (saved) {
          setCustomOrder(saved as NavigationDestination[]);
        }
      } catch (error) {
        console.error(LOG_PREFIX, 'Failed to load module order');
      } finally {
        setIsLoaded(true);
      }
    };

    load();
  }, []);

  // Merge saved order with ALL_MODULES to handle newly added modules
  const orderedModules = useMemo(() => {
    const baseOrder = customOrder ?? DEFAULT_MODULE_ORDER;

    // Start with saved order, filtered to only include modules that still exist
    const ordered: NavigationDestination[] = baseOrder.filter(
      (m) => ALL_MODULES.includes(m),
    );

    // Append any new modules not in the saved order
    for (const moduleId of ALL_MODULES) {
      if (!ordered.includes(moduleId)) {
        ordered.push(moduleId);
      }
    }

    return ordered;
  }, [customOrder]);

  // Save new order (called after drag & drop)
  const updateOrder = useCallback(async (newOrder: NavigationDestination[]) => {
    try {
      setCustomOrder(newOrder);
      await saveModuleOrder(newOrder);
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to update module order');
    }
  }, []);

  // Reset to default order
  const resetOrder = useCallback(async () => {
    try {
      setCustomOrder(null);
      await resetModuleOrderService();
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to reset module order');
    }
  }, []);

  return {
    orderedModules,
    isLoaded,
    updateOrder,
    resetOrder,
  };
}
