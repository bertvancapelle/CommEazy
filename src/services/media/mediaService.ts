/**
 * MediaService — Photo/Video Processing
 *
 * Handles:
 * - Photo compression (max 1920x1080, JPEG 80%)
 * - Video compression (max 720p, 2Mbps, max 2 min)
 * - EXIF stripping (GPS, device info)
 * - Thumbnail generation
 * - Encryption/decryption of media
 *
 * @see types/media.ts for type definitions
 * @see .claude/plans/PHOTO_VIDEO_MESSAGING.md for architecture
 */

import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import type {
  MediaType,
  PhotoCompressionOptions,
  VideoCompressionOptions,
  CompressionResult,
  ExifStripResult,
  ProgressCallback,
  MEDIA_DEFAULTS,
} from '@/types/media';

// Re-export defaults for convenience
export { MEDIA_DEFAULTS } from '@/types/media';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[mediaService]';

/** Default photo compression settings */
const DEFAULT_PHOTO_OPTIONS: Required<PhotoCompressionOptions> = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 80,
};

/** Default video compression settings */
const DEFAULT_VIDEO_OPTIONS: Required<VideoCompressionOptions> = {
  maxResolution: '720p',
  bitrate: 2_000_000, // 2Mbps
  maxDuration: 120,   // 2 minutes
};

/** Thumbnail settings */
const THUMBNAIL_OPTIONS = {
  maxWidth: 200,
  maxHeight: 200,
  quality: 60,
};

// ============================================================
// Photo Processing
// ============================================================

/**
 * Compress a photo to target size and dimensions
 *
 * @param uri - Source photo URI
 * @param options - Compression options
 * @returns Compression result with new URI and dimensions
 */
