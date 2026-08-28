export function uid(): string {
  return crypto.randomUUID();
}

export function money(cents: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function moneyPlain(cents: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Parsea montos en formato AR (1.500,50) o simple (1500.50 / 1500,50). */
export function parseMoneyToCents(raw: string): number | null {
  const t = raw.trim().replace(/\$/g, "").replace(/\s/g, "");
  if (!t) return null;
  let normalized = t;
  if (t.includes(",") && t.includes(".")) {
    normalized = t.replace(/\./g, "").replace(",", ".");
  } else if (t.includes(",")) {
    normalized = t.replace(",", ".");
  }
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSameDay(iso: string, date = new Date()): boolean {
  return iso.slice(0, 10) === todayKey(date);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function lineTotal(qty: number, unitPriceCents: number): number {
  return qty * unitPriceCents;
}

export function cartTotal(lines: { qty: number; unitPriceCents: number }[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line.qty, line.unitPriceCents), 0);
}

export const METHOD_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};
