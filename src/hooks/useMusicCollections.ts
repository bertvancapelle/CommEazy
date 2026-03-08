/**
 * useMusicCollections — React hook for music collection state management
 *
 * Provides CRUD operations with automatic state updates.
 * Follows the useContactGroups.ts pattern: load on mount, re-read after mutations.
 *
 * Collections are named groups of favorite songs. A song can belong
 * to multiple collections (many-to-many).
 */

import { useState, useCallback, useEffect } from 'react';
import type { MusicCollection } from '@/services/music';
import type { PlaylistImportProgress, PlaylistImportResult } from '@/services/music';
import {
  getCollections,
  createCollection as createCollectionService,
  renameCollection as renameCollectionService,
  deleteCollection as deleteCollectionService,
  addSongsToCollection as addSongsService,
  removeSongsFromCollection as removeSongsService,
  getCollectionsForSong as getCollectionsForSongService,
  importSinglePlaylist,
} from '@/services/music';

// ============================================================
// Types
// ============================================================

export interface UseMusicCollectionsReturn {
  /** All collections, sorted by most recently updated first */
  collections: MusicCollection[];
  /** Whether collections are being loaded */
  isLoading: boolean;
  /** Reload collections from storage */
  reload: () => Promise<void>;
  /** Create a new collection */
  create: (name: string, songCatalogIds?: string[]) => Promise<MusicCollection | undefined>;
  /** Rename a collection */
  rename: (collectionId: string, name: string) => Promise<boolean>;
  /** Delete a collection */
  remove: (collectionId: string) => Promise<boolean>;
  /** Add songs to a collection */
  addSongs: (collectionId: string, catalogIds: string[]) => Promise<boolean>;
  /** Remove songs from a collection */
  removeSongs: (collectionId: string, catalogIds: string[]) => Promise<boolean>;
  /** Get all collections that contain a specific song */
  getCollectionsForSong: (catalogId: string) => Promise<MusicCollection[]>;
  /** Whether an import is currently in progress */
  isImporting: boolean;
  /** Current import progress (null when not importing) */
  importProgress: PlaylistImportProgress | null;
  /** Import a single Apple Music playlist by ID */
  startSingleImport: (
    playlistId: string,
    playlistName: string,
    getPlaylistDetails: (playlistId: string) => Promise<any>,
  ) => Promise<PlaylistImportResult>;
}

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[useMusicCollections]';

// ============================================================
// Hook
// ============================================================

export function useMusicCollections(): UseMusicCollectionsReturn {
  const [collections, setCollections] = useState<MusicCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<PlaylistImportProgress | null>(null);

  // Load collections from storage
  const reload = useCallback(async () => {
    try {
      const loaded = await getCollections();
      setCollections(loaded);
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to load collections');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    reload();
  }, [reload]);

  // Create a new collection
  const create = useCallback(async (
    name: string,
    songCatalogIds?: string[],
  ): Promise<MusicCollection | undefined> => {
    try {
      const newCollection = await createCollectionService(name, songCatalogIds);
      await reload();
      return newCollection;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to create collection');
      return undefined;
    }
  }, [reload]);

  // Rename a collection
  const rename = useCallback(async (collectionId: string, name: string): Promise<boolean> => {
    try {
      const success = await renameCollectionService(collectionId, name);
      if (success) await reload();
      return success;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to rename collection');
      return false;
    }
  }, [reload]);

  // Delete a collection
  const remove = useCallback(async (collectionId: string): Promise<boolean> => {
    try {
      const success = await deleteCollectionService(collectionId);
      if (success) await reload();
      return success;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to delete collection');
      return false;
    }
  }, [reload]);

  // Add songs to a collection
  const addSongs = useCallback(async (collectionId: string, catalogIds: string[]): Promise<boolean> => {
    try {
      const success = await addSongsService(collectionId, catalogIds);
      if (success) await reload();
      return success;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to add songs to collection');
      return false;
    }
  }, [reload]);

  // Remove songs from a collection
  const removeSongs = useCallback(async (collectionId: string, catalogIds: string[]): Promise<boolean> => {
    try {
      const success = await removeSongsService(collectionId, catalogIds);
      if (success) await reload();
      return success;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to remove songs from collection');
      return false;
    }
  }, [reload]);

  // Get all collections containing a specific song (no state mutation needed)
  const getCollectionsForSong = useCallback(async (catalogId: string): Promise<MusicCollection[]> => {
    try {
      return await getCollectionsForSongService(catalogId);
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to get collections for song');
      return [];
    }
  }, []);

  // Import a single Apple Music playlist
  const startSingleImport = useCallback(async (
    playlistId: string,
    playlistName: string,
    getPlaylistDetails: (playlistId: string) => Promise<any>,
  ): Promise<PlaylistImportResult> => {
    setIsImporting(true);
    setImportProgress(null);
    try {
      const result = await importSinglePlaylist(
        playlistId,
        playlistName,
        getPlaylistDetails,
        (progress) => setImportProgress(progress),
      );
      await reload();
      return result;
    } catch (error) {
      console.error(LOG_PREFIX, 'Import failed');
      return { collectionsCreated: 0, songsAdded: 0, failures: 0 };
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  }, [reload]);

  return {
    collections,
    isLoading,
    reload,
    create,
    rename,
    remove,
    addSongs,
    removeSongs,
    getCollectionsForSong,
    isImporting,
    importProgress,
    startSingleImport,
  };
}
