export type PaymentMethod = "efectivo" | "tarjeta" | "transferencia";

export type PageId = "vender" | "productos" | "caja" | "ventas";

export type CatalogMode = "shared" | "own";

export type UserRole = "owner" | "cashier";

export interface Product {
  id: string;
  name: string;
  priceCents: number;
  category: string;
  stock: number;
  sku: string;
  active: boolean;
  visibleOnline: boolean;
  shared: boolean;
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
  storeId?: string;
  businessId?: string;
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
  storeId?: string;
  businessId?: string;
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

export interface Profile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string;
  storeId?: string;
  disabled?: boolean;
}

export interface Business {
  id: string;
  name: string;
  ownerId: string;
}

export interface StoreRecord {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  catalogMode: CatalogMode;
  nextTicket: number;
  catalogId?: string;
  deleted?: boolean;
}
