import { useEffect, useRef } from "react";
import { normalizeBarcode } from "../lib/barcode";

const CHAR_GAP_MS = 50;
const SCAN_TRAIL_MS = 120;
const MIN_LEN = 4;

/**
 * Lee lectoras USB/Bluetooth que se comportan como teclado (terminan con Enter).
 */
export function useHidScanner(enabled: boolean, onScan: (code: string) => void) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    let buffer = "";
    let last = 0;

    function emit(code: string) {
      const normalized = normalizeBarcode(code);
      if (normalized.length < MIN_LEN) return;
      onScanRef.current(normalized);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter") {
        const fastScan = buffer.length >= MIN_LEN && Date.now() - last < SCAN_TRAIL_MS;
        if (fastScan) {
          e.preventDefault();
          const code = buffer;
          buffer = "";
          emit(code);
        }
        return;
      }

      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) {
        if (e.key !== "Shift") buffer = "";
        return;
      }

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isField =
        tag === "INPUT" || tag === "TEXTAREA" || Boolean(target?.isContentEditable);
      const isSearch =
        target instanceof HTMLInputElement && target.dataset.barcodeTarget === "true";

      const now = Date.now();
      if (now - last > CHAR_GAP_MS) buffer = e.key;
      else buffer += e.key;
      last = now;

      if (isField && !isSearch) {
        buffer = "";
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);
}
