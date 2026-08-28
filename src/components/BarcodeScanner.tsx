import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useEffect, useId, useRef, useState } from "react";
import { normalizeBarcode } from "../lib/barcode";

interface BarcodeScannerProps {
  open: boolean;
  title: string;
  hint: string;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function BarcodeScanner({
  open,
  title,
  hint,
  onClose,
  onDetected,
}: BarcodeScannerProps) {
  const boxId = useId().replace(/:/g, "");
  const readerId = `barcode-reader-${boxId}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const errorId = useId();

  useEffect(() => {
    if (!open) return;
    handledRef.current = false;
    setError("");
    setManual("");
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      const el = document.getElementById(readerId);
      if (!el || cancelled) return;
      const scanner = new Html5Qrcode(readerId, {
        verbose: false,
        useBarCodeDetectorIfSupported: true,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
      });
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 8,
            qrbox: (viewfinderWidth, viewfinderHeight) => ({
              width: Math.floor(Math.min(viewfinderWidth * 0.9, 360)),
              height: Math.floor(Math.min(viewfinderHeight * 0.28, 140)),
            }),
          },
          (text) => {
            if (handledRef.current) return;
            handledRef.current = true;
            onDetectedRef.current(normalizeBarcode(text));
          },
          () => undefined,
        );
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        if (name === "NotAllowedError") {
          setError(
            "El navegador bloqueó la cámara. Permití el acceso en la configuración del sitio, o usá una lectora USB / escribí el código.",
          );
        } else if (window.isSecureContext === false) {
          setError(
            "La cámara del celular necesita una conexión segura. Abrí el sistema en este mismo teléfono, o enchufá una lectora USB a la computadora.",
          );
        } else {
          setError(
            "No se pudo abrir la cámara. Probá en Chrome o Safari, o usá una lectora USB.",
          );
        }
      }
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => undefined);
      }
    };
  }, [open, readerId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${readerId}-title`}
        className="relative z-10 max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 sm:max-w-lg sm:rounded-3xl"
      >
        <h2 id={`${readerId}-title`} className="font-display text-xl font-semibold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>

        {error ? (
          <div
            id={errorId}
            role="alert"
            tabIndex={-1}
            className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-destructive"
          >
            <p className="font-display font-semibold">No se pudo usar la cámara</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : null}

        <div
          id={readerId}
          className="mt-4 min-h-[220px] overflow-hidden rounded-2xl bg-ink [&_img]:hidden [&_video]:h-auto [&_video]:w-full"
        />

        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const code = normalizeBarcode(manual);
            if (code.length < 3) return;
            onDetected(code);
          }}
        >
          <label htmlFor={`${readerId}-manual`} className="text-sm font-semibold">
            O escribí el código
          </label>
          <input
            id={`${readerId}-manual`}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-2xl border border-border bg-background px-4 py-3 font-display tabular"
            placeholder="Ej: 7790895000117"
            autoComplete="off"
            inputMode="numeric"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring min-h-12 rounded-2xl bg-muted font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="focus-ring min-h-12 rounded-2xl bg-primary font-bold text-on-primary hover:bg-primary-dark"
            >
              Usar código
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
