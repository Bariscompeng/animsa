import { DEFAULT_QUIET_HOURS, applyQuietHours, isQuiet, shiftOutOfQuiet } from './quietHours';
import { toTimeKey, toDateKey } from './format';

const quiet = DEFAULT_QUIET_HOURS; // 23:00 → 07:30
const at = (iso: string): Date => new Date(iso);

describe('isQuiet', () => {
  it.each([
    ['2026-09-18T23:30', true],
    ['2026-09-18T23:00', true],
    ['2026-09-19T02:00', true],
    ['2026-09-19T07:29', true],
    ['2026-09-19T07:30', false],
    ['2026-09-19T12:00', false],
    ['2026-09-18T22:59', false],
  ])('%s → %s', (iso, expected) => {
    expect(isQuiet(at(iso), quiet)).toBe(expected);
  });

  it('is never quiet when disabled', () => {
    expect(isQuiet(at('2026-09-19T02:00'), { ...quiet, enabled: false })).toBe(false);
  });

  it('handles a non-wrapping window', () => {
    const daytime = { enabled: true, start: '09:00', end: '17:00' };
    expect(isQuiet(at('2026-09-19T12:00'), daytime)).toBe(true);
    expect(isQuiet(at('2026-09-19T20:00'), daytime)).toBe(false);
  });

  it('treats an empty window as never quiet', () => {
    expect(isQuiet(at('2026-09-19T02:00'), { enabled: true, start: '23:00', end: '23:00' })).toBe(
      false,
    );
  });
});

describe('shiftOutOfQuiet', () => {
  it('moves a late-night moment to the next morning', () => {
    const shifted = shiftOutOfQuiet(at('2026-09-18T23:30'), quiet);
    expect(toDateKey(shifted)).toBe('2026-09-19');
    expect(toTimeKey(shifted)).toBe('07:30');
  });

  it('moves an early-morning moment to the same morning', () => {
    const shifted = shiftOutOfQuiet(at('2026-09-19T03:00'), quiet);
    expect(toDateKey(shifted)).toBe('2026-09-19');
    expect(toTimeKey(shifted)).toBe('07:30');
  });

  it('leaves a daytime moment untouched', () => {
    const original = at('2026-09-19T12:00');
    expect(shiftOutOfQuiet(original, quiet).getTime()).toBe(original.getTime());
  });

  it('leaves everything untouched when quiet hours are off', () => {
    const original = at('2026-09-19T02:00');
    expect(shiftOutOfQuiet(original, { ...quiet, enabled: false }).getTime()).toBe(
      original.getTime(),
    );
  });
});

describe('applyQuietHours', () => {
  it('shifts a non-exempt reminder', () => {
    const shifted = applyQuietHours(at('2026-09-19T02:00'), quiet, false);
    expect(toTimeKey(shifted)).toBe('07:30');
  });

  it('leaves an exempt reminder in place', () => {
    const original = at('2026-09-19T02:00');
    expect(applyQuietHours(original, quiet, true).getTime()).toBe(original.getTime());
  });

  it('is a no-op outside the window regardless of exemption', () => {
    const original = at('2026-09-19T12:00');
    expect(applyQuietHours(original, quiet, false).getTime()).toBe(original.getTime());
    expect(applyQuietHours(original, quiet, true).getTime()).toBe(original.getTime());
  });
});
