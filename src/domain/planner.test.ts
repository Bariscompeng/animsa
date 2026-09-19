import {
  NOTIFICATION_BUDGET,
  build,
  buildSummaryBody,
  contentHash,
  type DesiredAlarm,
  type DesiredNotification,
  type PlannerState,
} from './planner';
import { DEFAULT_QUIET_HOURS } from './quietHours';
import { toDateKey, toTimeKey } from './format';
import type { CategoryLike, ItemLike, TaskLike } from './types';

/** Friday, 18 September 2026, 10:00 local. */
const NOW = new Date(2026, 8, 18, 10, 0, 0, 0);

const category: CategoryLike = {
  id: 'c-market',
  name: 'Manav',
  sortOrder: 0,
  placeTypes: ['market'],
  sfSymbol: 'carrot',
};

const item = (over: Partial<ItemLike> & { id: string }): ItemLike => ({
  name: over.id,
  categoryId: 'c-market',
  unit: 'adet',
  onList: false,
  ...over,
});

const task = (over: Partial<TaskLike> & { id: string }): TaskLike => ({
  title: over.id,
  reminderType: 'notification',
  leadMinutes: 0,
  ...over,
});

const state = (over: Partial<PlannerState> = {}): PlannerState => ({
  tasks: [],
  occurrenceStates: [],
  items: [],
  categories: [category],
  listRules: [],
  quietHours: DEFAULT_QUIET_HOURS,
  summaryEnabled: false,
  summaryTime: '08:00',
  eveningPreviewEnabled: false,
  eveningPreviewTime: '21:00',
  expiryRemindersEnabled: true,
  signatureExpiresAt: null,
  alarmsAvailable: true,
  ...over,
});

const notifications = (s: PlannerState, now = NOW): DesiredNotification[] =>
  build(s, now).desired.filter((d): d is DesiredNotification => d.kind === 'notification');

const alarms = (s: PlannerState, now = NOW): DesiredAlarm[] =>
  build(s, now).desired.filter((d): d is DesiredAlarm => d.kind === 'alarm');

describe('contentHash', () => {
  it('is stable for the same input', () => {
    expect(contentHash('a', 1)).toBe(contentHash('a', 1));
  });
  it('changes when the content changes', () => {
    expect(contentHash('a', 1)).not.toBe(contentHash('a', 2));
  });
  it('distinguishes field boundaries', () => {
    expect(contentHash('ab', 'c')).not.toBe(contentHash('a', 'bc'));
  });
  it('treats null and undefined as empty', () => {
    expect(contentHash(null)).toBe(contentHash(undefined));
  });
});

describe('deterministic keys', () => {
  it('builds a task key from id and occurrence', () => {
    const s = state({
      tasks: [task({ id: 't1', dueDate: '2026-09-19', dueTime: '09:00' })],
    });
    expect(notifications(s)[0]!.key).toBe('task:t1:2026-09-19T09:00:main');
  });

  it('produces the same plan twice for the same state', () => {
    const s = state({
      tasks: [task({ id: 't1', dueDate: '2026-09-19', dueTime: '09:00' })],
    });
    const a = build(s, NOW).desired.map((d) => `${d.key}:${d.contentHash}`);
    const b = build(s, NOW).desired.map((d) => `${d.key}:${d.contentHash}`);
    expect(a).toEqual(b);
  });

  it('keeps the key but changes the hash when the title changes', () => {
    const before = notifications(
      state({
        tasks: [task({ id: 't1', title: 'Eski', dueDate: '2026-09-19', dueTime: '09:00' })],
      }),
    )[0]!;
    const after = notifications(
      state({
        tasks: [task({ id: 't1', title: 'Yeni', dueDate: '2026-09-19', dueTime: '09:00' })],
      }),
    )[0]!;
    expect(after.key).toBe(before.key);
    expect(after.contentHash).not.toBe(before.contentHash);
  });

  it('uses a separate key for the lead reminder', () => {
    const s = state({
      tasks: [task({ id: 't1', dueDate: '2026-09-19', dueTime: '09:00', leadMinutes: 15 })],
    });
    const keys = notifications(s).map((n) => n.key);
    expect(keys).toContain('task:t1:2026-09-19T09:00:lead');
    expect(keys).toContain('task:t1:2026-09-19T09:00:main');
  });
});

