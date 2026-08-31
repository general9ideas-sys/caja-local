import { Barcode, MagnifyingGlass, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { ProductForm } from "../components/ProductForm";
import { findByBarcode } from "../lib/barcode";
import { money } from "../lib/format";
import { useStore } from "../store";
import type { Product } from "../types";

export function ProductosPage() {
  const { state, upsertProduct, removeProduct, catalogMode } = useStore();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null | "new">(null);
  const [initialSku, setInitialSku] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const products = state.products.filter((p) => p.active);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [products, query]);

  function onScanned(code: string) {
    setScanOpen(false);
    const found = findByBarcode(products, code);
    if (found) {
      setInitialSku("");
      setEditing(found);
      return;
    }
    setInitialSku(code);
    setEditing("new");
  }

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto p-4 pb-8 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Buscar productos</span>
          <MagnifyingGlass
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nombre, código o rubro"
            className="focus-ring min-h-10 w-full rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="focus-ring inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-muted px-4 text-sm font-bold sm:flex-none"
          >
            <Barcode size={18} aria-hidden="true" />
            Escanear
          </button>
          <button
            type="button"
            onClick={() => {
              setInitialSku("");
              setEditing("new");
            }}
            className="focus-ring inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-display text-sm font-bold text-on-primary hover:bg-primary-dark sm:flex-none"
          >
            <Plus size={18} aria-hidden="true" />
            Nuevo
          </button>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-3xl bg-card">
        {filtered.map((product) => (
          <li key={product.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-semibold">{product.name}</p>
              <p className="text-xs text-muted-foreground">
                {product.category}
                {product.sku ? ` · ${product.sku}` : ""} · Stock {product.stock}
                {product.visibleOnline ? " · Catálogo web" : ""}
              </p>
            </div>
            <p className="font-display text-sm font-bold tabular">{money(product.priceCents)}</p>
            <button
              type="button"
              onClick={() => {
                setInitialSku("");
                setEditing(product);
              }}
              className="focus-ring inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted"
              aria-label={`Editar ${product.name}`}
            >
              <PencilSimple size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => removeProduct(product.id)}
              className="focus-ring inline-flex size-9 items-center justify-center rounded-lg text-destructive hover:bg-red-50"
              aria-label={`Quitar ${product.name}`}
            >
              <Trash size={18} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {filtered.length === 0 ? (
        <p className="mt-6 text-center text-muted-foreground">No hay productos para mostrar.</p>
      ) : null}

      <ProductForm
        key={
          editing === "new"
            ? `new-${initialSku}`
            : editing?.id ?? "closed"
        }
        open={editing !== null}
        product={editing === "new" || editing === null ? null : editing}
        initialSku={initialSku}
        catalogMode={catalogMode}
        onClose={() => setEditing(null)}
        onSave={(product) => {
          upsertProduct(product);
          setEditing(null);
        }}
      />

      <BarcodeScanner
        open={scanOpen}
        title="Escanear para registrar"
        hint="Poné el código en el recuadro. Tocá la pantalla si no enfoca."
        onClose={() => setScanOpen(false)}
        onDetected={onScanned}
      />
    </div>
  );
}
