/**
 * Backup and restore (§3.11).
 *
 * Deleting the app deletes its data, and a free signature makes reinstalls a
 * fact of life — so this is not a nice-to-have. Backups are plain JSON the
 * user can read and store anywhere.
 */
import { sql } from 'drizzle-orm';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { db } from '@/db/client';
import { clearAllTables, seedIfNeeded } from '@/db/seed';
import { logEvent } from '@/db/repos/misc';
import { getSetting, setSetting } from '@/db/repos/settings';
import {
  BACKUP_TABLES,
  backupFileName,
  buildBackup,
  validateBackup,
  type BackupFile,
  type BackupRow,
  type BackupSummary,
} from '@/domain/backupSchema';

/** Folder shown in the Files app under "On My iPhone › Anımsa". */
const AUTO_BACKUP_DIR = 'Yedekler';
/** Snapshots kept before the oldest is deleted. */
const AUTO_BACKUP_KEEP = 4;
const AUTO_BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

async function readTable(name: string): Promise<BackupRow[]> {
  const result = await db.all<BackupRow>(sql.raw(`SELECT * FROM ${name}`));
  return result;
}

/** Serialises every backed-up table into a backup envelope. */
export async function exportBackup(now: Date = new Date()): Promise<BackupFile> {
  const tables: Record<string, BackupRow[]> = {};
  for (const name of BACKUP_TABLES) {
    try {
      tables[name] = await readTable(name);
    } catch {
      tables[name] = [];
    }
  }
  return buildBackup(tables, now);
}

/** Writes a backup to a file and returns it. */
async function writeBackupFile(directory: Directory, name: string): Promise<File> {
  const backup = await exportBackup();
  if (!directory.exists) directory.create({ intermediates: true });
  const file = new File(directory, name);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup, null, 2));
  return file;
}

/**
 * Manual backup: writes the file, then opens the iOS share sheet so the user
 * can put it in Files, iCloud Drive or anywhere else.
 */
export async function shareBackup(): Promise<void> {
  const now = new Date();
  const file = await writeBackupFile(Paths.cache, backupFileName(now));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Anımsa yedeği',
      UTI: 'public.json',
    });
  }
  await logEvent('info', 'Yedek paylaşıldı', { name: file.name });
}

/**
 * Weekly automatic snapshot into `Documents/Yedekler/`, keeping the last four.
 * Runs on foreground; missing a week simply means the next run catches it.
 */
export async function runAutoBackupIfDue(now: Date = new Date()): Promise<boolean> {
  const enabled = await getSetting('autoBackupEnabled');
  if (!enabled) return false;

  const last = await getSetting('lastAutoBackupAt');
  if (last !== null && now.getTime() - last < AUTO_BACKUP_INTERVAL_MS) return false;

  try {
    const directory = new Directory(Paths.document, AUTO_BACKUP_DIR);
    await writeBackupFile(directory, backupFileName(now));

    // Prune oldest snapshots.
    const files = directory
      .list()
      .filter((entry): entry is File => entry instanceof File)
      .filter((f) => f.name.endsWith('.json'))
      .sort((a, b) => (a.name < b.name ? 1 : -1));
    for (const stale of files.slice(AUTO_BACKUP_KEEP)) {
      stale.delete();
    }

    await setSetting('lastAutoBackupAt', now.getTime());
    await logEvent('info', 'Otomatik yedek alındı');
    return true;
  } catch (error) {
    await logEvent('error', 'Otomatik yedek alınamadı', { error: String(error) });
    return false;
  }
}

export type PickedBackup = {
  backup: BackupFile;
  summary: BackupSummary;
  fileName: string;
};

/**
 * Lets the user pick a backup file and validates it.
 * @returns the parsed backup, or a Turkish error message.
 */
export async function pickBackup(): Promise<
  { ok: true; picked: PickedBackup } | { ok: false; error: string }
> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'public.json', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return { ok: false, error: 'Seçim iptal edildi.' };

  const asset = result.assets[0];
  if (!asset) return { ok: false, error: 'Dosya okunamadı.' };

  try {
    const file = new File(asset.uri);
    const text = await file.text();
    const parsed: unknown = JSON.parse(text);
    const validation = validateBackup(parsed);
    if (!validation.ok) return { ok: false, error: validation.error };
    return {
      ok: true,
      picked: {
        backup: validation.backup,
        summary: validation.summary,
        fileName: asset.name ?? 'yedek.json',
      },
    };
  } catch {
    return { ok: false, error: 'Dosya geçerli bir JSON değil.' };
  }
}

function quote(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Replaces the entire database with the backup's contents, in one transaction.
 * On any failure nothing is committed and the previous data survives.
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction(async (tx) => {
    await clearAllTables();

    for (const name of BACKUP_TABLES) {
      const rows = backup.tables[name];
      if (!rows || rows.length === 0) continue;

      for (const row of rows) {
        const columns = Object.keys(row);
        if (columns.length === 0) continue;
        const values = columns.map((c) => quote(row[c])).join(', ');
        await tx.run(
          sql.raw(`INSERT OR REPLACE INTO ${name} (${columns.join(', ')}) VALUES (${values})`),
        );
      }
    }
  });

  // Fill in anything a older backup did not carry.
  await seedIfNeeded();
  await logEvent('info', 'Yedek geri yüklendi');
}
