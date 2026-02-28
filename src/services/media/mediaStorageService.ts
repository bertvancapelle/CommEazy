/**
 * MediaStorageService — Local Media Storage Management
 *
 * Handles:
 * - Saving media files to local storage
 * - Retrieving media files
 * - Cleanup of expired media
 * - Storage usage tracking
 *
 * @see types/media.ts for type definitions
 * @see .claude/plans/PHOTO_VIDEO_MESSAGING.md for architecture
 */

import * as FileSystem from 'expo-file-system';
import uuid from 'react-native-uuid';
import type { MediaType, MediaItem, MediaSource, MEDIA_DEFAULTS } from '@/types/media';
import {
  compressPhoto,
  generatePhotoThumbnail,
  stripExifData,
  getFileSize,
  copyToMediaDirectory,
  getMediaTypeFromUri,
} from './mediaService';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[mediaStorageService]';

/** Media storage directory paths */
const MEDIA_DIR = 'media';
const THUMBNAILS_DIR = 'media/thumbnails';
const TEMP_DIR = 'media/temp';

/** 7-day retention period in milliseconds */
const RETENTION_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================================
// Directory Management
// ============================================================

/**
 * Ensure all media directories exist
 */
async function ensureDirectories(): Promise<void> {
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error('Document directory not available');
  }

  const dirs = [MEDIA_DIR, THUMBNAILS_DIR, TEMP_DIR];

  for (const dir of dirs) {
    const path = `${baseDir}${dir}`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(path, { intermediates: true });
      console.debug(LOG_PREFIX, 'Created directory:', dir);
    }
  }
}

/**
 * Get the media directory path
 */
function getMediaPath(filename: string): string {
  return `${FileSystem.documentDirectory}${MEDIA_DIR}/${filename}`;
}

/**
 * Get the thumbnail directory path
 */
function getThumbnailPath(filename: string): string {
  return `${FileSystem.documentDirectory}${THUMBNAILS_DIR}/${filename}`;
}

/**
 * Get the temp directory path
 */
function getTempPath(filename: string): string {
  return `${FileSystem.documentDirectory}${TEMP_DIR}/${filename}`;
}

// ============================================================
// Media Storage
// ============================================================

/**
 * Save a photo to local storage
 *
 * @param sourceUri - Source photo URI (from camera or gallery)
 * @param chatId - Associated chat ID
 * @param source - Source of the media ('camera' | 'gallery' | 'received')
 * @param senderJid - Sender JID (for received media)
 * @param senderName - Sender name (for received media)
 * @returns MediaItem with local URIs and metadata
 */
export async function savePhoto(
  sourceUri: string,
  chatId: string,
  source: MediaSource = 'camera',
  senderJid?: string,
  senderName?: string
): Promise<MediaItem | null> {
  try {
    await ensureDirectories();

    const mediaId = uuid.v4() as string;
    const timestamp = Date.now();

    console.info(LOG_PREFIX, 'Saving photo:', { mediaId, source, chatId });

    // 1. Strip EXIF data (GPS, device info)
    const stripped = await stripExifData(sourceUri);
    if (!stripped.success || !stripped.uri) {
      console.error(LOG_PREFIX, 'Failed to strip EXIF:', stripped.error);
      return null;
    }

    // 2. Compress photo
    const compressed = await compressPhoto(stripped.uri);
    if (!compressed.success || !compressed.uri) {
      console.error(LOG_PREFIX, 'Failed to compress photo:', compressed.error);
      return null;
    }

    // 3. Generate thumbnail
    const thumbnail = await generatePhotoThumbnail(compressed.uri);
    if (!thumbnail.success || !thumbnail.uri) {
      console.error(LOG_PREFIX, 'Failed to generate thumbnail:', thumbnail.error);
      return null;
    }

    // 4. Copy to permanent storage
    const mediaFilename = `${mediaId}.jpg`;
    const thumbFilename = `${mediaId}_thumb.jpg`;

    const localUri = await copyToMediaDirectory(compressed.uri, mediaFilename);
    if (!localUri) {
      console.error(LOG_PREFIX, 'Failed to copy media file');
      return null;
    }

    // Copy thumbnail to thumbnails directory
    const thumbnailUri = getThumbnailPath(thumbFilename);
    await FileSystem.copyAsync({
      from: thumbnail.uri,
      to: thumbnailUri,
    });

    // 5. Clean up temp files
    await FileSystem.deleteAsync(stripped.uri, { idempotent: true });
    await FileSystem.deleteAsync(compressed.uri, { idempotent: true });
    await FileSystem.deleteAsync(thumbnail.uri, { idempotent: true });

    // 6. Create MediaItem
    const mediaItem: MediaItem = {
      id: mediaId,
      type: 'photo',
      localUri,
      thumbnailUri,
      size: compressed.size || 0,
      width: compressed.width || 0,
      height: compressed.height || 0,
      source,
      senderJid,
      senderName,
      timestamp,
      chatId,
    };

    console.info(LOG_PREFIX, 'Photo saved:', {
      id: mediaId,
      size: mediaItem.size,
      dimensions: `${mediaItem.width}x${mediaItem.height}`,
    });

    return mediaItem;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to save photo:', error);
    return null;
  }
}