describe('task planning', () => {
  it('skips tasks with no reminder', () => {
    const s = state({
      tasks: [task({ id: 't1', dueDate: '2026-09-19', dueTime: '09:00', reminderType: 'none' })],
    });
    expect(notifications(s)).toHaveLength(0);
  });

  it('skips archived tasks', () => {
    const s = state({
      tasks: [task({ id: 't1', dueDate: '2026-09-19', dueTime: '09:00', archivedAt: 1 })],
    });
    expect(notifications(s)).toHaveLength(0);
  });

  it('skips occurrences already in the past', () => {
    const s = state({
      tasks: [task({ id: 't1', dueDate: '2026-09-18', dueTime: '09:00' })],
    });
    expect(notifications(s)).toHaveLength(0);
  });

  it('uses the notes as the body when there are notes', () => {
    const s = state({
      tasks: [task({ id: 't1', dueDate: '2026-09-19', dueTime: '09:00', notes: 'Aç karnına' })],
    });
    expect(notifications(s)[0]!.body).toBe('Aç karnına');
  });

  it('labels an all-day task as "Gün içinde"', () => {
    const s = state({ tasks: [task({ id: 't1', dueDate: '2026-09-19' })] });
    expect(notifications(s)[0]!.body).toBe('Gün içinde');
  });

  it('stays within the 7-day notification window', () => {
    const s = state({
      tasks: [
        task({ id: 't1', dueDate: '2026-09-19', dueTime: '09:00', rrule: { freq: 'daily' } }),
      ],
    });
    const dates = notifications(s).map((n) => toDateKey(n.fireAt));
    expect(dates).not.toContain('2026-09-27');
    expect(dates).toContain('2026-09-25');
  });
});

describe('alarms', () => {
  it('collapses a daily alarm into one weekly repeat', () => {
    const s = state({
      tasks: [
        task({
          id: 't1',
          dueDate: '2026-09-19',
          dueTime: '07:00',
          reminderType: 'alarm',
          rrule: { freq: 'daily' },
        }),
      ],
    });
    const list = alarms(s);
    expect(list).toHaveLength(1);
    expect(list[0]!.key).toBe('task:t1:weekly');
    expect(list[0]!.schedule).toBe('weekly');
  });

  it('collapses a weekday alarm into one weekly repeat', () => {
    const s = state({
      tasks: [
        task({
          id: 't1',
          dueDate: '2026-09-21',
          dueTime: '06:30',
          reminderType: 'alarm',
          rrule: { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] },
        }),
      ],
    });
    const list = alarms(s);
    expect(list).toHaveLength(1);
    expect(list[0]!.schedule === 'weekly' && list[0]!.weekdays).toEqual([1, 2, 3, 4, 5]);
  });

  it('schedules monthly alarms individually inside the 14-day window', () => {
    const s = state({
      tasks: [
        task({
          id: 't1',
          dueDate: '2026-09-19',
          dueTime: '09:00',
          reminderType: 'alarm',
          rrule: { freq: 'monthlyDay', day: 19 },
        }),
      ],
    });
    const list = alarms(s);
    expect(list).toHaveLength(1);
    expect(list[0]!.schedule).toBe('fixed');
  });

  it('never emits an alarm for an all-day task', () => {
    const s = state({
      tasks: [task({ id: 't1', dueDate: '2026-09-19', reminderType: 'alarm' })],
    });
    expect(alarms(s)).toHaveLength(0);
  });

  it('falls back to notifications when alarms are unavailable', () => {
    const s = state({
      alarmsAvailable: false,
      tasks: [task({ id: 't1', dueDate: '2026-09-19', dueTime: '09:00', reminderType: 'alarm' })],
    });
    expect(alarms(s)).toHaveLength(0);
    expect(notifications(s)).toHaveLength(1);
  });

  it('sends the lead reminder as a notification even for an alarm task', () => {
    const s = state({
      tasks: [
        task({
          id: 't1',
          dueDate: '2026-09-19',
          dueTime: '09:00',
          reminderType: 'alarm',
          leadMinutes: 30,
        }),
      ],
    });
    expect(notifications(s).map((n) => n.key)).toEqual(['task:t1:2026-09-19T09:00:lead']);
    expect(alarms(s)).toHaveLength(1);
  });

  it('does not budget alarms out', () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      task({
        id: `t${i}`,
        dueDate: '2026-09-19',
        dueTime: '09:00',
        reminderType: 'alarm',
      }),
    );
    expect(alarms(state({ tasks: many }))).toHaveLength(80);
  });
});

