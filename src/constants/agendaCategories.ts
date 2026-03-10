/**
 * Agenda Category & Form Type Definitions
 *
 * Simplified 2-step agenda creation:
 * 1. User taps "+ Nieuwe afspraak" → opens form directly
 * 2. Form has Type picker (Afspraak/Herinnering/Medicatie) + Category picker
 *
 * Key concepts:
 * - **FormType** determines which fields the form shows
 * - **Category** is purely visual (emoji + name), stored as snapshot on each item
 * - **Standard categories** are pre-installed (8 built-in)
 * - **Custom categories** are user-created via curated emoji picker
 * - **Automatic categories** are derived from Contact model dates (birthday, wedding, memorial)
 *
 * Snapshot principle: Each agenda item stores its own categoryIcon + categoryName.
 * Editing/deleting a custom category does NOT affect existing items.
 */

// ============================================================
// Types
// ============================================================

/** Form type determines which fields the form shows */
export type AgendaFormType = 'appointment' | 'reminder' | 'medication';

/** Category ID — string for standard, 'custom-{uuid}' for user-created */
export type AgendaCategoryId = string;

/**
 * Legacy AgendaCategory type — kept for backward compatibility with
 * existing database records and dependent modules.
 */
export type AgendaCategory =
  | 'doctor'
  | 'dentist'
  | 'hairdresser'
  | 'optician'
  | 'bank'
  | 'municipality'
  | 'other'
  | 'family'
  | 'reminder'
  | 'medication'
  // Automatic from contacts (not user-creatable):
  | 'birthday'
  | 'wedding'
  | 'memorial'
  // Custom categories use string IDs:
  | string;

export type RepeatType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export type ReminderOffset =
  | 'at_time'
  | '15_min_before'
  | '30_min_before'
  | '1_hour_before'
  | '1_day_before';

// ============================================================
// Form Type Definitions
// ============================================================

export interface FormTypeDefinition {
  id: AgendaFormType;
  labelKey: string;
  icon: string;
  /** Fields this form type shows */
  showTimeField: boolean;
  showMultipleTimes: boolean;
  showContactsField: boolean;
  showAddressField: boolean;
  showMedicationConfirmation: boolean;
  /** Default values */
  defaultRepeat: RepeatType | null;
  defaultReminder: ReminderOffset;
}

export const FORM_TYPES: FormTypeDefinition[] = [
  {
    id: 'appointment',
    labelKey: 'modules.agenda.formTypes.appointment',
    icon: '📅',
    showTimeField: true,
    showMultipleTimes: false,
    showContactsField: true,
    showAddressField: true,
    showMedicationConfirmation: false,
    defaultRepeat: null,
    defaultReminder: '1_hour_before',
  },
  {
    id: 'reminder',
    labelKey: 'modules.agenda.formTypes.reminder',
    icon: '🔔',
    showTimeField: true,
    showMultipleTimes: false,
    showContactsField: false,
    showAddressField: false,
    showMedicationConfirmation: false,
    defaultRepeat: null,
    defaultReminder: 'at_time',
  },
  {
    id: 'medication',
    labelKey: 'modules.agenda.formTypes.medication',
    icon: '💊',
    showTimeField: true,
    showMultipleTimes: true,
    showContactsField: false,
    showAddressField: false,
    showMedicationConfirmation: true,
    defaultRepeat: 'daily',
    defaultReminder: 'at_time',
  },
];

/** Get form type definition by id */
export function getFormType(id: AgendaFormType): FormTypeDefinition {
  return FORM_TYPES.find(ft => ft.id === id) ?? FORM_TYPES[0];
}

// ============================================================
// Category Definitions (simplified — purely visual)
// ============================================================

export interface AgendaCategoryDef {
  /** Unique identifier ('doctor', 'custom-abc123', etc.) */
  id: AgendaCategoryId;
  /** Display emoji */
  icon: string;
  /** Display name (i18n key for standard, plain text for custom) */
  name: string;
  /** Whether this is a standard (built-in) category */
  isStandard: boolean;
  /** Default form type when creating with this category */
  defaultFormType: AgendaFormType;
  /** Whether this is an automatic category (from contacts) */
  isAutomatic: boolean;
}

