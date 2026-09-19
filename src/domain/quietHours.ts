/**
 * Quiet hours (§3.9).
 *
 * User-chosen clock times and every alarm are exempt; auto-generated
 * notifications are pushed to the end of the quiet window, and location
 * notifications are dropped entirely.
 */
import { addDays, parseTimeKey, startOfDay } from './format';
import type { QuietHours } from './types';

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: true,
  start: '23:00',
  end: '07:30',
};

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function toMinutes(timeKey: string): number | null {
  const t = parseTimeKey(timeKey);
  return t ? t.hour * 60 + t.minute : null;
}

/** True when `at` falls inside the quiet window (wrapping past midnight). */
export function isQuiet(at: Date, quiet: QuietHours): boolean {
  if (!quiet.enabled) return false;
  const start = toMinutes(quiet.start);
  const end = toMinutes(quiet.end);
  if (start === null || end === null) return false;
  if (start === end) return false;
  const now = minutesOfDay(at);
  // Wrapping window, e.g. 23:00 → 07:30.
  if (start > end) return now >= start || now < end;
  return now >= start && now < end;
}

/**
 * Moves `at` to the first moment after the quiet window ends. Returns the
 * original date when quiet hours do not apply.
 */
export function shiftOutOfQuiet(at: Date, quiet: QuietHours): Date {
  if (!isQuiet(at, quiet)) return at;
  const end = toMinutes(quiet.end);
  if (end === null) return at;

  const sameDay = startOfDay(at);
  sameDay.setMinutes(end);
  if (sameDay.getTime() > at.getTime()) return sameDay;

  const nextDay = startOfDay(addDays(at, 1));
  nextDay.setMinutes(end);
  return nextDay;
}

/**
 * Applies quiet hours to a scheduled moment.
 *
 * @param at The moment the reminder would fire.
 * @param quiet The user's quiet-hours setting.
 * @param exempt True for alarms and for times the user typed explicitly.
 */
export function applyQuietHours(at: Date, quiet: QuietHours, exempt: boolean): Date {
  if (exempt) return at;
  return shiftOutOfQuiet(at, quiet);
}
