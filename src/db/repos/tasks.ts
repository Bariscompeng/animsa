/**
 * Task and occurrence-state persistence, plus the mapping between database
 * rows and the pure-domain `TaskLike` shape.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import type {
  LocationTrigger,
  OccurrenceState,
  RecurrenceRule,
  ReminderType,
  TaskLike,
} from '@/domain/types';

import { db } from '../client';
import { taskOccurrenceStates, tasks, type TaskRow } from '../schema';

function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function rowToTask(row: TaskRow): TaskLike {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueDate: row.dueDate,
    dueTime: row.dueTime,
    rrule: parseJson<RecurrenceRule>(row.rruleJson),
    reminderType: row.reminderType as ReminderType,
    leadMinutes: row.leadMinutes,
    important: row.important,
    locationTrigger: parseJson<LocationTrigger>(row.locationTriggerJson),
    onHomeExit: row.onHomeExit,
    onHomeArrive: row.onHomeArrive,
    archivedAt: row.archivedAt,
  };
}

export type TaskDraft = {
  title: string;
  notes?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  rrule?: RecurrenceRule | null;
  reminderType?: ReminderType;
  leadMinutes?: number;
  important?: boolean;
  locationTrigger?: LocationTrigger | null;
  onHomeExit?: boolean;
  onHomeArrive?: boolean;
};

export async function listTasks(includeArchived = false): Promise<TaskLike[]> {
  const rows = includeArchived
    ? await db.select().from(tasks)
    : await db.select().from(tasks).where(isNull(tasks.archivedAt));
  return rows.map(rowToTask);
}

export async function getTask(id: string): Promise<TaskLike | null> {
  const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  const row = rows[0];
  return row ? rowToTask(row) : null;
}

export async function createTask(draft: TaskDraft): Promise<string> {
  const now = Date.now();
  const id = randomUUID();
  await db.insert(tasks).values({
    id,
    title: draft.title.trim(),
    notes: draft.notes ?? null,
    dueDate: draft.dueDate ?? null,
    dueTime: draft.dueTime ?? null,
    rruleJson: draft.rrule ? JSON.stringify(draft.rrule) : null,
    reminderType: draft.reminderType ?? 'none',
    leadMinutes: draft.leadMinutes ?? 0,
    important: draft.important ?? false,
    locationTriggerJson: draft.locationTrigger ? JSON.stringify(draft.locationTrigger) : null,
    onHomeExit: draft.onHomeExit ?? false,
    onHomeArrive: draft.onHomeArrive ?? false,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateTask(id: string, draft: Partial<TaskDraft>): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  if (draft.title !== undefined) patch.title = draft.title.trim();
  if (draft.notes !== undefined) patch.notes = draft.notes;
  if (draft.dueDate !== undefined) patch.dueDate = draft.dueDate;
  if (draft.dueTime !== undefined) patch.dueTime = draft.dueTime;
  if (draft.rrule !== undefined) {
    patch.rruleJson = draft.rrule ? JSON.stringify(draft.rrule) : null;
  }
  if (draft.reminderType !== undefined) patch.reminderType = draft.reminderType;
  if (draft.leadMinutes !== undefined) patch.leadMinutes = draft.leadMinutes;
  if (draft.important !== undefined) patch.important = draft.important;
  if (draft.locationTrigger !== undefined) {
    patch.locationTriggerJson = draft.locationTrigger
      ? JSON.stringify(draft.locationTrigger)
      : null;
  }
  if (draft.onHomeExit !== undefined) patch.onHomeExit = draft.onHomeExit;
  if (draft.onHomeArrive !== undefined) patch.onHomeArrive = draft.onHomeArrive;

  await db.update(tasks).set(patch).where(eq(tasks.id, id));
}

export async function deleteTask(id: string): Promise<void> {
  await db.delete(taskOccurrenceStates).where(eq(taskOccurrenceStates.taskId, id));
  await db.delete(tasks).where(eq(tasks.id, id));
}

export async function listOccurrenceStates(): Promise<OccurrenceState[]> {
  const rows = await db.select().from(taskOccurrenceStates);
  return rows.map((r) => ({
    taskId: r.taskId,
    occurrenceKey: r.occurrenceKey,
    status: r.status as OccurrenceState['status'],
    snoozedUntil: r.snoozedUntil,
    completedAt: r.completedAt,
  }));
}

async function upsertOccurrenceState(
  taskId: string,
  occurrenceKey: string,
  patch: {
    status: OccurrenceState['status'];
    snoozedUntil?: number | null;
    completedAt?: number | null;
  },
): Promise<void> {
  const now = Date.now();
  await db
    .insert(taskOccurrenceStates)
    .values({
      taskId,
      occurrenceKey,
      status: patch.status,
      snoozedUntil: patch.snoozedUntil ?? null,
      completedAt: patch.completedAt ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [taskOccurrenceStates.taskId, taskOccurrenceStates.occurrenceKey],
      set: {
        status: patch.status,
        snoozedUntil: patch.snoozedUntil ?? null,
        completedAt: patch.completedAt ?? null,
        updatedAt: now,
      },
    });
}

/** Completes a single occurrence; later occurrences of a repeat are unaffected. */
export async function completeOccurrence(taskId: string, occurrenceKey: string): Promise<void> {
  await upsertOccurrenceState(taskId, occurrenceKey, {
    status: 'done',
    completedAt: Date.now(),
  });
}

export async function uncompleteOccurrence(taskId: string, occurrenceKey: string): Promise<void> {
  await db
    .delete(taskOccurrenceStates)
    .where(
      and(
        eq(taskOccurrenceStates.taskId, taskId),
        eq(taskOccurrenceStates.occurrenceKey, occurrenceKey),
      ),
    );
}

export async function snoozeOccurrence(
  taskId: string,
  occurrenceKey: string,
  until: Date,
): Promise<void> {
  await upsertOccurrenceState(taskId, occurrenceKey, {
    status: 'snoozed',
    snoozedUntil: until.getTime(),
  });
}

export async function skipOccurrence(taskId: string, occurrenceKey: string): Promise<void> {
  await upsertOccurrenceState(taskId, occurrenceKey, { status: 'skipped' });
}

/** Completed occurrences for a day, used by the "show completed" toggle. */
export async function listCompletedStates(): Promise<OccurrenceState[]> {
  const rows = await db
    .select()
    .from(taskOccurrenceStates)
    .where(eq(taskOccurrenceStates.status, 'done'));
  return rows.map((r) => ({
    taskId: r.taskId,
    occurrenceKey: r.occurrenceKey,
    status: 'done' as const,
    completedAt: r.completedAt,
  }));
}
