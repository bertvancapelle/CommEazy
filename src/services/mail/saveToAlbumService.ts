/**
 * Save To Album Service — Save mail attachments to CommEazy Fotoalbum
 *
 * Saves photos from mail attachments into CommEazy's own media storage
 * (DocumentDirectoryPath/media/) via mediaStorageService. Does NOT use
 * the iOS Camera Roll or @react-native-camera-roll/camera-roll.
 *
 * Flow:
 * 1. Download attachment via imapBridge.fetchAttachmentData()
 * 2. Write to temporary file
 * 3. Save to Fotoalbum via mediaStorageService.savePhoto()
 * 4. Clean up temporary file (even on error)
 * 5. Return SaveResult
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 17
 */

import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { canSaveToAlbum, isImageType, getExtensionFromMime } from './mediaAttachmentService';
import { fetchAttachmentData } from './imapBridge';
import { savePhoto, saveMedia } from '@/services/media/mediaStorageService';
import type { MailAttachmentMeta } from '@/types/mail';

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
  | 'ALBUM_ERROR';

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
// Duplicate Prevention
// ============================================================

/** AsyncStorage prefix for tracking saved mail attachments */
const SAVE_KEY_PREFIX = '@commeazy/mail_saved_';

/**
 * Build a unique key for a mail attachment.
 */
function buildSaveKey(accountId: string, uid: number, attachmentIndex: number): string {
  return `${SAVE_KEY_PREFIX}${accountId}_${uid}_${attachmentIndex}`;
}

/**
 * Check if an attachment has already been saved to the album.
 */
export async function isAlreadySaved(
  accountId: string,
  uid: number,
  attachmentIndex: number,
): Promise<boolean> {
  try {
    const key = buildSaveKey(accountId, uid, attachmentIndex);
    const value = await AsyncStorage.getItem(key);
    return value !== null;
  } catch {
    return false;
  }
}

/**
 * Mark an attachment as saved in AsyncStorage.
 */
async function markAsSaved(
  accountId: string,
  uid: number,
  attachmentIndex: number,
  mediaId: string,
): Promise<void> {
  try {
    const key = buildSaveKey(accountId, uid, attachmentIndex);
    await AsyncStorage.setItem(key, mediaId);
  } catch {
    // Non-critical: duplicate prevention data lost
  }
}

// ============================================================
// Single Save
// ============================================================

/**
 * Save a single mail attachment to CommEazy's Fotoalbum.
 *
 * Downloads the attachment via IMAP, writes to a temp file,
 * then saves to the app's own media storage via mediaStorageService.
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
  _onProgress?: (progress: DownloadProgress) => void,
): Promise<SaveResult> {
  // Validate MIME type
  if (!canSaveToAlbum(attachment.mimeType)) {
    return { success: false, error: 'UNSUPPORTED_FORMAT' };
  }

  // Check for duplicates
  const alreadySaved = await isAlreadySaved(accountId, uid, attachment.index);
  if (alreadySaved) {
    return { success: false, error: 'ALREADY_SAVED' };
  }

  const extension = getExtensionFromMime(attachment.mimeType);
  const tempFileName = `mail_att_${uid}_${attachment.index}${extension}`;
  const tempPath = `${RNFS.CachesDirectoryPath}/${tempFileName}`;

  try {
    // Step 1: Download attachment data via IMAP bridge
    const attachmentData = await fetchAttachmentData(
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

    // Step 3: Save to CommEazy's Fotoalbum via mediaStorageService
    if (isImageType(attachment.mimeType)) {
      const mediaItem = await savePhoto(
        tempPath,
        `mail_${accountId}`, // chatId — group by mail account
        'received',          // source
        undefined,           // senderJid
        undefined,           // senderName
      );

      if (mediaItem) {
        // Mark as saved to prevent duplicates
        await markAsSaved(accountId, uid, attachment.index, mediaItem.id);
        return { success: true, mediaId: mediaItem.id };
      }

      return { success: false, error: 'ALBUM_ERROR' };
    } else {
      // Video — use saveVideo if available, otherwise saveMedia
      const mediaItem = await saveMedia(
        tempPath,
        `mail_${accountId}`,
        'received',
      );

      if (mediaItem) {
        await markAsSaved(accountId, uid, attachment.index, mediaItem.id);
        return { success: true, mediaId: mediaItem.id };
      }

      return { success: false, error: 'ALBUM_ERROR' };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('space') || message.includes('storage')) {
      return { success: false, error: 'STORAGE_FULL' };
    }

    return { success: false, error: 'DOWNLOAD_FAILED' };
  } finally {
    // Always clean up temp file
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
