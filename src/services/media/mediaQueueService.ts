/**
 * MediaQueueService — Offline Queue Management
 *
 * Handles:
 * - Adding media to outbox queue
 * - Processing queue with retry logic
 * - Exponential backoff retries
 * - 7-day expiration cleanup
 *
 * @see types/media.ts for type definitions
 * @see .claude/plans/PHOTO_VIDEO_MESSAGING.md for architecture
 */

import { Database, Q } from '@nozbe/watermelondb';
import type { MediaQueueItem, MediaTransferStatus, RETRY_DELAYS_MS } from '@/types/media';
import { MediaMessageModel } from '@/models/MediaMessage';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[mediaQueueService]';

/** Maximum retry attempts before giving up */
const MAX_RETRIES = 5;

/** Retry delays in milliseconds (exponential backoff) */
const RETRY_DELAYS: number[] = [
  1000,      // 1 second
  5000,      // 5 seconds
  30000,     // 30 seconds
  120000,    // 2 minutes
  300000,    // 5 minutes
];

/** 7-day retention period in milliseconds */
const RETENTION_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/** Process queue interval (30 seconds) */
const QUEUE_PROCESS_INTERVAL_MS = 30000;

/** Cleanup interval (1 hour) */
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

// ============================================================
// Queue Service State
// ============================================================

let database: Database | null = null;
let isProcessing = false;
let processIntervalId: ReturnType<typeof setInterval> | null = null;
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

// Callbacks for external handlers
let onSendMedia: ((item: MediaQueueItem) => Promise<boolean>) | null = null;

// ============================================================
// Initialization
// ============================================================

/**
 * Initialize the media queue service
 *
 * @param db - WatermelonDB database instance
 * @param sendHandler - Callback to send media (returns true if successful)
 */
export function initializeMediaQueue(
  db: Database,
  sendHandler: (item: MediaQueueItem) => Promise<boolean>
): void {
  console.info(LOG_PREFIX, 'Initializing media queue service');

  database = db;
  onSendMedia = sendHandler;

  // Start periodic queue processing
  startQueueProcessing();

  // Start periodic cleanup
  startCleanup();

  console.info(LOG_PREFIX, 'Media queue service initialized');
}

/**
 * Shutdown the media queue service
 */
export function shutdownMediaQueue(): void {
  console.info(LOG_PREFIX, 'Shutting down media queue service');

  stopQueueProcessing();
  stopCleanup();

  database = null;
  onSendMedia = null;
}

// ============================================================
// Queue Management
// ============================================================

/**
 * Add media to the outbox queue
 *
 * @param mediaId - Media ID to queue
 * @returns True if successfully queued
 */
export async function queueMedia(mediaId: string): Promise<boolean> {
  if (!database) {
    console.error(LOG_PREFIX, 'Database not initialized');
    return false;
  }

  try {
    const collection = database.get<MediaMessageModel>('media_messages');
    const media = await collection.find(mediaId);

    if (!media) {
      console.error(LOG_PREFIX, 'Media not found:', mediaId);
      return false;
    }

    // Update status to pending
    await media.updateTransferStatus('pending');

    console.info(LOG_PREFIX, 'Media queued:', mediaId);

    // Trigger immediate processing
    processQueueAsync();

    return true;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to queue media:', error);
    return false;
  }
}

/**
 * Get all pending items in the queue
 *
 * @returns Array of pending media items
 */
export async function getPendingItems(): Promise<MediaQueueItem[]> {
  if (!database) {
    console.warn(LOG_PREFIX, 'Database not initialized');
    return [];
  }

  try {
    const collection = database.get<MediaMessageModel>('media_messages');
    const pending = await MediaMessageModel.queryPending(collection).fetch();

    return pending.map(modelToQueueItem);
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to get pending items:', error);
    return [];
  }
}

/**
 * Get queue status counts
 *
 * @returns Object with counts per status
 */
export async function getQueueStatus(): Promise<Record<MediaTransferStatus, number>> {
  if (!database) {
    return {
      pending: 0,
      compressing: 0,
      encrypting: 0,
      sending: 0,
      sent: 0,
      received: 0,
      failed: 0,
    };
  }

  try {
    const collection = database.get<MediaMessageModel>('media_messages');
    const all = await collection.query().fetch();

    const counts: Record<MediaTransferStatus, number> = {
      pending: 0,
      compressing: 0,
      encrypting: 0,
      sending: 0,
      sent: 0,
      received: 0,
      failed: 0,
    };

    for (const item of all) {
      const status = item.transferStatus as MediaTransferStatus;
      if (status in counts) {
        counts[status]++;
      }
    }

    return counts;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to get queue status:', error);
    return {
      pending: 0,
      compressing: 0,
      encrypting: 0,
      sending: 0,
      sent: 0,
      received: 0,
      failed: 0,
    };
  }
}

