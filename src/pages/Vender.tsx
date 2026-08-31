import {
  Bank,
  Barcode,
  CreditCard,
  MagnifyingGlass,
  Minus,
  Money,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { Modal } from "../components/Modal";
import { ProductForm } from "../components/ProductForm";
import { useHidScanner } from "../hooks/useHidScanner";
import { findByBarcode, normalizeBarcode } from "../lib/barcode";
import {
  cartTotal,
  lineTotal,
  METHOD_LABEL,
  money,
  parseMoneyToCents,
} from "../lib/format";
import { useStore } from "../store";
import type { CartLine, Payment, PaymentMethod, Product, Sale } from "../types";

const CAT_TONE: Record<string, string> = {
  Bebidas: "bg-sky-100 text-sky-900",
  Almacén: "bg-amber-100 text-amber-950",
  Kiosco: "bg-rose-100 text-rose-900",
  Lácteos: "bg-indigo-100 text-indigo-900",
  Panadería: "bg-orange-100 text-orange-950",
  Limpieza: "bg-teal-100 text-teal-900",
  Otros: "bg-slate-100 text-slate-800",
};

function categoryClass(category: string) {
  return CAT_TONE[category] ?? "bg-muted text-foreground";
}

function suggestedCash(totalCents: number): number[] {
  const bills = [50000, 100000, 200000, 500000, 1000000, 2000000, 5000000, 10000000];
  const next100 = Math.ceil(totalCents / 10000) * 10000;
  const values = new Set<number>([totalCents]);
  if (next100 > totalCents) values.add(next100);
  for (const bill of bills) {
    if (bill >= totalCents) values.add(bill);
  }
  return [...values].sort((a, b) => a - b).slice(0, 5);
}

export function VenderPage() {
  const { state, completeSale, upsertProduct, catalogMode } = useStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [done, setDone] = useState<Sale | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [unknownCode, setUnknownCode] = useState<string | null>(null);
  const [registerCode, setRegisterCode] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const products = state.products.filter((p) => p.active);
  const categories = ["Todas", ...new Set(products.map((p) => p.category))];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat = category === "Todas" || p.category === category;
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [products, query, category]);

  const total = cartTotal(lines);

  function addProduct(product: Product) {
    setLines((prev) => {
      const found = prev.find((l) => l.productId === product.id);
      if (found) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPriceCents: product.priceCents,
          qty: 1,
        },
      ];
    });
  }

  function applyBarcode(raw: string, fromScanner = true) {
    const code = normalizeBarcode(raw);
    if (!code) return;
    const product = findByBarcode(products, code);
    if (product) {
      setQuery("");
      setScanOpen(false);
      addProduct(product);
      setNotice(`${product.name} agregado`);
      return;
    }
    if (fromScanner || /^\d{8,}$/.test(code)) {
      setQuery("");
      setScanOpen(false);
      setUnknownCode(code);
    }
  }

  useHidScanner(
    !ticketOpen && !payOpen && !done && !scanOpen && !unknownCode && !registerCode,
    applyBarcode,
  );

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function setQty(productId: string, qty: number) {
    setLines((prev) => {
      if (qty <= 0) return prev.filter((l) => l.productId !== productId);
      return prev.map((l) => (l.productId === productId ? { ...l, qty } : l));
    });
  }

  function startPay() {
    if (!lines.length) return;
    setTicketOpen(false);
    setPayOpen(true);
  }

  function finish(payments: Payment[], cashReceivedCents: number, changeCents: number) {
    const sale = completeSale(lines, payments, cashReceivedCents, changeCents);
    if (!sale) return;
    setPayOpen(false);
    setLines([]);
    setDone(sale);
  }

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border bg-card px-4 py-3 lg:px-6">
          <div className="flex gap-2">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Buscar producto</span>
              <MagnifyingGlass
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar o código"
                data-barcode-target="true"
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyBarcode(query, false);
                  }
                }}
                className="focus-ring min-h-10 w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="focus-ring inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary hover:bg-primary-dark"
              aria-label="Escanear código de barras con la cámara"
            >
              <Barcode size={18} aria-hidden="true" />
              <span>Escanear</span>
            </button>
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => {
              const pressed = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setCategory(cat)}
                  className={`focus-ring shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-200 ${
                    pressed
                      ? "bg-primary text-on-primary"
                      : "bg-muted text-foreground hover:bg-border"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-4">
          {filtered.length === 0 ? (
            <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
              No hay productos con ese filtro. Agregalos en la pestaña Productos.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(product)}
                    className="focus-ring flex min-h-[7.5rem] w-full flex-col items-start rounded-xl border border-transparent bg-card p-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors duration-200 hover:border-primary"
                  >
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${categoryClass(product.category)}`}
                    >
                      {product.category}
                    </span>
                    <span className="mt-1.5 line-clamp-2 font-display text-sm font-semibold leading-snug">
                      {product.name}
                    </span>
                    <span className="mt-auto pt-2 font-display text-lg font-bold tabular text-primary">
                      {money(product.priceCents)}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        product.stock <= 0
                          ? "text-destructive"
                          : product.stock <= 5
                            ? "text-accent"
                            : "text-muted-foreground"
                      }`}
                    >
                      {product.stock <= 0 ? "Sin stock" : `Stock ${product.stock}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <aside className="flex w-[340px] shrink-0 flex-col border-l border-border bg-card">
        <CartPanel
          lines={lines}
          onQty={setQty}
          onClear={() => setLines([])}
          onPay={startPay}
        />
      </aside>

      <Modal open={ticketOpen} title="Ticket" onClose={() => setTicketOpen(false)}>
        <div className="max-h-[50dvh]">
          <CartPanel
            lines={lines}
            onQty={setQty}
            onClear={() => setLines([])}
            onPay={startPay}
            compact
          />
        </div>
      </Modal>

      <div className="sr-only" aria-live="polite">
        {notice}
      </div>
      {notice ? (
        <p className="pointer-events-none fixed bottom-32 left-1/2 z-40 -translate-x-1/2 rounded-full bg-foreground px-5 py-3 text-base font-bold text-on-primary lg:bottom-8">
          {notice}
        </p>
      ) : null}

      <PayModal
        open={payOpen}
        totalCents={total}
        onClose={() => setPayOpen(false)}
        onConfirm={finish}
      />

      <BarcodeScanner
        open={scanOpen}
        title="Escanear para cobrar"
        hint="Poné el código en el recuadro. Tocá la pantalla si no enfoca."
        onClose={() => setScanOpen(false)}
        onDetected={applyBarcode}
      />

      <Modal
        open={Boolean(unknownCode)}
        title="Código no cargado"
        onClose={() => setUnknownCode(null)}
      >
        <p className="text-muted-foreground">
          No hay un producto con el código{" "}
          <span className="font-display font-semibold text-foreground">{unknownCode}</span>.
          Podés registrarlo ahora y se suma al ticket.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setUnknownCode(null)}
            className="focus-ring min-h-12 rounded-2xl bg-muted font-bold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              setRegisterCode(unknownCode);
              setUnknownCode(null);
            }}
            className="focus-ring min-h-12 rounded-2xl bg-primary font-bold text-on-primary"
          >
            Registrar
          </button>
        </div>
      </Modal>

      <ProductForm
        key={registerCode ?? "no-register"}
        open={Boolean(registerCode)}
        product={null}
        initialSku={registerCode ?? ""}
        catalogMode={catalogMode}
        onClose={() => setRegisterCode(null)}
        onSave={(product) => {
          upsertProduct(product);
          addProduct(product);
          setNotice(`${product.name} agregado`);
          setRegisterCode(null);
        }}
      />

      <Modal open={Boolean(done)} title="Venta registrada" onClose={() => setDone(null)}>
        {done ? (
          <div className="text-center">
            <p className="text-sm font-semibold text-muted-foreground">
              Ticket #{String(done.ticket).padStart(4, "0")}
            </p>
            <p className="font-display mt-2 text-4xl font-bold tabular">{money(done.totalCents)}</p>
            {done.changeCents > 0 ? (
              <div className="mt-5 rounded-2xl bg-background px-4 py-5">
                <p className="text-sm font-semibold text-muted-foreground">Vuelto</p>
                <p className="font-display text-5xl font-extrabold tabular text-accent">
                  {money(done.changeCents)}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-muted-foreground">
                {METHOD_LABEL[done.payments[0]?.method] ?? "Pago"} recibido
              </p>
            )}
            <button
              type="button"
              onClick={() => setDone(null)}
              className="focus-ring mt-6 min-h-10 w-full rounded-xl bg-primary font-display text-sm font-bold text-on-primary hover:bg-primary-dark"
            >
              Nueva venta
            </button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function CartPanel({
  lines,
  onQty,
  onClear,
  onPay,
  compact,
}: {
  lines: CartLine[];
  onQty: (id: string, qty: number) => void;
  onClear: () => void;
  onPay: () => void;
  compact?: boolean;
}) {
  const total = cartTotal(lines);
  return (
    <div className={`flex h-full flex-col ${compact ? "" : "min-h-0"}`}>
      {!compact ? (
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Ticket</h2>
          {lines.length ? (
            <button
              type="button"
              onClick={onClear}
              className="focus-ring rounded-xl px-3 py-2 text-sm font-bold text-destructive hover:bg-red-50"
            >
              Vaciar
            </button>
          ) : null}
        </div>
      ) : null}
      <ul className={`flex-1 space-y-2 overflow-y-auto ${compact ? "" : "px-4 py-3"}`}>
        {lines.length === 0 ? (
          <li className="px-2 py-10 text-center text-sm text-muted-foreground">
            Tocá un producto para sumarlo al ticket.
          </li>
        ) : (
          lines.map((line) => (
            <li
              key={line.productId}
              className="flex items-center gap-3 rounded-2xl bg-background p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{line.name}</p>
                <p className="text-sm tabular text-muted-foreground">
                  {money(line.unitPriceCents)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="focus-ring inline-flex size-8 items-center justify-center rounded-lg bg-card"
                  onClick={() => onQty(line.productId, line.qty - 1)}
                  aria-label={`Quitar uno de ${line.name}`}
                >
                  {line.qty === 1 ? (
                    <Trash size={16} aria-hidden="true" />
                  ) : (
                    <Minus size={16} aria-hidden="true" />
                  )}
                </button>
                <span className="w-7 text-center font-display text-sm font-bold tabular">{line.qty}</span>
                <button
                  type="button"
                  className="focus-ring inline-flex size-8 items-center justify-center rounded-lg bg-card"
                  onClick={() => onQty(line.productId, line.qty + 1)}
                  aria-label={`Agregar uno de ${line.name}`}
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>
              <p className="w-24 text-right font-display font-bold tabular">
                {money(lineTotal(line.qty, line.unitPriceCents))}
              </p>
            </li>
          ))
        )}
      </ul>
      <div className={`${compact ? "pt-4" : "border-t border-border p-4"}`}>
        <div className="mb-3 flex items-end justify-between">
          <span className="font-semibold text-muted-foreground">Total</span>
          <span className="font-display text-2xl font-bold tabular">{money(total)}</span>
        </div>
        <button
          type="button"
          disabled={!lines.length}
          onClick={onPay}
          className="focus-ring min-h-11 w-full rounded-xl bg-accent font-display text-base font-extrabold text-on-accent transition-colors duration-200 hover:bg-accent-dark disabled:bg-muted disabled:text-muted-foreground"
        >
          Cobrar
        </button>
      </div>
    </div>
  );
}

function PayModal({
  open,
  totalCents,
  onClose,
  onConfirm,
}: {
  open: boolean;
  totalCents: number;
  onClose: () => void;
  onConfirm: (payments: Payment[], cashReceivedCents: number, changeCents: number) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [paidRaw, setPaidRaw] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setMethod("efectivo");
    setPaidRaw("");
    setError("");
  }, [open]);

  const paidCents = parseMoneyToCents(paidRaw) ?? 0;
  const change = method === "efectivo" ? paidCents - totalCents : 0;
  const exact = method !== "efectivo" || paidCents >= totalCents;

  function choose(next: PaymentMethod) {
    setMethod(next);
    setError("");
    setPaidRaw(next === "efectivo" ? "" : moneyPlainInput(totalCents));
  }

  function confirm() {
    if (method === "efectivo") {
      if (paidCents < totalCents) {
        setError("El efectivo recibido no cubre el total.");
        return;
      }
      onConfirm(
        [{ method: "efectivo", amountCents: totalCents }],
        paidCents,
        paidCents - totalCents,
      );
      setPaidRaw("");
      setMethod("efectivo");
      return;
    }
    onConfirm([{ method, amountCents: totalCents }], 0, 0);
    setPaidRaw("");
    setMethod("efectivo");
  }

  return (
    <Modal open={open} title="Cobrar" onClose={onClose} wide>
      <p className="text-sm font-semibold text-muted-foreground">Total a cobrar</p>
      <p className="font-display text-4xl font-bold tabular">{money(totalCents)}</p>

      {error ? (
        <div role="alert" tabIndex={-1} className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-destructive">
          <p className="font-display font-semibold">Hay un problema</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-3 gap-2">
        {(
          [
            ["efectivo", "Efectivo", Money],
            ["tarjeta", "Tarjeta", CreditCard],
            ["transferencia", "Transfer.", Bank],
          ] as const
        ).map(([id, label, Icon]) => {
          const pressed = method === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={pressed}
              onClick={() => choose(id)}
              className={`focus-ring flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border text-sm font-bold transition-colors duration-200 ${
                pressed
                  ? "border-primary bg-primary text-on-primary"
                  : "border-border bg-background hover:border-primary"
              }`}
            >
              <Icon size={22} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      {method === "efectivo" ? (
        <div className="mt-5">
          <label htmlFor="cash-received" className="text-sm font-semibold">
            ¿Con cuánto paga?
          </label>
          <input
            id="cash-received"
            value={paidRaw}
            onChange={(e) => {
              setPaidRaw(e.target.value);
              setError("");
            }}
            inputMode="decimal"
            className="focus-ring mt-2 w-full rounded-2xl border border-border bg-background px-4 py-4 font-display text-2xl font-semibold tabular"
            placeholder={moneyPlainInput(totalCents)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestedCash(totalCents).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setPaidRaw(moneyPlainInput(value));
                  setError("");
                }}
                className="focus-ring min-h-11 rounded-xl bg-muted px-3 text-sm font-bold tabular hover:bg-border"
              >
                {value === totalCents ? "Exacto" : money(value)}
              </button>
            ))}
          </div>
          <div className="mt-3 grid items-start gap-4 sm:grid-cols-[1fr_200px]">
            <div className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
              <span className="font-semibold text-muted-foreground">Vuelto</span>
              <span
                className={`font-display text-2xl font-bold tabular ${
                  change >= 0 ? "text-accent" : "text-destructive"
                }`}
              >
                {money(Math.max(change, 0))}
              </span>
            </div>
            <Keypad
              onDigit={(d) => setPaidRaw((prev) => prev + d)}
              onBack={() => setPaidRaw((prev) => prev.slice(0, -1))}
              onClear={() => setPaidRaw("")}
            />
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-background px-4 py-3 text-sm text-muted-foreground">
          Se registra el cobro completo con {METHOD_LABEL[method].toLowerCase()}.
        </p>
      )}

      <button
        type="button"
        disabled={method === "efectivo" && !exact}
        onClick={confirm}
        className="focus-ring mt-5 min-h-11 w-full rounded-xl bg-accent font-display text-base font-extrabold text-on-accent hover:bg-accent-dark disabled:bg-muted disabled:text-muted-foreground"
      >
        Confirmar cobro
      </button>
    </Modal>
  );
}

function moneyPlainInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function Keypad({
  onDigit,
  onBack,
  onClear,
}: {
  onDigit: (d: string) => void;
  onBack: () => void;
  onClear: () => void;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "←"];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => {
            if (key === "←") onBack();
            else onDigit(key);
          }}
          className="focus-ring min-h-12 rounded-2xl bg-muted font-display text-xl font-bold hover:bg-border"
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="focus-ring col-span-3 min-h-12 rounded-2xl text-sm font-bold text-muted-foreground hover:bg-muted"
      >
        Borrar todo
      </button>
    </div>
  );
}
