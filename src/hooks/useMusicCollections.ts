/**
 * useMusicCollections — React hook for music collection state management
 *
 * Provides CRUD operations with automatic state updates.
 * Follows the useContactGroups.ts pattern: load on mount, re-read after mutations.
 *
 * Collections are named groups of favorite songs. A song can belong
 * to multiple collections (many-to-many).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
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
  isImportDone as isImportDoneService,
  importAllPlaylists,
  syncAllLinkedCollections,
  deleteAllLinkedCollections as deleteAllLinkedService,
  getLinkedCollections as getLinkedCollectionsService,
  getLastSyncTimestamp as getLastSyncTimestampService,
  resetImportStatus as resetImportStatusService,
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
  /** Whether the initial playlist import has been completed */
  importDone: boolean;
  /** Whether an import is currently in progress */
  isImporting: boolean;
  /** Current import progress (null when not importing) */
  importProgress: PlaylistImportProgress | null;
  /** Start importing all Apple Music playlists */
  startImport: (
    getLibraryPlaylists: (limit?: number, offset?: number) => Promise<{ items: any[]; total: number }>,
    getPlaylistDetails: (playlistId: string) => Promise<any>,
  ) => Promise<PlaylistImportResult>;
  /** Sync all linked collections in the background */
  backgroundSync: (
    getLibraryPlaylists: (limit?: number, offset?: number) => Promise<{ items: any[]; total: number }>,
    getPlaylistDetails: (playlistId: string) => Promise<any>,
  ) => Promise<void>;
  /** Disable sync: delete all linked collections + reset import status */
  disableSync: () => Promise<number>;
  /** Enable sync: reset import status so modal reappears */
  enableSync: () => Promise<void>;
  /** Get count of linked (imported from Apple Music) collections */
  getLinkedCount: () => Promise<number>;
  /** Get timestamp of most recent sync */
  getLastSyncTimestamp: () => Promise<number | null>;
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
  const [importDone, setImportDone] = useState(true); // Default true to avoid flash
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<PlaylistImportProgress | null>(null);
  const syncInProgress = useRef(false);

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

  // Load on mount + check import status
  useEffect(() => {
    const init = async () => {
      await reload();
      const done = await isImportDoneService();
      setImportDone(done);
    };
    init();
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

  // Start importing all Apple Music playlists
  const startImport = useCallback(async (
    getLibraryPlaylists: (limit?: number, offset?: number) => Promise<{ items: any[]; total: number }>,
    getPlaylistDetails: (playlistId: string) => Promise<any>,
  ): Promise<PlaylistImportResult> => {
    setIsImporting(true);
    setImportProgress(null);
    try {
      const result = await importAllPlaylists(
        getLibraryPlaylists,
        getPlaylistDetails,
        (progress) => setImportProgress(progress),
      );
      setImportDone(true);
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

  // Sync all linked collections in the background
  const backgroundSync = useCallback(async (
    getLibraryPlaylists: (limit?: number, offset?: number) => Promise<{ items: any[]; total: number }>,
    getPlaylistDetails: (playlistId: string) => Promise<any>,
  ): Promise<void> => {
    // Prevent concurrent syncs
    if (syncInProgress.current) return;
    syncInProgress.current = true;

    try {
      await syncAllLinkedCollections(getLibraryPlaylists, getPlaylistDetails);
      await reload();
    } catch (error) {
      console.error(LOG_PREFIX, 'Background sync failed');
    } finally {
      syncInProgress.current = false;
    }
  }, [reload]);

  // Disable sync: delete all linked collections + reset import status
  const disableSync = useCallback(async (): Promise<number> => {
    try {
      const count = await deleteAllLinkedService();
      await resetImportStatusService();
      setImportDone(false);
      await reload();
      return count;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to disable sync');
      return 0;
    }
  }, [reload]);

  // Enable sync: reset import status so modal reappears on next Apple Music visit
  const enableSync = useCallback(async (): Promise<void> => {
    try {
      await resetImportStatusService();
      setImportDone(false);
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to enable sync');
    }
  }, []);

  // Get count of linked collections
  const getLinkedCount = useCallback(async (): Promise<number> => {
    try {
      const linked = await getLinkedCollectionsService();
      return linked.length;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to get linked count');
      return 0;
    }
  }, []);

  // Get last sync timestamp
  const getLastSyncTimestamp = useCallback(async (): Promise<number | null> => {
    try {
      return await getLastSyncTimestampService();
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to get last sync timestamp');
      return null;
    }
  }, []);

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
    importDone,
    isImporting,
    importProgress,
    startImport,
    backgroundSync,
    disableSync,
    enableSync,
    getLinkedCount,
    getLastSyncTimestamp,
  };
}
