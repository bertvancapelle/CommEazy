/**
 * GroupChatService — Group Chat Business Logic
 *
 * Combines XMPP MUC, Encryption (dual-path), and Database services to handle:
 * - Creating groups
 * - Sending encrypted group messages
 * - Receiving and decrypting group messages
 * - Managing group members
 * - Offline sync (7-day outbox)
 *
 * Dual-path encryption:
 * - ≤8 members: encrypt-to-all (individual crypto_box per recipient)
 * - >8 members: shared-key (AES secretbox + key wrapping)
 *
 * @see services/interfaces.ts for contracts
 * @see .claude/skills/xmpp-specialist/SKILL.md for MUC protocol
 * @see .claude/skills/security-expert/SKILL.md for dual-path encryption
 */

import uuid from 'react-native-uuid';

import { ServiceContainer } from './container';
import { isPlaintextMode } from './mock';
import type {
  Message,
  OutboxMessage,
  Contact,
  Group,
  EncryptedPayload,
  Observable,
  Unsubscribe,
  DeliveryStatus,
  Recipient,
  EncryptionMode,
} from './interfaces';
import { AppError, COMMEAZY_DOMAIN } from './interfaces';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MUC_DOMAIN = `muc.${COMMEAZY_DOMAIN}`;

export interface GroupListItem {
  groupId: string;
  group: Group;
  lastMessage: Message | null;
  unreadCount: number;
}

export interface SendGroupMessageResult {
  messageId: string;
  status: DeliveryStatus;
}

export interface CreateGroupResult {
  groupId: string;
  roomJid: string;
}

export class GroupChatService {
  private myJid: string | null = null;
  private myName: string | null = null;
  private unsubscribers: Unsubscribe[] = [];
  private messageListeners: Set<(message: Message) => void> = new Set();
  private statusListeners: Set<(messageId: string, status: DeliveryStatus) => void> = new Set();

  // Track which MUC rooms we've joined
  private joinedRooms: Set<string> = new Set();

  /**
   * Check if the group chat service has been initialized.
   */
  get isInitialized(): boolean {
    return this.myJid !== null && this.myName !== null;
  }

  /**
   * Get the current user's JID.
   */
  getMyJid(): string | null {
    return this.myJid;
  }

  /**
   * Get the current user's display name.
   */
  getMyName(): string | null {
    return this.myName;
  }

  /**
   * Initialize group chat service with current user info.
   * Must be called after user authentication.
   */
  async initialize(jid: string, name: string): Promise<void> {
    this.myJid = jid;
    this.myName = name;

    // Subscribe to XMPP MUC events
    this.setupXMPPListeners();

    // Join all existing groups
    await this.joinAllGroups();
  }

  /**
   * Create a new group.
   *
   * @param name - Group display name
   * @param memberJids - Array of member JIDs (creator is added automatically)
   */
  async createGroup(name: string, memberJids: string[]): Promise<CreateGroupResult> {
    this.ensureInitialized();

    const groupId = uuid.v4() as string;
    const roomJid = `${groupId}@${MUC_DOMAIN}`;

    // Add self to members if not already included
    const allMembers = memberJids.includes(this.myJid!)
      ? memberJids
      : [this.myJid!, ...memberJids];

    // Determine encryption mode based on member count
    const encryptionMode: EncryptionMode = allMembers.length <= 8
      ? 'encrypt-to-all'
      : 'shared-key';

    // Create group in database
    const group: Group = {
      id: groupId,
      name,
      members: allMembers,
      createdBy: this.myJid!,
      createdAt: Date.now(),
      encryptionMode,
    };

    await ServiceContainer.database.saveGroup(group);

    // Join the MUC room
    try {
      const xmpp = ServiceContainer.xmpp;
      if (xmpp.getConnectionStatus() === 'connected') {
        await xmpp.joinMUC(roomJid, this.myName!);
        this.joinedRooms.add(roomJid);
        console.log(`[GroupChatService] Created and joined room: ${roomJid}`);
      }
    } catch (error) {
      console.warn(`[GroupChatService] Failed to join MUC room ${roomJid}:`, error);
      // Group is still created locally, will join when connected
    }

    return { groupId, roomJid };
  }

