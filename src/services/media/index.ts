/**
 * Media Services — Export Module
 *
 * Provides photo/video processing, storage, and queue management.
 *
 * @see types/media.ts for type definitions
 * @see .claude/plans/PHOTO_VIDEO_MESSAGING.md for architecture
 */

// ============================================================
// Media Processing Service
// ============================================================

export {
  // Photo processing
  compressPhoto,
  generatePhotoThumbnail,
  stripExifData,

  // Video processing (TODO: full implementation)
  compressVideo,
  generateVideoThumbnail,
  getVideoDuration,
  validateVideoDuration,

  // Utility functions
  getFileSize,
  readAsBase64,
  writeBase64ToFile,
  deleteFile,
  copyToMediaDirectory,
  getMediaTypeFromUri,

  // Re-exported constants
  MEDIA_DEFAULTS,
} from './mediaService';

// ============================================================
// Media Storage Service
// ============================================================

export {
  // Save media
  savePhoto,
  saveVideo,
  saveMedia,

  // Retrieve media
  mediaExists,
  getMediaUri,
  getThumbnailUri,

  // Cleanup
  deleteMedia,
  deleteMediaBatch,
  cleanupTempFiles,

  // Storage info
  getStorageUsage,
  getAvailableStorage,
  isStorageLow,
  getMediaCount,
} from './mediaStorageService';

// ============================================================
// Media Queue Service
// ============================================================

export {
  // Initialization
  initializeMediaQueue,
  shutdownMediaQueue,

  // Queue management
  queueMedia,
  getPendingItems,
  getQueueStatus,
  retryMedia,
  cancelMedia,

  // Cleanup
  cleanupExpiredMedia,

  // Helpers
  getRetryDelay,
  isQueueInitialized,
  triggerQueueProcessing,
} from './mediaQueueService';
