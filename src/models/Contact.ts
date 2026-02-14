/**
 * Contact Model — WatermelonDB
 *
 * Stores contact information including public keys for encryption.
 */

import { Model, Q } from '@nozbe/watermelondb';
import { field, date, readonly, writer } from '@nozbe/watermelondb/decorators';

export class ContactModel extends Model {
  static table = 'contacts';

  @field('user_uuid') userUuid!: string;    // Stable identifier (never changes)
  @field('jid') jid!: string;               // = {userUuid}@commeazy.local
  @field('name') name!: string;
  @field('phone_number') phoneNumber?: string;  // Optional (privacy: can be hidden)
  @field('public_key') publicKey!: string; // Base64
  @field('verified') verified!: boolean; // QR verified
  @field('last_seen') lastSeen!: number;
  @field('photo_path') photoPath?: string;  // Local file path to avatar
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Mark contact as verified (via QR code scan)
   */
  @writer async markVerified(): Promise<void> {
    await this.update(record => {
      record.verified = true;
    });
  }

  /**
   * Update last seen timestamp
   */
  @writer async updateLastSeen(timestamp?: number): Promise<void> {
    await this.update(record => {
      record.lastSeen = timestamp ?? Date.now();
    });
  }

  /**
   * Update contact name
   */
  @writer async updateName(newName: string): Promise<void> {
    await this.update(record => {
      record.name = newName;
    });
  }

  /**
   * Query contact by JID
   */
  static queryByJid(collection: ContactModel['collection'], jid: string) {
    return collection.query(Q.where('jid', jid));
  }

  /**
   * Query contact by UUID
   */
  static queryByUuid(collection: ContactModel['collection'], userUuid: string) {
    return collection.query(Q.where('user_uuid', userUuid));
  }

  /**
   * Query all contacts, sorted by name
   */
  static queryAll(collection: ContactModel['collection']) {
    return collection.query(Q.sortBy('name', Q.asc));
  }
}
