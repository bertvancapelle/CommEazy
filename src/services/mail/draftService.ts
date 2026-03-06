/**
 * Draft Service — AsyncStorage-backed auto-save for mail drafts
 *
 * Stores a single draft at a time (last compose session).
 * Used by MailComposeScreen for:
 * - Periodic auto-save (every 30 seconds)
 * - Save on app background (AppState)
 * - Restore prompt when re-opening compose
 *
 * Data model is lightweight — only serializable fields, no File objects.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MailRecipient } from '@/types/mail';
import type { ComposeMode } from '@/screens/mail/MailComposeScreen';

// ============================================================
// Types
// ============================================================

export interface MailDraft {
  /** Recipients */
  to: MailRecipient[];
  cc: MailRecipient[];
  bcc: MailRecipient[];
  /** Subject line */
  subject: string;
  /** Body text */
  body: string;
  /** Compose mode */
  mode: ComposeMode;
  /** Account ID that was composing */
  accountId: string;
  /** ISO timestamp when draft was saved */
  savedAt: string;
  /** UID of the message being replied to (if reply/replyAll) */
  replyToUid?: number;
}

// ============================================================
// Constants
// ============================================================

const DRAFT_KEY = '@commeazy/mail/draft';

// ============================================================
// API
// ============================================================

/**
 * Save a draft to AsyncStorage.
 * Overwrites any previously saved draft.
 */
export async function saveDraft(draft: MailDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Non-critical — draft save failed silently
    console.debug('[draftService] Failed to save draft');
  }
}

/**
 * Load a previously saved draft from AsyncStorage.
 * Returns null if no draft exists or parsing fails.
 */
export async function loadDraft(): Promise<MailDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MailDraft;
    // Basic validation
    if (!parsed.to || !parsed.subject === undefined || !parsed.savedAt) {
      return null;
    }
    return parsed;
  } catch {
    console.debug('[draftService] Failed to load draft');
    return null;
  }
}

/**
 * Delete the saved draft from AsyncStorage.
 */
export async function deleteDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // Non-critical
    console.debug('[draftService] Failed to delete draft');
  }
}

/**
 * Check if a draft exists without loading it.
 */
export async function hasDraft(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    return raw !== null;
  } catch {
    return false;
  }
}
