/**
 * Music Album Favorites Service — CRUD operations for favorite albums
 *
 * Albums are stored locally in AsyncStorage, completely independent
 * from song favorites. Users can heart albums to add them
 * to their CommEazy album favorites list.
 *
 * Follows the musicFavoritesService.ts pattern: readFavorites/writeFavorites
 * helpers, catalogId-based, addedAt timestamps.
 *
 * @see AppleMusicScreen.tsx
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[musicAlbumFavoritesService]';
const STORAGE_KEY = '@commeazy/musicFavoriteAlbums';

// ============================================================
// Types
// ============================================================

export interface MusicFavoriteAlbum {
  /** Apple Music album catalog ID */
  catalogId: string;
  /** Album title (cached for offline display) */
  title: string;
  /** Artist name (cached for offline display) */
  artistName: string;
  /** Artwork URL (cached for offline display) */
  artworkUrl: string | null;
  /** Number of tracks in the album */
  trackCount: number;
  /** Timestamp when album was added to favorites */
  addedAt: number;
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Read all favorite albums from AsyncStorage.
 */
async function readFavorites(): Promise<MusicFavoriteAlbum[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MusicFavoriteAlbum[];
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to read favorite albums');
    return [];
  }
}

/**
 * Write all favorite albums to AsyncStorage.
 */
async function writeFavorites(favorites: MusicFavoriteAlbum[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to write favorite albums');
    throw error;
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Get all favorite albums, sorted by most recently added first.
 */
export async function getFavoriteAlbums(): Promise<MusicFavoriteAlbum[]> {
  const favorites = await readFavorites();
  return favorites.sort((a, b) => b.addedAt - a.addedAt);
}

/**
 * Check if an album is in favorites by its catalog ID.
 */
export async function isFavoriteAlbum(catalogId: string): Promise<boolean> {
  const favorites = await readFavorites();
  return favorites.some(f => f.catalogId === catalogId);
}

/**
 * Add an album to favorites.
 * Returns true if added, false if already exists.
 */
export async function addFavoriteAlbum(album: {
  catalogId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  trackCount: number;
}): Promise<boolean> {
  const favorites = await readFavorites();

  // Skip if already in favorites
  if (favorites.some(f => f.catalogId === album.catalogId)) {
    console.debug(LOG_PREFIX, 'Album already in favorites', { id: album.catalogId });
    return false;
  }

  const newFavorite: MusicFavoriteAlbum = {
    catalogId: album.catalogId,
    title: album.title,
    artistName: album.artistName,
    artworkUrl: album.artworkUrl,
    trackCount: album.trackCount,
    addedAt: Date.now(),
  };

  favorites.push(newFavorite);
  await writeFavorites(favorites);

  console.debug(LOG_PREFIX, 'Album added to favorites', { id: album.catalogId });
  return true;
}

/**
 * Remove an album from favorites by its catalog ID.
 * Returns true if removed, false if not found.
 */
export async function removeFavoriteAlbum(catalogId: string): Promise<boolean> {
  const favorites = await readFavorites();
  const filtered = favorites.filter(f => f.catalogId !== catalogId);

  if (filtered.length === favorites.length) {
    console.debug(LOG_PREFIX, 'Album not found in favorites');
    return false;
  }

  await writeFavorites(filtered);
  console.debug(LOG_PREFIX, 'Album removed from favorites', { id: catalogId });
  return true;
}

/**
 * Toggle an album's favorite status.
 * Returns the new favorite status (true = now favorite, false = removed).
 */
export async function toggleFavoriteAlbum(album: {
  catalogId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  trackCount: number;
}): Promise<boolean> {
  const isCurrentlyFavorite = await isFavoriteAlbum(album.catalogId);

  if (isCurrentlyFavorite) {
    await removeFavoriteAlbum(album.catalogId);
    return false;
  } else {
    await addFavoriteAlbum(album);
    return true;
  }
}

/**
 * Get all favorite album catalog IDs as a Set for quick lookup.
 */
export async function getFavoriteAlbumIds(): Promise<Set<string>> {
  const favorites = await readFavorites();
  return new Set(favorites.map(f => f.catalogId));
}
