/**
 * ReminderSync (§5.3) — the most important service in the app.
 *
 * It is declarative and idempotent: the planner says what *should* exist, the
 * system says what *does* exist, and this module reconciles the difference.
 * The system is always the source of truth; `scheduled_refs` is a cache that
 * loses every disagreement.
 *
 * Running it twice in a row must schedule nothing the second time.
 */
import { listCategories, listItems } from '@/db/repos/items';
import {
  clearScheduledRefs,
  deleteScheduledRefs,
  listReminderRulesAll,
  listScheduledRefs,
  logEvent,
  putScheduledRef,
} from '@/db/repos/misc';
import { loadSettings, setSettings } from '@/db/repos/settings';
import { listOccurrenceStates, listTasks } from '@/db/repos/tasks';
import { build, type Desired, type DesiredAlarm, type PlannerState } from '@/domain/planner';

import * as alarms from './alarms';
import * as notifications from './notifications';

export type SyncSummary = {
  scheduled: number;
  cancelled: number;
  unchanged: number;
  budgetUsed: number;
  budgetTotal: number;
  dropped: number;
  at: number;
};

/** Serialises runs: two concurrent syncs would fight over the same ids. */
let inFlight: Promise<SyncSummary> | null = null;
let pendingRerun = false;

/** Collects the planner inputs from the database. */
export async function collectState(): Promise<PlannerState> {
  const [tasks, occurrenceStates, items, categories, listRules, settings] = await Promise.all([
    listTasks(),
    listOccurrenceStates(),
    listItems(),
    listCategories(),
    listReminderRulesAll(),
    loadSettings(),
  ]);

  return {
    tasks,
    occurrenceStates,
    items,
    categories,
    listRules,
    quietHours: settings.quietHours,
    summaryEnabled: settings.summaryEnabled,
    summaryTime: settings.summaryTime,
    eveningPreviewEnabled: settings.eveningPreviewEnabled,
    eveningPreviewTime: settings.eveningPreviewTime,
    expiryRemindersEnabled: settings.expiryRemindersEnabled,
    signatureExpiresAt:
      settings.signatureExpiresAt === null ? null : new Date(settings.signatureExpiresAt),
    alarmsAvailable: alarms.canSchedule(),
  };
}

function isWeekly(d: DesiredAlarm): d is DesiredAlarm & { schedule: 'weekly' } {
  return d.schedule === 'weekly';
}

