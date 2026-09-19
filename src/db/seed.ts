/**
 * First-run seed: default categories, the "leaving home" checklist and the
 * default settings. Idempotent — running it again inserts nothing new.
 */
import { sql } from 'drizzle-orm';

import { DEFAULT_CATEGORIES, DEFAULT_HOME_EXIT_CHECKLIST } from '@/data/defaultCategories';
import { DEFAULT_SETTINGS, SETTING_KEYS } from '@/services/settingsKeys';

import { db } from './client';
import { categories, homeExitChecklist, settings } from './schema';

export async function seedIfNeeded(): Promise<void> {
  const now = Date.now();

  const existingCategories = await db.select({ id: categories.id }).from(categories).limit(1);
  if (existingCategories.length === 0) {
    await db.insert(categories).values(
      DEFAULT_CATEGORIES.map((c, index) => ({
        id: c.id,
        name: c.name,
        sortOrder: index,
        placeTypesJson: JSON.stringify(c.placeTypes),
        sfSymbol: c.sfSymbol,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  const existingChecklist = await db
    .select({ id: homeExitChecklist.id })
    .from(homeExitChecklist)
    .limit(1);
  if (existingChecklist.length === 0) {
    await db.insert(homeExitChecklist).values(
      DEFAULT_HOME_EXIT_CHECKLIST.map((text, index) => ({
        id: `checklist-${index}`,
        text,
        sortOrder: index,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  // Settings are upserted individually so a new release can add a key without
  // disturbing the values the user has already chosen.
  for (const key of SETTING_KEYS) {
    await db
      .insert(settings)
      .values({
        key,
        valueJson: JSON.stringify(DEFAULT_SETTINGS[key]),
        updatedAt: now,
      })
      .onConflictDoNothing();
  }
}

/** Removes every row from every table. Used by restore before importing. */
export async function clearAllTables(): Promise<void> {
  const tableNames = [
    'task_occurrence_states',
    'tasks',
    'purchase_events',
    'items',
    'categories',
    'places',
    'osm_cache',
    'osm_hidden',
    'list_reminder_rules',
    'home_exit_checklist',
    'settings',
    'scheduled_refs',
  ];
  for (const name of tableNames) {
    await db.run(sql.raw(`DELETE FROM ${name}`));
  }
}