/**
 * Save a video to local storage
 *
 * @param sourceUri - Source video URI
 * @param chatId - Associated chat ID
 * @param source - Source of the media
 * @param senderJid - Sender JID (for received media)
 * @param senderName - Sender name (for received media)
 * @returns MediaItem with local URIs and metadata
 */
export async function saveVideo(
  sourceUri: string,
  chatId: string,
  source: MediaSource = 'camera',
  senderJid?: string,
  senderName?: string
): Promise<MediaItem | null> {
  try {
    await ensureDirectories();

    const mediaId = uuid.v4() as string;
    const timestamp = Date.now();

    console.info(LOG_PREFIX, 'Saving video:', { mediaId, source, chatId });

    // TODO: Implement video processing
    // 1. Compress video (720p, 2Mbps)
    // 2. Generate thumbnail
    // 3. Copy to permanent storage

    // For now, just copy the video as-is
    const extension = sourceUri.split('.').pop() || 'mp4';
    const mediaFilename = `${mediaId}.${extension}`;
    const thumbFilename = `${mediaId}_thumb.jpg`;

    const localUri = await copyToMediaDirectory(sourceUri, mediaFilename);
    if (!localUri) {
      console.error(LOG_PREFIX, 'Failed to copy video file');
      return null;
    }

    const size = await getFileSize(localUri);

    // TODO: Generate real video thumbnail
    // For now, create a placeholder
    const thumbnailUri = getThumbnailPath(thumbFilename);

    console.warn(LOG_PREFIX, 'Video thumbnail generation not implemented');

    // Create MediaItem
    const mediaItem: MediaItem = {
      id: mediaId,
      type: 'video',
      localUri,
      thumbnailUri: '', // TODO: Generate thumbnail
      size,
      width: 0,  // TODO: Get from video metadata
      height: 0, // TODO: Get from video metadata
      duration: undefined, // TODO: Get from video metadata
      source,
      senderJid,
      senderName,
      timestamp,
      chatId,
    };

    console.info(LOG_PREFIX, 'Video saved:', {
      id: mediaId,
      size,
    });

    return mediaItem;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to save video:', error);
    return null;
  }
}

/**
 * Save media to local storage (auto-detects type)
 *
 * @param sourceUri - Source media URI
 * @param chatId - Associated chat ID
 * @param source - Source of the media
 * @param senderJid - Sender JID (for received media)
 * @param senderName - Sender name (for received media)
 * @returns MediaItem with local URIs and metadata
 */
export async function saveMedia(
  sourceUri: string,
  chatId: string,
  source: MediaSource = 'camera',
  senderJid?: string,
  senderName?: string
): Promise<MediaItem | null> {
  const type = getMediaTypeFromUri(sourceUri);

  if (type === 'photo') {
    return savePhoto(sourceUri, chatId, source, senderJid, senderName);
  }

  if (type === 'video') {
    return saveVideo(sourceUri, chatId, source, senderJid, senderName);
  }

  console.error(LOG_PREFIX, 'Unknown media type:', sourceUri);
  return null;
}

// ============================================================
// Media Retrieval
// ============================================================

/**
 * Check if a media file exists
 *
 * @param mediaId - Media ID
 * @returns True if the media file exists
 */
export async function mediaExists(mediaId: string): Promise<boolean> {
  try {
    // Check for common extensions
    const extensions = ['jpg', 'jpeg', 'png', 'mp4', 'mov'];

    for (const ext of extensions) {
      const path = getMediaPath(`${mediaId}.${ext}`);
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to check media existence:', error);
    return false;
  }
}

/**
 * Get the local URI for a media file
 *
 * @param mediaId - Media ID
 * @returns Local URI or null if not found
 */
export async function getMediaUri(mediaId: string): Promise<string | null> {
  try {
    const extensions = ['jpg', 'jpeg', 'png', 'mp4', 'mov'];

    for (const ext of extensions) {
      const path = getMediaPath(`${mediaId}.${ext}`);
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        return path;
      }
    }

    return null;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to get media URI:', error);
    return null;
  }
}

/**
 * Get the thumbnail URI for a media file
 *
 * @param mediaId - Media ID
 * @returns Thumbnail URI or null if not found
 */
