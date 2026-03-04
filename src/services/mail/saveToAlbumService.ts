/**
 * Save To Album Service — Save mail attachments to CommEazy PhotoAlbum
 *
 * Thin wrapper — does NOT duplicate album logic. Uses existing media
 * service and PhotoAlbum module for actual storage.
 *
 * Flow:
 * 1. Duplicate check via album service
 * 2. Download attachment via imapBridge.fetchAttachmentData()
 * 3. Write temporary file
 * 4. Save to album via media service
 * 5. Clean up temporary file (even on error)
 * 6. Return SaveResult
 *
 * ⛔ BLOKKEERDER: Mail module cannot be considered complete without this.
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 17
 */

import RNFS from 'react-native-fs';
import { NativeModules, Platform } from 'react-native';
import { canSaveToAlbum, isImageType, isVideoType, getExtensionFromMime } from './mediaAttachmentService';
import type { MailAttachmentMeta, AttachmentData } from '@/types/mail';

// ============================================================
// Types
// ============================================================

export interface SaveResult {
  success: boolean;
  mediaId?: string;
  error?: SaveError;
}

export type SaveError =
  | 'STORAGE_FULL'
  | 'UNSUPPORTED_FORMAT'
  | 'DOWNLOAD_FAILED'
  | 'ALREADY_SAVED'
  | 'ALBUM_ERROR'
  | 'PERMISSION_DENIED';

export interface DownloadProgress {
  attachmentId: string;
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
}

export interface BulkSaveResult {
  total: number;
  saved: number;
  failed: number;
  results: SaveResult[];
}

// ============================================================
// Single Save
// ============================================================

/**
 * Save a single mail attachment to the device photo album.
 *
 * @param uid - Mail UID
 * @param folder - Mail folder name
 * @param attachment - Attachment metadata
 * @param accountId - Mail account ID
 * @param onProgress - Optional progress callback
 * @returns SaveResult
 */
export async function saveAttachmentToAlbum(
  uid: number,
  folder: string,
  attachment: MailAttachmentMeta,
  accountId: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<SaveResult> {
  // Validate MIME type
  if (!canSaveToAlbum(attachment.mimeType)) {
    return { success: false, error: 'UNSUPPORTED_FORMAT' };
  }

  const extension = getExtensionFromMime(attachment.mimeType);
  const tempFileName = `mail_att_${uid}_${attachment.index}${extension}`;
  const tempPath = `${RNFS.CachesDirectoryPath}/${tempFileName}`;

  try {
    // Step 1: Download attachment data via IMAP bridge
    const imapBridge = await import('./imapBridge');
    const attachmentData = await imapBridge.fetchAttachmentData(
      uid,
      folder,
      attachment.index,
    );

    if (!attachmentData) {
      return { success: false, error: 'DOWNLOAD_FAILED' };
    }

    // Step 2: Write to temporary file
    if (attachmentData.base64) {
      await RNFS.writeFile(tempPath, attachmentData.base64, 'base64');
    } else if (attachmentData.filePath) {
      await RNFS.copyFile(attachmentData.filePath, tempPath);
    } else {
      return { success: false, error: 'DOWNLOAD_FAILED' };
    }

    // Step 3: Save to device Camera Roll / Photos app
    if (Platform.OS === 'ios') {
      // On iOS, use CameraRoll API to save to Photos
      try {
        const CameraRoll = await import('@react-native-camera-roll/camera-roll');
        const savedUri = await CameraRoll.CameraRoll.saveAsset(tempPath, {
          type: isVideoType(attachment.mimeType) ? 'video' : 'photo',
        });
        return { success: true, mediaId: savedUri.node?.image?.uri };
      } catch {
        return { success: false, error: 'ALBUM_ERROR' };
      }
    } else {
      // Android: save to MediaStore
      try {
        const CameraRoll = await import('@react-native-camera-roll/camera-roll');
        const savedUri = await CameraRoll.CameraRoll.saveAsset(tempPath, {
          type: isVideoType(attachment.mimeType) ? 'video' : 'photo',
        });
        return { success: true, mediaId: savedUri.node?.image?.uri };
      } catch {
        return { success: false, error: 'ALBUM_ERROR' };
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('permission') || message.includes('Permission')) {
      return { success: false, error: 'PERMISSION_DENIED' };
    }
    if (message.includes('space') || message.includes('storage')) {
      return { success: false, error: 'STORAGE_FULL' };
    }

    return { success: false, error: 'DOWNLOAD_FAILED' };
  } finally {
    // Step 5: Always clean up temp file
    try {
      const exists = await RNFS.exists(tempPath);
      if (exists) {
        await RNFS.unlink(tempPath);
      }
    } catch {
      // Non-critical: temp file cleanup failed
    }
  }
}

// ============================================================
// Bulk Save
// ============================================================

/**
 * Save multiple attachments to the album sequentially.
 * Stops if cancelled via the abort signal.
 *
 * @param attachments - Array of {uid, folder, attachment, accountId}
 * @param onProgress - Progress callback per attachment
 * @param abortSignal - Optional AbortSignal to cancel
 * @returns BulkSaveResult with per-attachment results
 */
export async function saveAttachmentsBulk(
  attachments: Array<{
    uid: number;
    folder: string;
    attachment: MailAttachmentMeta;
    accountId: string;
  }>,
  onProgress?: (index: number, total: number, progress: DownloadProgress) => void,
  abortSignal?: AbortSignal,
): Promise<BulkSaveResult> {
  const results: SaveResult[] = [];
  let saved = 0;
  let failed = 0;

  for (let i = 0; i < attachments.length; i++) {
    // Check for cancellation
    if (abortSignal?.aborted) {
      // Mark remaining as failed
      for (let j = i; j < attachments.length; j++) {
        results.push({ success: false, error: 'DOWNLOAD_FAILED' });
        failed++;
      }
      break;
    }

    const { uid, folder, attachment, accountId } = attachments[i];

    const result = await saveAttachmentToAlbum(
      uid,
      folder,
      attachment,
      accountId,
      (progress) => onProgress?.(i, attachments.length, progress),
    );

    results.push(result);
    if (result.success) {
      saved++;
    } else {
      failed++;
    }
  }

  return {
    total: attachments.length,
    saved,
    failed,
    results,
  };
}

/**
 * Get saveable attachments from a list of attachment metadata.
 * Filters to only image/video types that can be saved to album.
 *
 * @param attachments - All attachment metadata
 * @returns Only attachments that can be saved to the photo album
 */
export function getSaveableAttachments(
  attachments: MailAttachmentMeta[],
): MailAttachmentMeta[] {
  return attachments.filter(a => canSaveToAlbum(a.mimeType));
}
