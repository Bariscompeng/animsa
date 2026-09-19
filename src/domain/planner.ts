/**
 * Reminder planner (§5.3 step 1).
 *
 * Given the whole app state and a reference moment, produce the complete set of
 * notifications and alarms that *should* exist. The planner is pure and
 * deterministic: the same state always yields the same keys and content hashes,
 * which is what makes the sync idempotent.
 */
import {
  addDays,
  combineDateTime,
  formatShortDate,
  parseDateKey,
  startOfDay,
  summarizeNames,
  toDateKey,
  toTimeKey,
} from './format';
import { expandOccurrences, occurrenceKeyFor, toWeeklyAlarmSpec } from './recurrence';
import { applyQuietHours } from './quietHours';
import { ALARM_HOURS, WARN_HOURS } from './provision';
import type {
  CategoryLike,
  ItemLike,
  ListReminderRule,
  OccurrenceState,
  QuietHours,
  TaskLike,
  Weekday,
} from './types';

/** iOS keeps at most 64 pending local notifications; stay under it. */
export const NOTIFICATION_BUDGET = 60;
/** How far ahead notifications are scheduled. */
export const NOTIFICATION_WINDOW_DAYS = 7;
/** How far ahead individual (non-repeating) alarms are scheduled. */
export const ALARM_WINDOW_DAYS = 14;

export type DesiredKind = 'notification' | 'alarm';

export type SourceType =
  'task' | 'signature' | 'listRule' | 'expiry' | 'summary' | 'eveningPreview';

/** Tie-break order when two reminders want the same slot (§5.3). */
const SOURCE_PRIORITY: Record<SourceType, number> = {
  task: 0,
  signature: 1,
  listRule: 2,
  expiry: 3,
  summary: 4,
  eveningPreview: 5,
};

export type DesiredNotification = {
  kind: 'notification';
  key: string;
  fireAt: Date;
  title: string;
  body: string;
  categoryId: 'task' | 'list' | 'signature' | 'plain';
  sourceType: SourceType;
  sourceId?: string;
  occurrenceKey?: string;
  contentHash: string;
};

export type DesiredAlarm = {
  kind: 'alarm';
  key: string;
  title: string;
  sourceType: SourceType;
  sourceId?: string;
  occurrenceKey?: string;
  contentHash: string;
} & (
  | { schedule: 'fixed'; fireAt: Date }
  | { schedule: 'weekly'; hour: number; minute: number; weekdays: Weekday[] }
);

export type Desired = DesiredNotification | DesiredAlarm;

export type PlannerState = {
  tasks: TaskLike[];
  occurrenceStates: OccurrenceState[];
  items: ItemLike[];
  categories: CategoryLike[];
  listRules: ListReminderRule[];
  quietHours: QuietHours;
  summaryEnabled: boolean;
  summaryTime: string; // HH:mm
  eveningPreviewEnabled: boolean;
  eveningPreviewTime: string; // HH:mm
  expiryRemindersEnabled: boolean;
  signatureExpiresAt: Date | null;
  alarmsAvailable: boolean;
};

export type PlanResult = {
  desired: Desired[];
  /** Entries dropped because the notification budget ran out. */
  dropped: number;
  notificationCount: number;
  alarmCount: number;
};

/**
 * Small, stable, non-cryptographic hash (FNV-1a). Content changes flip the
 * hash, which tells the sync to reschedule an existing reminder.
 */
