import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import {
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useAuth } from "./auth";
import { seedProducts } from "./data/seed";
import { catalogDocId } from "./lib/barcode";
import { getDb } from "./lib/firebase";
import { cartTotal, uid } from "./lib/format";
import type {
  AppState,
  CartLine,
  CashSession,
  CatalogMode,
  Payment,
  Product,
  Sale,
  Settings,
  StoreRecord,
} from "./types";

const STORAGE_KEY = "caja-local-v1";

function normalizeProduct(p: Product): Product {
  return {
    ...p,
    visibleOnline: Boolean(p.visibleOnline),
    shared: p.shared !== false,
  };
}

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
      products: parsed.products.map(normalizeProduct),
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
  | { type: "reset" }
  | { type: "hydrate"; state: AppState };

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
    case "hydrate":
      return action.state;
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

export interface StoreApi {
  state: AppState;
  ready: boolean;
  cloud: boolean;
  store: StoreRecord | null;
  stores: StoreRecord[];
  catalogMode: CatalogMode;
  openCash: (openingCashCents: number) => void | Promise<void>;
  closeCash: (countedCashCents: number, notes: string) => void | Promise<void>;
  upsertProduct: (product: Product) => Product;
  removeProduct: (id: string) => void;
  completeSale: (
    lines: CartLine[],
    payments: Payment[],
    cashReceivedCents: number,
    changeCents: number,
  ) => Sale | null;
  cancelSale: (id: string) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  updateCatalogMode: (mode: CatalogMode) => void;
  resetDemo: () => void;
  importLocalData: () => Promise<void>;
}

const StoreContext = createContext<StoreApi | null>(null);

function inventoryId(storeId: string, productId: string) {
  return `${storeId}_${productId}`;
}

function LocalStoreProvider({ children }: { children: ReactNode }) {
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
      ready: true,
      cloud: false,
      store: null,
      stores: [],
      catalogMode: "own",
      openCash: (openingCashCents) => dispatch({ type: "open-cash", openingCashCents }),
      closeCash: (countedCashCents, notes) =>
        dispatch({ type: "close-cash", countedCashCents, notes }),
      upsertProduct: (product) => {
        const next = { ...product, shared: true };
        dispatch({ type: "upsert-product", product: next });
        return next;
      },
      removeProduct: (id) => dispatch({ type: "remove-product", id }),
      completeSale,
      cancelSale: (id) => dispatch({ type: "cancel-sale", id }),
      updateSettings: (settings) => dispatch({ type: "update-settings", settings }),
      updateCatalogMode: () => undefined,
      resetDemo: () => dispatch({ type: "reset" }),
      importLocalData: async () => undefined,
    }),
    [state, completeSale],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

