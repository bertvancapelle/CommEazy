/**
 * ChatService — 1-on-1 Chat Business Logic
 *
 * Combines XMPP, Encryption, and Database services to handle:
 * - Sending encrypted messages
 * - Receiving and decrypting messages
 * - Delivery receipts
 * - Offline sync (7-day outbox)
 *
 * @see services/interfaces.ts for contracts
 * @see .claude/skills/xmpp-specialist/SKILL.md for offline sync protocol
 */

import { v4 as uuidv4 } from 'uuid';
import sodium from 'libsodium-wrappers';

import { ServiceContainer } from './container';
import type {
  Message,
  OutboxMessage,
  Contact,
  EncryptedPayload,
  Observable,
  Unsubscribe,
  DeliveryStatus,
  Recipient,
} from './interfaces';
import { AppError } from './interfaces';
import { OutboxMessageModel } from '@/models';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface ChatListItem {
  chatId: string;
  contactJid: string;
  contactName: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  isOnline: boolean;
}

export interface SendMessageResult {
  messageId: string;
  status: DeliveryStatus;
}

export class ChatService {
  private myJid: string | null = null;
  private myName: string | null = null;
  private presenceMap: Map<string, boolean> = new Map();
  private unsubscribers: Unsubscribe[] = [];
  private messageListeners: Set<(message: Message) => void> = new Set();

  /**
   * Initialize chat service with current user info.
   * Must be called after user authentication.
   */
  async initialize(jid: string, name: string): Promise<void> {
    this.myJid = jid;
    this.myName = name;

    // Set JID on encryption service for group decryption
    const encryption = ServiceContainer.encryption as any;
    if (typeof encryption.setMyJid === 'function') {
      encryption.setMyJid(jid);
    }

    // Subscribe to XMPP events
    this.setupXMPPListeners();

    // Start daily outbox cleanup
    this.scheduleOutboxCleanup();
  }

  /**
   * Send a text message to a contact.
   * Handles encryption, database storage, and XMPP delivery.
   */
  async sendMessage(
    contactJid: string,
    content: string,
  ): Promise<SendMessageResult> {
    this.ensureInitialized();

    const contact = await ServiceContainer.database.getContact(contactJid);
    if (!contact) {
      throw new AppError('E202', 'encryption', () => {}, {
        reason: 'contact_not_found',
      });
    }

    const messageId = uuidv4();
    const timestamp = Date.now();
    const chatId = this.getChatId(contactJid);

    // Prepare recipient
    const recipient: Recipient = {
      jid: contactJid,
      publicKey: sodium.from_base64(contact.publicKey),
    };

    try {
      // Encrypt message
      const encryptedPayload = await ServiceContainer.encryption.encrypt(
        content,
        [recipient],
      );

      // Save to local messages (decrypted for display)
      const message: Message = {
        id: messageId,
        chatId,
        senderId: this.myJid!,
        senderName: this.myName!,
        content,
        contentType: 'text',
        timestamp,
        status: 'pending',
      };
      await ServiceContainer.database.saveMessage(message);

      // Try to send via XMPP
      const xmpp = ServiceContainer.xmpp;
      if (xmpp.getConnectionStatus() === 'connected') {
        try {
          await xmpp.sendMessage(contactJid, encryptedPayload, messageId);
          await this.updateMessageStatus(messageId, 'sent');
          return { messageId, status: 'sent' };
        } catch (xmppError) {
          // XMPP send failed, save to outbox
          await this.saveToOutbox(chatId, encryptedPayload, [contactJid], messageId);
          return { messageId, status: 'pending' };
        }
      } else {
        // Not connected, save to outbox for later delivery
        await this.saveToOutbox(chatId, encryptedPayload, [contactJid], messageId);
        return { messageId, status: 'pending' };
      }
    } catch (error) {
      // Encryption or database error
      if (error instanceof AppError) throw error;

      throw new AppError('E300', 'delivery', () => this.retrySendMessage(messageId), {
        reason: 'send_failed',
      });
    }
  }

