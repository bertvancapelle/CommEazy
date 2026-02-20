/**
 * CommEazy Service Interfaces
 *
 * Technology-agnostic contracts for all services.
 * Implementations can be swapped (Realm ↔ WatermelonDB, Strophe ↔ xmpp.js)
 * without changing business logic.
 *
 * READ THIS FIRST — this file defines the entire service architecture.
 */

// ============================================================
// Common Types
// ============================================================

export type ContentType = 'text' | 'image' | 'video';
export type EncryptionMode = '1on1' | 'encrypt-to-all' | 'shared-key';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'expired';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';
export type SupportedLanguage = 'nl' | 'en' | 'de' | 'fr' | 'es' | 'it' | 'pl' | 'no' | 'sv' | 'da';
export type SubscriptionTier = 'free' | 'premium';
export type AgeBracket =
  | '18-24' | '25-34' | '35-44' | '45-54' | '55-64'
  | '65-69' | '70-74' | '75-79' | '80-84' | '85-89'
  | '90-94' | '95-99' | '100-104' | '105-110';
export type Gender = 'male' | 'female' | 'other';
export type Unsubscribe = () => void;

/**
 * XMPP Presence Status
 * @see XEP-0317: Presence (https://xmpp.org/rfcs/rfc6121.html#presence)
 *
 * - available: Online and available (default when no <show> element)
 * - chat: Free to chat / actively looking to chat
 * - away: Temporarily away
 * - xa: Extended away (gone for longer period)
 * - dnd: Do not disturb
 * - offline: Not connected
 */
export type PresenceShow = 'available' | 'chat' | 'away' | 'xa' | 'dnd' | 'offline';

export interface KeyPair {
  publicKey: string;   // Base64
  privateKey: string;  // Base64
}

export interface Recipient {
  jid: string;
  publicKey: Uint8Array;
}

export interface EncryptedPayload {
  mode: EncryptionMode;
  data: string;  // Base64 encoded
  metadata: Record<string, string>;
}

export interface Observable<T> {
  subscribe(observer: (value: T) => void): Unsubscribe;
}

// ============================================================
// Domain Models
// ============================================================

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;           // Decrypted content
  contentType: ContentType;
  timestamp: number;
  status: DeliveryStatus;
  isRead?: boolean;          // For unread tracking (optional, defaults based on sender)
}

export interface OutboxMessage {
  id: string;
  chatId: string;
  encryptedContent: string;  // Already encrypted — NEVER plaintext
  contentType: ContentType;
  timestamp: number;
  expiresAt: number;         // timestamp + 7 days
  pendingTo: string[];       // JIDs not yet delivered
  deliveredTo: string[];     // JIDs that ACKed
}

export interface Contact {
  userUuid: string;          // Stable identifier (never changes)
  jid: string;               // = {userUuid}@commeazy.local
  name: string;
  phoneNumber?: string;      // Optional (privacy: can be hidden after QR verify)
  publicKey: string;         // Base64
  verified: boolean;         // QR verified
  lastSeen: number;
  photoUrl?: string;         // Profile photo URL (local file or remote)
}

export interface Group {
  id: string;
  name: string;
  members: string[];         // JIDs
  createdBy: string;
  createdAt: number;
  encryptionMode: EncryptionMode;
}

export interface UserProfile {
  // Identity (UUID is stable, phone/name can change)
  userUuid: string;                      // Stable identifier, generated once at onboarding
  jid: string;                           // = {userUuid}@commeazy.local
  name: string;                          // Display name, can change
  phoneNumber: string;                   // Can change (verified via Firebase)
  publicKey: string;

  // Preferences
  language: SupportedLanguage;
  photoPath?: string;                    // Local file path to own avatar

  // Feedback settings (accessibility)
  hapticIntensity?: string;              // 'off' | 'veryLight' | 'light' | 'normal' | 'strong'
  audioFeedbackEnabled?: boolean;        // Play sound on tap (respects silent mode)
  audioFeedbackBoost?: boolean;          // Boost audio volume by 20%
  voiceCommandsEnabled?: boolean;        // Enable voice commands via two-finger long press
  voiceMicPosition?: string;             // Mic indicator position for Voice Session Mode: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  // Legacy fields (kept for backwards compatibility)
  hapticFeedbackEnabled?: boolean;

  // UI personalization
  accentColor?: string;                  // 'blue' | 'green' | 'purple' | 'orange' | 'red'

