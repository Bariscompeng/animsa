/**
 * Catalogue, shopping list and purchase history.
 *
 * The catalogue is the durable record: an item always exists once it has been
 * bought, and `on_list` only toggles whether it is currently being shopped for.
 * That is what makes consumption prediction possible.
 */
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import { guessCategoryId } from '@/data/categoryKeywords';
import { normalizeTr, titleCaseTr } from '@/domain/normalize';
import type { CategoryLike, ItemLike, PlaceType, Unit } from '@/domain/types';

import { db } from '../client';
import { categories, items, purchaseEvents, type CategoryRow, type ItemRow } from '../schema';

export function rowToItem(row: ItemRow): ItemLike & {
  barcode: string | null;
  notes: string | null;
  defaultQty: number;
  suggestionDismissed: boolean;
  categoryLocked: boolean;
  listAddedAt: number | null;
} {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    unit: row.unit as Unit,
    onList: row.onList,
    listQty: row.listQty,
    expiryDate: row.expiryDate,
    barcode: row.barcode,
    notes: row.notes,
    defaultQty: row.defaultQty,
    suggestionDismissed: row.suggestionDismissed,
    categoryLocked: row.categoryLocked,
    listAddedAt: row.listAddedAt,
  };
}

export type ItemFull = ReturnType<typeof rowToItem>;

export function rowToCategory(row: CategoryRow): CategoryLike {
  let placeTypes: PlaceType[] = [];
  try {
    placeTypes = JSON.parse(row.placeTypesJson) as PlaceType[];
  } catch {
    placeTypes = [];
  }
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    placeTypes,
    sfSymbol: row.sfSymbol,
  };
}

export async function listCategories(): Promise<CategoryLike[]> {
  const rows = await db.select().from(categories).orderBy(categories.sortOrder);
  return rows.map(rowToCategory);
}

export async function reorderCategories(orderedIds: string[]): Promise<void> {
  const now = Date.now();
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(categories)
      .set({ sortOrder: i, updatedAt: now })
      .where(eq(categories.id, orderedIds[i]!));
  }
}

export async function listItems(): Promise<ItemFull[]> {
  const rows = await db.select().from(items).orderBy(items.name);
  return rows.map(rowToItem);
}

export async function listOnList(): Promise<ItemFull[]> {
  const rows = await db.select().from(items).where(eq(items.onList, true));
  return rows.map(rowToItem);
}

export async function listWithExpiry(): Promise<ItemFull[]> {
  const rows = await db
    .select()
    .from(items)
    .where(isNotNull(items.expiryDate))
    .orderBy(items.expiryDate);
  return rows.map(rowToItem);
}

export async function getItem(id: string): Promise<ItemFull | null> {
  const rows = await db.select().from(items).where(eq(items.id, id)).limit(1);
  const row = rows[0];
  return row ? rowToItem(row) : null;
}

export async function findByBarcode(barcode: string): Promise<ItemFull | null> {
  const rows = await db.select().from(items).where(eq(items.barcode, barcode)).limit(1);
  const row = rows[0];
  return row ? rowToItem(row) : null;
}

/** Finds a catalogue entry by normalised name — the autocomplete's backbone. */
export async function findByName(name: string): Promise<ItemFull | null> {
  const normalized = normalizeTr(name);
  const rows = await db.select().from(items).where(eq(items.nameNormalized, normalized)).limit(1);
  const row = rows[0];
  return row ? rowToItem(row) : null;
}

export type ItemDraft = {
  name: string;
  categoryId?: string;
  unit?: Unit;
  defaultQty?: number;
  barcode?: string | null;
  notes?: string | null;
  expiryDate?: string | null;
};

