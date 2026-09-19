/**
 * Default shopping categories (§3.4).
 *
 * `placeTypes` decides which geofence triggers a reminder for items in the
 * category. Bakery items are reminded at both bakeries and supermarkets.
 */
import type { PlaceType } from '@/domain/types';

export type DefaultCategory = {
  id: string;
  name: string;
  placeTypes: PlaceType[];
  sfSymbol: string;
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { id: 'cat-manav', name: 'Manav', placeTypes: ['market'], sfSymbol: 'carrot' },
  {
    id: 'cat-sut',
    name: 'Süt & Kahvaltılık',
    placeTypes: ['market'],
    sfSymbol: 'takeoutbag.and.cup.and.straw',
  },
  { id: 'cat-et', name: 'Et, Tavuk & Balık', placeTypes: ['market'], sfSymbol: 'fish' },
  { id: 'cat-firin', name: 'Fırın', placeTypes: ['bakery', 'market'], sfSymbol: 'birthday.cake' },
  { id: 'cat-temel', name: 'Temel Gıda', placeTypes: ['market'], sfSymbol: 'basket' },
  { id: 'cat-atistirmalik', name: 'Atıştırmalık', placeTypes: ['market'], sfSymbol: 'popcorn' },
  { id: 'cat-icecek', name: 'İçecek', placeTypes: ['market'], sfSymbol: 'cup.and.saucer' },
  { id: 'cat-dondurulmus', name: 'Dondurulmuş', placeTypes: ['market'], sfSymbol: 'snowflake' },
  {
    id: 'cat-temizlik',
    name: 'Temizlik',
    placeTypes: ['market'],
    sfSymbol: 'bubbles.and.sparkles',
  },
  { id: 'cat-bakim', name: 'Kişisel Bakım', placeTypes: ['market'], sfSymbol: 'comb' },
  { id: 'cat-evcil', name: 'Evcil Hayvan', placeTypes: ['market'], sfSymbol: 'pawprint' },
  { id: 'cat-eczane', name: 'Eczane', placeTypes: ['pharmacy'], sfSymbol: 'cross.case' },
  {
    id: 'cat-hirdavat',
    name: 'Hırdavat',
    placeTypes: ['hardware'],
    sfSymbol: 'wrench.and.screwdriver',
  },
  { id: 'cat-diger', name: 'Diğer', placeTypes: ['market'], sfSymbol: 'tag' },
];

export const FALLBACK_CATEGORY_ID = 'cat-diger';

export const DEFAULT_HOME_EXIT_CHECKLIST = ['Anahtar', 'Cüzdan', 'Telefon şarjı'];
