export function salePriceFromCost(costCents: number, markupPercent: number): number {
  if (!Number.isFinite(costCents) || costCents < 0) return 0;
  if (!Number.isFinite(markupPercent)) return costCents;
  return Math.round((costCents * (100 + markupPercent)) / 100);
}

export function parsePercent(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 1000) return null;
  return n;
}

export function centsToPriceInput(cents: number): string {
  if (cents % 100 === 0) return String(cents / 100);
  return (cents / 100).toFixed(2).replace(".", ",");
}
