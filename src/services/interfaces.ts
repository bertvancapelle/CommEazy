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
export type SupportedLanguage = 'nl' | 'en' | 'de' | 'fr' | 'es';
export type Unsubscribe = () => void;

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
  jid: string;
  name: string;
  phoneNumber: string;
  publicKey: string;         // Base64
  verified: boolean;         // QR verified
  lastSeen: number;
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
  jid: string;
  name: string;
  phoneNumber: string;
  publicKey: string;
  language: SupportedLanguage;
  audioFeedbackEnabled: boolean;
  hapticFeedbackEnabled: boolean;
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

  // Outbox (7-day retention)
  saveOutboxMessage(msg: Omit<OutboxMessage, 'id'>): Promise<OutboxMessage>;
  getOutboxForRecipient(jid: string): Promise<OutboxMessage[]>;
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

  // MUC (Group Chat)
  joinMUC(roomJid: string, nickname: string): Promise<void>;
  leaveMUC(roomJid: string): Promise<void>;
  sendMUCMessage(roomJid: string, payload: EncryptedPayload, messageId: string): Promise<void>;

  // Event handlers
  onMessage(handler: (from: string, payload: EncryptedPayload, id: string) => void): Unsubscribe;
  onPresence(handler: (from: string, status: 'online' | 'offline') => void): Unsubscribe;
  onDeliveryReceipt(handler: (messageId: string, from: string) => void): Unsubscribe;
}

// ============================================================
// NotificationService
// ============================================================

export interface NotificationService {
  initialize(): Promise<void>;
  getToken(): Promise<string>;
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
