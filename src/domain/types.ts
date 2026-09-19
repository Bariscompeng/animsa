/**
 * Shared domain types. This module is pure TypeScript: it must never import
 * React, Expo or database modules (see docs/MIMARI.md).
 */

export type ReminderType = 'none' | 'notification' | 'alarm';

export type PlaceType = 'home' | 'work' | 'market' | 'pharmacy' | 'bakery' | 'hardware' | 'other';

export type Unit = 'adet' | 'kg' | 'g' | 'lt' | 'ml' | 'paket';

export const UNITS: Unit[] = ['adet', 'kg', 'g', 'lt', 'ml', 'paket'];

/** 1 = Monday … 7 = Sunday (ISO-8601 weekday numbering, used everywhere). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi',
  7: 'Pazar',
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  1: 'Pzt',
  2: 'Sal',
  3: 'Çar',
  4: 'Per',
  5: 'Cum',
  6: 'Cmt',
  7: 'Paz',
};

export type RecurrenceEnd =
  | { kind: 'never' }
  | { kind: 'date'; date: string } // YYYY-MM-DD, inclusive
  | { kind: 'count'; count: number };

export type RecurrenceRule =
  | { freq: 'daily'; interval?: number; end?: RecurrenceEnd }
  | { freq: 'weekly'; interval?: number; weekdays: Weekday[]; end?: RecurrenceEnd }
  | { freq: 'monthlyDay'; day: number; end?: RecurrenceEnd } // 1..31, 31 clamps to month end
  | { freq: 'monthlyLastDay'; end?: RecurrenceEnd }
  | { freq: 'yearly'; month: number; day: number; end?: RecurrenceEnd }; // month 1..12

export type OccurrenceStatus = 'done' | 'skipped' | 'snoozed';

export type OccurrenceState = {
  taskId: string;
  occurrenceKey: string;
  status: OccurrenceStatus;
  snoozedUntil?: number | null;
  completedAt?: number | null;
};

export type LocationTrigger = {
  placeId: string;
  on: 'enter' | 'exit';
};

/** Minimum shape the recurrence engine and planner need from a task row. */
export type TaskLike = {
  id: string;
  title: string;
  notes?: string | null;
  dueDate?: string | null; // YYYY-MM-DD
  dueTime?: string | null; // HH:mm
  rrule?: RecurrenceRule | null;
  reminderType: ReminderType;
  leadMinutes: number;
  important?: boolean;
  locationTrigger?: LocationTrigger | null;
  onHomeExit?: boolean;
  onHomeArrive?: boolean;
  archivedAt?: number | null;
};

export type Occurrence = {
  taskId: string;
  /** Stable identity of the occurrence: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`. */
  occurrenceKey: string;
  /** Local date of the (possibly snoozed) occurrence. */
  date: string;
  time?: string | null;
  /** Concrete local moment, or the start of day for all-day occurrences. */
  at: Date;
  /** True when the user has an explicit clock time (drives quiet-hours rules). */
  hasTime: boolean;
  status?: OccurrenceStatus;
  snoozed: boolean;
};

export type QuietHours = {
  enabled: boolean;
  start: string; // HH:mm
  end: string; // HH:mm
};

export type CategoryLike = {
  id: string;
  name: string;
  sortOrder: number;
  placeTypes: PlaceType[];
  sfSymbol: string;
};

export type ItemLike = {
  id: string;
  name: string;
  categoryId: string;
  unit: Unit;
  onList: boolean;
  listQty?: number | null;
  expiryDate?: string | null;
};

export type PlaceLike = {
  id: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  radiusM: number;
  enabled: boolean;
  source: 'user' | 'osm';
  osmId?: string | null;
  brand?: string | null;
};

export type ListReminderRule = {
  id: string;
  rrule: RecurrenceRule;
  time: string; // HH:mm
  enabled: boolean;
};
