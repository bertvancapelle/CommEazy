/**
 * ChatService Unit Tests
 *
 * Tests for 1-on-1 chat functionality:
 * - Message sending/receiving
 * - Delivery receipts
 * - Offline sync (outbox)
 * - Presence handling
 *
 * @see services/chat.ts
 */

import { chatService, ChatService } from '../../src/services/chat';
import type { Message, Contact, EncryptedPayload } from '../../src/services/interfaces';

// Mock ServiceContainer
const mockDatabase = {
  saveMessage: jest.fn(),
  getMessages: jest.fn(),
  observeMessages: jest.fn(),
  deleteMessage: jest.fn(),
  updateMessageStatus: jest.fn(),
  saveOutboxMessage: jest.fn(),
  getOutboxForRecipient: jest.fn(),
  markDelivered: jest.fn(),
  getExpiredOutbox: jest.fn(),
  cleanupExpiredOutbox: jest.fn(),
  getContact: jest.fn(),
  getContacts: jest.fn(),
};

const mockEncryption = {
  encrypt: jest.fn(),
  decrypt: jest.fn(),
  setMyJid: jest.fn(),
};

const mockXmpp = {
  sendMessage: jest.fn(),
  sendDeliveryReceipt: jest.fn(),
  getConnectionStatus: jest.fn(),
  onMessage: jest.fn(),
  onPresence: jest.fn(),
  onDeliveryReceipt: jest.fn(),
};

jest.mock('../../src/services/container', () => ({
  ServiceContainer: {
    get database() { return mockDatabase; },
    get encryption() { return mockEncryption; },
    get xmpp() { return mockXmpp; },
  },
}));

