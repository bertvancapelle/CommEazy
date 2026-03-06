/**
 * Music Collection Service — CRUD operations for music collections
 *
 * Collections are named groups of favorite songs, stored in AsyncStorage.
 * Follows the EXACT same pattern as contactGroupService.ts:
 * - readCollections/writeCollections helpers
 * - uuid.v4() for IDs
 * - createdAt/updatedAt timestamps
 * - Many-to-many via songCatalogIds array
 *
 * Key difference from Contact Groups:
 * - No emoji field (collections are name-only)
 * - Uses songCatalogIds instead of contactJids
 *
 * @see contactGroupService.ts (reference pattern)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[musicCollectionService]';
const STORAGE_KEY = '@commeazy/musicCollections';

// ============================================================
// Types
// ============================================================

export interface MusicCollection {
  /** Unique collection ID (UUID v4) */
  id: string;
  /** User-defined collection name */
  name: string;
  /** Catalog IDs of songs in this collection */
  songCatalogIds: string[];
  /** Timestamp when collection was created */
  createdAt: number;
  /** Timestamp when collection was last modified */
  updatedAt: number;
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Read all collections from AsyncStorage.
 */
async function readCollections(): Promise<MusicCollection[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MusicCollection[];
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to read collections');
    return [];
  }
}

/**
 * Write all collections to AsyncStorage.
 */
async function writeCollections(collections: MusicCollection[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to write collections');
    throw error;
  }
}

// ============================================================
// Public API — Collection CRUD
// ============================================================

/**
 * Get all collections, sorted by most recently updated first.
 */
export async function getCollections(): Promise<MusicCollection[]> {
  const collections = await readCollections();
  return collections.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Get a single collection by ID.
 */
export async function getCollectionById(id: string): Promise<MusicCollection | undefined> {
  const collections = await readCollections();
  return collections.find(c => c.id === id);
}

/**
 * Create a new music collection.
 * Returns the created collection.
 */
export async function createCollection(
  name: string,
  songCatalogIds: string[] = [],
): Promise<MusicCollection> {
  const collections = await readCollections();
  const now = Date.now();

  const newCollection: MusicCollection = {
    id: uuid.v4() as string,
    name: name.trim(),
    songCatalogIds: [...new Set(songCatalogIds)], // Deduplicate
    createdAt: now,
    updatedAt: now,
  };

  collections.push(newCollection);
  await writeCollections(collections);

  console.debug(LOG_PREFIX, 'Collection created', { id: newCollection.id, songCount: songCatalogIds.length });
  return newCollection;
}

/**
 * Rename an existing collection.
 */
export async function renameCollection(id: string, name: string): Promise<boolean> {
  const collections = await readCollections();
  const collection = collections.find(c => c.id === id);

  if (!collection) {
    console.warn(LOG_PREFIX, 'Collection not found for rename');
    return false;
  }

  collection.name = name.trim();
  collection.updatedAt = Date.now();
  await writeCollections(collections);

  console.debug(LOG_PREFIX, 'Collection renamed', { id });
  return true;
}

/**
 * Delete a collection. Songs are NOT removed from favorites — only the collection metadata.
 */
export async function deleteCollection(id: string): Promise<boolean> {
  const collections = await readCollections();
  const filtered = collections.filter(c => c.id !== id);

  if (filtered.length === collections.length) {
    console.warn(LOG_PREFIX, 'Collection not found for deletion');
    return false;
  }

  await writeCollections(filtered);
  console.debug(LOG_PREFIX, 'Collection deleted', { id });
  return true;
}

// ============================================================
// Public API — Song Management
// ============================================================

/**
 * Add songs to a collection. Skips duplicates.
 */
export async function addSongsToCollection(collectionId: string, catalogIds: string[]): Promise<boolean> {
  const collections = await readCollections();
  const collection = collections.find(c => c.id === collectionId);

  if (!collection) {
    console.warn(LOG_PREFIX, 'Collection not found for addSongs');
    return false;
  }

  const existingSet = new Set(collection.songCatalogIds);
  const newIds = catalogIds.filter(id => !existingSet.has(id));

  if (newIds.length === 0) return true;

  collection.songCatalogIds = [...collection.songCatalogIds, ...newIds];
  collection.updatedAt = Date.now();
  await writeCollections(collections);

  console.debug(LOG_PREFIX, 'Songs added to collection', { collectionId, added: newIds.length });
  return true;
}

/**
 * Remove songs from a collection.
 */
export async function removeSongsFromCollection(collectionId: string, catalogIds: string[]): Promise<boolean> {
  const collections = await readCollections();
  const collection = collections.find(c => c.id === collectionId);

  if (!collection) {
    console.warn(LOG_PREFIX, 'Collection not found for removeSongs');
    return false;
  }

  const removeSet = new Set(catalogIds);
  collection.songCatalogIds = collection.songCatalogIds.filter(id => !removeSet.has(id));
  collection.updatedAt = Date.now();
  await writeCollections(collections);

  console.debug(LOG_PREFIX, 'Songs removed from collection', { collectionId, removed: catalogIds.length });
  return true;
}

/**
 * Remove a song from ALL collections (e.g., when a song is unfavorited).
 * Called by favorites removal flows to keep collection references clean.
 */
export async function removeSongFromAllCollections(catalogId: string): Promise<void> {
  const collections = await readCollections();
  let changed = false;

  for (const collection of collections) {
    const idx = collection.songCatalogIds.indexOf(catalogId);
    if (idx !== -1) {
      collection.songCatalogIds.splice(idx, 1);
      collection.updatedAt = Date.now();
      changed = true;
    }
  }

  if (changed) {
    await writeCollections(collections);
    console.debug(LOG_PREFIX, 'Song removed from all collections');
  }
}

/**
 * Get all collections that contain a specific song.
 */
export async function getCollectionsForSong(catalogId: string): Promise<MusicCollection[]> {
  const collections = await readCollections();
  return collections.filter(c => c.songCatalogIds.includes(catalogId));
}
