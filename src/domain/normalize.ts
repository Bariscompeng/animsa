/**
 * Turkish-aware text normalisation used for search, autocomplete and catalogue
 * matching. Both sides of a comparison are always normalised.
 */

const FOLD: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
  ê: 'e',
  ô: 'o',
};

/**
 * Lowercases with Turkish rules (İ → i, I → ı), folds diacritics and collapses
 * whitespace. `normalizeTr('İLAÇ') === normalizeTr('ilac')`.
 */
export function normalizeTr(input: string): string {
  const lowered = input.toLocaleLowerCase('tr-TR');
  let out = '';
  for (const ch of lowered) {
    out += FOLD[ch] ?? ch;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Uppercases the first letter with Turkish rules: `ilaç` → `İlaç`. */
export function capitalizeTr(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return trimmed;
  const first = trimmed.slice(0, 1).toLocaleUpperCase('tr-TR');
  return first + trimmed.slice(1);
}

/** Title-cases every word with Turkish rules. Used for catalogue item names. */
export function titleCaseTr(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map((word) => capitalizeTr(word.toLocaleLowerCase('tr-TR')))
    .join(' ');
}

/**
 * True when `needle` matches `haystack` as a prefix or word-prefix after
 * normalisation. Drives the list autocomplete.
 */
export function matchesPrefix(haystack: string, needle: string): boolean {
  const h = normalizeTr(haystack);
  const n = normalizeTr(needle);
  if (n.length === 0) return true;
  if (h.startsWith(n)) return true;
  return h.split(' ').some((word) => word.startsWith(n));
}
