/**
 * Mail Service — Public API
 *
 * Re-exports all mail service modules for clean imports.
 *
 * Usage:
 *   import { imapBridge, smtpBridge, imapService, imapSearch, mailCache } from '@/services/mail';
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 5
 */

export * as imapBridge from './imapBridge';
export * as smtpBridge from './smtpBridge';
export * as imapService from './imapService';
export * as imapSearch from './imapSearch';
export * as mailCache from './mailCache';
