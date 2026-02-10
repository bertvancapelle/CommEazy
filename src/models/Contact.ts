/**
 * Contact Model — WatermelonDB
 *
 * Stores contact information including public keys for encryption.
 */

import { Model, Q } from '@nozbe/watermelondb';
import { field, date, readonly, writer } from '@nozbe/watermelondb/decorators';

export class ContactModel extends Model {
  static table = 'contacts';

  @field('jid') jid!: string;
  @field('name') name!: string;
  @field('phone_number') phoneNumber!: string;
  @field('public_key') publicKey!: string; // Base64
  @field('verified') verified!: boolean; // QR verified
  @field('last_seen') lastSeen!: number;
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
   * Query all contacts, sorted by name
   */
  static queryAll(collection: ContactModel['collection']) {
    return collection.query(Q.sortBy('name', Q.asc));
  }
}
