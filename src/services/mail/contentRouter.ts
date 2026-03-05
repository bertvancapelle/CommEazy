/**
 * Content Router — Routes attachments and URLs to the right handler
 *
 * Determines whether content should be handled:
 * 1. In-app via QLPreviewController (documents: PDF, Word, Excel, etc.)
 * 2. In-app via SFSafariViewController (web URLs)
 * 3. In-app via internal module (mailto:, tel:, .ics, .vcf)
 * 4. Delegated to OS (unsupported types)
 *
 * ARCHITECTURE:
 * - Uses native DocumentPreviewModule for iOS Quick Look + Safari
 * - ContentRouter.openAttachment() downloads + previews
 * - ContentRouter.openURL() routes URLs to correct handler
 *
 * SENIOR UX:
 * - User stays in CommEazy for all common file types
 * - Web links open in-app with "Gereed" (Done) button
 * - Only unknown types delegate to OS
 *
 * @see DocumentPreviewModule.swift — Native iOS implementation
 * @see MailDetailScreen.tsx — Integration point
 */

import { NativeModules, Linking, Platform } from 'react-native';
import RNFS from 'react-native-fs';

// ============================================================
// Native Module Bridge
// ============================================================

const { DocumentPreviewModule } = NativeModules;

// ============================================================
// Types
// ============================================================

export type ContentAction =
  | 'preview'      // QLPreviewController (documents, images)
  | 'safari'       // SFSafariViewController (web URLs)
  | 'internal'     // Internal CommEazy module (mailto, tel, ics, vcf)
  | 'os_delegate'; // Let OS handle it (unsupported)

export interface RouteResult {
  action: ContentAction;
  handled: boolean;
  error?: string;
}

// ============================================================
// MIME Type → File Extension Mapping
// ============================================================

const MIME_TO_EXTENSION: Record<string, string> = {
  // Images
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/heic': '.heic',
  'image/gif': '.gif',
  'image/tiff': '.tiff',
  'image/bmp': '.bmp',
  'image/webp': '.webp',
  // Video
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  // PDF
  'application/pdf': '.pdf',
  // Microsoft Office
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  // iWork
  'application/vnd.apple.pages': '.pages',
  'application/vnd.apple.numbers': '.numbers',
  'application/vnd.apple.keynote': '.keynote',
  // Text / Data
  'text/plain': '.txt',
  'text/csv': '.csv',
  'text/html': '.html',
  'application/rtf': '.rtf',
  'text/rtf': '.rtf',
  // Calendar / Contact
  'text/calendar': '.ics',
  'text/vcard': '.vcf',
  'text/x-vcard': '.vcf',
  // Archives
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
};

// ============================================================
// Previewable MIME types (QLPreviewController can handle these)
// ============================================================

const PREVIEWABLE_MIME_TYPES = new Set([
  // Images
  'image/jpeg', 'image/png', 'image/heic', 'image/gif',
  'image/tiff', 'image/bmp', 'image/webp',
  // Video
  'video/mp4', 'video/quicktime',
  // PDF
  'application/pdf',
  // Microsoft Office
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // iWork
  'application/vnd.apple.pages',
  'application/vnd.apple.numbers',
  'application/vnd.apple.keynote',
  // Text / Data
  'text/plain', 'text/csv', 'text/html',
  'application/rtf', 'text/rtf',
]);

// ============================================================
// Public API
// ============================================================

/**
 * Check if a MIME type can be previewed in-app via QLPreviewController.
 */
export function isPreviewable(mimeType: string): boolean {
  return PREVIEWABLE_MIME_TYPES.has(mimeType.toLowerCase());
}

/**
 * Get the file extension for a MIME type.
 */
export function getExtension(mimeType: string): string {
  return MIME_TO_EXTENSION[mimeType.toLowerCase()] || '';
}

/**
 * Preview a local file using iOS Quick Look (QLPreviewController).
 * Supports PDF, Word, Excel, PowerPoint, iWork, images, text, CSV.
 *
 * @param filePath - Absolute path to the local file
 * @returns RouteResult indicating success
 */
export async function previewFile(filePath: string): Promise<RouteResult> {
  console.debug('[contentRouter] previewFile called:', {
    filePath: filePath.slice(-40),
    platform: Platform.OS,
    moduleAvailable: !!DocumentPreviewModule,
  });

  if (Platform.OS !== 'ios' || !DocumentPreviewModule) {
    console.debug('[contentRouter] No native module, delegating to OS');
    return openWithOS(filePath);
  }

  try {
    await DocumentPreviewModule.previewFile(filePath);
    return { action: 'preview', handled: true };
  } catch (err) {
    console.debug('[contentRouter] Preview failed, delegating to OS:', err);
    return openWithOS(filePath);
  }
}

