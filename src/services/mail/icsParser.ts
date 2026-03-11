/**
 * ICS Calendar Event Parser
 *
 * Parses iCalendar (.ics) content from email attachments and maps
 * events to CommEazy's agenda data model (CreateAgendaItemData).
 *
 * Uses ical.js (Mozilla/Thunderbird) for full RFC 5545 compliance.
 *
 * Field mapping:
 * - SUMMARY → title
 * - DTSTART → date + time
 * - DTEND → endTime
 * - LOCATION → locationName
 * - DESCRIPTION → notes
 * - RRULE → repeatType
 * - VALARM → reminderOffset
 *
 * @see types/mail.ts for MailAttachmentMeta (ICS detection via mimeType)
 * @see contexts/AgendaContext.tsx for CreateAgendaItemData
 */

import ICAL from 'ical.js';
import type { CreateAgendaItemData } from '@/contexts/AgendaContext';
import type { RepeatType, ReminderOffset } from '@/constants/agendaCategories';

// ============================================================
// Types
// ============================================================

/** Parsed calendar event from ICS data */
export interface ParsedCalendarEvent {
  /** Event summary/title */
  summary: string;
  /** Start date */
  dtstart: Date;
  /** End date (optional) */
  dtend: Date | null;
  /** Location string */
  location: string | null;
  /** Description/notes */
  description: string | null;
  /** Organizer email */
  organizer: string | null;
  /** Whether this is an all-day event */
  isAllDay: boolean;
  /** Recurrence rule string (FREQ=DAILY, etc.) */
  rruleFreq: string | null;
  /** Alarm offset in minutes before event (null = no alarm) */
  alarmMinutesBefore: number | null;
}

// ============================================================
// Parser
// ============================================================

/**
 * Parse ICS content string into calendar events.
 *
 * @param icsContent - Raw ICS file content (text/calendar)
 * @returns Array of parsed events (usually 1 per invitation)
 */
export function parseICS(icsContent: string): ParsedCalendarEvent[] {
  try {
    const jcalData = ICAL.parse(icsContent);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    return vevents.map(parseVEvent).filter(Boolean) as ParsedCalendarEvent[];
  } catch (error) {
    console.error('[icsParser] Failed to parse ICS content:', error);
    return [];
  }
}

/**
 * Parse a single VEVENT component into a ParsedCalendarEvent.
 */
function parseVEvent(vevent: ICAL.Component): ParsedCalendarEvent | null {
  try {
    const event = new ICAL.Event(vevent);

    // Summary (required)
    const summary = event.summary || '';
    if (!summary.trim()) return null;

    // Start date (required)
    const dtstart = event.startDate;
    if (!dtstart) return null;

    // Detect all-day events: DATE type (no time component)
    const isAllDay = dtstart.isDate;

    // End date (optional)
    const dtend = event.endDate ? event.endDate.toJSDate() : null;

    // Location
    const location = event.location || null;

    // Description
    const description = event.description || null;

    // Organizer
    let organizer: string | null = null;
    const organizerProp = vevent.getFirstProperty('organizer');
    if (organizerProp) {
      const orgValue = organizerProp.getFirstValue();
      if (typeof orgValue === 'string') {
        // Strip "mailto:" prefix
        organizer = orgValue.replace(/^mailto:/i, '');
      }
    }

    // Recurrence rule
    let rruleFreq: string | null = null;
    const rruleProp = vevent.getFirstProperty('rrule');
    if (rruleProp) {
      const rrule = rruleProp.getFirstValue();
      if (rrule && typeof rrule === 'object' && 'freq' in rrule) {
        rruleFreq = (rrule as { freq: string }).freq;
      }
    }

    // Alarm (VALARM) — find earliest alarm trigger
    let alarmMinutesBefore: number | null = null;
    const valarms = vevent.getAllSubcomponents('valarm');
    for (const valarm of valarms) {
      const trigger = valarm.getFirstProperty('trigger');
      if (trigger) {
        const triggerValue = trigger.getFirstValue();
        if (triggerValue && typeof triggerValue === 'object' && 'toSeconds' in triggerValue) {
          const seconds = (triggerValue as { toSeconds: () => number }).toSeconds();
          // Negative = before event, convert to positive minutes
          const minutesBefore = Math.abs(seconds) / 60;
          if (alarmMinutesBefore === null || minutesBefore < alarmMinutesBefore) {
            alarmMinutesBefore = minutesBefore;
          }
        }
      }
    }

    return {
      summary,
      dtstart: dtstart.toJSDate(),
      dtend,
      location,
      description,
      organizer,
      isAllDay,
      rruleFreq,
      alarmMinutesBefore,
    };
  } catch (error) {
    console.error('[icsParser] Failed to parse VEVENT:', error);
    return null;
  }
}