/** Standard built-in categories (same status as custom, but pre-installed) */
export const STANDARD_CATEGORIES: AgendaCategoryDef[] = [
  { id: 'doctor', icon: '🏥', name: 'modules.agenda.categories.doctor', isStandard: true, defaultFormType: 'appointment', isAutomatic: false },
  { id: 'dentist', icon: '🦷', name: 'modules.agenda.categories.dentist', isStandard: true, defaultFormType: 'appointment', isAutomatic: false },
  { id: 'hairdresser', icon: '💇', name: 'modules.agenda.categories.hairdresser', isStandard: true, defaultFormType: 'appointment', isAutomatic: false },
  { id: 'optician', icon: '👁️', name: 'modules.agenda.categories.optician', isStandard: true, defaultFormType: 'appointment', isAutomatic: false },
  { id: 'bank', icon: '🏦', name: 'modules.agenda.categories.bank', isStandard: true, defaultFormType: 'appointment', isAutomatic: false },
  { id: 'municipality', icon: '🏛️', name: 'modules.agenda.categories.municipality', isStandard: true, defaultFormType: 'appointment', isAutomatic: false },
  { id: 'family', icon: '👨‍👩‍👧', name: 'modules.agenda.categories.family', isStandard: true, defaultFormType: 'appointment', isAutomatic: false },
  { id: 'other', icon: '📋', name: 'modules.agenda.categories.other', isStandard: true, defaultFormType: 'appointment', isAutomatic: false },
];

/** Automatic categories derived from Contact model dates */
export const AUTOMATIC_CATEGORIES: AgendaCategoryDef[] = [
  { id: 'birthday', icon: '🎂', name: 'modules.agenda.categories.birthday', isStandard: true, defaultFormType: 'reminder', isAutomatic: true },
  { id: 'wedding', icon: '💒', name: 'modules.agenda.categories.wedding', isStandard: true, defaultFormType: 'reminder', isAutomatic: true },
  { id: 'memorial', icon: '🕯️', name: 'modules.agenda.categories.memorial', isStandard: true, defaultFormType: 'reminder', isAutomatic: true },
];

// ============================================================
// Curated Emoji Picker (40 emojis in 7 groups)
// ============================================================

export interface EmojiGroup {
  id: string;
  labelKey: string;
  emojis: string[];
}

export const CURATED_EMOJI_GROUPS: EmojiGroup[] = [
  {
    id: 'health',
    labelKey: 'modules.agenda.emojiGroups.health',
    emojis: ['🏥', '🦷', '👁️', '💊', '🩺', '🧠', '💉', '♿'],
  },
  {
    id: 'financial',
    labelKey: 'modules.agenda.emojiGroups.financial',
    emojis: ['🏦', '💰', '📊', '🧾'],
  },
  {
    id: 'sports',
    labelKey: 'modules.agenda.emojiGroups.sports',
    emojis: ['⛳', '🎣', '🚴', '🏊', '🎨', '🎵', '📚', '🌱'],
  },
  {
    id: 'social',
    labelKey: 'modules.agenda.emojiGroups.social',
    emojis: ['👨‍👩‍👧', '🎂', '🍽️', '☕', '🎉', '💒'],
  },
  {
    id: 'transport',
    labelKey: 'modules.agenda.emojiGroups.transport',
    emojis: ['✈️', '🚗', '🚂', '🏖️', '🗺️'],
  },
  {
    id: 'home',
    labelKey: 'modules.agenda.emojiGroups.home',
    emojis: ['🏠', '🔧', '🧹', '🌳', '📦'],
  },
  {
    id: 'other',
    labelKey: 'modules.agenda.emojiGroups.other',
    emojis: ['📋', '🔔', '📝', '⭐'],
  },
];

// ============================================================
// Legacy Compatibility
// ============================================================

/**
 * Legacy CategoryDefinition — kept for backward compatibility.
 * New code should use AgendaCategoryDef + FormTypeDefinition instead.
 */
export type CategoryGroup = 'appointments' | 'family' | 'reminders';

export interface CategoryDefinition {
  id: AgendaCategory;
  icon: string;
  labelKey: string;
  group: CategoryGroup;
  defaultRepeat: RepeatType | null;
  defaultReminder: ReminderOffset;
  showTimeField: boolean;
  showMultipleTimes: boolean;
  showContactsField: boolean;
  showAddressField: boolean;
  showMedicationConfirmation: boolean;
  isAutomatic: boolean;
}