describe('quiet hours', () => {
  it('shifts an all-day task out of the quiet window', () => {
    const s = state({
      tasks: [task({ id: 't1', dueDate: '2026-09-19' })],
      quietHours: { enabled: true, start: '23:00', end: '07:30' },
    });
    // Midnight is inside the window → pushed to 07:30.
    expect(toTimeKey(notifications(s)[0]!.fireAt)).toBe('07:30');
  });

  it('never shifts a time the user typed', () => {
    const s = state({
      tasks: [task({ id: 't1', dueDate: '2026-09-19', dueTime: '02:00' })],
    });
    expect(toTimeKey(notifications(s)[0]!.fireAt)).toBe('02:00');
  });

  it('shifts an expiry reminder but not a user time', () => {
    const s = state({
      items: [item({ id: 'i1', name: 'Yoğurt', expiryDate: '2026-09-21' })],
      quietHours: { enabled: true, start: '08:00', end: '10:30' },
    });
    const expiry = notifications(s).find((n) => n.sourceType === 'expiry');
    expect(expiry).toBeDefined();
    expect(toTimeKey(expiry!.fireAt)).toBe('10:30');
  });
});

describe('list reminder rules', () => {
  const rule = { id: 'r1', rrule: { freq: 'daily' as const }, time: '18:30', enabled: true };

  it('emits nothing when the list is empty', () => {
    const s = state({ listRules: [rule], items: [item({ id: 'i1', onList: false })] });
    expect(notifications(s).filter((n) => n.sourceType === 'listRule')).toHaveLength(0);
  });

  it('emits a reminder when the list has items', () => {
    const s = state({
      listRules: [rule],
      items: [item({ id: 'i1', name: 'Süt', onList: true })],
    });
    const listNotifs = notifications(s).filter((n) => n.sourceType === 'listRule');
    expect(listNotifs.length).toBeGreaterThan(0);
    expect(listNotifs[0]!.body).toContain('Süt');
  });

  it('counts the items in the body', () => {
    const s = state({
      listRules: [rule],
      items: [
        item({ id: 'i1', name: 'Süt', onList: true }),
        item({ id: 'i2', name: 'Ekmek', onList: true }),
        item({ id: 'i3', name: 'Yumurta', onList: true }),
        item({ id: 'i4', name: 'Peynir', onList: true }),
      ],
    });
    const body = notifications(s).find((n) => n.sourceType === 'listRule')!.body;
    expect(body).toContain('4 ürün');
    expect(body).toContain('ve 1 ürün daha');
  });

  it('skips a disabled rule', () => {
    const s = state({
      listRules: [{ ...rule, enabled: false }],
      items: [item({ id: 'i1', name: 'Süt', onList: true })],
    });
    expect(notifications(s).filter((n) => n.sourceType === 'listRule')).toHaveLength(0);
  });
});

describe('expiry reminders', () => {
  it('warns two days and one day before', () => {
    const s = state({
      items: [item({ id: 'i1', name: 'Yoğurt', expiryDate: '2026-09-22' })],
    });
    const keys = notifications(s)
      .filter((n) => n.sourceType === 'expiry')
      .map((n) => n.key);
    expect(keys).toEqual(expect.arrayContaining(['expiry:i1:2', 'expiry:i1:1']));
  });

  it('says "yarın" for the one-day warning', () => {
    const s = state({
      items: [item({ id: 'i1', name: 'Yoğurt', expiryDate: '2026-09-22' })],
    });
    const one = notifications(s).find((n) => n.key === 'expiry:i1:1')!;
    expect(one.body).toContain('yarın');
  });

  it('ignores items with no expiry date', () => {
    const s = state({ items: [item({ id: 'i1' })] });
    expect(notifications(s).filter((n) => n.sourceType === 'expiry')).toHaveLength(0);
  });

  it('can be turned off', () => {
    const s = state({
      expiryRemindersEnabled: false,
      items: [item({ id: 'i1', name: 'Yoğurt', expiryDate: '2026-09-22' })],
    });
    expect(notifications(s).filter((n) => n.sourceType === 'expiry')).toHaveLength(0);
  });
});

