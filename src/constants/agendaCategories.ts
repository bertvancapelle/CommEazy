/**
 * Agenda Category Definitions
 *
 * Predefined categories with icons, i18n keys, and smart defaults
 * for repeat pattern and reminder offset.
 *
 * Categories are split into:
 * - Manual: User-creatable via "+ Nieuw item toevoegen"
 * - Automatic: Derived from Contact model dates (birthday, wedding, memorial)
 */

// ============================================================
// Types
// ============================================================

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
  | 'memorial';

export type RepeatType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export type ReminderOffset =
  | 'at_time'
  | '15_min_before'
  | '30_min_before'
  | '1_hour_before'
  | '1_day_before';

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

// ============================================================
// Category Definitions
// ============================================================

export const AGENDA_CATEGORIES: CategoryDefinition[] = [
  // Appointments
  {
    id: 'doctor',
    icon: '🏥',
    labelKey: 'modules.agenda.categories.doctor',
    group: 'appointments',
    defaultRepeat: null,
    defaultReminder: '1_hour_before',
    showTimeField: true,
    showMultipleTimes: false,
    showContactsField: true,
    showAddressField: true,
    showMedicationConfirmation: false,
    isAutomatic: false,
  },
  {
    id: 'dentist',
    icon: '🦷',
    labelKey: 'modules.agenda.categories.dentist',
    group: 'appointments',
    defaultRepeat: null,
    defaultReminder: '1_hour_before',
    showTimeField: true,
    showMultipleTimes: false,
    showContactsField: true,
    showAddressField: true,
    showMedicationConfirmation: false,
    isAutomatic: false,
  },
  {
    id: 'hairdresser',
    icon: '💇',
    labelKey: 'modules.agenda.categories.hairdresser',
    group: 'appointments',
    defaultRepeat: null,
    defaultReminder: '1_hour_before',
    showTimeField: true,
    showMultipleTimes: false,
    showContactsField: true,
    showAddressField: true,
    showMedicationConfirmation: false,
    isAutomatic: false,
  },
  {
    id: 'optician',
    icon: '👁️',
    labelKey: 'modules.agenda.categories.optician',
    group: 'appointments',
    defaultRepeat: null,
    defaultReminder: '1_hour_before',
    showTimeField: true,
    showMultipleTimes: false,
    showContactsField: true,
    showAddressField: true,
    showMedicationConfirmation: false,
    isAutomatic: false,
  },
  {
    id: 'bank',
    icon: '🏦',
    labelKey: 'modules.agenda.categories.bank',
    group: 'appointments',
    defaultRepeat: null,
    defaultReminder: '1_hour_before',
    showTimeField: true,
    showMultipleTimes: false,
    showContactsField: true,
    showAddressField: true,
    showMedicationConfirmation: false,
    isAutomatic: false,
  },
  {
    id: 'municipality',
    icon: '🏛️',
    labelKey: 'modules.agenda.categories.municipality',
    group: 'appointments',
    defaultRepeat: null,
    defaultReminder: '1_hour_before',
    showTimeField: true,
    showMultipleTimes: false,
    showContactsField: true,
    showAddressField: true,
    showMedicationConfirmation: false,
    isAutomatic: false,
  },
  {
    id: 'other',
    icon: '📋',
    labelKey: 'modules.agenda.categories.other',
    group: 'appointments',
    defaultRepeat: null,
    defaultReminder: '30_min_before',
    showTimeField: true,
    showMultipleTimes: false,
    showContactsField: true,
    showAddressField: true,
    showMedicationConfirmation: false,
    isAutomatic: false,
  },
  // Family
  {
    id: 'family',
    icon: '👨‍👩‍👧',
    labelKey: 'modules.agenda.categories.family',
    group: 'family',
    defaultRepeat: null,
    defaultReminder: '1_hour_before',
    showTimeField: true,
    showMultipleTimes: false,
    showContactsField: true,
    showAddressField: true,
    showMedicationConfirmation: false,
    isAutomatic: false,
  },
  // Reminders
  {
    id: 'reminder',
    icon: '🔔',
    labelKey: 'modules.agenda.categories.reminder',
    group: 'reminders',
    defaultRepeat: null,
    defaultReminder: 'at_time',
    showTimeField: true,
    showMultipleTimes: false,
    showContactsField: false,
    showAddressField: false,
    showMedicationConfirmation: false,
    isAutomatic: false,
  },
  {
    id: 'medication',
    icon: '💊',
    labelKey: 'modules.agenda.categories.medication',
    group: 'reminders',
    defaultRepeat: 'daily',
    defaultReminder: 'at_time',
    showTimeField: true,
    showMultipleTimes: true,
    showContactsField: false,
    showAddressField: false,
    showMedicationConfirmation: true,
    isAutomatic: false,
  },
  // Automatic from contacts (not in picker)
  {
    id: 'birthday',
    icon: '🎂',
    labelKey: 'modules.agenda.categories.birthday',
    group: 'family',
    defaultRepeat: 'yearly',
    defaultReminder: '1_day_before',
    showTimeField: false,
    showMultipleTimes: false,
    showContactsField: false,
    showAddressField: false,
    showMedicationConfirmation: false,
    isAutomatic: true,
  },
  {
    id: 'wedding',
    icon: '💒',
    labelKey: 'modules.agenda.categories.wedding',
    group: 'family',
    defaultRepeat: 'yearly',
    defaultReminder: '1_day_before',
    showTimeField: false,
    showMultipleTimes: false,
    showContactsField: false,
    showAddressField: false,
    showMedicationConfirmation: false,
    isAutomatic: true,
  },
  {
    id: 'memorial',
    icon: '🕯️',
    labelKey: 'modules.agenda.categories.memorial',
    group: 'family',
    defaultRepeat: 'yearly',
    defaultReminder: '1_day_before',
    showTimeField: false,
    showMultipleTimes: false,
    showContactsField: false,
    showAddressField: false,
    showMedicationConfirmation: false,
    isAutomatic: true,
  },
];

// ============================================================
// Helpers
// ============================================================

/** Categories available in the picker (manual only) */
export const MANUAL_CATEGORIES = AGENDA_CATEGORIES.filter(c => !c.isAutomatic);

/** Categories derived from contact dates */
export const AUTOMATIC_CATEGORIES = AGENDA_CATEGORIES.filter(c => c.isAutomatic);

/** Category groups for the picker screen */
export const CATEGORY_GROUPS: { key: CategoryGroup; labelKey: string }[] = [
  { key: 'appointments', labelKey: 'modules.agenda.groups.appointments' },
  { key: 'family', labelKey: 'modules.agenda.groups.family' },
  { key: 'reminders', labelKey: 'modules.agenda.groups.reminders' },
];

/** Get category definition by id */
export function getCategoryById(id: AgendaCategory): CategoryDefinition | undefined {
  return AGENDA_CATEGORIES.find(c => c.id === id);
}

/** Get icon for a category */
export function getCategoryIcon(id: AgendaCategory): string {
  return getCategoryById(id)?.icon ?? '📋';
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
