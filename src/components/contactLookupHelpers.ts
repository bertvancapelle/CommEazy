/**
 * Contact Lookup Helpers
 *
 * Extracted from HoldToNavigateWrapper for better separation of concerns.
 *
 * Contains:
 * - Levenshtein distance calculation
 * - Fuzzy name matching (word-level + partial + typo tolerance)
 * - Contact search with similarity scoring
 * - Types for pending voice actions
 */

import { ServiceContainer } from '@/services/container';
import type { Contact } from '@/services/interfaces';
import { getContactDisplayName } from '@/services/interfaces';

// ============================================================
// Pending Voice Action Types
// ============================================================

/**
 * Represents a pending voice action that requires contact selection
 */
export interface PendingVoiceAction {
  /** The type of action to perform after selection */
  action: 'call' | 'message';
  /** The original search term */
  searchTerm: string;
}

/**
 * Represents a pending voice list navigation (focus on a name in a list)
 */
export interface PendingVoiceListNavigation {
  /** The original search term */
  searchTerm: string;
}

// ============================================================
// Contact Match Result
// ============================================================

/**
 * Contact match result with score for multi-match handling
 */
export interface ContactMatch {
  contact: Contact;
  score: number;
}

// ============================================================
// String Similarity
// ============================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) between search term and contact name
 *
 * Supports WORD-LEVEL matching:
 * - "oma" matches "Oma Jansen" (exact word match → score 0.95)
 * - "maria" matches "Tante Maria" (exact word match → score 0.95)
 * - "jansen" matches "Oma Jansen" (exact word match → score 0.95)
 *
 * Also supports partial matching:
 * - "jan" matches "Jansen" (prefix → score 0.85)
 * - "oma" matches "omas" (prefix → score 0.85)
 */
export function similarityScore(searchTerm: string, contactName: string): number {
  const searchLower = searchTerm.toLowerCase().trim();
  const nameLower = contactName.toLowerCase().trim();

  if (searchLower === nameLower) return 1;
  if (searchLower.length === 0 || nameLower.length === 0) return 0;

  // Split contact name into words
  const nameWords = nameLower.split(/\s+/);

  // Check for exact word match (highest priority for voice commands)
  // "oma" in "Oma Jansen" → exact word match
  for (const word of nameWords) {
    if (word === searchLower) {
      return 0.95; // Exact word match
    }
  }

  // Check if search term is a prefix of any word
  // "jan" in "Jansen" → prefix match
  for (const word of nameWords) {
    if (word.startsWith(searchLower)) {
      return 0.85; // Prefix match within a word
    }
  }

  // Check if full name starts with search term
  // "oma j" matches "Oma Jansen"
  if (nameLower.startsWith(searchLower)) {
    return 0.9;
  }

  // Check for fuzzy word match using Levenshtein
  // "omaa" → "oma" (typo tolerance)
  let bestWordScore = 0;
  for (const word of nameWords) {
    const distance = levenshteinDistance(searchLower, word);
    const maxLen = Math.max(searchLower.length, word.length);
    const wordScore = 1 - distance / maxLen;
    if (wordScore > bestWordScore) {
      bestWordScore = wordScore;
    }
  }

  // If we found a good word match, return it
  if (bestWordScore >= 0.7) {
    return bestWordScore * 0.9; // Slight penalty for fuzzy match
  }

  // Fallback: full string Levenshtein
  const fullDistance = levenshteinDistance(searchLower, nameLower);
  const fullMaxLen = Math.max(searchLower.length, nameLower.length);
  return 1 - fullDistance / fullMaxLen;
}

// ============================================================
// Contact Lookup
// ============================================================

/**
 * Find ALL matching contacts by name using fuzzy matching
 * Returns all contacts with similarity score above threshold, sorted by score (highest first)
 */
export async function findAllContactsByName(
  contactName: string,
  threshold: number = 0.7
): Promise<ContactMatch[]> {
  try {
    let contacts: Contact[] = [];

    if (__DEV__) {
      // Dynamic import to avoid module loading at bundle time
      const { getMockContactsForDevice } = await import('@/services/mock');
      const { getOtherDevicesPublicKeys } = await import('@/services/mock/testKeys');
      const { chatService } = await import('@/services/chat');

      const currentUserJid = chatService.isInitialized
        ? chatService.getMyJid()
        : 'ik@commeazy.local';

      // Get public keys for other test devices
      const publicKeyMap = await getOtherDevicesPublicKeys(currentUserJid || 'ik@commeazy.local');

      contacts = getMockContactsForDevice(currentUserJid || 'ik@commeazy.local', publicKeyMap);
    } else {
      // Production: one-shot read from database observable
      const db = ServiceContainer.database;
      const unsubscribe = db.getContacts().subscribe(c => {
        contacts.push(...c);
      });
      unsubscribe();
    }

    // Find all matches above threshold
    const matches: ContactMatch[] = [];

    for (const contact of contacts) {
      const score = similarityScore(contactName, getContactDisplayName(contact));
      if (score >= threshold) {
        matches.push({ contact, score });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    console.log('[findAllContactsByName] Matches for:', contactName, '->', matches.map(m => `${getContactDisplayName(m.contact)}(${m.score.toFixed(2)})`).join(', '));
    return matches;
  } catch (error) {
    console.error('[findAllContactsByName] Failed to find contacts:', error);
    return [];
  }
}

/**
 * Find best matching contact by name using fuzzy matching
 * Returns the contact with highest similarity score above threshold
 */
export async function findContactByName(
  contactName: string,
  threshold: number = 0.7
): Promise<Contact | null> {
  const matches = await findAllContactsByName(contactName, threshold);
  return matches.length > 0 ? matches[0].contact : null;
}
