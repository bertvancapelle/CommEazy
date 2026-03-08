/**
 * Playlist Import Service — Import Apple Music playlists as MusicCollections
 *
 * Supports per-playlist snapshot import (user-initiated, one-time).
 * No automatic sync — user chooses which playlists to import.
 *
 * Senior-inclusive design:
 * - Progress callback for UI feedback during import
 * - Batch writes (prevents UI freezes)
 * - InteractionManager pauses to keep app responsive
 * - Graceful error handling (partial import preserved)
 *
 * @see musicCollectionService.ts
 * @see musicFavoritesService.ts
 */

import { InteractionManager } from 'react-native';
import {
  createCollectionFromPlaylist,
  getCollectionByPlaylistId,
} from './musicCollectionService';
import { addFavoritesBatch } from './musicFavoritesService';
import type { PlaylistDetails } from '@/contexts/appleMusicContextTypes';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[playlistImportService]';

/**
 * Pause to let the UI thread breathe.
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
  /** Current track being imported (1-based for display) */
  current: number;
  /** Total number of tracks to import */
  total: number;
  /** Name of the playlist being imported */
  currentName: string;
  /** Number of tracks in the playlist */
  currentTrackCount?: number;
}

export interface PlaylistImportResult {
  /** Number of collections created (0 or 1 for single import) */
  collectionsCreated: number;
  /** Number of songs added to favorites */
  songsAdded: number;
  /** Number of tracks that failed to import */
  failures: number;
}

// ============================================================
// Single Playlist Import
// ============================================================

/**
 * Import a single Apple Music playlist as a MusicCollection.
 *
 * Flow:
 * 1. Fetch playlist tracks via getPlaylistDetails
 * 2. Batch-add all tracks as MusicFavorites
 * 3. Create MusicCollection linked to the playlist
 * 4. Yield to UI thread periodically
 *
 * @param playlistId - Apple Music playlist ID
 * @param playlistName - Display name of the playlist
 * @param getPlaylistDetails - Context function to fetch playlist tracks
 * @param onProgress - Progress callback for UI (track-level progress)
 */
export async function importSinglePlaylist(
  playlistId: string,
  playlistName: string,
  getPlaylistDetails: (playlistId: string) => Promise<PlaylistDetails>,
  onProgress?: (progress: PlaylistImportProgress) => void,
): Promise<PlaylistImportResult> {
  const result: PlaylistImportResult = {
    collectionsCreated: 0,
    songsAdded: 0,
    failures: 0,
  };

  try {
    // Check if already imported
    const existing = await getCollectionByPlaylistId(playlistId);
    if (existing) {
      console.debug(LOG_PREFIX, 'Playlist already imported', { name: playlistName });
      return result;
    }

    // Report start
    onProgress?.({
      current: 0,
      total: 0,
      currentName: playlistName,
    });

    // Fetch tracks
    const details = await getPlaylistDetails(playlistId);
    const trackCount = details.tracks.length;

    console.debug(LOG_PREFIX, 'Playlist tracks fetched', {
      name: playlistName,
      trackCount,
    });

    // Update progress with total
    onProgress?.({
      current: 0,
      total: trackCount,
      currentName: playlistName,
      currentTrackCount: trackCount,
    });

    if (trackCount === 0) {
      console.debug(LOG_PREFIX, 'Playlist has no tracks, creating empty collection');
      await createCollectionFromPlaylist(playlistName, playlistId, []);
      result.collectionsCreated = 1;
      onProgress?.({
        current: trackCount,
        total: trackCount,
        currentName: playlistName,
        currentTrackCount: trackCount,
      });
      return result;
    }

    // Batch-add all tracks as favorites
    const songsToAdd = details.tracks.map(track => ({
      catalogId: track.id,
      title: track.title,
      artistName: track.artistName,
      artworkUrl: track.artworkUrl || null,
      albumTitle: track.albumTitle,
    }));

    const addedCount = await addFavoritesBatch(songsToAdd);
    result.songsAdded = addedCount;

    await yieldToUI();

    // Create linked collection
    const trackCatalogIds = details.tracks.map(t => t.id);
    await createCollectionFromPlaylist(playlistName, playlistId, trackCatalogIds);
    result.collectionsCreated = 1;

    // Final progress
    onProgress?.({
      current: trackCount,
      total: trackCount,
      currentName: playlistName,
      currentTrackCount: trackCount,
    });

    console.info(LOG_PREFIX, 'Single playlist import complete', {
      name: playlistName,
      songs: result.songsAdded,
    });
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to import playlist', { name: playlistName });
    result.failures = 1;
  }

  return result;
}
