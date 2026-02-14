/**
 * Mock Chats & Messages Data
 *
 * Test conversations for UI development and flow testing.
 * Only loaded in __DEV__ mode.
 *
 * Conversation scenarios:
 * - Oma Jansen: Active conversation with recent messages, various states
 * - Papa: Short conversation, last message delivered
 * - Tante Maria: Empty conversation (just started)
 * - Buurman Henk: Old messages, some expired
 */

import type { Message, DeliveryStatus, ContentType } from '../interfaces';
import { MOCK_CHAT_IDS, MOCK_CONTACTS, getMockContactsForDevice } from './mockContacts';
import { chatService } from '../chat';

// Current user (you) - for message direction
export const MOCK_CURRENT_USER = {
  jid: 'ik@commeazy.local',
  name: 'Ik',
};

// Helper to create timestamps relative to now
const minutesAgo = (minutes: number): number => Date.now() - minutes * 60 * 1000;
const hoursAgo = (hours: number): number => Date.now() - hours * 60 * 60 * 1000;
const daysAgo = (days: number): number => Date.now() - days * 24 * 60 * 60 * 1000;

// Generate unique message IDs
let messageIdCounter = 1;
const generateMessageId = (): string => `mock_msg_${messageIdCounter++}`;

// Create a message helper
interface CreateMessageParams {
  chatId: string;
  content: string;
  isFromMe: boolean;
  timestamp: number;
  status?: DeliveryStatus;
  contentType?: ContentType;
  senderName?: string;
}

const createMessage = ({
  chatId,
  content,
  isFromMe,
  timestamp,
  status = 'delivered',
  contentType = 'text',
  senderName,
}: CreateMessageParams): Message => ({
  id: generateMessageId(),
  chatId,
  senderId: isFromMe ? MOCK_CURRENT_USER.jid : chatId.replace('chat_', '') + '@commeazy.local',
  senderName: isFromMe ? MOCK_CURRENT_USER.name : (senderName ?? 'Contact'),
  content,
  contentType,
  timestamp,
  status: isFromMe ? status : 'delivered', // Incoming messages are always "delivered"
});

// ============================================================
// Conversation with Oma Jansen (active, various states)
// ============================================================
export const MOCK_MESSAGES_OMA: Message[] = [
  createMessage({
    chatId: MOCK_CHAT_IDS.OMA,
    content: 'Goedemorgen lieverd! Hoe gaat het met je?',
    isFromMe: false,
    timestamp: hoursAgo(3),
    senderName: 'Oma Jansen',
  }),
  createMessage({
    chatId: MOCK_CHAT_IDS.OMA,
    content: 'Hoi oma! Goed hoor, druk met werk. En met u?',
    isFromMe: true,
    timestamp: hoursAgo(2.5),
    status: 'delivered',
  }),
  createMessage({
    chatId: MOCK_CHAT_IDS.OMA,
    content: 'Prima! Ik heb net appeltaart gebakken. Kom je zondag langs?',
    isFromMe: false,
    timestamp: hoursAgo(2),
    senderName: 'Oma Jansen',
  }),
  createMessage({
    chatId: MOCK_CHAT_IDS.OMA,
    content: 'Dat klinkt heerlijk! Ja, ik kom graag. Hoe laat?',
    isFromMe: true,
    timestamp: hoursAgo(1.5),
    status: 'delivered',
  }),
  createMessage({
    chatId: MOCK_CHAT_IDS.OMA,
    content: 'Om 3 uur? Dan kunnen we samen koffie drinken.',
    isFromMe: false,
    timestamp: hoursAgo(1),
    senderName: 'Oma Jansen',
  }),
  createMessage({
    chatId: MOCK_CHAT_IDS.OMA,
    content: 'Perfect! Tot zondag!',
    isFromMe: true,
    timestamp: minutesAgo(30),
    status: 'delivered',
  }),
  createMessage({
    chatId: MOCK_CHAT_IDS.OMA,
    content: 'Tot dan schat!',
    isFromMe: false,
    timestamp: minutesAgo(5),
    senderName: 'Oma Jansen',
  }),
];

// ============================================================
// Conversation with Papa (short, recent)
// ============================================================
export const MOCK_MESSAGES_PAPA: Message[] = [
  createMessage({
    chatId: MOCK_CHAT_IDS.PAPA,
    content: 'Kun je me morgen helpen met de tuin?',
    isFromMe: false,
    timestamp: hoursAgo(5),
    senderName: 'Papa',
  }),
  createMessage({
    chatId: MOCK_CHAT_IDS.PAPA,
    content: 'Ja hoor, hoe laat?',
    isFromMe: true,
    timestamp: hoursAgo(4),
    status: 'delivered',
  }),
  createMessage({
    chatId: MOCK_CHAT_IDS.PAPA,
    content: 'Rond 10 uur? Dan hebben we de hele dag.',
    isFromMe: false,
    timestamp: hoursAgo(3.5),
    senderName: 'Papa',
  }),
  createMessage({
    chatId: MOCK_CHAT_IDS.PAPA,
    content: 'Prima, ik ben er!',
    isFromMe: true,
    timestamp: hoursAgo(3),
    status: 'delivered',
  }),
];

// ============================================================
// Conversation with Tante Maria (just started, no messages yet)
// ============================================================
export const MOCK_MESSAGES_TANTE_MARIA: Message[] = [];

