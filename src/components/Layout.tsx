import {
  CashRegister,
  ChartLine,
  Package,
  Receipt,
  ShoppingCartSimple,
  SignOut,
} from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { money } from "../lib/format";
import { sessionSales, sumByMethod, useOpenSession, useStore } from "../store";

const POS_NAV = [
  { to: "/caja", id: "vender", label: "Vender", icon: ShoppingCartSimple },
  { to: "/caja/productos", id: "productos", label: "Productos", icon: Package },
  { to: "/caja/turno", id: "caja", label: "Caja", icon: CashRegister },
  { to: "/caja/ventas", id: "ventas", label: "Ventas", icon: Receipt },
] as const;

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function posTitle(pathname: string) {
  if (pathname.includes("/productos")) return "Productos";
  if (pathname.includes("/turno")) return "Caja";
  if (pathname.includes("/ventas")) return "Ventas";
  return "Vender";
}

export function Layout({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const { profile, signOut } = useAuth();
  const session = useOpenSession();
  const now = useClock();
  const location = useLocation();
  const navigate = useNavigate();
  const sales = session ? sessionSales(state, session.id) : [];
  const todayTotal = sales.reduce((s, sale) => s + sale.totalCents, 0);
  const cashToday = sumByMethod(sales, "efectivo");
  const title = posTitle(location.pathname);

  return (
    <div className="flex h-dvh bg-background">
      <aside className="flex w-[200px] shrink-0 flex-col border-r border-border bg-card">
        <div className="px-4 py-4">
          <p className="font-display truncate text-base font-bold tracking-tight text-foreground">
            {state.settings.storeName}
          </p>
          <p className="text-xs text-muted-foreground">Punto de venta</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label="Principal">
          {POS_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.to === "/caja"}
                className={({ isActive }) =>
                  `focus-ring flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold ${
                    isActive
                      ? "bg-primary text-on-primary"
                      : "text-foreground hover:bg-muted"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} weight={isActive ? "fill" : "regular"} aria-hidden="true" />
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
          {profile?.role === "owner" ? (
            <NavLink
              to="/panel"
              className="focus-ring mt-2 flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <ChartLine size={18} aria-hidden="true" />
              Panel dueño
            </NavLink>
          ) : null}
        </nav>
        <div className="m-2 rounded-xl bg-background p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Hoy
          </p>
          <p className="font-display mt-0.5 text-lg font-bold tabular text-foreground">
            {money(todayTotal)}
          </p>
          <p className="text-xs text-muted-foreground">Efectivo {money(cashToday)}</p>
        </div>
        {profile ? (
          <button
            type="button"
            onClick={async () => {
              await signOut();
              navigate("/login");
            }}
            className="focus-ring mx-2 mb-3 flex min-h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            <SignOut size={16} aria-hidden="true" />
            Salir
          </button>
        ) : null}
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-5 py-2.5">
          <p className="font-display text-base font-semibold">{title}</p>
          <div className="ml-auto text-right">
            <p className="font-display text-lg font-semibold tabular">
              {now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-xs capitalize text-muted-foreground">
              {now.toLocaleDateString("es-AR", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </p>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
