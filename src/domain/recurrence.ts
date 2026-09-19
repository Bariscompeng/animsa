/**
 * Recurrence engine. Pure, local-time, and the single source of truth for
 * "when does this task happen next".
 */
import {
  addDays,
  combineDateTime,
  daysBetween,
  daysInMonth,
  isoWeekday,
  parseDateKey,
  parseTimeKey,
  startOfDay,
  toDateKey,
} from './format';
import type {
  Occurrence,
  OccurrenceState,
  RecurrenceEnd,
  RecurrenceRule,
  TaskLike,
  Weekday,
} from './types';

/** Hard ceiling so a malformed rule can never spin forever. */
const MAX_ITERATIONS = 4000;

/**
 * Builds the occurrence key for a date/time pair. The key identifies the
 * *original* occurrence, so snoozing never changes it.
 */
export function occurrenceKeyFor(dateKey: string, timeKey?: string | null): string {
  return timeKey ? `${dateKey}T${timeKey}` : dateKey;
}

function ruleInterval(rule: RecurrenceRule): number {
  if (rule.freq === 'daily' || rule.freq === 'weekly') {
    const n = rule.interval ?? 1;
    return n >= 1 ? Math.floor(n) : 1;
  }
  return 1;
}

function endDate(end: RecurrenceEnd | undefined): Date | null {
  if (!end || end.kind !== 'date') return null;
  return parseDateKey(end.date);
}

function endCount(end: RecurrenceEnd | undefined): number | null {
  if (!end || end.kind !== 'count') return null;
  return end.count > 0 ? Math.floor(end.count) : 0;
}

/** Monday of the local week containing `d`. */
function startOfIsoWeek(d: Date): Date {
  return startOfDay(addDays(d, -(isoWeekday(d) - 1)));
}

/** Whole weeks between the Mondays of two dates. */
function weeksBetween(a: Date, b: Date): number {
  return Math.round(daysBetween(startOfIsoWeek(a), startOfIsoWeek(b)) / 7);
}

/**
 * Enumerates recurrence dates (midnight, local) starting at `anchor`, in
 * ascending order, stopping at `limit` or when the rule's end condition is met.
 */
function* recurrenceDates(
  rule: RecurrenceRule,
  anchor: Date,
  limit: Date,
): Generator<Date, void, undefined> {
  const hardEnd = endDate(rule.end);
  const maxCount = endCount(rule.end);
  let emitted = 0;
  let guard = 0;

  const canEmit = (d: Date): boolean => {
    if (hardEnd && d.getTime() > hardEnd.getTime()) return false;
    if (maxCount !== null && emitted >= maxCount) return false;
    return true;
  };

  if (rule.freq === 'daily') {
    const step = ruleInterval(rule);
    let cursor = startOfDay(anchor);
    while (cursor.getTime() <= limit.getTime() && guard++ < MAX_ITERATIONS) {
      if (!canEmit(cursor)) return;
      emitted++;
      yield new Date(cursor.getTime());
      cursor = addDays(cursor, step);
    }
    return;
  }

  if (rule.freq === 'weekly') {
    const step = ruleInterval(rule);
    const days = [...new Set(rule.weekdays)].sort((a, b) => a - b) as Weekday[];
    if (days.length === 0) return;
    const anchorWeek = startOfIsoWeek(anchor);
    let cursor = startOfDay(anchor);
    while (cursor.getTime() <= limit.getTime() && guard++ < MAX_ITERATIONS) {
      const inSelectedWeek = weeksBetween(anchorWeek, cursor) % step === 0;
      if (inSelectedWeek && days.includes(isoWeekday(cursor) as Weekday)) {
        if (!canEmit(cursor)) return;
        emitted++;
        yield new Date(cursor.getTime());
      }
      cursor = addDays(cursor, 1);
    }
    return;
  }

  if (rule.freq === 'monthlyDay' || rule.freq === 'monthlyLastDay') {
    const wanted = rule.freq === 'monthlyDay' ? Math.min(Math.max(rule.day, 1), 31) : 31;
    let year = anchor.getFullYear();
    let month0 = anchor.getMonth();
    while (guard++ < MAX_ITERATIONS) {
      const dim = daysInMonth(year, month0);
      // Day 31 (or "last day") clamps to the real end of a short month.
      const day = Math.min(wanted, dim);
      const candidate = new Date(year, month0, day, 0, 0, 0, 0);
      if (candidate.getTime() > limit.getTime()) return;
      if (candidate.getTime() >= startOfDay(anchor).getTime()) {
        if (!canEmit(candidate)) return;
        emitted++;
        yield candidate;
      }
      month0 += 1;
      if (month0 > 11) {
        month0 = 0;
        year += 1;
      }
    }
    return;
  }

  // yearly — 29 February falls back to 28 February in non-leap years.
  let year = anchor.getFullYear();
  const month0 = Math.min(Math.max(rule.month, 1), 12) - 1;
  const wantedDay = Math.min(Math.max(rule.day, 1), 31);
  while (guard++ < MAX_ITERATIONS) {
    const dim = daysInMonth(year, month0);
    const candidate = new Date(year, month0, Math.min(wantedDay, dim), 0, 0, 0, 0);
    if (candidate.getTime() > limit.getTime()) return;
    if (candidate.getTime() >= startOfDay(anchor).getTime()) {
      if (!canEmit(candidate)) return;
      emitted++;
      yield candidate;
    }
    year += 1;
  }
}

