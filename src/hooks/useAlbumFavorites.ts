/**
 * useAlbumFavorites — React hook for album favorites state management
 *
 * Provides CRUD operations with automatic state updates.
 * Follows the useMusicFavorites.ts pattern: load on mount, re-read after mutations.
 *
 * Albums are independent from song favorites and collections.
 */

import { useState, useCallback, useEffect } from 'react';
import type { MusicFavoriteAlbum } from '@/services/music';
import {
  getFavoriteAlbums,
  isFavoriteAlbum as isFavoriteAlbumService,
  addFavoriteAlbum as addFavoriteAlbumService,
  removeFavoriteAlbum as removeFavoriteAlbumService,
  toggleFavoriteAlbum as toggleFavoriteAlbumService,
  getFavoriteAlbumIds as getFavoriteAlbumIdsService,
} from '@/services/music';

// ============================================================
// Types
// ============================================================

export interface UseAlbumFavoritesReturn {
  /** All favorite albums, sorted by most recently added first */
  albums: MusicFavoriteAlbum[];
  /** Set of favorite album catalog IDs for quick lookup */
  albumIds: Set<string>;
  /** Whether favorites are being loaded */
  isLoading: boolean;
  /** Total count of favorite albums */
  count: number;
  /** Reload favorites from storage */
  reload: () => Promise<void>;
  /** Check if an album is a favorite (sync, uses in-memory Set) */
  isFavorite: (catalogId: string) => boolean;
  /** Add an album to favorites. Returns true if added. */
  add: (album: {
    catalogId: string;
    title: string;
    artistName: string;
    artworkUrl: string | null;
    trackCount: number;
  }) => Promise<boolean>;
  /** Remove an album from favorites. Returns true if removed. */
  remove: (catalogId: string) => Promise<boolean>;
  /** Toggle an album's favorite status. Returns new status (true = now favorite). */
  toggle: (album: {
    catalogId: string;
    title: string;
    artistName: string;
    artworkUrl: string | null;
    trackCount: number;
  }) => Promise<boolean>;
}

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[useAlbumFavorites]';

// ============================================================
// Hook
// ============================================================

export function useAlbumFavorites(isFocused?: boolean): UseAlbumFavoritesReturn {
  const [albums, setAlbums] = useState<MusicFavoriteAlbum[]>([]);
  const [albumIds, setAlbumIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Load favorites from storage
  const reload = useCallback(async () => {
    try {
      const [loaded, ids] = await Promise.all([
        getFavoriteAlbums(),
        getFavoriteAlbumIdsService(),
      ]);
      setAlbums(loaded);
      setAlbumIds(ids);
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to load favorite albums');
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
    return albumIds.has(catalogId);
  }, [albumIds]);

  // Add an album to favorites
  const add = useCallback(async (album: {
    catalogId: string;
    title: string;
    artistName: string;
    artworkUrl: string | null;
    trackCount: number;
  }): Promise<boolean> => {
    try {
      const added = await addFavoriteAlbumService(album);
      if (added) await reload();
      return added;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to add favorite album');
      return false;
    }
  }, [reload]);

  // Remove an album from favorites
  const remove = useCallback(async (catalogId: string): Promise<boolean> => {
    try {
      const removed = await removeFavoriteAlbumService(catalogId);
      if (removed) await reload();
      return removed;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to remove favorite album');
      return false;
    }
  }, [reload]);

  // Toggle an album's favorite status
  const toggle = useCallback(async (album: {
    catalogId: string;
    title: string;
    artistName: string;
    artworkUrl: string | null;
    trackCount: number;
  }): Promise<boolean> => {
    try {
      const isCurrentlyFavorite = albumIds.has(album.catalogId);

      if (isCurrentlyFavorite) {
        await removeFavoriteAlbumService(album.catalogId);
        await reload();
        return false;
      } else {
        await addFavoriteAlbumService(album);
        await reload();
        return true;
      }
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to toggle favorite album');
      return albumIds.has(album.catalogId);
    }
  }, [albumIds, reload]);

  return {
    albums,
    albumIds,
    isLoading,
    count: albums.length,
    reload,
    isFavorite,
    add,
    remove,
    toggle,
  };
}
