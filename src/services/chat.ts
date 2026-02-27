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

import uuid from 'react-native-uuid';

import { ServiceContainer } from './container';
import { isPlaintextMode } from './mock';
import type {
  Message,
  OutboxMessage,
  Contact,
  EncryptedPayload,
  Observable,
  Unsubscribe,
  DeliveryStatus,
  Recipient,
  PresenceShow,
} from './interfaces';
import { AppError } from './interfaces';
import { OutboxMessageModel } from '@/models';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Retry intervals with exponential backoff (in milliseconds)
// 30s → 1m → 2m → 5m → 15m (max)
const RETRY_INTERVALS = [
  30 * 1000,       // 30 seconds
  60 * 1000,       // 1 minute
  2 * 60 * 1000,   // 2 minutes
  5 * 60 * 1000,   // 5 minutes
  15 * 60 * 1000,  // 15 minutes (max)
];

/** @deprecated Use ChatListItemWithContact instead */
export interface ChatListItem {
  chatId: string;
  contactJid: string;
  contactName: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  isOnline: boolean;
}

/** Chat list item with full contact and message objects */
export interface ChatListItemWithContact {
  chatId: string;
  contact: Contact;
  lastMessage: Message | null;
  unreadCount: number;
}

export interface SendMessageResult {
  messageId: string;
  status: DeliveryStatus;
}

export class ChatService {
  private myJid: string | null = null;
  private myName: string | null = null;
  private presenceMap: Map<string, PresenceShow> = new Map();
  private unsubscribers: Unsubscribe[] = [];
  private messageListeners: Set<(message: Message) => void> = new Set();
  private presenceListeners: Set<(jid: string, show: PresenceShow) => void> = new Set();
  private statusListeners: Set<(messageId: string, status: DeliveryStatus) => void> = new Set();

  // Retry state
  private retryTimer: NodeJS.Timeout | null = null;
  private retryAttempt: number = 0;
  private isRetrying: boolean = false;

  /**
   * Check if the chat service has been initialized with user credentials.
   */
  get isInitialized(): boolean {
    return this.myJid !== null && this.myName !== null;
  }

  /**
   * Get the current user's JID.
   * Returns null if not initialized.
   */
  getMyJid(): string | null {
    return this.myJid;
  }

  /**
   * Get the current user's display name.
   * Returns null if not initialized.
   */
  getMyName(): string | null {
    return this.myName;
  }

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

