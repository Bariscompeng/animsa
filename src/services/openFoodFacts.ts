/**
 * Barcode → product name lookup via Open Food Facts (§3.4).
 * Optional by design: with no network the user simply types the name.
 */
import { titleCaseTr } from '@/domain/normalize';

const ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = 'product_name,product_name_tr,brands';
const TIMEOUT_MS = 5000;

export type ProductLookup = {
  name: string;
  brand: string | null;
};

type OffResponse = {
  status?: number;
  product?: {
    product_name?: string;
    product_name_tr?: string;
    brands?: string;
  };
};

/**
 * Looks up a barcode.
 * @returns the product, or null when it is unknown, the request fails, or the
 * device is offline. Never throws.
 */
export async function lookupBarcode(barcode: string): Promise<ProductLookup | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(
      `${ENDPOINT}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`,
      {
        headers: {
          'User-Agent': 'Animsa/1.0 (kişisel kullanım)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      },
    );
    clearTimeout(timer);
    if (!response.ok) return null;

    const data = (await response.json()) as OffResponse;
    const product = data.product;
    if (!product) return null;

    // Prefer the Turkish name when the product has one.
    const raw = product.product_name_tr?.trim() || product.product_name?.trim();
    if (!raw) return null;

    return {
      name: titleCaseTr(raw),
      brand: product.brands?.split(',')[0]?.trim() ?? null,
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}
