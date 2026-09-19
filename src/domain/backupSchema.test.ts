import {
  BACKUP_APP_ID,
  BACKUP_SCHEMA_VERSION,
  backupFileName,
  buildBackup,
  summarize,
  validateBackup,
} from './backupSchema';

const NOW = new Date(2026, 8, 19, 14, 32, 0);

const sample = () =>
  buildBackup(
    {
      items: [
        { id: 'i1', name: 'Süt' },
        { id: 'i2', name: 'Ekmek' },
      ],
      tasks: [{ id: 't1', title: 'İlaç' }],
      places: [{ id: 'p1', name: 'Ev' }],
      categories: [{ id: 'c1', name: 'Manav' }],
      purchase_events: [{ id: 'e1', item_id: 'i1' }],
    },
    NOW,
  );

describe('buildBackup', () => {
  it('stamps the app id and schema version', () => {
    const backup = sample();
    expect(backup.app).toBe(BACKUP_APP_ID);
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
  });

  it('records the export time as ISO', () => {
    expect(sample().exportedAt).toBe(NOW.toISOString());
  });
});

describe('validateBackup', () => {
  it('accepts a backup we just built', () => {
    const result = validateBackup(JSON.parse(JSON.stringify(sample())));
    expect(result.ok).toBe(true);
  });

  it('round-trips through JSON without losing rows', () => {
    const original = sample();
    const result = validateBackup(JSON.parse(JSON.stringify(original)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.tables.items).toEqual(original.tables.items);
    expect(result.backup.tables.tasks).toEqual(original.tables.tasks);
  });

  it('rejects a non-object', () => {
    expect(validateBackup('merhaba')).toEqual({
      ok: false,
      error: 'Dosya geçerli bir yedek değil.',
    });
  });

  it('rejects null', () => {
    expect(validateBackup(null).ok).toBe(false);
  });

  it('rejects a foreign app id', () => {
    const result = validateBackup({ app: 'other', schemaVersion: 1, tables: {} });
    expect(result).toEqual({ ok: false, error: 'Bu dosya bir Anımsa yedeği değil.' });
  });

  it('rejects a missing schema version', () => {
    const result = validateBackup({ app: BACKUP_APP_ID, tables: {} });
    expect(result.ok).toBe(false);
  });

  it('rejects a newer schema version', () => {
    const result = validateBackup({
      app: BACKUP_APP_ID,
      schemaVersion: BACKUP_SCHEMA_VERSION + 1,
      tables: {},
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('güncelle');
  });

  it('rejects missing tables', () => {
    const result = validateBackup({ app: BACKUP_APP_ID, schemaVersion: 1 });
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed table', () => {
    const result = validateBackup({
      app: BACKUP_APP_ID,
      schemaVersion: 1,
      tables: { items: 'bozuk' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('items');
  });

  it('ignores unknown tables', () => {
    const result = validateBackup({
      app: BACKUP_APP_ID,
      schemaVersion: 1,
      tables: { items: [], bilinmeyen: [{ a: 1 }] },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.tables).not.toHaveProperty('bilinmeyen');
  });

  it('never carries event_log or scheduled_refs through', () => {
    const result = validateBackup({
      app: BACKUP_APP_ID,
      schemaVersion: 1,
      tables: { event_log: [{ id: 'x' }], scheduled_refs: [{ key: 'y' }] },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.tables).not.toHaveProperty('event_log');
    expect(result.backup.tables).not.toHaveProperty('scheduled_refs');
  });

  it('accepts an older schema version', () => {
    const result = validateBackup({ app: BACKUP_APP_ID, schemaVersion: 0, tables: {} });
    expect(result.ok).toBe(true);
  });
});

describe('summarize', () => {
  it('counts each table for the restore preview', () => {
    const summary = summarize(sample());
    expect(summary.items).toBe(2);
    expect(summary.tasks).toBe(1);
    expect(summary.places).toBe(1);
    expect(summary.categories).toBe(1);
    expect(summary.purchases).toBe(1);
    expect(summary.total).toBe(6);
  });

  it('reports zeroes for an empty backup', () => {
    const summary = summarize(buildBackup({}, NOW));
    expect(summary.total).toBe(0);
  });
});

describe('backupFileName', () => {
  it('builds a sortable, zero-padded name', () => {
    expect(backupFileName(NOW)).toBe('animsa-yedek-2026-09-19-1432.json');
  });

  it('pads single-digit months and hours', () => {
    expect(backupFileName(new Date(2026, 0, 5, 9, 5))).toBe('animsa-yedek-2026-01-05-0905.json');
  });
});
