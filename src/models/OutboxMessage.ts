/**
 * OutboxMessage Model — WatermelonDB
 *
 * Stores encrypted messages pending delivery.
 * Implements 7-day TTL for offline sync protocol.
 *
 * @see .claude/skills/xmpp-specialist/SKILL.md for offline sync protocol
 */

import { Model, Q } from '@nozbe/watermelondb';
import { field, date, readonly, writer, json } from '@nozbe/watermelondb/decorators';
import type { ContentType } from '@/services/interfaces';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export class OutboxMessageModel extends Model {
  static table = 'outbox_messages';

  @field('chat_id') chatId!: string;
  @field('encrypted_content') encryptedContent!: string; // NEVER plaintext
  @field('content_type') contentType!: ContentType;
  @field('timestamp') timestamp!: number;
  @field('expires_at') expiresAt!: number;
  @json('pending_to', (raw: string[]) => raw || []) pendingTo!: string[]; // JIDs
  @json('delivered_to', (raw: string[]) => raw || []) deliveredTo!: string[]; // JIDs
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Mark a recipient as delivered
   */
  @writer async markDeliveredTo(recipientJid: string): Promise<void> {
    await this.update(record => {
      const pending = [...record.pendingTo];
      const delivered = [...record.deliveredTo];

      const idx = pending.indexOf(recipientJid);
      if (idx !== -1) {
        pending.splice(idx, 1);
        delivered.push(recipientJid);
        record.pendingTo = pending;
        record.deliveredTo = delivered;
      }
    });
  }

  /**
   * Check if all recipients have received the message
   */
  get isFullyDelivered(): boolean {
    return this.pendingTo.length === 0;
  }

  /**
   * Check if message has expired
   */
  get isExpired(): boolean {
    return Date.now() > this.expiresAt;
  }

  /**
   * Query outbox messages pending for a specific recipient
   */
  static queryForRecipient(collection: OutboxMessageModel['collection'], jid: string) {
    return collection.query(
      Q.where('expires_at', Q.gt(Date.now())),
      Q.where('pending_to', Q.like(`%${jid}%`)),
    );
  }

  /**
   * Query expired messages for cleanup
   */
  static queryExpired(collection: OutboxMessageModel['collection']) {
    return collection.query(Q.where('expires_at', Q.lt(Date.now())));
  }

  /**
   * Calculate expiry timestamp (7 days from now)
   */
  static calculateExpiresAt(): number {
    return Date.now() + SEVEN_DAYS_MS;
  }
}
