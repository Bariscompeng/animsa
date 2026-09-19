import {
  describeRule,
  expandOccurrences,
  nextOccurrence,
  occurrenceKeyFor,
  toWeeklyAlarmSpec,
} from './recurrence';
import { toDateKey } from './format';
import type { OccurrenceState, RecurrenceRule, TaskLike } from './types';

const task = (over: Partial<TaskLike> = {}): TaskLike => ({
  id: 't1',
  title: 'Test',
  reminderType: 'notification',
  leadMinutes: 0,
  ...over,
});

const at = (s: string): Date => new Date(s);
const keys = (
  task_: TaskLike,
  from: string,
  to: string,
  states: OccurrenceState[] = [],
): string[] => expandOccurrences(task_, at(from), at(to), states).map((o) => o.occurrenceKey);

describe('occurrenceKeyFor', () => {
  it('uses the date alone for all-day occurrences', () => {
    expect(occurrenceKeyFor('2026-09-19')).toBe('2026-09-19');
  });

  it('appends the time when there is one', () => {
    expect(occurrenceKeyFor('2026-09-19', '09:30')).toBe('2026-09-19T09:30');
  });
});

describe('expandOccurrences — non-recurring', () => {
  it('returns a single occurrence inside the window', () => {
    const t = task({ dueDate: '2026-09-20', dueTime: '09:00' });
    expect(keys(t, '2026-09-19T00:00', '2026-09-30T00:00')).toEqual(['2026-09-20T09:00']);
  });

  it('returns nothing when the occurrence is outside the window', () => {
    const t = task({ dueDate: '2026-10-20' });
    expect(keys(t, '2026-09-19T00:00', '2026-09-30T00:00')).toEqual([]);
  });

  it('returns nothing for an undated task', () => {
    expect(keys(task({ dueTime: '09:00' }), '2026-09-19T00:00', '2026-09-30T00:00')).toEqual([]);
  });

  it('returns nothing for an archived task', () => {
    const t = task({ dueDate: '2026-09-20', archivedAt: 1 });
    expect(keys(t, '2026-09-19T00:00', '2026-09-30T00:00')).toEqual([]);
  });
});

describe('expandOccurrences — daily', () => {
  const rule: RecurrenceRule = { freq: 'daily' };

  it('produces one occurrence per day', () => {
    const t = task({ dueDate: '2026-09-19', dueTime: '08:00', rrule: rule });
    expect(keys(t, '2026-09-19T00:00', '2026-09-22T23:59')).toEqual([
      '2026-09-19T08:00',
      '2026-09-20T08:00',
      '2026-09-21T08:00',
      '2026-09-22T08:00',
    ]);
  });

  it('honours an interval of 3 days', () => {
    const t = task({ dueDate: '2026-09-19', rrule: { freq: 'daily', interval: 3 } });
    expect(keys(t, '2026-09-19T00:00', '2026-09-28T23:59')).toEqual([
      '2026-09-19',
      '2026-09-22',
      '2026-09-25',
      '2026-09-28',
    ]);
  });

  it('stops at an end date', () => {
    const t = task({
      dueDate: '2026-09-19',
      rrule: { freq: 'daily', end: { kind: 'date', date: '2026-09-21' } },
    });
    expect(keys(t, '2026-09-19T00:00', '2026-09-30T00:00')).toEqual([
      '2026-09-19',
      '2026-09-20',
      '2026-09-21',
    ]);
  });

  it('stops after a fixed count', () => {
    const t = task({
      dueDate: '2026-09-19',
      rrule: { freq: 'daily', end: { kind: 'count', count: 2 } },
    });
    expect(keys(t, '2026-09-19T00:00', '2026-09-30T00:00')).toEqual(['2026-09-19', '2026-09-20']);
  });

  it('treats interval 0 as 1', () => {
    const t = task({ dueDate: '2026-09-19', rrule: { freq: 'daily', interval: 0 } });
    expect(keys(t, '2026-09-19T00:00', '2026-09-21T23:59')).toHaveLength(3);
  });
});

