import { useState } from "react";
import { Layout } from "./components/Layout";
import { OpenCashGate } from "./components/OpenCashGate";
import { CajaPage } from "./pages/Caja";
import { ProductosPage } from "./pages/Productos";
import { VenderPage } from "./pages/Vender";
import { VentasPage } from "./pages/Ventas";
import { useOpenSession } from "./store";
import type { PageId } from "./types";

export default function App() {
  const session = useOpenSession();
  const [page, setPage] = useState<PageId>("vender");

  return (
    <Layout page={page} onPage={setPage}>
      {page === "vender" ? session ? <VenderPage /> : <OpenCashGate /> : null}
      {page === "productos" ? <ProductosPage /> : null}
      {page === "caja" ? <CajaPage /> : null}
      {page === "ventas" ? <VentasPage /> : null}
    </Layout>
  );
}
