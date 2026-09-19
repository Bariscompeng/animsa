/**
 * Turkish natural-language parser for the quick-add field.
 *
 * The parser scans the raw text for date, time, recurrence and reminder-type
 * expressions, records the character span of each match so the UI can render
 * chips, strips the matched spans from the title and tidies what is left.
 *
 * Everything here is pure: `now` is always injected so tests are deterministic.
 */
import { addDays, parseTimeKey, startOfDay, toDateKey, isoWeekday } from '../format';
import { capitalizeTr, normalizeTr } from '../normalize';
import type { RecurrenceRule, ReminderType, Weekday } from '../types';

export type SpanKind = 'date' | 'time' | 'recurrence' | 'reminder';

export type Span = {
  kind: SpanKind;
  start: number;
  end: number;
  text: string;
};

export type ParsedTask = {
  title: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  rule?: RecurrenceRule;
  reminderType?: Exclude<ReminderType, 'none'>;
  spans: Span[];
};

/** Named times of day, resolved per §5.8. */
const DAY_PART_TIMES: Record<string, string> = {
  sabah: '09:00',
  öğlen: '12:30',
  öğle: '12:30',
  'öğleden sonra': '15:00',
  akşam: '19:00',
  'bu akşam': '20:00',
  gece: '22:00',
  'bu gece': '22:00',
};

const WEEKDAY_WORDS: Record<string, Weekday> = {
  pazartesi: 1,
  sali: 2,
  carsamba: 3,
  persembe: 4,
  cuma: 5,
  cumartesi: 6,
  pazar: 7,
};

const MONTH_WORDS: Record<string, number> = {
  ocak: 1,
  subat: 2,
  mart: 3,
  nisan: 4,
  mayis: 5,
  haziran: 6,
  temmuz: 7,
  agustos: 8,
  eylul: 9,
  ekim: 10,
  kasim: 11,
  aralik: 12,
};

/** Turkish number words used in "iki haftada bir", "üç günde bir". */
const NUMBER_WORDS: Record<string, number> = {
  bir: 1,
  iki: 2,
  uc: 3,
  dort: 4,
  bes: 5,
  alti: 6,
  yedi: 7,
  sekiz: 8,
  dokuz: 9,
  on: 10,
};

/** Suffixes that may follow a time or date token (`9'da`, `9da`, `12 Ekim'de`). */
const SUFFIX = `(?:['’]?(?:da|de|ta|te|ya|ye|a|e|nda|nde|ndan|nden))?`;

type Match = {
  span: Span;
  apply: (draft: Draft) => void;
};

type Draft = {
  date?: string;
  time?: string;
  rule?: RecurrenceRule;
  reminderType?: Exclude<ReminderType, 'none'>;
  /** Set when an explicit morning/evening word constrains a bare hour. */
  dayPart?: 'morning' | 'afternoon' | 'evening' | 'night' | 'noon';
  /** True when the time came from a named day part rather than digits. */
  timeFromDayPart?: boolean;
  relativeMinutes?: number;
};

/**
 * Normalises for matching while preserving the original index mapping.
 * Turkish lowercase maps 1:1 for every character we care about, so indexes in
 * the normalised string line up with the original.
 */