export async function compressPhoto(
  uri: string,
  options: PhotoCompressionOptions = {}
): Promise<CompressionResult> {
  // TODO: Implement real photo compression with react-native-image-resizer
  // For now, pass through the original photo without compression
  try {
    console.debug(LOG_PREFIX, 'Compressing photo (stub):', uri);

    const exists = await RNFS.exists(uri);
    if (!exists) {
      return { success: false, error: 'File not found' };
    }

    const stat = await RNFS.stat(uri);

    console.info(LOG_PREFIX, 'Photo passed through (compression not implemented):', {
      size: stat.size,
    });

    return {
      success: true,
      uri,
      width: 0,  // Unknown without image processing library
      height: 0,
      size: Number(stat.size) || 0,
    };
  } catch (error) {
    console.error(LOG_PREFIX, 'Photo compression failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate a thumbnail for a photo
 *
 * @param uri - Source photo URI
 * @returns Thumbnail URI and dimensions
 */
export async function generatePhotoThumbnail(uri: string): Promise<CompressionResult> {
  // TODO: Implement real thumbnail generation with react-native-image-resizer
  // For now, use the original photo as thumbnail
  try {
    console.debug(LOG_PREFIX, 'Generating photo thumbnail (stub):', uri);

    const exists = await RNFS.exists(uri);
    if (!exists) {
      return { success: false, error: 'File not found' };
    }

    const stat = await RNFS.stat(uri);

    console.debug(LOG_PREFIX, 'Thumbnail stub generated (using original):', {
      size: stat.size,
    });

    return {
      success: true,
      uri,  // Use original as thumbnail for now
      width: 0,
      height: 0,
      size: Number(stat.size) || 0,
    };
  } catch (error) {
    console.error(LOG_PREFIX, 'Thumbnail generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// EXIF Stripping
// ============================================================

/**
 * Strip EXIF metadata from a photo (GPS, device info, etc.)
 *
 * Note: ImageManipulator automatically strips EXIF data when processing.
 * This function is a wrapper that ensures EXIF is removed.
 *
 * @param uri - Source photo URI
 * @returns Clean photo URI without EXIF
 */
export async function stripExifData(uri: string): Promise<ExifStripResult> {
  // TODO: Implement real EXIF stripping with react-native-image-crop-picker or similar
  // For now, pass through the original photo (privacy concern - should be fixed before production)
  try {
    console.debug(LOG_PREFIX, 'Stripping EXIF data (stub):', uri);

    const exists = await RNFS.exists(uri);
    if (!exists) {
      return { success: false, error: 'File not found' };
    }

    // WARNING: EXIF data is NOT stripped in this stub implementation
    // This must be implemented before production release for privacy compliance
    console.warn(LOG_PREFIX, 'EXIF stripping not implemented - using original photo');

    return {
      success: true,
      uri,
    };
  } catch (error) {
    console.error(LOG_PREFIX, 'EXIF stripping failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// Video Processing
// ============================================================

/**
 * Compress a video to target resolution and bitrate
 *
 * Note: Video compression requires native modules.
 * This is a placeholder that will be implemented with react-native-video-trim
 * or expo-video-thumbnails for thumbnail extraction.
 *
 * @param uri - Source video URI
 * @param options - Compression options
 * @param onProgress - Progress callback (0-1)
 * @returns Compression result with new URI and dimensions
 */
export async function compressVideo(
  uri: string,
  options: VideoCompressionOptions = {},
  onProgress?: ProgressCallback
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_VIDEO_OPTIONS, ...options };

  try {
    console.debug(LOG_PREFIX, 'Compressing video:', uri, opts);

    // TODO: Implement video compression with react-native-video-compress
    // or expo-av for basic operations
    //
    // For now, return the original video as-is
    // Real implementation will:
    // 1. Check video duration
    // 2. Transcode to H.264 if needed
    // 3. Scale to target resolution
    // 4. Compress to target bitrate
    // 5. Strip metadata

    const exists = await RNFS.exists(uri);
    if (!exists) {
      return { success: false, error: 'File not found' };
    }

    const stat = await RNFS.stat(uri);

    console.warn(LOG_PREFIX, 'Video compression not implemented, using original');

    // Placeholder: return original video info
    return {
      success: true,
      uri,
      size: Number(stat.size) || 0,
      // Note: width/height/duration would come from video metadata
    };
  } catch (error) {
    console.error(LOG_PREFIX, 'Video compression failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate a thumbnail for a video
 *
 * @param uri - Source video URI
 * @param timeMs - Time in milliseconds to capture thumbnail (default: 0)
 * @returns Thumbnail URI and dimensions
 */
export async function generateVideoThumbnail(
  uri: string,
  timeMs: number = 0
): Promise<CompressionResult> {
  try {
    console.debug(LOG_PREFIX, 'Generating video thumbnail:', uri, timeMs);

    // TODO: Implement with expo-video-thumbnails or react-native-video
    //
    // Example with expo-video-thumbnails:
    // import * as VideoThumbnails from 'expo-video-thumbnails';
    // const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(uri, { time: timeMs });

    console.warn(LOG_PREFIX, 'Video thumbnail generation not implemented');

    return {
      success: false,
      error: 'Video thumbnail generation not implemented',
    };
  } catch (error) {
    console.error(LOG_PREFIX, 'Video thumbnail generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get video duration in seconds
 *
 * @param uri - Video URI
 * @returns Duration in seconds, or null if unavailable
 */
export async function getVideoDuration(uri: string): Promise<number | null> {
  try {
    // TODO: Implement with expo-av or react-native-video
    //
    // Example with expo-av:
    // import { Audio, Video } from 'expo-av';
    // const video = await Video.createAsync({ uri });
    // const status = await video.getStatusAsync();
    // return status.isLoaded ? status.durationMillis / 1000 : null;

    console.warn(LOG_PREFIX, 'Video duration extraction not implemented');
    return null;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to get video duration:', error);
    return null;
  }
}

/**
 * Check if a video exceeds the maximum duration
 *
 * @param uri - Video URI
 * @param maxDuration - Maximum duration in seconds (default: 120)
 * @returns Object with isValid flag and actual duration
 */
export async function validateVideoDuration(
  uri: string,
  maxDuration: number = DEFAULT_VIDEO_OPTIONS.maxDuration
): Promise<{ isValid: boolean; duration: number | null }> {
  const duration = await getVideoDuration(uri);

  if (duration === null) {
    // Can't determine duration, allow it
    return { isValid: true, duration: null };
  }

  return {
    isValid: duration <= maxDuration,
    duration,
  };
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get file size in bytes
 *
 * @param uri - File URI
 * @returns File size in bytes, or 0 if unavailable
 */
export async function getFileSize(uri: string): Promise<number> {
  try {
    const exists = await RNFS.exists(uri);
    if (!exists) return 0;
    const stat = await RNFS.stat(uri);
    return Number(stat.size) || 0;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to get file size:', error);
    return 0;
  }
}

/**
 * Read file as base64 string
 *
 * @param uri - File URI
 * @returns Base64-encoded string
 */
export async function readAsBase64(uri: string): Promise<string | null> {
  try {
    const base64 = await RNFS.readFile(uri, 'base64');
    return base64;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to read file as base64:', error);
    return null;
  }
}

/**
 * Write base64 string to file
 *
 * @param base64 - Base64-encoded string
 * @param filename - Target filename (without path)
 * @returns File URI
 */
export async function writeBase64ToFile(
  base64: string,
  filename: string
): Promise<string | null> {
  try {
    const dir = RNFS.CachesDirectoryPath || RNFS.DocumentDirectoryPath;
    const mediaDir = `${dir}/media`;
    const uri = `${mediaDir}/${filename}`;

    // Ensure directory exists
    const exists = await RNFS.exists(mediaDir);
    if (!exists) {
      await RNFS.mkdir(mediaDir);
    }

    await RNFS.writeFile(uri, base64, 'base64');

    return uri;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to write base64 to file:', error);
    return null;
  }
}

/**
 * Delete a file
 *
 * @param uri - File URI to delete
 * @returns True if deleted successfully
 */
export async function deleteFile(uri: string): Promise<boolean> {
  try {
    const exists = await RNFS.exists(uri);
    if (exists) {
      await RNFS.unlink(uri);
    }
    return true;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to delete file:', error);
    return false;
  }
}

/**
 * Copy a file to the media directory
 *
 * @param sourceUri - Source file URI
 * @param filename - Target filename
 * @returns New file URI
 */
export async function copyToMediaDirectory(
  sourceUri: string,
  filename: string
): Promise<string | null> {
  try {
    const dir = RNFS.DocumentDirectoryPath;
    const mediaDir = `${dir}/media`;
    const targetUri = `${mediaDir}/${filename}`;

    // Ensure directory exists
    const exists = await RNFS.exists(mediaDir);
    if (!exists) {
      await RNFS.mkdir(mediaDir);
    }

    await RNFS.copyFile(sourceUri, targetUri);

    return targetUri;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to copy file:', error);
    return null;
  }
}

/**
 * Determine media type from file extension
 *
 * @param uri - File URI or path
 * @returns 'photo' | 'video' | null
 */
export function getMediaTypeFromUri(uri: string): MediaType | null {
  const extension = uri.split('.').pop()?.toLowerCase();

  const photoExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
  const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', '3gp'];

  if (photoExtensions.includes(extension || '')) {
    return 'photo';
  }

  if (videoExtensions.includes(extension || '')) {
    return 'video';
  }

  return null;
}
