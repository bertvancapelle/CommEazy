/**
 * Mail Constants — Known providers and domain auto-detection
 *
 * Defines IMAP/SMTP configurations for well-known mail providers
 * and provides auto-detection based on email address domain.
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 7
 */

// ============================================================
// Types
// ============================================================

/** Security method for server connections */
export type SecurityMethod = 'SSL' | 'STARTTLS' | 'NONE';

/** Authentication type for a provider */
export type AuthType = 'oauth2' | 'password';

/** Server configuration (IMAP or SMTP) */
export interface ServerConfig {
  host: string;
  port: number;
  security: SecurityMethod;
}

/** Known mail provider definition */
export interface MailProvider {
  /** Unique provider identifier */
  id: string;

  /** Display name (e.g., "Gmail", "Outlook") */
  name: string;

  /** Authentication type */
  authType: AuthType;

  /** IMAP server configuration */
  imap: ServerConfig;

  /** SMTP server configuration */
  smtp: ServerConfig;

  /** Known domains for auto-detection (lowercase) */
  domains: string[];

  /** Provider logo icon name (for UI) */
  icon?: string;

  /** Additional notes for users (e.g., app-specific password requirement) */
  noteKey?: string;
}

// ============================================================
// Known Providers
// ============================================================

/**
 * Known mail provider configurations.
 *
 * Order matters for display in the onboarding provider picker:
 * - OAuth2 providers first (easiest for seniors)
 * - Common Dutch providers next
 * - International providers
 * - Custom last
 */
export const KNOWN_PROVIDERS: readonly MailProvider[] = [
  // --- OAuth2 Providers ---
  {
    id: 'gmail',
    name: 'Gmail',
    authType: 'oauth2',
    imap: { host: 'imap.gmail.com', port: 993, security: 'SSL' },
    smtp: { host: 'smtp.gmail.com', port: 587, security: 'STARTTLS' },
    domains: ['gmail.com', 'googlemail.com'],
    icon: 'mail',
  },
  {
    id: 'outlook',
    name: 'Microsoft Outlook / Hotmail',
    authType: 'oauth2',
    imap: { host: 'outlook.office365.com', port: 993, security: 'SSL' },
    smtp: { host: 'smtp.office365.com', port: 587, security: 'STARTTLS' },
    domains: [
      'outlook.com', 'hotmail.com', 'hotmail.nl', 'live.com', 'live.nl',
      'msn.com', 'outlook.nl', 'hotmail.co.uk', 'hotmail.de', 'hotmail.fr',
      'hotmail.it', 'hotmail.es', 'live.co.uk', 'live.de', 'live.fr',
    ],
    icon: 'mail',
  },

  // --- Dutch Providers (password-based) ---
  {
    id: 'kpn',
    name: 'KPN Mail',
    authType: 'password',
    imap: { host: 'imap.kpnmail.nl', port: 993, security: 'SSL' },
    smtp: { host: 'smtp.kpnmail.nl', port: 587, security: 'STARTTLS' },
    domains: ['kpnmail.nl', 'planet.nl', 'hetnet.nl', 'home.nl'],
    icon: 'mail',
  },
  {
    id: 'ziggo',
    name: 'Ziggo Mail',
    authType: 'password',
    imap: { host: 'imap.ziggo.nl', port: 993, security: 'SSL' },
    smtp: { host: 'smtp.ziggo.nl', port: 587, security: 'STARTTLS' },
    domains: ['ziggo.nl', 'casema.nl', '@multiweb.nl'],
    icon: 'mail',
  },
  {
    id: 'xs4all',
    name: 'XS4ALL / KPN Zakelijk',
    authType: 'password',
    imap: { host: 'imap.xs4all.nl', port: 993, security: 'SSL' },
    smtp: { host: 'smtp.xs4all.nl', port: 465, security: 'SSL' },
    domains: ['xs4all.nl'],
    icon: 'mail',
  },

  // --- International Providers (password-based) ---
  {
    id: 'yahoo',
    name: 'Yahoo Mail',
    authType: 'password',
    imap: { host: 'imap.mail.yahoo.com', port: 993, security: 'SSL' },
    smtp: { host: 'smtp.mail.yahoo.com', port: 587, security: 'STARTTLS' },
    domains: ['yahoo.com', 'yahoo.nl', 'yahoo.co.uk', 'yahoo.de', 'yahoo.fr', 'yahoo.es', 'yahoo.it'],
    icon: 'mail',
    noteKey: 'modules.mail.providerNotes.yahooAppPassword',
  },
  {
    id: 'icloud',
    name: 'Apple iCloud Mail',
    authType: 'password',
    imap: { host: 'imap.mail.me.com', port: 993, security: 'SSL' },
    smtp: { host: 'smtp.mail.me.com', port: 587, security: 'STARTTLS' },
    domains: ['icloud.com', 'me.com', 'mac.com'],
    icon: 'mail',
    noteKey: 'modules.mail.providerNotes.icloudAppPassword',
  },
  {
    id: 'gmx',
    name: 'GMX Mail',
    authType: 'password',
    imap: { host: 'imap.gmx.net', port: 993, security: 'SSL' },
    smtp: { host: 'mail.gmx.net', port: 587, security: 'STARTTLS' },
    domains: ['gmx.net', 'gmx.de', 'gmx.at', 'gmx.ch'],
    icon: 'mail',
  },
  {
    id: 'webde',
    name: 'WEB.DE',
    authType: 'password',
    imap: { host: 'imap.web.de', port: 993, security: 'SSL' },
    smtp: { host: 'smtp.web.de', port: 587, security: 'STARTTLS' },
    domains: ['web.de'],
    icon: 'mail',
  },
  {
    id: 'protonmail',
    name: 'ProtonMail (Bridge)',
    authType: 'password',
    imap: { host: '127.0.0.1', port: 1143, security: 'STARTTLS' },
    smtp: { host: '127.0.0.1', port: 1025, security: 'STARTTLS' },
    domains: ['protonmail.com', 'proton.me', 'pm.me'],
    icon: 'mail',
    noteKey: 'modules.mail.providerNotes.protonBridge',
  },

  // --- Custom (always last) ---
  {
    id: 'custom',
    name: 'Andere provider (handmatig)',
    authType: 'password',
    imap: { host: '', port: 993, security: 'SSL' },
    smtp: { host: '', port: 587, security: 'STARTTLS' },
    domains: [],
    icon: 'mail',
  },
] as const;

