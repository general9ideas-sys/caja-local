import type { Product } from "../types";
import { catalogById } from "./catalogs";
import { uid } from "../lib/format";

export const DEFAULT_CATEGORIES = [
  "Bebidas",
  "Almacén",
  "Kiosco",
  "Lácteos",
  "Panadería",
  "Limpieza",
  "Otros",
];

export function seedProducts(): Product[] {
  const items = catalogById("completo")?.items ?? [];
  return items.map((item) => ({
    ...item,
    id: uid(),
    active: true,
    visibleOnline: false,
    shared: true,
  }));
}
