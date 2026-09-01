import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { normalizeBarcode } from "./barcode";
import { getDb } from "./firebase";
import type { MasterProduct } from "../types";

export function isShareableBarcode(raw: string): boolean {
  return /^\d{8,14}$/.test(normalizeBarcode(raw));
}

export async function lookupMasterProduct(raw: string): Promise<MasterProduct | null> {
  const db = getDb();
  const code = normalizeBarcode(raw);
  if (!db || !isShareableBarcode(code)) return null;
  const snap = await getDoc(doc(db, "barcodes", code));
  if (!snap.exists()) return null;
  const data = snap.data();
  const name = String(data.name ?? "").trim();
  if (!name) return null;
  return {
    code,
    name,
    category: String(data.category ?? "").trim() || "Otros",
  };
}

export async function publishMasterProduct(
  raw: string,
  name: string,
  category: string,
): Promise<void> {
  const db = getDb();
  const code = normalizeBarcode(raw);
  const trimmed = name.trim();
  if (!db || !isShareableBarcode(code) || !trimmed) return;
  await setDoc(
    doc(db, "barcodes", code),
    {
      code,
      name: trimmed,
      category: category.trim() || "Otros",
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function saveProductCost(
  productId: string,
  businessId: string,
  costCents: number | undefined,
  markupPercent?: number,
): Promise<void> {
  const db = getDb();
  if (!db || !productId || !businessId) return;
  const ref = doc(db, "productCosts", productId);
  if (costCents == null || costCents <= 0) {
    await deleteDoc(ref).catch(() => undefined);
    return;
  }
  await setDoc(ref, {
    businessId,
    costCents,
    ...(markupPercent != null ? { markupPercent } : {}),
  });
}
