/**
 * usePhotoAlbums — React hook for album state management
 *
 * Wraps albumService with React state and provides:
 * - Album list with auto-refresh
 * - CRUD operations that update state
 * - Loading/error states
 *
 * @see services/media/albumService.ts for persistence
 * @see .claude/plans/PHOTO_ALBUM_OPTIMIZATION.md Phase 3.1
 */

import { useState, useCallback, useEffect } from 'react';
import type { PhotoAlbum } from '@/types/media';
import {
  getAlbums,
  createAlbum,
  renameAlbum,
  deleteAlbum,
  addPhotosToAlbum,
  removePhotosFromAlbum,
  setAlbumCover,
} from '@/services/media/albumService';

// ============================================================
// Types
// ============================================================

export interface UsePhotoAlbumsReturn {
  /** All albums, sorted by most recently updated */
  albums: PhotoAlbum[];
  /** Whether albums are currently loading */
  isLoading: boolean;
  /** Reload albums from storage */
  reload: () => Promise<void>;
  /** Create a new album */
  create: (name: string, photoIds?: string[]) => Promise<PhotoAlbum | undefined>;
  /** Rename an album */
  rename: (albumId: string, newName: string) => Promise<boolean>;
  /** Delete an album (photos remain) */
  remove: (albumId: string) => Promise<boolean>;
  /** Add photos to an album */
  addPhotos: (albumId: string, photoIds: string[]) => Promise<boolean>;
  /** Remove photos from an album */
  removePhotos: (albumId: string, photoIds: string[]) => Promise<boolean>;
  /** Set album cover photo */
  setCover: (albumId: string, photoId: string) => Promise<boolean>;
}

// ============================================================
// Hook
// ============================================================

export function usePhotoAlbums(): UsePhotoAlbumsReturn {
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load albums from storage
  const reload = useCallback(async () => {
    try {
      const loaded = await getAlbums();
      setAlbums(loaded);
    } catch (error) {
      console.error('[usePhotoAlbums] Failed to load albums');
    }
  }, []);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    reload().finally(() => setIsLoading(false));
  }, [reload]);

  // Create album
  const create = useCallback(async (name: string, photoIds?: string[]): Promise<PhotoAlbum | undefined> => {
    try {
      const album = await createAlbum(name, photoIds);
      await reload();
      return album;
    } catch (error) {
      console.error('[usePhotoAlbums] Failed to create album');
      return undefined;
    }
  }, [reload]);

  // Rename album
  const rename = useCallback(async (albumId: string, newName: string): Promise<boolean> => {
    try {
      const result = await renameAlbum(albumId, newName);
      if (result) {
        await reload();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[usePhotoAlbums] Failed to rename album');
      return false;
    }
  }, [reload]);

  // Delete album
  const remove = useCallback(async (albumId: string): Promise<boolean> => {
    try {
      const result = await deleteAlbum(albumId);
      if (result) {
        await reload();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[usePhotoAlbums] Failed to delete album');
      return false;
    }
  }, [reload]);

  // Add photos to album
  const addPhotos = useCallback(async (albumId: string, photoIds: string[]): Promise<boolean> => {
    try {
      const result = await addPhotosToAlbum(albumId, photoIds);
      if (result) {
        await reload();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[usePhotoAlbums] Failed to add photos');
      return false;
    }
  }, [reload]);

  // Remove photos from album
  const removePhotos = useCallback(async (albumId: string, photoIds: string[]): Promise<boolean> => {
    try {
      const result = await removePhotosFromAlbum(albumId, photoIds);
      if (result) {
        await reload();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[usePhotoAlbums] Failed to remove photos');
      return false;
    }
  }, [reload]);

  // Set cover photo
  const setCover = useCallback(async (albumId: string, photoId: string): Promise<boolean> => {
    try {
      const result = await setAlbumCover(albumId, photoId);
      if (result) {
        await reload();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[usePhotoAlbums] Failed to set cover');
      return false;
    }
  }, [reload]);

  return {
    albums,
    isLoading,
    reload,
    create,
    rename,
    remove,
    addPhotos,
    removePhotos,
    setCover,
  };
}