  /**
   * Send a text message to a group.
   * Handles dual-path encryption based on member count.
   */
  async sendMessage(
    groupId: string,
    content: string,
  ): Promise<SendGroupMessageResult> {
    this.ensureInitialized();

    const group = await ServiceContainer.database.getGroup(groupId);
    if (!group) {
      throw new AppError('E404', 'delivery', () => {}, {
        reason: 'group_not_found',
      });
    }

    const messageId = uuid.v4() as string;
    const timestamp = Date.now();
    const roomJid = `${groupId}@${MUC_DOMAIN}`;

    try {
      // Get recipient info for all members (except self)
      const recipients = await this.getGroupRecipients(group);

      let encryptedPayload: EncryptedPayload;

      // DEV MODE: Plaintext mode bypasses encryption
      if (__DEV__ && isPlaintextMode()) {
        console.log('[GroupChatService] PLAINTEXT MODE: Sending unencrypted message');
        encryptedPayload = {
          mode: 'plaintext' as any,
          data: JSON.stringify({
            content,
            senderJid: this.myJid,
            senderName: this.myName,
          }),
          metadata: {
            groupId,
          },
        };
      } else {
        // PRODUCTION: Real encryption (dual-path based on member count)
        encryptedPayload = await ServiceContainer.encryption.encrypt(
          content,
          recipients,
        );
        // Add group metadata
        encryptedPayload.metadata.groupId = groupId;
      }

      // Save to local messages (decrypted for display)
      const message: Message = {
        id: messageId,
        chatId: groupId, // For groups, chatId = groupId
        senderId: this.myJid!,
        senderName: this.myName!,
        content,
        contentType: 'text',
        timestamp,
        status: 'pending',
        isRead: true, // Own messages are always "read"
      };
      await ServiceContainer.database.saveMessage(message);

      // Notify listeners
      this.messageListeners.forEach(listener => listener(message));

      // Try to send via XMPP MUC
      const xmpp = ServiceContainer.xmpp;
      if (xmpp.getConnectionStatus() === 'connected') {
        try {
          // Ensure we're in the room
          if (!this.joinedRooms.has(roomJid)) {
            await xmpp.joinMUC(roomJid, this.myName!);
            this.joinedRooms.add(roomJid);
          }

          await xmpp.sendMUCMessage(roomJid, encryptedPayload, messageId);
          await this.updateMessageStatus(messageId, 'sent');
          return { messageId, status: 'sent' };
        } catch (xmppError) {
          console.warn('[GroupChatService] MUC send failed:', xmppError);
          // Save to outbox for offline members
          await this.saveToOutbox(groupId, encryptedPayload, group.members, messageId);
          return { messageId, status: 'pending' };
        }
      } else {
        // Not connected, save to outbox
        await this.saveToOutbox(groupId, encryptedPayload, group.members, messageId);
        return { messageId, status: 'pending' };
      }
    } catch (error) {
      console.error('[GroupChatService] sendMessage error:', error);
      if (error instanceof AppError) throw error;

      throw new AppError('E300', 'delivery', () => {}, {
        reason: 'send_failed',
      });
    }
  }

  /**
   * Get messages for a group.
   */
  async getMessages(groupId: string, limit = 50, offset = 0): Promise<Message[]> {
    return ServiceContainer.database.getMessages(groupId, limit, offset);
  }

  /**
   * Observe messages for a group (real-time updates).
   */
  observeMessages(groupId: string, limit = 50): Observable<Message[]> {
    return ServiceContainer.database.observeMessages(groupId, limit);
  }

  /**
   * Get list of all groups with last message info.
   */
  async getGroupList(): Promise<GroupListItem[]> {
    this.ensureInitialized();

    const groupList: GroupListItem[] = [];
    const groups: Group[] = [];

    // Get all groups via subscription
    const unsubscribe = ServiceContainer.database.getGroups().subscribe(g => {
      groups.push(...g);
    });
    unsubscribe();

    for (const group of groups) {
      const messages = await ServiceContainer.database.getMessages(group.id, 1);
      const unreadCount = await ServiceContainer.database.getUnreadCount(group.id);

      groupList.push({
        groupId: group.id,
        group,
        lastMessage: messages.length > 0 ? messages[0] : null,
        unreadCount,
      });
    }

    // Sort by last message time (newest first)
    groupList.sort((a, b) => {
      const aTime = a.lastMessage?.timestamp ?? a.group.createdAt;
      const bTime = b.lastMessage?.timestamp ?? b.group.createdAt;
      return bTime - aTime;
    });

    return groupList;
  }

  /**
   * Observe group list for real-time updates.
   */
  observeGroupList(): Observable<GroupListItem[]> {
    const subscribers: Set<(list: GroupListItem[]) => void> = new Set();

    const emitGroupList = async () => {
      try {
        const groupList = await this.getGroupList();
        subscribers.forEach(sub => sub(groupList));
      } catch (error) {
        console.error('[GroupChatService] Failed to build group list:', error);
      }
    };

    let groupsUnsub: Unsubscribe | null = null;
    let messageUnsub: Unsubscribe | null = null;

    return {
      subscribe: (callback) => {
        subscribers.add(callback);

        if (subscribers.size === 1) {
          groupsUnsub = ServiceContainer.database.getGroups().subscribe(() => {
            void emitGroupList();
          });

          messageUnsub = this.onMessage(() => {
            void emitGroupList();
          });
        }

        void emitGroupList();

        return () => {
          subscribers.delete(callback);
          if (subscribers.size === 0) {
            groupsUnsub?.();
            messageUnsub?.();
            groupsUnsub = null;
            messageUnsub = null;
          }
        };
      },
    };
  }

