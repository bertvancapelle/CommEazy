/**
 * Smart Sections — Automatic contact grouping logic
 *
 * Provides 5 smart sections that automatically categorize contacts:
 * 1. ICE (In Case of Emergency) — contacts marked as emergency
 * 2. Birthdays — contacts with birthdays in the next 14 days
 * 3. Frequently Called — top 5 most called contacts
 * 4. Long No Contact — contacts not spoken to in >30 days
 * 5. Recently Added — contacts added in the last 30 days
 *
 * Sections with 0 contacts are hidden from the UI.
 *
 * @see .claude/plans/CONTACT_GROUPS.md
 */

import type { Contact } from '@/services/interfaces';

// ============================================================
// Types
// ============================================================

export type SmartSectionId = 'ice' | 'birthdays' | 'frequentCalls' | 'longNoContact' | 'recentlyAdded';

export interface SmartSection {
  /** Section identifier */
  id: SmartSectionId;
  /** Emoji prefix for chip display */
  emoji: string;
  /** i18n key for section label */
  labelKey: string;
  /** Contacts matching this section's filter */
  contacts: Contact[];
}

// ============================================================
// Constants
// ============================================================

/** Days ahead to check for upcoming birthdays */
const BIRTHDAY_DAYS_AHEAD = 14;

/** Number of top frequent callers to show */
const FREQUENT_CALLS_LIMIT = 5;

/** Days threshold for "long no contact" */
const LONG_NO_CONTACT_DAYS = 30;

/** Days threshold for "recently added" */
const RECENTLY_ADDED_DAYS = 30;

// ============================================================
// Date Helpers
// ============================================================

/**
 * Check if a birthday (ISO date string "YYYY-MM-DD") falls within the next N days.
 * Handles year wrapping (e.g., checking in late December for January birthdays).
 */
function isBirthdayWithinDays(birthDateISO: string, daysAhead: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse birth date — only care about month and day
  const parts = birthDateISO.split('-');
  if (parts.length < 3) return false;

  const birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed
  const birthDay = parseInt(parts[2], 10);

  if (isNaN(birthMonth) || isNaN(birthDay)) return false;

  // Create this year's birthday
  const thisYearBirthday = new Date(today.getFullYear(), birthMonth, birthDay);
  thisYearBirthday.setHours(0, 0, 0, 0);

  // If birthday has passed this year, check next year's
  let nextBirthday = thisYearBirthday;
  if (thisYearBirthday < today) {
    // Check if it's today (same date)
    if (
      thisYearBirthday.getMonth() === today.getMonth() &&
      thisYearBirthday.getDate() === today.getDate()
    ) {
      return true; // Birthday is today
    }
    nextBirthday = new Date(today.getFullYear() + 1, birthMonth, birthDay);
  }

  const diffMs = nextBirthday.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays <= daysAhead;
}

/**
 * Get number of days until next birthday.
 * Returns 0 for today, negative shouldn't happen (handled by isBirthdayWithinDays).
 */
