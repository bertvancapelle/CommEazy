/**
 * SMTP Bridge — React Native NativeModules wrapper for MailModule (SMTP)
 *
 * Wraps the native MailModule's SMTP sendMessage method with TypeScript typing.
 *
 * @see ios/MailModule.swift — sendMessage method
 * @see ios/MailModule.m — ObjC bridge
 * @see src/types/mail.ts
 */

import { NativeModules, Platform } from 'react-native';
import type {
  SMTPConfig,
  EmailAddress,
  MailErrorCode,
} from '@/types/mail';
import { getMailErrorCode } from './imapBridge';

// ============================================================
// Native Module Interface (SMTP portion)
// ============================================================

/**
 * Raw NativeModules.MailModule interface for SMTP.
 * sendMessage uses NSDictionary/NSArray on the native side.
 */
interface NativeMailModuleSMTP {
  sendMessage(
    smtpHost: string,
    smtpPort: number,
    username: string,
    password: string | null,
    accessToken: string | null,
    from: { name?: string; address: string },
    to: Array<{ name?: string; address: string }>,
    cc: Array<{ name?: string; address: string }> | null,
    bcc: Array<{ name?: string; address: string }> | null,
    subject: string,
    body: string,
    htmlBody: string | null,
    attachments: Array<SendAttachment> | null,
  ): Promise<boolean>;
}

// ============================================================
// Send Types
// ============================================================

/**
 * Attachment object for sending via SMTP.
 * Either base64 data or a local file path must be provided.
 */
export interface SendAttachment {
  /** Base64-encoded file data */
  base64?: string;

  /** Local file path (alternative to base64) */
  filePath?: string;

  /** File name with extension */
  fileName: string;

  /** MIME type */
  mimeType: string;
}

/**
 * Compose message parameters for sendMessage.
 */
export interface SendMessageParams {
  /** SMTP server configuration */
  smtpConfig: SMTPConfig;

  /** Sender address */
  from: EmailAddress;

  /** Primary recipients */
  to: EmailAddress[];

  /** CC recipients */
  cc?: EmailAddress[];

  /** BCC recipients */
  bcc?: EmailAddress[];

  /** Email subject */
  subject: string;

  /** Plain text body */
  body: string;

  /** HTML body (optional) */
  htmlBody?: string;

  /** Attachments (optional) */
  attachments?: SendAttachment[];
}

// ============================================================
// Module Reference
// ============================================================

const MailNativeModule: NativeMailModuleSMTP | null =
  Platform.OS === 'ios' ? NativeModules.MailModule : null;

function getModule(): NativeMailModuleSMTP {
  if (!MailNativeModule) {
    throw new Error('[smtpBridge] MailModule is only available on iOS');
  }
  return MailNativeModule;
}

// ============================================================
// SMTP Bridge API
// ============================================================

/**
 * Send an email via SMTP.
 *
 * Connects to the SMTP server, authenticates, sends the message,
 * and disconnects — all in one native call.
 *
 * @param params - Send message parameters
 * @throws MailError with code SEND_FAILED, AUTH_FAILED, etc.
 */
export async function sendMessage(params: SendMessageParams): Promise<boolean> {
  const { smtpConfig, from, to, cc, bcc, subject, body, htmlBody, attachments } = params;

  return getModule().sendMessage(
    smtpConfig.host,
    smtpConfig.port,
    smtpConfig.username,
    smtpConfig.password ?? null,
    smtpConfig.accessToken ?? null,
    { name: from.name, address: from.address },
    to.map(addr => ({ name: addr.name, address: addr.address })),
    cc && cc.length > 0
      ? cc.map(addr => ({ name: addr.name, address: addr.address }))
      : null,
    bcc && bcc.length > 0
      ? bcc.map(addr => ({ name: addr.name, address: addr.address }))
      : null,
    subject,
    body,
    htmlBody ?? null,
    attachments && attachments.length > 0 ? attachments : null,
  );
}

export { getMailErrorCode };
