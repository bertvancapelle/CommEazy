/**
 * useMusicFavorites — React hook for music favorites state management
 *
 * Provides CRUD operations with automatic state updates.
 * Follows the useContactGroups.ts pattern: load on mount, re-read after mutations.
 *
 * When a song is unfavorited, it is also removed from all collections
 * to keep references clean (collections only contain favorites).
 */

import { useState, useCallback, useEffect } from 'react';
import type { MusicFavorite } from '@/services/music';
import {
  getFavorites,
  isFavorite as isFavoriteService,
  addFavorite as addFavoriteService,
  removeFavorite as removeFavoriteService,
  toggleFavorite as toggleFavoriteService,
  getFavoritesCount,
  getFavoriteIds as getFavoriteIdsService,
  removeSongFromAllCollections,
} from '@/services/music';

// ============================================================
// Types
// ============================================================

export interface UseMusicFavoritesReturn {
  /** All favorites, sorted by most recently added first */
  favorites: MusicFavorite[];
  /** Set of favorite catalog IDs for quick lookup */
  favoriteIds: Set<string>;
  /** Whether favorites are being loaded */
  isLoading: boolean;
  /** Total count of favorites */
  count: number;
  /** Reload favorites from storage */
  reload: () => Promise<void>;
  /** Check if a song is a favorite */
  isFavorite: (catalogId: string) => boolean;
  /** Add a song to favorites. Returns true if added. */
  add: (song: {
    catalogId: string;
    title: string;
    artistName: string;
    artworkUrl: string | null;
    albumTitle?: string;
  }) => Promise<boolean>;
  /** Remove a song from favorites AND from all collections. Returns true if removed. */
  remove: (catalogId: string) => Promise<boolean>;
  /** Toggle a song's favorite status. Returns new status (true = now favorite). */
  toggle: (song: {
    catalogId: string;
    title: string;
    artistName: string;
    artworkUrl: string | null;
    albumTitle?: string;
  }) => Promise<boolean>;
}

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[useMusicFavorites]';

// ============================================================
// Hook
// ============================================================

export function useMusicFavorites(isFocused?: boolean): UseMusicFavoritesReturn {
  const [favorites, setFavorites] = useState<MusicFavorite[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Load favorites from storage
  const reload = useCallback(async () => {
    try {
      const [loaded, ids] = await Promise.all([
        getFavorites(),
        getFavoriteIdsService(),
      ]);
      setFavorites(loaded);
      setFavoriteIds(ids);
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to load favorites');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount + reload when screen regains focus
  useEffect(() => {
    if (isFocused === undefined || isFocused) {
      reload();
    }
  }, [reload, isFocused]);

  // Quick sync lookup (uses in-memory Set, no async needed)
  const isFavorite = useCallback((catalogId: string): boolean => {
    return favoriteIds.has(catalogId);
  }, [favoriteIds]);

  // Add a song to favorites
  const add = useCallback(async (song: {
    catalogId: string;
    title: string;
    artistName: string;
    artworkUrl: string | null;
    albumTitle?: string;
  }): Promise<boolean> => {
    try {
      const added = await addFavoriteService(song);
      if (added) await reload();
      return added;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to add favorite');
      return false;
    }
  }, [reload]);

  // Remove a song from favorites AND from all collections
  const remove = useCallback(async (catalogId: string): Promise<boolean> => {
    try {
      const removed = await removeFavoriteService(catalogId);
      if (removed) {
        // Also remove from all collections to keep references clean
        await removeSongFromAllCollections(catalogId);
        await reload();
      }
      return removed;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to remove favorite');
      return false;
    }
  }, [reload]);

  // Toggle a song's favorite status
  const toggle = useCallback(async (song: {
    catalogId: string;
    title: string;
    artistName: string;
    artworkUrl: string | null;
    albumTitle?: string;
  }): Promise<boolean> => {
    try {
      const isCurrentlyFavorite = favoriteIds.has(song.catalogId);

      if (isCurrentlyFavorite) {
        // Removing — also clean up collections
        await removeFavoriteService(song.catalogId);
        await removeSongFromAllCollections(song.catalogId);
        await reload();
        return false;
      } else {
        await addFavoriteService(song);
        await reload();
        return true;
      }
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to toggle favorite');
      return favoriteIds.has(song.catalogId);
    }
  }, [favoriteIds, reload]);

  return {
    favorites,
    favoriteIds,
    isLoading,
    count: favorites.length,
    reload,
    isFavorite,
    add,
    remove,
    toggle,
  };
}