/**
 * The next occurrence of `rule` strictly after `after`, anchored at `anchor`
 * (the task's start date). Returns null when the rule has ended.
 */
export function nextOccurrence(
  rule: RecurrenceRule,
  after: Date,
  anchor?: Date,
  timeKey?: string | null,
): Date | null {
  const base = anchor ?? after;
  const limit = addDays(after, 366 * 5);
  for (const date of recurrenceDates(rule, base, limit)) {
    const at = timeKey ? combineDateTime(toDateKey(date), timeKey) : date;
    if (at && at.getTime() > after.getTime()) return at;
  }
  return null;
}

/**
 * Maps a rule onto AlarmKit's weekly repeat schedule when possible.
 * Daily / weekday / weekend / selected-weekday rules with interval 1 qualify;
 * everything else returns null and is scheduled as individual fixed alarms.
 */
export function toWeeklyAlarmSpec(
  rule: RecurrenceRule | null | undefined,
  timeKey: string | null | undefined,
): { weekdays: Weekday[]; hour: number; minute: number } | null {
  if (!rule || !timeKey) return null;
  const t = parseTimeKey(timeKey);
  if (!t) return null;
  // A bounded rule cannot become an open-ended repeating alarm.
  if (rule.end && rule.end.kind !== 'never') return null;

  if (rule.freq === 'daily' && ruleInterval(rule) === 1) {
    return { weekdays: [1, 2, 3, 4, 5, 6, 7], hour: t.hour, minute: t.minute };
  }
  if (rule.freq === 'weekly' && ruleInterval(rule) === 1 && rule.weekdays.length > 0) {
    const weekdays = [...new Set(rule.weekdays)].sort((a, b) => a - b) as Weekday[];
    return { weekdays, hour: t.hour, minute: t.minute };
  }
  return null;
}

function stateKey(taskId: string, occurrenceKey: string): string {
  return `${taskId}::${occurrenceKey}`;
}

/**
 * Expands a task into concrete occurrences inside [windowStart, windowEnd].
 *
 * - Non-recurring tasks yield at most one occurrence.
 * - `done` / `skipped` occurrences are omitted.
 * - A snoozed occurrence keeps its original key but moves to `snoozed_until`,
 *   so it can be pulled into the window even when its original date is past.
 */
