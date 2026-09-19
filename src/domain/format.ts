/**
 * Pure date/text helpers. Everything the user reads is Turkish with `tr-TR`
 * formatting; every calendar computation below works in local time.
 */
import type { Unit } from './types';

export const MONTHS_TR = [
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

export const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Local `YYYY-MM-DD` for a Date (never UTC — `toISOString` would shift days). */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Local `HH:mm` for a Date. */
export function toTimeKey(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Parses `YYYY-MM-DD` into a local Date at midnight. Returns null when invalid. */
export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

/** Parses `HH:mm` into `{hour, minute}`. Returns null when invalid. */
export function parseTimeKey(key: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(key);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** Combines a local date key and optional time key into a local Date. */
export function combineDateTime(dateKey: string, timeKey?: string | null): Date | null {
  const base = parseDateKey(dateKey);
  if (!base) return null;
  if (!timeKey) return base;
  const t = parseTimeKey(timeKey);
  if (!t) return base;
  base.setHours(t.hour, t.minute, 0, 0);
  return base;
}

export function startOfDay(d: Date): Date {
  const out = new Date(d.getTime());
  out.setHours(0, 0, 0, 0);
  return out;
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + days);
  return out;
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** Whole local days between two dates (b - a), ignoring the time of day. */
export function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** "18 Eylül Cuma" */
export function formatLongDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${DAYS_TR[d.getDay()]}`;
}

/** "18 Eylül" */
export function formatShortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]}`;
}

/** "25 Eylül 14:32" */
export function formatDateTime(d: Date): string {
  return `${formatShortDate(d)} ${toTimeKey(d)}`;
}

/** Relative day label for list headers: Bugün / Yarın / Dün / "18 Eylül Cuma". */
export function formatRelativeDay(d: Date, now: Date): string {
  const diff = daysBetween(now, d);
  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Yarın';
  if (diff === -1) return 'Dün';
  if (diff === 2) return 'Öbür gün';
  return formatLongDate(d);
}

/** "4 gün 6 saat" — coarse duration used by the signature guard. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return 'doldu';
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days} gün ${hours} saat` : `${days} gün`;
  if (hours > 0) return minutes > 0 ? `${hours} saat ${minutes} dk` : `${hours} saat`;
  return `${minutes} dk`;
}

/** Turkish list joining: "süt, ekmek ve yumurta". */
export function joinTr(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(', ')} ve ${parts[parts.length - 1]!}`;
}

/**
 * "süt, ekmek, yumurta ve 4 ürün daha" — names up to `max` items and counts
 * the rest. Used by list, summary and location notifications.
 */
export function summarizeNames(names: string[], max = 3): string {
  if (names.length === 0) return '';
  if (names.length <= max) return joinTr(names);
  const shown = names.slice(0, max).join(', ');
  return `${shown} ve ${names.length - max} ürün daha`;
}

/** "2 kg" / "3 adet" — trims trailing zeroes from fractional quantities. */
export function formatQty(qty: number | null | undefined, unit: Unit): string {
  if (qty === null || qty === undefined) return '';
  const rounded = Math.round(qty * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
  return `${text} ${unit}`;
}
