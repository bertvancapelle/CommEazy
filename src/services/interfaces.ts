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

  // Call sound settings
  ringtoneEnabled?: boolean;             // Play ringtone for incoming calls (default: true)
  ringtoneSound?: string;                // Selected ringtone: 'default' | 'classic' | 'gentle' | 'urgent'
  dialToneEnabled?: boolean;             // Play dial tone when calling (default: true)
  incomingCallVibration?: boolean;       // Vibrate on incoming call (default: true)
  outgoingCallVibration?: boolean;       // Vibrate on outgoing call feedback (default: false)

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
// CallService — WebRTC P2P Video/Voice Calling
// Implementation: WebRTCCallService
// ============================================================

/**
 * Call types
 * - voice: Audio-only call (microphone)
 * - video: Audio + video call (microphone + camera)
 */
export type CallType = 'voice' | 'video';

/**
 * Call direction
 * - incoming: Call received from another user
 * - outgoing: Call initiated by local user
 */
export type CallDirection = 'incoming' | 'outgoing';

/**
 * Call state machine
 *
 * Outgoing call flow:
 *   idle → ringing → connecting → connected → ended
 *         ↓
 *         → ended (if declined/timeout)
 *
 * Incoming call flow:
 *   idle → ringing → connecting → connected → ended
 *         ↓
 *         → ended (if declined)
 */
export type CallState =
  | 'idle'           // No active call
  | 'ringing'        // Outgoing: waiting for answer, Incoming: showing incoming UI
  | 'connecting'     // ICE negotiation in progress
  | 'connected'      // Call active, media flowing
  | 'reconnecting'   // Temporary connection loss, attempting recovery
  | 'ended';         // Call terminated

/**
 * Reason why a call ended
 */
export type CallEndReason =
  | 'hangup'         // Local or remote user hung up
  | 'declined'       // Remote declined incoming call
  | 'timeout'        // No answer within 30s
  | 'busy'           // Remote is in another call
  | 'failed'         // ICE/network connection failed
  | 'error';         // Unexpected error

/**
 * A participant in a call (1-on-1 or 3-way)
 */
export interface CallParticipant {
  jid: string;
  name: string;
  isMuted: boolean;
  isVideoEnabled: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected';
}

/**
 * Active call information
 * Used for UI state and call management
 */
export interface ActiveCall {
  id: string;                           // Unique call ID (UUID)
  type: CallType;                       // voice or video
  direction: CallDirection;             // incoming or outgoing
  state: CallState;                     // Current call state
  participants: CallParticipant[];      // All participants (including self for 3-way)
  startTime?: number;                   // Timestamp when connected (undefined if not yet)
  duration: number;                     // Call duration in seconds (0 if not connected)
  isMuted: boolean;                     // Local microphone muted
  isSpeakerOn: boolean;                 // Speaker mode (vs earpiece)
  isVideoEnabled: boolean;              // Local camera enabled
  isFrontCamera: boolean;               // Front or back camera
}

/**
 * WebRTC ICE server configuration
 * STUN for NAT discovery, TURN for relay fallback
 */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * CallService Interface
 *
 * Provides WebRTC-based P2P video/voice calling with:
 * - 1-on-1 calls (single PeerConnection)
 * - 3-way mesh calls (N-1 PeerConnections per user, max 3 participants)
 *
 * Signaling is handled via XMPP (XMPPService).
 * All media processing is on-device (privacy-first).
 *
 * @example
 * ```typescript
 * // Initiate a video call
 * const callId = await callService.initiateCall('oma@commeazy.local', 'video');
 *
 * // Listen for incoming calls
 * callService.onIncomingCall((call) => {
 *   // Show incoming call UI
 *   navigation.navigate('IncomingCall', { callId: call.id });
 * });
 *
 * // Answer an incoming call
 * await callService.answerCall(callId);
 *
 * // Add a third participant (mesh call)
 * if (callService.canAddParticipant(callId)) {
 *   await callService.addParticipant(callId, 'test@commeazy.local');
 * }
 * ```
 */
export interface CallService {
  // ============================================================
  // Lifecycle
  // ============================================================

  /**
   * Initialize the call service
   * Sets up WebRTC, requests permissions, configures ICE servers
   */
  initialize(iceServers: IceServer[]): Promise<void>;

  /**
   * Clean up resources (call this on app terminate)
   */
  cleanup(): Promise<void>;

  // ============================================================
  // Call Management
  // ============================================================

  /**
   * Initiate an outgoing call
   * @param contactJid - The JID of the contact to call
   * @param type - 'voice' or 'video'
   * @returns The unique call ID
   * @throws AppError if contact is offline or permission denied
   */
  initiateCall(contactJid: string, type: CallType): Promise<string>;

  /**
   * Answer an incoming call
   * @param callId - The call ID from onIncomingCall
   */
  answerCall(callId: string): Promise<void>;

  /**
   * Decline an incoming call
   * @param callId - The call ID to decline
   */
  declineCall(callId: string): Promise<void>;

  /**
   * End the current call
   * @param callId - The call ID to end
   */
  endCall(callId: string): Promise<void>;

  // ============================================================
  // 3-Way Mesh Calls
  // ============================================================

  /**
   * Add a participant to an existing call (max 3 total)
   * Creates a new PeerConnection for the mesh
   * @param callId - The current call ID
   * @param contactJid - The JID of the participant to add
   * @throws AppError if call has 3 participants already
   */
  addParticipant(callId: string, contactJid: string): Promise<void>;

  /**
   * Remove a participant from a mesh call
   * @param callId - The current call ID
   * @param contactJid - The JID of the participant to remove
   */
  removeParticipant(callId: string, contactJid: string): Promise<void>;

  /**
   * Check if another participant can be added (max 3)
   * @param callId - The current call ID
   * @returns true if current participants < 3
   */
  canAddParticipant(callId: string): boolean;

  // ============================================================
  // Local Controls
  // ============================================================

  /** Toggle local microphone mute */
  toggleMute(): void;

  /** Toggle speaker mode (speaker vs earpiece) */
  toggleSpeaker(): void;

  /** Toggle local camera (video calls only) */
  toggleVideo(): void;

  /** Switch between front and back camera */
  switchCamera(): void;

  // ============================================================
  // State & Observables
  // ============================================================

  /**
   * Get the current active call (if any)
   * @returns ActiveCall or null if no call
   */
  getActiveCall(): ActiveCall | null;

  /**
   * Observe call state changes
   * Emits whenever the active call changes (state, participants, controls)
   */
  observeCallState(): Observable<ActiveCall | null>;

  // ============================================================
  // Event Handlers
  // ============================================================

  /**
   * Register handler for incoming calls
   * Called when a remote user initiates a call to this device
   * @param handler - Receives the incoming ActiveCall
   * @returns Unsubscribe function
   */
  onIncomingCall(handler: (call: ActiveCall) => void): Unsubscribe;

  /**
   * Register handler for call ended events
   * Called when a call ends (local or remote hangup, failure, etc.)
   * @param handler - Receives callId and reason
   * @returns Unsubscribe function
   */
  onCallEnded(handler: (callId: string, reason: CallEndReason) => void): Unsubscribe;
}

// ============================================================
// Error Types
// ============================================================

export type ErrorCategory = 'network' | 'encryption' | 'delivery' | 'media' | 'auth' | 'storage' | 'call';

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
