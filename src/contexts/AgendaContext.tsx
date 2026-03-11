/**
 * AgendaContext — Timeline state management
 *
 * Merges two data sources into a unified timeline:
 * 1. AgendaItem records (manual: appointments, reminders, medication)
 * 2. Contact dates (automatic: birthdays, wedding dates, memorial dates)
 *
 * Items are sorted chronologically with "today" as the anchor point.
 * Past items are hidden from the main timeline but accessible via
 * "Afgelopen bekijken".
 *
 * @see constants/agendaCategories.ts for category definitions
 * @see models/AgendaItem.ts for database model
 * @see .claude/plans/AGENDA_MODULE.md for full spec
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { Q } from '@nozbe/watermelondb';

import { ServiceContainer } from '@/services/container';
import { WatermelonDBService } from '@/services/database';
import { AgendaItemModel, type MedicationLogEntry } from '@/models/AgendaItem';
import { ContactModel } from '@/models/Contact';
import type {
  AgendaCategory,
  AgendaFormType,
  RepeatType,
  ReminderOffset,
} from '@/constants/agendaCategories';
import { getCategoryIcon, getFormTypeForCategory } from '@/constants/agendaCategories';

// ============================================================
// Types
// ============================================================

/** Unified timeline item — represents both manual items and contact dates */
export interface TimelineItem {
  /** Unique ID (AgendaItem ID or generated contact date ID) */
  id: string;
  /** Item source */
  source: 'manual' | 'contact';
  /** Category */
  category: AgendaCategory;
  /** Category icon emoji */
  icon: string;
  /** Category display name (snapshot — may be i18n key or plain text) */
  categoryName: string | null;
  /** Form type (appointment/reminder/medication) */
  formType: AgendaFormType;
  /** Display title */
  title: string;
  /** Date timestamp (for the specific occurrence) */
  date: number;
  /** Time string "HH:MM" or null for all-day */
  time: string | null;
  /** Multiple times (medication) */
  times: string[];
  /** Is recurring */
  isRecurring: boolean;
  /** Repeat type */
  repeatType: RepeatType | null;
  /** End date for recurring */
  endDate: number | null;
  /** Reminder offset */
  reminderOffset: ReminderOffset;
  /** Linked contact IDs */
  contactIds: string[];
  /** Contact names (resolved) */
  contactNames: string[];
  /** Contact photo paths (resolved, null for contacts without photo) */
  contactPhotoPaths: (string | null)[];
  /** End time "HH:MM" or null */
  endTime: string | null;
  /** Free-text notes */
  notes: string | null;
  /** Location name (e.g. "Huisartsenpraktijk De Linde") */
  locationName: string | null;
  /** Address street */
  addressStreet: string | null;
  /** Address postal code */
  addressPostalCode: string | null;
  /** Address city */
  addressCity: string | null;
  /** Address country */
  addressCountry: string | null;
  /** Is medication with confirmation */
  isMedication: boolean;
  /** Medication log entries (if medication) */
  medicationLog: MedicationLogEntry[];
  /** Has been shared */
  sharedWith: string[];
  /** Received from */
  sharedFrom: string | null;
  /** Is hidden (soft-deleted) */
  isHidden: boolean;
  /** Reference to underlying model (null for contact dates) */
  modelId: string | null;
  /** Additional info for contact dates */
  contactName?: string;
  /** Years since (for birthday/anniversary display) */
  yearsSince?: number;
}

/** Day group for timeline display */
export interface TimelineDay {
  /** Date string "YYYY-MM-DD" */
  dateKey: string;
  /** Display label ("Vandaag", "Morgen", "Woensdag 12 maart", etc.) */
  label: string;
  /** Items for this day */
  items: TimelineItem[];
  /** Is today */
  isToday: boolean;
  /** Is in the past */
  isPast: boolean;
}

export interface AgendaContextValue {
  // Timeline data
  timelineDays: TimelineDay[];
  pastItems: TimelineItem[];
  isLoading: boolean;