// ============================================================
// Conversation with Buurman Henk (old, some with issues)
// ============================================================
export const MOCK_MESSAGES_BUURMAN_HENK: Message[] = [
  createMessage({
    chatId: MOCK_CHAT_IDS.BUURMAN_HENK,
    content: 'Hoi Henk, heb je mijn pakketje kunnen aannemen?',
    isFromMe: true,
    timestamp: daysAgo(6),
    status: 'delivered',
  }),
  createMessage({
    chatId: MOCK_CHAT_IDS.BUURMAN_HENK,
    content: 'Ja hoor, staat bij mij in de gang. Kom het maar halen wanneer je wilt!',
    isFromMe: false,
    timestamp: daysAgo(6) + 30 * 60 * 1000,
    senderName: 'Buurman Henk van der Berg',
  }),
  createMessage({
    chatId: MOCK_CHAT_IDS.BUURMAN_HENK,
    content: 'Bedankt! Ik kom vanmiddag even langs.',
    isFromMe: true,
    timestamp: daysAgo(6) + 60 * 60 * 1000,
    status: 'delivered',
  }),
  // This message is "pending" - Henk hasn't been online
  createMessage({
    chatId: MOCK_CHAT_IDS.BUURMAN_HENK,
    content: 'Nog een fijne dag verder!',
    isFromMe: true,
    timestamp: daysAgo(5),
    status: 'pending',
  }),
];

// ============================================================
// Conversation between test devices (ik@commeazy.local <-> oma@commeazy.local)
// This chat ID is generated the same way as ChatService.getChatId()
// ============================================================
export const DEVICE_CHAT_ID = 'chat:ik@commeazy.local:oma@commeazy.local';

export const MOCK_MESSAGES_DEVICE_CHAT: Message[] = [
  {
    id: 'device_msg_1',
    chatId: DEVICE_CHAT_ID,
    senderId: 'oma@commeazy.local',
    senderName: 'Oma (andere device)',
    content: 'Hallo! Dit is een testbericht van de iPhone 16e.',
    contentType: 'text',
    timestamp: minutesAgo(30),
    status: 'delivered',
    isRead: true,
  },
  {
    id: 'device_msg_2',
    chatId: DEVICE_CHAT_ID,
    senderId: 'ik@commeazy.local',
    senderName: 'Ik (andere device)',
    content: 'Hoi! Bericht van de iPhone 17 Pro.',
    contentType: 'text',
    timestamp: minutesAgo(25),
    status: 'delivered',
    isRead: true,
  },
  {
    id: 'device_msg_3',
    chatId: DEVICE_CHAT_ID,
    senderId: 'oma@commeazy.local',
    senderName: 'Oma (andere device)',
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
  [MOCK_CHAT_IDS.OMA]: MOCK_MESSAGES_OMA,
  [MOCK_CHAT_IDS.PAPA]: MOCK_MESSAGES_PAPA,
  [MOCK_CHAT_IDS.TANTE_MARIA]: MOCK_MESSAGES_TANTE_MARIA,
  [MOCK_CHAT_IDS.BUURMAN_HENK]: MOCK_MESSAGES_BUURMAN_HENK,
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
  // Count messages that are from others and "unread" (we'll simulate this)
  // In a real app, we'd track read status per message
  return messages.filter(
    m => m.senderId !== MOCK_CURRENT_USER.jid && m.timestamp > hoursAgo(1)
  ).length;
};

// Chat list data (for ChatsScreen)
export interface MockChatListItem {
  chatId: string;
  contact: typeof MOCK_CONTACTS[0];
  lastMessage: Message | undefined;
  unreadCount: number;
}

export const getMockChatList = (): MockChatListItem[] => {
  // Get device-specific contacts (includes ik/oma for the other device)
  const currentUserJid = chatService.isInitialized ? chatService.getMyJid() : null;
  const contacts = currentUserJid
    ? getMockContactsForDevice(currentUserJid)
    : MOCK_CONTACTS;

  return contacts.map(contact => {
    // Map contact JID to chat ID
    let mappedChatId = '';

    // Check for device-to-device chat (ik <-> oma)
    if (contact.jid === 'ik@commeazy.local' || contact.jid === 'oma@commeazy.local') {
      mappedChatId = DEVICE_CHAT_ID;
    } else if (contact.jid.includes('oma.jansen')) {
      mappedChatId = MOCK_CHAT_IDS.OMA;
    } else if (contact.jid.includes('papa')) {
      mappedChatId = MOCK_CHAT_IDS.PAPA;
    } else if (contact.jid.includes('tante')) {
      mappedChatId = MOCK_CHAT_IDS.TANTE_MARIA;
    } else if (contact.jid.includes('buurman')) {
      mappedChatId = MOCK_CHAT_IDS.BUURMAN_HENK;
    }

    const chatId = mappedChatId || `chat_${contact.jid.split('@')[0]}`;

    return {
      chatId,
      contact,
      lastMessage: getLastMockMessage(chatId),
      unreadCount: getMockUnreadCount(chatId),
    };
  }).filter(item => item.lastMessage !== undefined || item.contact.jid.includes('tante'))
    .sort((a, b) => {
      // Sort by last message timestamp (newest first)
      const aTime = a.lastMessage?.timestamp ?? 0;
      const bTime = b.lastMessage?.timestamp ?? 0;
      return bTime - aTime;
    });
};
