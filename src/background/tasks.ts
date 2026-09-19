/**
 * Background task definitions.
 *
 * These MUST be defined at module scope and imported from the app's entry
 * point *before* the router (see `index.ts`), because iOS can launch the app
 * straight into one of these handlers with no UI at all.
 */
import * as BackgroundTask from 'expo-background-task';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { logEvent } from '@/db/repos/misc';
import { GEOFENCE_TASK, refreshRegions } from '@/services/location';
import { handleGeofenceEvent } from '@/services/geofenceHandler';
import { sync } from '@/services/sync';

export const BACKGROUND_SYNC_TASK = 'animsa-background-sync';

/** iOS ignores anything shorter, and treats this only as a lower bound. */
const MINIMUM_INTERVAL_MINUTES = 60;

type GeofenceBody = {
  eventType: Location.LocationGeofencingEventType;
  region: Location.LocationRegion;
};

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    await logEvent('error', 'Bölge olayı hatası', { error: error.message });
    return;
  }
  const body = data as GeofenceBody | undefined;
  if (!body?.region?.identifier) return;

  const kind = body.eventType === Location.LocationGeofencingEventType.Enter ? 'enter' : 'exit';

  try {
    const result = await handleGeofenceEvent({
      identifier: body.region.identifier,
      kind,
    });

    // Leaving the rotation region invalidates the whole selection.
    if (result === 'rotation') {
      await refreshRegions();
    }

    // Keep the schedule honest after any location-driven change.
    await sync();
  } catch (e) {
    await logEvent('error', 'Bölge olayı işlenemedi', { error: String(e) });
  }
});

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    await sync();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    await logEvent('error', 'Arka plan senkronu başarısız', { error: String(error) });
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Registers the periodic background task. Safe to call repeatedly. */
export async function registerBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
      await logEvent('info', 'Arka plan görevleri kullanılamıyor');
      return;
    }
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (!registered) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: MINIMUM_INTERVAL_MINUTES,
      });
      await logEvent('info', 'Arka plan senkronu kaydedildi');
    }
  } catch (error) {
    await logEvent('error', 'Arka plan görevi kaydedilemedi', { error: String(error) });
  }
}
