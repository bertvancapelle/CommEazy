/**
 * Contact Mail Service — Thin wrapper for contact integration in mail
 *
 * Converts CommEazy contacts to mail recipients without duplicating
 * any contact logic. Uses existing contact service/model exclusively.
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 13
 */

import type { MailRecipient } from '@/types/mail';

// ============================================================
// Types
// ============================================================

/** Contact shape from CommEazy contact service */
interface Contact {
  userUuid: string;
  firstName: string;
  lastName: string;
  email?: string;
  photoUrl?: string;
}

// ============================================================
// Conversion
// ============================================================

/**
 * Convert a CommEazy contact to a mail recipient.
 *
 * @param contact - CommEazy contact object
 * @returns MailRecipient or null if contact has no email
 */
export function contactToMailRecipient(contact: Contact): MailRecipient | null {
  if (!contact.email) return null;

  return {
    id: contact.userUuid,
    name: `${contact.firstName} ${contact.lastName}`.trim(),
    email: contact.email,
    avatarUri: contact.photoUrl,
    isFromContacts: true,
  };
}

/**
 * Filter contacts that have an email address.
 *
 * @param contacts - Array of CommEazy contacts
 * @returns Contacts with email addresses
 */
export function getMailableContacts(contacts: Contact[]): Contact[] {
  return contacts.filter(c => c.email && c.email.trim().length > 0);
}

/**
 * Search contacts by name or email for autocomplete.
 * Case-insensitive partial matching on firstName, lastName, and email.
 *
 * @param contacts - Array of contacts to search
 * @param query - Search query (min 2 characters)
 * @param limit - Maximum results to return (default: 5)
 * @returns Matching contacts sorted by relevance
 */
export function searchContactsForMail(
  contacts: Contact[],
  query: string,
  limit = 5,
): Contact[] {
  if (query.length < 2) return [];

  const q = query.toLowerCase();
  const mailable = getMailableContacts(contacts);

  const scored = mailable
    .map(contact => {
      const first = contact.firstName.toLowerCase();
      const last = contact.lastName.toLowerCase();
      const email = (contact.email || '').toLowerCase();
      const full = `${first} ${last}`;

      let score = 0;
      if (first.startsWith(q)) score += 10;
      else if (first.includes(q)) score += 5;
      if (last.startsWith(q)) score += 10;
      else if (last.includes(q)) score += 5;
      if (full.startsWith(q)) score += 8;
      if (email.startsWith(q)) score += 7;
      else if (email.includes(q)) score += 3;

      return { contact, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ contact }) => contact);
}
