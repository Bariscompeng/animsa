/**
 * Quantity/unit parser for the shopping-list quick-add field.
 * "2 kg domates" → { name: 'Domates', qty: 2, unit: 'kg' }
 */
import { titleCaseTr } from '../normalize';
import type { Unit } from '../types';

const UNIT_WORDS: Record<string, Unit> = {
  adet: 'adet',
  tane: 'adet',
  kg: 'kg',
  kilo: 'kg',
  kilogram: 'kg',
  g: 'g',
  gr: 'g',
  gram: 'g',
  lt: 'lt',
  l: 'lt',
  litre: 'lt',
  ml: 'ml',
  mililitre: 'ml',
  paket: 'paket',
  pk: 'paket',
};

export type ParsedItem = {
  name: string;
  qty?: number;
  unit?: Unit;
};

function toNumber(raw: string): number | null {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Parses a list entry. Accepts a leading or trailing quantity, with or without
 * a unit: "3 süt", "2 kg domates", "domates 2 kg", "yarım ekmek" is left alone.
 */
export function parseItemInput(text: string): ParsedItem {
  const raw = (text ?? '').trim();
  if (raw.length === 0) return { name: '' };

  // Leading "<qty> [unit] <name>"
  const leading = /^(\d+(?:[.,]\d+)?)\s*([a-zA-ZçğıöşüÇĞİÖŞÜ]+)?\s+(.+)$/.exec(raw);
  if (leading) {
    const qty = toNumber(leading[1]!);
    const maybeUnit = (leading[2] ?? '').toLocaleLowerCase('tr-TR');
    const unit = UNIT_WORDS[maybeUnit];
    if (qty !== null) {
      if (unit) {
        return { name: titleCaseTr(leading[3]!), qty, unit };
      }
      // No unit word: the token belongs to the name and the unit is "adet".
      const name = `${leading[2] ?? ''} ${leading[3]!}`.trim();
      return { name: titleCaseTr(name), qty, unit: 'adet' };
    }
  }

  // Trailing "<name> <qty> [unit]"
  const trailing = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-ZçğıöşüÇĞİÖŞÜ]+)?$/.exec(raw);
  if (trailing) {
    const qty = toNumber(trailing[2]!);
    const maybeUnit = (trailing[3] ?? '').toLocaleLowerCase('tr-TR');
    const unit = trailing[3] ? UNIT_WORDS[maybeUnit] : 'adet';
    if (qty !== null && unit) {
      return { name: titleCaseTr(trailing[1]!), qty, unit };
    }
  }

  return { name: titleCaseTr(raw) };
}