export function getDaysUntilBirthday(birthDateISO: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = birthDateISO.split('-');
  if (parts.length < 3) return Infinity;

  const birthMonth = parseInt(parts[1], 10) - 1;
  const birthDay = parseInt(parts[2], 10);

  if (isNaN(birthMonth) || isNaN(birthDay)) return Infinity;

  const thisYearBirthday = new Date(today.getFullYear(), birthMonth, birthDay);
  thisYearBirthday.setHours(0, 0, 0, 0);

  let nextBirthday = thisYearBirthday;
  if (thisYearBirthday < today) {
    if (
      thisYearBirthday.getMonth() === today.getMonth() &&
      thisYearBirthday.getDate() === today.getDate()
    ) {
      return 0;
    }
    nextBirthday = new Date(today.getFullYear() + 1, birthMonth, birthDay);
  }

  const diffMs = nextBirthday.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get number of days since a timestamp (epoch ms).
 */
function daysSinceTimestamp(timestamp: number): number {
  const now = Date.now();
  return Math.floor((now - timestamp) / (1000 * 60 * 60 * 24));
}

// ============================================================
// Smart Section Filters
// ============================================================

/**
 * Get contacts marked as ICE (In Case of Emergency).
 */
export function getIceContacts(contacts: Contact[]): Contact[] {
  return contacts.filter(c => c.isEmergencyContact === true);
}

/**
 * Get contacts with birthdays in the next N days.
 * Sorted by soonest birthday first.
 */
export function getUpcomingBirthdays(
  contacts: Contact[],
  daysAhead: number = BIRTHDAY_DAYS_AHEAD,
): Contact[] {
  return contacts
    .filter(c => c.birthDate && isBirthdayWithinDays(c.birthDate, daysAhead))
    .sort((a, b) => {
      const daysA = getDaysUntilBirthday(a.birthDate!);
      const daysB = getDaysUntilBirthday(b.birthDate!);
      return daysA - daysB;
    });
}

/**
 * Get the top N most frequently called contacts.
 * Returns contacts sorted by call count (highest first).
 */
export function getFrequentCalls(
  contacts: Contact[],
  callFrequency: Record<string, number>,
  limit: number = FREQUENT_CALLS_LIMIT,
): Contact[] {
  return contacts
    .filter(c => (callFrequency[c.jid] || 0) > 0)
    .sort((a, b) => (callFrequency[b.jid] || 0) - (callFrequency[a.jid] || 0))
    .slice(0, limit);
}

/**
 * Get contacts not spoken to in more than N days.
 * Sorted by longest silence first.
 */
export function getLongNoContact(
  contacts: Contact[],
  daysThreshold: number = LONG_NO_CONTACT_DAYS,
): Contact[] {
  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;
  const now = Date.now();

  return contacts
    .filter(c => c.lastSeen > 0 && (now - c.lastSeen) > thresholdMs)
    .sort((a, b) => a.lastSeen - b.lastSeen); // Oldest first
}

/**
 * Get contacts added within the last N days.
 * Note: Uses lastSeen as proxy for creation date since the Contact interface
 * doesn't expose createdAt directly. The WatermelonDB model has createdAt
 * but it's not mapped to the interface. For contacts that have never been
 * contacted, lastSeen will be close to creation time.
 *
 * TODO: Consider mapping createdAt from WatermelonDB to Contact interface.
 */
export function getRecentlyAdded(
  contacts: Contact[],
  daysThreshold: number = RECENTLY_ADDED_DAYS,
): Contact[] {
  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // We filter on lastSeen as a proxy — contacts that were recently created
  // will have a recent lastSeen value. This is imperfect but works for
  // the common case where lastSeen is set at contact creation.
  return contacts
    .filter(c => c.lastSeen > 0 && (now - c.lastSeen) < thresholdMs)
    .sort((a, b) => b.lastSeen - a.lastSeen); // Most recent first
}

// ============================================================
// Combined Smart Sections
// ============================================================

/**
 * Get all smart sections with their contacts.
 * Sections with 0 contacts are still returned (UI hides them).
 */
export function getSmartSections(
  contacts: Contact[],
  callFrequency: Record<string, number>,
): SmartSection[] {
  return [
    {
      id: 'ice',
      emoji: '\u26A0\uFE0F', // warning sign
      labelKey: 'contacts.smartSections.ice',
      contacts: getIceContacts(contacts),
    },
    {
      id: 'birthdays',
      emoji: '\uD83C\uDF82', // birthday cake
      labelKey: 'contacts.smartSections.birthdays',
      contacts: getUpcomingBirthdays(contacts),
    },
    {
      id: 'frequentCalls',
      emoji: '\uD83D\uDCDE', // telephone
      labelKey: 'contacts.smartSections.frequentCalls',
      contacts: getFrequentCalls(contacts, callFrequency),
    },
    {
      id: 'longNoContact',
      emoji: '\uD83D\uDD50', // clock
      labelKey: 'contacts.smartSections.longNoContact',
      contacts: getLongNoContact(contacts),
    },
    {
      id: 'recentlyAdded',
      emoji: '\uD83C\uDD95', // new sign
      labelKey: 'contacts.smartSections.recentlyAdded',
      contacts: getRecentlyAdded(contacts),
    },
  ];
}