function foldForMatch(text: string): string {
  const lowered = text.toLocaleLowerCase('tr-TR');
  const map: Record<string, string> = {
    ç: 'c',
    ğ: 'g',
    ı: 'i',
    ö: 'o',
    ş: 's',
    ü: 'u',
    â: 'a',
    î: 'i',
    û: 'u',
  };
  let out = '';
  for (const ch of lowered) out += map[ch] ?? ch;
  return out;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Resolves an ambiguous bare hour per §5.8:
 * an explicit day part always wins; otherwise 7–11 → morning, 1–6 → afternoon,
 * 12 → noon, 0/24 → midnight.
 */
function resolveHour(hour: number, dayPart: Draft['dayPart']): number {
  if (hour === 24) return 0;
  if (dayPart === 'morning') return hour === 12 ? 0 : hour % 12;
  if (dayPart === 'noon') return 12;
  if (dayPart === 'afternoon' || dayPart === 'evening') {
    return hour >= 12 ? hour : hour + 12;
  }
  if (dayPart === 'night') {
    if (hour >= 12) return hour;
    return hour <= 5 ? hour : hour + 12;
  }
  if (hour >= 13) return hour;
  if (hour === 12) return 12;
  if (hour === 0) return 0;
  if (hour >= 7 && hour <= 11) return hour;
  // 1..6 → afternoon/evening
  return hour + 12;
}

function nextWeekday(now: Date, target: Weekday, forceNextWeek: boolean): Date {
  const today = startOfDay(now);
  const current = isoWeekday(today) as Weekday;
  let delta = (target - current + 7) % 7;
  if (delta === 0) delta = 7; // "cuma" on a Friday means next Friday
  if (forceNextWeek) {
    const base = addDays(today, (8 - current) % 7 === 0 ? 7 : (8 - current) % 7);
    const baseDay = isoWeekday(base) as Weekday;
    let d2 = (target - baseDay + 7) % 7;
    return addDays(base, d2);
  }
  return addDays(today, delta);
}

function collectMatches(text: string, now: Date): Match[] {
  const hay = foldForMatch(text);
  const matches: Match[] = [];

  const push = (kind: SpanKind, start: number, end: number, apply: Match['apply']): void => {
    matches.push({ span: { kind, start, end, text: text.slice(start, end) }, apply });
  };

  const scan = (re: RegExp, handler: (m: RegExpExecArray) => Match['apply'] | null): void => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(hay)) !== null) {
      const apply = handler(m);
      if (apply) {
        const kind = (re as RegExp & { spanKind?: SpanKind }).spanKind ?? 'date';
        push(kind, m.index, m.index + m[0].length, apply);
      }
      if (m[0].length === 0) re.lastIndex++;
    }
  };

  const withKind = (re: RegExp, kind: SpanKind): RegExp => {
    (re as RegExp & { spanKind?: SpanKind }).spanKind = kind;
    return re;
  };

  // ---------------------------------------------------------------- recurrence
  // "her ayın 5'i" / "her ayin son gunu" — must run before plain "her gün".
  scan(
    withKind(new RegExp(`\\bher\\s+ay[ıi]n\\s+son\\s+g[üu]n[üu]\\b`, 'g'), 'recurrence'),
    () => (d) => {
      d.rule = { freq: 'monthlyLastDay' };
    },
  );
  scan(withKind(new RegExp(`\\bay[ıi]n\\s+son\\s+g[üu]n[üu]\\b`, 'g'), 'recurrence'), () => (d) => {
    if (!d.rule) d.rule = { freq: 'monthlyLastDay' };
  });
  scan(
    withKind(
      new RegExp(
        `\\bher\\s+ay[ıi]n\\s+(\\d{1,2})${SUFFIX}(?:\\s*[.'’]?\\s*(?:i|si|u|gun[üu]|g[üu]n[üu]))?`,
        'g',
      ),
      'recurrence',
    ),
    (m) => {
      const day = Number(m[1]);
      if (day < 1 || day > 31) return null;
      return (d) => {
        d.rule = { freq: 'monthlyDay', day };
      };
    },
  );

  // "her yıl 3 mart"
  scan(
    withKind(new RegExp(`\\bher\\s+y[ıi]l\\s+(\\d{1,2})\\s+([a-z]+)`, 'g'), 'recurrence'),
    (m) => {
      const day = Number(m[1]);
      const month = MONTH_WORDS[m[2] ?? ''];
      if (!month || day < 1 || day > 31) return null;
      return (d) => {
        d.rule = { freq: 'yearly', month, day };
      };
    },
  );

  // "3 günde bir" / "iki haftada bir"
  scan(
    withKind(new RegExp(`\\b(\\d{1,2}|[a-z]+)\\s+g[üu]nde\\s+bir\\b`, 'g'), 'recurrence'),
    (m) => {
      const raw = m[1] ?? '';
      const n = /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw];
      if (!n || n < 1) return null;
      return (d) => {
        d.rule = { freq: 'daily', interval: n };
      };
    },
  );
  scan(
    withKind(new RegExp(`\\b(\\d{1,2}|[a-z]+)\\s+haftada\\s+bir\\b`, 'g'), 'recurrence'),
    (m) => {
      const raw = m[1] ?? '';
      const n = /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw];
      if (!n || n < 1) return null;
      return (d) => {
        const weekdays = [isoWeekday(now) as Weekday];
        d.rule = { freq: 'weekly', interval: n, weekdays };
      };
    },
  );

  // "her pazartesi ve perşembe" — captures a chain of weekday names.
  scan(
    withKind(
      new RegExp(
        `\\bher\\s+(pazartesi|sali|carsamba|persembe|cuma|cumartesi|pazar)(?:\\s*(?:,|ve)\\s*(pazartesi|sali|carsamba|persembe|cuma|cumartesi|pazar))*`,
        'g',
      ),
      'recurrence',
    ),
    (m) => {
      const found = m[0].match(/pazartesi|sali|carsamba|persembe|cuma|cumartesi|pazar/g) ?? [];
      const weekdays = [...new Set(found.map((w) => WEEKDAY_WORDS[w]!))].sort(
        (a, b) => a - b,
      ) as Weekday[];
      if (weekdays.length === 0) return null;
      return (d) => {
        d.rule = { freq: 'weekly', weekdays };
      };
    },
  );

  scan(withKind(new RegExp(`\\bhafta\\s*i[çc]i\\b`, 'g'), 'recurrence'), () => (d) => {
    d.rule = { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] };
  });
  scan(withKind(new RegExp(`\\bhafta\\s*sonu\\b`, 'g'), 'recurrence'), () => (d) => {
    d.rule = { freq: 'weekly', weekdays: [6, 7] };
  });

  // "her gün"
  scan(withKind(new RegExp(`\\bher\\s+g[üu]n\\b`, 'g'), 'recurrence'), () => (d) => {
    d.rule = { freq: 'daily' };
  });

  // "her sabah 8'de", "her akşam" — the span covers only `her ` via a lookahead
  // so the day-part and clock scanners can still claim the words that follow.
  scan(
    withKind(new RegExp(`\\bher\\s+(?=sabah|ak[şs]am|gece|[öo][ğg]le)`, 'g'), 'recurrence'),
    () => (d) => {
      d.rule = { freq: 'daily' };
    },
  );

  // ---------------------------------------------------------------------- time
  // `09:30`, `9.30`, `21:15`
  scan(withKind(/\b(\d{1,2})[:.](\d{2})\b/g, 'time'), (m) => {
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (hour > 23 || minute > 59) return null;
    return (d) => {
      d.time = `${pad2(hour)}:${pad2(minute)}`;
      d.timeFromDayPart = false;
    };
  });

  // "9 buçuk" → 09:30, "akşam 8 buçuk" → 20:30
  scan(
    withKind(
      new RegExp(
        `\\b(?:(saat|sabah|ak[şs]am|gece|[öo][ğg]leden\\s+sonra|[öo][ğg]len?)\\s+)?(\\d{1,2})\\s+bu[çc]uk\\b`,
        'g',
      ),
      'time',
    ),
    (m) => {
      const qualifier = m[1];
      const hour = Number(m[2]);
      if (hour > 23) return null;
      return (d) => {
        let part = d.dayPart;
        if (qualifier) {
          if (qualifier.startsWith('sabah')) part = 'morning';
          else if (qualifier.startsWith('ak')) part = 'evening';
          else if (qualifier.startsWith('gece')) part = 'night';
          else if (/sonra/.test(qualifier)) part = 'afternoon';
          else if (/^[öo][ğg]len?$/.test(qualifier)) part = 'noon';
        }
        d.dayPart = part;
        d.time = `${pad2(resolveHour(hour, part))}:30`;
        d.timeFromDayPart = false;
      };
    },
  );

  // "saat 9", "sabah 9", "akşam 7", "öğleden sonra 3", "9'da", "9da"
  scan(
    withKind(
      new RegExp(
        `\\b(?:(saat|sabah|ak[şs]am|gece|[öo][ğg]leden\\s+sonra|[öo][ğg]len?)\\s+)?(\\d{1,2})${SUFFIX}\\b`,
        'g',
      ),
      'time',
    ),
    (m) => {
      const qualifier = m[1];
      const hour = Number(m[2]);
      if (hour > 24) return null;
      const bare = m[0].replace(/\s+/g, '');
      // A bare number with no qualifier and no suffix is not a time.
      const hasSuffix = /['’]?(?:da|de|ta|te|ya|ye|a|e)$/.test(bare);
      if (!qualifier && !hasSuffix) return null;
      return (d) => {
        let part: Draft['dayPart'] = d.dayPart;
        if (qualifier) {
          if (qualifier.startsWith('sabah')) part = 'morning';
          else if (qualifier.startsWith('ak')) part = 'evening';
          else if (qualifier.startsWith('gece')) part = 'night';
          else if (/sonra/.test(qualifier)) part = 'afternoon';
          else if (/^[öo][ğg]len?$/.test(qualifier)) part = 'noon';
        }
        d.dayPart = part;
        d.time = `${pad2(resolveHour(hour, part))}:00`;
        d.timeFromDayPart = false;
      };
    },
  );

  // Named day parts on their own: "bu akşam", "sabah", "öğlen"…
  scan(
    withKind(
      new RegExp(
        `\\b(bu\\s+ak[şs]am|bu\\s+gece|[öo][ğg]leden\\s+sonra|sabah|[öo][ğg]len|[öo][ğg]le|ak[şs]am|gece)\\b`,
        'g',
      ),
      'time',
    ),
    (m) => {
      const raw = (m[1] ?? '').replace(/\s+/g, ' ');
      const key = raw
        .replace('bu aksam', 'bu akşam')
        .replace('bu gece', 'bu gece')
        .replace('ogleden sonra', 'öğleden sonra')
        .replace('oglen', 'öğlen')
        .replace('ogle', 'öğle')
        .replace('aksam', 'akşam');
      const time = DAY_PART_TIMES[key];
      if (!time) return null;
      return (d) => {
        if (key.startsWith('sabah')) d.dayPart = 'morning';
        else if (key.includes('akşam')) d.dayPart = 'evening';
        else if (key.includes('gece')) d.dayPart = 'night';
        else if (key.includes('sonra')) d.dayPart = 'afternoon';
        else d.dayPart = 'noon';
        // Only fill the clock if no explicit digits were given.
        if (!d.time || d.timeFromDayPart) {
          d.time = time;
          d.timeFromDayPart = true;
        }
      };
    },
  );

  // ------------------------------------------------------------ relative delay
  scan(withKind(new RegExp(`\\byar[ıi]m\\s+saat\\s+sonra\\b`, 'g'), 'time'), () => (d) => {
    d.relativeMinutes = 30;
  });
  scan(
    withKind(new RegExp(`\\b(\\d{1,3})\\s*(dk|dakika|saat|g[üu]n)\\s+sonra\\b`, 'g'), 'time'),
    (m) => {
      const n = Number(m[1]);
      const unit = m[2] ?? '';
      if (!Number.isFinite(n) || n <= 0) return null;
      const minutes = unit.startsWith('saat') ? n * 60 : unit.startsWith('g') ? n * 1440 : n;
      return (d) => {
        d.relativeMinutes = minutes;
      };
    },
  );

  // ---------------------------------------------------------------------- date
  scan(withKind(new RegExp(`\\bbug[üu]n\\b`, 'g'), 'date'), () => (d) => {
    d.date = toDateKey(now);
  });
  scan(withKind(new RegExp(`\\byar[ıi]n\\b`, 'g'), 'date'), () => (d) => {
    d.date = toDateKey(addDays(now, 1));
  });
  scan(
    withKind(new RegExp(`\\b(?:[öo]b[üu]r\\s+g[üu]n|ertesi\\s+g[üu]n)\\b`, 'g'), 'date'),
    () => (d) => {
      d.date = toDateKey(addDays(now, 2));
    },
  );

  // "haftaya salı" / "gelecek hafta salı" / "gelecek hafta"
  scan(
    withKind(
      new RegExp(
        `\\b(?:haftaya|gelecek\\s+hafta|[öo]n[üu]m[üu]zdeki\\s+hafta)(?:\\s+(pazartesi|sali|carsamba|persembe|cuma|cumartesi|pazar))?\\b`,
        'g',
      ),
      'date',
    ),
    (m) => {
      const day = m[1] ? WEEKDAY_WORDS[m[1]] : 1; // bare "gelecek hafta" → next Monday
      if (!day) return null;
      return (d) => {
        d.date = toDateKey(nextWeekday(now, day, true));
      };
    },
  );

  // Bare weekday: "cuma", "cuma günü"
  scan(
    withKind(
      new RegExp(
        `\\b(pazartesi|sali|carsamba|persembe|cuma|cumartesi|pazar)(?:\\s+g[üu]n[üu])?${SUFFIX}\\b`,
        'g',
      ),
      'date',
    ),
    (m) => {
      const day = WEEKDAY_WORDS[m[1] ?? ''];
      if (!day) return null;
      return (d) => {
        if (!d.rule) d.date = toDateKey(nextWeekday(now, day, false));
      };
    },
  );

  // "12 ekim", "12 Ekim'de"
  scan(
    withKind(
      new RegExp(
        `\\b(\\d{1,2})\\s+(ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)${SUFFIX}\\b`,
        'g',
      ),
      'date',
    ),
    (m) => {
      const day = Number(m[1]);
      const month = MONTH_WORDS[m[2] ?? ''];
      if (!month || day < 1 || day > 31) return null;
      return (d) => {
        if (d.rule?.freq === 'yearly') return;
        const year =
          new Date(now.getFullYear(), month - 1, day).getTime() < startOfDay(now).getTime()
            ? now.getFullYear() + 1
            : now.getFullYear();
        d.date = `${year}-${pad2(month)}-${pad2(day)}`;
      };
    },
  );

  // "12.10", "12/10", "12/10/2026"
  scan(withKind(/\b(\d{1,2})([./])(\d{1,2})(?:[./](\d{2,4}))?\b/g, 'date'), (m) => {
    const day = Number(m[1]);
    const separator = m[2];
    const month = Number(m[3]);
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    // A dotted pair with no year is ambiguous with `HH.mm`; the clock scanner
    // owns that form, so only slash-separated pairs parse as a bare date.
    if (!m[4] && separator === '.') return null;
    let year = m[4] ? Number(m[4]) : now.getFullYear();
    if (year < 100) year += 2000;
    return (d) => {
      const candidate = new Date(year, month - 1, day);
      const resolvedYear =
        !m[4] && candidate.getTime() < startOfDay(now).getTime() ? year + 1 : year;
      d.date = `${resolvedYear}-${pad2(month)}-${pad2(day)}`;
    };
  });

  // ------------------------------------------------------------ reminder type
  scan(withKind(new RegExp(`\\balarml?[ıi]?\\b`, 'g'), 'reminder'), () => (d) => {
    d.reminderType = 'alarm';
  });
  scan(withKind(new RegExp(`\\bbildirim(?:li)?\\b`, 'g'), 'reminder'), () => (d) => {
    if (d.reminderType !== 'alarm') d.reminderType = 'notification';
  });

  return matches;
}

