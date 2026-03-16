/**
 * Test Device Contacts Data
 *
 * Contacts for multi-device development testing.
 * Only loaded in __DEV__ mode.
 *
 * Test devices (physical):
 * - bert@commeazy.local: iPhone 14 (physical, Bert)
 * - jeanine@commeazy.local: iPhone 12 (physical, Jeanine)
 * - pipo@commeazy.local: iPad (physical, Pipo)
 *
 * Test devices (simulator):
 * - sim1@commeazy.local: iPhone 17 Pro (simulator)
 * - sim2@commeazy.local: iPhone 16e (simulator)
 * - simipad@commeazy.local: iPad (simulator)
 */

import type { Contact, PresenceShow } from '../interfaces';

// Stable UUIDs for test device contacts
const MOCK_UUIDS = {
  bert: 'e5f6a7b8-c9d0-4e5f-2a6b-3c4d5e6f7a8b',
  jeanine: 'b8c9d0e1-f2a3-4b8c-5d9e-6f7a8b9c0d1e',
  pipo: 'd0e1f2a3-b4c5-4d0e-7f1a-8b9c0d1e2f3a',
  sim1: 'f6a7b8c9-d0e1-4f6a-3b7c-4d5e6f7a8b9c',
  sim2: 'a7b8c9d0-e1f2-4a7b-4c8d-5e6f7a8b9c0d',
  simipad: 'c9d0e1f2-a3b4-4c9d-6e0f-7a8b9c0d1e2f',
};

// Test device contacts — each device sees all other test devices as contacts
// lastSeen is set to 0 (unknown) — real presence comes from XMPP subscription
const TEST_DEVICE_CONTACTS: Record<string, Contact> = {
  'bert@commeazy.local': {
    userUuid: MOCK_UUIDS.bert,
    jid: 'bert@commeazy.local',
    firstName: 'Bert',
    lastName: '',
    phoneNumber: '+31201234567',
    mobileNumber: '+31600000001',
    email: 'bert@commeazy.local',
    publicKey: '', // Will be set dynamically with real key
    verified: true,
    trustLevel: 2, // Connected (has CommEazy app)
    lastSeen: 0, // Unknown - presence comes from XMPP
    address: {
      street: 'Kerkstraat 42',
      postalCode: '1012 AB',
      city: 'Amsterdam',
      country: 'Nederland',
    },
    categories: JSON.stringify(['family', 'doctor']),
  },
  'jeanine@commeazy.local': {
    userUuid: MOCK_UUIDS.jeanine,
    jid: 'jeanine@commeazy.local',
    firstName: 'Jeanine',
    lastName: '',
    mobileNumber: '+31600000004',
    email: 'jeanine@commeazy.local',
    publicKey: '', // Will be set dynamically with real key
    verified: true,
    trustLevel: 2, // Connected (has CommEazy app)
    lastSeen: 0, // Unknown - presence comes from XMPP
    address: {
      street: 'Hoofdstraat 17',
      postalCode: '3511 KN',
      city: 'Utrecht',
      country: 'Nederland',
    },
    categories: JSON.stringify(['family', 'hairdresser']),
  },
  'pipo@commeazy.local': {
    userUuid: MOCK_UUIDS.pipo,
    jid: 'pipo@commeazy.local',
    firstName: 'Pipo',
    lastName: '',
    mobileNumber: '+31600000006',
    email: 'pipo@commeazy.local',
    publicKey: '', // Will be set dynamically with real key
    verified: true,
    trustLevel: 2, // Connected (has CommEazy app)
    lastSeen: 0, // Unknown - presence comes from XMPP
    categories: JSON.stringify(['family']),
  },
  'sim1@commeazy.local': {
    userUuid: MOCK_UUIDS.sim1,
    jid: 'sim1@commeazy.local',
    firstName: 'Sim1',
    lastName: '(iPhone 17 Pro)',
    phoneNumber: '+31207654321',
    mobileNumber: '+31600000002',
    email: 'sim1@commeazy.local',
    publicKey: '', // Will be set dynamically with real key
    verified: true,
    trustLevel: 2, // Connected (has CommEazy app)
    lastSeen: 0, // Unknown - presence comes from XMPP
    categories: JSON.stringify(['other']),
  },
  'sim2@commeazy.local': {
    userUuid: MOCK_UUIDS.sim2,
    jid: 'sim2@commeazy.local',
    firstName: 'Sim2',
    lastName: '(iPhone 16e)',
    phoneNumber: '+31600000003',
    email: 'sim2@commeazy.local',
    publicKey: '', // Will be set dynamically with real key
    verified: true,
    trustLevel: 2, // Connected (has CommEazy app)
    lastSeen: 0, // Unknown - presence comes from XMPP
    categories: JSON.stringify(['other']),
  },
  'simipad@commeazy.local': {
    userUuid: MOCK_UUIDS.simipad,
    jid: 'simipad@commeazy.local',
    firstName: 'SimiPad',
    lastName: '',
    mobileNumber: '+31600000005',
    email: 'simipad@commeazy.local',
    publicKey: '', // Will be set dynamically with real key
    verified: true,
    trustLevel: 2, // Connected (has CommEazy app)
    lastSeen: 0, // Unknown - presence comes from XMPP
    categories: JSON.stringify(['other']),
  },
};

// All test device JIDs
const TEST_DEVICE_JIDS = ['bert@commeazy.local', 'jeanine@commeazy.local', 'pipo@commeazy.local', 'sim1@commeazy.local', 'sim2@commeazy.local', 'simipad@commeazy.local'];

/**
 * Get test device contacts for the current user.
 * Returns all other test devices as contacts with their public keys.
 * Call AFTER encryption is initialized to get real public keys.
 */
export const getMockContactsForDevice = (currentUserJid: string, publicKeyMap?: Record<string, string>): Contact[] => {
  const contacts: Contact[] = [];

  for (const jid of TEST_DEVICE_JIDS) {
    if (jid !== currentUserJid) {
      const contactTemplate = TEST_DEVICE_CONTACTS[jid];
      if (contactTemplate) {
        contacts.push({
          ...contactTemplate,
          publicKey: publicKeyMap?.[jid] || '',
        });
      }
    }
  }

  return contacts;
};

/**
 * Empty contacts array for backward compatibility.
 * Previously contained fake personas — now only test device contacts exist.
 * @deprecated Use getMockContactsForDevice() instead
 */
export const MOCK_CONTACTS: Contact[] = [];

/**
 * Get a test device contact by JID.
 */
export const getMockContactByJid = (jid: string): Contact | undefined => {
  return TEST_DEVICE_CONTACTS[jid];
};

/**
 * Get a test device contact by chat ID.
 * Chat ID format: chat:jid1:jid2 (sorted alphabetically)
 */
export const getMockContactByChatId = (chatId: string): Contact | undefined => {
  if (chatId.startsWith('chat:')) {
    const parts = chatId.split(':');
    if (parts.length === 3) {
      const [_, jid1, jid2] = parts;
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