/**
 * Retry a failed media item
 *
 * @param mediaId - Media ID to retry
 * @returns True if retry was triggered
 */
export async function retryMedia(mediaId: string): Promise<boolean> {
  if (!database) {
    console.error(LOG_PREFIX, 'Database not initialized');
    return false;
  }

  try {
    const collection = database.get<MediaMessageModel>('media_messages');
    const media = await collection.find(mediaId);

    if (!media) {
      console.error(LOG_PREFIX, 'Media not found:', mediaId);
      return false;
    }

    // Reset to pending status
    await media.updateTransferStatus('pending');

    console.info(LOG_PREFIX, 'Media retry queued:', mediaId);

    // Trigger immediate processing
    processQueueAsync();

    return true;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to retry media:', error);
    return false;
  }
}

/**
 * Cancel a pending media item
 *
 * @param mediaId - Media ID to cancel
 * @returns True if successfully cancelled
 */
export async function cancelMedia(mediaId: string): Promise<boolean> {
  if (!database) {
    console.error(LOG_PREFIX, 'Database not initialized');
    return false;
  }

  try {
    const collection = database.get<MediaMessageModel>('media_messages');
    const media = await collection.find(mediaId);

    if (!media) {
      console.error(LOG_PREFIX, 'Media not found:', mediaId);
      return false;
    }

    // Mark as failed (effectively cancelling)
    await media.markAsFailed();

    console.info(LOG_PREFIX, 'Media cancelled:', mediaId);
    return true;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to cancel media:', error);
    return false;
  }
}

// ============================================================
// Queue Processing
// ============================================================

/**
 * Start periodic queue processing
 */
function startQueueProcessing(): void {
  if (processIntervalId) {
    return; // Already running
  }

  processIntervalId = setInterval(() => {
    processQueueAsync();
  }, QUEUE_PROCESS_INTERVAL_MS);

  // Also process immediately
  processQueueAsync();

  console.debug(LOG_PREFIX, 'Queue processing started');
}

/**
 * Stop periodic queue processing
 */
function stopQueueProcessing(): void {
  if (processIntervalId) {
    clearInterval(processIntervalId);
    processIntervalId = null;
  }

  console.debug(LOG_PREFIX, 'Queue processing stopped');
}

/**
 * Process queue asynchronously (non-blocking)
 */
function processQueueAsync(): void {
  // Fire and forget
  processQueue().catch((error) => {
    console.error(LOG_PREFIX, 'Queue processing error:', error);
  });
}

/**
 * Process the queue (send pending items)
 */
