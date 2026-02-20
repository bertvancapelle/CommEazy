/**
 * Development Tools
 *
 * Utilities for development mode only.
 * Controls mock data seeding, debug UI toggles, and testing helpers.
 *
 * IMPORTANT: All exports are no-ops in production.
 * Only active when __DEV__ is true.
 */

import { MOCK_CONTACTS, MOCK_CHAT_IDS, getMockContactsForDevice } from './mockContacts';
import { MOCK_MESSAGES, MOCK_CURRENT_USER } from './mockChats';
// Note: chatService is imported lazily in seedMockData to avoid circular dependency
import {
  generateMockMyQRData,
  generateMockContactQRData,
  generateMockDeviceLinkQR,
  verifyMockQRData,
  verifyMockDeviceLinkQR,
  getTestQRCodeForScanning,
} from './mockEncryption';
import type { Contact, Message, DatabaseService, UserProfile } from '../interfaces';
import uuid from 'react-native-uuid';
import { USE_PLAINTEXT_MODE, logDevConfig } from '@/config/devConfig';

// ============================================================
// Dev Mode State
// ============================================================

interface DevToolsState {
  mockDataSeeded: boolean;
  simulateOffline: boolean;
  simulateSlowNetwork: boolean;
  showDevUI: boolean;
  logXMPPMessages: boolean;
  logEncryption: boolean;
  plaintextMode: boolean; // Bypass encryption for 2-device testing
}

// Initialize devState - plaintextMode is now controlled by devConfig.ts
let devState: DevToolsState = {
  mockDataSeeded: false,
  simulateOffline: false,
  simulateSlowNetwork: false,
  showDevUI: true, // Always show in dev
  logXMPPMessages: false,
  logEncryption: false,
  plaintextMode: USE_PLAINTEXT_MODE, // Controlled by devConfig.ts
};

// Log initial state and config
console.log('[DevTools] Initial devState.plaintextMode:', devState.plaintextMode);
logDevConfig();

// ============================================================
// Mock Data Seeding
// ============================================================

/**
 * Seed or update user profile with device-specific credentials.
 * This ensures the profile name matches the dev mode account.
 */
const seedUserProfile = async (
  db: DatabaseService,
  jid: string,
  name: string
): Promise<void> => {
  try {
    const existingProfile = await db.getUserProfile();

    if (existingProfile) {
      // Profile exists - update name and jid if they don't match
      if (existingProfile.name !== name || existingProfile.jid !== jid) {
        console.log(`[seedMockData] Updating user profile: ${existingProfile.name} → ${name}`);
        await db.saveUserProfile({
          ...existingProfile,
          jid,
          name,
        });
      } else {
        console.log(`[seedMockData] User profile already correct: ${name}`);
      }
    } else {
      // No profile - create new one with device credentials
      console.log(`[seedMockData] Creating new user profile: ${name}`);
      const newProfile: UserProfile = {
        userUuid: uuid.v4() as string,
        jid,
        name,
        phoneNumber: '+31612345678', // Dev phone number
        publicKey: '', // Will be set by encryption service
        language: 'nl',
        audioFeedbackEnabled: true,
        hapticFeedbackEnabled: true,
        subscriptionTier: 'free',
      };
      await db.saveUserProfile(newProfile);
    }
  } catch (error) {
    console.error('[seedMockData] Failed to seed user profile:', error);
  }
};

/**
 * Seed the database with mock contacts, messages, and user profile.
 * Call this during app initialization in __DEV__ mode.
 *
 * Uses upsert behavior - skips records that already exist to handle hot reload.
 *
 * @param db - The DatabaseService instance
 * @param force - Force re-seeding even if already seeded (will skip duplicates anyway)
 */
