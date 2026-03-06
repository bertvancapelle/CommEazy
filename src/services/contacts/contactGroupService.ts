/**
 * Contact Group Service — CRUD operations for contact groups
 *
 * Groups are lightweight metadata stored in AsyncStorage.
 * Contacts remain in WatermelonDB — groups only reference JIDs.
 *
 * Follows the albumService.ts pattern: readGroups/writeGroups helpers,
 * uuid.v4() for IDs, createdAt/updatedAt timestamps.
 *
 * @see .claude/plans/CONTACT_GROUPS.md
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[contactGroupService]';
const STORAGE_KEY = '@commeazy/contactGroups';
const CALL_FREQUENCY_KEY = '@commeazy/callFrequency';

// ============================================================
// Types
// ============================================================

export interface ContactGroup {
  /** Unique group ID (UUID v4) */
  id: string;
  /** User-defined group name */
  name: string;
  /** Emoji icon (optional, chosen by user) */
  emoji?: string;
  /** JIDs of contacts in this group */
  contactJids: string[];
  /** Timestamp when group was created */
  createdAt: number;
  /** Timestamp when group was last modified */
  updatedAt: number;
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Read all groups from AsyncStorage.
 */
async function readGroups(): Promise<ContactGroup[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ContactGroup[];
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to read groups');
    return [];
  }
}

/**
 * Write all groups to AsyncStorage.
 */
async function writeGroups(groups: ContactGroup[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to write groups');
    throw error;
  }
}

// ============================================================
// Public API — Group CRUD
// ============================================================

/**
 * Get all groups, sorted by most recently updated first.
 */
export async function getGroups(): Promise<ContactGroup[]> {
  const groups = await readGroups();
  return groups.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Get a single group by ID.
 */
export async function getGroupById(id: string): Promise<ContactGroup | undefined> {
  const groups = await readGroups();
  return groups.find(g => g.id === id);
}

/**
 * Create a new contact group.
 * Returns the created group.
 */
export async function createGroup(
  name: string,
  emoji?: string,
  jids: string[] = [],
): Promise<ContactGroup> {
  const groups = await readGroups();
  const now = Date.now();

  const newGroup: ContactGroup = {
    id: uuid.v4() as string,
    name: name.trim(),
    emoji,
    contactJids: [...new Set(jids)], // Deduplicate
    createdAt: now,
    updatedAt: now,
  };

  groups.push(newGroup);
  await writeGroups(groups);

  console.debug(LOG_PREFIX, 'Group created', { id: newGroup.id, memberCount: jids.length });
  return newGroup;
}

/**
 * Rename an existing group.
 */
export async function renameGroup(id: string, name: string): Promise<boolean> {
  const groups = await readGroups();
  const group = groups.find(g => g.id === id);

  if (!group) {
    console.warn(LOG_PREFIX, 'Group not found for rename');
    return false;
  }

  group.name = name.trim();
  group.updatedAt = Date.now();
  await writeGroups(groups);

  console.debug(LOG_PREFIX, 'Group renamed', { id });
  return true;
}

/**
 * Delete a group. Contacts are NOT deleted — only the group metadata.
 */
export async function deleteGroup(id: string): Promise<boolean> {
  const groups = await readGroups();
  const filtered = groups.filter(g => g.id !== id);

  if (filtered.length === groups.length) {
    console.warn(LOG_PREFIX, 'Group not found for deletion');
    return false;
  }

  await writeGroups(filtered);
  console.debug(LOG_PREFIX, 'Group deleted', { id });
  return true;
}

/**
 * Update group emoji.
 */
export async function updateGroupEmoji(id: string, emoji: string): Promise<boolean> {
  const groups = await readGroups();
  const group = groups.find(g => g.id === id);

  if (!group) {
    console.warn(LOG_PREFIX, 'Group not found for emoji update');
    return false;
  }

  group.emoji = emoji;
  group.updatedAt = Date.now();
  await writeGroups(groups);

  console.debug(LOG_PREFIX, 'Group emoji updated', { id });
  return true;
}

// ============================================================
// Public API — Contact Management
// ============================================================

/**
 * Add contacts to a group. Skips duplicates.
 */
export async function addContactsToGroup(groupId: string, jids: string[]): Promise<boolean> {
  const groups = await readGroups();
  const group = groups.find(g => g.id === groupId);

  if (!group) {
    console.warn(LOG_PREFIX, 'Group not found for addContacts');
    return false;
  }

  const existingSet = new Set(group.contactJids);
  const newJids = jids.filter(jid => !existingSet.has(jid));

  if (newJids.length === 0) return true;

  group.contactJids = [...group.contactJids, ...newJids];
  group.updatedAt = Date.now();
  await writeGroups(groups);

  console.debug(LOG_PREFIX, 'Contacts added to group', { groupId, added: newJids.length });
  return true;
}

/**
 * Remove contacts from a group.
 */
export async function removeContactsFromGroup(groupId: string, jids: string[]): Promise<boolean> {
  const groups = await readGroups();
  const group = groups.find(g => g.id === groupId);

  if (!group) {
    console.warn(LOG_PREFIX, 'Group not found for removeContacts');
    return false;
  }

  const removeSet = new Set(jids);
  group.contactJids = group.contactJids.filter(jid => !removeSet.has(jid));
  group.updatedAt = Date.now();
  await writeGroups(groups);

  console.debug(LOG_PREFIX, 'Contacts removed from group', { groupId, removed: jids.length });
  return true;
}

/**
 * Remove a contact from ALL groups (e.g., when a contact is deleted).
 * Called by contact deletion flows to keep group references clean.
 */
export async function removeContactFromAllGroups(jid: string): Promise<void> {
  const groups = await readGroups();
  let changed = false;

  for (const group of groups) {
    const idx = group.contactJids.indexOf(jid);
    if (idx !== -1) {
      group.contactJids.splice(idx, 1);
      group.updatedAt = Date.now();
      changed = true;
    }
  }

  if (changed) {
    await writeGroups(groups);
    console.debug(LOG_PREFIX, 'Contact removed from all groups');
  }
}

// ============================================================
// Public API — Call Frequency Tracking
// ============================================================

/**
 * Read call frequency map from AsyncStorage.
 * Returns a Record<string, number> mapping JID → call count.
 */
export async function getCallFrequency(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(CALL_FREQUENCY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to read call frequency');
    return {};
  }
}

/**
 * Increment call count for a contact.
 * Called when an outgoing call is made.
 */
export async function incrementCallFrequency(jid: string): Promise<void> {
  try {
    const frequency = await getCallFrequency();
    frequency[jid] = (frequency[jid] || 0) + 1;
    await AsyncStorage.setItem(CALL_FREQUENCY_KEY, JSON.stringify(frequency));
    console.debug(LOG_PREFIX, 'Call frequency incremented', { count: frequency[jid] });
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to increment call frequency');
  }
}

/**
 * Remove a contact's call frequency data (e.g., when contact is deleted).
 */
export async function removeCallFrequency(jid: string): Promise<void> {
  try {
    const frequency = await getCallFrequency();
    if (jid in frequency) {
      delete frequency[jid];
      await AsyncStorage.setItem(CALL_FREQUENCY_KEY, JSON.stringify(frequency));
    }
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to remove call frequency');
  }
}
