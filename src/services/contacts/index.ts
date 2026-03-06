/**
 * Contact Services — Central export for contact group management
 *
 * Import from '@/services/contacts' for consistency.
 */

// Contact Group CRUD
export {
  getGroups,
  getGroupById,
  createGroup,
  renameGroup,
  deleteGroup,
  updateGroupEmoji,
  addContactsToGroup,
  removeContactsFromGroup,
  removeContactFromAllGroups,
  getCallFrequency,
  incrementCallFrequency,
  removeCallFrequency,
} from './contactGroupService';
export type { ContactGroup } from './contactGroupService';

// Smart Sections (automatic grouping)
export {
  getSmartSections,
  getIceContacts,
  getUpcomingBirthdays,
  getFrequentCalls,
  getLongNoContact,
  getRecentlyAdded,
  getDaysUntilBirthday,
} from './smartSections';
export type { SmartSectionId, SmartSection } from './smartSections';
