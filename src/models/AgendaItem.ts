/**
 * AgendaItem Model — WatermelonDB
 *
 * Stores agenda items: appointments, reminders, medication schedules.
 * Contact dates (birthday, wedding, memorial) are NOT stored here —
 * they are derived from Contact model in AgendaContext.
 *
 * @see constants/agendaCategories.ts for category definitions
 * @see contexts/AgendaContext.tsx for merged timeline data source
 */

import { Model, Q } from '@nozbe/watermelondb';
import { field, date, readonly, writer } from '@nozbe/watermelondb/decorators';
import type { AgendaCategory, RepeatType, ReminderOffset } from '../constants/agendaCategories';

export class AgendaItemModel extends Model {
  static table = 'agenda_items';

  // Core fields
  @field('category') category!: AgendaCategory;
  @field('title') title!: string;
  @field('item_date') itemDate!: number;          // Timestamp (start date)
  @field('time') time?: string;                    // "11:00" (null for all-day)
  @field('times') times?: string;                  // JSON: ["09:00", "21:00"] (medication multiple times)

  // Repeat pattern
  @field('repeat_type') repeatType?: string;       // RepeatType or null
  @field('end_date') endDate?: number;             // Timestamp (null = no end)

  // Reminder
  @field('reminder_offset') reminderOffset!: string; // ReminderOffset

  // Contacts (family appointments)
  @field('contact_ids') contactIds?: string;       // JSON array of Contact record IDs

  // Location / Address (v18)
  @field('location_name') locationName?: string;    // e.g. "Huisartsenpraktijk De Linde"
  @field('address_street') addressStreet?: string;
  @field('address_postal_code') addressPostalCode?: string;
  @field('address_city') addressCity?: string;
  @field('address_country') addressCountry?: string;

  // Medication log
  @field('medication_log') medicationLog?: string; // JSON: MedicationLogEntry[]

  // Sharing
  @field('shared_with') sharedWith?: string;       // JSON array of JIDs
  @field('shared_from') sharedFrom?: string;       // JID if received from someone

  // Soft delete (hidden from timeline, not removed from DB)
  @field('is_hidden') isHidden!: boolean;

  // Exception tracking for recurring items ("alleen vandaag" edits)
  @field('parent_id') parentId?: string;           // Reference to parent recurring item
  @field('exception_date') exceptionDate?: number; // Date this exception overrides

  // Meta
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // ============================================================
  // Computed Properties
  // ============================================================

  /** Get parsed times array for medication */
  get parsedTimes(): string[] {
    if (!this.times) return this.time ? [this.time] : [];
    try {
      return JSON.parse(this.times);
    } catch {
      return this.time ? [this.time] : [];
    }
  }

  /** Get parsed contact IDs */
  get parsedContactIds(): string[] {
    if (!this.contactIds) return [];
    try {
      return JSON.parse(this.contactIds);
    } catch {
      return [];
    }
  }

  /** Get parsed medication log */
  get parsedMedicationLog(): MedicationLogEntry[] {
    if (!this.medicationLog) return [];
    try {
      return JSON.parse(this.medicationLog);
    } catch {
      return [];
    }
  }

  /** Get parsed shared-with JIDs */
  get parsedSharedWith(): string[] {
    if (!this.sharedWith) return [];
    try {
      return JSON.parse(this.sharedWith);
    } catch {
      return [];
    }
  }

  /** Check if this is a recurring item */
  get isRecurring(): boolean {
    return !!this.repeatType;
  }

  /** Check if this is a medication item */
  get isMedication(): boolean {
    return this.category === 'medication';
  }

  /** Check if this is an exception (single-day override of a recurring item) */
  get isException(): boolean {
    return !!this.parentId;
  }

  // ============================================================
  // Writers
  // ============================================================

