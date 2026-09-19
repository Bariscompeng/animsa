/**
 * "Running low" suggestions (§3.8): joins the pure predictor with the
 * catalogue and purchase history.
 */
import { addToList, allPurchases, listItems, type ItemFull } from '@/db/repos/items';
import { getSetting } from '@/db/repos/settings';
import { predict, type Prediction } from '@/domain/predictor';

export type Suggestion = {
  item: ItemFull;
  prediction: Prediction;
};

/**
 * Items that are probably running out.
 *
 * Excludes anything already on the list and anything the user dismissed since
 * its last purchase, and sorts the most overdue first.
 */
export async function dueSuggestions(now: Date = new Date()): Promise<Suggestion[]> {
  const [items, purchases] = await Promise.all([listItems(), allPurchases()]);

  const out: Suggestion[] = [];
  for (const item of items) {
    if (item.onList) continue;
    if (item.suggestionDismissed) continue;
    const history = purchases.get(item.id);
    if (!history) continue;
    const prediction = predict(history, now);
    if (!prediction?.isDue) continue;
    out.push({ item, prediction });
  }

  return out.sort((a, b) => b.prediction.dueRatio - a.prediction.dueRatio);
}

/**
 * Optionally pushes due suggestions straight onto the list.
 * Off by default — silently changing the shopping list is surprising.
 *
 * @returns how many items were added.
 */
export async function autoAddIfEnabled(now: Date = new Date()): Promise<number> {
  const enabled = await getSetting('autoAddSuggestions');
  if (!enabled) return 0;

  const suggestions = await dueSuggestions(now);
  for (const suggestion of suggestions) {
    await addToList({ id: suggestion.item.id }, suggestion.item.defaultQty);
  }
  return suggestions.length;
}
