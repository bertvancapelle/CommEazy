/**
 * Playlist Import Service — Import & auto-sync Apple Music playlists
 *
 * Handles two flows:
 * 1. First-use import: fetch all playlists → create MusicCollections + MusicFavorites
 * 2. Background sync: re-fetch linked playlists → silently update collections
 *
 * Senior-inclusive design:
 * - Progress callback for UI feedback during import
 * - Parallel fetching (max 5 concurrent) for speed
 * - Graceful error handling per playlist (skip failures, continue)
 *
 * @see musicCollectionService.ts
 * @see musicFavoritesService.ts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createCollectionFromPlaylist,
  getLinkedCollections,
  getCollectionByPlaylistId,
  syncCollection,
} from './musicCollectionService';
import { addFavorite } from './musicFavoritesService';
import type { AppleMusicPlaylist, PlaylistDetails } from '@/contexts/appleMusicContextTypes';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[playlistImportService]';
const IMPORT_DONE_KEY = '@commeazy/playlistImportDone';
const MAX_CONCURRENT = 5;

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
// Parallel Helper
// ============================================================

/**
 * Execute async tasks in parallel with concurrency limit.
 */
async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function next(): Promise<void> {
    const currentIndex = index++;
    if (currentIndex >= items.length) return;
    results[currentIndex] = await fn(items[currentIndex], currentIndex);
    await next();
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}

// ============================================================
// Import Flow
// ============================================================

/**
 * Import all Apple Music playlists as MusicCollections.
 *
 * Flow:
 * 1. Fetch all playlists via getLibraryPlaylists
 * 2. For each: fetch tracks via getPlaylistDetails
 * 3. Add all tracks as MusicFavorites (deduplicated)
 * 4. Create MusicCollection linked to the playlist
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

  // Step 2: Import each playlist (parallel with limit)
  await parallelLimit(allPlaylists, MAX_CONCURRENT, async (playlist, index) => {
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
        return;
      }

      // Fetch tracks
      const details = await getPlaylistDetails(playlist.id);
      const trackCatalogIds: string[] = [];

      // Add each track as favorite (deduplicated by addFavorite)
      for (const track of details.tracks) {
        await addFavorite({
          catalogId: track.id,
          title: track.title,
          artistName: track.artistName,
          artworkUrl: track.artworkUrl || null,
          albumTitle: track.albumTitle,
        });
        trackCatalogIds.push(track.id);
        result.songsAdded++;
      }

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
  });

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
 * For each linked collection:
 * - Re-fetch playlist details
 * - Update collection name if changed
 * - Add new tracks as favorites
 * - Update collection song list (add new, remove deleted)
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

    // Sync existing linked collections
    await parallelLimit(linkedCollections, MAX_CONCURRENT, async (collection) => {
      if (!collection.sourcePlaylistId) return;

      try {
        const details = await getPlaylistDetails(collection.sourcePlaylistId);
        const newCatalogIds = details.tracks.map(t => t.id);

        // Add new tracks as favorites
        for (const track of details.tracks) {
          await addFavorite({
            catalogId: track.id,
            title: track.title,
            artistName: track.artistName,
            artworkUrl: track.artworkUrl || null,
            albumTitle: track.albumTitle,
          });
        }

        // Update collection (name + song list)
        await syncCollection(collection.id, details.name, newCatalogIds);
      } catch (error) {
        console.warn(LOG_PREFIX, 'Failed to sync collection', { id: collection.id });
      }
    });

    // Import new playlists that don't have a linked collection yet
    const newPlaylists = allPlaylists.filter(p => !linkedPlaylistIds.has(p.id));
    if (newPlaylists.length > 0) {
      console.debug(LOG_PREFIX, 'New playlists detected', { count: newPlaylists.length });

      await parallelLimit(newPlaylists, MAX_CONCURRENT, async (playlist) => {
        try {
          const details = await getPlaylistDetails(playlist.id);
          const trackCatalogIds: string[] = [];

          for (const track of details.tracks) {
            await addFavorite({
              catalogId: track.id,
              title: track.title,
              artistName: track.artistName,
              artworkUrl: track.artworkUrl || null,
              albumTitle: track.albumTitle,
            });
            trackCatalogIds.push(track.id);
          }

          await createCollectionFromPlaylist(
            playlist.name,
            playlist.id,
            trackCatalogIds,
          );
        } catch (error) {
          console.warn(LOG_PREFIX, 'Failed to import new playlist', { name: playlist.name });
        }
      });
    }

    console.debug(LOG_PREFIX, 'Background sync complete');
  } catch (error) {
    console.error(LOG_PREFIX, 'Background sync failed');
  }
}
