/**
 * Geofence event handling (§3.6, §5.5).
 *
 * iOS gives a region event only a few seconds of background runtime, so the
 * whole path below targets well under 5 s: read, decide, notify, and only then
 * do the optional extras. No network call happens here unless the OSM cache is
 * empty, and even then with a 3 s ceiling.
 */
import { listChecklist, logEvent } from '@/db/repos/misc';
import { listItemsForPlaceType } from '@/db/repos/items';
import { getPlace, listPlaces, markPlaceNotified } from '@/db/repos/places';
import { cachedSettings, loadSettings, setSettings } from '@/db/repos/settings';
import { listOccurrenceStates, listTasks } from '@/db/repos/tasks';
import { expandOccurrences } from '@/domain/recurrence';
import { isQuiet } from '@/domain/quietHours';
import { addDays, startOfDay, summarizeNames } from '@/domain/format';
import type { PlaceType } from '@/domain/types';
import { ROTATION_ID } from '@/domain/regions';

import * as notifications from './notifications';

/** Per-place cooldown: at most one reminder every three hours. */
const PLACE_COOLDOWN_MS = 3 * 60 * 60 * 1000;
/** Same brand, different branch: at most one reminder an hour. */
const BRAND_COOLDOWN_MS = 60 * 60 * 1000;

export type GeofenceEvent = {
  identifier: string;
  kind: 'enter' | 'exit';
  at?: Date;
};

/** Brand cooldown is in-memory: it only needs to survive one shopping trip. */
const brandLastNotified = new Map<string, number>();

function placeTypeLabel(type: PlaceType): string {
  switch (type) {
    case 'market':
      return 'markete';
    case 'pharmacy':
      return 'eczaneye';
    case 'bakery':
      return 'fırına';
    case 'hardware':
      return 'hırdavatçıya';
    default:
      return 'buraya';
  }
}

/**
 * Handles one geofence transition.
 *
 * @returns a short description of what was done, for the event log and for the
 * Diagnostics "fake event" button.
 */
export async function handleGeofenceEvent(event: GeofenceEvent): Promise<string> {
  const now = event.at ?? new Date();

  if (event.identifier === ROTATION_ID) {
    // Leaving the rotation region means the candidate set is stale. The actual
    // re-selection is deferred to the caller, which owns the location import.
    await logEvent('location', 'Rotasyon bölgesinden çıkıldı');
    return 'rotation';
  }

  const place = await getPlace(event.identifier);
  if (!place) {
    await logEvent('location', 'Bilinmeyen bölge olayı', { id: event.identifier });
    return 'unknown';
  }

  const settings = await loadSettings();

  if (place.type === 'home') {
    return event.kind === 'exit' ? handleHomeExit(now) : handleHomeArrive(now);
  }

  // Every other location notification respects quiet hours and the cooldowns.
  if (isQuiet(now, settings.quietHours)) {
    await logEvent('location', 'Sessiz saatte konum bildirimi atlandı', { place: place.name });
    return 'quiet';
  }

  if (event.kind !== 'enter') return 'ignored';

  if (place.lastNotifiedAt && now.getTime() - place.lastNotifiedAt < PLACE_COOLDOWN_MS) {
    return 'place-cooldown';
  }

  const globalCooldownMs = (settings.locationCooldownMinutes ?? 20) * 60_000;
  if (
    settings.lastLocationNotifyAt &&
    now.getTime() - settings.lastLocationNotifyAt < globalCooldownMs
  ) {
    return 'global-cooldown';
  }

  const brandKey = place.brand?.toLocaleLowerCase('tr-TR');
  if (brandKey) {
    const last = brandLastNotified.get(brandKey);
    if (last && now.getTime() - last < BRAND_COOLDOWN_MS) return 'brand-cooldown';
  }

  const items = await listItemsForPlaceType(place.type);
  const taskNote = await locationTriggeredTasks(place.id, 'enter', now);

  if (items.length === 0 && taskNote.length === 0) return 'nothing-to-say';

  const parts: string[] = [];
  if (items.length > 0) {
    parts.push(`listende ${items.length} ürün var: ${summarizeNames(items.map((i) => i.name))}`);
  }
  if (taskNote.length > 0) parts.push(taskNote.join(', '));

  await notifications.presentNow(
    `📍 ${place.name} yakınında`,
    `${place.name} ${placeTypeLabel(place.type)} yakınsın — ${parts.join(' · ')}`,
    items.length > 0 ? 'list' : 'task',
    { kind: items.length > 0 ? 'list' : 'task' },
  );

  await markPlaceNotified(place.id, now.getTime());
  await setSettings({ lastLocationNotifyAt: now.getTime() });
  if (brandKey) brandLastNotified.set(brandKey, now.getTime());

  await logEvent('location', `Konum bildirimi: ${place.name}`, {
    items: items.length,
    tasks: taskNote.length,
  });

  return 'notified';
}

