/**
 * Media Attachment Service — Compression and validation for mail attachments
 *
 * Handles image compression, video validation, and MIME type detection
 * for email attachments. Uses platform APIs for resizing.
 *
 * Limits:
 * - Images > 2MB: compress to max 1920px, 80% JPEG quality
 * - Video > 25MB: rejected (too large for email)
 * - Max attachment total: 25MB per message
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 14
 */

import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import type { MailAttachment } from '@/types/mail';

// ============================================================
// Constants
// ============================================================

/** Max image size before compression (2MB) */
const IMAGE_COMPRESSION_THRESHOLD = 2 * 1024 * 1024;

/** Max video size (25MB) */
const MAX_VIDEO_SIZE = 25 * 1024 * 1024;

/** Max total attachment size per message (25MB) */
const MAX_TOTAL_ATTACHMENT_SIZE = 25 * 1024 * 1024;

/** Supported image MIME types */
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/gif',
]);

/** Supported video MIME types */
const SUPPORTED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
]);

/** All supported MIME types */
const SUPPORTED_ATTACHMENT_TYPES = new Set([
  ...SUPPORTED_IMAGE_TYPES,
  ...SUPPORTED_VIDEO_TYPES,
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

// ============================================================
// Types
// ============================================================

export type CompressionStatus = 'pending' | 'compressing' | 'done' | 'failed';

export interface CompressionResult {
  localUri: string;
  compressedSize: number;
  status: CompressionStatus;
  error?: string;
}

// ============================================================
// Validation
// ============================================================

/**
 * Check if a MIME type is supported for email attachments.
 */
export function isSupportedType(mimeType: string): boolean {
  return SUPPORTED_ATTACHMENT_TYPES.has(mimeType);
}

/**
 * Check if a MIME type is an image.
 */
export function isImageType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.has(mimeType);
}

/**
 * Check if a MIME type is a video.
 */
export function isVideoType(mimeType: string): boolean {
  return SUPPORTED_VIDEO_TYPES.has(mimeType);
}

/**
 * Check if a MIME type can be saved to the photo album.
 */
export function canSaveToAlbum(mimeType: string): boolean {
  return isImageType(mimeType) || isVideoType(mimeType);
}

/**
 * Validate attachment size constraints.
 *
 * @param fileSize - Size in bytes
 * @param mimeType - MIME type of the file
 * @returns Error message or null if valid
 */
export function validateAttachmentSize(
  fileSize: number,
  mimeType: string,
): string | null {
  if (isVideoType(mimeType) && fileSize > MAX_VIDEO_SIZE) {
    return 'VIDEO_TOO_LARGE';
  }
  if (fileSize > MAX_TOTAL_ATTACHMENT_SIZE) {
    return 'FILE_TOO_LARGE';
  }
  return null;
}

/**
 * Check if total attachment size exceeds the limit.
 *
 * @param attachments - Current attachments
 * @param newSize - Size of the attachment being added
 * @returns true if adding the attachment would exceed the limit
 */
export function wouldExceedTotalSize(
  attachments: MailAttachment[],
  newSize: number,
): boolean {
  const currentTotal = attachments.reduce(
    (sum, a) => sum + (a.compressedSize || a.fileSize),
    0,
  );
  return currentTotal + newSize > MAX_TOTAL_ATTACHMENT_SIZE;
}

// ============================================================
// Compression
// ============================================================

/**
 * Compress an image if it exceeds the threshold.
 * Uses react-native-image-resizer for platform-native compression.
 *
 * @param uri - Local file URI
 * @param fileSize - Original file size in bytes
 * @returns Compression result with new URI and size
 */
export async function compressImageIfNeeded(
  uri: string,
  fileSize: number,
): Promise<CompressionResult> {
  if (fileSize <= IMAGE_COMPRESSION_THRESHOLD) {
    return { localUri: uri, compressedSize: fileSize, status: 'done' };
  }

  try {
    // Dynamic import to avoid issues when not available
    const ImageResizer = await import('react-native-image-resizer');

    const result = await ImageResizer.default.createResizedImage(
      uri,
      1920,     // maxWidth
      1920,     // maxHeight
      'JPEG',   // compressFormat
      80,       // quality (%)
      0,        // rotation
      undefined, // outputPath (auto)
    );

    return {
      localUri: result.uri,
      compressedSize: result.size,
      status: 'done',
    };
  } catch (err) {
    // Fallback: use original if compression fails
    return {
      localUri: uri,
      compressedSize: fileSize,
      status: 'failed',
      error: err instanceof Error ? err.message : 'Compression failed',
    };
  }
}

/**
 * Get the file extension from a MIME type.
 */
export function getExtensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/heic': '.heic',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
  };
  return map[mimeType] || '';
}

/**
 * Build a MailAttachment object from a local file.
 *
 * @param uri - Local file URI
 * @param fileName - Display name
 * @param mimeType - MIME type
 * @param fileSize - Size in bytes
 * @returns MailAttachment ready for compose screen
 */
export function buildAttachment(
  uri: string,
  fileName: string,
  mimeType: string,
  fileSize: number,
): MailAttachment {
  const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    localUri: uri,
    fileName,
    mimeType,
    fileSize,
    isVideo: isVideoType(mimeType),
    compressionStatus: 'pending',
  };
}

// ============================================================
// Thumbnail
// ============================================================

/**
 * Get a thumbnail URI for an attachment.
 * For images, uses the original (or compressed) URI.
 * For videos, returns undefined (native thumbnail generation needed).
 */
export function getThumbnailUri(attachment: MailAttachment): string | undefined {
  if (isImageType(attachment.mimeType)) {
    return attachment.localUri;
  }
  return attachment.thumbnailUri;
}

// ============================================================
// Constants Export
// ============================================================

export {
  IMAGE_COMPRESSION_THRESHOLD,
  MAX_VIDEO_SIZE,
  MAX_TOTAL_ATTACHMENT_SIZE,
};
