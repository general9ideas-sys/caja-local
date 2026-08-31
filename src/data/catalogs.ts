export type CatalogItem = {
  name: string;
  priceCents: number;
  category: string;
  stock: number;
  sku: string;
};

export type GenericCatalog = {
  id: string;
  name: string;
  description: string;
  items: CatalogItem[];
};

const BEBIDAS: CatalogItem[] = [
  { name: "Coca-Cola 500 ml", priceCents: 180000, category: "Bebidas", stock: 24, sku: "BEB-001" },
  { name: "Agua mineral 500 ml", priceCents: 90000, category: "Bebidas", stock: 36, sku: "BEB-002" },
  { name: "Cerveza lata 473 ml", priceCents: 220000, category: "Bebidas", stock: 18, sku: "BEB-003" },
  { name: "Jugo en caja 1 L", priceCents: 160000, category: "Bebidas", stock: 12, sku: "BEB-004" },
];

const ALMACEN: CatalogItem[] = [
  { name: "Galletitas surtidas", priceCents: 210000, category: "Almacén", stock: 20, sku: "ALM-001" },
  { name: "Fideos 500 g", priceCents: 140000, category: "Almacén", stock: 30, sku: "ALM-002" },
  { name: "Arroz 1 kg", priceCents: 190000, category: "Almacén", stock: 16, sku: "ALM-003" },
  { name: "Aceite 900 ml", priceCents: 420000, category: "Almacén", stock: 10, sku: "ALM-004" },
];

const KIOSCO: CatalogItem[] = [
  { name: "Alfajor", priceCents: 80000, category: "Kiosco", stock: 40, sku: "KIO-001" },
  { name: "Chocolate", priceCents: 150000, category: "Kiosco", stock: 22, sku: "KIO-002" },
  { name: "Chicles", priceCents: 50000, category: "Kiosco", stock: 50, sku: "KIO-003" },
  { name: "Cigarrillos", priceCents: 350000, category: "Kiosco", stock: 14, sku: "KIO-004" },
];

const LACTEOS: CatalogItem[] = [
  { name: "Leche 1 L", priceCents: 170000, category: "Lácteos", stock: 18, sku: "LAC-001" },
  { name: "Yogur", priceCents: 120000, category: "Lácteos", stock: 16, sku: "LAC-002" },
  { name: "Queso cremoso 200 g", priceCents: 280000, category: "Lácteos", stock: 8, sku: "LAC-003" },
];

const PANADERIA: CatalogItem[] = [
  { name: "Pan lactal", priceCents: 230000, category: "Panadería", stock: 10, sku: "PAN-001" },
  { name: "Facturas x 6", priceCents: 320000, category: "Panadería", stock: 8, sku: "PAN-002" },
];

const LIMPIEZA: CatalogItem[] = [
  { name: "Detergente", priceCents: 250000, category: "Limpieza", stock: 12, sku: "LIM-001" },
  { name: "Papel higiénico x 4", priceCents: 310000, category: "Limpieza", stock: 9, sku: "LIM-002" },
];

const OTROS: CatalogItem[] = [
  { name: "Bolsa de hielo", priceCents: 100000, category: "Otros", stock: 15, sku: "OTR-001" },
];

export const GENERIC_CATALOGS: GenericCatalog[] = [
  {
    id: "empty",
    name: "Vacío",
    description: "Sin productos. Los cargás vos después.",
    items: [],
  },
  {
    id: "kiosco",
    name: "Kiosco",
    description: "Golosinas, cigarrillos y bebidas chicas.",
    items: [...KIOSCO, ...BEBIDAS.slice(0, 2)],
  },
  {
    id: "almacen",
    name: "Almacén",
    description: "Secos, aceite y galletitas.",
    items: ALMACEN,
  },
  {
    id: "bebidas",
    name: "Bebidas",
    description: "Gaseosas, agua, cerveza y jugos.",
    items: BEBIDAS,
  },
  {
    id: "lacteos",
    name: "Lácteos y panadería",
    description: "Leche, yogur, queso, pan y facturas.",
    items: [...LACTEOS, ...PANADERIA],
  },
  {
    id: "limpieza",
    name: "Limpieza",
    description: "Detergente y papel higiénico.",
    items: LIMPIEZA,
  },
  {
    id: "completo",
    name: "Completo",
    description: "Kiosco, almacén, bebidas, lácteos y limpieza.",
    items: [...BEBIDAS, ...ALMACEN, ...KIOSCO, ...LACTEOS, ...PANADERIA, ...LIMPIEZA, ...OTROS],
  },
];

export function catalogById(id?: string) {
  if (!id) return undefined;
  return GENERIC_CATALOGS.find((catalog) => catalog.id === id);
}

export function catalogLabel(id?: string) {
  return catalogById(id)?.name ?? "Sin catálogo";
}