  /**
   * Get messages for a chat.
   */
  async getMessages(chatId: string, limit = 50, offset = 0): Promise<Message[]> {
    return ServiceContainer.database.getMessages(chatId, limit, offset);
  }

  /**
   * Observe messages for a chat (real-time updates).
   */
  observeMessages(chatId: string, limit = 50): Observable<Message[]> {
    return ServiceContainer.database.observeMessages(chatId, limit);
  }

  /**
   * Get list of all chats with last message info.
   */
  async getChatList(): Promise<ChatListItem[]> {
    this.ensureInitialized();

    const chatList: ChatListItem[] = [];
    const contacts: Contact[] = [];

    // Get all contacts via subscription
    const unsubscribe = ServiceContainer.database.getContacts().subscribe(c => {
      contacts.push(...c);
    });
    unsubscribe();

    for (const contact of contacts) {
      const chatId = this.getChatId(contact.jid);
      const messages = await ServiceContainer.database.getMessages(chatId, 1);

      if (messages.length > 0) {
        chatList.push({
          chatId,
          contactJid: contact.jid,
          contactName: contact.name,
          lastMessage: messages[0].content,
          lastMessageTime: messages[0].timestamp,
          unreadCount: 0, // TODO: Implement unread tracking
          isOnline: this.presenceMap.get(contact.jid) ?? false,
        });
      }
    }

    // Sort by last message time (newest first)
    chatList.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    return chatList;
  }

  /**
   * Get or create chat ID for a 1-on-1 conversation.
   * Chat ID is deterministic based on both JIDs.
   */
  getChatId(contactJid: string): string {
    this.ensureInitialized();
    // Sort JIDs to ensure same chat ID regardless of who initiates
    const jids = [this.myJid!, contactJid].sort();
    return `chat:${jids.join(':')}`;
  }

