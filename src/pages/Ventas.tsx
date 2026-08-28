import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Modal } from "../components/Modal";
import { formatDateTime, METHOD_LABEL, money } from "../lib/format";
import { useOpenSession, useStore } from "../store";
import type { Sale } from "../types";

export function VentasPage() {
  const { state, cancelSale } = useStore();
  const session = useOpenSession();
  const [scope, setScope] = useState<"turno" | "todas">("turno");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<Sale | null>(null);

  const sales = useMemo(() => {
    const list =
      scope === "turno" && session
        ? state.sales.filter((s) => s.sessionId === session.id)
        : state.sales;
    return list;
  }, [scope, session, state.sales]);

  return (
    <div className="mx-auto max-w-5xl p-4 pb-8 lg:p-6">
      <div className="flex gap-2">
        {(
          [
            ["turno", "Este turno"],
            ["todas", "Todas"],
          ] as const
        ).map(([id, label]) => {
          const pressed = scope === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={pressed}
              onClick={() => setScope(id)}
              className={`focus-ring min-h-12 rounded-full px-5 text-base font-bold ${
                pressed ? "bg-primary text-on-primary" : "bg-card hover:bg-muted"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {sales.length === 0 ? (
        <p className="mt-8 rounded-3xl bg-card p-8 text-center text-muted-foreground">
          Todavía no hay ventas {scope === "turno" ? "en este turno" : "guardadas"}.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {sales.map((sale) => {
            const expanded = openId === sale.id;
            return (
              <li key={sale.id} className="overflow-hidden rounded-3xl bg-card">
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : sale.id)}
                  aria-expanded={expanded}
                  className="focus-ring flex w-full items-center gap-3 px-4 py-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold">
                      Ticket #{String(sale.ticket).padStart(4, "0")}
                      {sale.cancelled ? (
                        <span className="ml-2 text-sm font-bold text-destructive">Anulada</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(sale.createdAt)} ·{" "}
                      {sale.payments.map((p) => METHOD_LABEL[p.method]).join(" + ")}
                    </p>
                  </div>
                  <p
                    className={`font-display font-bold tabular ${sale.cancelled ? "text-muted-foreground line-through" : ""}`}
                  >
                    {money(sale.totalCents)}
                  </p>
                  {expanded ? (
                    <CaretUp size={24} aria-hidden="true" />
                  ) : (
                    <CaretDown size={24} aria-hidden="true" />
                  )}
                </button>
                {expanded ? (
                  <div className="border-t border-border px-4 py-3">
                    <ul className="space-y-1 text-sm">
                      {sale.lines.map((line) => (
                        <li key={line.productId} className="flex justify-between gap-3">
                          <span>
                            {line.qty} × {line.name}
                          </span>
                          <span className="tabular font-semibold">
                            {money(line.qty * line.unitPriceCents)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {sale.changeCents > 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Recibido {money(sale.cashReceivedCents)} · Vuelto{" "}
                        {money(sale.changeCents)}
                      </p>
                    ) : null}
                    {!sale.cancelled ? (
                      <button
                        type="button"
                        onClick={() => setToCancel(sale)}
                        className="focus-ring mt-3 min-h-11 rounded-xl px-3 text-sm font-bold text-destructive hover:bg-red-50"
                      >
                        Anular venta
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={Boolean(toCancel)}
        title="¿Anular esta venta?"
        onClose={() => setToCancel(null)}
      >
        <p className="text-muted-foreground">
          Se saca del total del día y se devuelve el stock de los productos.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setToCancel(null)}
            className="focus-ring min-h-12 rounded-2xl bg-muted font-bold"
          >
            Conservar
          </button>
          <button
            type="button"
            onClick={() => {
              if (toCancel) cancelSale(toCancel.id);
              setToCancel(null);
            }}
            className="focus-ring min-h-12 rounded-2xl bg-destructive font-bold text-white"
          >
            Anular
          </button>
        </div>
      </Modal>
    </div>
  );
}
