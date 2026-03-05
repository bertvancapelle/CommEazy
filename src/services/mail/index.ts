/**
 * Mail Service — Public API
 *
 * Re-exports all mail service modules for clean imports.
 *
 * Usage:
 *   import { imapBridge, smtpBridge, imapService, imapSearch, mailCache } from '@/services/mail';
 *   import { credentialManager, oauth2Service, mailConstants } from '@/services/mail';
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 5, 6, 7
 */

// Fase 5: Bridge + Cache
export * as imapBridge from './imapBridge';
export * as smtpBridge from './smtpBridge';
export * as imapService from './imapService';
export * as imapSearch from './imapSearch';
export * as mailCache from './mailCache';

// Fase 6-7: OAuth2 + Providers
export * as credentialManager from './credentialManager';
export * as oauth2Service from './oauth2Service';
export * as mailConstants from './mailConstants';

// Fase 13: Contacten-integratie
export * as contactMailService from './contactMailService';

// Fase 14: Media bijlagen
export * as mediaAttachmentService from './mediaAttachmentService';

// Fase 17: Opslaan in album
export * as saveToAlbumService from './saveToAlbumService';

// Fase 18: Content routing (QLPreviewController + SFSafariViewController)
export * as contentRouter from './contentRouter';

// Fase 19: Image whitelist (per-domain auto-load)
export * as imageWhitelistService from './imageWhitelistService';