  // Subscription (freemium model)
  subscriptionTier: SubscriptionTier;    // 'free' | 'premium'
  subscriptionExpires?: number;          // Timestamp when premium expires

  // Demographics (required for free, optional for premium)
  countryCode?: string;                  // ISO 3166-1: 'NL', 'BE', 'DE'
  regionCode?: string;                   // ISO 3166-2: 'NL-NH', 'BE-VLG'
  city?: string;                         // Free text city name
  ageBracket?: AgeBracket;               // '18-24', '25-34', etc.
  gender?: Gender;                       // 'male', 'female', 'other'

  // Hold-to-Navigate settings (accessibility)
  longPressDelay?: number;               // 500-3000ms, default 1000ms
  menuButtonPositionX?: number;          // X coordinate (0-1 as percentage of screen width)
  menuButtonPositionY?: number;          // Y coordinate (0-1 as percentage of screen height)
  edgeExclusionSize?: number;            // Edge exclusion zone in pixels (0-100, default 40)
  wheelBlurIntensity?: number;           // Blur intensity for navigation wheel (0-30, default 15)
  wheelDismissMargin?: number;           // Margin for tap-outside-to-dismiss (20-100, default 50)

  // Module usage tracking (for smart navigation ordering)
  moduleUsageCounts?: { [moduleId: string]: number }; // Usage count per module
}

/**
 * Profile completeness validation result
 */
export interface ProfileCompleteness {
  isComplete: boolean;
  missingFields: ('country' | 'region' | 'city' | 'ageBracket' | 'gender')[];
}

/**
 * Validate profile completeness based on subscription tier
 * Free users must provide demographic data for ad targeting
 */
