/**
 * Saved places, OSM discovery cache and the hidden-place list.
 */
import { eq } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import { DEFAULT_RADIUS, clampRadius } from '@/domain/regions';
import type { PlaceLike, PlaceType } from '@/domain/types';

import { db } from '../client';
import { osmCache, osmHidden, places, type PlaceRow } from '../schema';

export function rowToPlace(row: PlaceRow): PlaceLike & { lastNotifiedAt: number | null } {
  return {
    id: row.id,
    name: row.name,
    type: row.type as PlaceType,
    lat: row.lat,
    lng: row.lng,
    radiusM: row.radiusM,
    enabled: row.enabled,
    source: row.source as 'user' | 'osm',
    osmId: row.osmId,
    brand: row.brand,
    lastNotifiedAt: row.lastNotifiedAt,
  };
}

export type PlaceFull = ReturnType<typeof rowToPlace>;

export async function listPlaces(): Promise<PlaceFull[]> {
  const rows = await db.select().from(places).orderBy(places.name);
  return rows.map(rowToPlace);
}

export async function getPlace(id: string): Promise<PlaceFull | null> {
  const rows = await db.select().from(places).where(eq(places.id, id)).limit(1);
  const row = rows[0];
  return row ? rowToPlace(row) : null;
}

export async function getPlaceByType(type: PlaceType): Promise<PlaceFull | null> {
  const rows = await db.select().from(places).where(eq(places.type, type)).limit(1);
  const row = rows[0];
  return row ? rowToPlace(row) : null;
}

export type PlaceDraft = {
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  radiusM?: number;
  source?: 'user' | 'osm';
  osmId?: string | null;
  brand?: string | null;
};

export async function createPlace(draft: PlaceDraft): Promise<string> {
  const now = Date.now();
  const id = randomUUID();
  await db.insert(places).values({
    id,
    name: draft.name.trim(),
    type: draft.type,
    lat: draft.lat,
    lng: draft.lng,
    radiusM: clampRadius(draft.radiusM ?? DEFAULT_RADIUS[draft.type]),
    source: draft.source ?? 'user',
    osmId: draft.osmId ?? null,
    brand: draft.brand ?? null,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updatePlace(id: string, draft: Partial<PlaceDraft> & { enabled?: boolean }) {
  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  if (draft.name !== undefined) patch.name = draft.name.trim();
  if (draft.type !== undefined) patch.type = draft.type;
  if (draft.lat !== undefined) patch.lat = draft.lat;
  if (draft.lng !== undefined) patch.lng = draft.lng;
  if (draft.radiusM !== undefined) patch.radiusM = clampRadius(draft.radiusM);
  if (draft.enabled !== undefined) patch.enabled = draft.enabled;
  await db.update(places).set(patch).where(eq(places.id, id));
}

export async function deletePlace(id: string): Promise<void> {
  await db.delete(places).where(eq(places.id, id));
}

/** Stamps the last notification time, used by the per-place 3-hour cooldown. */
export async function markPlaceNotified(id: string, at: number = Date.now()): Promise<void> {
  await db.update(places).set({ lastNotifiedAt: at }).where(eq(places.id, id));
}

// ---------------------------------------------------------------- OSM caching

export async function readOsmCache(cellKey: string): Promise<{
  fetchedAt: number;
  payload: unknown;
} | null> {
  const rows = await db.select().from(osmCache).where(eq(osmCache.cellKey, cellKey)).limit(1);
  const row = rows[0];
  if (!row) return null;
  try {
    return { fetchedAt: row.fetchedAt, payload: JSON.parse(row.payloadJson) };
  } catch {
    return null;
  }
}

export async function writeOsmCache(cellKey: string, payload: unknown): Promise<void> {
  await db
    .insert(osmCache)
    .values({ cellKey, fetchedAt: Date.now(), payloadJson: JSON.stringify(payload) })
    .onConflictDoUpdate({
      target: osmCache.cellKey,
      set: { fetchedAt: Date.now(), payloadJson: JSON.stringify(payload) },
    });
}

export async function allOsmCache(): Promise<{ fetchedAt: number; payload: unknown }[]> {
  const rows = await db.select().from(osmCache);
  return rows.flatMap((row) => {
    try {
      return [{ fetchedAt: row.fetchedAt, payload: JSON.parse(row.payloadJson) }];
    } catch {
      return [];
    }
  });
}

export async function hideOsmPlace(osmId: string): Promise<void> {
  await db.insert(osmHidden).values({ osmId, hiddenAt: Date.now() }).onConflictDoNothing();
}

export async function hiddenOsmIds(): Promise<Set<string>> {
  const rows = await db.select({ osmId: osmHidden.osmId }).from(osmHidden);
  return new Set(rows.map((r) => r.osmId));
}
