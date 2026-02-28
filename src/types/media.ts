/**
 * Media Types — Photo/Video Messaging
 *
 * Type definitions for the media messaging system.
 * Used by mediaService, mediaStorageService, and mediaQueueService.
 *
 * @see .claude/plans/PHOTO_VIDEO_MESSAGING.md for architecture
 */

// ============================================================
// Media Types
// ============================================================

/**
 * Type of media content
 */
export type MediaType = 'photo' | 'video';

/**
 * Transfer status for media in outbox
 */
export type MediaTransferStatus =
  | 'pending'      // Waiting to be sent
  | 'compressing'  // Being compressed
  | 'encrypting'   // Being encrypted
  | 'sending'      // Transfer in progress
  | 'sent'         // Successfully delivered
  | 'received'     // Downloaded from sender
  | 'failed';      // Transfer failed (will retry)

/**
 * Source of the media
 */
export type MediaSource =
  | 'camera'       // Captured with device camera
  | 'gallery'      // Selected from photo library
  | 'received';    // Received from another user

// ============================================================
// Media Item
// ============================================================

/**
 * Media item metadata
 * Used throughout the app for displaying and managing media
 */
export interface MediaItem {
  /** Unique identifier (UUID v4) */
  id: string;

  /** Type of media */
  type: MediaType;

  /** Local file URI (decrypted) */
  localUri: string;

  /** Thumbnail URI (for preview in lists/chat) */
  thumbnailUri: string;

  /** File size in bytes */
  size: number;

  /** Width in pixels */
  width: number;

  /** Height in pixels */
  height: number;

  /** Duration in seconds (video only) */
  duration?: number;

  /** Source of the media */
  source: MediaSource;

  /** Contact JID (for received media) */
  senderJid?: string;

  /** Contact name (for received media) */
  senderName?: string;

  /** Timestamp when created/received */
  timestamp: number;

  /** Associated chat ID (if sent/received in chat) */
  chatId?: string;

  /** Associated message ID */
  messageId?: string;
}

// ============================================================
// Encrypted Media
// ============================================================

/**
 * Encrypted media payload for transfer
 */
export interface EncryptedMediaItem {
  /** Media item ID */
  id: string;

  /** Encrypted data (base64) */
  encryptedData: string;

  /** Encrypted thumbnail (base64) */
  encryptedThumbnail: string;

  /** Encryption key (base64, encrypted per recipient) */
  encryptionKey: string;

  /** Encryption nonce (base64) */
  encryptionNonce: string;

  /** Metadata (not encrypted, for XMPP signaling) */
  metadata: MediaMetadata;
}

/**
 * Media metadata sent via XMPP signaling
 * This is NOT encrypted — only metadata, no content
 */
export interface MediaMetadata {
  /** Media item ID */
  id: string;

  /** Type of media */
  type: MediaType;

  /** File size in bytes */
  size: number;

  /** Width in pixels */
  width: number;

  /** Height in pixels */
  height: number;

  /** Duration in seconds (video only) */
  duration?: number;

  /** Thumbnail data (base64-encoded JPEG, ~10KB) */
  thumbnail: string;

  /** Encryption algorithm */
  algorithm: 'xchacha20-poly1305';
}

// ============================================================
// Media Queue
// ============================================================

/**
 * Media item in the outbox queue
 */
export interface MediaQueueItem {
  /** Media item ID */
  mediaId: string;

  /** Chat ID */
  chatId: string;

  /** Recipient JIDs */
  recipients: string[];

  /** Current transfer status */
  status: MediaTransferStatus;

  /** Retry count */
  retryCount: number;

  /** Timestamp when added to queue */
  createdAt: number;

  /** Expiration timestamp (7 days) */
  expiresAt: number;

  /** Recipients that have received the media */
  deliveredTo: string[];

  /** Error message if failed */
  errorMessage?: string;
}

// ============================================================
// Compression Options
// ============================================================

/**
 * Photo compression options
 */
export interface PhotoCompressionOptions {
  /** Maximum width (default: 1920) */
  maxWidth?: number;

  /** Maximum height (default: 1080) */
  maxHeight?: number;

  /** JPEG quality 0-100 (default: 80) */
  quality?: number;
}

/**
 * Video compression options
 */
export interface VideoCompressionOptions {
  /** Maximum resolution: '720p' | '1080p' (default: '720p') */
  maxResolution?: '720p' | '1080p';

  /** Bitrate in bps (default: 2_000_000 = 2Mbps) */
  bitrate?: number;

  /** Maximum duration in seconds (default: 120 = 2 min) */
  maxDuration?: number;
}

// ============================================================
// Service Results
// ============================================================

/**
 * Result of media compression
 */
export interface CompressionResult {
  /** Success or failure */
  success: boolean;

  /** Compressed file URI */
  uri?: string;

  /** Compressed file size in bytes */
  size?: number;

  /** Width after compression */
  width?: number;

  /** Height after compression */
  height?: number;

  /** Duration after compression (video) */
  duration?: number;

  /** Error message if failed */
  error?: string;
}

/**
 * Result of EXIF stripping
 */
export interface ExifStripResult {
  /** Success or failure */
  success: boolean;

  /** Clean file URI (EXIF removed) */
  uri?: string;

  /** Error message if failed */
  error?: string;
}

/**
 * Progress callback for long operations
 */
export type ProgressCallback = (progress: number) => void;

// ============================================================
// Constants
// ============================================================

/**
 * Media compression defaults
 */
export const MEDIA_DEFAULTS = {
  /** Photo settings */
  photo: {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 80,
    maxSizeBytes: 1024 * 1024, // 1MB target
  },

  /** Video settings */
  video: {
    maxResolution: '720p' as const,
    bitrate: 2_000_000, // 2Mbps
    maxDurationSeconds: 120, // 2 minutes
    maxSizeBytes: 30 * 1024 * 1024, // 30MB target
  },

  /** Thumbnail settings */
  thumbnail: {
    maxWidth: 200,
    maxHeight: 200,
    quality: 60,
  },

  /** Queue settings */
  queue: {
    retentionDays: 7,
    maxRetries: 7,
  },
} as const;

/**
 * Retry delays for failed transfers (exponential backoff)
 */
export const RETRY_DELAYS_MS = [
  1_000,       // 1 second
  5_000,       // 5 seconds
  30_000,      // 30 seconds
  60_000,      // 1 minute
  300_000,     // 5 minutes
  900_000,     // 15 minutes
  3_600_000,   // 1 hour
] as const;
