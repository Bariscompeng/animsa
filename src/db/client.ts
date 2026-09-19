/**
 * Database handle.
 *
 * The same SQLite file is opened from the UI runtime and from the background
 * task runtime, so this module must stay import-light: it pulls in nothing but
 * expo-sqlite, drizzle and the schema.
 */
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

import { schema } from './schema';

export const DATABASE_NAME = 'animsa.db';

let sqliteHandle: SQLiteDatabase | null = null;

/** The raw expo-sqlite handle; `useMigrations` and diagnostics need it. */
export function getSqlite(): SQLiteDatabase {
  if (!sqliteHandle) {
    sqliteHandle = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
    // Foreign keys are off by default in SQLite; WAL keeps background writes
    // from blocking the UI.
    sqliteHandle.execSync('PRAGMA journal_mode = WAL;');
    sqliteHandle.execSync('PRAGMA foreign_keys = ON;');
  }
  return sqliteHandle;
}

export const db = drizzle(getSqlite(), { schema });

export type Database = typeof db;
