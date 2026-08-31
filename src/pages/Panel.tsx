import { SignOut, Storefront } from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "../auth";
import { getDb, isFirebaseConfigured } from "../lib/firebase";
import { money } from "../lib/format";
import type { CatalogMode, Sale, StoreRecord } from "../types";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sumSales(sales: Sale[], from: Date, to: Date) {
  const a = from.toISOString();
  const b = to.toISOString();
  return sales
    .filter((s) => !s.cancelled && s.createdAt >= a && s.createdAt < b)
    .reduce((sum, s) => sum + s.totalCents, 0);
}

export function PanelPage() {
  const { profile, signOut, setSelectedStoreId, createStore } = useAuth();
  const navigate = useNavigate();
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<CatalogMode>("shared");
  const [cashierEmail, setCashierEmail] = useState("");
  const [cashierPassword, setCashierPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const db = getDb();
    if (!db || !profile) return;
    const unsubStores = onSnapshot(
      query(collection(db, "stores"), where("businessId", "==", profile.businessId)),
      (snap) =>
        setStores(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoreRecord, "id">) }))),
    );
    const unsubSales = onSnapshot(
      query(collection(db, "sales"), where("businessId", "==", profile.businessId)),
      (snap) =>
        setSales(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, "id">) }))),
    );
    return () => {
      unsubStores();
      unsubSales();
    };
  }, [profile]);

  const today = startOfDay();
  const week = addDays(today, -6);
  const month = new Date(today.getFullYear(), today.getMonth(), 1);
  const tomorrow = addDays(today, 1);

  const totals = useMemo(() => {
    return {
      today: sumSales(sales, today, tomorrow),
      week: sumSales(sales, week, tomorrow),
      month: sumSales(sales, month, tomorrow),
    };
  }, [sales]);

  async function addStore(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createStore({
        name,
        catalogMode: mode,
        cashierEmail: cashierEmail || undefined,
        cashierPassword: cashierPassword || undefined,
      });
      setName("");
      setCashierEmail("");
      setCashierPassword("");
    } catch {
      setError("No se pudo crear el local. Si cargaste cajero, el correo no puede estar en uso.");
    } finally {
      setBusy(false);
    }
  }

  function openPos(storeId: string) {
    setSelectedStoreId(storeId);
    navigate("/caja");
  }

  const catalogBase = `${window.location.origin}${import.meta.env.BASE_URL}#/catalogo/`;

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Dueño</p>
          <h1 className="font-display text-xl font-bold">Resumen de locales</h1>
        </div>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate("/login");
          }}
          className="focus-ring inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted"
        >
          <SignOut size={16} />
          Salir
        </button>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Hoy" value={money(totals.today)} />
          <SummaryCard label="Últimos 7 días" value={money(totals.week)} />
          <SummaryCard label="Este mes" value={money(totals.month)} />
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          {stores.map((store) => {
            const storeSales = sales.filter((s) => s.storeId === store.id);
            return (
              <article key={store.id} className="rounded-2xl bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold">{store.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {store.catalogMode === "shared"
                        ? "Catálogo compartido"
                        : "Catálogo propio"}
                    </p>
                  </div>
                  <Storefront size={22} className="text-primary" />
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Hoy</dt>
                    <dd className="font-display font-bold tabular">
                      {money(sumSales(storeSales, today, tomorrow))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Semana</dt>
                    <dd className="font-display font-bold tabular">
                      {money(sumSales(storeSales, week, tomorrow))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Mes</dt>
                    <dd className="font-display font-bold tabular">
                      {money(sumSales(storeSales, month, tomorrow))}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openPos(store.id)}
                    className="focus-ring min-h-9 rounded-xl bg-primary px-3 text-sm font-bold text-on-primary"
                  >
                    Abrir caja
                  </button>
                  <a
                    href={`${catalogBase}${store.slug}`}
                    className="focus-ring inline-flex min-h-9 items-center rounded-xl bg-muted px-3 text-sm font-bold"
                  >
                    Ver catálogo
                  </a>
                </div>
              </article>
            );
          })}
        </section>

        <form onSubmit={addStore} className="rounded-2xl bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Nuevo local</h2>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Nombre
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field-input mt-1"
                required
              />
            </label>
            <label className="text-sm font-semibold">
              Catálogo
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as CatalogMode)}
                className="field-input mt-1"
              >
                <option value="shared">Compartido (mismo listado, stock propio)</option>
                <option value="own">Propio de este local</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Correo del cajero (opcional)
              <input
                type="email"
                value={cashierEmail}
                onChange={(e) => setCashierEmail(e.target.value)}
                className="field-input mt-1"
              />
            </label>
            <label className="text-sm font-semibold">
              Contraseña del cajero
              <input
                type="password"
                value={cashierPassword}
                onChange={(e) => setCashierPassword(e.target.value)}
                className="field-input mt-1"
                minLength={6}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy || !isFirebaseConfigured()}
            className="focus-ring mt-4 min-h-10 rounded-xl bg-foreground px-4 text-sm font-bold text-on-primary"
          >
            {busy ? "Creando…" : "Agregar local"}
          </button>
        </form>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display mt-1 text-2xl font-bold tabular">{value}</p>
    </div>
  );
}
