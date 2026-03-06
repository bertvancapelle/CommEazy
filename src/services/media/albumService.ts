/**
 * Album Service — CRUD operations for photo albums
 *
 * Albums are lightweight metadata stored in AsyncStorage.
 * Photo files remain in DocumentDirectory/media — albums only reference IDs.
 *
 * @see types/media.ts for PhotoAlbum interface
 * @see .claude/plans/PHOTO_ALBUM_OPTIMIZATION.md Phase 3.1
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import type { PhotoAlbum } from '@/types/media';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[albumService]';
const STORAGE_KEY = '@commeazy/photoAlbums';

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Read all albums from AsyncStorage.
 */
async function readAlbums(): Promise<PhotoAlbum[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PhotoAlbum[];
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to read albums');
    return [];
  }
}

/**
 * Write all albums to AsyncStorage.
 */
async function writeAlbums(albums: PhotoAlbum[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(albums));
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to write albums');
    throw error;
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Get all albums, sorted by most recently updated first.
 */
export async function getAlbums(): Promise<PhotoAlbum[]> {
  const albums = await readAlbums();
  return albums.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Get a single album by ID.
 */
export async function getAlbumById(albumId: string): Promise<PhotoAlbum | undefined> {
  const albums = await readAlbums();
  return albums.find(a => a.id === albumId);
}

/**
 * Create a new album with the given name and optional initial photo IDs.
 * Returns the created album.
 */
export async function createAlbum(name: string, photoIds: string[] = []): Promise<PhotoAlbum> {
  const albums = await readAlbums();
  const now = Date.now();

  const newAlbum: PhotoAlbum = {
    id: uuid.v4() as string,
    name: name.trim(),
    coverPhotoId: photoIds.length > 0 ? photoIds[0] : undefined,
    photoIds,
    createdAt: now,
    updatedAt: now,
  };

  albums.push(newAlbum);
  await writeAlbums(albums);

  console.debug(LOG_PREFIX, 'Album created', { id: newAlbum.id, photoCount: photoIds.length });
  return newAlbum;
}

/**
 * Rename an existing album.
 */
export async function renameAlbum(albumId: string, newName: string): Promise<PhotoAlbum | undefined> {
  const albums = await readAlbums();
  const album = albums.find(a => a.id === albumId);

  if (!album) {
    console.warn(LOG_PREFIX, 'Album not found for rename');
    return undefined;
  }

  album.name = newName.trim();
  album.updatedAt = Date.now();
  await writeAlbums(albums);

  console.debug(LOG_PREFIX, 'Album renamed', { id: albumId });
  return album;
}

/**
 * Delete an album. Photos are NOT deleted from storage — only the album metadata.
 */
export async function deleteAlbum(albumId: string): Promise<boolean> {
  const albums = await readAlbums();
  const filtered = albums.filter(a => a.id !== albumId);

  if (filtered.length === albums.length) {
    console.warn(LOG_PREFIX, 'Album not found for deletion');
    return false;
  }

  await writeAlbums(filtered);
  console.debug(LOG_PREFIX, 'Album deleted', { id: albumId });
  return true;
}

/**
 * Add photos to an album. Skips duplicates.
 */
export async function addPhotosToAlbum(albumId: string, photoIds: string[]): Promise<PhotoAlbum | undefined> {
  const albums = await readAlbums();
  const album = albums.find(a => a.id === albumId);

  if (!album) {
    console.warn(LOG_PREFIX, 'Album not found for addPhotos');
    return undefined;
  }

  const existingSet = new Set(album.photoIds);
  const newIds = photoIds.filter(id => !existingSet.has(id));

  if (newIds.length === 0) return album;

  album.photoIds = [...album.photoIds, ...newIds];
  album.updatedAt = Date.now();

  // Set cover photo if album had none
  if (!album.coverPhotoId && album.photoIds.length > 0) {
    album.coverPhotoId = album.photoIds[0];
  }

  await writeAlbums(albums);
  console.debug(LOG_PREFIX, 'Photos added to album', { id: albumId, added: newIds.length });
  return album;
}

/**
 * Remove photos from an album. Photos are NOT deleted from storage.
 */
export async function removePhotosFromAlbum(albumId: string, photoIds: string[]): Promise<PhotoAlbum | undefined> {
  const albums = await readAlbums();
  const album = albums.find(a => a.id === albumId);

  if (!album) {
    console.warn(LOG_PREFIX, 'Album not found for removePhotos');
    return undefined;
  }

  const removeSet = new Set(photoIds);
  album.photoIds = album.photoIds.filter(id => !removeSet.has(id));
  album.updatedAt = Date.now();

  // Update cover photo if it was removed
  if (album.coverPhotoId && removeSet.has(album.coverPhotoId)) {
    album.coverPhotoId = album.photoIds.length > 0 ? album.photoIds[0] : undefined;
  }

  await writeAlbums(albums);
  console.debug(LOG_PREFIX, 'Photos removed from album', { id: albumId, removed: photoIds.length });
  return album;
}

/**
 * Set the cover photo for an album.
 */
export async function setAlbumCover(albumId: string, photoId: string): Promise<PhotoAlbum | undefined> {
  const albums = await readAlbums();
  const album = albums.find(a => a.id === albumId);

  if (!album) {
    console.warn(LOG_PREFIX, 'Album not found for setCover');
    return undefined;
  }

  album.coverPhotoId = photoId;
  album.updatedAt = Date.now();
  await writeAlbums(albums);

  console.debug(LOG_PREFIX, 'Album cover updated', { id: albumId });
  return album;
}

/**
 * Remove a photo ID from ALL albums (e.g., when a photo is deleted from storage).
 * Called by media deletion flows to keep album references clean.
 */
export async function removePhotoFromAllAlbums(photoId: string): Promise<void> {
  const albums = await readAlbums();
  let changed = false;

  for (const album of albums) {
    const idx = album.photoIds.indexOf(photoId);
    if (idx !== -1) {
      album.photoIds.splice(idx, 1);
      album.updatedAt = Date.now();
      changed = true;

      // Update cover if needed
      if (album.coverPhotoId === photoId) {
        album.coverPhotoId = album.photoIds.length > 0 ? album.photoIds[0] : undefined;
      }
    }
  }

  if (changed) {
    await writeAlbums(albums);
    console.debug(LOG_PREFIX, 'Photo removed from all albums');
  }
}
