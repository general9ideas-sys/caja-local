import type { Sale } from "../types";

export type PeriodProfit = {
  salesCents: number;
  profitCents: number;
  missingQty: number;
};

export function periodProfit(
  sales: Sale[],
  from: Date,
  to: Date,
  costs: Map<string, number>,
): PeriodProfit {
  const a = from.toISOString();
  const b = to.toISOString();
  let salesCents = 0;
  let profitCents = 0;
  let missingQty = 0;
  for (const sale of sales) {
    if (sale.cancelled || sale.createdAt < a || sale.createdAt >= b) continue;
    salesCents += sale.totalCents;
    for (const line of sale.lines) {
      const cost = costs.get(line.productId);
      if (cost == null) {
        missingQty += line.qty;
        continue;
      }
      profitCents += line.qty * (line.unitPriceCents - cost);
    }
  }
  return { salesCents, profitCents, missingQty };
}