async function processQueue(): Promise<void> {
  if (isProcessing) {
    console.debug(LOG_PREFIX, 'Queue already processing, skipping');
    return;
  }

  if (!database || !onSendMedia) {
    return;
  }

  isProcessing = true;

  try {
    const pending = await getPendingItems();

    if (pending.length === 0) {
      return;
    }

    console.info(LOG_PREFIX, 'Processing queue:', pending.length, 'items');

    for (const item of pending) {
      // Check if item should be retried based on retry delay
      if (!shouldProcessItem(item)) {
        continue;
      }

      await processItem(item);
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Check if an item should be processed based on retry delay
 *
 * @param item - Queue item to check
 * @returns True if item should be processed now
 */
function shouldProcessItem(item: MediaQueueItem): boolean {
  if (item.retryCount === 0) {
    return true; // First attempt, process immediately
  }

  if (item.retryCount >= MAX_RETRIES) {
    return false; // Max retries exceeded
  }

  // Calculate next retry time using exponential backoff
  const delayIndex = Math.min(item.retryCount - 1, RETRY_DELAYS.length - 1);
  const delay = RETRY_DELAYS[delayIndex];
  const nextRetryTime = item.timestamp + delay;

  return Date.now() >= nextRetryTime;
}

/**
 * Process a single queue item
 *
 * @param item - Queue item to process
 */
async function processItem(item: MediaQueueItem): Promise<void> {
  if (!database || !onSendMedia) {
    return;
  }

  try {
    const collection = database.get<MediaMessageModel>('media_messages');
    const media = await collection.find(item.id);

    if (!media) {
      console.warn(LOG_PREFIX, 'Media not found for processing:', item.id);
      return;
    }

    // Update status to sending
    await media.updateTransferStatus('sending');

    console.info(LOG_PREFIX, 'Sending media:', item.id, 'attempt:', item.retryCount + 1);

    // Try to send
    const success = await onSendMedia(item);

    if (success) {
      await media.markAsSent();
      console.info(LOG_PREFIX, 'Media sent successfully:', item.id);
    } else {
      // Increment retry count and mark as pending again
      await media.incrementRetryCount();
      await media.updateTransferStatus('pending');

      if (media.retryCount >= MAX_RETRIES) {
        await media.markAsFailed();
        console.warn(LOG_PREFIX, 'Media failed after max retries:', item.id);
      } else {
        console.info(LOG_PREFIX, 'Media send failed, will retry:', item.id);
      }
    }
  } catch (error) {
    console.error(LOG_PREFIX, 'Error processing item:', item.id, error);

    // Try to mark as failed
    try {
      const collection = database.get<MediaMessageModel>('media_messages');
      const media = await collection.find(item.id);
      if (media) {
        await media.incrementRetryCount();
        await media.updateTransferStatus('pending');
      }
    } catch {
      // Ignore secondary errors
    }
  }
}

// ============================================================
// Cleanup
// ============================================================

/**
 * Start periodic cleanup
 */
function startCleanup(): void {
  if (cleanupIntervalId) {
    return; // Already running
  }

  cleanupIntervalId = setInterval(() => {
    cleanupExpiredMedia().catch((error) => {
      console.error(LOG_PREFIX, 'Cleanup error:', error);
    });
  }, CLEANUP_INTERVAL_MS);

  // Also cleanup immediately
  cleanupExpiredMedia().catch((error) => {
    console.error(LOG_PREFIX, 'Initial cleanup error:', error);
  });

  console.debug(LOG_PREFIX, 'Cleanup started');
}

/**
 * Stop periodic cleanup
 */
function stopCleanup(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }

  console.debug(LOG_PREFIX, 'Cleanup stopped');
}

/**
 * Clean up expired media (older than 7 days)
 *
 * @returns Number of items cleaned up
 */
export async function cleanupExpiredMedia(): Promise<number> {
  if (!database) {
    return 0;
  }

  try {
    const collection = database.get<MediaMessageModel>('media_messages');
    const expired = await MediaMessageModel.queryExpired(collection).fetch();

    if (expired.length === 0) {
      return 0;
    }

    console.info(LOG_PREFIX, 'Cleaning up expired media:', expired.length, 'items');

    // Delete expired records
    await database.write(async () => {
      for (const item of expired) {
        await item.destroyPermanently();
      }
    });

    // Note: Actual file deletion should be handled by mediaStorageService
    // This just cleans up the database records

    console.info(LOG_PREFIX, 'Cleaned up', expired.length, 'expired items');
    return expired.length;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to cleanup expired media:', error);
    return 0;
  }
}

// ============================================================
// Helpers
// ============================================================

/**
 * Convert MediaMessageModel to MediaQueueItem
 */
function modelToQueueItem(model: MediaMessageModel): MediaQueueItem {
  return {
    id: model.id,
    mediaId: model.mediaId,
    messageId: model.messageId,
    type: model.type,
    localUri: model.localUri,
    thumbnailUri: model.thumbnailUri,
    size: model.size,
    width: model.width,
    height: model.height,
    duration: model.duration,
    recipientJid: '', // Will be set by message context
    chatId: model.chatId,
    encryptedUri: '', // Set during encryption
    encryptedThumbnailUri: '', // Set during encryption
    encryptionKey: model.encryptionKey,
    encryptionNonce: model.encryptionNonce,
    status: model.transferStatus,
    retryCount: model.retryCount,
    lastAttempt: model.updatedAt?.getTime() || Date.now(),
    expiresAt: model.expiresAt,
    timestamp: model.createdAt?.getTime() || Date.now(),
  };
}

/**
 * Calculate retry delay for a given retry count
 *
 * @param retryCount - Current retry count
 * @returns Delay in milliseconds before next retry
 */
export function getRetryDelay(retryCount: number): number {
  if (retryCount <= 0) {
    return 0;
  }

  const index = Math.min(retryCount - 1, RETRY_DELAYS.length - 1);
  return RETRY_DELAYS[index];
}

/**
 * Check if media queue service is initialized
 */
export function isQueueInitialized(): boolean {
  return database !== null && onSendMedia !== null;
}

/**
 * Force immediate queue processing
 * Useful after network reconnection
 */
export function triggerQueueProcessing(): void {
  if (!isQueueInitialized()) {
    console.warn(LOG_PREFIX, 'Queue not initialized, cannot trigger processing');
    return;
  }

  console.info(LOG_PREFIX, 'Triggering immediate queue processing');
  processQueueAsync();
}
