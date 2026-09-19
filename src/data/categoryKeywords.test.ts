import { KEYWORD_COUNT, guessCategoryId } from './categoryKeywords';
import { DEFAULT_CATEGORIES, FALLBACK_CATEGORY_ID } from './defaultCategories';

describe('category dictionary', () => {
  it('holds at least 300 products', () => {
    expect(KEYWORD_COUNT).toBeGreaterThanOrEqual(300);
  });

  it('maps every keyword to a real category', () => {
    const ids = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
    for (const name of ['domates', 'süt', 'deterjan', 'parol', 'ampul']) {
      expect(ids.has(guessCategoryId(name))).toBe(true);
    }
  });
});

describe('guessCategoryId', () => {
  it.each([
    ['domates', 'cat-manav'],
    ['Domates', 'cat-manav'],
    ['DOMATES', 'cat-manav'],
    ['elma', 'cat-manav'],
    ['süt', 'cat-sut'],
    ['sut', 'cat-sut'],
    ['yoğurt', 'cat-sut'],
    ['yumurta', 'cat-sut'],
    ['kıyma', 'cat-et'],
    ['tavuk', 'cat-et'],
    ['ekmek', 'cat-firin'],
    ['simit', 'cat-firin'],
    ['makarna', 'cat-temel'],
    ['zeytinyağı', 'cat-temel'],
    ['çikolata', 'cat-atistirmalik'],
    ['cips', 'cat-atistirmalik'],
    ['su', 'cat-icecek'],
    ['kola', 'cat-icecek'],
    ['deterjan', 'cat-temizlik'],
    ['çöp poşeti', 'cat-temizlik'],
    ['şampuan', 'cat-bakim'],
    ['diş macunu', 'cat-bakim'],
    ['kedi maması', 'cat-evcil'],
    ['parol', 'cat-eczane'],
    ['vitamin', 'cat-eczane'],
    ['ağrı kesici', 'cat-eczane'],
    ['ampul', 'cat-hirdavat'],
    ['pil', 'cat-hirdavat'],
  ])('guesses %s → %s', (name, expected) => {
    expect(guessCategoryId(name)).toBe(expected);
  });

  it('falls back to Diğer for an unknown product', () => {
    expect(guessCategoryId('zxcvbnm')).toBe(FALLBACK_CATEGORY_ID);
  });

  it('falls back for an empty name', () => {
    expect(guessCategoryId('')).toBe(FALLBACK_CATEGORY_ID);
  });

  it('uses the head noun of a Turkish compound', () => {
    expect(guessCategoryId('köpek maması')).toBe('cat-evcil');
  });

  it('matches a keyword inside a longer name', () => {
    expect(guessCategoryId('light beyaz peynir 500g')).toBe('cat-sut');
  });

  it('is case- and diacritic-insensitive', () => {
    expect(guessCategoryId('ŞAMPUAN')).toBe(guessCategoryId('sampuan'));
  });
});
