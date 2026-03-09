/**
 * useArtistFavorites — React hook for artist favorites state management
 *
 * Provides CRUD operations with automatic state updates.
 * Follows the useMusicFavorites.ts pattern: load on mount, re-read after mutations.
 *
 * Artists are independent from song and album favorites.
 */

import { useState, useCallback, useEffect } from 'react';
import type { MusicFavoriteArtist } from '@/services/music';
import {
  getFavoriteArtists,
  isFavoriteArtist as isFavoriteArtistService,
  addFavoriteArtist as addFavoriteArtistService,
  removeFavoriteArtist as removeFavoriteArtistService,
  toggleFavoriteArtist as toggleFavoriteArtistService,
  getFavoriteArtistIds as getFavoriteArtistIdsService,
} from '@/services/music';

// ============================================================
// Types
// ============================================================

export interface UseArtistFavoritesReturn {
  /** All favorite artists, sorted by most recently added first */
  artists: MusicFavoriteArtist[];
  /** Set of favorite artist catalog IDs for quick lookup */
  artistIds: Set<string>;
  /** Whether favorites are being loaded */
  isLoading: boolean;
  /** Total count of favorite artists */
  count: number;
  /** Reload favorites from storage */
  reload: () => Promise<void>;
  /** Check if an artist is a favorite (sync, uses in-memory Set) */
  isFavorite: (catalogId: string) => boolean;
  /** Add an artist to favorites. Returns true if added. */
  add: (artist: {
    catalogId: string;
    name: string;
    artworkUrl: string | null;
  }) => Promise<boolean>;
  /** Remove an artist from favorites. Returns true if removed. */
  remove: (catalogId: string) => Promise<boolean>;
  /** Toggle an artist's favorite status. Returns new status (true = now favorite). */
  toggle: (artist: {
    catalogId: string;
    name: string;
    artworkUrl: string | null;
  }) => Promise<boolean>;
}

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[useArtistFavorites]';

// ============================================================
// Hook
// ============================================================

export function useArtistFavorites(isFocused?: boolean): UseArtistFavoritesReturn {
  const [artists, setArtists] = useState<MusicFavoriteArtist[]>([]);
  const [artistIds, setArtistIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Load favorites from storage
  const reload = useCallback(async () => {
    try {
      const [loaded, ids] = await Promise.all([
        getFavoriteArtists(),
        getFavoriteArtistIdsService(),
      ]);
      setArtists(loaded);
      setArtistIds(ids);
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to load favorite artists');
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
    return artistIds.has(catalogId);
  }, [artistIds]);

  // Add an artist to favorites
  const add = useCallback(async (artist: {
    catalogId: string;
    name: string;
    artworkUrl: string | null;
  }): Promise<boolean> => {
    try {
      const added = await addFavoriteArtistService(artist);
      if (added) await reload();
      return added;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to add favorite artist');
      return false;
    }
  }, [reload]);

  // Remove an artist from favorites
  const remove = useCallback(async (catalogId: string): Promise<boolean> => {
    try {
      const removed = await removeFavoriteArtistService(catalogId);
      if (removed) await reload();
      return removed;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to remove favorite artist');
      return false;
    }
  }, [reload]);

  // Toggle an artist's favorite status
  const toggle = useCallback(async (artist: {
    catalogId: string;
    name: string;
    artworkUrl: string | null;
  }): Promise<boolean> => {
    try {
      const isCurrentlyFavorite = artistIds.has(artist.catalogId);

      if (isCurrentlyFavorite) {
        await removeFavoriteArtistService(artist.catalogId);
        await reload();
        return false;
      } else {
        await addFavoriteArtistService(artist);
        await reload();
        return true;
      }
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to toggle favorite artist');
      return artistIds.has(artist.catalogId);
    }
  }, [artistIds, reload]);

  return {
    artists,
    artistIds,
    isLoading,
    count: artists.length,
    reload,
    isFavorite,
    add,
    remove,
    toggle,
  };
}