export function contentHash(...parts: (string | number | undefined | null)[]): string {
  const input = parts.map((p) => (p === undefined || p === null ? '' : String(p))).join('');
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function leadLabel(minutes: number): string {
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} gün önce`;
  if (minutes >= 60) return `${Math.round(minutes / 60)} saat önce`;
  return `${minutes} dk önce`;
}

/** Place types the shopping list currently needs, via each item's category. */
export function activeItemNames(items: ItemLike[]): string[] {
  return items.filter((i) => i.onList).map((i) => i.name);
}

function planTasks(state: PlannerState, now: Date, out: Desired[]): void {
  const notifEnd = addDays(now, NOTIFICATION_WINDOW_DAYS);
  const alarmEnd = addDays(now, ALARM_WINDOW_DAYS);
  const horizon = alarmEnd;

  for (const task of state.tasks) {
    if (task.archivedAt) continue;
    if (task.reminderType === 'none') continue;

    const wantsAlarm = task.reminderType === 'alarm' && state.alarmsAvailable;

    // A weekly-expressible alarm becomes one repeating AlarmKit entry rather
    // than one entry per occurrence.
    const weekly = wantsAlarm ? toWeeklyAlarmSpec(task.rrule, task.dueTime) : null;
    if (weekly) {
      const key = `task:${task.id}:weekly`;
      out.push({
        kind: 'alarm',
        key,
        schedule: 'weekly',
        hour: weekly.hour,
        minute: weekly.minute,
        weekdays: weekly.weekdays,
        title: task.title,
        sourceType: 'task',
        sourceId: task.id,
        contentHash: contentHash(task.title, weekly.hour, weekly.minute, weekly.weekdays.join(',')),
      });
    }

    const occurrences = expandOccurrences(task, now, horizon, state.occurrenceStates);

    for (const occ of occurrences) {
      const isAlarmOccurrence = wantsAlarm && !weekly;

      // Lead reminder is always a notification, even for alarm tasks.
      if (task.leadMinutes > 0) {
        const leadAt = new Date(occ.at.getTime() - task.leadMinutes * 60_000);
        if (leadAt.getTime() > now.getTime() && leadAt.getTime() <= notifEnd.getTime()) {
          const body = occ.hasTime
            ? `${toTimeKey(occ.at)} · ${leadLabel(task.leadMinutes)}`
            : leadLabel(task.leadMinutes);
          const key = `task:${task.id}:${occ.occurrenceKey}:lead`;
          out.push({
            kind: 'notification',
            key,
            fireAt: leadAt,
            title: task.title,
            body,
            categoryId: 'task',
            sourceType: 'task',
            sourceId: task.id,
            occurrenceKey: occ.occurrenceKey,
            contentHash: contentHash(task.title, body, leadAt.getTime()),
          });
        }
      }

      if (occ.at.getTime() <= now.getTime()) continue;

      if (isAlarmOccurrence) {
        if (occ.at.getTime() > alarmEnd.getTime()) continue;
        if (!occ.hasTime) continue; // an all-day task cannot ring
        const key = `task:${task.id}:${occ.occurrenceKey}:main`;
        out.push({
          kind: 'alarm',
          key,
          schedule: 'fixed',
          fireAt: occ.at,
          title: task.title,
          sourceType: 'task',
          sourceId: task.id,
          occurrenceKey: occ.occurrenceKey,
          contentHash: contentHash(task.title, occ.at.getTime()),
        });
        continue;
      }

      if (weekly) continue; // covered by the repeating alarm
      if (occ.at.getTime() > notifEnd.getTime()) continue;

      // An explicit clock time is the user's own choice and ignores quiet hours.
      const fireAt = applyQuietHours(occ.at, state.quietHours, occ.hasTime);
      if (fireAt.getTime() <= now.getTime()) continue;

      const body = task.notes?.trim()
        ? task.notes.trim()
        : occ.hasTime
          ? 'Hatırlatma'
          : 'Gün içinde';
      const key = `task:${task.id}:${occ.occurrenceKey}:main`;
      out.push({
        kind: 'notification',
        key,
        fireAt,
        title: task.title,
        body,
        categoryId: 'task',
        sourceType: 'task',
        sourceId: task.id,
        occurrenceKey: occ.occurrenceKey,
        contentHash: contentHash(task.title, body, fireAt.getTime()),
      });
    }
  }
}

function planListRules(state: PlannerState, now: Date, out: Desired[]): void {
  const names = activeItemNames(state.items);
  // No items on the list means no list reminder at all (§3.5).
  if (names.length === 0) return;

  const body = `Listende ${names.length} ürün var: ${summarizeNames(names)}`;
  const end = addDays(now, NOTIFICATION_WINDOW_DAYS);

  for (const rule of state.listRules) {
    if (!rule.enabled) continue;
    const pseudoTask: TaskLike = {
      id: rule.id,
      title: 'liste',
      dueDate: toDateKey(now),
      dueTime: rule.time,
      rrule: rule.rrule,
      reminderType: 'notification',
      leadMinutes: 0,
    };
    const occurrences = expandOccurrences(pseudoTask, now, end, []);
    for (const occ of occurrences) {
      if (occ.at.getTime() <= now.getTime()) continue;
      const key = `list:${rule.id}:${occ.occurrenceKey}`;
      out.push({
        kind: 'notification',
        key,
        fireAt: occ.at,
        title: '🛒 Alışveriş listesi',
        body,
        categoryId: 'list',
        sourceType: 'listRule',
        sourceId: rule.id,
        occurrenceKey: occ.occurrenceKey,
        contentHash: contentHash(body, occ.at.getTime()),
      });
    }
  }
}

function planExpiries(state: PlannerState, now: Date, out: Desired[]): void {
  if (!state.expiryRemindersEnabled) return;
  const end = addDays(now, NOTIFICATION_WINDOW_DAYS);

  for (const item of state.items) {
    if (!item.expiryDate) continue;
    const expiry = parseDateKey(item.expiryDate);
    if (!expiry) continue;

    for (const daysBefore of [2, 1]) {
      const at = combineDateTime(toDateKey(addDays(expiry, -daysBefore)), '09:00');
      if (!at) continue;
      if (at.getTime() <= now.getTime() || at.getTime() > end.getTime()) continue;

      const when = daysBefore === 1 ? 'yarın' : `${daysBefore} gün sonra`;
      const body = `${item.name} son kullanma tarihi ${when} (${formatShortDate(expiry)}).`;
      const fireAt = applyQuietHours(at, state.quietHours, false);
      const key = `expiry:${item.id}:${daysBefore}`;
      out.push({
        kind: 'notification',
        key,
        fireAt,
        title: '🗓️ Son kullanma tarihi',
        body,
        categoryId: 'plain',
        sourceType: 'expiry',
        sourceId: item.id,
        contentHash: contentHash(body, fireAt.getTime()),
      });
    }
  }
}

/**
 * Builds the body of the daily summary for a given day. Exported so the
 * Diagnostics screen and tests can render the exact text that will be sent.
 */
export function buildSummaryBody(state: PlannerState, day: Date): string {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);

  const occurrences = state.tasks
    .flatMap((t) => expandOccurrences(t, dayStart, dayEnd, state.occurrenceStates))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const parts: string[] = [];
  if (occurrences.length === 0) {
    parts.push('Bugün planlı görev yok');
  } else {
    const firstTimed = occurrences.find((o) => o.hasTime);
    const taskTitle = firstTimed
      ? state.tasks.find((t) => t.id === firstTimed.taskId)?.title
      : undefined;
    const lead = firstTimed && taskTitle ? ` (ilki ${toTimeKey(firstTimed.at)} ${taskTitle})` : '';
    parts.push(`Bugün ${occurrences.length} görev${lead}`);
  }

  const listNames = activeItemNames(state.items);
  if (listNames.length > 0) parts.push(`Listede ${listNames.length} ürün`);

  return parts.join(' · ');
}

function buildPreviewBody(state: PlannerState, tomorrow: Date): string {
  const dayStart = startOfDay(tomorrow);
  const dayEnd = addDays(dayStart, 1);
  const occurrences = state.tasks
    .flatMap((t) => expandOccurrences(t, dayStart, dayEnd, state.occurrenceStates))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  if (occurrences.length === 0) return 'Yarın planlı görev yok.';
  const firstTimed = occurrences.find((o) => o.hasTime);
  const title = firstTimed ? state.tasks.find((t) => t.id === firstTimed.taskId)?.title : undefined;
  const lead = firstTimed && title ? `, ilki ${toTimeKey(firstTimed.at)} ${title}` : '';
  return `Yarın: ${occurrences.length} görev${lead}.`;
}

function planSummaries(state: PlannerState, now: Date, out: Desired[]): void {
  // Two days of summaries are kept live; each sync recomputes their content.
  for (let offset = 0; offset <= 2; offset++) {
    const day = addDays(now, offset);
    const dayKey = toDateKey(day);

    if (state.summaryEnabled) {
      const at = combineDateTime(dayKey, state.summaryTime);
      if (at && at.getTime() > now.getTime()) {
        const body = buildSummaryBody(state, day);
        out.push({
          kind: 'notification',
          key: `summary:${dayKey}`,
          fireAt: at,
          title: '☀️ Günlük özet',
          body,
          categoryId: 'plain',
          sourceType: 'summary',
          contentHash: contentHash(body, at.getTime()),
        });
      }
    }

    if (state.eveningPreviewEnabled) {
      const at = combineDateTime(dayKey, state.eveningPreviewTime);
      if (at && at.getTime() > now.getTime()) {
        const body = buildPreviewBody(state, addDays(day, 1));
        out.push({
          kind: 'notification',
          key: `preview:${dayKey}`,
          fireAt: at,
          title: '🌙 Yarının özeti',
          body,
          categoryId: 'plain',
          sourceType: 'eveningPreview',
          contentHash: contentHash(body, at.getTime()),
        });
      }
    }
  }
}

function planSignature(state: PlannerState, now: Date, out: Desired[]): void {
  const expiry = state.signatureExpiresAt;
  if (!expiry) return;

  const body = "Anımsa'nın süresi dolmak üzere. AltStore'u açıp Yenile'ye bas.";

  for (const hours of WARN_HOURS) {
    const at = new Date(expiry.getTime() - hours * 3_600_000);
    if (at.getTime() <= now.getTime()) continue;
    out.push({
      kind: 'notification',
      key: `signature:${hours}h`,
      fireAt: at,
      title: '⚠️ İmza süresi doluyor',
      body,
      categoryId: 'signature',
      sourceType: 'signature',
      contentHash: contentHash(body, at.getTime()),
    });
  }

  if (state.alarmsAvailable) {
    const at = new Date(expiry.getTime() - ALARM_HOURS * 3_600_000);
    if (at.getTime() > now.getTime()) {
      out.push({
        kind: 'alarm',
        key: `signature:${ALARM_HOURS}h`,
        schedule: 'fixed',
        fireAt: at,
        title: 'Anımsa imzası doluyor — AltStore ile yenile',
        sourceType: 'signature',
        contentHash: contentHash('signature-alarm', at.getTime()),
      });
    }
  }
}

function sortKey(d: Desired): [number, number, string] {
  const fireAt =
    d.kind === 'notification' || d.schedule === 'fixed'
      ? (d as { fireAt: Date }).fireAt.getTime()
      : 0; // repeating alarms have no single moment; they are never budgeted out
  return [fireAt, SOURCE_PRIORITY[d.sourceType], d.key];
}

/**
 * Builds the full desired reminder set.
 *
 * Notifications are trimmed to {@link NOTIFICATION_BUDGET}, keeping the
 * soonest first and breaking ties by source priority. Alarms are not budgeted:
 * AlarmKit has its own, much smaller working set.
 */
export function build(state: PlannerState, now: Date): PlanResult {
  const all: Desired[] = [];
  planTasks(state, now, all);
  planListRules(state, now, all);
  planExpiries(state, now, all);
  planSummaries(state, now, all);
  planSignature(state, now, all);

  // Deduplicate by key; the first writer wins (tasks are planned first).
  const byKey = new Map<string, Desired>();
  for (const d of all) {
    if (!byKey.has(d.key)) byKey.set(d.key, d);
  }

  const unique = [...byKey.values()];
  const alarms = unique.filter((d): d is DesiredAlarm => d.kind === 'alarm');
  const notifications = unique
    .filter((d): d is DesiredNotification => d.kind === 'notification')
    .sort((a, b) => {
      const ka = sortKey(a);
      const kb = sortKey(b);
      if (ka[0] !== kb[0]) return ka[0] - kb[0];
      if (ka[1] !== kb[1]) return ka[1] - kb[1];
      return ka[2] < kb[2] ? -1 : ka[2] > kb[2] ? 1 : 0;
    });

  const kept = notifications.slice(0, NOTIFICATION_BUDGET);
  const dropped = notifications.length - kept.length;

  const sortedAlarms = alarms.sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    return ka[2] < kb[2] ? -1 : ka[2] > kb[2] ? 1 : 0;
  });

  return {
    desired: [...kept, ...sortedAlarms],
    dropped,
    notificationCount: kept.length,
    alarmCount: sortedAlarms.length,
  };
}

/** Occurrence key helper re-exported so services do not reach into recurrence. */
export { occurrenceKeyFor };