  /**
   * Add a member to a group.
   */
  async addMember(groupId: string, memberJid: string): Promise<void> {
    const group = await ServiceContainer.database.getGroup(groupId);
    if (!group) {
      throw new AppError('E404', 'delivery', () => {}, {
        reason: 'group_not_found',
      });
    }

    if (group.members.includes(memberJid)) {
      return; // Already a member
    }

    const newMembers = [...group.members, memberJid];
    await ServiceContainer.database.updateGroupMembers(groupId, newMembers);

    console.log(`[GroupChatService] Added ${memberJid} to group ${groupId}`);
  }

  /**
   * Remove a member from a group.
   */
  async removeMember(groupId: string, memberJid: string): Promise<void> {
    const group = await ServiceContainer.database.getGroup(groupId);
    if (!group) {
      throw new AppError('E404', 'delivery', () => {}, {
        reason: 'group_not_found',
      });
    }

    const newMembers = group.members.filter(jid => jid !== memberJid);
    await ServiceContainer.database.updateGroupMembers(groupId, newMembers);

    console.log(`[GroupChatService] Removed ${memberJid} from group ${groupId}`);
  }

  /**
   * Leave a group.
   */
  async leaveGroup(groupId: string): Promise<void> {
    this.ensureInitialized();

    const roomJid = `${groupId}@${MUC_DOMAIN}`;

    // Leave MUC room
    try {
      const xmpp = ServiceContainer.xmpp;
      if (xmpp.getConnectionStatus() === 'connected' && this.joinedRooms.has(roomJid)) {
        await xmpp.leaveMUC(roomJid);
        this.joinedRooms.delete(roomJid);
      }
    } catch (error) {
      console.warn(`[GroupChatService] Failed to leave MUC room:`, error);
    }

    // Remove self from members
    await this.removeMember(groupId, this.myJid!);

    console.log(`[GroupChatService] Left group ${groupId}`);
  }