/**
 * Open a URL using the appropriate handler.
 *
 * Routing logic:
 * - mailto: → OS mail handler (or future internal compose)
 * - tel: → OS phone handler (or internal call module)
 * - http/https → SFSafariViewController (in-app browser)
 * - Other → OS delegation
 *
 * @param url - URL to open
 * @param tintColorHex - Optional accent color for Safari toolbar
 * @returns RouteResult indicating what happened
 */
export async function openURL(
  url: string,
  tintColorHex?: string,
): Promise<RouteResult> {
  const lowered = url.toLowerCase();

  // mailto: → OS handler (future: internal compose screen)
  if (lowered.startsWith('mailto:')) {
    await Linking.openURL(url).catch(() => {});
    return { action: 'internal', handled: true };
  }

  // tel: → OS handler (future: internal call module)
  if (lowered.startsWith('tel:')) {
    await Linking.openURL(url).catch(() => {});
    return { action: 'internal', handled: true };
  }

  // http/https → SFSafariViewController (in-app browser)
  if (lowered.startsWith('http://') || lowered.startsWith('https://')) {
    if (Platform.OS === 'ios' && DocumentPreviewModule) {
      try {
        await DocumentPreviewModule.openURL(url, tintColorHex || null);
        return { action: 'safari', handled: true };
      } catch (err) {
        console.debug('[contentRouter] Safari failed, using Linking:', err);
        await Linking.openURL(url).catch(() => {});
        return { action: 'os_delegate', handled: true };
      }
    }

    // Android fallback: use system browser
    await Linking.openURL(url).catch(() => {});
    return { action: 'os_delegate', handled: true };
  }

  // Unknown scheme → OS delegation
  try {
    await Linking.openURL(url);
    return { action: 'os_delegate', handled: true };
  } catch {
    return { action: 'os_delegate', handled: false, error: 'Could not open URL' };
  }
}

/**
 * Download an attachment from IMAP and preview it in-app.
 *
 * Flow:
 * 1. Download attachment data via imapBridge
 * 2. Write to temp file with correct extension
 * 3. Preview with QLPreviewController (or delegate to OS)
 *
 * @param uid - Message UID
 * @param folder - Mailbox folder name
 * @param partIndex - Attachment part index
 * @param fileName - Original file name
 * @param mimeType - MIME type of the attachment
 * @returns RouteResult
 */
export async function downloadAndPreview(
  uid: number,
  folder: string,
  partIndex: number,
  fileName: string,
  mimeType: string,
): Promise<RouteResult> {
  try {
    // Dynamic import to avoid circular dependency
    const imapBridge = await import('./imapBridge');
    const result = await imapBridge.fetchAttachmentData(uid, folder, partIndex);

    let filePath: string;

    if (result.filePath) {
      // Large file: already written to disk
      filePath = result.filePath;
    } else if (result.base64) {
      // Small file: write base64 to temp file
      const ext = getExtension(mimeType) || getExtensionFromFileName(fileName);
      const tempFileName = `preview_${uid}_${partIndex}${ext}`;
      filePath = `${RNFS.CachesDirectoryPath}/${tempFileName}`;
      await RNFS.writeFile(filePath, result.base64, 'base64');
    } else {
      return { action: 'os_delegate', handled: false, error: 'No data received' };
    }

    // Preview if supported, otherwise delegate to OS
    console.debug('[contentRouter] downloadAndPreview:', {
      mimeType,
      isPreviewable: isPreviewable(mimeType),
      filePath: filePath.slice(-40),
    });

    if (isPreviewable(mimeType) && Platform.OS === 'ios') {
      return await previewFile(filePath);
    }

    return openWithOS(filePath);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Download failed';
    return { action: 'os_delegate', handled: false, error: message };
  }
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Delegate file opening to OS.
 */
async function openWithOS(filePath: string): Promise<RouteResult> {
  try {
    const fileUrl = `file://${filePath}`;
    await Linking.openURL(fileUrl);
    return { action: 'os_delegate', handled: true };
  } catch {
    return { action: 'os_delegate', handled: false, error: 'OS could not open file' };
  }
}

/**
 * Extract file extension from a file name.
 */
function getExtensionFromFileName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex < 0) return '';
  return fileName.substring(dotIndex);
}