/**
 * Leaving home: the checklist plus today's "on the way out" tasks, in one
 * notification. This one ignores the global cooldown — it happens once a day
 * and missing it defeats the point.
 */
async function handleHomeExit(now: Date): Promise<string> {
  const [checklist, tasks, states] = await Promise.all([
    listChecklist(),
    listTasks(),
    listOccurrenceStates(),
  ]);

  const entries = checklist.filter((c) => c.enabled).map((c) => c.text);

  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);
  const todaysTasks = tasks
    .filter((t) => t.onHomeExit)
    .filter((t) => expandOccurrences(t, dayStart, dayEnd, states).length > 0)
    .map((t) => t.title);

  if (entries.length === 0 && todaysTasks.length === 0) return 'nothing-to-say';

  const parts: string[] = [];
  if (entries.length > 0) parts.push(entries.join(' · '));
  if (todaysTasks.length > 0) parts.push(todaysTasks.join(' · '));

  await notifications.presentNow('🚪 Evden çıkarken', parts.join(' | '), 'task', {
    kind: 'task',
  });
  await logEvent('location', 'Evden çıkış bildirimi gönderildi', {
    checklist: entries.length,
    tasks: todaysTasks.length,
  });
  return 'notified';
}

/** Arriving home: the tasks flagged "when I get home". */
async function handleHomeArrive(now: Date): Promise<string> {
  const settings = cachedSettings();
  if (isQuiet(now, settings.quietHours)) return 'quiet';

  const [tasks, states] = await Promise.all([listTasks(), listOccurrenceStates()]);
  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);

  const titles = tasks
    .filter((t) => t.onHomeArrive)
    .filter((t) => expandOccurrences(t, dayStart, dayEnd, states).length > 0)
    .map((t) => t.title);

  if (titles.length === 0) return 'nothing-to-say';

  await notifications.presentNow('🏠 Eve geldin', titles.join(' · '), 'task', { kind: 'task' });
  await logEvent('location', 'Eve geliş bildirimi gönderildi', { tasks: titles.length });
  return 'notified';
}

/** Titles of tasks whose location trigger matches this place and direction. */
async function locationTriggeredTasks(
  placeId: string,
  direction: 'enter' | 'exit',
  now: Date,
): Promise<string[]> {
  const [tasks, states] = await Promise.all([listTasks(), listOccurrenceStates()]);
  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);

  return tasks
    .filter((t) => t.locationTrigger?.placeId === placeId && t.locationTrigger.on === direction)
    .filter((t) => !t.dueDate || expandOccurrences(t, dayStart, dayEnd, states).length > 0)
    .map((t) => t.title);
}

/** Used by the Diagnostics screen to test the logic without walking anywhere. */
export async function simulateEvent(placeId: string, kind: 'enter' | 'exit'): Promise<string> {
  const result = await handleGeofenceEvent({ identifier: placeId, kind });
  await logEvent('location', `Sahte olay: ${kind} → ${result}`, { placeId });
  return result;
}

/** Place list for the Diagnostics picker, with live distances. */
export async function monitoredPlaces() {
  return listPlaces();
}
