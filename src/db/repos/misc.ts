/**
 * List reminder rules, the leaving-home checklist, scheduled reminder refs and
 * the event log.
 */
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import type { ListReminderRule, RecurrenceRule } from '@/domain/types';

import { db } from '../client';
import {
  eventLog,
  homeExitChecklist,
  listReminderRules,
  scheduledRefs,
  type EventLogRow,
  type HomeExitChecklistRow,
  type ScheduledRefRow,
} from '../schema';

// ------------------------------------------------------- list reminder rules

export async function listReminderRulesAll(): Promise<ListReminderRule[]> {
  const rows = await db.select().from(listReminderRules);
  return rows.flatMap((row) => {
    try {
      return [
        {
          id: row.id,
          rrule: JSON.parse(row.rruleJson) as RecurrenceRule,
          time: row.time,
          enabled: row.enabled,
        },
      ];
    } catch {
      return [];
    }
  });
}

export async function createListRule(rrule: RecurrenceRule, time: string): Promise<string> {
  const now = Date.now();
  const id = randomUUID();
  await db.insert(listReminderRules).values({
    id,
    rruleJson: JSON.stringify(rrule),
    time,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateListRule(
  id: string,
  patch: { rrule?: RecurrenceRule; time?: string; enabled?: boolean },
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.rrule) set.rruleJson = JSON.stringify(patch.rrule);
  if (patch.time) set.time = patch.time;
  if (patch.enabled !== undefined) set.enabled = patch.enabled;
  await db.update(listReminderRules).set(set).where(eq(listReminderRules.id, id));
}

export async function deleteListRule(id: string): Promise<void> {
  await db.delete(listReminderRules).where(eq(listReminderRules.id, id));
}

// -------------------------------------------------------- home-exit checklist

export type ChecklistEntry = HomeExitChecklistRow;

export async function listChecklist(): Promise<ChecklistEntry[]> {
  return db.select().from(homeExitChecklist).orderBy(homeExitChecklist.sortOrder);
}

export async function addChecklistEntry(text: string): Promise<void> {
  const existing = await listChecklist();
  const now = Date.now();
  await db.insert(homeExitChecklist).values({
    id: randomUUID(),
    text: text.trim(),
    sortOrder: existing.length,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateChecklistEntry(
  id: string,
  patch: { text?: string; enabled?: boolean },
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.text !== undefined) set.text = patch.text.trim();
  if (patch.enabled !== undefined) set.enabled = patch.enabled;
  await db.update(homeExitChecklist).set(set).where(eq(homeExitChecklist.id, id));
}

export async function deleteChecklistEntry(id: string): Promise<void> {
  await db.delete(homeExitChecklist).where(eq(homeExitChecklist.id, id));
}

// ------------------------------------------------------------ scheduled refs

export type ScheduledRef = ScheduledRefRow;

export async function listScheduledRefs(): Promise<ScheduledRef[]> {
  return db.select().from(scheduledRefs);
}

export async function putScheduledRef(ref: Omit<ScheduledRef, 'updatedAt'>): Promise<void> {
  const now = Date.now();
  await db
    .insert(scheduledRefs)
    .values({ ...ref, updatedAt: now })
    .onConflictDoUpdate({
      target: scheduledRefs.key,
      set: { ...ref, updatedAt: now },
    });
}

export async function deleteScheduledRefs(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await db.delete(scheduledRefs).where(inArray(scheduledRefs.key, keys));
}

export async function clearScheduledRefs(): Promise<void> {
  await db.delete(scheduledRefs);
}

// ----------------------------------------------------------------- event log

export type EventType = 'sync' | 'location' | 'notification' | 'alarm' | 'error' | 'info';

export type LogEntry = EventLogRow;

/** Rows kept in the log; older entries are pruned on every write. */
const LOG_LIMIT = 500;

export async function logEvent(type: EventType, message: string, payload?: unknown): Promise<void> {
  try {
    await db.insert(eventLog).values({
      id: randomUUID(),
      at: Date.now(),
      type,
      message,
      payloadJson: payload === undefined ? null : JSON.stringify(payload),
    });

    // Prune anything past the limit, oldest first.
    const rows = await db
      .select({ at: eventLog.at })
      .from(eventLog)
      .orderBy(desc(eventLog.at))
      .limit(1)
      .offset(LOG_LIMIT);
    const cutoff = rows[0]?.at;
    if (cutoff !== undefined) {
      await db.delete(eventLog).where(lt(eventLog.at, cutoff));
    }
  } catch {
    // Logging must never break the caller.
  }
}

export async function recentEvents(limit = 200, type?: EventType): Promise<LogEntry[]> {
  const base = db.select().from(eventLog);
  const rows = type
    ? await base
        .where(and(eq(eventLog.type, type)))
        .orderBy(desc(eventLog.at))
        .limit(limit)
    : await base.orderBy(desc(eventLog.at)).limit(limit);
  return rows;
}

export async function clearEvents(): Promise<void> {
  await db.delete(eventLog);
}