export async function getThumbnailUri(mediaId: string): Promise<string | null> {
  try {
    const path = getThumbnailPath(`${mediaId}_thumb.jpg`);
    const info = await FileSystem.getInfoAsync(path);

    if (info.exists) {
      return path;
    }

    return null;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to get thumbnail URI:', error);
    return null;
  }
}

// ============================================================
// Cleanup
// ============================================================

/**
 * Delete a media file and its thumbnail
 *
 * @param mediaId - Media ID to delete
 * @returns True if deleted successfully
 */
export async function deleteMedia(mediaId: string): Promise<boolean> {
  try {
    console.info(LOG_PREFIX, 'Deleting media:', mediaId);

    // Delete media file
    const mediaUri = await getMediaUri(mediaId);
    if (mediaUri) {
      await FileSystem.deleteAsync(mediaUri, { idempotent: true });
    }

    // Delete thumbnail
    const thumbUri = await getThumbnailUri(mediaId);
    if (thumbUri) {
      await FileSystem.deleteAsync(thumbUri, { idempotent: true });
    }

    console.debug(LOG_PREFIX, 'Media deleted:', mediaId);
    return true;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to delete media:', error);
    return false;
  }
}

/**
 * Delete multiple media files
 *
 * @param mediaIds - Array of media IDs to delete
 * @returns Number of successfully deleted files
 */
export async function deleteMediaBatch(mediaIds: string[]): Promise<number> {
  let deleted = 0;

  for (const mediaId of mediaIds) {
    const success = await deleteMedia(mediaId);
    if (success) {
      deleted++;
    }
  }

  console.info(LOG_PREFIX, 'Batch delete completed:', { deleted, total: mediaIds.length });
  return deleted;
}

/**
 * Clean up temporary files
 *
 * @returns Number of deleted temp files
 */
export async function cleanupTempFiles(): Promise<number> {
  try {
    const tempDir = `${FileSystem.documentDirectory}${TEMP_DIR}`;
    const info = await FileSystem.getInfoAsync(tempDir);

    if (!info.exists) {
      return 0;
    }

    const files = await FileSystem.readDirectoryAsync(tempDir);
    let deleted = 0;

    for (const file of files) {
      await FileSystem.deleteAsync(`${tempDir}/${file}`, { idempotent: true });
      deleted++;
    }

    console.info(LOG_PREFIX, 'Cleaned up temp files:', deleted);
    return deleted;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to cleanup temp files:', error);
    return 0;
  }
}

// ============================================================
// Storage Info
// ============================================================

/**
 * Get total storage used by media files
 *
 * @returns Storage size in bytes
 */
export async function getStorageUsage(): Promise<number> {
  try {
    await ensureDirectories();

    const mediaDir = `${FileSystem.documentDirectory}${MEDIA_DIR}`;
    const files = await FileSystem.readDirectoryAsync(mediaDir);

    let totalSize = 0;

    for (const file of files) {
      // Skip directories
      if (file === 'thumbnails' || file === 'temp') {
        continue;
      }

      const info = await FileSystem.getInfoAsync(`${mediaDir}/${file}`);
      if (info.exists) {
        totalSize += (info as any).size || 0;
      }
    }

    return totalSize;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to get storage usage:', error);
    return 0;
  }
}

/**
 * Get available storage space
 *
 * Note: This is a rough estimate based on device storage.
 * Actual available space may vary.
 *
 * @returns Available space in bytes, or -1 if unavailable
 */
export async function getAvailableStorage(): Promise<number> {
  try {
    const info = await FileSystem.getFreeDiskStorageAsync();
    return info;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to get available storage:', error);
    return -1;
  }
}

/**
 * Check if storage is low (less than 100MB free)
 *
 * @returns True if storage is low
 */
export async function isStorageLow(): Promise<boolean> {
  const available = await getAvailableStorage();

  if (available < 0) {
    return false; // Can't determine, assume OK
  }

  const threshold = 100 * 1024 * 1024; // 100MB
  return available < threshold;
}

/**
 * Get media count by type
 *
 * @returns Object with photo and video counts
 */
export async function getMediaCount(): Promise<{ photos: number; videos: number }> {
  try {
    await ensureDirectories();

    const mediaDir = `${FileSystem.documentDirectory}${MEDIA_DIR}`;
    const files = await FileSystem.readDirectoryAsync(mediaDir);

    let photos = 0;
    let videos = 0;

    for (const file of files) {
      // Skip directories
      if (file === 'thumbnails' || file === 'temp') {
        continue;
      }

      const type = getMediaTypeFromUri(file);
      if (type === 'photo') {
        photos++;
      } else if (type === 'video') {
        videos++;
      }
    }

    return { photos, videos };
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to get media count:', error);
    return { photos: 0, videos: 0 };
  }
}
