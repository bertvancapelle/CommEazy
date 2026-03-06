/**
 * Music Favorites Service — CRUD operations for Apple Music favorites
 *
 * Favorites are stored locally in AsyncStorage, completely independent
 * from Apple Music's own library. Users can heart songs to add them
 * to their CommEazy favorites list.
 *
 * Follows the contactGroupService.ts pattern: readFavorites/writeFavorites
 * helpers, catalogId-based, addedAt timestamps.
 *
 * @see AppleMusicScreen.tsx
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[musicFavoritesService]';
const STORAGE_KEY = '@commeazy/musicFavorites';

// ============================================================
// Types
// ============================================================

export interface MusicFavorite {
  /** Apple Music catalog ID */
  catalogId: string;
  /** Song title (cached for offline display) */
  title: string;
  /** Artist name (cached for offline display) */
  artistName: string;
  /** Artwork URL (cached for offline display) */
  artworkUrl: string | null;
  /** Album title (cached for offline display) */
  albumTitle?: string;
  /** Timestamp when song was added to favorites */
  addedAt: number;
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Read all favorites from AsyncStorage.
 */
async function readFavorites(): Promise<MusicFavorite[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MusicFavorite[];
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to read favorites');
    return [];
  }
}

/**
 * Write all favorites to AsyncStorage.
 */
async function writeFavorites(favorites: MusicFavorite[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to write favorites');
    throw error;
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Get all favorites, sorted by most recently added first.
 */
export async function getFavorites(): Promise<MusicFavorite[]> {
  const favorites = await readFavorites();
  return favorites.sort((a, b) => b.addedAt - a.addedAt);
}

/**
 * Check if a song is in favorites by its catalog ID.
 */
export async function isFavorite(catalogId: string): Promise<boolean> {
  const favorites = await readFavorites();
  return favorites.some(f => f.catalogId === catalogId);
}

/**
 * Add a song to favorites.
 * Returns true if added, false if already exists.
 */
export async function addFavorite(song: {
  catalogId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  albumTitle?: string;
}): Promise<boolean> {
  const favorites = await readFavorites();

  // Skip if already in favorites
  if (favorites.some(f => f.catalogId === song.catalogId)) {
    console.debug(LOG_PREFIX, 'Song already in favorites', { id: song.catalogId });
    return false;
  }

  const newFavorite: MusicFavorite = {
    catalogId: song.catalogId,
    title: song.title,
    artistName: song.artistName,
    artworkUrl: song.artworkUrl,
    albumTitle: song.albumTitle,
    addedAt: Date.now(),
  };

  favorites.push(newFavorite);
  await writeFavorites(favorites);

  console.debug(LOG_PREFIX, 'Song added to favorites', { id: song.catalogId });
  return true;
}

/**
 * Remove a song from favorites by its catalog ID.
 * Returns true if removed, false if not found.
 */
export async function removeFavorite(catalogId: string): Promise<boolean> {
  const favorites = await readFavorites();
  const filtered = favorites.filter(f => f.catalogId !== catalogId);

  if (filtered.length === favorites.length) {
    console.debug(LOG_PREFIX, 'Song not found in favorites');
    return false;
  }

  await writeFavorites(filtered);
  console.debug(LOG_PREFIX, 'Song removed from favorites', { id: catalogId });
  return true;
}

/**
 * Toggle a song's favorite status.
 * Returns the new favorite status (true = now favorite, false = removed).
 */
export async function toggleFavorite(song: {
  catalogId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  albumTitle?: string;
}): Promise<boolean> {
  const isCurrentlyFavorite = await isFavorite(song.catalogId);

  if (isCurrentlyFavorite) {
    await removeFavorite(song.catalogId);
    return false;
  } else {
    await addFavorite(song);
    return true;
  }
}

/**
 * Get the total count of favorites.
 */
export async function getFavoritesCount(): Promise<number> {
  const favorites = await readFavorites();
  return favorites.length;
}

/**
 * Remove a song from favorites AND from all collections.
 * Called when a user explicitly unfavorites a song.
 * (Collections only reference favorites, so removing a favorite
 * should clean up collection references too.)
 */
export async function removeFavoriteFromAll(catalogId: string): Promise<void> {
  await removeFavorite(catalogId);
  // Collection cleanup is handled by the caller (useMusicFavorites hook)
  // since it needs to coordinate with musicCollectionService
}

/**
 * Get all favorite catalog IDs as a Set for quick lookup.
 */
export async function getFavoriteIds(): Promise<Set<string>> {
  const favorites = await readFavorites();
  return new Set(favorites.map(f => f.catalogId));
}
