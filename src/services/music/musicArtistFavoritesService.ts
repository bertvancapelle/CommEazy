/**
 * Music Artist Favorites Service — CRUD operations for favorite artists
 *
 * Artists are stored locally in AsyncStorage, completely independent
 * from song and album favorites. Users can heart artists to add them
 * to their CommEazy artist favorites list.
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

const LOG_PREFIX = '[musicArtistFavoritesService]';
const STORAGE_KEY = '@commeazy/musicFavoriteArtists';

// ============================================================
// Types
// ============================================================

export interface MusicFavoriteArtist {
  /** Apple Music artist catalog ID */
  catalogId: string;
  /** Artist name (cached for offline display) */
  name: string;
  /** Artwork URL (cached for offline display) */
  artworkUrl: string | null;
  /** Timestamp when artist was added to favorites */
  addedAt: number;
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Read all favorite artists from AsyncStorage.
 */
async function readFavorites(): Promise<MusicFavoriteArtist[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MusicFavoriteArtist[];
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to read favorite artists');
    return [];
  }
}

/**
 * Write all favorite artists to AsyncStorage.
 */
async function writeFavorites(favorites: MusicFavoriteArtist[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to write favorite artists');
    throw error;
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Get all favorite artists, sorted by most recently added first.
 */
export async function getFavoriteArtists(): Promise<MusicFavoriteArtist[]> {
  const favorites = await readFavorites();
  return favorites.sort((a, b) => b.addedAt - a.addedAt);
}

/**
 * Check if an artist is in favorites by their catalog ID.
 */
export async function isFavoriteArtist(catalogId: string): Promise<boolean> {
  const favorites = await readFavorites();
  return favorites.some(f => f.catalogId === catalogId);
}

/**
 * Add an artist to favorites.
 * Returns true if added, false if already exists.
 */
export async function addFavoriteArtist(artist: {
  catalogId: string;
  name: string;
  artworkUrl: string | null;
}): Promise<boolean> {
  const favorites = await readFavorites();

  // Skip if already in favorites
  if (favorites.some(f => f.catalogId === artist.catalogId)) {
    console.debug(LOG_PREFIX, 'Artist already in favorites', { id: artist.catalogId });
    return false;
  }

  const newFavorite: MusicFavoriteArtist = {
    catalogId: artist.catalogId,
    name: artist.name,
    artworkUrl: artist.artworkUrl,
    addedAt: Date.now(),
  };

  favorites.push(newFavorite);
  await writeFavorites(favorites);

  console.debug(LOG_PREFIX, 'Artist added to favorites', { id: artist.catalogId });
  return true;
}

/**
 * Remove an artist from favorites by their catalog ID.
 * Returns true if removed, false if not found.
 */
export async function removeFavoriteArtist(catalogId: string): Promise<boolean> {
  const favorites = await readFavorites();
  const filtered = favorites.filter(f => f.catalogId !== catalogId);

  if (filtered.length === favorites.length) {
    console.debug(LOG_PREFIX, 'Artist not found in favorites');
    return false;
  }

  await writeFavorites(filtered);
  console.debug(LOG_PREFIX, 'Artist removed from favorites', { id: catalogId });
  return true;
}

/**
 * Toggle an artist's favorite status.
 * Returns the new favorite status (true = now favorite, false = removed).
 */
export async function toggleFavoriteArtist(artist: {
  catalogId: string;
  name: string;
  artworkUrl: string | null;
}): Promise<boolean> {
  const isCurrentlyFavorite = await isFavoriteArtist(artist.catalogId);

  if (isCurrentlyFavorite) {
    await removeFavoriteArtist(artist.catalogId);
    return false;
  } else {
    await addFavoriteArtist(artist);
    return true;
  }
}

/**
 * Get all favorite artist catalog IDs as a Set for quick lookup.
 */
export async function getFavoriteArtistIds(): Promise<Set<string>> {
  const favorites = await readFavorites();
  return new Set(favorites.map(f => f.catalogId));
}