/**
 * Legacy AGENDA_CATEGORIES array — maps old categories to new system.
 * Used by existing code that hasn't migrated yet.
 */
export const AGENDA_CATEGORIES: CategoryDefinition[] = [
  // Appointments
  { id: 'doctor', icon: '🏥', labelKey: 'modules.agenda.categories.doctor', group: 'appointments', defaultRepeat: null, defaultReminder: '1_hour_before', showTimeField: true, showMultipleTimes: false, showContactsField: true, showAddressField: true, showMedicationConfirmation: false, isAutomatic: false },
  { id: 'dentist', icon: '🦷', labelKey: 'modules.agenda.categories.dentist', group: 'appointments', defaultRepeat: null, defaultReminder: '1_hour_before', showTimeField: true, showMultipleTimes: false, showContactsField: true, showAddressField: true, showMedicationConfirmation: false, isAutomatic: false },
  { id: 'hairdresser', icon: '💇', labelKey: 'modules.agenda.categories.hairdresser', group: 'appointments', defaultRepeat: null, defaultReminder: '1_hour_before', showTimeField: true, showMultipleTimes: false, showContactsField: true, showAddressField: true, showMedicationConfirmation: false, isAutomatic: false },
  { id: 'optician', icon: '👁️', labelKey: 'modules.agenda.categories.optician', group: 'appointments', defaultRepeat: null, defaultReminder: '1_hour_before', showTimeField: true, showMultipleTimes: false, showContactsField: true, showAddressField: true, showMedicationConfirmation: false, isAutomatic: false },
  { id: 'bank', icon: '🏦', labelKey: 'modules.agenda.categories.bank', group: 'appointments', defaultRepeat: null, defaultReminder: '1_hour_before', showTimeField: true, showMultipleTimes: false, showContactsField: true, showAddressField: true, showMedicationConfirmation: false, isAutomatic: false },
  { id: 'municipality', icon: '🏛️', labelKey: 'modules.agenda.categories.municipality', group: 'appointments', defaultRepeat: null, defaultReminder: '1_hour_before', showTimeField: true, showMultipleTimes: false, showContactsField: true, showAddressField: true, showMedicationConfirmation: false, isAutomatic: false },
  { id: 'other', icon: '📋', labelKey: 'modules.agenda.categories.other', group: 'appointments', defaultRepeat: null, defaultReminder: '30_min_before', showTimeField: true, showMultipleTimes: false, showContactsField: true, showAddressField: true, showMedicationConfirmation: false, isAutomatic: false },
  // Family
  { id: 'family', icon: '👨‍👩‍👧', labelKey: 'modules.agenda.categories.family', group: 'family', defaultRepeat: null, defaultReminder: '1_hour_before', showTimeField: true, showMultipleTimes: false, showContactsField: true, showAddressField: true, showMedicationConfirmation: false, isAutomatic: false },
  // Reminders
  { id: 'reminder', icon: '🔔', labelKey: 'modules.agenda.categories.reminder', group: 'reminders', defaultRepeat: null, defaultReminder: 'at_time', showTimeField: true, showMultipleTimes: false, showContactsField: false, showAddressField: false, showMedicationConfirmation: false, isAutomatic: false },
  { id: 'medication', icon: '💊', labelKey: 'modules.agenda.categories.medication', group: 'reminders', defaultRepeat: 'daily', defaultReminder: 'at_time', showTimeField: true, showMultipleTimes: true, showContactsField: false, showAddressField: false, showMedicationConfirmation: true, isAutomatic: false },
  // Automatic from contacts
  { id: 'birthday', icon: '🎂', labelKey: 'modules.agenda.categories.birthday', group: 'family', defaultRepeat: 'yearly', defaultReminder: '1_day_before', showTimeField: false, showMultipleTimes: false, showContactsField: false, showAddressField: false, showMedicationConfirmation: false, isAutomatic: true },
  { id: 'wedding', icon: '💒', labelKey: 'modules.agenda.categories.wedding', group: 'family', defaultRepeat: 'yearly', defaultReminder: '1_day_before', showTimeField: false, showMultipleTimes: false, showContactsField: false, showAddressField: false, showMedicationConfirmation: false, isAutomatic: true },
  { id: 'memorial', icon: '🕯️', labelKey: 'modules.agenda.categories.memorial', group: 'family', defaultRepeat: 'yearly', defaultReminder: '1_day_before', showTimeField: false, showMultipleTimes: false, showContactsField: false, showAddressField: false, showMedicationConfirmation: false, isAutomatic: true },
];

