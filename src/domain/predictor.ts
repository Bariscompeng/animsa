/**
 * Consumption prediction (§3.8, §5.7).
 *
 * With at least three purchases, the median gap between purchases estimates how
 * long a unit lasts. Once 85% of that median has elapsed since the last
 * purchase, the item is suggested for the list.
 */
import { daysBetween, startOfDay, toDateKey } from './format';

export const DUE_RATIO_THRESHOLD = 0.85;
const MIN_PURCHASES = 3;
/** Gaps longer than this multiple of the median are treated as outliers. */
const OUTLIER_FACTOR = 4;

export type Prediction = {
  medianDays: number;
  /** Elapsed days since the last purchase, divided by the median. */
  dueRatio: number;
  isDue: boolean;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * @param purchases Purchase moments, any order.
 * @param now Reference moment.
 * @returns null when there is not enough history to predict.
 */
export function predict(purchases: Date[], now: Date): Prediction | null {
  // Multiple purchases on the same calendar day count once.
  const uniqueDays = [...new Set(purchases.map((d) => toDateKey(d)))]
    .map((key) => startOfDay(new Date(`${key}T00:00:00`)))
    .sort((a, b) => a.getTime() - b.getTime());

  if (uniqueDays.length < MIN_PURCHASES) return null;

  const gaps: number[] = [];
  for (let i = 1; i < uniqueDays.length; i++) {
    const gap = daysBetween(uniqueDays[i - 1]!, uniqueDays[i]!);
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length < MIN_PURCHASES - 1) return null;

  const rough = median(gaps);
  if (rough <= 0) return null;

  // Drop outliers, then recompute on what is left.
  const trimmed = gaps.filter((g) => g <= rough * OUTLIER_FACTOR);
  const medianDays = trimmed.length > 0 ? median(trimmed) : rough;
  if (medianDays <= 0) return null;

  const last = uniqueDays[uniqueDays.length - 1]!;
  const elapsed = daysBetween(last, now);
  const dueRatio = elapsed / medianDays;

  return {
    medianDays,
    dueRatio,
    isDue: dueRatio >= DUE_RATIO_THRESHOLD,
  };
}
