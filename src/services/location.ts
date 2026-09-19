/**
 * Location and geofencing adapter (§3.6, §5.5).
 *
 * Region monitoring only starts with "Always" permission; with anything less
 * the Places screen explains why and the feature stays off rather than half on.
 */
import * as Location from 'expo-location';

import { activePlaceTypes } from '@/db/repos/items';
import { logEvent } from '@/db/repos/misc';
import { hiddenOsmIds, listPlaces, readOsmCache } from '@/db/repos/places';
import { getSetting, setSettings } from '@/db/repos/settings';
import { listTasks } from '@/db/repos/tasks';
import {
  ROTATION_ID,
  selectRegions,
  type Coords,
  type RegionCandidate,
  type SelectedRegion,
} from '@/domain/regions';

import { cellKeyFor, type OsmPlace } from './osm';

export const GEOFENCE_TASK = 'animsa-geofence';

export type PermissionSnapshot = {
  foreground: Location.PermissionStatus;
  background: Location.PermissionStatus;
  /** True when background region monitoring can actually run. */
  canMonitor: boolean;
};

export async function getPermissions(): Promise<PermissionSnapshot> {
  const [fg, bg] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  return {
    foreground: fg.status,
    background: bg.status,
    canMonitor: bg.status === Location.PermissionStatus.GRANTED,
  };
}

export async function requestForeground(): Promise<boolean> {
  const result = await Location.requestForegroundPermissionsAsync();
  return result.status === Location.PermissionStatus.GRANTED;
}

/** Must be called after foreground permission has been granted. */
export async function requestBackground(): Promise<boolean> {
  const result = await Location.requestBackgroundPermissionsAsync();
  return result.status === Location.PermissionStatus.GRANTED;
}

/**
 * Current position, cheap first.
 *
 * Uses the last known fix when it is recent, and only asks for a fresh one
 * otherwise — background handlers cannot afford a GPS warm-up.
 */
export async function getCoords(maxAgeMs = 5 * 60_000): Promise<Coords | null> {
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: maxAgeMs });
    if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
  } catch {
    // Fall through to a fresh read.
  }
  try {
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    if (fresh) return { lat: fresh.coords.latitude, lng: fresh.coords.longitude };
  } catch {
    // No fix available.
  }
  return null;
}

/** Remembers the last position so a cold background start has a centre point. */
export async function rememberCoords(coords: Coords): Promise<void> {
  await setSettings({ lastKnownLat: coords.lat, lastKnownLng: coords.lng });
}

export async function lastRememberedCoords(): Promise<Coords | null> {
  const [lat, lng] = await Promise.all([getSetting('lastKnownLat'), getSetting('lastKnownLng')]);
  if (lat === null || lng === null) return null;
  return { lat, lng };
}

/**
 * Builds the candidate set: saved places, OSM discoveries (when enabled) and
 * anywhere a task's location trigger points at.
 */
export async function buildCandidates(here: Coords | null): Promise<RegionCandidate[]> {
  const [saved, tasks, autoDiscover] = await Promise.all([
    listPlaces(),
    listTasks(),
    getSetting('autoDiscoverPlaces'),
  ]);

  const triggeredPlaceIds = new Set(
    tasks.filter((t) => !t.archivedAt && t.locationTrigger).map((t) => t.locationTrigger!.placeId),
  );

  const candidates: RegionCandidate[] = saved.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    lat: p.lat,
    lng: p.lng,
    radiusM: p.radiusM,
    enabled: p.enabled,
    hasTaskTrigger: triggeredPlaceIds.has(p.id),
  }));

  if (autoDiscover && here) {
    const cached = await readOsmCache(cellKeyFor(here.lat, here.lng));
    if (cached) {
      const hidden = await hiddenOsmIds();
      const savedOsmIds = new Set(saved.map((p) => p.osmId).filter(Boolean) as string[]);
      const elements = ((cached.payload as { elements?: unknown[] })?.elements ?? []) as never[];
      // Reuse the OSM parser's shape without importing the network path.
      const discovered = parseCachedPlaces(elements);
      for (const place of discovered) {
        if (hidden.has(place.osmId) || savedOsmIds.has(place.osmId)) continue;
        candidates.push({
          id: `osm:${place.osmId}`,
          name: place.name,
          type: place.type,
          lat: place.lat,
          lng: place.lng,
          radiusM: place.type === 'pharmacy' || place.type === 'bakery' ? 120 : 150,
          enabled: true,
        });
      }
    }
  }

  return candidates;
}

/** Minimal element parser shared with the cached OSM payload. */
function parseCachedPlaces(elements: unknown[]): OsmPlace[] {
  const out: OsmPlace[] = [];
  for (const raw of elements) {
    const el = raw as {
      type?: string;
      id?: number;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    };
    const tags = el.tags ?? {};
    const shop = tags.shop;
    let type: OsmPlace['type'] | null = null;
    if (shop === 'supermarket' || shop === 'convenience' || shop === 'greengrocer') type = 'market';
    else if (tags.amenity === 'pharmacy') type = 'pharmacy';
    else if (shop === 'bakery') type = 'bakery';
    else if (shop === 'hardware' || shop === 'doityourself') type = 'hardware';
    if (!type || el.id === undefined) continue;

    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat === undefined || lng === undefined) continue;

    out.push({
      osmId: `${el.type ?? 'node'}/${el.id}`,
      name: tags.name ?? tags.brand ?? 'Yer',
      type,
      lat,
      lng,
      brand: tags.brand ?? null,
    });
  }
  return out;
}

/**
 * Recomputes which regions to monitor and hands them to iOS.
 *
 * Called when the app foregrounds, when the list or places change, and when
 * the rotation region is exited.
 */
export async function refreshRegions(here?: Coords | null): Promise<SelectedRegion[]> {
  const permissions = await getPermissions();
  if (!permissions.canMonitor) {
    await stopMonitoring();
    return [];
  }

  const coords = here ?? (await getCoords()) ?? (await lastRememberedCoords());
  if (coords) await rememberCoords(coords);

  const [candidates, placeTypes] = await Promise.all([buildCandidates(coords), activePlaceTypes()]);

  const regions = selectRegions(candidates, coords, { activePlaceTypes: placeTypes });

  try {
    if (regions.length === 0) {
      await stopMonitoring();
    } else {
      await Location.startGeofencingAsync(
        GEOFENCE_TASK,
        regions.map((r) => ({
          identifier: r.id,
          latitude: r.lat,
          longitude: r.lng,
          radius: r.radiusM,
          notifyOnEnter: r.notifyOnEnter,
          notifyOnExit: r.notifyOnExit,
        })),
      );
    }
    await logEvent('location', `${regions.length} bölge izleniyor`, {
      ids: regions.map((r) => r.id),
    });
  } catch (error) {
    await logEvent('error', 'Bölge izleme başlatılamadı', { error: String(error) });
  }

  return regions;
}

export async function stopMonitoring(): Promise<void> {
  try {
    if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    }
  } catch {
    // Nothing was running.
  }
}

export async function isMonitoring(): Promise<boolean> {
  try {
    return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  } catch {
    return false;
  }
}

/** Address → coordinates, for the "search an address" path. */
export async function geocode(query: string): Promise<Coords | null> {
  try {
    const results = await Location.geocodeAsync(query);
    const first = results[0];
    if (!first) return null;
    return { lat: first.latitude, lng: first.longitude };
  } catch {
    return null;
  }
}

export { ROTATION_ID };
