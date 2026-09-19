/**
 * Typed access to the key/value settings table, with an in-memory cache so the
 * background handlers can read settings synchronously-ish without a round trip
 * per key.
 */
import { eq } from 'drizzle-orm';

import { DEFAULT_SETTINGS, type SettingsShape } from '@/services/settingsKeys';

import { db } from '../client';
import { settings } from '../schema';

let cache: Partial<SettingsShape> | null = null;

function parse<K extends keyof SettingsShape>(key: K, raw: string): SettingsShape[K] {
  try {
    return JSON.parse(raw) as SettingsShape[K];
  } catch {
    return DEFAULT_SETTINGS[key];
  }
}

/** Loads every setting, falling back to the defaults for missing keys. */
export async function loadSettings(): Promise<SettingsShape> {
  const rows = await db.select().from(settings);
  const out = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const key = row.key as keyof SettingsShape;
    if (key in DEFAULT_SETTINGS) {
      (out as Record<string, unknown>)[key] = parse(key, row.valueJson);
    }
  }
  cache = out;
  return out;
}

/** The last loaded settings, or the defaults when nothing has been read yet. */
export function cachedSettings(): SettingsShape {
  return { ...DEFAULT_SETTINGS, ...(cache ?? {}) };
}

export async function getSetting<K extends keyof SettingsShape>(key: K): Promise<SettingsShape[K]> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  const row = rows[0];
  if (!row) return DEFAULT_SETTINGS[key];
  return parse(key, row.valueJson);
}

export async function setSetting<K extends keyof SettingsShape>(
  key: K,
  value: SettingsShape[K],
): Promise<void> {
  const now = Date.now();
  await db
    .insert(settings)
    .values({ key, valueJson: JSON.stringify(value), updatedAt: now })
    .onConflictDoUpdate({
      target: settings.key,
      set: { valueJson: JSON.stringify(value), updatedAt: now },
    });
  if (cache) cache[key] = value;
}

export async function setSettings(patch: Partial<SettingsShape>): Promise<void> {
  for (const [key, value] of Object.entries(patch)) {
    await setSetting(key as keyof SettingsShape, value as never);
  }
}
