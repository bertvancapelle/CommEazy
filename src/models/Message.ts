/**
 * Message Model — WatermelonDB
 *
 * Stores decrypted messages locally.
 * Related to a chat (1-on-1 or group) via chatId.
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
   * Query messages by chatId, ordered by timestamp descending (newest first)
   */
  static queryByChatId(collection: MessageModel['collection'], chatId: string) {
    return collection.query(
      Q.where('chat_id', chatId),
      Q.sortBy('timestamp', Q.desc),
    );
  }
}
