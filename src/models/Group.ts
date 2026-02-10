/**
 * Group Model — WatermelonDB
 *
 * Stores group chat metadata.
 * Members are stored as JSON array of JIDs.
 */

import { Model, Q } from '@nozbe/watermelondb';
import { field, date, readonly, writer, json } from '@nozbe/watermelondb/decorators';
import type { EncryptionMode } from '@/services/interfaces';

export class GroupModel extends Model {
  static table = 'groups';

  @field('name') name!: string;
  @json('members', (raw: string[]) => raw || []) members!: string[]; // JIDs
  @field('created_by') createdBy!: string;
  @field('encryption_mode') encryptionMode!: EncryptionMode;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Update group members
   */
  @writer async updateMembers(newMembers: string[]): Promise<void> {
    await this.update(record => {
      record.members = newMembers;
      // Update encryption mode based on member count
      record.encryptionMode = newMembers.length <= 8 ? 'encrypt-to-all' : 'shared-key';
    });
  }

  /**
   * Add a member to the group
   */
  @writer async addMember(jid: string): Promise<void> {
    await this.update(record => {
      if (!record.members.includes(jid)) {
        const newMembers = [...record.members, jid];
        record.members = newMembers;
        record.encryptionMode = newMembers.length <= 8 ? 'encrypt-to-all' : 'shared-key';
      }
    });
  }

  /**
   * Remove a member from the group
   */
  @writer async removeMember(jid: string): Promise<void> {
    await this.update(record => {
      const newMembers = record.members.filter(m => m !== jid);
      record.members = newMembers;
      record.encryptionMode = newMembers.length <= 8 ? 'encrypt-to-all' : 'shared-key';
    });
  }

  /**
   * Update group name
   */
  @writer async updateName(newName: string): Promise<void> {
    await this.update(record => {
      record.name = newName;
    });
  }

  /**
   * Query all groups, sorted by name
   */
  static queryAll(collection: GroupModel['collection']) {
    return collection.query(Q.sortBy('name', Q.asc));
  }
}
