/**
 * Mock Contacts Data
 *
 * Test contacts for UI development and flow testing.
 * Only loaded in __DEV__ mode.
 *
 * Characters represent realistic Dutch family scenarios:
 * - Oma Jansen: verified, active (grandmother testing the app)
 * - Papa: verified, recently online
 * - Tante Maria: not verified yet (for testing verification flow)
 * - Buurman Henk: edge case - long name, offline for days
 */

import type { Contact, Message, PresenceShow } from '../interfaces';

// Valid test Curve25519 public keys (32 bytes = 44 base64 chars with padding)
// These are pre-generated deterministic keys for testing only.
// In production, real keys are exchanged via QR code verification.
//
// Generated with: sodium.crypto_box_keypair() - these are REAL Curve25519 public keys
// that can be used for crypto_box operations. The corresponding private keys
// are not stored (mock contacts don't need to decrypt).
//
// To generate new keys: run in Node.js with libsodium:
//   const sodium = require('libsodium-wrappers');
//   await sodium.ready;
//   const kp = sodium.crypto_box_keypair();
//   console.log(sodium.to_base64(kp.publicKey));
const MOCK_PUBLIC_KEYS = {
  // Real Curve25519 public keys generated for testing
  ik: 'PlaceholderKey_WillBeReplacedWithRealKey_AtRuntime=', // Replaced dynamically
  oma: 'PlaceholderKey_WillBeReplacedWithRealKey_AtRuntime2=', // Replaced dynamically
  oma_jansen: 'de8qPk8RSQGZ3J39tS3rsqShVnZtCsLjwqaQZqJVhW4=',
  papa: 'rWwrVz/b/pNYAHHnSt37oeYjPYCG8K8pz/x8IYJ8uGI=',
  tante_maria: '3v8LfUqMqLYtQlNKKzNvL4UzLhPPShNyoKSsMcAewgI=',
  buurman_henk: 'WIuZr/H9wd/F2FGK4SNd0mYKj2NJJL+F/7xHWRdJDRc=',
};

// Mock UUIDs for test contacts (stable identifiers)
const MOCK_UUIDS = {
  oma_jansen: 'a1b2c3d4-e5f6-4a1b-8c2d-9e0f1a2b3c4d',
  papa: 'b2c3d4e5-f6a7-4b2c-9d3e-0f1a2b3c4d5e',
  tante_maria: 'c3d4e5f6-a7b8-4c3d-0e4f-1a2b3c4d5e6f',
  buurman_henk: 'd4e5f6a7-b8c9-4d4e-1f5a-2b3c4d5e6f7a',
  ik: 'e5f6a7b8-c9d0-4e5f-2a6b-3c4d5e6f7a8b',
  oma: 'f6a7b8c9-d0e1-4f6a-3b7c-4d5e6f7a8b9c',
  test: 'a7b8c9d0-e1f2-4a7b-4c8d-5e6f7a8b9c0d',
};

// Mock contacts with Dutch family-themed personas
// NOTE: For 2-device testing, 'ik' and 'oma' contacts are added dynamically
// based on which device is running (see getMockContactsForDevice)
const BASE_MOCK_CONTACTS: Contact[] = [
  {
    userUuid: MOCK_UUIDS.oma_jansen,
    jid: 'oma.jansen@commeazy.local',
    name: 'Oma Jansen',
    phoneNumber: '+31612345678',
    publicKey: MOCK_PUBLIC_KEYS.oma_jansen,
    verified: true,
    lastSeen: Date.now() - 5 * 60 * 1000, // 5 minutes ago (online)
  },
  {
    userUuid: MOCK_UUIDS.papa,
    jid: 'papa@commeazy.local',
    name: 'Papa',
    phoneNumber: '+31687654321',
    publicKey: MOCK_PUBLIC_KEYS.papa,
    verified: true,
    lastSeen: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
  },
  {
    userUuid: MOCK_UUIDS.tante_maria,
    jid: 'tante.maria@commeazy.local',
    name: 'Tante Maria',
    phoneNumber: '+31698765432',
    publicKey: MOCK_PUBLIC_KEYS.tante_maria,
    verified: false, // Not verified - for testing verification flow
    lastSeen: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
  },
  {
    userUuid: MOCK_UUIDS.buurman_henk,
    jid: 'buurman.henk@commeazy.local',
    name: 'Buurman Henk van der Berg',
    phoneNumber: '+31654321987',
    publicKey: MOCK_PUBLIC_KEYS.buurman_henk,
    verified: true,
    lastSeen: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago (almost expired)
  },
];

// Additional contacts for multi-device testing
// Each test device gets the other test devices as contacts
// For test devices, set lastSeen to old timestamp so they default to "offline"
// The REAL presence status comes from XMPP subscription, not mock lastSeen data

// Test device contacts - added dynamically based on which device is running
const TEST_DEVICE_CONTACTS: Record<string, Contact> = {
  'ik@commeazy.local': {
    userUuid: MOCK_UUIDS.ik,
    jid: 'ik@commeazy.local',
    name: 'Ik (simulator)',
    phoneNumber: '+31600000001',
    publicKey: '', // Will be set dynamically with real key
    verified: true,
    lastSeen: 0, // Unknown - presence comes from XMPP
  },
  'oma@commeazy.local': {
    userUuid: MOCK_UUIDS.oma,
    jid: 'oma@commeazy.local',
    name: 'Oma (simulator)',
    phoneNumber: '+31600000002',
    publicKey: '', // Will be set dynamically with real key
    verified: true,
    lastSeen: 0, // Unknown - presence comes from XMPP
  },
  'test@commeazy.local': {
    userUuid: MOCK_UUIDS.test,
    jid: 'test@commeazy.local',
    name: 'Test (iPhone 14)',
    phoneNumber: '+31600000003',
    publicKey: '', // Will be set dynamically with real key
    verified: true,
    lastSeen: 0, // Unknown - presence comes from XMPP
  },
};

