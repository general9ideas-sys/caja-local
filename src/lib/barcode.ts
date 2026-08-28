import type { Product } from "../types";

export function normalizeBarcode(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

export function findByBarcode(
  products: Product[],
  code: string,
): Product | undefined {
  const n = normalizeBarcode(code).toLowerCase();
  if (n.length < 3) return undefined;
  return products.find((p) => p.active && p.sku.trim().toLowerCase() === n);
}
