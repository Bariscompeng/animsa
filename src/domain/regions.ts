/**
 * Geofence region selection (§5.5).
 *
 * iOS lets an app monitor at most 20 regions. We keep 19 slots for real places
 * and reserve one for a large "rotation" region centred on the user: leaving it
 * means the candidate set is stale and must be recomputed.
 */
import type { PlaceType } from './types';

export const MAX_REGIONS = 20;
export const ROTATION_ID = 'rotation';
export const ROTATION_MIN_RADIUS_M = 800;
export const ROTATION_MAX_RADIUS_M = 3000;
/** iOS geofences below this radius are unreliable. */
export const MIN_PLACE_RADIUS_M = 100;
export const MAX_PLACE_RADIUS_M = 1000;

export const DEFAULT_RADIUS: Record<PlaceType, number> = {
  home: 200,
  work: 200,
  market: 150,
  pharmacy: 120,
  bakery: 120,
  hardware: 150,
  other: 150,
};

export type RegionCandidate = {
  id: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  radiusM: number;
  /** True when a task with a location trigger points at this place. */
  hasTaskTrigger?: boolean;
  enabled?: boolean;
};

export type SelectionContext = {
  /** Place types that currently have matching items on the shopping list. */
  activePlaceTypes: Set<PlaceType>;
};

export type SelectedRegion = {
  id: string;
  lat: number;
  lng: number;
  radiusM: number;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
};

export type Coords = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres. */
export function distanceMeters(a: Coords, b: Coords): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function clampRadius(radius: number): number {
  return Math.min(MAX_PLACE_RADIUS_M, Math.max(MIN_PLACE_RADIUS_M, Math.round(radius)));
}

/**
 * Priority tier, lower is more important:
 *   0 — home and work (always monitored)
 *   1 — places referenced by an active task location trigger
 *   2 — place types with matching items on the list
 *   3 — everything else
 */
function tier(c: RegionCandidate, ctx: SelectionContext): number {
  if (c.type === 'home' || c.type === 'work') return 0;
  if (c.hasTaskTrigger) return 1;
  if (ctx.activePlaceTypes.has(c.type)) return 2;
  return 3;
}

/**
 * Chooses which regions to monitor.
 *
 * Shopping places are only monitored when the list actually has matching items,
 * so an empty list means no market geofences at all.
 */
export function selectRegions(
  candidates: RegionCandidate[],
  here: Coords | null,
  ctx: SelectionContext,
): SelectedRegion[] {
  const usable = candidates.filter((c) => c.enabled !== false);

  const ranked = usable
    .map((c) => ({
      candidate: c,
      tier: tier(c, ctx),
      distance: here ? distanceMeters(here, { lat: c.lat, lng: c.lng }) : 0,
    }))
    // Tier 3 shop-like places have nothing to remind about — drop them.
    .filter((r) => r.tier < 3)
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.distance - b.distance;
    });

  const slots = here ? MAX_REGIONS - 1 : MAX_REGIONS;
  const chosen = ranked.slice(0, slots);

  const regions: SelectedRegion[] = chosen.map((r) => ({
    id: r.candidate.id,
    lat: r.candidate.lat,
    lng: r.candidate.lng,
    radiusM: clampRadius(r.candidate.radiusM),
    // Home needs both directions ("evden çıkarken" / "eve gelince").
    notifyOnEnter: true,
    notifyOnExit:
      r.candidate.type === 'home' || r.candidate.type === 'work'
        ? true
        : Boolean(r.candidate.hasTaskTrigger),
  }));

  if (here) {
    regions.push(
      buildRotationRegion(
        here,
        chosen.map((r) => r.distance),
      ),
    );
  }

  return regions;
}

/**
 * The rotation region: centred on the user, with a radius of half the distance
 * to the furthest selected place, clamped to [800 m, 3000 m]. Exiting it is the
 * signal to re-select.
 */
export function buildRotationRegion(here: Coords, distances: number[]): SelectedRegion {
  const furthest = distances.length > 0 ? Math.max(...distances) : 0;
  const raw = furthest / 2;
  const radiusM = Math.round(Math.min(ROTATION_MAX_RADIUS_M, Math.max(ROTATION_MIN_RADIUS_M, raw)));
  return {
    id: ROTATION_ID,
    lat: here.lat,
    lng: here.lng,
    radiusM,
    notifyOnEnter: false,
    notifyOnExit: true,
  };
}
