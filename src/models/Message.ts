/**
 * Message Model — WatermelonDB
 *
 * Stores decrypted messages locally.
 * Related to a chat (1-on-1 or group) via chatId.
 *
 * Media messages (v13):
 * - contentType 'image' or 'video' indicates media message
 * - mediaId references media_messages table
 * - thumbnailData contains base64 preview (~10KB)
 * - mediaWidth/mediaHeight/mediaDuration for dimensions
 */

import { Model, Q } from '@nozbe/watermelondb';
import { field, date, readonly, writer } from '@nozbe/watermelondb/decorators';
import type { ContentType, DeliveryStatus } from '@/services/interfaces';

export class MessageModel extends Model {
  static table = 'messages';

  @field('chat_id') chatId!: string;
  @field('sender_id') senderId!: string;
  @field('sender_name') senderName!: string;
  @field('content') content!: string;
  @field('content_type') contentType!: ContentType;
  @field('timestamp') timestamp!: number;
  @field('status') status!: DeliveryStatus;
  @field('is_read') isRead!: boolean;

  // Media fields (v13) — only for image/video content types
  @field('media_id') mediaId?: string;
  @field('thumbnail_data') thumbnailData?: string;
  @field('media_width') mediaWidth?: number;
  @field('media_height') mediaHeight?: number;
  @field('media_duration') mediaDuration?: number;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Update delivery status
   */
  @writer async updateStatus(newStatus: DeliveryStatus): Promise<void> {
    await this.update(record => {
      record.status = newStatus;
    });
  }

  /**
   * Mark message as read
   */
  @writer async markAsRead(): Promise<void> {
    if (!this.isRead) {
      await this.update(record => {
        record.isRead = true;
      });
    }
  }

  /**
   * Query messages by chatId, ordered by timestamp descending (newest first)
   */
  static queryByChatId(collection: MessageModel['collection'], chatId: string) {
    return collection.query(
      Q.where('chat_id', chatId),
      Q.sortBy('timestamp', Q.desc),
    );
  }

  /**
   * Query media messages only (images and videos)
   */
  static queryMediaByChatId(collection: MessageModel['collection'], chatId: string) {
    return collection.query(
      Q.where('chat_id', chatId),
      Q.where('content_type', Q.oneOf(['image', 'video'])),
      Q.sortBy('timestamp', Q.desc),
    );
  }

  /**
   * Check if this is a media message
   */
  get isMediaMessage(): boolean {
    return this.contentType === 'image' || this.contentType === 'video';
  }

  /**
   * Check if this is a photo message
   */
  get isPhoto(): boolean {
    return this.contentType === 'image';
  }

  /**
   * Check if this is a video message
   */
  get isVideo(): boolean {
    return this.contentType === 'video';
  }
}