export function validateProfileCompleteness(profile: UserProfile): ProfileCompleteness {
  // Premium users: all demographic fields are optional
  if (profile.subscriptionTier === 'premium') {
    return { isComplete: true, missingFields: [] };
  }

  // Free users: demographic data is required
  const missingFields: ('country' | 'region' | 'city' | 'ageBracket' | 'gender')[] = [];

  if (!profile.countryCode) missingFields.push('country');
  if (!profile.regionCode) missingFields.push('region');
  if (!profile.city) missingFields.push('city');
  if (!profile.ageBracket) missingFields.push('ageBracket');
  if (!profile.gender) missingFields.push('gender');

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Ad targeting context (passed to ad SDK, no personal data)
 */
export interface AdTargetingContext {
  countryCode: string;
  regionCode: string;
  city: string;
  ageBracket: AgeBracket;
  language: SupportedLanguage;
}

// ============================================================
// UUID / JID Helpers
// ============================================================

/** XMPP domain for CommEazy */
export const COMMEAZY_DOMAIN = 'commeazy.local';

/**
 * Generate a JID from a user UUID.
 * Format: {uuid}@commeazy.local
 *
 * @param userUuid - The user's stable UUID (v4)
 * @returns The XMPP JID for this user
 */
export function jidFromUuid(userUuid: string): string {
  return `${userUuid}@${COMMEAZY_DOMAIN}`;
}

/**
 * Extract the UUID from a JID.
 * Format: {uuid}@commeazy.local → {uuid}
 *
 * @param jid - The XMPP JID (may include resource suffix like /mobile)
 * @returns The user UUID, or null if invalid format
 */
export function uuidFromJid(jid: string): string | null {
  // Remove resource suffix (e.g., /mobile, /desktop)
  const bareJid = jid.split('/')[0];
  const parts = bareJid.split('@');

  if (parts.length !== 2) return null;
  if (parts[1] !== COMMEAZY_DOMAIN) return null;

  return parts[0];
}

// ============================================================
// DatabaseService
// Implementations: WatermelonDBService, RealmService
// ============================================================

export interface DatabaseService {
  initialize(encryptionKey: ArrayBuffer): Promise<void>;
  close(): Promise<void>;

  // Messages
  saveMessage(msg: Message): Promise<void>;
  getMessages(chatId: string, limit: number, offset?: number): Promise<Message[]>;
  observeMessages(chatId: string, limit: number): Observable<Message[]>;
  deleteMessage(messageId: string): Promise<void>;
  updateMessageStatus(messageId: string, status: DeliveryStatus): Promise<void>;
  markMessageAsRead(messageId: string): Promise<void>;
  markAllMessagesAsRead(chatId: string): Promise<void>;
  getUnreadCount(chatId: string): Promise<number>;

  // Outbox (7-day retention)
  saveOutboxMessage(msg: Omit<OutboxMessage, 'id'>): Promise<OutboxMessage>;
  getOutboxForRecipient(jid: string): Promise<OutboxMessage[]>;
  getPendingOutbox(): Promise<OutboxMessage[]>;
  deleteOutboxMessage(messageId: string): Promise<void>;
  markDelivered(messageId: string, recipientJid: string): Promise<void>;
  getExpiredOutbox(): Promise<OutboxMessage[]>;
  cleanupExpiredOutbox(): Promise<number>;

  // Contacts
  saveContact(contact: Contact): Promise<void>;
  getContacts(): Observable<Contact[]>;
  getContact(jid: string): Promise<Contact | null>;
  deleteContact(jid: string): Promise<void>;

  // Groups
  saveGroup(group: Group): Promise<void>;
  getGroups(): Observable<Group[]>;
  getGroup(id: string): Promise<Group | null>;
  updateGroupMembers(groupId: string, members: string[]): Promise<void>;

  // User profile
  saveUserProfile(profile: UserProfile): Promise<void>;
  getUserProfile(): Promise<UserProfile | null>;
}

// ============================================================
// EncryptionService
// Implementation: SodiumEncryptionService (libsodium)
// ============================================================

export interface EncryptionService {
  initialize(): Promise<void>;

  generateKeyPair(): Promise<KeyPair>;
  getPublicKey(): Promise<string>;

  encrypt(plaintext: string | Uint8Array, recipients: Recipient[]): Promise<EncryptedPayload>;
  decrypt(payload: EncryptedPayload, senderPublicKey: Uint8Array): Promise<string>;

  generateQRData(): Promise<string>;
  verifyQRData(qrData: string, expectedPublicKey: string): boolean;

  createBackup(pin: string): Promise<EncryptedBackup>;
  restoreBackup(pin: string, backup: EncryptedBackup): Promise<KeyPair>;
}

export interface EncryptedBackup {
  salt: string;
  iv: string;
  encrypted: string;
  version: number;
}

// ============================================================
// XMPPService
// Implementations: XmppJsService, StropheService
// ============================================================

export interface XMPPService {
  connect(jid: string, password: string): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionStatus(): ConnectionStatus;
  observeConnectionStatus(): Observable<ConnectionStatus>;

  sendMessage(to: string, payload: EncryptedPayload, messageId: string): Promise<void>;
  sendDeliveryReceipt(to: string, messageId: string): Promise<void>;
  sendPresence(show?: 'chat' | 'away' | 'xa' | 'dnd'): Promise<void>;
  sendUnavailable(): Promise<void>;
  subscribeToPresence(contactJid: string): Promise<void>;
  probePresence(contactJid: string): Promise<void>;

  // MUC (Group Chat)
  joinMUC(roomJid: string, nickname: string): Promise<void>;
  leaveMUC(roomJid: string): Promise<void>;
  sendMUCMessage(roomJid: string, payload: EncryptedPayload, messageId: string): Promise<void>;

  // Push Notifications (XEP-0357)
  enablePushNotifications(fcmToken: string, apnsToken?: string): Promise<void>;
  disablePushNotifications(): Promise<void>;

  // Event handlers
  onMessage(handler: (from: string, payload: EncryptedPayload, id: string) => void): Unsubscribe;
  onPresence(handler: (from: string, show: PresenceShow) => void): Unsubscribe;
  onDeliveryReceipt(handler: (messageId: string, from: string) => void): Unsubscribe;
}

// ============================================================
// NotificationService
// ============================================================

export interface NotificationService {
  initialize(): Promise<void>;
  getToken(): Promise<string>;
  getApnsToken?(): Promise<string | null>;
  onNotification(handler: (data: NotificationData) => void): Unsubscribe;
}

export interface NotificationData {
  type: 'message' | 'call' | 'group_invite';
  chatId: string;
  senderJid: string;
  senderName: string;
}

// ============================================================
// Error Types
// ============================================================

export type ErrorCategory = 'network' | 'encryption' | 'delivery' | 'media' | 'auth' | 'storage';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly category: ErrorCategory,
    public readonly recovery: () => void,
    public readonly context?: Record<string, string>,
  ) {
    super(`[${code}] ${category}`);
    this.name = 'AppError';
  }
}