describe('expandOccurrences — weekly', () => {
  it('fires on weekdays only', () => {
    // 2026-09-19 is a Saturday.
    const t = task({ dueDate: '2026-09-19', rrule: { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] } });
    expect(keys(t, '2026-09-19T00:00', '2026-09-27T23:59')).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
    ]);
  });

  it('fires on weekends only', () => {
    const t = task({ dueDate: '2026-09-19', rrule: { freq: 'weekly', weekdays: [6, 7] } });
    expect(keys(t, '2026-09-19T00:00', '2026-09-27T23:59')).toEqual([
      '2026-09-19',
      '2026-09-20',
      '2026-09-26',
      '2026-09-27',
    ]);
  });

  it('fires on selected days', () => {
    const t = task({ dueDate: '2026-09-19', rrule: { freq: 'weekly', weekdays: [1, 4] } });
    expect(keys(t, '2026-09-19T00:00', '2026-10-01T23:59')).toEqual([
      '2026-09-21',
      '2026-09-24',
      '2026-09-28',
      '2026-10-01',
    ]);
  });

  it('honours every-2-weeks', () => {
    const t = task({
      dueDate: '2026-09-21',
      rrule: { freq: 'weekly', interval: 2, weekdays: [1] },
    });
    expect(keys(t, '2026-09-21T00:00', '2026-10-20T23:59')).toEqual([
      '2026-09-21',
      '2026-10-05',
      '2026-10-19',
    ]);
  });

  it('honours every-3-weeks on two days', () => {
    const t = task({
      dueDate: '2026-09-21',
      rrule: { freq: 'weekly', interval: 3, weekdays: [1, 3] },
    });
    expect(keys(t, '2026-09-21T00:00', '2026-10-20T23:59')).toEqual([
      '2026-09-21',
      '2026-09-23',
      '2026-10-12',
      '2026-10-14',
    ]);
  });

  it('deduplicates repeated weekdays', () => {
    const t = task({ dueDate: '2026-09-21', rrule: { freq: 'weekly', weekdays: [1, 1, 1] } });
    expect(keys(t, '2026-09-21T00:00', '2026-09-28T23:59')).toEqual(['2026-09-21', '2026-09-28']);
  });

  it('returns nothing when no weekday is selected', () => {
    const t = task({ dueDate: '2026-09-21', rrule: { freq: 'weekly', weekdays: [] } });
    expect(keys(t, '2026-09-21T00:00', '2026-09-28T23:59')).toEqual([]);
  });
});

