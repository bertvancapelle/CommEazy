/**
 * Mail Module Types
 *
 * Type definitions for the mail module (IMAP/SMTP).
 * Types align with native MailModule.swift return values.
 *
 * @see ios/MailModule.swift
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 5, 6, 7
 */

// ============================================================
// Server Configuration
// ============================================================

/**
 * IMAP server connection configuration
 */
export interface IMAPConfig {
  /** IMAP server hostname */
  host: string;

  /** IMAP server port (993 for SSL, 143 for STARTTLS) */
  port: number;

  /** Security method — determined by port on native side */
  security: 'SSL' | 'TLS' | 'STARTTLS' | 'NONE';

  /** Email address or username */
  username: string;

  /** Password for password-based authentication */
  password?: string;

  /** OAuth2 access token for XOAUTH2 authentication */
  accessToken?: string;
}

/**
 * SMTP server connection configuration
 */
export interface SMTPConfig {
  /** SMTP server hostname */
  host: string;

  /** SMTP server port (465 for SSL, 587 for STARTTLS) */
  port: number;

  /** Security method */
  security: 'SSL' | 'TLS' | 'STARTTLS' | 'NONE';

  /** Email address or username */
  username: string;

  /** Password for password-based authentication */
  password?: string;

  /** OAuth2 access token for XOAUTH2 authentication */
  accessToken?: string;
}

// ============================================================
// Mail Data Types
// ============================================================

/**
 * Mailbox (folder) information from the IMAP server.
 *
 * Native return: { name: string, delimiter: string }
 */
export interface MailboxInfo {
  /** Mailbox name (e.g., "INBOX", "Sent", "Drafts") */
  name: string;

  /** Hierarchy delimiter (e.g., "/" or ".") */
  delimiter: string;
}

/**
 * Email header as returned by native fetchHeaders.
 *
 * Note: Native MailModule returns `from` as a plain string (SwiftMail's
 * MessageInfo.from is String?) and `to` as string array (MessageInfo.to
 * is [String]). Structured EmailAddress parsing happens on the TS side.
 */
export interface MailHeader {
  /** Message UID from server */
  uid: number;

  /** Sequence number in mailbox */
  sequenceNumber: number;

  /** Sender as plain string (e.g., "Name <email@example.com>") */
  from: string;

  /** Recipients as string array */
  to: string[];

  /** Email subject */
  subject: string;

  /** ISO 8601 date string */
  date: string;

  /** Whether the message has attachments */
  hasAttachment: boolean;

  /** Whether the message has been read (\\Seen flag) */
  isRead: boolean;

  /** Whether the message is flagged (\\Flagged) */
  isFlagged: boolean;
}

/**
 * Email body as returned by native fetchMessageBody.
 */
export interface MailBody {
  /** HTML body content (if available) */
  html?: string;

  /** Plain text body content (if available) */
  plainText?: string;

  /** Attachment metadata list */
  attachments: MailAttachmentMeta[];
}

/**
 * Attachment metadata (without actual data).
 * Returned as part of fetchMessageBody result.
 */
export interface MailAttachmentMeta {
  /** Part index within the message */
  index: number;

  /** File name */
  name: string;

  /** Approximate size in bytes */
  size: number;

  /** MIME type (e.g., "image/jpeg", "application/pdf") */
  mimeType: string;
}

/**
 * Attachment data as returned by native fetchAttachmentData.
 */
export interface AttachmentData {
  /** Base64-encoded file data (for small attachments) */
  base64?: string;

  /** Local file path (for large attachments saved to disk) */
  filePath?: string;

  /** MIME type */
  mimeType: string;

  /** File name */
  fileName: string;

  /** File size in bytes */
  fileSize: number;
}

/**
 * Parsed email address with optional display name.
 * Used on the TS side after parsing the raw string from native.
 */
export interface EmailAddress {
  /** Display name (optional) */
  name?: string;

  /** Email address */
  address: string;
}

// ============================================================
// Compose / Send Types
// ============================================================

/**
 * Mail recipient for compose screen.
 */