/** Drops overlapping matches, keeping the longest (then earliest) one. */
function resolveOverlaps(matches: Match[]): Match[] {
  const sorted = [...matches].sort((a, b) => {
    const lenA = a.span.end - a.span.start;
    const lenB = b.span.end - b.span.start;
    if (lenA !== lenB) return lenB - lenA;
    return a.span.start - b.span.start;
  });
  const kept: Match[] = [];
  for (const m of sorted) {
    const clashes = kept.some((k) => m.span.start < k.span.end && k.span.start < m.span.end);
    if (!clashes) kept.push(m);
  }
  return kept.sort((a, b) => a.span.start - b.span.start);
}

function stripSpans(text: string, spans: Span[]): string {
  let out = '';
  let cursor = 0;
  for (const s of spans) {
    out += text.slice(cursor, s.start);
    out += ' ';
    cursor = s.end;
  }
  out += text.slice(cursor);
  return out
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:–-]+/, '')
    .replace(/[\s,.;:–-]+$/, '')
    .trim();
}

/**
 * Parses free Turkish text into a task draft.
 *
 * @param text Raw user input.
 * @param now Reference moment; injected so results are deterministic in tests.
 */
export function parseTaskInput(text: string, now: Date): ParsedTask {
  const raw = text ?? '';
  const matches = resolveOverlaps(collectMatches(raw, now));

  const draft: Draft = {};
  // Recurrence and day parts must be applied before bare hours so the
  // "explicit morning/evening wins" rule can take effect.
  const order: SpanKind[] = ['recurrence', 'date', 'time', 'reminder'];
  for (const kind of order) {
    for (const m of matches) {
      if (m.span.kind === kind) m.apply(draft);
    }
  }

  let date = draft.date;
  let time = draft.time;

  if (draft.relativeMinutes !== undefined) {
    const at = new Date(now.getTime() + draft.relativeMinutes * 60_000);
    date = toDateKey(at);
    time = `${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
  }

  // A time with no day: today when it is still ahead, otherwise tomorrow.
  if (time && !date) {
    const t = parseTimeKey(time);
    if (t) {
      const candidate = new Date(now.getTime());
      candidate.setHours(t.hour, t.minute, 0, 0);
      date = toDateKey(candidate.getTime() > now.getTime() ? candidate : addDays(now, 1));
    }
  }

  // A recurring rule with no explicit start begins today.
  if (draft.rule && !date) date = toDateKey(now);

  let reminderType = draft.reminderType;
  if (!reminderType && time) reminderType = 'notification';

  const title = capitalizeTr(
    stripSpans(
      raw,
      matches.map((m) => m.span),
    ),
  );

  const result: ParsedTask = { title, spans: matches.map((m) => m.span) };
  if (date) result.date = date;
  if (time) result.time = time;
  if (draft.rule) result.rule = draft.rule;
  if (reminderType) result.reminderType = reminderType;
  return result;
}

/** True when the text carries no schedulable information at all. */
export function isPlainTitle(parsed: ParsedTask): boolean {
  return !parsed.date && !parsed.time && !parsed.rule;
}

/** Exposed for tests and the chip renderer. */
export const __internal = { resolveHour, normalizeTr };
