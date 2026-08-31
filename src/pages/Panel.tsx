import { BookOpen, Plus, SignOut, Storefront } from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "../auth";
import { Modal } from "../components/Modal";
import { StoreEditModal } from "../components/StoreEditModal";
import { getDb, isFirebaseConfigured } from "../lib/firebase";
import { firebaseMessage } from "../lib/firebaseErrors";
import { money } from "../lib/format";
import type { Profile, Sale, StoreRecord } from "../types";

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
  const {
    profile,
    signOut,
    setSelectedStoreId,
    createStore,
    updateStore,
    addCashier,
    removeCashier,
    deleteStore,
  } = useAuth();
  const navigate = useNavigate();
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const db = getDb();
    if (!db || !profile) return;
    const unsubStores = onSnapshot(
      query(collection(db, "stores"), where("businessId", "==", profile.businessId)),
      (snap) =>
        setStores(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<StoreRecord, "id">) }))
            .filter((store) => !store.deleted),
        ),
    );
    const unsubSales = onSnapshot(
      query(collection(db, "sales"), where("businessId", "==", profile.businessId)),
      (snap) =>
        setSales(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, "id">) }))),
    );
    const unsubPeople = onSnapshot(
      query(collection(db, "profiles"), where("businessId", "==", profile.businessId)),
      (snap) =>
        setPeople(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Profile, "uid">) }))),
    );
    return () => {
      unsubStores();
      unsubSales();
      unsubPeople();
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
      await createStore({ name });
      setName("");
      setCreating(false);
    } catch (err) {
      setError(firebaseMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const editingStore = stores.find((s) => s.id === editingId) ?? null;

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-6 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Dueño</p>
          <h1 className="font-display truncate text-xl font-bold">Resumen de locales</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-bold text-on-primary"
          >
            <Plus size={16} weight="bold" />
            Nuevo local
          </button>
          <Link
            to="/panel/catalogo"
            className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-muted px-3 text-sm font-bold"
          >
            <BookOpen size={16} />
            Catálogo
          </Link>
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
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Hoy" value={money(totals.today)} />
          <SummaryCard label="Últimos 7 días" value={money(totals.week)} />
          <SummaryCard label="Este mes" value={money(totals.month)} />
        </section>

        <section className="overflow-hidden rounded-2xl bg-card">
          {stores.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Todavía no hay locales. Tocá <strong>Nuevo local</strong> arriba a la derecha.
            </p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-semibold">Local</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Hoy</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Semana</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Mes</th>
                </tr>
              </thead>
              <tbody>
                {[...stores]
                  .sort((a, b) => a.name.localeCompare(b.name, "es"))
                  .map((store) => {
                    const storeSales = sales.filter((s) => s.storeId === store.id);
                    const cashiers = people.filter(
                      (p) => p.role === "cashier" && p.storeId === store.id && !p.disabled,
                    );
                    return (
                      <tr
                        key={store.id}
                        tabIndex={0}
                        className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/70"
                        onClick={() => setEditingId(store.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setEditingId(store.id);
                          }
                        }}
                      >
                        <td className="px-5 py-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <Storefront size={20} className="mt-0.5 shrink-0 text-primary" />
                            <div className="min-w-0">
                              <p className="font-display font-bold">{store.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {cashiers.length === 0
                                  ? "Sin cajeros"
                                  : cashiers.map((p) => p.name).join(", ")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-display font-bold tabular">
                          {money(sumSales(storeSales, today, tomorrow))}
                        </td>
                        <td className="px-3 py-3 text-right font-display font-bold tabular">
                          {money(sumSales(storeSales, week, tomorrow))}
                        </td>
                        <td className="px-5 py-3 text-right font-display font-bold tabular">
                          {money(sumSales(storeSales, month, tomorrow))}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </section>
        <p className="text-center text-xs text-muted-foreground">
          Tocá un local para editarlo, cargar usuarios o abrir la caja.
        </p>
      </main>

      <Modal open={creating} title="Nuevo local" onClose={() => setCreating(false)}>
        <form onSubmit={addStore} className="space-y-3">
          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}
          <label className="block text-sm font-semibold">
            Nombre
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field-input mt-1"
              required
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Usa el catálogo general del negocio. Los cajeros se agregan después, tocando el local.
          </p>
          <button
            type="submit"
            disabled={busy || !isFirebaseConfigured()}
            className="focus-ring min-h-10 w-full rounded-xl bg-primary text-sm font-bold text-on-primary"
          >
            {busy ? "Creando…" : "Crear local"}
          </button>
        </form>
      </Modal>

      {editingStore ? (
        <StoreEditModal
          key={editingStore.id}
          store={editingStore}
          cashiers={people.filter(
            (p) => p.role === "cashier" && p.storeId === editingStore.id && !p.disabled,
          )}
          onClose={() => setEditingId(null)}
          onSaveName={(nextName) => updateStore(editingStore.id, { name: nextName })}
          onOpenCaja={() => {
            setSelectedStoreId(editingStore.id);
            navigate("/caja");
          }}
          onAddCashier={(input) => addCashier({ storeId: editingStore.id, ...input })}
          onRemoveCashier={removeCashier}
          onDeleteStore={(password) => deleteStore(editingStore.id, password)}
        />
      ) : null}
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