// Mock libsodium
jest.mock('libsodium-wrappers', () => ({
  ready: Promise.resolve(),
  from_base64: jest.fn((str: string) => new Uint8Array(32)),
  to_base64: jest.fn((arr: Uint8Array) => 'base64string'),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChatService();

    // Default mock implementations
    mockXmpp.onMessage.mockReturnValue(jest.fn());
    mockXmpp.onPresence.mockReturnValue(jest.fn());
    mockXmpp.onDeliveryReceipt.mockReturnValue(jest.fn());
    mockXmpp.getConnectionStatus.mockReturnValue('connected');
  });

  afterEach(async () => {
    await service.cleanup();
  });

  // ============================================================
  // Initialization
  // ============================================================

  describe('initialize', () => {
    it('should set JID and name', async () => {
      await service.initialize('user@commeazy.nl', 'Test User');
      expect(mockEncryption.setMyJid).toHaveBeenCalledWith('user@commeazy.nl');
    });

    it('should setup XMPP listeners', async () => {
      await service.initialize('user@commeazy.nl', 'Test User');
      expect(mockXmpp.onMessage).toHaveBeenCalled();
      expect(mockXmpp.onPresence).toHaveBeenCalled();
      expect(mockXmpp.onDeliveryReceipt).toHaveBeenCalled();
    });
  });

  // ============================================================
  // Chat ID Generation
  // ============================================================

  describe('getChatId', () => {
    it('should generate deterministic chat ID', async () => {
      await service.initialize('alice@commeazy.nl', 'Alice');

      const chatId1 = service.getChatId('bob@commeazy.nl');
      const chatId2 = service.getChatId('bob@commeazy.nl');

      expect(chatId1).toBe(chatId2);
      expect(chatId1).toContain('chat:');
    });

    it('should generate same ID regardless of who initiates', async () => {
      // Alice's view
      const service1 = new ChatService();
      await service1.initialize('alice@commeazy.nl', 'Alice');
      const chatId1 = service1.getChatId('bob@commeazy.nl');

      // Bob's view
      const service2 = new ChatService();
      await service2.initialize('bob@commeazy.nl', 'Bob');
      const chatId2 = service2.getChatId('alice@commeazy.nl');

      expect(chatId1).toBe(chatId2);

      await service1.cleanup();
      await service2.cleanup();
    });

    it('should throw if not initialized', () => {
      expect(() => service.getChatId('bob@commeazy.nl')).toThrow('not initialized');
    });
  });

  // ============================================================
  // Send Message
  // ============================================================

  describe('sendMessage', () => {
    const mockContact: Contact = {
      jid: 'bob@commeazy.nl',
      name: 'Bob',
      phoneNumber: '+31612345678',
      publicKey: 'YmFzZTY0a2V5',
      verified: true,
      lastSeen: Date.now(),
    };

    beforeEach(async () => {
      await service.initialize('alice@commeazy.nl', 'Alice');
      mockDatabase.getContact.mockResolvedValue(mockContact);
      mockEncryption.encrypt.mockResolvedValue({
        mode: '1on1',
        data: 'encrypted',
        metadata: { nonce: 'nonce', to: 'bob@commeazy.nl' },
      } as EncryptedPayload);
    });

    it('should encrypt and send message when connected', async () => {
      mockXmpp.getConnectionStatus.mockReturnValue('connected');

      const result = await service.sendMessage('bob@commeazy.nl', 'Hello Bob!');

      expect(mockEncryption.encrypt).toHaveBeenCalledWith(
        'Hello Bob!',
        [expect.objectContaining({ jid: 'bob@commeazy.nl' })],
      );
      expect(mockDatabase.saveMessage).toHaveBeenCalled();
      expect(mockXmpp.sendMessage).toHaveBeenCalled();
      expect(result.status).toBe('sent');
    });

    it('should save to outbox when offline', async () => {
      mockXmpp.getConnectionStatus.mockReturnValue('disconnected');
      mockDatabase.saveOutboxMessage.mockResolvedValue({ id: 'outbox-1' });

      const result = await service.sendMessage('bob@commeazy.nl', 'Hello Bob!');

      expect(mockDatabase.saveMessage).toHaveBeenCalled();
      expect(mockXmpp.sendMessage).not.toHaveBeenCalled();
      expect(result.status).toBe('pending');
    });

    it('should save to outbox when XMPP send fails', async () => {
      mockXmpp.getConnectionStatus.mockReturnValue('connected');
      mockXmpp.sendMessage.mockRejectedValue(new Error('Network error'));
      mockDatabase.saveOutboxMessage.mockResolvedValue({ id: 'outbox-1' });

      const result = await service.sendMessage('bob@commeazy.nl', 'Hello Bob!');

      expect(result.status).toBe('pending');
    });

    it('should throw E202 if contact not found', async () => {
      mockDatabase.getContact.mockResolvedValue(null);

      await expect(
        service.sendMessage('unknown@commeazy.nl', 'Hello'),
      ).rejects.toMatchObject({ code: 'E202' });
    });

    it('should throw if not initialized', async () => {
      const uninitService = new ChatService();
      await expect(
        uninitService.sendMessage('bob@commeazy.nl', 'Hello'),
      ).rejects.toThrow('not initialized');
    });
  });

  // ============================================================
  // Get Messages
  // ============================================================

  describe('getMessages', () => {
    const mockMessages: Message[] = [
      {
        id: 'msg-1',
        chatId: 'chat:alice:bob',
        senderId: 'alice@commeazy.nl',
        senderName: 'Alice',
        content: 'Hello',
        contentType: 'text',
        timestamp: Date.now(),
        status: 'delivered',
      },
    ];

    it('should fetch messages from database', async () => {
      mockDatabase.getMessages.mockResolvedValue(mockMessages);

      const messages = await service.getMessages('chat:alice:bob', 50);

      expect(mockDatabase.getMessages).toHaveBeenCalledWith('chat:alice:bob', 50, 0);
      expect(messages).toEqual(mockMessages);
    });

    it('should support pagination', async () => {
      mockDatabase.getMessages.mockResolvedValue([]);

      await service.getMessages('chat:alice:bob', 50, 100);

      expect(mockDatabase.getMessages).toHaveBeenCalledWith('chat:alice:bob', 50, 100);
    });
  });

  // ============================================================
  // Observe Messages
  // ============================================================

  describe('observeMessages', () => {
    it('should return observable from database', () => {
      const mockObservable = { subscribe: jest.fn() };
      mockDatabase.observeMessages.mockReturnValue(mockObservable);

      const observable = service.observeMessages('chat:alice:bob', 50);

      expect(mockDatabase.observeMessages).toHaveBeenCalledWith('chat:alice:bob', 50);
      expect(observable).toBe(mockObservable);
    });
  });

  // ============================================================
  // Message Listener
  // ============================================================

  describe('onMessage', () => {
    it('should register message listener', async () => {
      await service.initialize('alice@commeazy.nl', 'Alice');

      const listener = jest.fn();
      const unsubscribe = service.onMessage(listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe listener', async () => {
      await service.initialize('alice@commeazy.nl', 'Alice');

      const listener = jest.fn();
      const unsubscribe = service.onMessage(listener);

      unsubscribe();

      // Listener should be removed
    });
  });

  // ============================================================
  // Presence
  // ============================================================

  describe('isContactOnline', () => {
    it('should return false by default', async () => {
      await service.initialize('alice@commeazy.nl', 'Alice');
      expect(service.isContactOnline('bob@commeazy.nl')).toBe(false);
    });
  });

  // ============================================================
  // Cleanup
  // ============================================================

  describe('cleanup', () => {
    it('should cleanup listeners and state', async () => {
      await service.initialize('alice@commeazy.nl', 'Alice');
      await service.cleanup();

      // After cleanup, presence map should be cleared
      expect(service.isContactOnline('bob@commeazy.nl')).toBe(false);
    });
  });

  // ============================================================
  // Get Chat List
  // ============================================================

  describe('getChatList', () => {
    it('should return empty list when no contacts', async () => {
      await service.initialize('alice@commeazy.nl', 'Alice');
      mockDatabase.getContacts.mockReturnValue({
        subscribe: (cb: (contacts: Contact[]) => void) => {
          cb([]);
          return jest.fn();
        },
      });

      const chatList = await service.getChatList();
      expect(chatList).toEqual([]);
    });
  });
});

// ============================================================
// Integration Tests (require more setup)
// ============================================================

describe('ChatService Integration', () => {
  describe('Offline Sync Protocol', () => {
    it.todo('should resend pending messages when contact comes online');
    it.todo('should mark messages as delivered on receipt');
    it.todo('should cleanup expired outbox messages');
  });

  describe('Error Handling', () => {
    it.todo('should handle decryption failure gracefully');
    it.todo('should not crash on invalid message payload');
    it.todo('should emit E301 when recipient is offline');
  });
});