describe('expandOccurrences — monthly', () => {
  it('fires on the Nth day of each month', () => {
    const t = task({ dueDate: '2026-01-05', rrule: { freq: 'monthlyDay', day: 5 } });
    expect(keys(t, '2026-01-01T00:00', '2026-04-30T23:59')).toEqual([
      '2026-01-05',
      '2026-02-05',
      '2026-03-05',
      '2026-04-05',
    ]);
  });

  it('clamps day 31 to the real end of short months', () => {
    const t = task({ dueDate: '2026-01-31', rrule: { freq: 'monthlyDay', day: 31 } });
    expect(keys(t, '2026-01-01T00:00', '2026-04-30T23:59')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('clamps day 31 to 29 February in a leap year', () => {
    const t = task({ dueDate: '2028-01-31', rrule: { freq: 'monthlyDay', day: 31 } });
    expect(keys(t, '2028-02-01T00:00', '2028-02-29T23:59')).toEqual(['2028-02-29']);
  });

  it('clamps day 30 in February', () => {
    const t = task({ dueDate: '2026-01-30', rrule: { freq: 'monthlyDay', day: 30 } });
    expect(keys(t, '2026-02-01T00:00', '2026-02-28T23:59')).toEqual(['2026-02-28']);
  });

  it('fires on the last day of each month', () => {
    const t = task({ dueDate: '2026-01-31', rrule: { freq: 'monthlyLastDay' } });
    expect(keys(t, '2026-01-01T00:00', '2026-03-31T23:59')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('crosses a year boundary', () => {
    const t = task({ dueDate: '2026-11-15', rrule: { freq: 'monthlyDay', day: 15 } });
    expect(keys(t, '2026-12-01T00:00', '2027-02-28T23:59')).toEqual([
      '2026-12-15',
      '2027-01-15',
      '2027-02-15',
    ]);
  });
});

describe('expandOccurrences — yearly', () => {
  it('fires once a year', () => {
    const t = task({ dueDate: '2026-03-03', rrule: { freq: 'yearly', month: 3, day: 3 } });
    expect(keys(t, '2026-01-01T00:00', '2028-12-31T23:59')).toEqual([
      '2026-03-03',
      '2027-03-03',
      '2028-03-03',
    ]);
  });

  it('falls back to 28 February in non-leap years', () => {
    const t = task({ dueDate: '2028-02-29', rrule: { freq: 'yearly', month: 2, day: 29 } });
    expect(keys(t, '2029-01-01T00:00', '2029-12-31T23:59')).toEqual(['2029-02-28']);
  });

  it('keeps 29 February in a leap year', () => {
    const t = task({ dueDate: '2028-02-29', rrule: { freq: 'yearly', month: 2, day: 29 } });
    expect(keys(t, '2032-01-01T00:00', '2032-12-31T23:59')).toEqual(['2032-02-29']);
  });
});

describe('expandOccurrences — occurrence states', () => {
  const base = task({ dueDate: '2026-09-19', rrule: { freq: 'daily' } });

  it('omits completed occurrences', () => {
    const states: OccurrenceState[] = [
      { taskId: 't1', occurrenceKey: '2026-09-20', status: 'done', completedAt: 1 },
    ];
    expect(keys(base, '2026-09-19T00:00', '2026-09-21T23:59', states)).toEqual([
      '2026-09-19',
      '2026-09-21',
    ]);
  });

  it('omits skipped occurrences', () => {
    const states: OccurrenceState[] = [
      { taskId: 't1', occurrenceKey: '2026-09-19', status: 'skipped' },
    ];
    expect(keys(base, '2026-09-19T00:00', '2026-09-20T23:59', states)).toEqual(['2026-09-20']);
  });

  it('moves a snoozed occurrence to its new time but keeps the key', () => {
    const states: OccurrenceState[] = [
      {
        taskId: 't1',
        occurrenceKey: '2026-09-19',
        status: 'snoozed',
        snoozedUntil: at('2026-09-21T10:00').getTime(),
      },
    ];
    const out = expandOccurrences(base, at('2026-09-19T00:00'), at('2026-09-21T23:59'), states);
    const snoozed = out.find((o) => o.occurrenceKey === '2026-09-19');
    expect(snoozed).toBeDefined();
    expect(snoozed!.snoozed).toBe(true);
    expect(toDateKey(snoozed!.at)).toBe('2026-09-21');
    expect(snoozed!.time).toBe('10:00');
  });

  it('ignores states belonging to another task', () => {
    const states: OccurrenceState[] = [
      { taskId: 'other', occurrenceKey: '2026-09-19', status: 'done' },
    ];
    expect(keys(base, '2026-09-19T00:00', '2026-09-19T23:59', states)).toEqual(['2026-09-19']);
  });

  it('marks a snoozed occurrence as having a time even when the task has none', () => {
    const states: OccurrenceState[] = [
      {
        taskId: 't1',
        occurrenceKey: '2026-09-19',
        status: 'snoozed',
        snoozedUntil: at('2026-09-19T18:30').getTime(),
      },
    ];
    const out = expandOccurrences(base, at('2026-09-19T00:00'), at('2026-09-19T23:59'), states);
    expect(out[0]!.hasTime).toBe(true);
  });

  it('sorts results ascending by moment', () => {
    const t = task({ dueDate: '2026-09-19', dueTime: '07:00', rrule: { freq: 'daily' } });
    const out = expandOccurrences(t, at('2026-09-19T00:00'), at('2026-09-23T23:59'));
    const times = out.map((o) => o.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe('nextOccurrence', () => {
  it('finds the next daily occurrence', () => {
    const next = nextOccurrence(
      { freq: 'daily' },
      at('2026-09-19T10:00'),
      at('2026-09-19T00:00'),
      '08:00',
    );
    expect(next && toDateKey(next)).toBe('2026-09-20');
  });

  it('finds the next weekly occurrence', () => {
    const next = nextOccurrence(
      { freq: 'weekly', weekdays: [1] },
      at('2026-09-19T10:00'),
      at('2026-09-19T00:00'),
      '08:00',
    );
    expect(next && toDateKey(next)).toBe('2026-09-21');
  });

  it('returns null once a counted rule has run out', () => {
    const next = nextOccurrence(
      { freq: 'daily', end: { kind: 'count', count: 1 } },
      at('2026-09-25T10:00'),
      at('2026-09-19T00:00'),
      '08:00',
    );
    expect(next).toBeNull();
  });

  it('returns null after an end date', () => {
    const next = nextOccurrence(
      { freq: 'daily', end: { kind: 'date', date: '2026-09-20' } },
      at('2026-09-25T10:00'),
      at('2026-09-19T00:00'),
    );
    expect(next).toBeNull();
  });
});

describe('toWeeklyAlarmSpec', () => {
  it('maps a daily rule to all seven weekdays', () => {
    expect(toWeeklyAlarmSpec({ freq: 'daily' }, '07:30')).toEqual({
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      hour: 7,
      minute: 30,
    });
  });

  it('maps weekdays', () => {
    expect(toWeeklyAlarmSpec({ freq: 'weekly', weekdays: [1, 2, 3, 4, 5] }, '06:45')).toEqual({
      weekdays: [1, 2, 3, 4, 5],
      hour: 6,
      minute: 45,
    });
  });

  it('rejects an interval greater than one', () => {
    expect(toWeeklyAlarmSpec({ freq: 'daily', interval: 2 }, '08:00')).toBeNull();
  });

  it('rejects monthly rules', () => {
    expect(toWeeklyAlarmSpec({ freq: 'monthlyDay', day: 5 }, '08:00')).toBeNull();
  });

  it('rejects yearly rules', () => {
    expect(toWeeklyAlarmSpec({ freq: 'yearly', month: 3, day: 3 }, '08:00')).toBeNull();
  });

  it('rejects a bounded rule', () => {
    expect(
      toWeeklyAlarmSpec({ freq: 'daily', end: { kind: 'count', count: 3 } }, '08:00'),
    ).toBeNull();
  });

  it('rejects a rule without a time', () => {
    expect(toWeeklyAlarmSpec({ freq: 'daily' }, null)).toBeNull();
  });

  it('rejects a null rule', () => {
    expect(toWeeklyAlarmSpec(null, '08:00')).toBeNull();
  });
});

describe('describeRule', () => {
  it.each<[RecurrenceRule | null, string]>([
    [null, 'Tekrar yok'],
    [{ freq: 'daily' }, 'Her gün'],
    [{ freq: 'daily', interval: 3 }, '3 günde bir'],
    [{ freq: 'weekly', weekdays: [1, 2, 3, 4, 5] }, 'Hafta içi'],
    [{ freq: 'weekly', weekdays: [6, 7] }, 'Hafta sonu'],
    [{ freq: 'weekly', weekdays: [1, 2, 3, 4, 5, 6, 7] }, 'Her gün'],
    [{ freq: 'weekly', weekdays: [1, 4] }, 'Her Pazartesi, Perşembe'],
    [{ freq: 'weekly', interval: 2, weekdays: [1] }, '2 haftada bir Pazartesi'],
    [{ freq: 'monthlyDay', day: 5 }, 'Her ayın 5. günü'],
    [{ freq: 'monthlyLastDay' }, 'Her ayın son günü'],
    [{ freq: 'yearly', month: 3, day: 3 }, 'Her yıl 3 Mart'],
  ])('describes %j', (rule, expected) => {
    expect(describeRule(rule)).toBe(expected);
  });

  it('appends a count limit', () => {
    expect(describeRule({ freq: 'daily', end: { kind: 'count', count: 5 } })).toBe(
      'Her gün, 5 kez',
    );
  });

  it('appends an end date', () => {
    expect(describeRule({ freq: 'daily', end: { kind: 'date', date: '2026-10-01' } })).toBe(
      'Her gün, 1 Ekim 2026 tarihine kadar',
    );
  });
});
