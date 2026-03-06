/**
 * useContactGroups — React hook for contact group state management
 *
 * Provides CRUD operations with automatic state updates.
 * Follows the usePhotoAlbums.ts pattern: load on mount, re-read after mutations.
 *
 * @see .claude/plans/CONTACT_GROUPS.md
 */

import { useState, useCallback, useEffect } from 'react';
import type { ContactGroup } from '@/services/contacts';
import {
  getGroups,
  createGroup as createGroupService,
  renameGroup as renameGroupService,
  deleteGroup as deleteGroupService,
  updateGroupEmoji as updateGroupEmojiService,
  addContactsToGroup as addContactsService,
  removeContactsFromGroup as removeContactsService,
} from '@/services/contacts';

// ============================================================
// Types
// ============================================================

export interface UseContactGroupsReturn {
  /** All contact groups, sorted by most recently updated */
  groups: ContactGroup[];
  /** Whether groups are being loaded */
  isLoading: boolean;
  /** Reload groups from storage */
  reload: () => Promise<void>;
  /** Create a new group */
  create: (name: string, emoji?: string, jids?: string[]) => Promise<ContactGroup | undefined>;
  /** Rename a group */
  rename: (groupId: string, name: string) => Promise<boolean>;
  /** Delete a group */
  remove: (groupId: string) => Promise<boolean>;
  /** Update group emoji */
  updateEmoji: (groupId: string, emoji: string) => Promise<boolean>;
  /** Add contacts to a group */
  addContacts: (groupId: string, jids: string[]) => Promise<boolean>;
  /** Remove contacts from a group */
  removeContacts: (groupId: string, jids: string[]) => Promise<boolean>;
}

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[useContactGroups]';

// ============================================================
// Hook
// ============================================================

export function useContactGroups(): UseContactGroupsReturn {
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load groups from storage
  const reload = useCallback(async () => {
    try {
      const loaded = await getGroups();
      setGroups(loaded);
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to load groups');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    reload();
  }, [reload]);

  // Create a new group
  const create = useCallback(async (
    name: string,
    emoji?: string,
    jids?: string[],
  ): Promise<ContactGroup | undefined> => {
    try {
      const newGroup = await createGroupService(name, emoji, jids);
      await reload();
      return newGroup;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to create group');
      return undefined;
    }
  }, [reload]);

  // Rename a group
  const rename = useCallback(async (groupId: string, name: string): Promise<boolean> => {
    try {
      const success = await renameGroupService(groupId, name);
      if (success) await reload();
      return success;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to rename group');
      return false;
    }
  }, [reload]);

  // Delete a group
  const remove = useCallback(async (groupId: string): Promise<boolean> => {
    try {
      const success = await deleteGroupService(groupId);
      if (success) await reload();
      return success;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to delete group');
      return false;
    }
  }, [reload]);

  // Update group emoji
  const updateEmoji = useCallback(async (groupId: string, emoji: string): Promise<boolean> => {
    try {
      const success = await updateGroupEmojiService(groupId, emoji);
      if (success) await reload();
      return success;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to update group emoji');
      return false;
    }
  }, [reload]);

  // Add contacts to a group
  const addContacts = useCallback(async (groupId: string, jids: string[]): Promise<boolean> => {
    try {
      const success = await addContactsService(groupId, jids);
      if (success) await reload();
      return success;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to add contacts to group');
      return false;
    }
  }, [reload]);

  // Remove contacts from a group
  const removeContacts = useCallback(async (groupId: string, jids: string[]): Promise<boolean> => {
    try {
      const success = await removeContactsService(groupId, jids);
      if (success) await reload();
      return success;
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to remove contacts from group');
      return false;
    }
  }, [reload]);

  return {
    groups,
    isLoading,
    reload,
    create,
    rename,
    remove,
    updateEmoji,
    addContacts,
    removeContacts,
  };
}
