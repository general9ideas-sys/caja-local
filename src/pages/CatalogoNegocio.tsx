import { Barcode, PencilSimple, Percent, Plus, SignOut, Trash } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useAuth } from "../auth";
import { ProductForm } from "../components/ProductForm";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { Modal } from "../components/Modal";
import { GENERIC_CATALOGS } from "../data/catalogs";
import { catalogDocId, findByBarcode } from "../lib/barcode";
import { getDb } from "../lib/firebase";
import { firebaseMessage } from "../lib/firebaseErrors";
import { money, uid } from "../lib/format";
import { publishMasterProduct, saveProductCost } from "../lib/masterCatalog";
import { parsePercent, salePriceFromCost } from "../lib/pricing";
import type { Product } from "../types";

export function CatalogoNegocioPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [costs, setCosts] = useState<Map<string, { costCents: number; markupPercent?: number }>>(
    new Map(),
  );
  const [editing, setEditing] = useState<Product | null | "new">(null);
  const [initialSku, setInitialSku] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [markupOpen, setMarkupOpen] = useState(false);
  const [markup, setMarkup] = useState("20");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const db = getDb();
    if (!db || !profile) return;
    const unsubProducts = onSnapshot(
      query(collection(db, "products"), where("businessId", "==", profile.businessId)),
      (snap) => {
        setProducts(
          snap.docs
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                name: data.name as string,
                priceCents: Number(data.priceCents) || 0,
                category: (data.category as string) || "Otros",
                stock: 0,
                sku: (data.sku as string) || "",
                active: data.active !== false,
                visibleOnline: Boolean(data.visibleOnline),
                shared: true,
              } satisfies Product;
            })
            .filter((p) => p.active),
        );
      },
    );
    const unsubCosts = onSnapshot(
      query(collection(db, "productCosts"), where("businessId", "==", profile.businessId)),
      (snap) => {
        setCosts(
          new Map(
            snap.docs
              .map((d) => {
                const costCents = Number(d.data().costCents) || 0;
                const raw = d.data().markupPercent;
                const markupPercent =
                  typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
                return [d.id, { costCents, markupPercent }] as const;
              })
              .filter(([, info]) => info.costCents > 0),
          ),
        );
      },
    );
    return () => {
      unsubProducts();
      unsubCosts();
    };
  }, [profile]);

  const withCost = useMemo(
    () =>
      products.map((p) => {
        const info = costs.get(p.id);
        return {
          ...p,
          costCents: info?.costCents,
          markupPercent: info?.markupPercent,
        };
      }),
    [products, costs],
  );

  const sorted = useMemo(
    () => [...withCost].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [withCost],
  );

  const pricedFromCost = sorted.filter((p) => (p.costCents ?? 0) > 0).length;

  async function saveProduct(product: Product) {
    const db = getDb();
    if (!db || !profile) return;
    const id =
      product.id && products.some((p) => p.id === product.id)
        ? product.id
        : catalogDocId(profile.businessId, product.sku, product.id || uid());
    await setDoc(
      doc(db, "products", id),
      {
        businessId: profile.businessId,
        storeId: null,
        name: product.name,
        priceCents: product.priceCents,
        category: product.category,
        sku: product.sku,
        active: true,
        visibleOnline: product.visibleOnline,
      },
      { merge: true },
    );
    await saveProductCost(id, profile.businessId, product.costCents, product.markupPercent);
    await publishMasterProduct(product.sku, product.name, product.category);
    setEditing(null);
  }

  async function removeProduct(id: string) {
    const db = getDb();
    if (!db) return;
    await updateDoc(doc(db, "products", id), { active: false });
  }

  async function applyMarkupToAll() {
    const db = getDb();
    if (!db || !profile) return;
    const percent = parsePercent(markup);
    if (percent == null) {
      setError("Ingresá un recargo válido, por ejemplo 20.");
      return;
    }
    const targets = sorted.filter((p) => (p.costCents ?? 0) > 0);
    if (targets.length === 0) {
      setError("Ningún producto tiene costo. Cargá el costo y después aplicá el recargo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (let i = 0; i < targets.length; i += 200) {
        const batch = writeBatch(db);
        for (const product of targets.slice(i, i + 200)) {
          batch.set(
            doc(db, "products", product.id),
            { priceCents: salePriceFromCost(product.costCents ?? 0, percent) },
            { merge: true },
          );
          batch.set(
            doc(db, "productCosts", product.id),
            {
              businessId: profile.businessId,
              costCents: product.costCents,
              markupPercent: percent,
            },
            { merge: true },
          );
        }
        await batch.commit();
      }
      setMarkupOpen(false);
    } catch (err) {
      setError(firebaseMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function loadTemplate(catalogId: string) {
    const db = getDb();
    if (!db || !profile) return;
    const catalog = GENERIC_CATALOGS.find((item) => item.id === catalogId);
    if (!catalog || catalog.items.length === 0) return;
    setBusy(true);
    setError("");
    try {
      for (const item of catalog.items) {
        const id = `${profile.businessId}_${item.sku}`;
        await setDoc(
          doc(db, "products", id),
          {
            businessId: profile.businessId,
            storeId: null,
            name: item.name,
            priceCents: item.priceCents,
            category: item.category,
            sku: item.sku,
            active: true,
            visibleOnline: false,
          },
          { merge: true },
        );
      }
    } catch (err) {
      setError(firebaseMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-6 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Dueño</p>
          <h1 className="font-display truncate text-xl font-bold">Catálogo</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/panel"
            className="focus-ring inline-flex min-h-9 items-center rounded-xl bg-muted px-3 text-sm font-bold"
          >
            Locales
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

      <main className="mx-auto max-w-3xl space-y-5 p-6">
        <p className="text-sm text-muted-foreground">
          Un solo listado para todos los locales. El precio y el costo son del negocio; el stock lo
          carga cada caja. Si otro comercio ya escaneó el mismo código, el nombre aparece solo.
        </p>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setMarkupOpen(true)}
            className="focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-muted px-4 text-sm font-bold"
          >
            <Percent size={16} />
            Recargo a todos
          </button>
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-muted px-4 text-sm font-bold"
          >
            <Barcode size={16} />
            Escanear
          </button>
          <button
            type="button"
            onClick={() => {
              setInitialSku("");
              setEditing("new");
            }}
            className="focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary"
          >
            <Plus size={16} weight="bold" />
            Nuevo producto
          </button>
        </div>

        <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
          {sorted.map((product) => (
            <li key={product.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-semibold">{product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {product.category}
                  {product.sku ? ` · ${product.sku}` : ""}
                  {product.costCents
                    ? ` · Costo ${money(product.costCents)}`
                    : " · Sin costo"}
                  {product.markupPercent != null ? ` · +${product.markupPercent}%` : ""}
                  {product.visibleOnline ? " · Online" : ""}
                </p>
              </div>
              <p className="font-display text-sm font-bold tabular">{money(product.priceCents)}</p>
              <button
                type="button"
                onClick={() => setEditing(product)}
                className="focus-ring inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted"
                aria-label={`Editar ${product.name}`}
              >
                <PencilSimple size={18} />
              </button>
              <button
                type="button"
                onClick={() => void removeProduct(product.id)}
                className="focus-ring inline-flex size-9 items-center justify-center rounded-lg text-destructive hover:bg-red-50"
                aria-label={`Quitar ${product.name}`}
              >
                <Trash size={18} />
              </button>
            </li>
          ))}
        </ul>
        {sorted.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Todavía no hay productos. Cargá uno o empezá con una plantilla.
          </p>
        ) : null}

        <section className="rounded-2xl bg-card p-4">
          <h2 className="font-display text-sm font-semibold">Empezar con una plantilla</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Opcional. Suma productos de ejemplo; no borra los que ya cargaste.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {GENERIC_CATALOGS.filter((c) => c.items.length > 0).map((catalog) => (
              <button
                key={catalog.id}
                type="button"
                disabled={busy}
                onClick={() => void loadTemplate(catalog.id)}
                className="focus-ring rounded-xl bg-muted px-3 py-1.5 text-sm font-bold"
              >
                {catalog.name}
              </button>
            ))}
          </div>
        </section>
      </main>

      <ProductForm
        key={editing === "new" ? `new-${initialSku}` : editing?.id ?? "closed"}
        open={editing !== null}
        product={editing === "new" ? null : editing}
        initialSku={initialSku}
        onClose={() => setEditing(null)}
        onSave={(product) => void saveProduct(product)}
        variant="business"
      />
      <BarcodeScanner
        open={scanOpen}
        title="Escanear para el catálogo"
        hint="Poné el código en el recuadro. Tocá la pantalla si no enfoca."
        onClose={() => setScanOpen(false)}
        onDetected={(code) => {
          setScanOpen(false);
          const found = findByBarcode(products, code);
          if (found) {
            setInitialSku("");
            setEditing({
              ...found,
              costCents: costs.get(found.id)?.costCents,
              markupPercent: costs.get(found.id)?.markupPercent,
            });
            return;
          }
          setInitialSku(code);
          setEditing("new");
        }}
      />
      <Modal open={markupOpen} title="Recargo sobre el costo" onClose={() => setMarkupOpen(false)}>
        <p className="text-sm text-muted-foreground">
          Pone el precio de venta de todos los productos que tengan costo. Hoy hay {pricedFromCost}{" "}
          con costo cargado.
        </p>
        <label className="mt-4 block text-sm font-semibold">
          Porcentaje
          <div className="mt-1 flex items-center gap-2">
            <input
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
              inputMode="decimal"
              className="field-input"
              placeholder="20"
            />
            <span className="text-sm font-semibold text-muted-foreground">%</span>
          </div>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void applyMarkupToAll()}
          className="focus-ring mt-4 min-h-10 w-full rounded-xl bg-primary text-sm font-bold text-on-primary"
        >
          {busy ? "Aplicando…" : "Aplicar a todos"}
        </button>
      </Modal>
    </div>
  );
}