describe('daily summary', () => {
  it('is omitted when disabled', () => {
    expect(notifications(state()).filter((n) => n.sourceType === 'summary')).toHaveLength(0);
  });

  it('schedules the next three days', () => {
    const s = state({ summaryEnabled: true, summaryTime: '08:00' });
    const keys = notifications(s)
      .filter((n) => n.sourceType === 'summary')
      .map((n) => n.key);
    // Today's 08:00 has already passed at 10:00, so tomorrow onwards.
    expect(keys).toEqual(['summary:2026-09-19', 'summary:2026-09-20']);
  });

  it('describes tasks and list contents', () => {
    const s = state({
      summaryEnabled: true,
      tasks: [task({ id: 't1', title: 'Diş hekimi', dueDate: '2026-09-19', dueTime: '09:30' })],
      items: [item({ id: 'i1', name: 'Süt', onList: true })],
    });
    const body = buildSummaryBody(s, new Date(2026, 8, 19, 0, 0));
    expect(body).toContain('1 görev');
    expect(body).toContain('09:30 Diş hekimi');
    expect(body).toContain('Listede 1 ürün');
  });

  it('reports an empty day', () => {
    expect(buildSummaryBody(state(), new Date(2026, 8, 19))).toContain('planlı görev yok');
  });

  it('schedules the evening preview when enabled', () => {
    const s = state({ eveningPreviewEnabled: true, eveningPreviewTime: '21:00' });
    const keys = notifications(s)
      .filter((n) => n.sourceType === 'eveningPreview')
      .map((n) => n.key);
    expect(keys).toContain('preview:2026-09-18');
  });
});

describe('signature reminders', () => {
  const expiry = new Date(2026, 8, 25, 14, 32);

  it('emits nothing without a known expiry', () => {
    expect(notifications(state()).filter((n) => n.sourceType === 'signature')).toHaveLength(0);
  });

  it('warns at 48 and 24 hours', () => {
    const s = state({ signatureExpiresAt: expiry });
    const keys = notifications(s)
      .filter((n) => n.sourceType === 'signature')
      .map((n) => n.key);
    expect(keys).toEqual(expect.arrayContaining(['signature:48h', 'signature:24h']));
  });

  it('raises an alarm at 12 hours', () => {
    const s = state({ signatureExpiresAt: expiry });
    expect(alarms(s).map((a) => a.key)).toContain('signature:12h');
  });

  it('omits the alarm when alarms are unavailable', () => {
    const s = state({ signatureExpiresAt: expiry, alarmsAvailable: false });
    expect(alarms(s)).toHaveLength(0);
  });

  it('mentions AltStore in the body', () => {
    const s = state({ signatureExpiresAt: expiry });
    expect(notifications(s).find((n) => n.sourceType === 'signature')!.body).toContain('AltStore');
  });
});

describe('budget', () => {
  const manyTasks = (count: number): TaskLike[] =>
    Array.from({ length: count }, (_, i) =>
      task({
        id: `t${i}`,
        // Spread them across the window so every one lands in the future.
        dueDate: '2026-09-19',
        dueTime: `${String(Math.floor(i / 6) % 24).padStart(2, '0')}:${String((i % 6) * 10).padStart(2, '0')}`,
      }),
    );

  it('never schedules more than the budget', () => {
    const result = build(state({ tasks: manyTasks(100) }), NOW);
    expect(result.notificationCount).toBeLessThanOrEqual(NOTIFICATION_BUDGET);
  });

  it('reports how many were dropped', () => {
    const result = build(state({ tasks: manyTasks(100) }), NOW);
    expect(result.dropped).toBeGreaterThan(0);
    expect(result.notificationCount + result.dropped).toBe(100);
  });

  it('keeps the soonest reminders', () => {
    const result = build(state({ tasks: manyTasks(100) }), NOW);
    const kept = result.desired.filter((d): d is DesiredNotification => d.kind === 'notification');
    const times = kept.map((n) => n.fireAt.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('prefers a task over a summary at the same moment', () => {
    const s = state({
      summaryEnabled: true,
      summaryTime: '09:00',
      tasks: manyTasks(NOTIFICATION_BUDGET + 10),
    });
    const result = build(s, NOW);
    const kept = result.desired.filter((d): d is DesiredNotification => d.kind === 'notification');
    expect(kept.length).toBeLessThanOrEqual(NOTIFICATION_BUDGET);
  });

  it('does nothing at all for empty state', () => {
    const result = build(state(), NOW);
    expect(result.desired).toHaveLength(0);
    expect(result.dropped).toBe(0);
  });
});