// ============================================================
// Mapper: ICS Event → CommEazy Agenda Data
// ============================================================

/**
 * Map a parsed ICS event to CommEazy's CreateAgendaItemData format.
 *
 * @param event - Parsed calendar event from ICS
 * @returns Partial agenda item data suitable for pre-filling the form
 */
export function mapToAgendaData(
  event: ParsedCalendarEvent,
): Partial<CreateAgendaItemData> & { endTime?: string; notes?: string; source?: string } {
  // Date: start of day timestamp
  const dateObj = new Date(event.dtstart);
  const startOfDay = new Date(dateObj);
  startOfDay.setHours(0, 0, 0, 0);

  // Time: "HH:MM" format (null for all-day)
  let time: string | undefined;
  if (!event.isAllDay) {
    time = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
  }

  // End time: "HH:MM" format from DTEND
  let endTime: string | undefined;
  if (event.dtend && !event.isAllDay) {
    const endObj = new Date(event.dtend);
    endTime = `${String(endObj.getHours()).padStart(2, '0')}:${String(endObj.getMinutes()).padStart(2, '0')}`;
  }

  // Map RRULE frequency to CommEazy RepeatType
  const repeatType = mapRruleFreq(event.rruleFreq);

  // Map alarm to ReminderOffset
  const reminderOffset = mapAlarmToReminder(event.alarmMinutesBefore);

  return {
    category: 'other',
    categoryIcon: '📅',
    categoryName: 'modules.agenda.categories.other',
    formType: 'appointment',
    title: event.summary,
    date: startOfDay.getTime(),
    time,
    repeatType,
    reminderOffset,
    locationName: event.location ?? undefined,
    // New fields (stored after schema v21):
    endTime,
    notes: event.description ?? undefined,
    source: 'ics',
  };
}

/**
 * Map RRULE FREQ value to CommEazy RepeatType.
 */
function mapRruleFreq(freq: string | null): RepeatType | undefined {
  if (!freq) return undefined;

  switch (freq.toUpperCase()) {
    case 'DAILY': return 'daily';
    case 'WEEKLY': return 'weekly';
    case 'MONTHLY': return 'monthly';
    case 'YEARLY': return 'yearly';
    default: return undefined;
  }
}

/**
 * Map alarm minutes-before to the closest CommEazy ReminderOffset.
 */
function mapAlarmToReminder(minutesBefore: number | null): ReminderOffset {
  if (minutesBefore === null) return '1_hour_before'; // Default

  if (minutesBefore <= 0) return 'at_time';
  if (minutesBefore <= 15) return '15_min_before';
  if (minutesBefore <= 30) return '30_min_before';
  if (minutesBefore <= 60) return '1_hour_before';
  return '1_day_before';
}

// ============================================================
// Detection Helper
// ============================================================

/**
 * Check if a mail attachment is an ICS calendar file.
 *
 * @param mimeType - MIME type of the attachment
 * @param fileName - File name of the attachment
 * @returns true if this is an ICS file
 */
export function isICSAttachment(mimeType: string, fileName: string): boolean {
  const mime = mimeType.toLowerCase();
  const name = fileName.toLowerCase();

  return (
    mime === 'text/calendar' ||
    mime === 'application/ics' ||
    name.endsWith('.ics')
  );
}
