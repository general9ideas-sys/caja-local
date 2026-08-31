import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { OpenCashGate } from "./components/OpenCashGate";
import { CatalogoPage } from "./pages/Catalogo";
import { LoginPage, RegisterPage } from "./pages/Login";
import { PanelPage } from "./pages/Panel";
import { CajaPage } from "./pages/Caja";
import { ProductosPage } from "./pages/Productos";
import { VenderPage } from "./pages/Vender";
import { VentasPage } from "./pages/Ventas";
import { StoreProvider, useOpenSession, useStore } from "./store";

function RequireUser({ children, owner }: { children: ReactNode; owner?: boolean }) {
  const { ready, cloud, user, profile } = useAuth();
  if (!ready) return <p className="p-8 text-center text-muted-foreground">Cargando…</p>;
  if (!cloud) return <>{children}</>;
  if (!user || !profile) return <Navigate to="/login" replace />;
  if (owner && profile.role !== "owner") return <Navigate to="/caja" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { ready, cloud, profile } = useAuth();
  if (!ready) return <p className="p-8 text-center text-muted-foreground">Cargando…</p>;
  if (!cloud) return <Navigate to="/caja" replace />;
  if (!profile) return <Navigate to="/login" replace />;
  return <Navigate to={profile.role === "owner" ? "/panel" : "/caja"} replace />;
}

function CajaShell() {
  const { cloud, profile, selectedStoreId, setSelectedStoreId } = useAuth();
  const { stores, ready } = useStore();
  const session = useOpenSession();

  if (cloud && profile?.role === "owner" && !selectedStoreId) {
    if (!ready) return <p className="p-8 text-center">Cargando locales…</p>;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl bg-card p-6">
          <h1 className="font-display text-xl font-bold">Elegí el local</h1>
          <ul className="mt-4 space-y-2">
            {stores.map((store) => (
              <li key={store.id}>
                <button
                  type="button"
                  onClick={() => setSelectedStoreId(store.id)}
                  className="focus-ring min-h-10 w-full rounded-xl bg-muted px-4 text-left text-sm font-bold"
                >
                  {store.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route index element={session ? <VenderPage /> : <OpenCashGate />} />
        <Route path="productos" element={<ProductosPage />} />
        <Route path="turno" element={<CajaPage />} />
        <Route path="ventas" element={<VentasPage />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />
      <Route path="/catalogo/:slug" element={<CatalogoPage />} />
      <Route
        path="/panel"
        element={
          <RequireUser owner>
            <PanelPage />
          </RequireUser>
        }
      />
      <Route
        path="/caja/*"
        element={
          <RequireUser>
            <StoreProvider>
              <CajaShell />
            </StoreProvider>
          </RequireUser>
        }
      />
      <Route path="/" element={<HomeRedirect />} />
    </Routes>
  );
}
