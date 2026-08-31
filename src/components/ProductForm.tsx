import { Barcode } from "@phosphor-icons/react";
import { useId, useState, type ReactNode } from "react";
import { DEFAULT_CATEGORIES } from "../data/seed";
import { parseMoneyToCents, uid } from "../lib/format";
import type { Product } from "../types";
import { BarcodeScanner } from "./BarcodeScanner";
import { Modal } from "./Modal";

export function ProductForm({
  open,
  product,
  initialSku = "",
  onClose,
  onSave,
  catalogMode = "own",
  variant = "pos",
}: {
  open: boolean;
  product: Product | null;
  initialSku?: string;
  onClose: () => void;
  onSave: (product: Product) => void;
  catalogMode?: "shared" | "own";
  variant?: "pos" | "business";
}) {
  const nameId = useId();
  const priceId = useId();
  const catId = useId();
  const stockId = useId();
  const skuId = useId();
  const errorId = useId();
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product ? String(product.priceCents / 100) : "");
  const [category, setCategory] = useState(product?.category ?? "Otros");
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [sku, setSku] = useState(product?.sku || initialSku);
  const [visibleOnline, setVisibleOnline] = useState(product?.visibleOnline ?? false);
  const [shared, setShared] = useState(product?.shared ?? catalogMode === "shared");
  const [error, setError] = useState("");
  const [scanOpen, setScanOpen] = useState(false);

  return (
    <>
      <Modal
        open={open}
        title={product ? "Editar producto" : "Nuevo producto"}
        onClose={onClose}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const priceCents = parseMoneyToCents(price);
            const stockN = Number(stock);
            if (!name.trim()) {
              setError("El nombre es obligatorio.");
              return;
            }
            if (priceCents === null || priceCents <= 0) {
              setError("Ingresá un precio mayor a cero.");
              return;
            }
            if (variant !== "business" && (!Number.isInteger(stockN) || stockN < 0)) {
              setError("El stock tiene que ser un número entero de 0 o más.");
              return;
            }
            onSave({
              id: product?.id ?? uid(),
              name: name.trim(),
              priceCents,
              category: category.trim() || "Otros",
              stock: variant === "business" ? 0 : stockN,
              sku: sku.trim(),
              active: true,
              visibleOnline,
              shared: variant === "business" ? true : shared,
            });
          }}
        >
          {error ? (
            <div
              id={errorId}
              role="alert"
              tabIndex={-1}
              className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-destructive"
            >
              <p className="font-display font-semibold">Hay un problema</p>
              <p className="mt-1">{error}</p>
            </div>
          ) : null}

          <div>
            <label htmlFor={skuId} className="mb-1.5 block text-sm font-semibold">
              Código de barras
            </label>
            <div className="flex gap-2">
              <input
                id={skuId}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="field-input min-w-0 flex-1"
                placeholder="Escaneá o escribí el código"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="focus-ring inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted hover:bg-border"
                aria-label="Escanear código de barras"
              >
                <Barcode size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <Field id={nameId} label="Nombre">
            <input
              id={nameId}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              className="field-input"
              required
            />
          </Field>
          <Field id={priceId} label="Precio de venta">
            <input
              id={priceId}
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setError("");
              }}
              inputMode="decimal"
              className="field-input"
              placeholder="1500"
            />
          </Field>
          <Field id={catId} label="Rubro">
            <input
              id={catId}
              list="categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="field-input"
            />
            <datalist id="categories">
              {DEFAULT_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          {variant === "pos" ? (
            <Field id={stockId} label="Stock en este local">
              <input
                id={stockId}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                inputMode="numeric"
                className="field-input"
              />
            </Field>
          ) : null}
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={visibleOnline}
              onChange={(e) => setVisibleOnline(e.target.checked)}
            />
            Visible en el catálogo online
          </label>
          {variant === "pos" ? (
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={shared}
                onChange={(e) => setShared(e.target.checked)}
                disabled={Boolean(product?.shared)}
              />
              Compartir en todos los locales del negocio
            </label>
          ) : null}
          <button
            type="submit"
            className="focus-ring min-h-10 w-full rounded-xl bg-primary font-display text-sm font-bold text-on-primary hover:bg-primary-dark"
          >
            Guardar
          </button>
        </form>
      </Modal>

      <BarcodeScanner
        open={scanOpen}
        title="Escanear producto"
        hint="Poné el código en el recuadro. Tocá la pantalla si no enfoca."
        onClose={() => setScanOpen(false)}
        onDetected={(code) => {
          setSku(code);
          setScanOpen(false);
        }}
      />
    </>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}
