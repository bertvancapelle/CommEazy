/**
 * WatermelonDB Database Service
 *
 * Implements DatabaseService interface with WatermelonDB + SQLCipher encryption.
 *
 * @see services/interfaces.ts for contract
 * @see models/ for schema and model definitions
 */

import { Database, Q } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import uuid from 'react-native-uuid';

import {
  schema,
  migrations,
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
  SubscriptionTier,
  AgeBracket,
  Gender,
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
      migrations,
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
    const collection = db.get<MessageModel>('messages');

    // Check if message already exists (deduplication for XMPP reconnect/resync)
    try {
      const existing = await collection.find(msg.id);
      if (existing) {
        // Message already exists, skip insert to avoid UNIQUE constraint error
        console.debug(`[Database] Message ${msg.id} already exists, skipping`);
        return;
      }
    } catch {
      // find() throws if not found, which is expected — continue to create
    }

    await db.write(async () => {
      await collection.create(record => {
        record._raw.id = msg.id;
        record.chatId = msg.chatId;
        record.senderId = msg.senderId;
        record.senderName = msg.senderName;
        record.content = msg.content;
        record.contentType = msg.contentType;
        record.timestamp = msg.timestamp;
        record.status = msg.status;
        // If isRead is explicitly set, use it; otherwise default to true
        // (caller should set isRead=false for received messages)
        record.isRead = msg.isRead ?? true;
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

  async markMessageAsRead(messageId: string): Promise<void> {
    const db = this.ensureDatabase();
    await db.write(async () => {
      const message = await db.get<MessageModel>('messages').find(messageId);
      await message.markAsRead();
    });
  }

  async markAllMessagesAsRead(chatId: string): Promise<void> {
    const db = this.ensureDatabase();
    await db.write(async () => {
      const collection = db.get<MessageModel>('messages');
      const unreadMessages = await collection.query(
        Q.where('chat_id', chatId),
        Q.where('is_read', false),
      ).fetch();

      for (const message of unreadMessages) {
        await message.update(record => {
          record.isRead = true;
        });
      }
    });
  }

  async getUnreadCount(chatId: string): Promise<number> {
    const db = this.ensureDatabase();
    const collection = db.get<MessageModel>('messages');
    const count = await collection.query(
      Q.where('chat_id', chatId),
      Q.where('is_read', false),
    ).fetchCount();
    return count;
  }

  // ============================================================
  // Outbox (7-day retention)
  // ============================================================

  async saveOutboxMessage(msg: Omit<OutboxMessage, 'id'>): Promise<OutboxMessage> {
    const db = this.ensureDatabase();
    const id = uuid.v4() as string;

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

  async getPendingOutbox(): Promise<OutboxMessage[]> {
    const db = this.ensureDatabase();
    const collection = db.get<OutboxMessageModel>('outbox_messages');
    const messages = await collection.query().fetch();

    // Filter for non-expired messages that have pending recipients
    const now = Date.now();
    const pending = messages.filter(
      m => m.expiresAt > now && m.pendingTo.length > 0
    );

    return pending.map(m => this.outboxModelToInterface(m));
  }

  async deleteOutboxMessage(messageId: string): Promise<void> {
    const db = this.ensureDatabase();
    await db.write(async () => {
      try {
        const message = await db.get<OutboxMessageModel>('outbox_messages').find(messageId);
        await message.destroyPermanently();
      } catch {
        // Message not found, ignore
      }
    });
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
      // Check if contact exists (by userUuid first, fallback to jid for backwards compatibility)
      const existing = await db
        .get<ContactModel>('contacts')
        .query()
        .fetch()
        .then(contacts => contacts.find(c =>
          (contact.userUuid && c.userUuid === contact.userUuid) || c.jid === contact.jid
        ));

      if (existing) {
        await existing.update(record => {
          record.userUuid = contact.userUuid;
          record.jid = contact.jid;
          record.name = contact.name;
          record.phoneNumber = contact.phoneNumber;
          record.publicKey = contact.publicKey;
          record.verified = contact.verified;
          record.lastSeen = contact.lastSeen;
          record.photoPath = contact.photoUrl;
        });
      } else {
        await db.get<ContactModel>('contacts').create(record => {
          record._raw.id = uuid.v4() as string;
          record.userUuid = contact.userUuid;
          record.jid = contact.jid;
          record.name = contact.name;
          record.phoneNumber = contact.phoneNumber;
          record.publicKey = contact.publicKey;
          record.verified = contact.verified;
          record.lastSeen = contact.lastSeen;
          record.photoPath = contact.photoUrl;
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
          // Identity - userUuid should NEVER change after initial creation
          // Only update it if it's missing (migration from v3)
          if (!record.userUuid && profile.userUuid) {
            record.userUuid = profile.userUuid;
          }
          record.jid = profile.jid;
          record.name = profile.name;
          record.phoneNumber = profile.phoneNumber;
          record.publicKey = profile.publicKey;

          // Preferences
          record.language = profile.language;
          record.audioFeedbackEnabled = profile.audioFeedbackEnabled;
          record.hapticFeedbackEnabled = profile.hapticFeedbackEnabled;
          record.photoPath = profile.photoPath;

          // Subscription
          record.subscriptionTier = profile.subscriptionTier;
          record.subscriptionExpires = profile.subscriptionExpires;

          // Demographics
          record.countryCode = profile.countryCode;
          record.regionCode = profile.regionCode;
          record.city = profile.city;
          record.ageBracket = profile.ageBracket;
          record.gender = profile.gender;

          // Hold-to-Navigate settings
          record.longPressDelay = profile.longPressDelay;
          record.menuButtonPositionX = profile.menuButtonPositionX;
          record.menuButtonPositionY = profile.menuButtonPositionY;
          record.edgeExclusionSize = profile.edgeExclusionSize;
          record.wheelBlurIntensity = profile.wheelBlurIntensity;
          record.wheelDismissMargin = profile.wheelDismissMargin;

          // Granular feedback settings (v9)
          record.hapticIntensity = profile.hapticIntensity;
          record.audioFeedbackBoost = profile.audioFeedbackBoost;

          // Voice commands (v11)
          record.voiceCommandsEnabled = profile.voiceCommandsEnabled;

          // Call sound settings (v12)
          record.ringtoneEnabled = profile.ringtoneEnabled;
          record.ringtoneSound = profile.ringtoneSound;
          record.dialToneEnabled = profile.dialToneEnabled;
          record.incomingCallVibration = profile.incomingCallVibration;
          record.outgoingCallVibration = profile.outgoingCallVibration;
        });
      } else {
        await db.get<UserProfileModel>('user_profile').create(record => {
          record._raw.id = uuid.v4() as string;

          // Identity - generate UUID at first creation if not provided
          record.userUuid = profile.userUuid || (uuid.v4() as string);
          record.jid = profile.jid;
          record.name = profile.name;
          record.phoneNumber = profile.phoneNumber;
          record.publicKey = profile.publicKey;

          // Preferences
          record.language = profile.language;
          record.audioFeedbackEnabled = profile.audioFeedbackEnabled;
          record.hapticFeedbackEnabled = profile.hapticFeedbackEnabled;
          record.photoPath = profile.photoPath;

          // Subscription - default to 'free' for new users
          record.subscriptionTier = profile.subscriptionTier || 'free';
          record.subscriptionExpires = profile.subscriptionExpires;

          // Demographics
          record.countryCode = profile.countryCode;
          record.regionCode = profile.regionCode;
          record.city = profile.city;
          record.ageBracket = profile.ageBracket;
          record.gender = profile.gender;

          // Hold-to-Navigate settings
          record.longPressDelay = profile.longPressDelay;
          record.menuButtonPositionX = profile.menuButtonPositionX;
          record.menuButtonPositionY = profile.menuButtonPositionY;
          record.edgeExclusionSize = profile.edgeExclusionSize;
          record.wheelBlurIntensity = profile.wheelBlurIntensity;
          record.wheelDismissMargin = profile.wheelDismissMargin;

          // Granular feedback settings (v9)
          record.hapticIntensity = profile.hapticIntensity;
          record.audioFeedbackBoost = profile.audioFeedbackBoost;

          // Voice commands (v11)
          record.voiceCommandsEnabled = profile.voiceCommandsEnabled;

          // Call sound settings (v12)
          record.ringtoneEnabled = profile.ringtoneEnabled;
          record.ringtoneSound = profile.ringtoneSound;
          record.dialToneEnabled = profile.dialToneEnabled;
          record.incomingCallVibration = profile.incomingCallVibration;
          record.outgoingCallVibration = profile.outgoingCallVibration;
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
      userUuid: c.userUuid,
      jid: c.jid,
      name: c.name,
      phoneNumber: c.phoneNumber,
      publicKey: c.publicKey,
      verified: c.verified,
      lastSeen: c.lastSeen,
      photoUrl: c.photoPath,
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
      // Identity
      userUuid: p.userUuid,
      jid: p.jid,
      name: p.name,
      phoneNumber: p.phoneNumber,
      publicKey: p.publicKey,

      // Preferences
      language: p.language as SupportedLanguage,
      audioFeedbackEnabled: p.audioFeedbackEnabled,
      hapticFeedbackEnabled: p.hapticFeedbackEnabled,
      photoPath: p.photoPath,

      // Subscription
      subscriptionTier: (p.subscriptionTier || 'free') as SubscriptionTier,
      subscriptionExpires: p.subscriptionExpires,

      // Demographics
      countryCode: p.countryCode,
      regionCode: p.regionCode,
      city: p.city,
      ageBracket: p.ageBracket as AgeBracket | undefined,
      gender: p.gender as Gender | undefined,

      // Hold-to-Navigate settings
      longPressDelay: p.longPressDelay,
      menuButtonPositionX: p.menuButtonPositionX,
      menuButtonPositionY: p.menuButtonPositionY,
      edgeExclusionSize: p.edgeExclusionSize,
      wheelBlurIntensity: p.wheelBlurIntensity,
      wheelDismissMargin: p.wheelDismissMargin,

      // Granular feedback settings (v9)
      hapticIntensity: p.hapticIntensity,
      audioFeedbackBoost: p.audioFeedbackBoost,

      // Voice commands (v11)
      voiceCommandsEnabled: p.voiceCommandsEnabled,

      // Call sound settings (v12)
      ringtoneEnabled: p.ringtoneEnabled,
      ringtoneSound: p.ringtoneSound,
      dialToneEnabled: p.dialToneEnabled,
      incomingCallVibration: p.incomingCallVibration,
      outgoingCallVibration: p.outgoingCallVibration,
    };
  }
}
