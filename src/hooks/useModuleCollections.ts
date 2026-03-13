/**
 * useModuleCollections — React hook for module collection management
 *
 * Provides CRUD operations for module collections (iOS folder-style grouping).
 * Collections group modules together in the HomeScreen grid.
 *
 * Features:
 * - Default "Spellen" collection with 5 game modules
 * - AsyncStorage persistence
 * - Safety rules: max 9 modules per collection, non-empty collections can't be deleted
 * - Default collections cannot be deleted
 *
 * @see src/types/navigation.ts — Collection types
 * @see .claude/plans/MODULE_COLLECTIONS_AND_GAMES.md
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  NavigationDestination,
  ModuleCollection,
} from '@/types/navigation';
import { MAX_MODULES_PER_COLLECTION } from '@/types/navigation';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[useModuleCollections]';
const STORAGE_KEY = '@commeazy/moduleCollections';

/**
 * Default collections — pre-configured groupings.
 * Default collections cannot be deleted by the user.
 */
const DEFAULT_COLLECTIONS: ModuleCollection[] = [
  {
    id: 'default_games',
    name: 'collections.games', // i18n key
    moduleIds: ['woordraad', 'sudoku', 'solitaire', 'memory', 'trivia'],
    isDefault: true,
    createdAt: 0, // sentinel: default
    updatedAt: 0,
  },
];

// ============================================================
// Types
// ============================================================

export interface UseModuleCollectionsReturn {
  /** All collections (default + user-created) */
  collections: ModuleCollection[];
  /** Whether collections are loaded from storage */
  isLoaded: boolean;

  // CRUD
  /** Create a new empty collection. Returns the created collection. */
  createCollection: (name: string) => ModuleCollection;
  /** Delete a collection. Returns false if not empty or is default. */
  deleteCollection: (id: string) => boolean;
  /** Rename a collection */
  renameCollection: (id: string, name: string) => void;

  // Module management
  /** Add a module to a collection. Returns false if collection is full (>= 9). */
  addModuleToCollection: (collectionId: string, moduleId: NavigationDestination) => boolean;
  /** Remove a module from a collection */
  removeModuleFromCollection: (collectionId: string, moduleId: NavigationDestination) => void;
  /** Move a module between collections */
  moveModuleBetweenCollections: (
    moduleId: NavigationDestination,
    fromId: string,
    toId: string,
  ) => void;

  // Queries
  /** Find which collection a module belongs to (null if not in any) */
  getCollectionForModule: (moduleId: NavigationDestination) => ModuleCollection | null;
  /** Check if a module is in any collection */
  isModuleInCollection: (moduleId: NavigationDestination) => boolean;

  // Utilities
  /** Reset to default collections (removes all user-created collections) */
  resetToDefaults: () => void;
}

// ============================================================
// Helpers
// ============================================================