export function expandOccurrences(
  task: TaskLike,
  windowStart: Date,
  windowEnd: Date,
  states: OccurrenceState[] = [],
): Occurrence[] {
  if (task.archivedAt) return [];

  const stateMap = new Map<string, OccurrenceState>();
  for (const s of states) {
    if (s.taskId === task.id) stateMap.set(stateKey(s.taskId, s.occurrenceKey), s);
  }

  const out: Occurrence[] = [];
  const time = task.dueTime ?? null;

  const push = (dateKey: string): void => {
    const key = occurrenceKeyFor(dateKey, time);
    const state = stateMap.get(stateKey(task.id, key));
    if (state?.status === 'done' || state?.status === 'skipped') return;

    let at = combineDateTime(dateKey, time);
    if (!at) return;
    let effectiveDate = dateKey;
    let effectiveTime = time;
    let snoozed = false;

    if (state?.status === 'snoozed' && state.snoozedUntil) {
      const moved = new Date(state.snoozedUntil);
      at = moved;
      effectiveDate = toDateKey(moved);
      effectiveTime = `${String(moved.getHours()).padStart(2, '0')}:${String(
        moved.getMinutes(),
      ).padStart(2, '0')}`;
      snoozed = true;
    }

    if (at.getTime() < windowStart.getTime() || at.getTime() > windowEnd.getTime()) return;

    out.push({
      taskId: task.id,
      occurrenceKey: key,
      date: effectiveDate,
      time: effectiveTime,
      at,
      hasTime: Boolean(time) || snoozed,
      status: state?.status,
      snoozed,
    });
  };

  if (!task.dueDate) {
    // Undated tasks are "someday" items — no scheduled occurrence.
    return out;
  }

  const anchor = parseDateKey(task.dueDate);
  if (!anchor) return out;

  if (!task.rrule) {
    push(task.dueDate);
    return out;
  }

  // Snoozed occurrences can sit before the window start; widen the scan a
  // little so they are still discovered.
  const scanStart = startOfDay(addDays(windowStart, -31));
  const scanEnd = startOfDay(addDays(windowEnd, 1));
  const from = anchor.getTime() > scanStart.getTime() ? anchor : scanStart;

  for (const date of recurrenceDates(task.rrule, anchor, scanEnd)) {
    if (date.getTime() < from.getTime()) continue;
    push(toDateKey(date));
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

const MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

/** A short Turkish description of a rule, for task rows and chips. */
export function describeRule(rule: RecurrenceRule | null | undefined): string {
  if (!rule) return 'Tekrar yok';

  const suffix = ((): string => {
    if (!rule.end || rule.end.kind === 'never') return '';
    if (rule.end.kind === 'count') return `, ${rule.end.count} kez`;
    const d = parseDateKey(rule.end.date);
    return d ? `, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} tarihine kadar` : '';
  })();

  switch (rule.freq) {
    case 'daily': {
      const n = ruleInterval(rule);
      return (n === 1 ? 'Her gün' : `${n} günde bir`) + suffix;
    }
    case 'weekly': {
      const n = ruleInterval(rule);
      const days = [...new Set(rule.weekdays)].sort((a, b) => a - b);
      const labels = days.map((d) => DAY_NAMES[d - 1]).join(', ');
      if (n > 1) return `${n} haftada bir ${labels}` + suffix;
      if (days.length === 7) return 'Her gün' + suffix;
      if (days.length === 5 && days.every((d) => d <= 5)) return 'Hafta içi' + suffix;
      if (days.length === 2 && days[0] === 6 && days[1] === 7) return 'Hafta sonu' + suffix;
      return `Her ${labels}` + suffix;
    }
    case 'monthlyDay':
      return `Her ayın ${rule.day}. günü` + suffix;
    case 'monthlyLastDay':
      return 'Her ayın son günü' + suffix;
    case 'yearly':
      return `Her yıl ${rule.day} ${MONTHS[rule.month - 1]}` + suffix;
  }
}
