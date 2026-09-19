import { predict } from './predictor';
import { addDays } from './format';

const NOW = new Date(2026, 8, 18, 10, 0, 0, 0);
const daysAgo = (n: number): Date => addDays(NOW, -n);

describe('predict', () => {
  it('returns null with fewer than three purchases', () => {
    expect(predict([daysAgo(20), daysAgo(10)], NOW)).toBeNull();
  });

  it('returns null with no purchases', () => {
    expect(predict([], NOW)).toBeNull();
  });

  it('computes the median gap for an even cadence', () => {
    const result = predict([daysAgo(21), daysAgo(14), daysAgo(7)], NOW);
    expect(result).not.toBeNull();
    expect(result!.medianDays).toBe(7);
  });

  it('marks an item due once 85% of the median has elapsed', () => {
    // Median 7 days, last purchase 6 days ago → ratio 0.857.
    const result = predict([daysAgo(20), daysAgo(13), daysAgo(6)], NOW);
    expect(result!.isDue).toBe(true);
  });

  it('does not mark an item due too early', () => {
    // Median 7 days, last purchase 2 days ago → ratio 0.29.
    const result = predict([daysAgo(16), daysAgo(9), daysAgo(2)], NOW);
    expect(result!.isDue).toBe(false);
  });

  it('counts several purchases on one day as a single purchase', () => {
    const sameDayA = new Date(2026, 8, 11, 9, 0);
    const sameDayB = new Date(2026, 8, 11, 18, 0);
    expect(predict([daysAgo(21), daysAgo(14), sameDayA, sameDayB], NOW)).not.toBeNull();
    // Only three distinct days remain, so a fourth same-day purchase changes nothing.
    const withDuplicate = predict([daysAgo(21), daysAgo(14), sameDayA, sameDayB], NOW);
    const withoutDuplicate = predict([daysAgo(21), daysAgo(14), sameDayA], NOW);
    expect(withDuplicate!.medianDays).toBe(withoutDuplicate!.medianDays);
  });

  it('ignores gaps longer than four times the median', () => {
    // Gaps: 200, 7, 7, 7 — the outlier must not drag the median up.
    const result = predict([daysAgo(221), daysAgo(21), daysAgo(14), daysAgo(7)], NOW);
    expect(result!.medianDays).toBe(7);
  });

  it('handles an uneven cadence with an even number of gaps', () => {
    // Gaps: 6, 8 → median 7.
    const result = predict([daysAgo(20), daysAgo(14), daysAgo(6)], NOW);
    expect(result!.medianDays).toBe(7);
  });

  it('reports a ratio above 1 for an overdue item', () => {
    const result = predict([daysAgo(28), daysAgo(21), daysAgo(14)], NOW);
    expect(result!.dueRatio).toBeGreaterThan(1);
    expect(result!.isDue).toBe(true);
  });

  it('returns null when every purchase is on the same day', () => {
    const d = new Date(2026, 8, 11, 9, 0);
    expect(predict([d, d, d], NOW)).toBeNull();
  });
});
