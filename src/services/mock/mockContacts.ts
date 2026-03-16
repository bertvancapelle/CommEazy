/**
 * Test Device Contacts Data
 *
 * Contacts for multi-device development testing.
 * Only loaded in __DEV__ mode.
 *
 * PRIVACY ARCHITECTURE: JIDs are UUID-based (production-parity).
 * Names, emails, phone numbers are PROFILE DATA — no PII in JIDs.
 *
 * Test device mapping (UUID → Device):
 * - e5f6a7b8-c9d0-4e5f-2a6b-3c4d5e6f7a8b → iPhone 14 (physical, Bert)
 * - b8c9d0e1-f2a3-4b8c-5d9e-6f7a8b9c0d1e → iPhone 12 (physical, Jeanine)
 * - d0e1f2a3-b4c5-4d0e-7f1a-8b9c0d1e2f3a → iPad (physical, Pipo)
 * - f6a7b8c9-d0e1-4f6a-3b7c-4d5e6f7a8b9c → iPhone 17 Pro (simulator)
 * - a7b8c9d0-e1f2-4a7b-4c8d-5e6f7a8b9c0d → iPhone 16e (simulator)
 * - c9d0e1f2-a3b4-4c9d-6e0f-7a8b9c0d1e2f → iPad (simulator)
 */

import type { Contact, PresenceShow } from '../interfaces';

// ============================================================
// UUID-based JIDs (production-parity)
// JID = <uuid>@commeazy.local — NO PII in identifiers
// ============================================================
const DOMAIN = 'commeazy.local';

// Stable UUIDs — these are BOTH the userUuid AND the JID local-part
export const MOCK_UUIDS = {
  bert: 'e5f6a7b8-c9d0-4e5f-2a6b-3c4d5e6f7a8b',
  jeanine: 'b8c9d0e1-f2a3-4b8c-5d9e-6f7a8b9c0d1e',
  pipo: 'd0e1f2a3-b4c5-4d0e-7f1a-8b9c0d1e2f3a',
  sim1: 'f6a7b8c9-d0e1-4f6a-3b7c-4d5e6f7a8b9c',
  sim2: 'a7b8c9d0-e1f2-4a7b-4c8d-5e6f7a8b9c0d',
  simipad: 'c9d0e1f2-a3b4-4c9d-6e0f-7a8b9c0d1e2f',
};

// JID helpers — single source of truth
export const MOCK_JIDS = {
  bert: `${MOCK_UUIDS.bert}@${DOMAIN}`,
  jeanine: `${MOCK_UUIDS.jeanine}@${DOMAIN}`,
  pipo: `${MOCK_UUIDS.pipo}@${DOMAIN}`,
  sim1: `${MOCK_UUIDS.sim1}@${DOMAIN}`,
  sim2: `${MOCK_UUIDS.sim2}@${DOMAIN}`,
  simipad: `${MOCK_UUIDS.simipad}@${DOMAIN}`,
};

// Test device contacts — each device sees all other test devices as contacts
// lastSeen is set to 0 (unknown) — real presence comes from XMPP subscription
const TEST_DEVICE_CONTACTS: Record<string, Contact> = {
  [MOCK_JIDS.bert]: {
    userUuid: MOCK_UUIDS.bert,
    jid: MOCK_JIDS.bert,
    firstName: 'Bert',
    lastName: '',
    phoneNumber: '+31201234567',
    mobileNumber: '+31600000001',
    email: 'bert@example.com',
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
  [MOCK_JIDS.jeanine]: {
    userUuid: MOCK_UUIDS.jeanine,
    jid: MOCK_JIDS.jeanine,
    firstName: 'Jeanine',
    lastName: '',
    mobileNumber: '+31600000004',
    email: 'jeanine@example.com',
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
  [MOCK_JIDS.pipo]: {
    userUuid: MOCK_UUIDS.pipo,
    jid: MOCK_JIDS.pipo,
    firstName: 'Pipo',
    lastName: '',
    mobileNumber: '+31600000006',
    email: 'pipo@example.com',
    publicKey: '', // Will be set dynamically with real key
    verified: true,
    trustLevel: 2, // Connected (has CommEazy app)
    lastSeen: 0, // Unknown - presence comes from XMPP
    categories: JSON.stringify(['family']),
  },
  [MOCK_JIDS.sim1]: {
    userUuid: MOCK_UUIDS.sim1,
    jid: MOCK_JIDS.sim1,
    firstName: 'Sim1',
    lastName: '(iPhone 17 Pro)',
    phoneNumber: '+31207654321',
    mobileNumber: '+31600000002',
    email: 'sim1@example.com',
    publicKey: '', // Will be set dynamically with real key
    verified: true,
    trustLevel: 2, // Connected (has CommEazy app)
    lastSeen: 0, // Unknown - presence comes from XMPP
    categories: JSON.stringify(['other']),
  },
  [MOCK_JIDS.sim2]: {
    userUuid: MOCK_UUIDS.sim2,
    jid: MOCK_JIDS.sim2,
    firstName: 'Sim2',
    lastName: '(iPhone 16e)',
    phoneNumber: '+31600000003',
    email: 'sim2@example.com',
    publicKey: '', // Will be set dynamically with real key
    verified: true,
    trustLevel: 2, // Connected (has CommEazy app)
    lastSeen: 0, // Unknown - presence comes from XMPP
    categories: JSON.stringify(['other']),
  },
  [MOCK_JIDS.simipad]: {
    userUuid: MOCK_UUIDS.simipad,
    jid: MOCK_JIDS.simipad,
    firstName: 'SimiPad',
    lastName: '',
    mobileNumber: '+31600000005',
    email: 'simipad@example.com',
    publicKey: '', // Will be set dynamically with real key
    verified: true,
    trustLevel: 2, // Connected (has CommEazy app)
    lastSeen: 0, // Unknown - presence comes from XMPP
    categories: JSON.stringify(['other']),
  },
};

// All test device JIDs (UUID-based)
const TEST_DEVICE_JIDS = [
  MOCK_JIDS.bert,
  MOCK_JIDS.jeanine,
  MOCK_JIDS.pipo,
  MOCK_JIDS.sim1,
  MOCK_JIDS.sim2,
  MOCK_JIDS.simipad,
];

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
 *
 * Note: UUID-based JIDs contain hyphens but no colons,
 * so splitting on ':' still yields exactly 3 parts.
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