/** Generate a simple unique ID for new collections */
function generateId(): string {
  return `col_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Merge loaded collections with defaults (forward-compatible) */
function mergeWithDefaults(loaded: ModuleCollection[]): ModuleCollection[] {
  const merged = [...loaded];

  for (const defaultCol of DEFAULT_COLLECTIONS) {
    const existing = merged.find((c) => c.id === defaultCol.id);
    if (!existing) {
      // Default collection not present — add it
      merged.push({ ...defaultCol });
    }
  }

  return merged;
}

// ============================================================
// Hook
// ============================================================

export function useModuleCollections(): UseModuleCollectionsReturn {
  const [collections, setCollections] = useState<ModuleCollection[]>(DEFAULT_COLLECTIONS);
  const [isLoaded, setIsLoaded] = useState(false);

  // ──────────────────────────────────────────────────────────
  // Load from AsyncStorage on mount
  // ──────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ModuleCollection[];
          if (Array.isArray(parsed)) {
            setCollections(mergeWithDefaults(parsed));
          }
        }
        // If no saved data, DEFAULT_COLLECTIONS is already set
      } catch (error) {
        console.error(LOG_PREFIX, 'Failed to load collections');
      } finally {
        setIsLoaded(true);
      }
    };

    load();
  }, []);

  // ──────────────────────────────────────────────────────────
  // Persist to AsyncStorage
  // ──────────────────────────────────────────────────────────

  const persist = useCallback(async (updated: ModuleCollection[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to persist collections');
    }
  }, []);

  // ──────────────────────────────────────────────────────────
  // CRUD Operations
  // ──────────────────────────────────────────────────────────

  const createCollection = useCallback(
    (name: string): ModuleCollection => {
      const newCollection: ModuleCollection = {
        id: generateId(),
        name,
        moduleIds: [],
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const updated = [...collections, newCollection];
      setCollections(updated);
      persist(updated);

      console.debug(LOG_PREFIX, 'Created collection', { id: newCollection.id, name });
      return newCollection;
    },
    [collections, persist],
  );

  const deleteCollection = useCallback(
    (id: string): boolean => {
      const collection = collections.find((c) => c.id === id);
      if (!collection) return false;

      // Safety: cannot delete default collections
      if (collection.isDefault) {
        console.warn(LOG_PREFIX, 'Cannot delete default collection', { id });
        return false;
      }

      // Safety: cannot delete non-empty collections
      if (collection.moduleIds.length > 0) {
        console.warn(LOG_PREFIX, 'Cannot delete non-empty collection', {
          id,
          count: collection.moduleIds.length,
        });
        return false;
      }

      const updated = collections.filter((c) => c.id !== id);
      setCollections(updated);
      persist(updated);

      console.debug(LOG_PREFIX, 'Deleted collection', { id });
      return true;
    },
    [collections, persist],
  );

  const renameCollection = useCallback(
    (id: string, name: string) => {
      const updated = collections.map((c) =>
        c.id === id ? { ...c, name, updatedAt: Date.now() } : c,
      );
      setCollections(updated);
      persist(updated);
    },
    [collections, persist],
  );

  // ──────────────────────────────────────────────────────────
  // Module Management
  // ──────────────────────────────────────────────────────────

  const addModuleToCollection = useCallback(
    (collectionId: string, moduleId: NavigationDestination): boolean => {
      const collection = collections.find((c) => c.id === collectionId);
      if (!collection) return false;

      // Safety: max 9 modules per collection
      if (collection.moduleIds.length >= MAX_MODULES_PER_COLLECTION) {
        console.warn(LOG_PREFIX, 'Collection full', {
          id: collectionId,
          max: MAX_MODULES_PER_COLLECTION,
        });
        return false;
      }

      // Don't add duplicates
      if (collection.moduleIds.includes(moduleId)) return true;

      const updated = collections.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              moduleIds: [...c.moduleIds, moduleId],
              updatedAt: Date.now(),
            }
          : c,
      );
      setCollections(updated);
      persist(updated);

      return true;
    },
    [collections, persist],
  );

  const removeModuleFromCollection = useCallback(
    (collectionId: string, moduleId: NavigationDestination) => {
      const updated = collections.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              moduleIds: c.moduleIds.filter((m) => m !== moduleId),
              updatedAt: Date.now(),
            }
          : c,
      );
      setCollections(updated);
      persist(updated);
    },
    [collections, persist],
  );

  const moveModuleBetweenCollections = useCallback(
    (moduleId: NavigationDestination, fromId: string, toId: string) => {
      const toCollection = collections.find((c) => c.id === toId);
      if (!toCollection) return;

      // Safety: check target isn't full
      if (toCollection.moduleIds.length >= MAX_MODULES_PER_COLLECTION) {
        console.warn(LOG_PREFIX, 'Target collection full', { toId });
        return;
      }

      const updated = collections.map((c) => {
        if (c.id === fromId) {
          return {
            ...c,
            moduleIds: c.moduleIds.filter((m) => m !== moduleId),
            updatedAt: Date.now(),
          };
        }
        if (c.id === toId) {
          if (c.moduleIds.includes(moduleId)) return c;
          return {
            ...c,
            moduleIds: [...c.moduleIds, moduleId],
            updatedAt: Date.now(),
          };
        }
        return c;
      });
      setCollections(updated);
      persist(updated);
    },
    [collections, persist],
  );

  // ──────────────────────────────────────────────────────────
  // Queries
  // ──────────────────────────────────────────────────────────

  const getCollectionForModule = useCallback(
    (moduleId: NavigationDestination): ModuleCollection | null => {
      return collections.find((c) => c.moduleIds.includes(moduleId)) ?? null;
    },
    [collections],
  );

  const isModuleInCollection = useCallback(
    (moduleId: NavigationDestination): boolean => {
      return collections.some((c) => c.moduleIds.includes(moduleId));
    },
    [collections],
  );

  // ──────────────────────────────────────────────────────────
  // Utilities
  // ──────────────────────────────────────────────────────────

  const resetToDefaults = useCallback(() => {
    const defaults = DEFAULT_COLLECTIONS.map((c) => ({ ...c }));
    setCollections(defaults);
    persist(defaults);
    console.debug(LOG_PREFIX, 'Reset collections to defaults');
  }, [persist]);

  return {
    collections,
    isLoaded,
    createCollection,
    deleteCollection,
    renameCollection,
    addModuleToCollection,
    removeModuleFromCollection,
    moveModuleBetweenCollections,
    getCollectionForModule,
    isModuleInCollection,
    resetToDefaults,
  };
}
