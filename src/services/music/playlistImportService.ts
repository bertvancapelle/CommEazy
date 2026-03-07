/**
 * Playlist Import Service — Import & auto-sync Apple Music playlists
 *
 * Handles two flows:
 * 1. First-use import: fetch all playlists → create MusicCollections + MusicFavorites
 * 2. Background sync: re-fetch linked playlists → silently update collections
 *
 * Senior-inclusive design:
 * - Progress callback for UI feedback during import
 * - Sequential processing with batch writes (prevents UI freezes)
 * - InteractionManager pauses between playlists (keeps app responsive)
 * - Graceful error handling per playlist (skip failures, continue)
 *
 * @see musicCollectionService.ts
 * @see musicFavoritesService.ts
 */

import { InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createCollectionFromPlaylist,
  getLinkedCollections,
  getCollectionByPlaylistId,
  syncCollection,
} from './musicCollectionService';
import { addFavoritesBatch } from './musicFavoritesService';
import type { AppleMusicPlaylist, PlaylistDetails } from '@/contexts/appleMusicContextTypes';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[playlistImportService]';
const IMPORT_DONE_KEY = '@commeazy/playlistImportDone';

/**
 * Pause between playlists to let the UI thread breathe.
 * Returns a promise that resolves after pending interactions + a small delay.
 */
function yieldToUI(): Promise<void> {
  return new Promise(resolve => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, 50);
    });
  });
}

// ============================================================
// Types
// ============================================================

export interface PlaylistImportProgress {
  /** Current playlist being imported (0-based index) */
  current: number;
  /** Total number of playlists to import */
  total: number;
  /** Name of the playlist currently being imported */
  currentName: string;
  /** Number of tracks in the current playlist (available after fetch) */
  currentTrackCount?: number;
}

export interface PlaylistImportResult {
  /** Number of collections created */
  collectionsCreated: number;
  /** Number of songs added to favorites */
  songsAdded: number;
  /** Number of playlists that failed to import */
  failures: number;
}

// ============================================================
// Import Status
// ============================================================

/**
 * Check if the initial playlist import has been completed.
 */
