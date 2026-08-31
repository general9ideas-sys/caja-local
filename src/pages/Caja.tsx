import { Bank, CreditCard, Money, WarningCircle } from "@phosphor-icons/react";
import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Modal } from "../components/Modal";
import { OpenCashGate } from "../components/OpenCashGate";
import { firebaseMessage } from "../lib/firebaseErrors";
import {
  formatDateTime,
  money,
  parseMoneyToCents,
} from "../lib/format";
import {
  expectedCashCents,
  sessionSales,
  sumByMethod,
  useOpenSession,
  useStore,
} from "../store";

export function CajaPage() {
  const { state, closeCash, updateSettings, resetDemo, cloud, importLocalData } = useStore();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const session = useOpenSession();
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [storeName, setStoreName] = useState(state.settings.storeName);
  const countedId = useId();
  const notesId = useId();
  const nameId = useId();
  const errorId = useId();

  const sales = session ? sessionSales(state, session.id) : [];
  const total = sales.reduce((s, sale) => s + sale.totalCents, 0);
  const cash = sumByMethod(sales, "efectivo");
  const card = sumByMethod(sales, "tarjeta");
  const transfer = sumByMethod(sales, "transferencia");
  const expected = session ? expectedCashCents(session, sales) : 0;
  const countedCents = parseMoneyToCents(counted);
  const diff = countedCents === null ? null : countedCents - expected;
  const closed = [...state.sessions].filter((s) => s.status === "closed").reverse();

  function tryClose() {
    if (countedCents === null) {
      setError("Ingresá el efectivo contado en el cajón.");
      return;
    }
    setConfirmClose(true);
  }

  return (
    <div className="mx-auto h-full max-w-5xl space-y-6 overflow-y-auto p-4 pb-8 lg:p-6">
      {session ? (
        <>
          <section className="rounded-3xl bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Caja abierta
            </p>
            <p className="mt-1 text-muted-foreground">
              Desde {formatDateTime(session.openedAt)}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Ventas del día" value={money(total)} />
              <Stat label="Tickets" value={String(sales.length)} />
              <Stat label="Fondo inicial" value={money(session.openingCashCents)} />
              <Stat label="Efectivo esperado" value={money(expected)} accent />
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <PayStat icon={Money} label="Efectivo" value={money(cash)} />
            <PayStat icon={CreditCard} label="Tarjeta" value={money(card)} />
            <PayStat icon={Bank} label="Transferencia" value={money(transfer)} />
          </section>

          <section className="rounded-3xl bg-card p-5">
            <h2 className="font-display text-xl font-semibold">Cerrar caja</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Contá el dinero del cajón. El sistema compara con el fondo inicial más
              lo cobrado en efectivo.
            </p>

            {error ? (
              <div
                id={errorId}
                role="alert"
                tabIndex={-1}
                className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-destructive"
              >
                <p className="font-display font-semibold">Hay un problema</p>
                <p className="mt-1">{error}</p>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={countedId} className="text-sm font-semibold">
                  Efectivo contado
                </label>
                <input
                  id={countedId}
                  value={counted}
                  onChange={(e) => {
                    setCounted(e.target.value);
                    setError("");
                  }}
                  inputMode="decimal"
                  aria-describedby={error ? errorId : undefined}
                  className="focus-ring mt-1.5 w-full rounded-2xl border border-border bg-background px-4 py-3 font-display text-xl font-semibold tabular"
                />
              </div>
              <div className="rounded-2xl bg-background px-4 py-3">
                <p className="text-sm font-semibold text-muted-foreground">Diferencia</p>
                <p
                  className={`font-display text-2xl font-bold tabular ${
                    diff === null
                      ? "text-muted-foreground"
                      : diff === 0
                        ? "text-primary"
                        : diff > 0
                          ? "text-primary"
                          : "text-destructive"
                  }`}
                >
                  {diff === null
                    ? "—"
                    : `${diff > 0 ? "+" : ""}${money(diff)}`}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Esperado {money(expected)}
                </p>
              </div>
            </div>
            <label htmlFor={notesId} className="mt-4 block text-sm font-semibold">
              Notas (opcional)
            </label>
            <textarea
              id={notesId}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="focus-ring mt-1.5 w-full rounded-2xl border border-border bg-background px-4 py-3"
              placeholder="Gastos, retiros, comentarios del turno"
            />
            <button
              type="button"
              onClick={tryClose}
              className="focus-ring mt-4 min-h-14 w-full rounded-2xl bg-foreground font-display text-lg font-bold text-on-primary hover:bg-ink sm:w-auto sm:px-8"
            >
              Cerrar caja del día
            </button>
          </section>
        </>
      ) : (
        <OpenCashGate />
      )}

      <section className="rounded-3xl bg-card p-5">
        <h2 className="font-display text-xl font-semibold">Cierres anteriores</h2>
        {closed.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Todavía no hay cierres guardados.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {closed.map((item) => {
              const itemSales = sessionSales(state, item.id);
              const itemTotal = itemSales.reduce((s, sale) => s + sale.totalCents, 0);
              const itemExpected = expectedCashCents(item, itemSales);
              const itemDiff =
                item.countedCashCents === undefined
                  ? 0
                  : item.countedCashCents - itemExpected;
              return (
                <li key={item.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">{formatDateTime(item.openedAt)}</p>
                    <p className="font-display font-bold tabular">{money(itemTotal)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Esperado {money(itemExpected)} · Contado{" "}
                    {money(item.countedCashCents ?? 0)} · Diferencia{" "}
                    {`${itemDiff > 0 ? "+" : ""}${money(itemDiff)}`}
                  </p>
                  {item.notes ? (
                    <p className="mt-1 text-sm">{item.notes}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-3xl bg-card p-5">
        <h2 className="font-display text-xl font-semibold">Local</h2>
        {!cloud ? (
          <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
            Esta PC guarda los datos solo acá. El proyecto Firebase ya es{" "}
            <strong>ventalocales</strong>.{" "}
            <a href="#/conectar" className="font-bold text-primary">
              Seguí estos pasos
            </a>{" "}
            para varios locales y el catálogo online.
          </p>
        ) : null}
        <label htmlFor={nameId} className="mt-3 block text-sm font-semibold">
          Nombre del local
        </label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input
            id={nameId}
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="focus-ring min-h-12 flex-1 rounded-2xl border border-border bg-background px-4"
          />
          <button
            type="button"
            onClick={() => updateSettings({ storeName: storeName.trim() || "Mi local" })}
            className="focus-ring min-h-10 rounded-xl bg-primary px-5 text-sm font-bold text-on-primary hover:bg-primary-dark"
          >
            Guardar nombre
          </button>
        </div>
        {cloud ? (
          <button
            type="button"
            onClick={() => void importLocalData()}
            className="focus-ring mt-4 text-sm font-bold text-primary hover:underline"
          >
            Importar datos guardados en esta PC
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="focus-ring mt-6 text-sm font-bold text-destructive hover:underline"
          >
            Restaurar datos de ejemplo
          </button>
        )}
      </section>

      <Modal
        open={confirmClose}
        title="¿Cerrar la caja?"
        onClose={() => setConfirmClose(false)}
      >
        <p className="text-muted-foreground">
          Se cierra el turno y sale de la cuenta. La próxima persona entra con su correo para
          abrir una caja nueva.
        </p>
        {diff !== null && diff !== 0 ? (
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-orange-50 px-3 py-3 text-sm font-medium text-accent-dark">
            <WarningCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            Hay una diferencia de {money(Math.abs(diff))} (
            {diff > 0 ? "sobrante" : "faltante"}).
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={closing}
            onClick={() => setConfirmClose(false)}
            className="focus-ring min-h-12 rounded-2xl bg-muted font-bold"
          >
            Seguir abierta
          </button>
          <button
            type="button"
            disabled={closing || countedCents === null}
            onClick={() => {
              if (countedCents === null) return;
              void (async () => {
                setClosing(true);
                setError("");
                try {
                  await closeCash(countedCents, notes.trim());
                  setConfirmClose(false);
                  setCounted("");
                  setNotes("");
                  if (cloud) {
                    await signOut();
                    navigate("/login", { replace: true });
                    return;
                  }
                } catch (err) {
                  setConfirmClose(false);
                  setError(firebaseMessage(err));
                } finally {
                  setClosing(false);
                }
              })();
            }}
            className="focus-ring min-h-12 rounded-2xl bg-foreground font-bold text-on-primary"
          >
            {closing ? "Cerrando…" : "Cerrar y salir"}
          </button>
        </div>
      </Modal>

      <Modal
        open={confirmReset}
        title="¿Restaurar el ejemplo?"
        onClose={() => setConfirmReset(false)}
      >
        <p className="text-muted-foreground">
          Se borran ventas, cierres y productos cargados, y vuelven los productos de
          demostración.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setConfirmReset(false)}
            className="focus-ring min-h-12 rounded-2xl bg-muted font-bold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              resetDemo();
              setConfirmReset(false);
            }}
            className="focus-ring min-h-12 rounded-2xl bg-destructive font-bold text-white"
          >
            Restaurar
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${accent ? "bg-primary text-on-primary" : "bg-background"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${accent ? "text-white/80" : "text-muted-foreground"}`}>
        {label}
      </p>
      <p className="font-display mt-1 text-xl font-bold tabular">{value}</p>
    </div>
  );
}

function PayStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Money;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-card p-4">
      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-background text-primary">
        <Icon size={20} aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="font-display text-lg font-bold tabular">{value}</p>
      </div>
    </div>
  );
}
