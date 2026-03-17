/**
 * useModuleOrder — React hook for HomeScreen grid module ordering
 *
 * Provides the ordered list of grid items for the HomeScreen grid.
 * Supports custom ordering via drag & drop, persisted in AsyncStorage.
 *
 * Grid items can be:
 * - NavigationDestination (individual module)
 * - CollectionReference (folder-style module grouping, e.g., 'collection:default_games')
 *
 * Modules that belong to a collection are excluded from the flat grid
 * and represented by their collection reference instead.
 *
 * Falls back to DEFAULT_GRID_ORDER when no custom order exists.
 * Automatically merges new modules added to ALL_MODULES that aren't
 * in the saved order (appends them at the end).
 *
 * @see src/services/moduleOrderService.ts
 * @see src/hooks/useModuleCollections.ts
 * @see src/screens/HomeScreen.tsx
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type {
  NavigationDestination,
  DynamicNavigationDestination,
  GridItem,
  CollectionReference,
  ModuleCollection,
} from '@/types/navigation';
import { isCollectionReference, isDynamicDestination } from '@/types/navigation';
import { ALL_MODULES } from '@/hooks/useModuleUsage';
import { useModuleConfig } from '@/contexts/ModuleConfigContext';
import {
  getModuleOrder,
  saveModuleOrder,
  resetModuleOrder as resetModuleOrderService,
} from '@/services/moduleOrderService';

// ============================================================
// Types
// ============================================================

export interface UseModuleOrderReturn {
  /** Ordered list of grid items (modules + collection references) */
  orderedModules: GridItem[];
  /** Whether custom order is loaded from storage */
  isLoaded: boolean;
  /** Update grid order (after drag & drop) */
  updateOrder: (newOrder: GridItem[]) => Promise<void>;
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
 * Game modules are grouped in the 'default_games' collection.
 */
const DEFAULT_GRID_ORDER: GridItem[] = [
  'chats',
  'contacts',
  'radio',
  'calls',
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
  'collection:default_games', // Spellen collection (5 game modules)
];

// ============================================================
// Hook
// ============================================================

export function useModuleOrder(
  collections?: ModuleCollection[],
): UseModuleOrderReturn {
  const [customOrder, setCustomOrder] = useState<GridItem[] | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const { enabledModules } = useModuleConfig();

  // Build set of enabled dynamic module destinations (e.g., 'module:nunl')
  const enabledDynamicDestinations = useMemo(() => {
    return new Set<DynamicNavigationDestination>(
      enabledModules.map((m) => `module:${m.moduleId}` as DynamicNavigationDestination)
    );
  }, [enabledModules]);

  // Load saved order on mount
  useEffect(() => {
    const load = async () => {
      try {
        const saved = await getModuleOrder();
        if (saved) {
          setCustomOrder(saved as GridItem[]);
        }
      } catch (error) {
        console.error(LOG_PREFIX, 'Failed to load module order');
      } finally {
        setIsLoaded(true);
      }
    };

    load();
  }, []);

  // Build set of module IDs that belong to a collection
  const collectionModuleIds = useMemo(() => {
    const ids = new Set<string>();
    if (collections) {
      for (const col of collections) {
        for (const moduleId of col.moduleIds) {
          ids.add(moduleId);
        }
      }
    }
    return ids;
  }, [collections]);

  // Build set of valid collection references
  const validCollectionRefs = useMemo(() => {
    const refs = new Set<string>();
    if (collections) {
      for (const col of collections) {
        refs.add(`collection:${col.id}`);
      }
    }
    return refs;
  }, [collections]);

  // Merge saved order with ALL_MODULES + enabled dynamic modules
  const orderedModules = useMemo(() => {
    const baseOrder = customOrder ?? DEFAULT_GRID_ORDER;

    // Filter base order to valid items only
    const ordered: GridItem[] = baseOrder.filter((item) => {
      if (isCollectionReference(item)) {
        // Keep collection references that still exist
        return validCollectionRefs.has(item);
      }
      // Keep static modules that still exist AND are not inside a collection
      if (ALL_MODULES.includes(item as NavigationDestination) &&
        !collectionModuleIds.has(item)) {
        return true;
      }
      // Keep enabled dynamic modules (e.g., 'module:nunl')
      if (isDynamicDestination(item as NavigationDestination) &&
        enabledDynamicDestinations.has(item as DynamicNavigationDestination)) {
        return true;
      }
      return false;
    });

    // Ensure all collection references are present
    for (const ref of validCollectionRefs) {
      if (!ordered.includes(ref as CollectionReference)) {
        ordered.push(ref as CollectionReference);
      }
    }

    // Append any standalone static modules not in the saved order and not in collections
    for (const moduleId of ALL_MODULES) {
      if (!ordered.includes(moduleId) && !collectionModuleIds.has(moduleId)) {
        ordered.push(moduleId);
      }
    }

    // Append any enabled dynamic modules not yet in the order
    for (const dest of enabledDynamicDestinations) {
      if (!ordered.includes(dest)) {
        ordered.push(dest);
      }
    }

    return ordered;
  }, [customOrder, collectionModuleIds, validCollectionRefs, enabledDynamicDestinations]);

  // Save new order (called after drag & drop)
  const updateOrder = useCallback(async (newOrder: GridItem[]) => {
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
