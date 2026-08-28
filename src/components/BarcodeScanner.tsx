import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Lightning, X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import { normalizeBarcode } from "../lib/barcode";

interface BarcodeScannerProps {
  open: boolean;
  title: string;
  hint: string;
  onClose: () => void;
  onDetected: (code: string) => void;
}

async function pickRearCamera(): Promise<string | MediaTrackConstraints> {
  try {
    const cameras = await Html5Qrcode.getCameras();
    const back = cameras.filter((c) => /back|rear|environment/i.test(c.label));
    const pool = back.length
      ? back
      : cameras.filter((c) => !/front|user|face/i.test(c.label));
    const main =
      pool.find((c) => /camera2\s*0/i.test(c.label)) ??
      pool.find((c) => !/ultra|wide|uw|macro|tele/i.test(c.label)) ??
      pool[0];
    if (main?.id) return main.id;
  } catch {
    /* el permiso todavía no está */
  }
  return { facingMode: "environment" };
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
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [focusHint, setFocusHint] = useState<{ x: number; y: number } | null>(null);
  const errorId = useId();

  useEffect(() => {
    if (!open) return;
    handledRef.current = false;
    setError("");
    setManual("");
    setTorchOn(false);
    setHasTorch(false);
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
        const camera = await pickRearCamera();
        await scanner.start(
          camera,
          {
            fps: 10,
            disableFlip: true,
            qrbox: (viewfinderWidth, viewfinderHeight) => ({
              width: Math.floor(viewfinderWidth * 0.86),
              height: Math.floor(Math.min(viewfinderHeight * 0.22, 200)),
            }),
          },
          (text) => {
            if (handledRef.current) return;
            handledRef.current = true;
            onDetectedRef.current(normalizeBarcode(text));
          },
          () => undefined,
        );
        if (cancelled) return;

        try {
          const features = scanner.getRunningTrackCameraCapabilities();
          setHasTorch(features.torchFeature().isSupported());
          const zoomFeature = features.zoomFeature();
          if (zoomFeature.isSupported()) {
            const min = zoomFeature.min();
            const max = zoomFeature.max();
            const standard = min <= 1 && 1 <= max ? 1 : min;
            await zoomFeature.apply(standard);
          }
        } catch {
          /* sin linterna */
        }
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        if (name === "NotAllowedError") {
          setError(
            "El navegador bloqueó la cámara. Permití el acceso en la configuración del sitio, o escribí el código.",
          );
        } else if (window.isSecureContext === false) {
          setError(
            "La cámara del celular necesita una conexión segura. Abrí el enlace https del sistema en este teléfono.",
          );
        } else {
          setError(
            "No se pudo abrir la cámara. Probá en Chrome y tocá Permitir cuando pida la cámara.",
          );
        }
      }
    }, 120);

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

  async function toggleTorch() {
    const scanner = scannerRef.current;
    if (!scanner) return;
    const next = !torchOn;
    try {
      await scanner.getRunningTrackCameraCapabilities().torchFeature().apply(next);
      setTorchOn(next);
    } catch {
      setHasTorch(false);
    }
  }

  async function focusAt(clientX: number, clientY: number, target: HTMLElement) {
    const video =
      target.querySelector("video") ??
      target.closest(".barcode-stage")?.querySelector("video");
    if (!video) return;
    const rect = video.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    setFocusHint({ x: clientX - rect.left, y: clientY - rect.top });
    window.setTimeout(() => setFocusHint(null), 700);

    const stream = video.srcObject;
    if (!(stream instanceof MediaStream)) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    const caps = track.getCapabilities() as MediaTrackCapabilities & {
      focusMode?: string[];
      pointsOfInterest?: boolean;
    };
    const advanced: Array<Record<string, unknown>> = [];
    if (caps.focusMode?.includes("continuous")) advanced.push({ focusMode: "continuous" });
    if (caps.pointsOfInterest) advanced.push({ pointsOfInterest: [{ x, y }] });
    if (!advanced.length) return;
    try {
      await track.applyConstraints({
        advanced: advanced as unknown as MediaTrackConstraintSet[],
      });
    } catch {
      /* el celular no soporta tap-to-focus */
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-ink text-white">
      <div
        className="relative min-h-0 flex-1"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button, input, label, form")) return;
          void focusAt(e.clientX, e.clientY, e.currentTarget);
        }}
      >
        <div id={readerId} className="barcode-stage absolute inset-0" />
        {focusHint ? (
          <span
            className="pointer-events-none absolute size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
            style={{ left: focusHint.x, top: focusHint.y }}
            aria-hidden="true"
          />
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-ink/80 to-transparent p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="pointer-events-auto flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring inline-flex size-12 items-center justify-center rounded-2xl bg-white/15"
              aria-label="Cerrar cámara"
            >
              <X size={26} aria-hidden="true" />
            </button>
            <h2 id={`${readerId}-title`} className="font-display min-w-0 flex-1 text-lg font-bold">
              {title}
            </h2>
            {hasTorch ? (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                aria-pressed={torchOn}
                className={`focus-ring inline-flex size-12 items-center justify-center rounded-2xl ${
                  torchOn ? "bg-accent text-on-accent" : "bg-white/15"
                }`}
                aria-label={torchOn ? "Apagar linterna" : "Prender linterna"}
              >
                <Lightning size={24} weight={torchOn ? "fill" : "regular"} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-[6.5rem] px-6 text-center text-sm font-semibold text-white drop-shadow">
          Poné el código en el centro, sin acercar demasiado el celular
        </p>
      </div>

      <div className="bg-ink px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {error ? (
          <div
            id={errorId}
            role="alert"
            tabIndex={-1}
            className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-destructive"
          >
            <p className="font-display font-semibold">No se pudo usar la cámara</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : (
          <p className="mb-3 text-sm text-white/80">{hint}</p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const code = normalizeBarcode(manual);
            if (code.length < 3) return;
            onDetected(code);
          }}
        >
          <label htmlFor={`${readerId}-manual`} className="text-sm font-semibold text-white">
            O escribí el código
          </label>
          <input
            id={`${readerId}-manual`}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            className="focus-ring mt-1.5 min-h-14 w-full rounded-2xl border-0 bg-white px-4 font-display text-lg tabular text-foreground"
            placeholder="Ej: 7790895000117"
            autoComplete="off"
            inputMode="numeric"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring min-h-14 rounded-2xl bg-white/15 text-base font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="focus-ring min-h-14 rounded-2xl bg-primary text-base font-bold text-on-primary"
            >
              Usar código
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