export interface MailRecipient {
  /** Contact ID (if from local contacts) */
  id?: string;

  /** Display name */
  name?: string;

  /** Email address */
  email: string;

  /** Avatar URI */
  avatarUri?: string;

  /** Whether this recipient comes from local contacts */
  isFromContacts: boolean;
}

/**
 * Attachment for compose (before sending).
 */
export interface MailAttachment {
  /** Unique attachment ID */
  id: string;

  /** Source asset ID (e.g., from photo library) */
  sourceId?: string;

  /** Local file URI */
  localUri: string;

  /** Thumbnail URI (for images/video) */
  thumbnailUri?: string;

  /** File name */
  fileName: string;

  /** MIME type */
  mimeType: string;

  /** Original file size in bytes */
  fileSize: number;

  /** Compressed file size (if compressed) */
  compressedSize?: number;

  /** Whether this is a video attachment */
  isVideo: boolean;

  /** Video duration in seconds */
  duration?: number;

  /** Compression status */
  compressionStatus: 'none' | 'pending' | 'done' | 'failed';
}

// ============================================================
// Connection Test Result
// ============================================================

/**
 * Result from native testConnection method.
 */
export interface ConnectionTestResult {
  /** Whether IMAP connection was successful */
  imapSuccess: boolean;

  /** Whether SMTP connection was successful */
  smtpSuccess: boolean;

  /** Number of messages in INBOX (if IMAP succeeded) */
  inboxCount: number;
}

// ============================================================
// Attachment Progress Event
// ============================================================

/**
 * Attachment download progress event payload.
 * Emitted by native MailModule via NativeEventEmitter.
 */
export interface MailAttachmentProgress {
  /** Message UID */
  uid: number;

  /** Part index of the attachment */
  partIndex: number;

  /** Download progress (0-1) */
  progress: number;

  /** Download status */
  status: 'downloading' | 'completed' | 'failed';
}

// ============================================================
// Cache / Search Types
// ============================================================

/**
 * Cached mail header (stored in local SQLite).
 * Extends MailHeader with cache-specific fields.
 */
export interface CachedMailHeader extends MailHeader {
  /** Account identifier for multi-account support */
  accountId: string;

  /** Folder name where the message lives */
  folder: string;

  /** Parsed sender name (extracted from `from` string) */
  fromName?: string;

  /** Parsed sender email (extracted from `from` string) */
  fromAddress?: string;

  /** Whether this is a locally-composed draft not yet synced */
  isLocal: boolean;
}

/**
 * Cached mail body (stored in local SQLite).
 */
export interface CachedMailBody {
  /** Message UID */
  uid: number;

  /** Account identifier */
  accountId: string;

  /** HTML body content */
  html?: string;

  /** Plain text body content */
  plainText?: string;
}

/**
 * Search result combining local and remote results.
 */
export interface MailSearchResult {
  /** Message UID */
  uid: number;

  /** Source of the result */
  source: 'local' | 'server_only';

  /** Header data (available for local results) */
  header?: CachedMailHeader;
}

// ============================================================
// Sync State
// ============================================================

/**
 * Sync state persisted in AsyncStorage.
 */
export interface MailSyncState {
  /** Account identifier */
  accountId: string;

  /** Folder name */
  folder: string;

  /** Highest UID synced (for incremental sync) */
  highestUid: number;

  /** Lowest UID synced (sync boundary) */
  lowestUid: number;

  /** ISO 8601 timestamp of last sync */
  lastSyncAt: string;
}

// ============================================================
// Error Types
// ============================================================

/**
 * Mail error codes matching native MailModule.swift MailError enum.
 */
export type MailErrorCode =
  | 'AUTH_FAILED'
  | 'CONNECTION_FAILED'
  | 'TIMEOUT'
  | 'INVALID_CREDENTIALS'
  | 'CERTIFICATE_ERROR'
  | 'MAILBOX_NOT_FOUND'
  | 'MESSAGE_NOT_FOUND'
  | 'SEND_FAILED'
  | 'NOT_CONNECTED'
  | 'UNKNOWN_ERROR';