export async function isImportDone(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(IMPORT_DONE_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark the initial import as completed.
 */
export async function markImportDone(): Promise<void> {
  await AsyncStorage.setItem(IMPORT_DONE_KEY, 'true');
}

/**
 * Reset import status (for testing/debugging).
 */
export async function resetImportStatus(): Promise<void> {
  await AsyncStorage.removeItem(IMPORT_DONE_KEY);
}

// ============================================================
// Import Flow
// ============================================================

/**
 * Import all Apple Music playlists as MusicCollections.
 *
 * Flow:
 * 1. Fetch all playlists via getLibraryPlaylists
 * 2. For each playlist (sequentially, to avoid race conditions):
 *    a. Fetch tracks via getPlaylistDetails
 *    b. Batch-add all tracks as MusicFavorites (1 AsyncStorage write per playlist)
 *    c. Create MusicCollection linked to the playlist
 *    d. Yield to UI thread (InteractionManager + 50ms pause)
 *
 * Performance: Sequential processing with batch writes eliminates the O(n²)
 * per-song read/write pattern that caused UI freezes on large libraries.
 *
 * @param getLibraryPlaylists - Context function to fetch playlists
 * @param getPlaylistDetails - Context function to fetch playlist tracks
 * @param onProgress - Progress callback for UI
 */
export async function importAllPlaylists(
  getLibraryPlaylists: (limit?: number, offset?: number) => Promise<{ items: AppleMusicPlaylist[]; total: number }>,
  getPlaylistDetails: (playlistId: string) => Promise<PlaylistDetails>,
  onProgress?: (progress: PlaylistImportProgress) => void,
): Promise<PlaylistImportResult> {
  const result: PlaylistImportResult = {
    collectionsCreated: 0,
    songsAdded: 0,
    failures: 0,
  };

  // Step 1: Fetch all playlists (paginated)
  let allPlaylists: AppleMusicPlaylist[] = [];
  let offset = 0;
  const pageSize = 50;

  try {
    let hasMore = true;
    while (hasMore) {
      const page = await getLibraryPlaylists(pageSize, offset);
      allPlaylists = [...allPlaylists, ...page.items];
      offset += pageSize;
      hasMore = page.items.length === pageSize && allPlaylists.length < page.total;
    }
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to fetch playlists');
    return result;
  }

  if (allPlaylists.length === 0) {
    console.debug(LOG_PREFIX, 'No playlists found');
    await markImportDone();
    return result;
  }

  console.debug(LOG_PREFIX, 'Found playlists to import', { count: allPlaylists.length });

  // Step 2: Import each playlist sequentially (prevents AsyncStorage race conditions)
  for (let index = 0; index < allPlaylists.length; index++) {
    const playlist = allPlaylists[index];

    onProgress?.({
      current: index,
      total: allPlaylists.length,
      currentName: playlist.name,
    });

    try {
      // Check if already imported
      const existing = await getCollectionByPlaylistId(playlist.id);
      if (existing) {
        console.debug(LOG_PREFIX, 'Playlist already imported, skipping', { name: playlist.name });
        continue;
      }

      // Fetch tracks
      const details = await getPlaylistDetails(playlist.id);
      console.debug(LOG_PREFIX, 'Playlist tracks fetched', { name: playlist.name, trackCount: details.tracks.length });

      // Update progress with track count
      onProgress?.({
        current: index,
        total: allPlaylists.length,
        currentName: playlist.name,
        currentTrackCount: details.tracks.length,
      });

      // Batch-add all tracks as favorites (1 read + 1 write instead of N reads + N writes)
      const songsToAdd = details.tracks.map(track => ({
        catalogId: track.id,
        title: track.title,
        artistName: track.artistName,
        artworkUrl: track.artworkUrl || null,
        albumTitle: track.albumTitle,
      }));
      const addedCount = await addFavoritesBatch(songsToAdd);
      result.songsAdded += addedCount;

      const trackCatalogIds = details.tracks.map(t => t.id);

      // Create linked collection
      await createCollectionFromPlaylist(
        playlist.name,
        playlist.id,
        trackCatalogIds,
      );
      result.collectionsCreated++;
    } catch (error) {
      console.warn(LOG_PREFIX, 'Failed to import playlist', { name: playlist.name });
      result.failures++;
    }

    // Yield to UI thread between playlists so app stays responsive
    await yieldToUI();
  }

  // Final progress update
  onProgress?.({
    current: allPlaylists.length,
    total: allPlaylists.length,
    currentName: '',
  });

  await markImportDone();

  console.info(LOG_PREFIX, 'Import complete', {
    collections: result.collectionsCreated,
    songs: result.songsAdded,
    failures: result.failures,
  });

  return result;
}

// ============================================================
// Background Sync
// ============================================================

/**
 * Sync all linked collections with their Apple Music source playlists.
 * Runs silently in the background — no UI, no user confirmation.
 *
 * For each linked collection (sequentially to avoid AsyncStorage race conditions):
 * - Re-fetch playlist details
 * - Batch-add new tracks as favorites
 * - Update collection song list (add new, remove deleted)
 * - Yield to UI thread between playlists
 *
 * Also detects new playlists created in Apple Music since last import
 * and imports them automatically.
 */
export async function syncAllLinkedCollections(
  getLibraryPlaylists: (limit?: number, offset?: number) => Promise<{ items: AppleMusicPlaylist[]; total: number }>,
  getPlaylistDetails: (playlistId: string) => Promise<PlaylistDetails>,
): Promise<void> {
  try {
    // Fetch current Apple Music playlists
    let allPlaylists: AppleMusicPlaylist[] = [];
    let offset = 0;
    const pageSize = 50;

    let hasMore = true;
    while (hasMore) {
      const page = await getLibraryPlaylists(pageSize, offset);
      allPlaylists = [...allPlaylists, ...page.items];
      offset += pageSize;
      hasMore = page.items.length === pageSize && allPlaylists.length < page.total;
    }

    // Get existing linked collections
    const linkedCollections = await getLinkedCollections();
    const linkedPlaylistIds = new Set(linkedCollections.map(c => c.sourcePlaylistId!));

    // Sync existing linked collections sequentially
    for (const collection of linkedCollections) {
      if (!collection.sourcePlaylistId) continue;

      try {
        const details = await getPlaylistDetails(collection.sourcePlaylistId);
        const newCatalogIds = details.tracks.map(t => t.id);

        // Batch-add new tracks as favorites
        const songsToAdd = details.tracks.map(track => ({
          catalogId: track.id,
          title: track.title,
          artistName: track.artistName,
          artworkUrl: track.artworkUrl || null,
          albumTitle: track.albumTitle,
        }));
        await addFavoritesBatch(songsToAdd);

        // Update collection (name + song list)
        await syncCollection(collection.id, details.name, newCatalogIds);
      } catch (error) {
        console.warn(LOG_PREFIX, 'Failed to sync collection', { id: collection.id });
      }

      await yieldToUI();
    }

    // Import new playlists that don't have a linked collection yet
    const newPlaylists = allPlaylists.filter(p => !linkedPlaylistIds.has(p.id));
    if (newPlaylists.length > 0) {
      console.debug(LOG_PREFIX, 'New playlists detected', { count: newPlaylists.length });

      for (const playlist of newPlaylists) {
        try {
          const details = await getPlaylistDetails(playlist.id);

          // Batch-add all tracks as favorites
          const songsToAdd = details.tracks.map(track => ({
            catalogId: track.id,
            title: track.title,
            artistName: track.artistName,
            artworkUrl: track.artworkUrl || null,
            albumTitle: track.albumTitle,
          }));
          await addFavoritesBatch(songsToAdd);

          const trackCatalogIds = details.tracks.map(t => t.id);
          await createCollectionFromPlaylist(
            playlist.name,
            playlist.id,
            trackCatalogIds,
          );
        } catch (error) {
          console.warn(LOG_PREFIX, 'Failed to import new playlist', { name: playlist.name });
        }

        await yieldToUI();
      }
    }

    console.debug(LOG_PREFIX, 'Background sync complete');
  } catch (error) {
    console.error(LOG_PREFIX, 'Background sync failed');
  }
}
