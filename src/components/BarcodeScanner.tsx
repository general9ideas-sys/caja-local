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

type TrackCaps = MediaTrackCapabilities & {
  focusMode?: string[];
  torch?: boolean;
  zoom?: { min: number; max: number };
  pointsOfInterest?: boolean;
};

const HD: MediaTrackConstraints = {
  width: { min: 1280, ideal: 1920 },
  height: { min: 720, ideal: 1080 },
  frameRate: { ideal: 30 },
};

async function getCamera(video: MediaTrackConstraints): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: false });
  } catch {
    const { width: _w, height: _h, ...fallback } = video;
    return navigator.mediaDevices.getUserMedia({ video: fallback, audio: false });
  }
}

async function openRearStream(): Promise<MediaStream> {
  let stream = await getCamera({
    ...HD,
    facingMode: { ideal: "environment" },
  });
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videos = devices.filter((d) => d.kind === "videoinput");
  const main =
    videos.find((d) => /camera2\s*0/i.test(d.label)) ??
    videos.find(
      (d) =>
        /back|rear|environment/i.test(d.label) &&
        !/ultra|wide|uw|tele|macro/i.test(d.label),
    ) ??
    videos.find((d) => /back|rear|environment/i.test(d.label));

  const currentId = stream.getVideoTracks()[0]?.getSettings().deviceId;
  if (main?.deviceId && main.deviceId !== currentId) {
    stream.getTracks().forEach((track) => track.stop());
    stream = await getCamera({
      ...HD,
      deviceId: { exact: main.deviceId },
    });
  }
  return stream;
}

async function applyHdAndZoom(track: MediaStreamTrack) {
  const caps = track.getCapabilities() as TrackCaps;
  try {
    if (caps.width?.max && caps.height?.max) {
      await track.applyConstraints({
        width: Math.min(1920, caps.width.max),
        height: Math.min(1080, caps.height.max),
      });
    }
  } catch {
    /* algunos S20 ignoran el tamaño */
  }

  try {
    if (caps.zoom && caps.zoom.min <= 1 && caps.zoom.max >= 1) {
      await track.applyConstraints({
        advanced: [{ zoom: 1 }],
      });
    }
  } catch {
    /* sin control de zoom */
  }
}

async function applyContinuousFocus(track: MediaStreamTrack) {
  const caps = track.getCapabilities() as TrackCaps;
  try {
    if (caps.focusMode?.includes("continuous")) {
      await track.applyConstraints({
        advanced: [{ focusMode: "continuous" }],
      });
    }
  } catch {
    /* el autofoco lo maneja el sistema */
  }
}

export function BarcodeScanner({
  open,
  title,
  hint,
  onClose,
  onDetected,
}: BarcodeScannerProps) {
  const titleId = useId();
  const manualId = useId();
  const errorId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const handledRef = useRef(false);

  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [focusHint, setFocusHint] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    handledRef.current = false;
    setError("");
    setManual("");
    setTorchOn(false);
    setHasTorch(false);
    let cancelled = false;
    let timer = 0;
    let stream: MediaStream | null = null;

    async function start() {
      const video = videoRef.current;
      if (!video) return;
      try {
        stream = await openRearStream();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        await applyHdAndZoom(track);
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "true");
        await video.play();
        if (cancelled) return;
        await new Promise((r) => window.setTimeout(r, 200));
        if (cancelled) return;
        await applyContinuousFocus(track);
        const caps = track.getCapabilities() as TrackCaps;
        setHasTorch(Boolean(caps.torch));

        const Detector = window.BarcodeDetector;
        let detector: BarcodeDetector | null = null;
        if (Detector) {
          const wanted = [
            "ean_13",
            "ean_8",
            "upc_a",
            "upc_e",
            "code_128",
            "code_39",
            "itf",
            "qr_code",
          ];
          try {
            const supported = await Detector.getSupportedFormats();
            const formats = wanted.filter((f) => supported.includes(f));
            detector = new Detector(formats.length ? { formats } : undefined);
          } catch {
            detector = new Detector();
          }
        }

        const tick = async () => {
          if (cancelled || handledRef.current || !detector || video.readyState < 2) {
            if (!cancelled && !handledRef.current) timer = window.setTimeout(tick, 250);
            return;
          }
          try {
            const codes = await detector.detect(video);
            const value = codes[0]?.rawValue;
            if (value) {
              handledRef.current = true;
              onDetectedRef.current(normalizeBarcode(value));
              return;
            }
          } catch {
            /* frame no listo */
          }
          if (!cancelled && !handledRef.current) timer = window.setTimeout(tick, 250);
        };
        timer = window.setTimeout(tick, 400);
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError") {
          setError(
            "El navegador bloqueó la cámara. Permití el acceso en Chrome y volvé a intentar.",
          );
        } else {
          setError("No se pudo abrir la cámara. Probá de nuevo en Chrome.");
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      trackRef.current = null;
      const video = videoRef.current;
      if (video) video.srcObject = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      setHasTorch(false);
    }
  }

  async function focusAt(clientX: number, clientY: number, host: HTMLElement) {
    const video = videoRef.current;
    const track = trackRef.current;
    if (!video || !track) return;
    const rect = video.getBoundingClientRect();
    setFocusHint({ x: clientX - host.getBoundingClientRect().left, y: clientY - host.getBoundingClientRect().top });
    window.setTimeout(() => setFocusHint(null), 600);
    const caps = track.getCapabilities() as TrackCaps;
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    try {
      if (caps.focusMode?.includes("continuous")) {
        await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
      }
      if (caps.pointsOfInterest) {
        await track.applyConstraints({ advanced: [{ pointsOfInterest: [{ x, y }] }] });
      }
    } catch {
      /* sin tap-to-focus */
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-ink text-white">
      <div
        className="relative min-h-0 flex-1 bg-ink"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button, input, label, form")) return;
          void focusAt(e.clientX, e.clientY, e.currentTarget);
        }}
      >
        <video
          ref={videoRef}
          className="h-full w-full bg-ink object-contain"
          autoPlay
          muted
          playsInline
          controls={false}
        />
        {focusHint ? (
          <span
            className="pointer-events-none absolute size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
            style={{ left: focusHint.x, top: focusHint.y }}
            aria-hidden="true"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-28 w-[88%] rounded-xl border-2 border-white/80" />
        </div>

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
            <h2 id={titleId} className="font-display min-w-0 flex-1 text-lg font-bold">
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
          <label htmlFor={manualId} className="text-sm font-semibold text-white">
            O escribí el código
          </label>
          <input
            id={manualId}
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
