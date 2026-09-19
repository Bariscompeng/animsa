/**
 * OpenStreetMap place discovery via the Overpass API (§5.6).
 *
 * No API key, no account, and a hard daily request ceiling so a personal app
 * never becomes a burden on a free community endpoint.
 */
import { logEvent } from '@/db/repos/misc';
import { readOsmCache, writeOsmCache } from '@/db/repos/places';
import type { PlaceType } from '@/domain/types';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const USER_AGENT = 'Animsa/1.0';
const SEARCH_RADIUS_M = 2500;
/** Cache lifetime per grid cell. */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Requests per calendar day, across all cells. */
const DAILY_REQUEST_CAP = 30;

export type OsmPlace = {
  osmId: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  brand: string | null;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * Roughly 1.2 km grid cell key. Coarse enough that walking around a
 * neighbourhood reuses one cached response.
 */
export function cellKeyFor(lat: number, lng: number): string {
  const latCell = Math.round(lat * 90); // ~1.24 km
  const lngCell = Math.round(lng * 90 * Math.cos((lat * Math.PI) / 180));
  return `${latCell}:${lngCell}`;
}

function buildQuery(lat: number, lng: number): string {
  const around = `around:${SEARCH_RADIUS_M},${lat.toFixed(5)},${lng.toFixed(5)}`;
  return [
    '[out:json][timeout:10];',
    '(',
    `  nwr(${around})["shop"~"^(supermarket|convenience|greengrocer)$"];`,
    `  nwr(${around})["amenity"="pharmacy"];`,
    `  nwr(${around})["shop"="bakery"];`,
    `  nwr(${around})["shop"~"^(hardware|doityourself)$"];`,
    ');',
    'out center 250;',
  ].join('\n');
}

function classify(tags: Record<string, string>): PlaceType | null {
  const shop = tags.shop;
  if (shop === 'supermarket' || shop === 'convenience' || shop === 'greengrocer') return 'market';
  if (tags.amenity === 'pharmacy') return 'pharmacy';
  if (shop === 'bakery') return 'bakery';
  if (shop === 'hardware' || shop === 'doityourself') return 'hardware';
  return null;
}

const TYPE_LABEL: Record<PlaceType, string> = {
  home: 'Ev',
  work: 'İş',
  market: 'Market',
  pharmacy: 'Eczane',
  bakery: 'Fırın',
  hardware: 'Hırdavat',
  other: 'Yer',
};

function toPlaces(payload: unknown): OsmPlace[] {
  const elements = (payload as { elements?: OverpassElement[] })?.elements ?? [];
  const out: OsmPlace[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const type = classify(tags);
    if (!type) continue;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat === undefined || lng === undefined) continue;
    const brand = tags.brand ?? null;
    out.push({
      osmId: `${el.type}/${el.id}`,
      name: tags.name ?? brand ?? TYPE_LABEL[type],
      type,
      lat,
      lng,
      brand,
    });
  }
  return out;
}

/** Simple per-day request counter, reset when the calendar day changes. */
const requestBudget = { day: '', count: 0 };

function budgetAvailable(): boolean {
  const today = new Date().toDateString();
  if (requestBudget.day !== today) {
    requestBudget.day = today;
    requestBudget.count = 0;
  }
  return requestBudget.count < DAILY_REQUEST_CAP;
}

async function fetchOverpass(lat: number, lng: number, timeoutMs: number): Promise<unknown | null> {
  const body = new URLSearchParams({ data: buildQuery(lat, lng) }).toString();

  for (let attempt = 0; attempt < ENDPOINTS.length; attempt++) {
    const endpoint = ENDPOINTS[attempt]!;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      requestBudget.count++;

      if (response.status === 429 || response.status === 504) {
        // Back off exponentially before trying the next endpoint.
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
        continue;
      }
      if (!response.ok) continue;
      return (await response.json()) as unknown;
    } catch {
      clearTimeout(timer);
      // Try the fallback endpoint.
    }
  }
  return null;
}

export type DiscoverOptions = {
  /** Never hit the network; return only what the cache already holds. */
  cacheOnly?: boolean;
  timeoutMs?: number;
};

/**
 * Finds shops near a point, preferring the cache.
 *
 * Background callers pass `cacheOnly` (or a short timeout) because iOS gives a
 * geofence handler only a few seconds.
 */
export async function discoverNearby(
  lat: number,
  lng: number,
  options: DiscoverOptions = {},
): Promise<OsmPlace[]> {
  const key = cellKeyFor(lat, lng);
  const cached = await readOsmCache(key);
  const fresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;

  if (fresh) return toPlaces(cached.payload);
  if (options.cacheOnly) return cached ? toPlaces(cached.payload) : [];

  if (!budgetAvailable()) {
    await logEvent('location', 'OSM günlük istek sınırına ulaşıldı');
    return cached ? toPlaces(cached.payload) : [];
  }

  const payload = await fetchOverpass(lat, lng, options.timeoutMs ?? 12_000);
  if (!payload) {
    await logEvent('location', 'OSM sorgusu başarısız, önbellek kullanılıyor', { key });
    return cached ? toPlaces(cached.payload) : [];
  }

  await writeOsmCache(key, payload);
  const places = toPlaces(payload);
  await logEvent('location', `OSM: ${places.length} yer bulundu`, { key });
  return places;
}
