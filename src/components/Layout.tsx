import {
  CashRegister,
  Package,
  Receipt,
  ShoppingCartSimple,
} from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { money } from "../lib/format";
import { sessionSales, sumByMethod, useOpenSession, useStore } from "../store";
import type { PageId } from "../types";

const NAV: Array<{ id: PageId; label: string; icon: typeof ShoppingCartSimple }> = [
  { id: "vender", label: "Vender", icon: ShoppingCartSimple },
  { id: "productos", label: "Productos", icon: Package },
  { id: "caja", label: "Caja", icon: CashRegister },
  { id: "ventas", label: "Ventas", icon: Receipt },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function Layout({
  page,
  onPage,
  children,
}: {
  page: PageId;
  onPage: (page: PageId) => void;
  children: ReactNode;
}) {
  const { state } = useStore();
  const session = useOpenSession();
  const now = useClock();
  const sales = session ? sessionSales(state, session.id) : [];
  const todayTotal = sales.reduce((s, sale) => s + sale.totalCents, 0);
  const cashToday = sumByMethod(sales, "efectivo");

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="px-5 py-6">
          <p className="font-display text-lg font-bold tracking-tight text-foreground">
            {state.settings.storeName}
          </p>
          <p className="text-sm text-muted-foreground">Punto de venta</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Principal">
          {NAV.map((item) => {
            const active = page === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPage(item.id)}
                aria-current={active ? "page" : undefined}
                className={`focus-ring flex min-h-12 items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-semibold transition-colors duration-200 ${
                  active
                    ? "bg-primary text-on-primary"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon size={22} weight={active ? "fill" : "regular"} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="m-3 rounded-2xl bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Hoy
          </p>
          <p className="font-display mt-1 text-2xl font-bold tabular text-foreground">
            {money(todayTotal)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Efectivo {money(cashToday)}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-[72px] lg:pb-0">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 lg:px-6">
          <div className="min-w-0 lg:hidden">
            <p className="truncate font-display text-base font-bold">{state.settings.storeName}</p>
            <p className="text-sm text-muted-foreground">
              {sales.length} {sales.length === 1 ? "venta" : "ventas"} · {money(todayTotal)}
            </p>
          </div>
          <p className="hidden font-display text-xl font-semibold lg:block">
            {NAV.find((n) => n.id === page)?.label}
          </p>
          <div className="ml-auto text-right">
            <p className="font-display text-lg font-semibold tabular">
              {now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-sm capitalize text-muted-foreground">
              {now.toLocaleDateString("es-AR", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </p>
          </div>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card lg:hidden"
        aria-label="Principal"
      >
        {NAV.map((item) => {
          const active = page === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onPage(item.id)}
              aria-current={active ? "page" : undefined}
              className={`focus-ring flex min-h-[72px] flex-col items-center justify-center gap-1 text-xs font-bold ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon size={24} weight={active ? "fill" : "regular"} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
