/**
 * Mock Data Module - Barrel Export
 *
 * Central export point for test device fixture data and dev tools.
 * Only active in __DEV__ mode.
 *
 * Usage:
 *   import { seedMockData, getMockContactsForDevice } from '@/services/mock';
 *
 *   // In App.tsx during initialization:
 *   if (__DEV__) {
 *     await seedMockData(ServiceContainer.database);
 *   }
 */

// Test Device Contacts
export {
  MOCK_CONTACTS,
  getMockContactByJid,
  getMockContactByChatId,
  getMockContactsForDevice,
  isMockContactOnline,
  getMockLastSeenText,
  getMockContactPresence,
} from './mockContacts';

// Test Device Chats & Messages
export {
  MOCK_CURRENT_USER,
  MOCK_MESSAGES,
  MOCK_MESSAGES_DEVICE_CHAT,
  DEVICE_CHAT_ID,
  getMockMessages,
  getLastMockMessage,
  getMockUnreadCount,
  getMockChatList,
} from './mockChats';

export type { MockChatListItem } from './mockChats';

// Mock Encryption & QR
export {
  generateMockMyQRData,
  generateMockContactQRData,
  generateMockDeviceLinkQR,
  verifyMockQRData,
  verifyMockDeviceLinkQR,
  getTestQRCodeForScanning,
  MOCK_TEST_QR_CODES,
} from './mockEncryption';

export type {
  MockQRCodeData,
  MockVerificationResult,
  MockDeviceLinkQRData,
  MockDeviceLinkResult,
} from './mockEncryption';

// Dev Tools
export {
  seedMockData,
  clearMockData,
  isDevUIEnabled,
  toggleDevUI,
  setSimulateOffline,
  isSimulatingOffline,
  setSimulateSlowNetwork,
  isSimulatingSlowNetwork,
  maybeAddNetworkDelay,
  setLogXMPP,
  setLogEncryption,
  setPlaintextMode,
  isPlaintextMode,
  devLog,
  simulateQRScan,
  DevMockData,
  printDevToolsStatus,
} from './devTools';

// Test Keys for E2E Encryption Testing
export {
  getIkKeypair,
  getOmaKeypair,
  getTestKeypairForJid,
  getTestPublicKeyForJid,
  getOtherDevicePublicKey,
} from './testKeys';
