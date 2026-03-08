/**
 * agendaShare — Helper for adding received agenda items to own agenda
 *
 * Used by ChatScreen when user taps "Add to my agenda" on a received
 * agenda item. Writes directly to WatermelonDB without needing
 * AgendaContext (which may not be mounted in chat).
 *
 * @see components/AgendaItemBubble.tsx for the UI
 * @see contexts/AgendaContext.tsx for the full agenda context
 */

import { ServiceContainer } from '@/services/container';
import { WatermelonDBService } from '@/services/database';
import { AgendaItemModel } from '@/models/AgendaItem';
import type { AgendaItemPayload } from '@/components/AgendaItemBubble';
import type { AgendaCategory, ReminderOffset } from '@/constants/agendaCategories';

/**
 * Add a received agenda item to the user's own agenda.
 *
 * Creates a local copy in WatermelonDB — no link to the sender's item.
 * The sender's JID is stored in `sharedFrom` for provenance.
 */
export async function addAgendaItemFromShare(
  payload: AgendaItemPayload,
  senderJid: string,
): Promise<string> {
  const dbService = ServiceContainer.database as WatermelonDBService;
  const db = dbService.getDb();
  const collection = db.get<AgendaItemModel>('agenda_items');

  // Parse date string "YYYY-MM-DD" to timestamp
  const dateTimestamp = new Date(payload.date + 'T12:00:00').getTime();

  let newId = '';
  await db.write(async () => {
    const record = await collection.create(r => {
      r.category = payload.category as AgendaCategory;
      r.title = payload.title;
      r.itemDate = dateTimestamp;
      r.time = payload.time ?? undefined;
      r.times = payload.times ? JSON.stringify(payload.times) : undefined;
      r.repeatType = payload.repeat ?? undefined;
      r.endDate = payload.endDate
        ? new Date(payload.endDate + 'T12:00:00').getTime()
        : undefined;
      r.reminderOffset = (payload.reminderOffset ?? 'at_time') as ReminderOffset;
      r.isHidden = false;
      r.sharedFrom = senderJid;
    });
    newId = record.id;
  });

  console.info('[agendaShare] Item added from share:', newId);
  return newId;
}
