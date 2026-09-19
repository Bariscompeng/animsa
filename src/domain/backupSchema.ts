/**
 * Backup file format and validation (§3.11, §5.10).
 *
 * A backup is the whole database as JSON. `event_log` and `scheduled_refs` are
 * deliberately excluded: they are derived state that the next sync rebuilds.
 */

export const BACKUP_APP_ID = 'animsa';
export const BACKUP_SCHEMA_VERSION = 1;

/** Tables included in a backup, in restore order (parents before children). */
export const BACKUP_TABLES = [
  'settings',
  'categories',
  'items',
  'purchase_events',
  'tasks',
  'task_occurrence_states',
  'places',
  'list_reminder_rules',
  'home_exit_checklist',
  'osm_hidden',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupRow = Record<string, unknown>;

export type BackupFile = {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  tables: Partial<Record<BackupTable, BackupRow[]>>;
};

export type ValidationResult =
  { ok: true; backup: BackupFile; summary: BackupSummary } | { ok: false; error: string };

export type BackupSummary = {
  items: number;
  tasks: number;
  places: number;
  categories: number;
  purchases: number;
  total: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Human-readable counts for the restore confirmation sheet. */
export function summarize(backup: BackupFile): BackupSummary {
  const count = (t: BackupTable): number => backup.tables[t]?.length ?? 0;
  const total = BACKUP_TABLES.reduce((sum, t) => sum + count(t), 0);
  return {
    items: count('items'),
    tasks: count('tasks'),
    places: count('places'),
    categories: count('categories'),
    purchases: count('purchase_events'),
    total,
  };
}

/**
 * Validates parsed JSON as a backup file. Returns a Turkish error message when
 * the file is not one of ours, so the UI can show it directly.
 */
export function validateBackup(input: unknown): ValidationResult {
  if (!isPlainObject(input)) {
    return { ok: false, error: 'Dosya geçerli bir yedek değil.' };
  }
  if (input.app !== BACKUP_APP_ID) {
    return { ok: false, error: 'Bu dosya bir Anımsa yedeği değil.' };
  }
  const schemaVersion = input.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isFinite(schemaVersion)) {
    return { ok: false, error: 'Yedek şema sürümü okunamadı.' };
  }
  if (schemaVersion > BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'Yedek daha yeni bir Anımsa sürümüne ait. Önce uygulamayı güncelle.',
    };
  }
  if (!isPlainObject(input.tables)) {
    return { ok: false, error: 'Yedekte tablo verisi yok.' };
  }

  const tables: Partial<Record<BackupTable, BackupRow[]>> = {};
  for (const name of BACKUP_TABLES) {
    const raw = (input.tables as Record<string, unknown>)[name];
    if (raw === undefined) continue;
    if (!Array.isArray(raw) || !raw.every(isPlainObject)) {
      return { ok: false, error: `"${name}" tablosu bozuk görünüyor.` };
    }
    tables[name] = raw as BackupRow[];
  }

  const exportedAt =
    typeof input.exportedAt === 'string' ? input.exportedAt : new Date(0).toISOString();

  const backup: BackupFile = {
    app: BACKUP_APP_ID,
    schemaVersion,
    exportedAt,
    tables,
  };

  return { ok: true, backup, summary: summarize(backup) };
}

/** Builds a backup envelope around already-serialised table rows. */
export function buildBackup(
  tables: Partial<Record<BackupTable, BackupRow[]>>,
  now: Date,
): BackupFile {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    tables,
  };
}

/** Suggested file name: `animsa-yedek-2026-09-19-1432.json`. */
export function backupFileName(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `animsa-yedek-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}