  /**
   * Subscribe to new incoming messages.
   */
  onMessage(listener: (message: Message) => void): Unsubscribe {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  /**
   * Check if a contact is online.
   */
  isContactOnline(contactJid: string): boolean {
    return this.presenceMap.get(contactJid) ?? false;
  }

  /**
   * Cleanup and disconnect.
   */
  async cleanup(): Promise<void> {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.messageListeners.clear();
    this.presenceMap.clear();
  }

  // ============================================================
  // Private — XMPP Event Handlers
  // ============================================================

  private setupXMPPListeners(): void {
    const xmpp = ServiceContainer.xmpp;

    // Handle incoming messages
    const msgUnsub = xmpp.onMessage(async (from, payload, id) => {
      await this.handleIncomingMessage(from, payload, id);
    });
    this.unsubscribers.push(msgUnsub);

    // Handle delivery receipts
    const receiptUnsub = xmpp.onDeliveryReceipt(async (messageId, from) => {
      await this.handleDeliveryReceipt(messageId, from);
    });
    this.unsubscribers.push(receiptUnsub);

    // Handle presence updates
    const presenceUnsub = xmpp.onPresence(async (from, status) => {
      await this.handlePresenceUpdate(from, status);
    });
    this.unsubscribers.push(presenceUnsub);
  }

  private async handleIncomingMessage(
    from: string,
    payload: EncryptedPayload,
    id: string,
  ): Promise<void> {
    try {
      // Get sender's contact info
      const contact = await ServiceContainer.database.getContact(from);
      if (!contact) {
        console.warn('Received message from unknown contact:', from);
        return;
      }

      // Decrypt message
      const senderPk = sodium.from_base64(contact.publicKey);
      const content = await ServiceContainer.encryption.decrypt(payload, senderPk);

      // Save to database
      const chatId = this.getChatId(from);
      const message: Message = {
        id,
        chatId,
        senderId: from,
        senderName: contact.name,
        content,
        contentType: 'text',
        timestamp: Date.now(),
        status: 'delivered',
      };
      await ServiceContainer.database.saveMessage(message);

      // Notify listeners
      this.messageListeners.forEach(listener => listener(message));
    } catch (error) {
      console.error('Failed to process incoming message:', error);
      // E201: Decryption failed — silently fail, don't crash the app
    }
  }

  private async handleDeliveryReceipt(messageId: string, from: string): Promise<void> {
    try {
      // Update message status to delivered
      const db = ServiceContainer.database as any;
      if (typeof db.updateMessageStatus === 'function') {
        await db.updateMessageStatus(messageId, 'delivered');
      }

      // Also update outbox
      await ServiceContainer.database.markDelivered(messageId, from);
    } catch (error) {
      // Non-critical, log and continue
      console.warn('Failed to process delivery receipt:', error);
    }
  }

  private async handlePresenceUpdate(
    from: string,
    status: 'online' | 'offline',
  ): Promise<void> {
    const wasOnline = this.presenceMap.get(from);
    const isOnline = status === 'online';
    this.presenceMap.set(from, isOnline);

    // If contact came online, send pending outbox messages
    if (!wasOnline && isOnline) {
      await this.sendPendingOutboxMessages(from);
    }
  }

  // ============================================================
  // Private — Outbox Management
  // ============================================================

  private async saveToOutbox(
    chatId: string,
    encryptedPayload: EncryptedPayload,
    pendingTo: string[],
    messageId: string,
  ): Promise<void> {
    const outboxMsg: Omit<OutboxMessage, 'id'> = {
      chatId,
      encryptedContent: JSON.stringify(encryptedPayload),
      contentType: 'text',
      timestamp: Date.now(),
      expiresAt: Date.now() + SEVEN_DAYS_MS,
      pendingTo,
      deliveredTo: [],
    };

    await ServiceContainer.database.saveOutboxMessage({ ...outboxMsg, id: messageId } as any);
  }

  private async sendPendingOutboxMessages(recipientJid: string): Promise<void> {
    try {
      const pending = await ServiceContainer.database.getOutboxForRecipient(recipientJid);

      for (const msg of pending) {
        const payload = JSON.parse(msg.encryptedContent) as EncryptedPayload;

        try {
          await ServiceContainer.xmpp.sendMessage(recipientJid, payload, msg.id);
          // Receipt handler will update outbox when ACK received
        } catch (error) {
          // Send failed, keep in outbox for next attempt
          console.warn('Failed to send pending message:', msg.id);
        }
      }
    } catch (error) {
      console.error('Failed to send pending outbox messages:', error);
    }
  }

  private scheduleOutboxCleanup(): void {
    // Run cleanup every hour
    const cleanup = async () => {
      try {
        const expired = await ServiceContainer.database.getExpiredOutbox();
        const deletedCount = await ServiceContainer.database.cleanupExpiredOutbox();

        if (expired && expired.length > 0) {
          // E304: Message expired — notify user about undelivered messages
          console.log(`Cleaned up ${deletedCount} expired outbox messages`);
        }
      } catch (error) {
        console.error('Outbox cleanup failed:', error);
      }
    };

    // Initial cleanup
    void cleanup();

    // Schedule hourly cleanup (in production, use background task)
    const interval = setInterval(cleanup, 60 * 60 * 1000);
    this.unsubscribers.push(() => clearInterval(interval));
  }

  // ============================================================
  // Private — Helpers
  // ============================================================

  private async updateMessageStatus(messageId: string, status: DeliveryStatus): Promise<void> {
    const db = ServiceContainer.database as any;
    if (typeof db.updateMessageStatus === 'function') {
      await db.updateMessageStatus(messageId, status);
    }
  }

  private async retrySendMessage(messageId: string): Promise<void> {
    // TODO: Implement retry logic
    console.log('Retry send message:', messageId);
  }

  private ensureInitialized(): void {
    if (!this.myJid || !this.myName) {
      throw new Error('ChatService not initialized — call initialize() first');
    }
  }
}

/** Singleton instance */
export const chatService = new ChatService();