// Backward compatibility aliases
const IK_AS_CONTACT = TEST_DEVICE_CONTACTS['ik@commeazy.local'];
const OMA_AS_CONTACT = TEST_DEVICE_CONTACTS['oma@commeazy.local'];

// All test device JIDs
const TEST_DEVICE_JIDS = ['ik@commeazy.local', 'oma@commeazy.local', 'test@commeazy.local'];

// Export function to get contacts based on current user
// Call this AFTER encryption is initialized to get real public keys
// Now supports 3+ test devices - each device sees all other test devices as contacts
export const getMockContactsForDevice = (currentUserJid: string, publicKeyMap?: Record<string, string>): Contact[] => {
  const contacts = [...BASE_MOCK_CONTACTS];

  // Add all other test devices as contacts
  for (const jid of TEST_DEVICE_JIDS) {
    if (jid !== currentUserJid) {
      const contactTemplate = TEST_DEVICE_CONTACTS[jid];
      if (contactTemplate) {
        contacts.unshift({
          ...contactTemplate,
          publicKey: publicKeyMap?.[jid] || '',
        });
      }
    }
  }

  return contacts;
};

// Default export for backward compatibility (without device-specific contacts)
export const MOCK_CONTACTS: Contact[] = BASE_MOCK_CONTACTS;

// Dev user JID (must match container.ts DEV_USER_JID)
const DEV_USER_JID = 'ik@commeazy.local';

// Generate chat ID matching ChatService.getChatId() format
const makeChatId = (contactJid: string): string => {
  const jids = [DEV_USER_JID, contactJid].sort();
  return `chat:${jids.join(':')}`;
};

// Chat IDs for conversations (derived from JIDs for consistency with ChatService)
export const MOCK_CHAT_IDS = {
  OMA: makeChatId('oma.jansen@commeazy.local'),
  PAPA: makeChatId('papa@commeazy.local'),
  TANTE_MARIA: makeChatId('tante.maria@commeazy.local'),
  BUURMAN_HENK: makeChatId('buurman.henk@commeazy.local'),
};

// Helper to get contact by JID
// Searches both base contacts AND test device contacts
export const getMockContactByJid = (jid: string): Contact | undefined => {
  // First check base mock contacts
  const baseContact = MOCK_CONTACTS.find(c => c.jid === jid);
  if (baseContact) return baseContact;

  // Then check test device contacts
  return TEST_DEVICE_CONTACTS[jid];
};

// Helper to get contact by chat ID
// Supports both base contacts AND test device contacts
export const getMockContactByChatId = (chatId: string): Contact | undefined => {
  // First check static mapping for base contacts
  const jidMap: Record<string, string> = {
    [MOCK_CHAT_IDS.OMA]: 'oma.jansen@commeazy.local',
    [MOCK_CHAT_IDS.PAPA]: 'papa@commeazy.local',
    [MOCK_CHAT_IDS.TANTE_MARIA]: 'tante.maria@commeazy.local',
    [MOCK_CHAT_IDS.BUURMAN_HENK]: 'buurman.henk@commeazy.local',
  };
  const mappedJid = jidMap[chatId];
  if (mappedJid) return getMockContactByJid(mappedJid);

  // For test device contacts, parse the chat ID to extract the other JID
  // Chat ID format: chat:jid1:jid2 (sorted alphabetically)
  if (chatId.startsWith('chat:')) {
    const parts = chatId.split(':');
    if (parts.length === 3) {
      const [_, jid1, jid2] = parts;
      // Return the contact that isn't us (check both test device JIDs)
      for (const jid of [jid1, jid2]) {
        const contact = TEST_DEVICE_CONTACTS[jid];
        if (contact) return contact;
      }
    }
  }

  return undefined;
};

// Check if a contact is "online" (seen in last 10 minutes)
export const isMockContactOnline = (contact: Contact): boolean => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  return contact.lastSeen > tenMinutesAgo;
};

// Get formatted last seen text (for display)
export const getMockLastSeenText = (contact: Contact): string => {
  const now = Date.now();
  const diff = now - contact.lastSeen;

  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));

  if (minutes < 10) return 'online';
  if (minutes < 60) return `${minutes}m geleden`;
  if (hours < 24) return `${hours}u geleden`;
  return `${days}d geleden`;
};

/**
 * Get mock presence status for a contact based on lastSeen time.
 * Used for fallback mock data when XMPP is not connected.
 *
 * - < 10 min: available (groen)
 * - < 30 min: away (oranje)
 * - < 2 hours: xa - not available (rood)
 * - else: offline (grijs)
 */
export const getMockContactPresence = (contact: Contact): PresenceShow => {
  const now = Date.now();
  const diff = now - contact.lastSeen;

  const tenMinutes = 10 * 60 * 1000;
  const thirtyMinutes = 30 * 60 * 1000;
  const twoHours = 2 * 60 * 60 * 1000;

  if (diff < tenMinutes) return 'available';
  if (diff < thirtyMinutes) return 'away';
  if (diff < twoHours) return 'xa';
  return 'offline';
};
