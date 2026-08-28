export type PaymentMethod = "efectivo" | "tarjeta" | "transferencia";

export type PageId = "vender" | "productos" | "caja" | "ventas";

export interface Product {
  id: string;
  name: string;
  priceCents: number;
  category: string;
  stock: number;
  sku: string;
  active: boolean;
}

export interface CartLine {
  productId: string;
  name: string;
  unitPriceCents: number;
  qty: number;
}

export interface Payment {
  method: PaymentMethod;
  amountCents: number;
}

export interface Sale {
  id: string;
  ticket: number;
  createdAt: string;
  sessionId: string;
  lines: CartLine[];
  payments: Payment[];
  totalCents: number;
  cashReceivedCents: number;
  changeCents: number;
  cancelled: boolean;
}

export interface CashSession {
  id: string;
  openedAt: string;
  closedAt?: string;
  openingCashCents: number;
  countedCashCents?: number;
  notes: string;
  status: "open" | "closed";
}

export interface Settings {
  storeName: string;
}

export interface AppState {
  products: Product[];
  sales: Sale[];
  sessions: CashSession[];
  settings: Settings;
  nextTicket: number;
}