function CloudStoreProvider({ children }: { children: ReactNode }) {
  const { profile, selectedStoreId } = useAuth();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [ready, setReady] = useState(false);
  const storeId = selectedStoreId;
  const businessId = profile?.businessId;
  const store = stores.find((s) => s.id === storeId) ?? null;

  useEffect(() => {
    const db = getDb();
    if (!db || !businessId) {
      setReady(true);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, "stores"), where("businessId", "==", businessId)),
      (snap) => {
        setStores(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<StoreRecord, "id">) }))
            .filter((store) => !store.deleted),
        );
      },
    );
    return () => unsub();
  }, [businessId]);

  useEffect(() => {
    const db = getDb();
    if (!db || !businessId || !storeId) {
      dispatch({
        type: "hydrate",
        state: {
          products: [],
          sales: [],
          sessions: [],
          settings: { storeName: "Local" },
          nextTicket: 1,
        },
      });
      setReady(true);
      return;
    }

    let products: Product[] = [];
    let inventory = new Map<string, number>();
    let sales: Sale[] = [];
    let sessions: CashSession[] = [];
    let storeName = "Local";
    let nextTicket = 1;

    const flush = () => {
      const current = stores.find((s) => s.id === storeId);
      dispatch({
        type: "hydrate",
        state: {
          products: products.map((p) => ({
            ...p,
            shared: true,
            stock: inventory.get(p.id) ?? 0,
          })),
          sales,
          sessions,
          settings: { storeName: current?.name ?? storeName },
          nextTicket: current?.nextTicket ?? nextTicket,
        },
      });
      setReady(true);
    };

    const unsubProducts = onSnapshot(
      query(collection(db, "products"), where("businessId", "==", businessId)),
      (snap) => {
        products = snap.docs.map((d) => {
          const data = d.data();
          return normalizeProduct({
            id: d.id,
            name: data.name,
            priceCents: data.priceCents,
            category: data.category,
            stock: 0,
            sku: data.sku ?? "",
            active: data.active !== false,
            visibleOnline: Boolean(data.visibleOnline),
            shared: true,
          });
        });
        flush();
      },
    );
    const unsubInv = onSnapshot(
      query(collection(db, "inventory"), where("businessId", "==", businessId)),
      (snap) => {
        inventory = new Map(
          snap.docs
            .filter((d) => d.data().storeId === storeId)
            .map((d) => [d.data().productId as string, Number(d.data().stock) || 0]),
        );
        flush();
      },
    );
    const unsubSales = onSnapshot(
      query(collection(db, "sales"), where("businessId", "==", businessId)),
      (snap) => {
        sales = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, "id">) }))
          .filter((s) => s.storeId === storeId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        flush();
      },
    );
    const unsubSessions = onSnapshot(
      query(collection(db, "sessions"), where("businessId", "==", businessId)),
      (snap) => {
        sessions = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CashSession, "id">),
          }))
          .filter((s) => s.storeId === storeId);
        flush();
      },
    );

    return () => {
      unsubProducts();
      unsubInv();
      unsubSales();
      unsubSessions();
    };
  }, [businessId, storeId, stores]);

  const completeSale = useCallback(
    (
      lines: CartLine[],
      payments: Payment[],
      cashReceivedCents: number,
      changeCents: number,
    ): Sale | null => {
      const session = openSession(state);
      const db = getDb();
      if (!session || !db || !storeId || !businessId || !lines.length) return null;
      const sale: Sale = {
        id: uid(),
        ticket: state.nextTicket,
        createdAt: new Date().toISOString(),
        sessionId: session.id,
        storeId,
        businessId,
        lines,
        payments,
        totalCents: cartTotal(lines),
        cashReceivedCents,
        changeCents,
        cancelled: false,
      };
      const batch = writeBatch(db);
      const { id, ...saleData } = sale;
      batch.set(doc(db, "sales", id), saleData);
      for (const line of lines) {
        const currentStock = state.products.find((p) => p.id === line.productId)?.stock ?? 0;
        batch.set(
          doc(db, "inventory", inventoryId(storeId, line.productId)),
          {
            storeId,
            productId: line.productId,
            businessId,
            stock: currentStock - line.qty,
          },
          { merge: true },
        );
      }
      batch.update(doc(db, "stores", storeId), { nextTicket: increment(1) });
      void batch.commit();
      return sale;
    },
    [state, storeId, businessId],
  );

  const api = useMemo<StoreApi>(
    () => ({
      state,
      ready,
      cloud: true,
      store,
      stores,
      catalogMode: store?.catalogMode ?? "shared",
      openCash: async (openingCashCents) => {
        const db = getDb();
        if (!db || !storeId || !businessId) {
          throw new Error("No hay un local seleccionado.");
        }
        if (openSession(state)) return;
        const id = uid();
        const openedAt = new Date().toISOString();
        await setDoc(doc(db, "sessions", id), {
          openedAt,
          openingCashCents,
          notes: "",
          status: "open",
          storeId,
          businessId,
        });
        dispatch({
          type: "hydrate",
          state: {
            ...state,
            sessions: [
              ...state.sessions,
              {
                id,
                openedAt,
                openingCashCents,
                notes: "",
                status: "open",
                storeId,
                businessId,
              },
            ],
          },
        });
      },
      closeCash: async (countedCashCents, notes) => {
        const db = getDb();
        const current = openSession(state);
        if (!db || !current) {
          throw new Error("No hay una caja abierta.");
        }
        await updateDoc(doc(db, "sessions", current.id), {
          status: "closed",
          closedAt: new Date().toISOString(),
          countedCashCents,
          notes,
        });
      },
      upsertProduct: (product) => {
        const db = getDb();
        if (!db || !businessId || !storeId) return product;
        const id = catalogDocId(businessId, product.sku, product.id);
        const next: Product = { ...product, id, shared: true };
        void setDoc(
          doc(db, "products", id),
          {
            businessId,
            storeId: null,
            name: next.name,
            priceCents: next.priceCents,
            category: next.category,
            sku: next.sku,
            active: next.active,
            visibleOnline: next.visibleOnline,
          },
          { merge: true },
        );
        void setDoc(
          doc(db, "inventory", inventoryId(storeId, id)),
          {
            storeId,
            productId: id,
            businessId,
            stock: next.stock,
          },
          { merge: true },
        );
        return next;
      },
      removeProduct: (id) => {
        const db = getDb();
        if (!db) return;
        void updateDoc(doc(db, "products", id), { active: false });
      },
      completeSale,
      cancelSale: (id) => {
        const db = getDb();
        const sale = state.sales.find((s) => s.id === id && !s.cancelled);
        if (!db || !sale || !storeId || !businessId) return;
        const batch = writeBatch(db);
        batch.update(doc(db, "sales", id), { cancelled: true });
        for (const line of sale.lines) {
          batch.set(
            doc(db, "inventory", inventoryId(storeId, line.productId)),
            {
              storeId,
              productId: line.productId,
              businessId,
              stock: increment(line.qty),
            },
            { merge: true },
          );
        }
        void batch.commit();
      },
      updateSettings: (settings) => {
        const db = getDb();
        if (!db || !storeId || !settings.storeName) return;
        void updateDoc(doc(db, "stores", storeId), { name: settings.storeName });
      },
      updateCatalogMode: (mode) => {
        const db = getDb();
        if (!db || !storeId) return;
        void updateDoc(doc(db, "stores", storeId), { catalogMode: mode });
      },
      resetDemo: () => undefined,
      importLocalData: async () => {
        const db = getDb();
        if (!db || !storeId || !businessId) return;
        const local = loadState();
        const batch = writeBatch(db);
        for (const product of local.products) {
          batch.set(doc(db, "products", product.id), {
            businessId,
            storeId: product.shared ? null : storeId,
            name: product.name,
            priceCents: product.priceCents,
            category: product.category,
            sku: product.sku,
            active: product.active,
            visibleOnline: product.visibleOnline,
          });
          batch.set(doc(db, "inventory", inventoryId(storeId, product.id)), {
            storeId,
            productId: product.id,
            businessId,
            stock: product.stock,
          });
        }
        for (const session of local.sessions) {
          batch.set(doc(db, "sessions", session.id), {
            ...session,
            storeId,
            businessId,
          });
        }
        for (const sale of local.sales) {
          const { id, ...data } = sale;
          batch.set(doc(db, "sales", id), { ...data, storeId, businessId });
        }
        await batch.commit();
      },
    }),
    [state, ready, store, stores, completeSale, storeId, businessId],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { cloud, profile } = useAuth();
  if (cloud && profile) return <CloudStoreProvider>{children}</CloudStoreProvider>;
  return <LocalStoreProvider>{children}</LocalStoreProvider>;
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

export async function fetchPublicCatalog(slug: string) {
  const db = getDb();
  if (!db) {
    const local = loadState();
    return {
      storeName: local.settings.storeName,
      products: local.products.filter((p) => p.active && p.visibleOnline),
    };
  }
  const stores = await getDocs(query(collection(db, "stores"), where("slug", "==", slug)));
  const storeDoc = stores.docs[0];
  if (!storeDoc) return null;
  const store = storeDoc.data() as Omit<StoreRecord, "id">;
  if (store.deleted) return null;
  const productsSnap = await getDocs(
    query(
      collection(db, "products"),
      where("businessId", "==", store.businessId),
      where("visibleOnline", "==", true),
    ),
  );
  const products = productsSnap.docs
    .map((d) => {
      const data = d.data();
      if (data.active === false) return null;
      return normalizeProduct({
        id: d.id,
        name: data.name,
        priceCents: data.priceCents,
        category: data.category,
        stock: 0,
        sku: data.sku ?? "",
        active: true,
        visibleOnline: true,
        shared: true,
      });
    })
    .filter((p): p is Product => Boolean(p));
  return { storeName: store.name, products };
}

export { loadState };