  // Contacts (for contact picker in form)
  contacts: ContactModel[];

  // Day-by-day navigation
  getItemsForDate: (date: Date) => TimelineItem[];

  // Universal search
  searchItems: (query: string, includePast: boolean) => TimelineItem[];

  // Actions
  refresh: () => Promise<void>;
  createItem: (data: CreateAgendaItemData) => Promise<string>;
  updateItem: (id: string, data: Partial<CreateAgendaItemData>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  hideItem: (id: string) => Promise<void>;
  logMedication: (id: string, entry: MedicationLogEntry) => Promise<void>;
  shareItem: (id: string, jids: string[]) => Promise<void>;

  // Recurring item actions
  updateSingleOccurrence: (parentId: string, date: number, data: Partial<CreateAgendaItemData>) => Promise<void>;
  deleteSingleOccurrence: (parentId: string, date: number) => Promise<void>;
}

export interface CreateAgendaItemData {
  category: AgendaCategory;
  /** Category icon snapshot (emoji) */
  categoryIcon?: string;
  /** Category name snapshot (display name) */
  categoryName?: string;
  /** Form type (appointment/reminder/medication) */
  formType?: AgendaFormType;
  title: string;
  date: number;
  time?: string;
  times?: string[];
  repeatType?: RepeatType;
  endDate?: number;
  reminderOffset: ReminderOffset;
  contactIds?: string[];
  // Location / Address (v18)
  locationName?: string;
  addressStreet?: string;
  addressPostalCode?: string;
  addressCity?: string;
  addressCountry?: string;
  sharedFrom?: string;
  // End time + notes + source (v21 — ICS calendar import)
  endTime?: string;
  notes?: string;
  source?: string;
}

// ============================================================
// Context
// ============================================================

const AgendaContext = createContext<AgendaContextValue | null>(null);

// ============================================================
// Helper Functions
// ============================================================

/** Get start of day timestamp */
function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Get date key string "YYYY-MM-DD" */
function toDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Check if a date falls on a given day */
function isSameDay(ts1: number, ts2: number): boolean {
  return toDateKey(ts1) === toDateKey(ts2);
}

/** Calculate years between two dates */
function yearsBetween(fromDate: string, toDate: Date): number {
  const from = new Date(fromDate);
  let years = toDate.getFullYear() - from.getFullYear();
  const monthDiff = toDate.getMonth() - from.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && toDate.getDate() < from.getDate())) {
    years--;
  }
  return years;
}

/** Get next occurrence of an annual date for the timeline */
function getNextAnnualOccurrence(isoDate: string, fromDate: Date): Date | null {
  if (!isoDate) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return null;

  const thisYear = new Date(fromDate.getFullYear(), month - 1, day);
  if (thisYear >= fromDate) return thisYear;

  return new Date(fromDate.getFullYear() + 1, month - 1, day);
}

/** Generate recurring occurrences within a date range */
function generateOccurrences(
  item: AgendaItemModel,
  startRange: number,
  endRange: number,
): { date: number; time: string | null; times: string[] }[] {
  const occurrences: { date: number; time: string | null; times: string[] }[] = [];
  const repeatType = item.repeatType as RepeatType | undefined;
  if (!repeatType) {
    // Single occurrence
    if (item.itemDate >= startRange && item.itemDate <= endRange) {
      occurrences.push({
        date: item.itemDate,
        time: item.time ?? null,
        times: item.parsedTimes,
      });
    }
    return occurrences;
  }

  // Recurring: generate occurrences (normalize to start-of-day to avoid timezone drift)
  let current = new Date(startOfDay(item.itemDate));
  const endDate = item.endDate ? new Date(item.endDate) : null;
  const rangeEnd = new Date(endRange);

  // Limit to prevent infinite loops
  const maxOccurrences = 365;
  let count = 0;

  while (current.getTime() <= rangeEnd.getTime() && count < maxOccurrences) {
    if (endDate && current > endDate) break;

    if (current.getTime() >= startRange) {
      occurrences.push({
        date: current.getTime(),
        time: item.time ?? null,
        times: item.parsedTimes,
      });
    }

    // Advance to next occurrence
    count++;
    switch (repeatType) {
      case 'daily':
        current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'biweekly':
        current = new Date(current.getTime() + 14 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly': {
        const nextMonth = new Date(current);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        current = nextMonth;
        break;
      }
      case 'yearly': {
        const nextYear = new Date(current);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        current = nextYear;
        break;
      }
    }
  }

  return occurrences;
}