  /** Update item fields */
  @writer async updateItem(updates: {
    title?: string;
    itemDate?: number;
    time?: string;
    times?: string[];
    repeatType?: RepeatType | null;
    endDate?: number | null;
    reminderOffset?: ReminderOffset;
    contactIds?: string[];
    locationName?: string | null;
    addressStreet?: string | null;
    addressPostalCode?: string | null;
    addressCity?: string | null;
    addressCountry?: string | null;
  }): Promise<void> {
    await this.update(record => {
      if (updates.title !== undefined) record.title = updates.title;
      if (updates.itemDate !== undefined) record.itemDate = updates.itemDate;
      if (updates.time !== undefined) record.time = updates.time;
      if (updates.times !== undefined) record.times = JSON.stringify(updates.times);
      if (updates.repeatType !== undefined) {
        record.repeatType = updates.repeatType ?? undefined;
      }
      if (updates.endDate !== undefined) {
        record.endDate = updates.endDate ?? undefined;
      }
      if (updates.reminderOffset !== undefined) record.reminderOffset = updates.reminderOffset;
      if (updates.contactIds !== undefined) {
        record.contactIds = JSON.stringify(updates.contactIds);
      }
      if (updates.locationName !== undefined) record.locationName = updates.locationName ?? undefined;
      if (updates.addressStreet !== undefined) record.addressStreet = updates.addressStreet ?? undefined;
      if (updates.addressPostalCode !== undefined) record.addressPostalCode = updates.addressPostalCode ?? undefined;
      if (updates.addressCity !== undefined) record.addressCity = updates.addressCity ?? undefined;
      if (updates.addressCountry !== undefined) record.addressCountry = updates.addressCountry ?? undefined;
    });
  }

  /** Log medication taken/skipped for a specific date+time */
  @writer async logMedication(entry: MedicationLogEntry): Promise<void> {
    const log = this.parsedMedicationLog;
    // Replace existing entry for same date+time, or add new
    const existingIndex = log.findIndex(
      e => e.date === entry.date && e.time === entry.time,
    );
    if (existingIndex >= 0) {
      log[existingIndex] = entry;
    } else {
      log.push(entry);
    }
    await this.update(record => {
      record.medicationLog = JSON.stringify(log);
    });
  }

  /** Mark item as hidden (soft delete) */
  @writer async hide(): Promise<void> {
    await this.update(record => {
      record.isHidden = true;
    });
  }

  /** Record that this item was shared with contacts */
  @writer async markSharedWith(jids: string[]): Promise<void> {
    const existing = this.parsedSharedWith;
    const merged = [...new Set([...existing, ...jids])];
    await this.update(record => {
      record.sharedWith = JSON.stringify(merged);
    });
  }

  // ============================================================
  // Static Queries
  // ============================================================

  /** Query all visible (non-hidden) items */
  static queryVisible(collection: AgendaItemModel['collection']) {
    return collection.query(
      Q.where('is_hidden', false),
      Q.sortBy('item_date', Q.asc),
    );
  }

  /** Query items for a specific date range */
  static queryByDateRange(
    collection: AgendaItemModel['collection'],
    startTimestamp: number,
    endTimestamp: number,
  ) {
    return collection.query(
      Q.where('is_hidden', false),
      Q.where('item_date', Q.gte(startTimestamp)),
      Q.where('item_date', Q.lte(endTimestamp)),
      Q.sortBy('item_date', Q.asc),
    );
  }

  /** Query items by category */
  static queryByCategory(
    collection: AgendaItemModel['collection'],
    category: AgendaCategory,
  ) {
    return collection.query(
      Q.where('is_hidden', false),
      Q.where('category', category),
      Q.sortBy('item_date', Q.asc),
    );
  }

  /** Query medication items */
  static queryMedication(collection: AgendaItemModel['collection']) {
    return collection.query(
      Q.where('is_hidden', false),
      Q.where('category', 'medication'),
      Q.sortBy('item_date', Q.asc),
    );
  }

  /** Query recurring items (for notification scheduling) */
  static queryRecurring(collection: AgendaItemModel['collection']) {
    return collection.query(
      Q.where('is_hidden', false),
      Q.where('repeat_type', Q.notEq(null)),
      Q.sortBy('item_date', Q.asc),
    );
  }

  /** Query exceptions for a parent item */
  static queryExceptions(
    collection: AgendaItemModel['collection'],
    parentId: string,
  ) {
    return collection.query(
      Q.where('parent_id', parentId),
    );
  }
}

// ============================================================
// Supporting Types
// ============================================================

export interface MedicationLogEntry {
  date: string;           // "2026-03-08"
  time: string;           // "09:00"
  status: 'taken' | 'skipped' | 'pending';
  confirmedAt?: number;   // Timestamp of confirmation
}