export const seedMockData = async (
  db: DatabaseService,
  force = false
): Promise<void> => {
  if (!__DEV__) {
    console.warn('seedMockData: Skipped (not in dev mode)');
    return;
  }

  if (devState.mockDataSeeded && !force) {
    console.log('seedMockData: Already seeded this session, skipping');
    return;
  }

  console.log('seedMockData: Seeding mock contacts and messages...');

  try {
    // Get device-specific contacts (includes the other test device as a contact)
    // Import chatService lazily to avoid circular dependency at module load time
    const { chatService } = await import('../chat');
    const { getOtherDevicesPublicKeys } = await import('./testKeys');
    const currentUserJid = chatService.getMyJid();
    const currentUserName = chatService.getMyName();

    // Get public keys for other test devices
    const publicKeyMap = currentUserJid
      ? await getOtherDevicesPublicKeys(currentUserJid)
      : {};

    const contactsToSeed = currentUserJid
      ? getMockContactsForDevice(currentUserJid, publicKeyMap)
      : MOCK_CONTACTS;

    // Seed user profile with device credentials
    if (currentUserJid && currentUserName) {
      await seedUserProfile(db, currentUserJid, currentUserName);
    }

    console.log(`[seedMockData] Current user: ${currentUserJid ?? 'unknown'}`);
    console.log(`[seedMockData] MOCK_MESSAGES keys:`, Object.keys(MOCK_MESSAGES));
    console.log(`  Contacts to seed: ${contactsToSeed.length}`);

    // Seed contacts (skip if already exists)
    for (const contact of contactsToSeed) {
      try {
        const existing = await db.getContact(contact.jid);
        if (!existing) {
          await db.saveContact(contact);
          console.log(`  + Contact: ${contact.name}`);
        } else {
          console.log(`  = Contact: ${contact.name} (exists)`);
        }
      } catch {
        // Contact doesn't exist, save it
        await db.saveContact(contact);
        console.log(`  + Contact: ${contact.name}`);
      }
    }

    // Seed messages for each chat (skip if already exists)
    for (const [chatId, messages] of Object.entries(MOCK_MESSAGES)) {
      let addedCount = 0;
      let existingCount = 0;

      for (const message of messages) {
        try {
          // Check if message exists by trying to get messages for this chat
          // and checking if our ID is in there
          const existingMsgs = await db.getMessages(chatId, 100);
          const exists = existingMsgs.some(m => m.id === message.id);

          if (!exists) {
            await db.saveMessage(message);
            addedCount++;
          } else {
            existingCount++;
          }
        } catch {
          // Error checking, try to save anyway
          try {
            await db.saveMessage(message);
            addedCount++;
          } catch (saveError: any) {
            // UNIQUE constraint = already exists, skip
            if (saveError?.message?.includes('UNIQUE constraint')) {
              existingCount++;
            } else {
              throw saveError;
            }
          }
        }
      }

      if (addedCount > 0) {
        console.log(`  + Chat ${chatId}: ${addedCount} messages added`);
      }
      if (existingCount > 0) {
        console.log(`  = Chat ${chatId}: ${existingCount} messages exist`);
      }
    }

    devState.mockDataSeeded = true;
    console.log('seedMockData: Complete!');
  } catch (error) {
    console.error('seedMockData: Error seeding data:', error);
    throw error;
  }
};

/**
 * Clear all mock data from the database.
 * Useful for testing fresh states.
 */
export const clearMockData = async (db: DatabaseService): Promise<void> => {
  if (!__DEV__) return;

  console.log('clearMockData: Clearing all mock data...');

  try {
    // Delete mock contacts
    for (const contact of MOCK_CONTACTS) {
      await db.deleteContact(contact.jid);
    }

    // Delete mock messages
    for (const messages of Object.values(MOCK_MESSAGES)) {
      for (const message of messages) {
        try {
          await db.deleteMessage(message.id);
        } catch {
          // Ignore if message doesn't exist
        }
      }
    }

    devState.mockDataSeeded = false;
    console.log('clearMockData: Complete!');
  } catch (error) {
    console.error('clearMockData: Error clearing data:', error);
  }
};

// ============================================================
// Dev UI Toggle
// ============================================================

/**
 * Check if dev UI should be shown
 */
export const isDevUIEnabled = (): boolean => {
  return __DEV__ && devState.showDevUI;
};

/**
 * Toggle dev UI visibility
 */
export const toggleDevUI = (enabled?: boolean): void => {
  if (!__DEV__) return;
  devState.showDevUI = enabled ?? !devState.showDevUI;
};

// ============================================================
// Network Simulation
// ============================================================

/**
 * Simulate offline mode for testing error states
 */
export const setSimulateOffline = (offline: boolean): void => {
  if (!__DEV__) return;
  devState.simulateOffline = offline;
  console.log(`DevTools: Simulating ${offline ? 'OFFLINE' : 'ONLINE'} mode`);
};

export const isSimulatingOffline = (): boolean => {
  return __DEV__ && devState.simulateOffline;
};

/**
 * Simulate slow network for testing loading states
 */