export async function createItem(draft: ItemDraft): Promise<string> {
  const now = Date.now();
  const id = randomUUID();
  const name = titleCaseTr(draft.name);
  await db.insert(items).values({
    id,
    name,
    nameNormalized: normalizeTr(name),
    categoryId: draft.categoryId ?? guessCategoryId(name),
    unit: draft.unit ?? 'adet',
    defaultQty: draft.defaultQty ?? 1,
    barcode: draft.barcode ?? null,
    notes: draft.notes ?? null,
    onList: false,
    expiryDate: draft.expiryDate ?? null,
    // An explicit category from the user is a correction we must remember.
    categoryLocked: Boolean(draft.categoryId),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateItem(id: string, draft: Partial<ItemDraft>): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  if (draft.name !== undefined) {
    const name = titleCaseTr(draft.name);
    patch.name = name;
    patch.nameNormalized = normalizeTr(name);
  }
  if (draft.categoryId !== undefined) {
    patch.categoryId = draft.categoryId;
    // Remember the correction so the dictionary never overrides it again.
    patch.categoryLocked = true;
  }
  if (draft.unit !== undefined) patch.unit = draft.unit;
  if (draft.defaultQty !== undefined) patch.defaultQty = draft.defaultQty;
  if (draft.barcode !== undefined) patch.barcode = draft.barcode;
  if (draft.notes !== undefined) patch.notes = draft.notes;
  if (draft.expiryDate !== undefined) patch.expiryDate = draft.expiryDate;
  await db.update(items).set(patch).where(eq(items.id, id));
}

export async function deleteItem(id: string): Promise<void> {
  await db.delete(purchaseEvents).where(eq(purchaseEvents.itemId, id));
  await db.delete(items).where(eq(items.id, id));
}

/**
 * Adds an existing catalogue item to the shopping list, or creates it first.
 * Returns the item id.
 */
export async function addToList(
  nameOrId: { id: string } | { name: string },
  qty?: number,
  unit?: Unit,
): Promise<string> {
  const now = Date.now();
  let id: string;

  if ('id' in nameOrId) {
    id = nameOrId.id;
  } else {
    const existing = await findByName(nameOrId.name);
    id = existing ? existing.id : await createItem({ name: nameOrId.name, unit });
  }

  await db
    .update(items)
    .set({
      onList: true,
      listQty: qty ?? null,
      listAddedAt: now,
      // A fresh add clears any "not now" the user gave the suggestion.
      suggestionDismissed: false,
      ...(unit ? { unit } : {}),
      updatedAt: now,
    })
    .where(eq(items.id, id));

  return id;
}

export async function removeFromList(id: string): Promise<void> {
  await db
    .update(items)
    .set({ onList: false, listQty: null, listAddedAt: null, updatedAt: Date.now() })
    .where(eq(items.id, id));
}

/**
 * Marks an item as bought: records a purchase event (which feeds prediction)
 * and takes it off the list.
 */
export async function markPurchased(id: string, qty?: number | null): Promise<void> {
  const now = Date.now();
  await db.insert(purchaseEvents).values({
    id: randomUUID(),
    itemId: id,
    purchasedAt: now,
    qty: qty ?? null,
    createdAt: now,
    updatedAt: now,
  });
  await db
    .update(items)
    .set({
      onList: false,
      listQty: null,
      listAddedAt: null,
      suggestionDismissed: false,
      updatedAt: now,
    })
    .where(eq(items.id, id));
}

/** Undoes the most recent purchase of an item and puts it back on the list. */
export async function undoPurchase(id: string): Promise<void> {
  const rows = await db
    .select()
    .from(purchaseEvents)
    .where(eq(purchaseEvents.itemId, id))
    .orderBy(desc(purchaseEvents.purchasedAt))
    .limit(1);
  const latest = rows[0];
  if (latest) {
    await db.delete(purchaseEvents).where(eq(purchaseEvents.id, latest.id));
  }
  await db
    .update(items)
    .set({ onList: true, listAddedAt: Date.now(), updatedAt: Date.now() })
    .where(eq(items.id, id));
}

export async function listPurchases(itemId: string): Promise<Date[]> {
  const rows = await db
    .select({ purchasedAt: purchaseEvents.purchasedAt })
    .from(purchaseEvents)
    .where(eq(purchaseEvents.itemId, itemId));
  return rows.map((r) => new Date(r.purchasedAt));
}

export async function allPurchases(): Promise<Map<string, Date[]>> {
  const rows = await db.select().from(purchaseEvents);
  const map = new Map<string, Date[]>();
  for (const row of rows) {
    const list = map.get(row.itemId) ?? [];
    list.push(new Date(row.purchasedAt));
    map.set(row.itemId, list);
  }
  return map;
}

export async function dismissSuggestion(id: string): Promise<void> {
  await db
    .update(items)
    .set({ suggestionDismissed: true, updatedAt: Date.now() })
    .where(eq(items.id, id));
}

export async function clearList(): Promise<void> {
  const onList = await listOnList();
  for (const item of onList) {
    await markPurchased(item.id, item.listQty);
  }
}

export async function setExpiry(id: string, date: string | null): Promise<void> {
  await db.update(items).set({ expiryDate: date, updatedAt: Date.now() }).where(eq(items.id, id));
}

/** Place types the current list needs, used by region selection. */
export async function activePlaceTypes(): Promise<Set<PlaceType>> {
  const [onList, cats] = await Promise.all([listOnList(), listCategories()]);
  const byId = new Map(cats.map((c) => [c.id, c]));
  const out = new Set<PlaceType>();
  for (const item of onList) {
    const category = byId.get(item.categoryId);
    for (const type of category?.placeTypes ?? []) out.add(type);
  }
  return out;
}

/** Items on the list whose category matches a given place type. */
export async function listItemsForPlaceType(type: PlaceType): Promise<ItemFull[]> {
  const [onList, cats] = await Promise.all([listOnList(), listCategories()]);
  const matching = new Set(cats.filter((c) => c.placeTypes.includes(type)).map((c) => c.id));
  return onList.filter((i) => matching.has(i.categoryId));
}

/** Items whose category is still a dictionary guess, for re-classification. */
export async function unlockedItems(): Promise<ItemFull[]> {
  const rows = await db
    .select()
    .from(items)
    .where(and(eq(items.categoryLocked, false)));
  return rows.map(rowToItem);
}