// ============================================================
// Provider
// ============================================================

export function AgendaProvider({ children }: { children: ReactNode }) {
  const [agendaItems, setAgendaItems] = useState<AgendaItemModel[]>([]);
  const [contacts, setContacts] = useState<ContactModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from database
  const loadData = useCallback(async () => {
    try {
      const dbService = ServiceContainer.database as WatermelonDBService;
      const db = dbService.getDb();

      // Load agenda items
      const itemCollection = db.get<AgendaItemModel>('agenda_items');
      const items = await AgendaItemModel.queryVisible(itemCollection).fetch();
      setAgendaItems(items);

      // Load contacts (for dates)
      const contactCollection = db.get<ContactModel>('contacts');
      const allContacts = await ContactModel.queryAll(contactCollection).fetch();
      setContacts(allContacts);
    } catch (error) {
      console.error('[AgendaContext] Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build timeline from merged data sources
  const { timelineDays, pastItems, allSortedItems } = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now.getTime());
    // Look ahead 90 days for timeline
    const rangeEnd = todayStart + 90 * 24 * 60 * 60 * 1000;

    const allItems: TimelineItem[] = [];

    // 1. Contact dates (automatic)
    for (const contact of contacts) {
      // Birthday
      if (contact.birthDate && !contact.isDeceased) {
        const nextOccurrence = getNextAnnualOccurrence(contact.birthDate, now);
        if (nextOccurrence && nextOccurrence.getTime() <= rangeEnd) {
          const years = yearsBetween(contact.birthDate, nextOccurrence);
          allItems.push({
            id: `contact-birthday-${contact.id}`,
            source: 'contact',
            category: 'birthday',
            icon: getCategoryIcon('birthday'),
            categoryName: 'modules.agenda.categories.birthday',
            formType: 'reminder' as AgendaFormType,
            title: contact.displayName,
            date: nextOccurrence.getTime(),
            time: null,
            times: [],
            isRecurring: true,
            repeatType: 'yearly',
            endDate: null,
            reminderOffset: '1_day_before',
            contactIds: [contact.id],
            contactNames: [contact.displayName],
            contactPhotoPaths: [contact.photoPath ?? null],
            endTime: null,
            notes: null,
            locationName: null,
            addressStreet: null,
            addressPostalCode: null,
            addressCity: null,
            addressCountry: null,
            isMedication: false,
            medicationLog: [],
            sharedWith: [],
            sharedFrom: null,
            isHidden: false,
            modelId: null,
            contactName: contact.displayName,
            yearsSince: years,
          });
        }
      }

      // Wedding date
      if (contact.weddingDate) {
        const nextOccurrence = getNextAnnualOccurrence(contact.weddingDate, now);
        if (nextOccurrence && nextOccurrence.getTime() <= rangeEnd) {
          const years = yearsBetween(contact.weddingDate, nextOccurrence);
          allItems.push({
            id: `contact-wedding-${contact.id}`,
            source: 'contact',
            category: 'wedding',
            icon: getCategoryIcon('wedding'),
            categoryName: 'modules.agenda.categories.wedding',
            formType: 'reminder' as AgendaFormType,
            title: contact.displayName,
            date: nextOccurrence.getTime(),
            time: null,
            times: [],
            isRecurring: true,
            repeatType: 'yearly',
            endDate: null,
            reminderOffset: '1_day_before',
            contactIds: [contact.id],
            contactNames: [contact.displayName],
            contactPhotoPaths: [contact.photoPath ?? null],
            endTime: null,
            notes: null,
            locationName: null,
            addressStreet: null,
            addressPostalCode: null,
            addressCity: null,
            addressCountry: null,
            isMedication: false,
            medicationLog: [],
            sharedWith: [],
            sharedFrom: null,
            isHidden: false,
            modelId: null,
            contactName: contact.displayName,
            yearsSince: years,
          });
        }
      }

      // Memorial (death date)
      if (contact.deathDate && contact.isDeceased) {
        const nextOccurrence = getNextAnnualOccurrence(contact.deathDate, now);
        if (nextOccurrence && nextOccurrence.getTime() <= rangeEnd) {
          allItems.push({
            id: `contact-memorial-${contact.id}`,
            source: 'contact',
            category: 'memorial',
            icon: getCategoryIcon('memorial'),
            categoryName: 'modules.agenda.categories.memorial',
            formType: 'reminder' as AgendaFormType,
            title: contact.displayName,
            date: nextOccurrence.getTime(),
            time: null,
            times: [],
            isRecurring: true,
            repeatType: 'yearly',
            endDate: null,
            reminderOffset: '1_day_before',
            contactIds: [contact.id],
            contactNames: [contact.displayName],
            contactPhotoPaths: [contact.photoPath ?? null],
            endTime: null,
            notes: null,
            locationName: null,
            addressStreet: null,
            addressPostalCode: null,
            addressCity: null,
            addressCountry: null,
            isMedication: false,
            medicationLog: [],
            sharedWith: [],
            sharedFrom: null,
            isHidden: false,
            modelId: null,
            contactName: contact.displayName,
          });
        }
      }
    }

    // 2. Manual agenda items (with recurring expansion)
    // Build contact name + photo lookup
    const contactMap = new Map(contacts.map(c => [c.id, { name: c.displayName, photoPath: c.photoPath ?? null }]));

    for (const item of agendaItems) {
      const occurrences = generateOccurrences(item, todayStart - 24 * 60 * 60 * 1000, rangeEnd);
      const linkedContactIds = item.parsedContactIds;
      const linkedContactNames = linkedContactIds.map(
        id => contactMap.get(id)?.name ?? '?',
      );
      const linkedContactPhotoPaths = linkedContactIds.map(
        id => contactMap.get(id)?.photoPath ?? null,
      );

      // Deduplicate occurrences by dateKey to prevent duplicate React keys
      const seenDates = new Set<string>();
      for (const occ of occurrences) {
        const dateKey = toDateKey(occ.date);
        if (seenDates.has(dateKey)) continue;
        seenDates.add(dateKey);
        allItems.push({
          id: `${item.id}-${dateKey}`,
          source: 'manual',
          category: item.category as AgendaCategory,
          icon: item.categoryIcon ?? getCategoryIcon(item.category as AgendaCategory),
          categoryName: item.categoryName ?? null,
          formType: (item.formType as AgendaFormType) ?? getFormTypeForCategory(item.category as AgendaCategory),
          title: item.title,
          date: occ.date,
          time: occ.time,
          times: occ.times,
          isRecurring: item.isRecurring,
          repeatType: (item.repeatType as RepeatType) ?? null,
          endDate: item.endDate ?? null,
          reminderOffset: item.reminderOffset as ReminderOffset,
          contactIds: linkedContactIds,
          contactNames: linkedContactNames,
          contactPhotoPaths: linkedContactPhotoPaths,
          isMedication: item.isMedication,
          medicationLog: item.parsedMedicationLog,
          sharedWith: item.parsedSharedWith,
          endTime: item.endTime ?? null,
          notes: item.notes ?? null,
          locationName: item.locationName ?? null,
          addressStreet: item.addressStreet ?? null,
          addressPostalCode: item.addressPostalCode ?? null,
          addressCity: item.addressCity ?? null,
          addressCountry: item.addressCountry ?? null,
          sharedFrom: item.sharedFrom ?? null,
          isHidden: item.isHidden,
          modelId: item.id,
        });
      }
    }

    // Sort all items chronologically
    allItems.sort((a, b) => {
      if (a.date !== b.date) return a.date - b.date;
      // Within same day, sort by time (items without time come first)
      const aTime = a.time ?? '00:00';
      const bTime = b.time ?? '00:00';
      return aTime.localeCompare(bTime);
    });

    // Split into future (timeline) and past
    const futureItems = allItems.filter(item => item.date >= todayStart);
    const past = allItems
      .filter(item => item.date < todayStart)
      .reverse(); // Most recent first for past

    // Group future items by day
    const dayMap = new Map<string, TimelineDay>();

    for (const item of futureItems) {
      const dateKey = toDateKey(item.date);
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          dateKey,
          label: '', // Will be set below
          items: [],
          isToday: isSameDay(item.date, now.getTime()),
          isPast: false,
        });
      }
      dayMap.get(dateKey)!.items.push(item);
    }

    // Also include today's past items (grayed out)
    const todayPastItems = allItems.filter(
      item => isSameDay(item.date, now.getTime()) && item.date < now.getTime() && item.time !== null,
    );
    if (todayPastItems.length > 0) {
      const todayKey = toDateKey(now.getTime());
      if (!dayMap.has(todayKey)) {
        dayMap.set(todayKey, {
          dateKey: todayKey,
          label: '',
          items: [],
          isToday: true,
          isPast: false,
        });
      }
      // Add past items at the beginning of today's list
      const todayDay = dayMap.get(todayKey)!;
      todayDay.items = [...todayPastItems, ...todayDay.items];
    }

    const days = Array.from(dayMap.values()).sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey),
    );

    return { timelineDays: days, pastItems: past, allSortedItems: allItems };
  }, [agendaItems, contacts]);

  // ============================================================
  // Day-by-day navigation — get items for a specific date
  // ============================================================

  const getItemsForDate = useCallback((date: Date): TimelineItem[] => {
    const targetKey = toDateKey(date.getTime());
    return allSortedItems.filter(item => toDateKey(item.date) === targetKey);
  }, [allSortedItems]);

  // ============================================================
  // Universal search — fuzzy/contains match across all fields
  // ============================================================

  const searchItems = useCallback((query: string, includePast: boolean): TimelineItem[] => {
    if (!query.trim()) return [];

    const q = query.toLowerCase().trim();
    const now = Date.now();

    return allSortedItems.filter(item => {
      // Filter by time: only include past if toggle is on
      if (!includePast && item.date < startOfDay(now)) return false;

      // Contains-match against title
      if (item.title.toLowerCase().includes(q)) return true;
      // Contains-match against contact names
      if (item.contactNames.some(n => n.toLowerCase().includes(q))) return true;
      // Contains-match against location name
      if (item.locationName?.toLowerCase().includes(q)) return true;
      // Contains-match against address parts
      if (item.addressStreet?.toLowerCase().includes(q)) return true;
      if (item.addressCity?.toLowerCase().includes(q)) return true;
      if (item.addressPostalCode?.toLowerCase().includes(q)) return true;

      return false;
    });
  }, [allSortedItems]);

  // ============================================================
  // Actions
  // ============================================================

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadData();
  }, [loadData]);

  const createItem = useCallback(async (data: CreateAgendaItemData): Promise<string> => {
    const dbService = ServiceContainer.database as WatermelonDBService;
    const db = dbService.getDb();
    const collection = db.get<AgendaItemModel>('agenda_items');

    let newId = '';
    await db.write(async () => {
      const record = await collection.create(r => {
        r.category = data.category;
        r.categoryIcon = data.categoryIcon;
        r.categoryName = data.categoryName;
        r.formType = data.formType;
        r.title = data.title;
        r.itemDate = data.date;
        r.time = data.time;
        r.times = data.times ? JSON.stringify(data.times) : undefined;
        r.repeatType = data.repeatType;
        r.endDate = data.endDate;
        r.reminderOffset = data.reminderOffset;
        r.contactIds = data.contactIds ? JSON.stringify(data.contactIds) : undefined;
        r.locationName = data.locationName;
        r.addressStreet = data.addressStreet;
        r.addressPostalCode = data.addressPostalCode;
        r.addressCity = data.addressCity;
        r.addressCountry = data.addressCountry;
        r.isHidden = false;
        r.sharedFrom = data.sharedFrom;
        r.endTime = data.endTime;
        r.notes = data.notes;
        r.source = data.source;
      });
      newId = record.id;
    });

    await loadData();
    return newId;
  }, [loadData]);

  const updateItem = useCallback(async (id: string, data: Partial<CreateAgendaItemData>) => {
    const dbService = ServiceContainer.database as WatermelonDBService;
    const db = dbService.getDb();
    const collection = db.get<AgendaItemModel>('agenda_items');

    const record = await collection.find(id);
    await record.updateItem({
      title: data.title,
      itemDate: data.date,
      time: data.time,
      times: data.times,
      repeatType: data.repeatType ?? null,
      endDate: data.endDate ?? null,
      reminderOffset: data.reminderOffset,
      contactIds: data.contactIds,
      locationName: data.locationName,
      addressStreet: data.addressStreet,
      addressPostalCode: data.addressPostalCode,
      addressCity: data.addressCity,
      addressCountry: data.addressCountry,
      category: data.category,
      categoryIcon: data.categoryIcon,
      categoryName: data.categoryName,
      formType: data.formType,
      endTime: data.endTime,
      notes: data.notes,
      source: data.source,
    });

    await loadData();
  }, [loadData]);

  const deleteItem = useCallback(async (id: string) => {
    const dbService = ServiceContainer.database as WatermelonDBService;
    const db = dbService.getDb();
    const collection = db.get<AgendaItemModel>('agenda_items');

    await db.write(async () => {
      const record = await collection.find(id);
      await record.markAsDeleted();
    });

    await loadData();
  }, [loadData]);

  const hideItem = useCallback(async (id: string) => {
    const dbService = ServiceContainer.database as WatermelonDBService;
    const db = dbService.getDb();
    const collection = db.get<AgendaItemModel>('agenda_items');

    const record = await collection.find(id);
    await record.hide();

    await loadData();
  }, [loadData]);

  const logMedication = useCallback(async (id: string, entry: MedicationLogEntry) => {
    const dbService = ServiceContainer.database as WatermelonDBService;
    const db = dbService.getDb();
    const collection = db.get<AgendaItemModel>('agenda_items');

    const record = await collection.find(id);
    await record.logMedication(entry);

    await loadData();
  }, [loadData]);

  const shareItem = useCallback(async (id: string, jids: string[]) => {
    const dbService = ServiceContainer.database as WatermelonDBService;
    const db = dbService.getDb();
    const collection = db.get<AgendaItemModel>('agenda_items');

    const record = await collection.find(id);

    // Build structured agenda payload for XMPP
    const agendaPayload = JSON.stringify({
      type: 'agenda_item',
      category: record.category,
      categoryIcon: record.categoryIcon ?? getCategoryIcon(record.category as AgendaCategory),
      categoryName: record.categoryName,
      formType: record.formType,
      icon: record.categoryIcon ?? getCategoryIcon(record.category as AgendaCategory),
      title: record.title,
      date: new Date(record.itemDate).toISOString().split('T')[0], // "YYYY-MM-DD"
      time: record.parsedTimes.length > 0
        ? record.parsedTimes[0]
        : null,
      times: record.parsedTimes.length > 1
        ? record.parsedTimes
        : undefined,
      repeat: record.repeatType || null,
      endDate: record.endDate
        ? new Date(record.endDate).toISOString().split('T')[0]
        : null,
      reminderOffset: record.reminderOffset,
      isMedication: record.isMedication,
    });

    // Send via XMPP to each recipient
    const { chatService } = await import('@/services/chat');
    for (const jid of jids) {
      try {
        await chatService.sendMessage(jid, agendaPayload);
        console.info('[AgendaContext] Shared item with:', jid);
      } catch (error) {
        console.warn('[AgendaContext] Failed to share with:', jid, error);
      }
    }

    // Mark as shared in database
    await record.markSharedWith(jids);
    await loadData();
  }, [loadData]);

  const updateSingleOccurrence = useCallback(async (
    parentId: string,
    date: number,
    data: Partial<CreateAgendaItemData>,
  ) => {
    const dbService = ServiceContainer.database as WatermelonDBService;
    const db = dbService.getDb();
    const collection = db.get<AgendaItemModel>('agenda_items');

    // Get parent item for defaults
    const parent = await collection.find(parentId);

    // Create exception record (inherits snapshot fields from parent)
    await db.write(async () => {
      await collection.create(r => {
        r.category = data.category ?? parent.category;
        r.categoryIcon = data.categoryIcon ?? parent.categoryIcon;
        r.categoryName = data.categoryName ?? parent.categoryName;
        r.formType = data.formType ?? parent.formType;
        r.title = data.title ?? parent.title;
        r.itemDate = date;
        r.time = data.time ?? parent.time;
        r.times = data.times ? JSON.stringify(data.times) : parent.times;
        r.reminderOffset = data.reminderOffset ?? parent.reminderOffset;
        r.contactIds = data.contactIds ? JSON.stringify(data.contactIds) : parent.contactIds;
        r.locationName = data.locationName ?? parent.locationName;
        r.addressStreet = data.addressStreet ?? parent.addressStreet;
        r.addressPostalCode = data.addressPostalCode ?? parent.addressPostalCode;
        r.addressCity = data.addressCity ?? parent.addressCity;
        r.addressCountry = data.addressCountry ?? parent.addressCountry;
        r.isHidden = false;
        r.parentId = parentId;
        r.exceptionDate = date;
      });
    });

    await loadData();
  }, [loadData]);

  const deleteSingleOccurrence = useCallback(async (parentId: string, date: number) => {
    const dbService = ServiceContainer.database as WatermelonDBService;
    const db = dbService.getDb();
    const collection = db.get<AgendaItemModel>('agenda_items');

    // Create hidden exception to mark this occurrence as deleted
    await db.write(async () => {
      const parent = await collection.find(parentId);
      await collection.create(r => {
        r.category = parent.category;
        r.title = parent.title;
        r.itemDate = date;
        r.reminderOffset = parent.reminderOffset;
        r.isHidden = true;
        r.parentId = parentId;
        r.exceptionDate = date;
      });
    });

    await loadData();
  }, [loadData]);

  // ============================================================
  // Context Value
  // ============================================================

  const value = useMemo<AgendaContextValue>(() => ({
    timelineDays,
    pastItems,
    isLoading,
    contacts,
    getItemsForDate,
    searchItems,
    refresh,
    createItem,
    updateItem,
    deleteItem,
    hideItem,
    logMedication,
    shareItem,
    updateSingleOccurrence,
    deleteSingleOccurrence,
  }), [
    timelineDays,
    pastItems,
    isLoading,
    contacts,
    getItemsForDate,
    searchItems,
    refresh,
    createItem,
    updateItem,
    deleteItem,
    hideItem,
    logMedication,
    shareItem,
    updateSingleOccurrence,
    deleteSingleOccurrence,
  ]);

  return (
    <AgendaContext.Provider value={value}>
      {children}
    </AgendaContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

export function useAgendaContext(): AgendaContextValue {
  const context = useContext(AgendaContext);
  if (!context) {
    throw new Error('useAgendaContext must be used within AgendaProvider');
  }
  return context;
}

export function useAgendaContextSafe(): AgendaContextValue | null {
  return useContext(AgendaContext);
}