export const setSimulateSlowNetwork = (slow: boolean): void => {
  if (!__DEV__) return;
  devState.simulateSlowNetwork = slow;
  console.log(`DevTools: Simulating ${slow ? 'SLOW' : 'NORMAL'} network`);
};

export const isSimulatingSlowNetwork = (): boolean => {
  return __DEV__ && devState.simulateSlowNetwork;
};

/**
 * Add artificial delay for slow network simulation
 */
export const maybeAddNetworkDelay = async (): Promise<void> => {
  if (isSimulatingSlowNetwork()) {
    const delay = 1000 + Math.random() * 2000; // 1-3 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
  }
};

// ============================================================
// Debug Logging
// ============================================================

export const setLogXMPP = (enabled: boolean): void => {
  if (!__DEV__) return;
  devState.logXMPPMessages = enabled;
};

export const setLogEncryption = (enabled: boolean): void => {
  if (!__DEV__) return;
  devState.logEncryption = enabled;
};

// ============================================================
// Plaintext Mode (for 2-device testing without key exchange)
// ============================================================

/**
 * Enable/disable plaintext mode for testing.
 * When enabled, messages are sent as plain text without encryption.
 * This allows testing messaging between devices without key exchange.
 */
export const setPlaintextMode = (enabled: boolean): void => {
  if (!__DEV__) return;
  devState.plaintextMode = enabled;
  console.log(`DevTools: Plaintext mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
};

export const isPlaintextMode = (): boolean => {
  const result = __DEV__ && devState.plaintextMode;
  console.log(`[DevTools] isPlaintextMode() called: __DEV__=${__DEV__}, devState.plaintextMode=${devState.plaintextMode}, result=${result}`);
  return result;
};

export const devLog = (category: 'xmpp' | 'encryption' | 'general', ...args: unknown[]): void => {
  if (!__DEV__) return;

  const shouldLog =
    category === 'general' ||
    (category === 'xmpp' && devState.logXMPPMessages) ||
    (category === 'encryption' && devState.logEncryption);

  if (shouldLog) {
    console.log(`[DEV:${category.toUpperCase()}]`, ...args);
  }
};

// ============================================================
// Mock QR Scanner Helpers
// ============================================================

/**
 * Simulate scanning a QR code in development.
 * Useful for testing on simulator without camera.
 */
export const simulateQRScan = (
  scenario: 'success' | 'unverified' | 'expired' | 'invalid' | 'device_link'
): {
  qrData: string;
  verification: ReturnType<typeof verifyMockQRData> | ReturnType<typeof verifyMockDeviceLinkQR>;
} => {
  if (!__DEV__) {
    return { qrData: '', verification: { success: false, error: 'Not in dev mode' } };
  }

  const qrData = getTestQRCodeForScanning(scenario);
  const verification =
    scenario === 'device_link'
      ? verifyMockDeviceLinkQR(qrData)
      : verifyMockQRData(qrData);

  return { qrData, verification };
};

// ============================================================
// Export all mock data for direct access in dev tools UI
// ============================================================

export const DevMockData = __DEV__
  ? {
      contacts: MOCK_CONTACTS,
      chatIds: MOCK_CHAT_IDS,
      messages: MOCK_MESSAGES,
      currentUser: MOCK_CURRENT_USER,
      qr: {
        generateMyQR: generateMockMyQRData,
        generateContactQR: generateMockContactQRData,
        generateDeviceLinkQR: generateMockDeviceLinkQR,
        verifyQR: verifyMockQRData,
        verifyDeviceLinkQR: verifyMockDeviceLinkQR,
        testScenarios: getTestQRCodeForScanning,
      },
    }
  : null;

// ============================================================
// Dev Tools Summary (for console output)
// ============================================================

export const printDevToolsStatus = (): void => {
  if (!__DEV__) return;

  console.log('\n====== CommEazy DevTools Status ======');
  console.log(`  Mock data seeded: ${devState.mockDataSeeded}`);
  console.log(`  Simulate offline: ${devState.simulateOffline}`);
  console.log(`  Simulate slow network: ${devState.simulateSlowNetwork}`);
  console.log(`  Show dev UI: ${devState.showDevUI}`);
  console.log(`  Log XMPP: ${devState.logXMPPMessages}`);
  console.log(`  Log encryption: ${devState.logEncryption}`);
  console.log('');
  console.log('  Mock contacts:', MOCK_CONTACTS.length);
  console.log('  Mock chats:', Object.keys(MOCK_MESSAGES).length);
  console.log('=======================================\n');
};