async function runSync(now: Date): Promise<SyncSummary> {
  const state = await collectState();
  const plan = build(state, now);

  const desiredByKey = new Map<string, Desired>();
  for (const d of plan.desired) desiredByKey.set(d.key, d);

  // Step 2: what the system actually holds. It wins every disagreement.
  const [pending, alarmIds, refs] = await Promise.all([
    notifications.listPending(),
    alarms.listIds(),
    listScheduledRefs(),
  ]);

  const pendingIds = new Set(pending.map((p) => p.identifier));
  const liveAlarmIds = new Set(alarmIds.map((id) => id.toLowerCase()));
  const refByKey = new Map(refs.map((r) => [r.key, r]));

  let scheduled = 0;
  let cancelled = 0;
  let unchanged = 0;

  // ---------------------------------------------------- cancel what is stale
  const staleKeys: string[] = [];

  for (const ref of refs) {
    const desired = desiredByKey.get(ref.key);
    const stillWanted = desired !== undefined && desired.contentHash === ref.contentHash;
    if (stillWanted) continue;

    if (ref.kind === 'notification') {
      if (pendingIds.has(ref.externalId)) {
        await notifications.cancel(ref.externalId);
        cancelled++;
      }
    } else if (liveAlarmIds.has(ref.externalId.toLowerCase())) {
      await alarms.cancel(ref.externalId);
      cancelled++;
    }
    staleKeys.push(ref.key);
  }
  await deleteScheduledRefs(staleKeys);

  // Notifications iOS holds that we no longer want and do not recognise.
  for (const p of pending) {
    if (desiredByKey.has(p.identifier)) continue;
    if (refByKey.has(p.identifier) && staleKeys.includes(p.identifier)) continue;
    // Anything carrying one of our key shapes but absent from the plan is ours
    // to clean up; foreign identifiers are left alone.
    if (/^(task|list|expiry|summary|preview|signature):/.test(p.identifier)) {
      await notifications.cancel(p.identifier);
      cancelled++;
    }
  }

  // ------------------------------------------------- schedule what is missing
  for (const desired of plan.desired) {
    const ref = refByKey.get(desired.key);
    const alreadyLive =
      ref !== undefined &&
      ref.contentHash === desired.contentHash &&
      (desired.kind === 'notification'
        ? pendingIds.has(ref.externalId)
        : liveAlarmIds.has(ref.externalId.toLowerCase()));

    if (alreadyLive) {
      unchanged++;
      continue;
    }

    if (desired.kind === 'notification') {
      await notifications.schedule({
        key: desired.key,
        fireAt: desired.fireAt,
        title: desired.title,
        body: desired.body,
        categoryId: desired.categoryId,
        data: {
          kind: desired.categoryId,
          sourceId: desired.sourceId,
          occurrenceKey: desired.occurrenceKey,
        },
      });
      await putScheduledRef({
        key: desired.key,
        kind: 'notification',
        externalId: desired.key,
        sourceType: desired.sourceType,
        sourceId: desired.sourceId ?? null,
        fireAt: desired.fireAt.getTime(),
        contentHash: desired.contentHash,
      });
      scheduled++;
      continue;
    }

    const alarmId = alarms.alarmIdFor(desired.key);
    const ok = isWeekly(desired)
      ? await alarms.scheduleWeekly(
          {
            id: alarmId,
            hour: desired.hour,
            minute: desired.minute,
            weekdays: desired.weekdays,
            title: desired.title,
          },
          desired.key,
        )
      : await alarms.scheduleFixed(
          { id: alarmId, epochMs: desired.fireAt.getTime(), title: desired.title },
          desired.key,
        );

    await putScheduledRef({
      key: desired.key,
      // A failed alarm became a notification; record what actually exists.
      kind: ok ? 'alarm' : 'notification',
      externalId: ok ? alarmId : desired.key,
      sourceType: desired.sourceType,
      sourceId: desired.sourceId ?? null,
      fireAt: isWeekly(desired) ? null : desired.fireAt.getTime(),
      contentHash: desired.contentHash,
    });
    scheduled++;
  }

  const summary: SyncSummary = {
    scheduled,
    cancelled,
    unchanged,
    budgetUsed: plan.notificationCount,
    budgetTotal: 60,
    dropped: plan.dropped,
    at: now.getTime(),
  };

  const text = `+${scheduled} kuruldu, −${cancelled} iptal, ${summary.budgetUsed}/${summary.budgetTotal} bütçe`;
  await setSettings({ lastSyncAt: summary.at, lastSyncSummary: text });
  await logEvent('sync', text, summary);

  return summary;
}

/**
 * Runs the sync, coalescing concurrent callers.
 *
 * A call made while another sync is running does not queue a second full run;
 * it marks a rerun so the final state still reflects the newest data.
 */
export async function sync(now: Date = new Date()): Promise<SyncSummary> {
  if (inFlight) {
    pendingRerun = true;
    return inFlight;
  }

  inFlight = runSync(now)
    .catch(async (error) => {
      await logEvent('error', 'Senkron başarısız', { error: String(error) });
      return {
        scheduled: 0,
        cancelled: 0,
        unchanged: 0,
        budgetUsed: 0,
        budgetTotal: 60,
        dropped: 0,
        at: Date.now(),
      } satisfies SyncSummary;
    })
    .finally(() => {
      inFlight = null;
    });

  const result = await inFlight;

  if (pendingRerun) {
    pendingRerun = false;
    return sync(new Date());
  }
  return result;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced trigger used after data changes (§5.3 step 4). */
export function scheduleSync(delayMs = 1000): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void sync();
  }, delayMs);
}

/**
 * Tears down every scheduled reminder and rebuilds from scratch.
 * Exposed in Settings › Gelişmiş as "Tüm hatırlatmaları yeniden kur".
 */
export async function rebuildAll(): Promise<SyncSummary> {
  await notifications.cancelAll();
  await alarms.cancelAll();
  await clearScheduledRefs();
  await logEvent('sync', 'Tüm hatırlatmalar sıfırlandı');
  return sync();
}