  /**
   * Subscribe to new incoming group messages.
   */
  onMessage(listener: (message: Message) => void): Unsubscribe {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  /**
   * Subscribe to message status changes.
   */
  onMessageStatusChange(listener: (messageId: string, status: DeliveryStatus) => void): Unsubscribe {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Mark all messages in a group as read.
   */
  async markGroupAsRead(groupId: string): Promise<void> {
    await ServiceContainer.database.markAllMessagesAsRead(groupId);
  }

  /**
   * Get unread count for a group.
   */
  async getUnreadCount(groupId: string): Promise<number> {
    return ServiceContainer.database.getUnreadCount(groupId);
  }

  /**
   * Cleanup and disconnect.
   */
  async cleanup(): Promise<void> {
    // Leave all MUC rooms
    const xmpp = ServiceContainer.xmpp;
    if (xmpp.getConnectionStatus() === 'connected') {
      for (const roomJid of this.joinedRooms) {
        try {
          await xmpp.leaveMUC(roomJid);
        } catch {
          // Ignore leave errors during cleanup
        }
      }
    }

    this.joinedRooms.clear();
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.messageListeners.clear();
    this.statusListeners.clear();
  }

  // ============================================================
  // Private — XMPP MUC Event Handlers
  // ============================================================

  private setupXMPPListeners(): void {
    const xmpp = ServiceContainer.xmpp;

    // Handle incoming MUC messages
    // Note: MUC messages come through the same onMessage handler
    // but with the room JID as the 'from' field
    const msgUnsub = xmpp.onMessage(async (from, payload, id) => {
      await this.handleIncomingMessage(from, payload, id);
    });
    this.unsubscribers.push(msgUnsub);
  }

  private async handleIncomingMessage(
    from: string,
    payload: EncryptedPayload,
    id: string,
  ): Promise<void> {
    // Check if this is a MUC message (from muc.commeazy.local)
    if (!from.includes(MUC_DOMAIN)) {
      return; // Not a MUC message, let ChatService handle it
    }

    // Extract room JID and sender nickname
    // Format: room@muc.commeazy.local/nickname
    const parts = from.split('/');
    const roomJid = parts[0];
    const senderNickname = parts[1];

    // Extract group ID from room JID
    const groupId = roomJid.split('@')[0];

    // Get group to verify membership
    const group = await ServiceContainer.database.getGroup(groupId);
    if (!group) {
      console.warn(`[GroupChatService] Received message for unknown group: ${groupId}`);
      return;
    }

    // Skip our own messages (MUC echoes them back)
    if (senderNickname === this.myName) {
      console.log(`[GroupChatService] Skipping own message echo`);
      return;
    }

    try {
      let content: string;
      let senderJid: string;
      let senderName: string;

      // DEV MODE: Check for plaintext mode
      if (__DEV__ && (payload.mode as any) === 'plaintext') {
        console.log(`[GroupChatService] PLAINTEXT MODE: Received unencrypted message`);
        const parsed = JSON.parse(payload.data);
        content = parsed.content;
        senderJid = parsed.senderJid;
        senderName = parsed.senderName;
      } else {
        // PRODUCTION: Real decryption
        // Get sender's public key from contacts
        const senderContact = await this.findSenderByNickname(group, senderNickname);
        if (!senderContact) {
          console.warn(`[GroupChatService] Unknown sender: ${senderNickname}`);
          return;
        }

        const { from_base64, base64_variants } = await import('react-native-libsodium');
        const senderPk = from_base64(senderContact.publicKey, base64_variants.ORIGINAL);
        content = await ServiceContainer.encryption.decrypt(payload, senderPk);
        senderJid = senderContact.jid;
        senderName = senderContact.name;
      }

      // Save to database
      const message: Message = {
        id,
        chatId: groupId,
        senderId: senderJid,
        senderName: senderName,
        content,
        contentType: 'text',
        timestamp: Date.now(),
        status: 'delivered',
        isRead: false,
      };
      await ServiceContainer.database.saveMessage(message);

      // Notify listeners
      this.messageListeners.forEach(listener => listener(message));

      console.log(`[GroupChatService] Saved group message from ${senderName}`);
    } catch (error) {
      console.error('[GroupChatService] Failed to process group message:', error);
    }
  }

  // ============================================================
  // Private — Helpers
  // ============================================================

  private async joinAllGroups(): Promise<void> {
    const groups: Group[] = [];
    const unsubscribe = ServiceContainer.database.getGroups().subscribe(g => {
      groups.push(...g);
    });
    unsubscribe();

    const xmpp = ServiceContainer.xmpp;
    if (xmpp.getConnectionStatus() !== 'connected') {
      console.log('[GroupChatService] XMPP not connected, skipping MUC joins');
      return;
    }

    for (const group of groups) {
      const roomJid = `${group.id}@${MUC_DOMAIN}`;
      try {
        await xmpp.joinMUC(roomJid, this.myName!);
        this.joinedRooms.add(roomJid);
        console.log(`[GroupChatService] Joined room: ${roomJid}`);
      } catch (error) {
        console.warn(`[GroupChatService] Failed to join ${roomJid}:`, error);
      }
    }
  }

  private async getGroupRecipients(group: Group): Promise<Recipient[]> {
    const recipients: Recipient[] = [];

    for (const memberJid of group.members) {
      // Skip self
      if (memberJid === this.myJid) continue;

      const contact = await ServiceContainer.database.getContact(memberJid);
      if (contact && contact.publicKey) {
        const { from_base64, base64_variants } = await import('react-native-libsodium');
        recipients.push({
          jid: memberJid,
          publicKey: from_base64(contact.publicKey, base64_variants.ORIGINAL),
        });
      } else {
        console.warn(`[GroupChatService] No public key for member: ${memberJid}`);
      }
    }

    return recipients;
  }

  private async findSenderByNickname(group: Group, nickname: string): Promise<Contact | null> {
    // Try to find member by display name
    for (const memberJid of group.members) {
      const contact = await ServiceContainer.database.getContact(memberJid);
      if (contact && contact.name === nickname) {
        return contact;
      }
    }
    return null;
  }

  private async saveToOutbox(
    groupId: string,
    encryptedPayload: EncryptedPayload,
    members: string[],
    messageId: string,
  ): Promise<void> {
    // Filter out self from pending recipients
    const pendingTo = members.filter(jid => jid !== this.myJid);

    const outboxMsg: Omit<OutboxMessage, 'id'> = {
      chatId: groupId,
      encryptedContent: JSON.stringify(encryptedPayload),
      contentType: 'text',
      timestamp: Date.now(),
      expiresAt: Date.now() + SEVEN_DAYS_MS,
      pendingTo,
      deliveredTo: [],
    };

    await ServiceContainer.database.saveOutboxMessage({ ...outboxMsg, id: messageId } as any);
  }

  private async updateMessageStatus(messageId: string, status: DeliveryStatus): Promise<void> {
    await ServiceContainer.database.updateMessageStatus(messageId, status);
    this.statusListeners.forEach(listener => listener(messageId, status));
  }

  private ensureInitialized(): void {
    if (!this.myJid || !this.myName) {
      throw new Error('GroupChatService not initialized — call initialize() first');
    }
  }
}

/** Singleton instance */
export const groupChatService = new GroupChatService();
