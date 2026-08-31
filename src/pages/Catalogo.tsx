import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { money } from "../lib/format";
import { fetchPublicCatalog } from "../store";
import type { Product } from "../types";

export function CatalogoPage() {
  const { slug = "" } = useParams();
  const [storeName, setStoreName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPublicCatalog(slug).then((data) => {
      if (cancelled) return;
      if (!data) {
        setError("No encontramos ese local.");
        setReady(true);
        return;
      }
      setStoreName(data.storeName);
      setProducts(data.products);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const categories = useMemo(
    () => ["Todas", ...new Set(products.map((p) => p.category))],
    [products],
  );
  const [category, setCategory] = useState("Todas");
  const filtered = products.filter((p) => category === "Todas" || p.category === category);

  if (!ready) {
    return <p className="p-8 text-center text-muted-foreground">Cargando catálogo…</p>;
  }
  if (error) {
    return <p className="p-8 text-center text-destructive">{error}</p>;
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Catálogo</p>
        <h1 className="font-display text-2xl font-bold">{storeName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Precios de referencia. Consultá stock en el local.</p>
      </header>
      <div className="mx-auto max-w-3xl p-5">
        <div className="flex gap-1.5 overflow-x-auto pb-3">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`focus-ring shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
                category === cat ? "bg-primary text-on-primary" : "bg-card"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
            Este local todavía no publicó productos.
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((product) => (
              <li
                key={product.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3"
              >
                <div>
                  <p className="font-display font-semibold">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.category}</p>
                </div>
                <p className="font-display font-bold tabular">{money(product.priceCents)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
