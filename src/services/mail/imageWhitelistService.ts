/**
 * Image Whitelist Service — Per-domain whitelist for automatic image loading
 *
 * Manages a list of trusted sender domains. When a domain is whitelisted,
 * external images in emails from that domain are loaded automatically
 * without requiring manual approval each time.
 *
 * Storage: AsyncStorage with JSON array of domain strings.
 *
 * Senior UX rationale:
 * - Reduces repetitive "Load images?" prompts for trusted senders
 * - Manageable via Settings → E-mail → Vertrouwde afzenders
 * - Domain-level (not per-email) for simplicity
 *
 * @see MailDetailScreen.tsx — MailBodyWebView integration
 * @see MailSettingsScreen.tsx — Whitelist management UI
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Constants
// ============================================================

const STORAGE_KEY = '@commeazy/mail/imageWhitelist';

// ============================================================
// Domain Extraction
// ============================================================

/**
 * Extract the domain from an email address.
 * Returns lowercase domain, or empty string if invalid.
 *
 * @example
 * extractDomain('user@Microsoft.com') // 'microsoft.com'
 * extractDomain('Newsletter <news@example.org>') // 'example.org'
 */
export function extractDomain(email: string): string {
  // Handle "Name <email>" format
  const angleMatch = email.match(/<([^>]+)>/);
  const address = angleMatch ? angleMatch[1] : email;

  const atIndex = address.lastIndexOf('@');
  if (atIndex < 0) return '';

  return address.substring(atIndex + 1).trim().toLowerCase();
}

// ============================================================
// Public API
// ============================================================

/**
 * Check if a domain is whitelisted for automatic image loading.
 */
export async function isWhitelisted(domain: string): Promise<boolean> {
  if (!domain) return false;
  const domains = await getAllWhitelistedDomains();
  return domains.includes(domain.toLowerCase());
}

/**
 * Add a domain to the whitelist.
 * No-op if already whitelisted.
 */
export async function addDomain(domain: string): Promise<void> {
  if (!domain) return;
  const normalizedDomain = domain.toLowerCase();
  const domains = await getAllWhitelistedDomains();

  if (domains.includes(normalizedDomain)) return;

  domains.push(normalizedDomain);
  domains.sort(); // Keep alphabetical for Settings display
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(domains));
}

/**
 * Remove a domain from the whitelist.
 */
export async function removeDomain(domain: string): Promise<void> {
  if (!domain) return;
  const normalizedDomain = domain.toLowerCase();
  const domains = await getAllWhitelistedDomains();
  const filtered = domains.filter((d) => d !== normalizedDomain);

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Get all whitelisted domains, sorted alphabetically.
 */
export async function getAllWhitelistedDomains(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d: unknown) => typeof d === 'string');
  } catch {
    return [];
  }
}

/**
 * Clear all whitelisted domains.
 */
export async function clearAllDomains(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
