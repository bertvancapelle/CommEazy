/**
 * Test Device Chat Messages
 *
 * Seed messages for testing chat functionality between test devices.
 * Only loaded in __DEV__ mode.
 *
 * PRIVACY ARCHITECTURE: JIDs are UUID-based (production-parity).
 */

import type { Message } from '../interfaces';
import { MOCK_JIDS } from './mockContacts';
import { getMockContactsForDevice } from './mockContacts';
import { chatService } from '../chat';

// Current user is determined dynamically — this constant is a fallback
// for code that needs a static reference (e.g., unread count filtering).
export const MOCK_CURRENT_USER = {
  jid: MOCK_JIDS.sim1,
  name: 'Sim1',
};

// Helper to create timestamps relative to now
const minutesAgo = (minutes: number): number => Date.now() - minutes * 60 * 1000;

// ============================================================
// Conversation between test devices (sim1 <-> sim2)
// This chat ID is generated the same way as ChatService.getChatId()
// ============================================================
const chatJids = [MOCK_JIDS.sim1, MOCK_JIDS.sim2].sort();
export const DEVICE_CHAT_ID = `chat:${chatJids.join(':')}`;

export const MOCK_MESSAGES_DEVICE_CHAT: Message[] = [
  {
    id: 'device_msg_1',
    chatId: DEVICE_CHAT_ID,
    senderId: MOCK_JIDS.sim2,
    senderName: 'Sim2 (iPhone 16e)',
    content: 'Hallo! Dit is een testbericht van de iPhone 16e.',
    contentType: 'text',
    timestamp: minutesAgo(30),
    status: 'delivered',
    isRead: true,
  },
  {
    id: 'device_msg_2',
    chatId: DEVICE_CHAT_ID,
    senderId: MOCK_JIDS.sim1,
    senderName: 'Sim1 (iPhone 17 Pro)',
    content: 'Hoi! Bericht van de iPhone 17 Pro.',
    contentType: 'text',
    timestamp: minutesAgo(25),
    status: 'delivered',
    isRead: true,
  },
  {
    id: 'device_msg_3',
    chatId: DEVICE_CHAT_ID,
    senderId: MOCK_JIDS.sim2,
    senderName: 'Sim2 (iPhone 16e)',
    content: 'Mooi! De messaging werkt! 🎉',
    contentType: 'text',
    timestamp: minutesAgo(20),
    status: 'delivered',
    isRead: false,
  },
];

// ============================================================
// Combined data access
// ============================================================

export const MOCK_MESSAGES: Record<string, Message[]> = {
  [DEVICE_CHAT_ID]: MOCK_MESSAGES_DEVICE_CHAT,
};

// Get messages for a chat (newest first)
export const getMockMessages = (chatId: string, limit = 50): Message[] => {
  const messages = MOCK_MESSAGES[chatId] ?? [];
  return [...messages].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
};

// Get the last message for a chat (for chat list preview)
export const getLastMockMessage = (chatId: string): Message | undefined => {
  const messages = MOCK_MESSAGES[chatId];
  if (!messages || messages.length === 0) return undefined;
  return [...messages].sort((a, b) => b.timestamp - a.timestamp)[0];
};

// Get unread count for a chat
export const getMockUnreadCount = (chatId: string): number => {
  const messages = MOCK_MESSAGES[chatId] ?? [];
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  return messages.filter(
    m => m.senderId !== MOCK_CURRENT_USER.jid && m.timestamp > oneHourAgo
  ).length;
};

// Chat list data (for ChatsScreen)
export interface MockChatListItem {
  chatId: string;
  contact: import('../interfaces').Contact;
  lastMessage: Message | undefined;
  unreadCount: number;
}

export const getMockChatList = async (): Promise<MockChatListItem[]> => {
  // Get device-specific contacts
  const currentUserJid = chatService.isInitialized ? chatService.getMyJid() : null;

  // Load public keys for test devices (required for E2E encryption)
  let publicKeyMap: Record<string, string> = {};
  if (currentUserJid) {
    try {
      const { getOtherDevicesPublicKeys } = await import('./testKeys');
      publicKeyMap = await getOtherDevicesPublicKeys(currentUserJid);
    } catch (error) {
      console.warn('[MockChats] Failed to load test public keys:', error);
    }
  }

  if (!currentUserJid) return [];

  const contacts = getMockContactsForDevice(currentUserJid, publicKeyMap);

  return contacts.map(contact => {
    // Generate chat ID the same way as ChatService.getChatId()
    const jids = [currentUserJid, contact.jid].sort();
    const chatId = `chat:${jids.join(':')}`;

    return {
      chatId,
      contact,
      lastMessage: getLastMockMessage(chatId),
      unreadCount: getMockUnreadCount(chatId),
    };
  }).sort((a, b) => {
    const aTime = a.lastMessage?.timestamp ?? 0;
    const bTime = b.lastMessage?.timestamp ?? 0;
    return bTime - aTime;
  });
};
