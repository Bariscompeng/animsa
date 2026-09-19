/**
 * Drizzle schema (§4).
 *
 * Conventions: ids are text UUIDs; instants are epoch milliseconds (integer);
 * local calendar dates are `YYYY-MM-DD` text and local clock times are `HH:mm`
 * text, so nothing ever shifts when the device changes time zone.
 */
import { index, integer, primaryKey, sqliteTable, text, real } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
};

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    notes: text('notes'),
    dueDate: text('due_date'),
    dueTime: text('due_time'),
    rruleJson: text('rrule_json'),
    reminderType: text('reminder_type').notNull().default('none'),
    leadMinutes: integer('lead_minutes').notNull().default(0),
    important: integer('important', { mode: 'boolean' }).notNull().default(false),
    locationTriggerJson: text('location_trigger_json'),
    onHomeExit: integer('on_home_exit', { mode: 'boolean' }).notNull().default(false),
    onHomeArrive: integer('on_home_arrive', { mode: 'boolean' }).notNull().default(false),
    archivedAt: integer('archived_at'),
    ...timestamps,
  },
  (t) => [index('tasks_due_date_idx').on(t.dueDate), index('tasks_archived_idx').on(t.archivedAt)],
);

export const taskOccurrenceStates = sqliteTable(
  'task_occurrence_states',
  {
    taskId: text('task_id').notNull(),
    occurrenceKey: text('occurrence_key').notNull(),
    status: text('status').notNull(),
    snoozedUntil: integer('snoozed_until'),
    completedAt: integer('completed_at'),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.taskId, t.occurrenceKey] })],
);

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  placeTypesJson: text('place_types_json').notNull().default('[]'),
  sfSymbol: text('sf_symbol').notNull().default('tag'),
  ...timestamps,
});

export const items = sqliteTable(
  'items',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    nameNormalized: text('name_normalized').notNull(),
    categoryId: text('category_id').notNull(),
    unit: text('unit').notNull().default('adet'),
    defaultQty: real('default_qty').notNull().default(1),
    barcode: text('barcode').unique(),
    notes: text('notes'),
    onList: integer('on_list', { mode: 'boolean' }).notNull().default(false),
    listQty: real('list_qty'),
    listAddedAt: integer('list_added_at'),
    expiryDate: text('expiry_date'),
    suggestionDismissed: integer('suggestion_dismissed', { mode: 'boolean' })
      .notNull()
      .default(false),
    categoryLocked: integer('category_locked', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index('items_normalized_idx').on(t.nameNormalized),
    index('items_on_list_idx').on(t.onList),
    index('items_expiry_idx').on(t.expiryDate),
  ],
);

export const purchaseEvents = sqliteTable(
  'purchase_events',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id').notNull(),
    purchasedAt: integer('purchased_at').notNull(),
    qty: real('qty'),
    ...timestamps,
  },
  (t) => [index('purchase_events_item_idx').on(t.itemId)],
);

export const places = sqliteTable(
  'places',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type').notNull().default('other'),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    radiusM: integer('radius_m').notNull().default(150),
    source: text('source').notNull().default('user'),
    osmId: text('osm_id'),
    brand: text('brand'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    lastNotifiedAt: integer('last_notified_at'),
    ...timestamps,
  },
  (t) => [index('places_type_idx').on(t.type)],
);

export const osmCache = sqliteTable('osm_cache', {
  cellKey: text('cell_key').primaryKey(),
  fetchedAt: integer('fetched_at').notNull(),
  payloadJson: text('payload_json').notNull(),
});

export const osmHidden = sqliteTable('osm_hidden', {
  osmId: text('osm_id').primaryKey(),
  hiddenAt: integer('hidden_at').notNull(),
});

export const listReminderRules = sqliteTable('list_reminder_rules', {
  id: text('id').primaryKey(),
  rruleJson: text('rrule_json').notNull(),
  time: text('time').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
});

export const homeExitChecklist = sqliteTable('home_exit_checklist', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const scheduledRefs = sqliteTable(
  'scheduled_refs',
  {
    key: text('key').primaryKey(),
    kind: text('kind').notNull(),
    externalId: text('external_id').notNull(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id'),
    fireAt: integer('fire_at'),
    contentHash: text('content_hash').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('scheduled_refs_kind_idx').on(t.kind)],
);

export const eventLog = sqliteTable(
  'event_log',
  {
    id: text('id').primaryKey(),
    at: integer('at').notNull(),
    type: text('type').notNull(),
    message: text('message').notNull(),
    payloadJson: text('payload_json'),
  },
  (t) => [index('event_log_at_idx').on(t.at), index('event_log_type_idx').on(t.type)],
);

export const schema = {
  tasks,
  taskOccurrenceStates,
  categories,
  items,
  purchaseEvents,
  places,
  osmCache,
  osmHidden,
  listReminderRules,
  homeExitChecklist,
  settings,
  scheduledRefs,
  eventLog,
};

export type TaskRow = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;
export type OccurrenceStateRow = typeof taskOccurrenceStates.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type ItemRow = typeof items.$inferSelect;
export type ItemInsert = typeof items.$inferInsert;
export type PurchaseEventRow = typeof purchaseEvents.$inferSelect;
export type PlaceRow = typeof places.$inferSelect;
export type PlaceInsert = typeof places.$inferInsert;
export type ListReminderRuleRow = typeof listReminderRules.$inferSelect;
export type HomeExitChecklistRow = typeof homeExitChecklist.$inferSelect;
export type SettingRow = typeof settings.$inferSelect;
export type ScheduledRefRow = typeof scheduledRefs.$inferSelect;
export type EventLogRow = typeof eventLog.$inferSelect;
