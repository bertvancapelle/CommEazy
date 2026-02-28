/**
 * MediaMessage Model — WatermelonDB
 *
 * Stores media files metadata (photos and videos).
 * Related to a message via messageId.
 *
 * @see types/media.ts for type definitions
 * @see .claude/plans/PHOTO_VIDEO_MESSAGING.md for architecture
 */

import { Model, Q } from '@nozbe/watermelondb';
import { field, date, readonly, writer } from '@nozbe/watermelondb/decorators';
import type { MediaType, MediaTransferStatus, MediaSource } from '@/types/media';

export class MediaMessageModel extends Model {
  static table = 'media_messages';

  // ============================================================
  // Fields
  // ============================================================

  /** Unique media ID (UUID v4) */
  @field('media_id') mediaId!: string;

  /** Reference to messages table */
  @field('message_id') messageId!: string;

  /** Type of media: 'photo' | 'video' */
  @field('type') type!: MediaType;

  /** Local file path (decrypted) */
  @field('local_uri') localUri!: string;

  /** Local thumbnail path */
  @field('thumbnail_uri') thumbnailUri!: string;

  /** File size in bytes */
  @field('size') size!: number;

  /** Width in pixels */
  @field('width') width!: number;

  /** Height in pixels */
  @field('height') height!: number;

  /** Video duration in seconds (optional) */
  @field('duration') duration?: number;

  /** Source: 'camera' | 'gallery' | 'received' */
  @field('source') source!: MediaSource;

  /** Sender JID (for received media) */
  @field('sender_jid') senderJid?: string;

  /** Sender name (for received media) */
  @field('sender_name') senderName?: string;

  /** Associated chat ID */
  @field('chat_id') chatId!: string;

  /** Base64 encryption key */
  @field('encryption_key') encryptionKey!: string;

  /** Base64 encryption nonce */
  @field('encryption_nonce') encryptionNonce!: string;

  /** Transfer status */
  @field('transfer_status') transferStatus!: MediaTransferStatus;

  /** Retry attempts */
  @field('retry_count') retryCount!: number;

  /** 7-day expiration timestamp */
  @field('expires_at') expiresAt!: number;

  /** Created timestamp */
  @readonly @date('created_at') createdAt!: Date;

  /** Updated timestamp */
  @readonly @date('updated_at') updatedAt!: Date;

  // ============================================================
  // Writer Methods
  // ============================================================

  /**
   * Update transfer status
   */
  @writer async updateTransferStatus(newStatus: MediaTransferStatus): Promise<void> {
    await this.update(record => {
      record.transferStatus = newStatus;
    });
  }

  /**
   * Increment retry count
   */
  @writer async incrementRetryCount(): Promise<void> {
    await this.update(record => {
      record.retryCount = (record.retryCount || 0) + 1;
    });
  }

  /**
   * Mark as sent
   */
  @writer async markAsSent(): Promise<void> {
    await this.update(record => {
      record.transferStatus = 'sent';
    });
  }

  /**
   * Mark as failed
   */
  @writer async markAsFailed(): Promise<void> {
    await this.update(record => {
      record.transferStatus = 'failed';
    });
  }

  /**
   * Update local URIs after decryption
   */
  @writer async updateLocalUris(localUri: string, thumbnailUri: string): Promise<void> {
    await this.update(record => {
      record.localUri = localUri;
      record.thumbnailUri = thumbnailUri;
      record.transferStatus = 'received';
    });
  }

  // ============================================================
  // Static Query Methods
  // ============================================================

  /**
   * Query media by chat ID, ordered by creation date descending
   */
  static queryByChatId(collection: MediaMessageModel['collection'], chatId: string) {
    return collection.query(
      Q.where('chat_id', chatId),
      Q.sortBy('created_at', Q.desc),
    );
  }

  /**
   * Query media by message ID
   */
  static queryByMessageId(collection: MediaMessageModel['collection'], messageId: string) {
    return collection.query(
      Q.where('message_id', messageId),
    );
  }

  /**
   * Query pending media (waiting to be sent)
   */
  static queryPending(collection: MediaMessageModel['collection']) {
    return collection.query(
      Q.where('transfer_status', Q.oneOf(['pending', 'failed'])),
      Q.where('expires_at', Q.gt(Date.now())),
      Q.sortBy('created_at', Q.asc),
    );
  }

  /**
   * Query expired media (older than 7 days)
   */
  static queryExpired(collection: MediaMessageModel['collection']) {
    return collection.query(
      Q.where('expires_at', Q.lt(Date.now())),
    );
  }

  /**
   * Query own media (captured with camera or from gallery)
   */
  static queryOwnMedia(collection: MediaMessageModel['collection']) {
    return collection.query(
      Q.where('source', Q.oneOf(['camera', 'gallery'])),
      Q.sortBy('created_at', Q.desc),
    );
  }

  /**
   * Query received media (from other users)
   */
  static queryReceivedMedia(collection: MediaMessageModel['collection']) {
    return collection.query(
      Q.where('source', 'received'),
      Q.sortBy('created_at', Q.desc),
    );
  }

  /**
   * Query received media by sender
   */
  static queryReceivedFromSender(collection: MediaMessageModel['collection'], senderJid: string) {
    return collection.query(
      Q.where('source', 'received'),
      Q.where('sender_jid', senderJid),
      Q.sortBy('created_at', Q.desc),
    );
  }

  /**
   * Query all media, ordered by creation date descending
   */
  static queryAll(collection: MediaMessageModel['collection']) {
    return collection.query(
      Q.sortBy('created_at', Q.desc),
    );
  }

  /**
   * Query photos only
   */
  static queryPhotos(collection: MediaMessageModel['collection']) {
    return collection.query(
      Q.where('type', 'photo'),
      Q.sortBy('created_at', Q.desc),
    );
  }

  /**
   * Query videos only
   */
  static queryVideos(collection: MediaMessageModel['collection']) {
    return collection.query(
      Q.where('type', 'video'),
      Q.sortBy('created_at', Q.desc),
    );
  }
}
