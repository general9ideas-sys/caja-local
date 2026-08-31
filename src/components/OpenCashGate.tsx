import { useId, useState, type FormEvent } from "react";
import { money, parseMoneyToCents } from "../lib/format";
import { useStore } from "../store";

export function OpenCashGate() {
  const { openCash, state } = useStore();
  const [raw, setRaw] = useState("0");
  const [error, setError] = useState("");
  const inputId = useId();
  const errorId = useId();

  function submit(e: FormEvent) {
    e.preventDefault();
    const cents = parseMoneyToCents(raw);
    if (cents === null) {
      setError("Ingresá un monto válido, por ejemplo 10000 o 10.000");
      return;
    }
    openCash(cents);
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl bg-card p-6 shadow-[0_10px_15px_rgba(0,0,0,0.1)] sm:p-8"
      >
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          {state.settings.storeName}
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold text-foreground">
          Abrir caja del día
        </h1>
        <p className="mt-2 text-muted-foreground">
          Contá el efectivo que hay en el cajón antes de empezar a vender. Al
          cerrar, el sistema lo compara con lo que se cobró.
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

        <label htmlFor={inputId} className="mt-6 block text-sm font-semibold">
          Fondo inicial en efectivo
        </label>
        <input
          id={inputId}
          inputMode="decimal"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setError("");
          }}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          className="focus-ring mt-2 w-full rounded-2xl border border-border bg-background px-4 py-4 font-display text-2xl font-semibold tabular text-foreground"
          placeholder="0"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          Vista previa: {money(parseMoneyToCents(raw) ?? 0)}
        </p>
        <button
          type="submit"
          className="focus-ring mt-6 min-h-10 w-full rounded-xl bg-primary font-display text-sm font-bold text-on-primary transition-colors duration-200 hover:bg-primary-dark"
        >
          Abrir caja y vender
        </button>
      </form>
    </div>
  );
}
