/**
 * WatermelonDB Database Service
 *
 * Implements DatabaseService interface with WatermelonDB + SQLCipher encryption.
 *
 * @see services/interfaces.ts for contract
 * @see models/ for schema and model definitions
 */

import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { v4 as uuidv4 } from 'uuid';

import {
  schema,
  MessageModel,
  OutboxMessageModel,
  ContactModel,
  GroupModel,
  UserProfileModel,
  modelClasses,
} from '@/models';

import type {
  DatabaseService,
  Message,
  OutboxMessage,
  Contact,
  Group,
  UserProfile,
  Observable,
  ContentType,
  DeliveryStatus,
  EncryptionMode,
  SupportedLanguage,
} from './interfaces';

export class WatermelonDBService implements DatabaseService {
  private database: Database | null = null;
  private adapter: SQLiteAdapter | null = null;

  async initialize(encryptionKey: ArrayBuffer): Promise<void> {
    // Convert ArrayBuffer to hex string for SQLCipher
    const keyArray = new Uint8Array(encryptionKey);
    const keyHex = Array.from(keyArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    this.adapter = new SQLiteAdapter({
      schema,
      dbName: 'commeazy',
      jsi: true, // Enable JSI for better performance
      onSetUpError: error => {
        console.error('Database setup error:', error);
      },
    });

    this.database = new Database({
      adapter: this.adapter,
      modelClasses,
    });
  }

  async close(): Promise<void> {
    // WatermelonDB doesn't have an explicit close method
    this.database = null;
    this.adapter = null;
  }

  // ============================================================
  // Messages
  // ============================================================

  async saveMessage(msg: Message): Promise<void> {
    const db = this.ensureDatabase();
    await db.write(async () => {
      await db.get<MessageModel>('messages').create(record => {
        record._raw.id = msg.id;
        record.chatId = msg.chatId;
        record.senderId = msg.senderId;
        record.senderName = msg.senderName;
        record.content = msg.content;
        record.contentType = msg.contentType;
        record.timestamp = msg.timestamp;
        record.status = msg.status;
      });
    });
  }

  async getMessages(chatId: string, limit: number, offset = 0): Promise<Message[]> {
    const db = this.ensureDatabase();
    const collection = db.get<MessageModel>('messages');
    const messages = await collection
      .query()
      .fetch();

    // Filter, sort, and paginate
    const filtered = messages
      .filter(m => m.chatId === chatId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(offset, offset + limit);

    return filtered.map(m => this.messageModelToInterface(m));
  }

  observeMessages(chatId: string, limit: number): Observable<Message[]> {
    const db = this.ensureDatabase();
    const collection = db.get<MessageModel>('messages');

    return {
      subscribe: (observer) => {
        const subscription = MessageModel.queryByChatId(collection, chatId)
          .observe()
          .subscribe({
            next: messages => {
              const limited = messages.slice(0, limit);
              observer(limited.map(m => this.messageModelToInterface(m)));
            },
            error: err => console.error('Message observation error:', err),
          });

        return () => subscription.unsubscribe();
      },
    };
  }

  async deleteMessage(messageId: string): Promise<void> {
    const db = this.ensureDatabase();
    await db.write(async () => {
      const message = await db.get<MessageModel>('messages').find(messageId);
      await message.destroyPermanently();
    });
  }

  async updateMessageStatus(messageId: string, status: DeliveryStatus): Promise<void> {
    const db = this.ensureDatabase();
    await db.write(async () => {
      const message = await db.get<MessageModel>('messages').find(messageId);
      await message.update(record => {
        record.status = status;
      });
    });
  }

  // ============================================================
  // Outbox (7-day retention)
  // ============================================================

  async saveOutboxMessage(msg: Omit<OutboxMessage, 'id'>): Promise<OutboxMessage> {
    const db = this.ensureDatabase();
    const id = uuidv4();

    await db.write(async () => {
      await db.get<OutboxMessageModel>('outbox_messages').create(record => {
        record._raw.id = id;
        record.chatId = msg.chatId;
        record.encryptedContent = msg.encryptedContent;
        record.contentType = msg.contentType;
        record.timestamp = msg.timestamp;
        record.expiresAt = msg.expiresAt;
        record.pendingTo = msg.pendingTo;
        record.deliveredTo = msg.deliveredTo;
      });
    });

    return { id, ...msg };
  }

  async getOutboxForRecipient(jid: string): Promise<OutboxMessage[]> {
    const db = this.ensureDatabase();
    const collection = db.get<OutboxMessageModel>('outbox_messages');
    const messages = await collection.query().fetch();

    // Filter for non-expired messages where jid is in pendingTo
    const now = Date.now();
    const pending = messages.filter(
      m => m.expiresAt > now && m.pendingTo.includes(jid)
    );

    return pending.map(m => this.outboxModelToInterface(m));
  }

  async markDelivered(messageId: string, recipientJid: string): Promise<void> {
    const db = this.ensureDatabase();
    await db.write(async () => {
      const message = await db.get<OutboxMessageModel>('outbox_messages').find(messageId);
      await message.markDeliveredTo(recipientJid);
    });
  }

  async getExpiredOutbox(): Promise<OutboxMessage[]> {
    const db = this.ensureDatabase();
    const collection = db.get<OutboxMessageModel>('outbox_messages');
    const messages = await OutboxMessageModel.queryExpired(collection).fetch();
    return messages.map(m => this.outboxModelToInterface(m));
  }

  async cleanupExpiredOutbox(): Promise<number> {
    const db = this.ensureDatabase();
    const collection = db.get<OutboxMessageModel>('outbox_messages');
    const expired = await OutboxMessageModel.queryExpired(collection).fetch();

    await db.write(async () => {
      for (const msg of expired) {
        await msg.destroyPermanently();
      }
    });

    return expired.length;
  }

  // ============================================================
  // Contacts
  // ============================================================

  async saveContact(contact: Contact): Promise<void> {
    const db = this.ensureDatabase();
    await db.write(async () => {
      // Check if contact exists
      const existing = await db
        .get<ContactModel>('contacts')
        .query()
        .fetch()
        .then(contacts => contacts.find(c => c.jid === contact.jid));

      if (existing) {
        await existing.update(record => {
          record.name = contact.name;
          record.phoneNumber = contact.phoneNumber;
          record.publicKey = contact.publicKey;
          record.verified = contact.verified;
          record.lastSeen = contact.lastSeen;
        });
      } else {
        await db.get<ContactModel>('contacts').create(record => {
          record._raw.id = uuidv4();
          record.jid = contact.jid;
          record.name = contact.name;
          record.phoneNumber = contact.phoneNumber;
          record.publicKey = contact.publicKey;
          record.verified = contact.verified;
          record.lastSeen = contact.lastSeen;
        });
      }
    });
  }

  getContacts(): Observable<Contact[]> {
    const db = this.ensureDatabase();
    const collection = db.get<ContactModel>('contacts');

    return {
      subscribe: (observer) => {
        const subscription = ContactModel.queryAll(collection)
          .observe()
          .subscribe({
            next: contacts => {
              observer(contacts.map(c => this.contactModelToInterface(c)));
            },
            error: err => console.error('Contact observation error:', err),
          });

        return () => subscription.unsubscribe();
      },
    };
  }

  async getContact(jid: string): Promise<Contact | null> {
    const db = this.ensureDatabase();
    const contacts = await db
      .get<ContactModel>('contacts')
      .query()
      .fetch();

    const contact = contacts.find(c => c.jid === jid);
    return contact ? this.contactModelToInterface(contact) : null;
  }

  async deleteContact(jid: string): Promise<void> {
    const db = this.ensureDatabase();
    await db.write(async () => {
      const contacts = await db.get<ContactModel>('contacts').query().fetch();
      const contact = contacts.find(c => c.jid === jid);
      if (contact) {
        await contact.destroyPermanently();
      }
    });
  }

  // ============================================================
  // Groups
  // ============================================================

  async saveGroup(group: Group): Promise<void> {
    const db = this.ensureDatabase();
    await db.write(async () => {
      const existing = await db.get<GroupModel>('groups').query().fetch()
        .then(groups => groups.find(g => g.id === group.id));

      if (existing) {
        await existing.update(record => {
          record.name = group.name;
          record.members = group.members;
          record.encryptionMode = group.encryptionMode;
        });
      } else {
        await db.get<GroupModel>('groups').create(record => {
          record._raw.id = group.id;
          record.name = group.name;
          record.members = group.members;
          record.createdBy = group.createdBy;
          record.encryptionMode = group.encryptionMode;
        });
      }
    });
  }

  getGroups(): Observable<Group[]> {
    const db = this.ensureDatabase();
    const collection = db.get<GroupModel>('groups');

    return {
      subscribe: (observer) => {
        const subscription = GroupModel.queryAll(collection)
          .observe()
          .subscribe({
            next: groups => {
              observer(groups.map(g => this.groupModelToInterface(g)));
            },
            error: err => console.error('Group observation error:', err),
          });

        return () => subscription.unsubscribe();
      },
    };
  }

  async getGroup(id: string): Promise<Group | null> {
    const db = this.ensureDatabase();
    try {
      const group = await db.get<GroupModel>('groups').find(id);
      return this.groupModelToInterface(group);
    } catch {
      return null;
    }
  }

  async updateGroupMembers(groupId: string, members: string[]): Promise<void> {
    const db = this.ensureDatabase();
    await db.write(async () => {
      const group = await db.get<GroupModel>('groups').find(groupId);
      await group.updateMembers(members);
    });
  }

  // ============================================================
  // User Profile
  // ============================================================

  async saveUserProfile(profile: UserProfile): Promise<void> {
    const db = this.ensureDatabase();
    await db.write(async () => {
      const existing = await db.get<UserProfileModel>('user_profile').query().fetch();

      if (existing.length > 0) {
        await existing[0].update(record => {
          record.jid = profile.jid;
          record.name = profile.name;
          record.phoneNumber = profile.phoneNumber;
          record.publicKey = profile.publicKey;
          record.language = profile.language;
          record.audioFeedbackEnabled = profile.audioFeedbackEnabled;
          record.hapticFeedbackEnabled = profile.hapticFeedbackEnabled;
        });
      } else {
        await db.get<UserProfileModel>('user_profile').create(record => {
          record._raw.id = uuidv4();
          record.jid = profile.jid;
          record.name = profile.name;
          record.phoneNumber = profile.phoneNumber;
          record.publicKey = profile.publicKey;
          record.language = profile.language;
          record.audioFeedbackEnabled = profile.audioFeedbackEnabled;
          record.hapticFeedbackEnabled = profile.hapticFeedbackEnabled;
        });
      }
    });
  }

  async getUserProfile(): Promise<UserProfile | null> {
    const db = this.ensureDatabase();
    const profiles = await db.get<UserProfileModel>('user_profile').query().fetch();

    if (profiles.length === 0) {
      return null;
    }

    return this.userProfileModelToInterface(profiles[0]);
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private ensureDatabase(): Database {
    if (!this.database) {
      throw new Error('Database not initialized');
    }
    return this.database;
  }

  private messageModelToInterface(m: MessageModel): Message {
    return {
      id: m.id,
      chatId: m.chatId,
      senderId: m.senderId,
      senderName: m.senderName,
      content: m.content,
      contentType: m.contentType as ContentType,
      timestamp: m.timestamp,
      status: m.status as DeliveryStatus,
    };
  }

  private outboxModelToInterface(m: OutboxMessageModel): OutboxMessage {
    return {
      id: m.id,
      chatId: m.chatId,
      encryptedContent: m.encryptedContent,
      contentType: m.contentType as ContentType,
      timestamp: m.timestamp,
      expiresAt: m.expiresAt,
      pendingTo: m.pendingTo,
      deliveredTo: m.deliveredTo,
    };
  }

  private contactModelToInterface(c: ContactModel): Contact {
    return {
      jid: c.jid,
      name: c.name,
      phoneNumber: c.phoneNumber,
      publicKey: c.publicKey,
      verified: c.verified,
      lastSeen: c.lastSeen,
    };
  }

  private groupModelToInterface(g: GroupModel): Group {
    return {
      id: g.id,
      name: g.name,
      members: g.members,
      createdBy: g.createdBy,
      createdAt: g.createdAt.getTime(),
      encryptionMode: g.encryptionMode as EncryptionMode,
    };
  }

  private userProfileModelToInterface(p: UserProfileModel): UserProfile {
    return {
      jid: p.jid,
      name: p.name,
      phoneNumber: p.phoneNumber,
      publicKey: p.publicKey,
      language: p.language as SupportedLanguage,
      audioFeedbackEnabled: p.audioFeedbackEnabled,
      hapticFeedbackEnabled: p.hapticFeedbackEnabled,
    };
  }
}
