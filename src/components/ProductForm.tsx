import { Barcode } from "@phosphor-icons/react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useAuth } from "../auth";
import { DEFAULT_CATEGORIES } from "../data/seed";
import { lookupMasterProduct } from "../lib/masterCatalog";
import { centsToPriceInput, parsePercent, salePriceFromCost } from "../lib/pricing";
import { money, parseMoneyToCents, uid } from "../lib/format";
import type { Product } from "../types";
import { BarcodeScanner } from "./BarcodeScanner";
import { Modal } from "./Modal";

export function ProductForm({
  open,
  product,
  initialSku = "",
  onClose,
  onSave,
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
  const { cloud, profile } = useAuth();
  const showCost = !cloud || profile?.role === "owner";
  const nameId = useId();
  const priceId = useId();
  const costId = useId();
  const markupId = useId();
  const catId = useId();
  const stockId = useId();
  const skuId = useId();
  const errorId = useId();
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product ? centsToPriceInput(product.priceCents) : "");
  const [cost, setCost] = useState(
    product?.costCents && product.costCents > 0 ? centsToPriceInput(product.costCents) : "",
  );
  const [markup, setMarkup] = useState(
    product?.markupPercent != null ? String(product.markupPercent) : "",
  );
  const [category, setCategory] = useState(product?.category ?? "Otros");
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [sku, setSku] = useState(product?.sku || initialSku);
  const [visibleOnline, setVisibleOnline] = useState(product?.visibleOnline ?? false);
  const [error, setError] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [masterHint, setMasterHint] = useState("");

  useEffect(() => {
    if (!open || product) return;
    const code = sku.trim();
    if (!code) {
      setMasterHint("");
      return;
    }
    let cancelled = false;
    void lookupMasterProduct(code).then((hit) => {
      if (cancelled || !hit) return;
      setName((current) => current.trim() || hit.name);
      setCategory((current) => (current && current !== "Otros" ? current : hit.category));
      setMasterHint(
        `Este código ya está en el catálogo maestro: ${hit.name}. Completá costo, stock y precio de venta.`,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, product, sku]);

  const markupPercent = parsePercent(markup);
  const costCentsValue = parseMoneyToCents(cost);
  const pricedFromMarkup =
    showCost &&
    costCentsValue != null &&
    costCentsValue > 0 &&
    markupPercent != null
      ? centsToPriceInput(salePriceFromCost(costCentsValue, markupPercent))
      : null;
  const priceShown = pricedFromMarkup ?? price;

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
            const priceCents = parseMoneyToCents(priceShown);
            const costCents = cost.trim() ? parseMoneyToCents(cost) : 0;
            const stockN = Number(stock);
            if (!name.trim()) {
              setError("El nombre es obligatorio.");
              return;
            }
            if (priceCents === null || priceCents <= 0) {
              setError("Ingresá un precio mayor a cero.");
              return;
            }
            if (showCost && cost.trim() && (costCents === null || costCents < 0)) {
              setError("Ingresá un costo válido, o dejalo vacío.");
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
              costCents: showCost ? costCents || undefined : product?.costCents,
              markupPercent: showCost ? markupPercent ?? undefined : product?.markupPercent,
              category: category.trim() || "Otros",
              stock: variant === "business" ? 0 : stockN,
              sku: sku.trim(),
              active: true,
              visibleOnline,
              shared: true,
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

          {masterHint ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{masterHint}</p>
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
          {showCost ? (
            <>
              <Field id={costId} label="Costo (solo vos lo ves)">
                <input
                  id={costId}
                  value={cost}
                  onChange={(e) => {
                    setCost(e.target.value);
                    setError("");
                  }}
                  inputMode="decimal"
                  className="field-input"
                  placeholder="Opcional"
                />
              </Field>
              <div>
                <label htmlFor={markupId} className="mb-1.5 block text-sm font-semibold">
                  Recargo sobre el costo
                </label>
                <div className="flex gap-2">
                  <input
                    id={markupId}
                    value={markup}
                    onChange={(e) => setMarkup(e.target.value)}
                    inputMode="decimal"
                    className="field-input min-w-0 flex-1"
                    placeholder="20"
                    aria-label="Porcentaje de recargo"
                  />
                  <span className="self-center text-sm font-semibold text-muted-foreground">%</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Con recargo, el precio de venta se calcula solo y se guarda. Costo 1000 y 20% →{" "}
                  {money(salePriceFromCost(100000, 20))}.
                </p>
              </div>
            </>
          ) : null}
          <Field id={priceId} label="Precio de venta">
            <input
              id={priceId}
              value={priceShown}
              onChange={(e) => {
                setPrice(e.target.value);
                setError("");
              }}
              readOnly={pricedFromMarkup != null}
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
            <p className="text-xs text-muted-foreground">
              Se guarda en el catálogo de todos los locales. El stock es solo de este local.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Este producto queda en el catálogo de todos los locales.
            </p>
          )}
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
