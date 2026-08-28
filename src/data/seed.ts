import type { Product } from "../types";
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
  const items: Array<Omit<Product, "id" | "active">> = [
    { name: "Coca-Cola 500 ml", priceCents: 180000, category: "Bebidas", stock: 24, sku: "BEB-001" },
    { name: "Agua mineral 500 ml", priceCents: 90000, category: "Bebidas", stock: 36, sku: "BEB-002" },
    { name: "Cerveza lata 473 ml", priceCents: 220000, category: "Bebidas", stock: 18, sku: "BEB-003" },
    { name: "Jugo en caja 1 L", priceCents: 160000, category: "Bebidas", stock: 12, sku: "BEB-004" },
    { name: "Galletitas surtidas", priceCents: 210000, category: "Almacén", stock: 20, sku: "ALM-001" },
    { name: "Fideos 500 g", priceCents: 140000, category: "Almacén", stock: 30, sku: "ALM-002" },
    { name: "Arroz 1 kg", priceCents: 190000, category: "Almacén", stock: 16, sku: "ALM-003" },
    { name: "Aceite 900 ml", priceCents: 420000, category: "Almacén", stock: 10, sku: "ALM-004" },
    { name: "Alfajor", priceCents: 80000, category: "Kiosco", stock: 40, sku: "KIO-001" },
    { name: "Chocolate", priceCents: 150000, category: "Kiosco", stock: 22, sku: "KIO-002" },
    { name: "Chicles", priceCents: 50000, category: "Kiosco", stock: 50, sku: "KIO-003" },
    { name: "Cigarrillos", priceCents: 350000, category: "Kiosco", stock: 14, sku: "KIO-004" },
    { name: "Leche 1 L", priceCents: 170000, category: "Lácteos", stock: 18, sku: "LAC-001" },
    { name: "Yogur", priceCents: 120000, category: "Lácteos", stock: 16, sku: "LAC-002" },
    { name: "Queso cremoso 200 g", priceCents: 280000, category: "Lácteos", stock: 8, sku: "LAC-003" },
    { name: "Pan lactal", priceCents: 230000, category: "Panadería", stock: 10, sku: "PAN-001" },
    { name: "Facturas x 6", priceCents: 320000, category: "Panadería", stock: 8, sku: "PAN-002" },
    { name: "Detergente", priceCents: 250000, category: "Limpieza", stock: 12, sku: "LIM-001" },
    { name: "Papel higiénico x 4", priceCents: 310000, category: "Limpieza", stock: 9, sku: "LIM-002" },
    { name: "Bolsa de hielo", priceCents: 100000, category: "Otros", stock: 15, sku: "OTR-001" },
  ];

  return items.map((item) => ({ ...item, id: uid(), active: true }));
}