// ============================================================
// Domain Auto-Detection
// ============================================================

/** Pre-built lookup map: domain → provider ID */
const DOMAIN_MAP: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const provider of KNOWN_PROVIDERS) {
    for (const domain of provider.domains) {
      // Clean any accidental @ prefix
      const clean = domain.startsWith('@') ? domain.slice(1) : domain;
      map.set(clean.toLowerCase(), provider.id);
    }
  }
  return map;
})();

/**
 * Detect mail provider from an email address.
 *
 * @param email - Full email address (e.g., "user@gmail.com")
 * @returns Matched provider, or the 'custom' provider if unknown domain
 */
export function detectProvider(email: string): MailProvider {
  const domain = extractDomain(email);
  if (!domain) {
    return getProvider('custom')!;
  }

  const providerId = DOMAIN_MAP.get(domain.toLowerCase());
  if (providerId) {
    return getProvider(providerId)!;
  }

  return getProvider('custom')!;
}

/**
 * Get a provider by ID.
 *
 * @param id - Provider identifier
 * @returns Provider or undefined
 */
export function getProvider(id: string): MailProvider | undefined {
  return KNOWN_PROVIDERS.find(p => p.id === id);
}

/**
 * Get all selectable providers (for onboarding UI).
 * Returns all providers in display order.
 *
 * @returns Array of providers
 */
export function getSelectableProviders(): readonly MailProvider[] {
  return KNOWN_PROVIDERS;
}

/**
 * Get only OAuth2 providers.
 *
 * @returns Array of OAuth2 providers
 */
export function getOAuth2Providers(): MailProvider[] {
  return KNOWN_PROVIDERS.filter(p => p.authType === 'oauth2') as MailProvider[];
}

/**
 * Extract domain from email address.
 *
 * @param email - Email address
 * @returns Domain portion (lowercase) or null
 */
export function extractDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1 || at >= email.length - 1) {
    return null;
  }
  return email.slice(at + 1).toLowerCase().trim();
}

/**
 * Check if a provider requires OAuth2 authentication.
 *
 * @param providerId - Provider identifier
 * @returns Whether OAuth2 is required
 */
export function isOAuth2Provider(providerId: string): boolean {
  const provider = getProvider(providerId);
  return provider?.authType === 'oauth2';
}

/**
 * Get default server configurations for a provider.
 * For custom providers, returns empty hosts that need to be filled in.
 *
 * @param providerId - Provider identifier
 * @returns Object with imap and smtp configs, or null if provider not found
 */
export function getServerDefaults(providerId: string): { imap: ServerConfig; smtp: ServerConfig } | null {
  const provider = getProvider(providerId);
  if (!provider) return null;

  return {
    imap: { ...provider.imap },
    smtp: { ...provider.smtp },
  };
}