/**
 * Structured mail error.
 */
export interface MailError {
  /** Error code from native module */
  code: MailErrorCode;

  /** Human-readable error message */
  message: string;
}

// ============================================================
// Account & Credential Types (Fase 6-7)
// ============================================================

/**
 * Authentication type for a mail account.
 */
export type MailAuthType = 'oauth2' | 'password';

/**
 * Stored credentials for a mail account.
 * Persisted securely in Keychain (iOS) / Keystore (Android).
 *
 * SECURITY: NEVER log these values. NEVER store in AsyncStorage or SQLite.
 */
export interface StoredCredentials {
  /** Authentication method */
  type: MailAuthType;

  /** Email address (also used as username for most providers) */
  email: string;

  /** OAuth2 access token (for oauth2 type) */
  accessToken?: string;

  /** OAuth2 refresh token (for oauth2 type) */
  refreshToken?: string;

  /** Token expiration timestamp in milliseconds (for oauth2 type) */
  expiresAt?: number;

  /** Password (for password type) */
  password?: string;

  /** IMAP server configuration */
  imapConfig: IMAPConfig;

  /** SMTP server configuration */
  smtpConfig: SMTPConfig;
}

/**
 * Mail account stored in AsyncStorage (non-sensitive metadata only).
 * Credentials are stored separately in Keychain.
 */
export interface MailAccount {
  /** Unique account identifier (UUID) */
  id: string;

  /** Provider ID from KNOWN_PROVIDERS */
  providerId: string;

  /** Display name for the account (e.g., "Mijn Gmail") */
  displayName: string;

  /** Email address */
  email: string;

  /** Authentication type */
  authType: MailAuthType;

  /** Whether this is the default send account */
  isDefault: boolean;

  /** ISO 8601 timestamp when account was added */
  createdAt: string;
}

/**
 * OAuth2 token response from the authorization server.
 */
export interface OAuth2TokenResponse {
  /** Access token for API calls */
  accessToken: string;

  /** Refresh token for obtaining new access tokens */
  refreshToken?: string;

  /** Token expiration timestamp in milliseconds */
  expiresAt: number;

  /** ID token (OpenID Connect, contains user info) */
  idToken?: string;

  /** Token type (usually "Bearer") */
  tokenType: string;
}

/**
 * OAuth2 provider configuration for authorization flow.
 */
export interface OAuth2ProviderConfig {
  /** OpenID Connect issuer URL */
  issuer: string;

  /** OAuth2 client ID */
  clientId: string;

  /** OAuth2 redirect URL (app scheme) */
  redirectUrl: string;

  /** Requested OAuth2 scopes */
  scopes: string[];
}

// ============================================================
// Utility: Parse email address string
// ============================================================

/**
 * Parse a raw email address string into structured EmailAddress.
 * Handles formats like:
 * - "email@example.com"
 * - "Name <email@example.com>"
 * - "<email@example.com>"
 *
 * @param raw - Raw email string from native module
 * @returns Parsed EmailAddress
 */
export function parseEmailAddress(raw: string): EmailAddress {
  if (!raw || raw.trim().length === 0) {
    return { address: '' };
  }

  const trimmed = raw.trim();

  // Format: "Name <email@example.com>"
  const match = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    const name = match[1].replace(/^["']|["']$/g, '').trim();
    return {
      name: name.length > 0 ? name : undefined,
      address: match[2].trim(),
    };
  }

  // Format: "<email@example.com>"
  const angleMatch = trimmed.match(/^<([^>]+)>$/);
  if (angleMatch) {
    return { address: angleMatch[1].trim() };
  }

  // Plain email address
  return { address: trimmed };
}

/**
 * Format an EmailAddress back to a display string.
 *
 * @param addr - Structured email address
 * @returns Formatted string (e.g., "Name <email@example.com>")
 */
export function formatEmailAddress(addr: EmailAddress): string {
  if (addr.name) {
    return `${addr.name} <${addr.address}>`;
  }
  return addr.address;
}