// ============================================================
// Helpers
// ============================================================

/** Categories available in the picker (manual only) — legacy */
export const MANUAL_CATEGORIES = AGENDA_CATEGORIES.filter(c => !c.isAutomatic);

/** Category groups for the picker screen — legacy */
export const CATEGORY_GROUPS: { key: CategoryGroup; labelKey: string }[] = [
  { key: 'appointments', labelKey: 'modules.agenda.groups.appointments' },
  { key: 'family', labelKey: 'modules.agenda.groups.family' },
  { key: 'reminders', labelKey: 'modules.agenda.groups.reminders' },
];

/** Get category definition by id — legacy */
export function getCategoryById(id: AgendaCategory): CategoryDefinition | undefined {
  return AGENDA_CATEGORIES.find(c => c.id === id);
}

/** Get icon for a category — works for both standard and custom */
export function getCategoryIcon(id: AgendaCategory): string {
  // First check standard categories
  const standard = STANDARD_CATEGORIES.find(c => c.id === id);
  if (standard) return standard.icon;
  // Check automatic
  const auto = AUTOMATIC_CATEGORIES.find(c => c.id === id);
  if (auto) return auto.icon;
  // Legacy fallback
  const legacy = getCategoryById(id);
  if (legacy) return legacy.icon;
  // Default
  return '📋';
}

/** Infer form type from legacy category id */
export function getFormTypeForCategory(categoryId: AgendaCategory): AgendaFormType {
  if (categoryId === 'medication') return 'medication';
  if (categoryId === 'reminder') return 'reminder';
  if (categoryId === 'birthday' || categoryId === 'wedding' || categoryId === 'memorial') return 'reminder';
  return 'appointment';
}

/** Repeat type labels (i18n keys) */
export const REPEAT_OPTIONS: { value: RepeatType | null; labelKey: string }[] = [
  { value: null, labelKey: 'modules.agenda.repeat.none' },
  { value: 'daily', labelKey: 'modules.agenda.repeat.daily' },
  { value: 'weekly', labelKey: 'modules.agenda.repeat.weekly' },
  { value: 'biweekly', labelKey: 'modules.agenda.repeat.biweekly' },
  { value: 'monthly', labelKey: 'modules.agenda.repeat.monthly' },
  { value: 'yearly', labelKey: 'modules.agenda.repeat.yearly' },
];

/** Reminder offset labels (i18n keys) */
export const REMINDER_OPTIONS: { value: ReminderOffset; labelKey: string }[] = [
  { value: 'at_time', labelKey: 'modules.agenda.reminder.atTime' },
  { value: '15_min_before', labelKey: 'modules.agenda.reminder.15min' },
  { value: '30_min_before', labelKey: 'modules.agenda.reminder.30min' },
  { value: '1_hour_before', labelKey: 'modules.agenda.reminder.1hour' },
  { value: '1_day_before', labelKey: 'modules.agenda.reminder.1day' },
];

/** Convert ReminderOffset to milliseconds */
export function reminderOffsetToMs(offset: ReminderOffset): number {
  switch (offset) {
    case 'at_time': return 0;
    case '15_min_before': return 15 * 60 * 1000;
    case '30_min_before': return 30 * 60 * 1000;
    case '1_hour_before': return 60 * 60 * 1000;
    case '1_day_before': return 24 * 60 * 60 * 1000;
  }
}

// ============================================================
// Custom Categories — AsyncStorage persistence
// ============================================================

/** AsyncStorage key for custom categories */
export const CUSTOM_CATEGORIES_STORAGE_KEY = '@agenda/customCategories';

export interface CustomCategory {
  id: string;        // 'custom-{uuid}'
  icon: string;      // Emoji from curated picker
  name: string;      // User-entered name (plain text, not i18n key)
  formType: AgendaFormType;
  createdAt: number;
}