    // Subscribe to presence from all contacts (required for presence updates)
    await this.subscribeToAllContactsPresence();
  }

  /**
   * Subscribe to presence updates from all contacts.
   * This is required by XMPP to receive presence (online/offline) notifications.
   *
   */
  private async subscribeToAllContactsPresence(): Promise<void> {
    try {
      const contacts: Contact[] = [];
      const unsubscribe = ServiceContainer.database.getContacts().subscribe(c => {
        contacts.push(...c);
      });
      unsubscribe();

      const xmpp = ServiceContainer.xmpp;

      for (const contact of contacts) {
        try {
          await xmpp.subscribeToPresence(contact.jid);
          console.log(`[ChatService] Subscribed to presence of ${contact.jid}`);
          // Also probe for current presence status immediately
          await xmpp.probePresence(contact.jid);
        } catch (error) {
          // XMPP not connected yet is expected during startup - subscriptions
          // will be retried via refreshPresenceSubscriptions() after XMPP connects
          const errorMsg = error instanceof Error ? error.message : String(error);
          if (errorMsg.includes('not connected')) {
            console.debug(`[ChatService] Skipping presence subscription for ${contact.jid} (XMPP not connected yet)`);
          } else {
            console.warn(`[ChatService] Failed to subscribe to ${contact.jid}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[ChatService] Failed to subscribe to contacts presence:', error);
    }
  }

  /**
   * Refresh presence subscriptions after reconnecting.
   * Call this when XMPP reconnects to ensure we receive presence updates.
   */
  async refreshPresenceSubscriptions(): Promise<void> {
    console.log('[ChatService] Refreshing presence subscriptions...');
    await this.subscribeToAllContactsPresence();
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

    const messageId = uuid.v4() as string;
    const timestamp = Date.now();
    const chatId = this.getChatId(contactJid);

    try {
      let encryptedPayload: EncryptedPayload;

      // DEV MODE: Plaintext mode bypasses encryption for 2-device testing
      if (__DEV__ && isPlaintextMode()) {
        console.log('[ChatService] PLAINTEXT MODE: Sending unencrypted message');
        // Create a "fake" encrypted payload that's actually plaintext
        encryptedPayload = {
          mode: 'plaintext' as any, // Special mode for dev testing
          data: content, // Plain text content
          metadata: {
            nonce: 'dev-plaintext-mode',
            to: contactJid,
          },
        };
      } else {
        // PRODUCTION: Real encryption
        // Dynamically import libsodium only when needed (avoids Hermes issues in dev)
        const { from_base64, base64_variants } = await import('react-native-libsodium');

        // Get the recipient's public key
        let recipientPublicKey = contact.publicKey;

        // DEV MODE: If public key is missing, try to load it from test keys
        if (__DEV__ && (!recipientPublicKey || recipientPublicKey.length === 0)) {
          console.warn(`[ChatService] Contact ${contactJid} has no public key, trying test keys...`);
          try {
            const { getTestPublicKeyForJid } = await import('./mock/testKeys');
            const testKey = await getTestPublicKeyForJid(contactJid);
            if (testKey) {
              recipientPublicKey = testKey;
              // Also update the database so future sends work
              await ServiceContainer.database.saveContact({
                ...contact,
                publicKey: testKey,
              });
              console.log(`[ChatService] Loaded test key for ${contactJid} and saved to database`);
            }
          } catch (testKeyError) {
            console.warn(`[ChatService] Failed to load test key for ${contactJid}:`, testKeyError);
          }
        }

        // Validate public key before attempting encryption
        if (!recipientPublicKey || recipientPublicKey.length === 0) {
          console.error(`[ChatService] Cannot send to ${contactJid}: no public key available`);
          throw new AppError('E202', 'encryption', () => {}, {
            reason: 'missing_public_key',
            contactJid,
          });
        }

        // Prepare recipient
        const recipient: Recipient = {
          jid: contactJid,
          publicKey: from_base64(recipientPublicKey, base64_variants.ORIGINAL),
        };

        // Encrypt message
        encryptedPayload = await ServiceContainer.encryption.encrypt(
          content,
          [recipient],
        );
      }

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
        isRead: true, // Own messages are always "read"
      };
      await ServiceContainer.database.saveMessage(message);

      // Notify listeners so chat list updates
      this.messageListeners.forEach(listener => listener(message));

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
      console.error('sendMessage error:', error);
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
  async getChatList(): Promise<ChatListItemWithContact[]> {
    this.ensureInitialized();

    const chatList: ChatListItemWithContact[] = [];
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
        const unreadCount = await ServiceContainer.database.getUnreadCount(chatId);
        chatList.push({
          chatId,
          contact,
          lastMessage: messages[0],
          unreadCount,
        });
      }
    }

    // Sort by last message time (newest first)
    chatList.sort((a, b) => (b.lastMessage?.timestamp ?? 0) - (a.lastMessage?.timestamp ?? 0));
    return chatList;
  }

  /**
   * Observe chat list for real-time updates.
   * Returns an observable that emits whenever contacts or messages change.
   */
  observeChatList(): Observable<ChatListItemWithContact[]> {
    const subscribers: Set<(chatList: ChatListItemWithContact[]) => void> = new Set();

    // Helper to build and emit chat list
    const emitChatList = async () => {
      try {
        const chatList = await this.getChatList();
        subscribers.forEach(sub => sub(chatList));
      } catch (error) {
        console.error('Failed to build chat list:', error);
      }
    };

    // Subscribe to contacts changes and message changes
    let contactsUnsub: Unsubscribe | null = null;
    let messageUnsub: Unsubscribe | null = null;

    return {
      subscribe: (callback) => {
        subscribers.add(callback);

        // On first subscriber, set up observations
        if (subscribers.size === 1) {
          // Re-emit when contacts change
          contactsUnsub = ServiceContainer.database.getContacts().subscribe(() => {
            void emitChatList();
          });

          // Re-emit when new messages arrive
          messageUnsub = this.onMessage(() => {
            void emitChatList();
          });
        }

        // Emit immediately
        void emitChatList();

        // Return unsubscribe function
        return () => {
          subscribers.delete(callback);
          if (subscribers.size === 0) {
            if (contactsUnsub) {
              contactsUnsub();
              contactsUnsub = null;
            }
            if (messageUnsub) {
              messageUnsub();
              messageUnsub = null;
            }
          }
        };
      },
    };
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
   * Check if a contact is online (any presence except offline).
   */
  isContactOnline(contactJid: string): boolean {
    const show = this.presenceMap.get(contactJid);
    return show !== undefined && show !== 'offline';
  }

  /**
   * Get the detailed presence status of a contact.
   * Returns 'offline' if no presence has been received.
   */
  getContactPresence(contactJid: string): PresenceShow {
    return this.presenceMap.get(contactJid) ?? 'offline';
  }

  /**
   * Subscribe to presence changes for real-time status updates.
   */
  onPresenceChange(listener: (jid: string, show: PresenceShow) => void): Unsubscribe {
    this.presenceListeners.add(listener);
    return () => this.presenceListeners.delete(listener);
  }

  /**
   * Subscribe to message status changes (pending → sent → delivered).
   * Use this to update the UI when delivery receipts arrive.
   */
  onMessageStatusChange(listener: (messageId: string, status: DeliveryStatus) => void): Unsubscribe {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Mark all messages in a chat as read.
   * Call this when opening a chat screen.
   */
  async markChatAsRead(chatId: string): Promise<void> {
    await ServiceContainer.database.markAllMessagesAsRead(chatId);
  }

  /**
   * Get unread message count for a chat.
   */
  async getUnreadCount(chatId: string): Promise<number> {
    return ServiceContainer.database.getUnreadCount(chatId);
  }

  /**
   * Cleanup and disconnect.
   */
  async cleanup(): Promise<void> {
    this.stopRetryTimer();
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.messageListeners.clear();
    this.presenceListeners.clear();
    this.statusListeners.clear();
    this.presenceMap.clear();
  }

  /**
   * Start the outbox retry timer.
   * Call this when the app comes to the foreground.
   * Uses exponential backoff: 30s → 1m → 2m → 5m → 15m
   */
  startRetryTimer(): void {
    if (this.retryTimer) {
      console.log('[ChatService] Retry timer already running');
      return;
    }

    // Reset retry attempt counter when starting fresh
    this.retryAttempt = 0;
    console.log('[ChatService] Starting outbox retry timer');
    this.scheduleNextRetry();
  }

  /**
   * Stop the outbox retry timer.
   * Call this when the app goes to the background.
   */
  stopRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
      console.log('[ChatService] Stopped outbox retry timer');
    }
    this.isRetrying = false;
  }

  /**
   * Check if there are pending messages in the outbox.
   */
  async hasPendingMessages(): Promise<boolean> {
    try {
      const pending = await ServiceContainer.database.getPendingOutbox();
      return pending.length > 0;
    } catch {
      return false;
    }
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
    // Defensive check for undefined from
    if (!from) {
      console.warn('[ChatService] handleIncomingMessage called with undefined from');
      return;
    }

    console.log(`[ChatService] handleIncomingMessage from: ${from}, id: ${id}`);
    try {
      // Extract bare JID (remove resource like /gajim.ABC123)
      const bareFrom = from.split('/')[0];
      console.log(`[ChatService] Looking up contact: ${bareFrom}`);

      // Get sender's contact info
      const contact = await ServiceContainer.database.getContact(bareFrom);
      if (!contact) {
        console.warn(`[ChatService] Unknown contact: ${bareFrom} — message ignored`);
        return;
      }
      console.log(`[ChatService] Found contact: ${contact.name}, publicKey length: ${contact.publicKey?.length ?? 0}`);

      let content: string;

      // DEV MODE: Check for plaintext mode messages
      if (__DEV__ && (payload.mode as any) === 'plaintext') {
        console.log(`[ChatService] PLAINTEXT MODE: Received unencrypted message`);
        content = payload.data; // Data is plain text in this mode
      } else {
        // PRODUCTION: Real decryption
        // Get the sender's public key
        let senderPublicKey = contact.publicKey;

        // DEV MODE: If public key is missing, try to load it from test keys
        if (__DEV__ && (!senderPublicKey || senderPublicKey.length === 0)) {
          console.warn(`[ChatService] Sender ${bareFrom} has no public key, trying test keys...`);
          try {
            const { getTestPublicKeyForJid } = await import('./mock/testKeys');
            const testKey = await getTestPublicKeyForJid(bareFrom);
            if (testKey) {
              senderPublicKey = testKey;
              // Also update the database so future receives work
              await ServiceContainer.database.saveContact({
                ...contact,
                publicKey: testKey,
              });
              console.log(`[ChatService] Loaded test key for ${bareFrom} and saved to database`);
            }
          } catch (testKeyError) {
            console.warn(`[ChatService] Failed to load test key for ${bareFrom}:`, testKeyError);
          }
        }

        // Check if we have a public key now
        if (!senderPublicKey || senderPublicKey.length === 0) {
          console.warn(`[ChatService] Contact ${contact.name} has no public key — cannot decrypt`);
          return;
        }

        // Dynamically import libsodium only when needed (avoids Hermes issues in dev)
        const { from_base64, base64_variants } = await import('react-native-libsodium');

        // Decrypt message
        const senderPk = from_base64(senderPublicKey, base64_variants.ORIGINAL);
        content = await ServiceContainer.encryption.decrypt(payload, senderPk);
      }
      console.log(`[ChatService] Message content: ${content.substring(0, 50)}...`);

      // Save to database
      const chatId = this.getChatId(bareFrom);
      const message: Message = {
        id,
        chatId,
        senderId: bareFrom,
        senderName: contact.name,
        content,
        contentType: 'text',
        timestamp: Date.now(),
        status: 'delivered',
        isRead: false, // Incoming messages start as unread
      };
      await ServiceContainer.database.saveMessage(message);
      console.log(`[ChatService] Message saved to database`);

      // Notify listeners
      this.messageListeners.forEach(listener => listener(message));
    } catch (error) {
      console.error('Failed to process incoming message:', error);
      // E201: Decryption failed — silently fail, don't crash the app
    }
  }

  private async handleDeliveryReceipt(messageId: string, from: string): Promise<void> {
    try {
      console.log(`[ChatService] Delivery receipt received for message ${messageId} from ${from}`);

      // Update message status to delivered
      await ServiceContainer.database.updateMessageStatus(messageId, 'delivered');

      // Also update outbox (may not exist if message was sent directly)
      try {
        await ServiceContainer.database.markDelivered(messageId, from);
      } catch (outboxError: any) {
        // Ignore "not found" errors - message wasn't in outbox (direct send)
        if (!outboxError?.message?.includes('not found')) {
          throw outboxError;
        }
      }

      // Notify status listeners so UI can update (pending → delivered)
      console.log(`[ChatService] Notifying ${this.statusListeners.size} status listeners`);
      this.statusListeners.forEach(listener => listener(messageId, 'delivered'));
    } catch (error) {
      // Non-critical, log and continue
      console.warn('Failed to process delivery receipt:', error);
    }
  }

  private async handlePresenceUpdate(
    from: string,
    show: PresenceShow,
  ): Promise<void> {
    // Defensive check for undefined from
    if (!from) {
      console.warn('[ChatService] handlePresenceUpdate called with undefined from');
      return;
    }

    // Extract bare JID (remove resource like /gajim or /mobile)
    const bareJid = from.split('/')[0];

    const previousShow = this.presenceMap.get(bareJid);
    // Consider 'unknown' (undefined) as offline for the purpose of triggering message send
    const wasOnline = previousShow !== undefined && previousShow !== 'offline';
    const isNowOnline = show !== 'offline';

    this.presenceMap.set(bareJid, show);

    console.log(`[ChatService] Presence: ${bareJid} | prev=${previousShow ?? 'undefined'} wasOnline=${wasOnline} | now=${show} isNowOnline=${isNowOnline}`);

    // Notify presence listeners for UI updates
    this.presenceListeners.forEach(listener => listener(bareJid, show));

    // If contact came online (from offline or unknown), send pending outbox messages
    // Also trigger if we have pending messages and contact is online (to handle reconnect scenarios)
    if (isNowOnline) {
      // Check if we have pending messages for this contact
      const hasPending = await this.hasPendingMessagesFor(bareJid);
      if (hasPending) {
        console.log(`[ChatService] Contact ${bareJid} is ONLINE and has pending messages - sending now`);
        await this.sendPendingOutboxMessages(bareJid);
      } else if (!wasOnline) {
        console.log(`[ChatService] Contact ${bareJid} came ONLINE (no pending messages)`);
      }
    } else if (wasOnline) {
      console.log(`[ChatService] Contact ${bareJid} went OFFLINE`);
    }
  }

  /**
   * Check if there are pending messages for a specific recipient.
   */
  private async hasPendingMessagesFor(recipientJid: string): Promise<boolean> {
    try {
      const pending = await ServiceContainer.database.getOutboxForRecipient(recipientJid);
      return pending.length > 0;
    } catch {
      return false;
    }
  }

  // ============================================================
  // Private — Outbox Retry Logic
  // ============================================================

  private scheduleNextRetry(): void {
    // Get the interval for this attempt (cap at max interval)
    const intervalIndex = Math.min(this.retryAttempt, RETRY_INTERVALS.length - 1);
    const interval = RETRY_INTERVALS[intervalIndex];

    const intervalText = interval >= 60000
      ? `${interval / 60000}m`
      : `${interval / 1000}s`;

    console.log(`[ChatService] Scheduling retry #${this.retryAttempt + 1} in ${intervalText}`);

    this.retryTimer = setTimeout(() => {
      void this.executeRetry();
    }, interval);
  }

  private async executeRetry(): Promise<void> {
    if (this.isRetrying) {
      console.log('[ChatService] Retry already in progress, skipping');
      return;
    }

    this.isRetrying = true;
    this.retryTimer = null;

    try {
      // Check if XMPP is connected
      const xmpp = ServiceContainer.xmpp;
      if (xmpp.getConnectionStatus() !== 'connected') {
        console.log('[ChatService] XMPP not connected, skipping retry');
        this.isRetrying = false;
        this.scheduleNextRetry();
        return;
      }

      // Get all pending outbox messages
      const pending = await ServiceContainer.database.getPendingOutbox();

      if (pending.length === 0) {
        console.log('[ChatService] No pending messages, stopping retry timer');
        this.isRetrying = false;
        // Reset attempt counter for next time
        this.retryAttempt = 0;
        return;
      }

      console.log(`[ChatService] Retrying ${pending.length} pending message(s)...`);

      let successCount = 0;
      let failCount = 0;

      for (const msg of pending) {
        // Check if message has expired
        if (msg.expiresAt < Date.now()) {
          console.log(`[ChatService] Message ${msg.id} expired, marking as failed`);
          await ServiceContainer.database.updateMessageStatus(msg.id, 'expired');
          await ServiceContainer.database.deleteOutboxMessage(msg.id);

          // Notify status listeners so UI can update (pending → expired)
          this.statusListeners.forEach(listener => listener(msg.id, 'expired'));
          continue;
        }

        const payload = JSON.parse(msg.encryptedContent) as EncryptedPayload;

        // Try to send to each pending recipient
        for (const recipientJid of msg.pendingTo) {
          // Check if recipient is online before sending
          // If offline, skip - the message will be sent when they come online via handlePresenceUpdate
          const recipientPresence = this.presenceMap.get(recipientJid);
          const isRecipientOnline = recipientPresence !== undefined && recipientPresence !== 'offline';

          if (!isRecipientOnline) {
            console.log(`[ChatService] Recipient ${recipientJid} is offline, skipping retry for message ${msg.id}`);
            continue;
          }

          try {
            await xmpp.sendMessage(recipientJid, payload, msg.id);
            console.log(`[ChatService] Successfully sent message ${msg.id} to ${recipientJid}`);

            // Update message status to 'sent' (receipt will change to 'delivered')
            await ServiceContainer.database.updateMessageStatus(msg.id, 'sent');

            // Notify status listeners so UI can update (pending → sent)
            this.statusListeners.forEach(listener => listener(msg.id, 'sent'));
            successCount++;
          } catch (error) {
            console.warn(`[ChatService] Failed to send message ${msg.id} to ${recipientJid}:`, error);
            failCount++;
          }
        }
      }

      console.log(`[ChatService] Retry complete: ${successCount} sent, ${failCount} failed`);

      // If all messages sent successfully, reset attempt counter
      if (failCount === 0 && successCount > 0) {
        this.retryAttempt = 0;
      } else {
        // Increment attempt for exponential backoff
        this.retryAttempt++;
      }

      // Check if there are still pending messages
      const stillPending = await ServiceContainer.database.getPendingOutbox();
      if (stillPending.length > 0) {
        // Schedule next retry with backoff
        this.scheduleNextRetry();
      } else {
        console.log('[ChatService] All messages delivered, stopping retry timer');
        this.retryAttempt = 0;
      }
    } catch (error) {
      console.error('[ChatService] Retry error:', error);
      this.retryAttempt++;
      this.scheduleNextRetry();
    } finally {
      this.isRetrying = false;
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
      console.log(`[ChatService] sendPendingOutboxMessages called for ${recipientJid}`);

      // Check XMPP connection first
      const xmpp = ServiceContainer.xmpp;
      if (xmpp.getConnectionStatus() !== 'connected') {
        console.log(`[ChatService] XMPP not connected, cannot send to ${recipientJid}`);
        return;
      }

      const pending = await ServiceContainer.database.getOutboxForRecipient(recipientJid);
      console.log(`[ChatService] Found ${pending.length} pending message(s) for ${recipientJid}`);

      if (pending.length === 0) {
        console.log(`[ChatService] No pending messages for ${recipientJid}`);
        return;
      }

      for (const msg of pending) {
        console.log(`[ChatService] Attempting to send message ${msg.id} to ${recipientJid}`);
        const payload = JSON.parse(msg.encryptedContent) as EncryptedPayload;

        try {
          await xmpp.sendMessage(recipientJid, payload, msg.id);
          console.log(`[ChatService] ✓ Successfully sent message ${msg.id} to ${recipientJid}`);

          // Update message status to 'sent' (receipt will change to 'delivered')
          await ServiceContainer.database.updateMessageStatus(msg.id, 'sent');

          // Notify status listeners so UI can update (pending → sent)
          this.statusListeners.forEach(listener => listener(msg.id, 'sent'));
        } catch (error) {
          // Send failed, keep in outbox for next attempt
          console.warn(`[ChatService] ✗ Failed to send message ${msg.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[ChatService] sendPendingOutboxMessages error:', error);
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
    await ServiceContainer.database.updateMessageStatus(messageId, status);
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
