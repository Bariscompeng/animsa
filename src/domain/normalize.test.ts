import { capitalizeTr, matchesPrefix, normalizeTr, titleCaseTr } from './normalize';
import { parseItemInput } from './nlp/parseItemInput';

describe('normalizeTr', () => {
  it.each([
    ['İLAÇ', 'ilac'],
    ['ilac', 'ilac'],
    ['İlaç', 'ilac'],
    ['Süt', 'sut'],
    ['SUT', 'sut'],
    ['sut', 'sut'],
    ['IŞIK', 'isik'],
    ['ışık', 'isik'],
    ['Çğıöşü', 'cgiosu'],
    ['  çok   boşluk  ', 'cok bosluk'],
    ['Ağustos', 'agustos'],
    ['kâğıt', 'kagit'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeTr(input)).toBe(expected);
  });

  it('makes İLAÇ and ilac equal', () => {
    expect(normalizeTr('İLAÇ')).toBe(normalizeTr('ilac'));
  });

  it('makes Süt and SUT equal', () => {
    expect(normalizeTr('Süt')).toBe(normalizeTr('SUT'));
  });
});

describe('capitalizeTr', () => {
  it('uppercases a dotless i to İ', () => {
    expect(capitalizeTr('ilaç')).toBe('İlaç');
  });
  it('leaves an already-capital word alone', () => {
    expect(capitalizeTr('Süt')).toBe('Süt');
  });
  it('handles an empty string', () => {
    expect(capitalizeTr('')).toBe('');
  });
  it('trims surrounding whitespace', () => {
    expect(capitalizeTr('  ekmek ')).toBe('Ekmek');
  });
});

describe('titleCaseTr', () => {
  it('title-cases every word', () => {
    expect(titleCaseTr('zeytin yağı')).toBe('Zeytin Yağı');
  });
  it('normalises shouting', () => {
    expect(titleCaseTr('SIVI SABUN')).toBe('Sıvı Sabun');
  });
});

describe('matchesPrefix', () => {
  it('matches a normalised prefix', () => {
    expect(matchesPrefix('Süt', 'sut')).toBe(true);
  });
  it('matches a word-level prefix', () => {
    expect(matchesPrefix('Zeytin Yağı', 'yag')).toBe(true);
  });
  it('rejects a non-match', () => {
    expect(matchesPrefix('Süt', 'ekmek')).toBe(false);
  });
  it('matches everything for an empty needle', () => {
    expect(matchesPrefix('Süt', '')).toBe(true);
  });
});

describe('parseItemInput', () => {
  it('parses "2 kg domates"', () => {
    expect(parseItemInput('2 kg domates')).toEqual({ name: 'Domates', qty: 2, unit: 'kg' });
  });
  it('parses "3 süt" as 3 adet', () => {
    expect(parseItemInput('3 süt')).toEqual({ name: 'Süt', qty: 3, unit: 'adet' });
  });
  it('parses "1 lt ayran"', () => {
    expect(parseItemInput('1 lt ayran')).toEqual({ name: 'Ayran', qty: 1, unit: 'lt' });
  });
  it('parses "500 gr peynir"', () => {
    expect(parseItemInput('500 gr peynir')).toEqual({ name: 'Peynir', qty: 500, unit: 'g' });
  });
  it('parses a trailing quantity', () => {
    expect(parseItemInput('domates 2 kg')).toEqual({ name: 'Domates', qty: 2, unit: 'kg' });
  });
  it('parses a decimal quantity with a comma', () => {
    expect(parseItemInput('1,5 kg elma')).toEqual({ name: 'Elma', qty: 1.5, unit: 'kg' });
  });
  it('accepts "tane" as adet', () => {
    expect(parseItemInput('4 tane yumurta')).toEqual({ name: 'Yumurta', qty: 4, unit: 'adet' });
  });
  it('accepts "paket"', () => {
    expect(parseItemInput('2 paket makarna')).toEqual({
      name: 'Makarna',
      qty: 2,
      unit: 'paket',
    });
  });
  it('leaves a bare name alone', () => {
    expect(parseItemInput('ekmek')).toEqual({ name: 'Ekmek' });
  });
  it('keeps multi-word names', () => {
    expect(parseItemInput('zeytin yağı')).toEqual({ name: 'Zeytin Yağı' });
  });
  it('handles an empty string', () => {
    expect(parseItemInput('')).toEqual({ name: '' });
  });
  it('treats an unknown unit word as part of the name', () => {
    expect(parseItemInput('2 kutu süt')).toEqual({ name: 'Kutu Süt', qty: 2, unit: 'adet' });
  });
});
