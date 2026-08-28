import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { seedProducts } from "./data/seed";
import { cartTotal, uid } from "./lib/format";
import type {
  AppState,
  CartLine,
  CashSession,
  Payment,
  Product,
  Sale,
  Settings,
} from "./types";

const STORAGE_KEY = "caja-local-v1";

const initialState = (): AppState => ({
  products: seedProducts(),
  sales: [],
  sessions: [],
  settings: { storeName: "Mi local" },
  nextTicket: 1,
});

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as AppState;
    if (!Array.isArray(parsed.products) || !Array.isArray(parsed.sales)) {
      return initialState();
    }
    return {
      ...initialState(),
      ...parsed,
      settings: { storeName: parsed.settings?.storeName || "Mi local" },
    };
  } catch {
    return initialState();
  }
}

type Action =
  | { type: "open-cash"; openingCashCents: number }
  | { type: "close-cash"; countedCashCents: number; notes: string }
  | { type: "upsert-product"; product: Product }
  | { type: "remove-product"; id: string }
  | {
      type: "complete-sale";
      lines: CartLine[];
      payments: Payment[];
      cashReceivedCents: number;
      changeCents: number;
    }
  | { type: "cancel-sale"; id: string }
  | { type: "update-settings"; settings: Partial<Settings> }
  | { type: "reset" };

function openSession(state: AppState): CashSession | undefined {
  return state.sessions.find((s) => s.status === "open");
}

function applyStock(products: Product[], lines: CartLine[], direction: 1 | -1): Product[] {
  const delta = new Map<string, number>();
  for (const line of lines) {
    delta.set(line.productId, (delta.get(line.productId) ?? 0) + line.qty * direction);
  }
  return products.map((p) => {
    const change = delta.get(p.id);
    if (!change) return p;
    return { ...p, stock: p.stock + change };
  });
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "open-cash": {
      if (openSession(state)) return state;
      const session: CashSession = {
        id: uid(),
        openedAt: new Date().toISOString(),
        openingCashCents: action.openingCashCents,
        notes: "",
        status: "open",
      };
      return { ...state, sessions: [...state.sessions, session] };
    }
    case "close-cash": {
      const current = openSession(state);
      if (!current) return state;
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === current.id
            ? {
                ...s,
                status: "closed" as const,
                closedAt: new Date().toISOString(),
                countedCashCents: action.countedCashCents,
                notes: action.notes,
              }
            : s,
        ),
      };
    }
    case "upsert-product": {
      const exists = state.products.some((p) => p.id === action.product.id);
      return {
        ...state,
        products: exists
          ? state.products.map((p) => (p.id === action.product.id ? action.product : p))
          : [...state.products, action.product],
      };
    }
    case "remove-product": {
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.id ? { ...p, active: false } : p,
        ),
      };
    }
    case "complete-sale": {
      const session = openSession(state);
      if (!session || action.lines.length === 0) return state;
      const totalCents = cartTotal(action.lines);
      const sale: Sale = {
        id: uid(),
        ticket: state.nextTicket,
        createdAt: new Date().toISOString(),
        sessionId: session.id,
        lines: action.lines,
        payments: action.payments,
        totalCents,
        cashReceivedCents: action.cashReceivedCents,
        changeCents: action.changeCents,
        cancelled: false,
      };
      return {
        ...state,
        nextTicket: state.nextTicket + 1,
        sales: [sale, ...state.sales],
        products: applyStock(state.products, action.lines, -1),
      };
    }
    case "cancel-sale": {
      const sale = state.sales.find((s) => s.id === action.id && !s.cancelled);
      if (!sale) return state;
      return {
        ...state,
        sales: state.sales.map((s) =>
          s.id === action.id ? { ...s, cancelled: true } : s,
        ),
        products: applyStock(state.products, sale.lines, 1),
      };
    }
    case "update-settings":
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case "reset":
      return initialState();
    default:
      return state;
  }
}

interface StoreApi {
  state: AppState;
  openCash: (openingCashCents: number) => void;
  closeCash: (countedCashCents: number, notes: string) => void;
  upsertProduct: (product: Product) => void;
  removeProduct: (id: string) => void;
  completeSale: (
    lines: CartLine[],
    payments: Payment[],
    cashReceivedCents: number,
    changeCents: number,
  ) => Sale | null;
  cancelSale: (id: string) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const completeSale = useCallback(
    (
      lines: CartLine[],
      payments: Payment[],
      cashReceivedCents: number,
      changeCents: number,
    ): Sale | null => {
      const session = openSession(state);
      if (!session) return null;
      const sale: Sale = {
        id: uid(),
        ticket: state.nextTicket,
        createdAt: new Date().toISOString(),
        sessionId: session.id,
        lines,
        payments,
        totalCents: cartTotal(lines),
        cashReceivedCents,
        changeCents,
        cancelled: false,
      };
      dispatch({
        type: "complete-sale",
        lines,
        payments,
        cashReceivedCents,
        changeCents,
      });
      return sale;
    },
    [state],
  );

  const api = useMemo<StoreApi>(
    () => ({
      state,
      openCash: (openingCashCents) => dispatch({ type: "open-cash", openingCashCents }),
      closeCash: (countedCashCents, notes) =>
        dispatch({ type: "close-cash", countedCashCents, notes }),
      upsertProduct: (product) => dispatch({ type: "upsert-product", product }),
      removeProduct: (id) => dispatch({ type: "remove-product", id }),
      completeSale,
      cancelSale: (id) => dispatch({ type: "cancel-sale", id }),
      updateSettings: (settings) => dispatch({ type: "update-settings", settings }),
      resetDemo: () => dispatch({ type: "reset" }),
    }),
    [state, completeSale],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function useOpenSession() {
  const { state } = useStore();
  return state.sessions.find((s) => s.status === "open") ?? null;
}

export function sessionSales(state: AppState, sessionId: string): Sale[] {
  return state.sales.filter((s) => s.sessionId === sessionId && !s.cancelled);
}

export function sumByMethod(sales: Sale[], method: Payment["method"]): number {
  return sales.reduce(
    (sum, sale) =>
      sum +
      sale.payments
        .filter((p) => p.method === method)
        .reduce((s, p) => s + p.amountCents, 0),
    0,
  );
}

export function expectedCashCents(session: CashSession, sales: Sale[]): number {
  return session.openingCashCents + sumByMethod(sales, "efectivo");
}
