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
  focusDistance?: { min: number; max: number };
};

type Lens = "0.5" | "1" | "3";

const HD: MediaTrackConstraints = {
  width: { min: 1280, ideal: 1920 },
  height: { min: 720, ideal: 1080 },
  frameRate: { ideal: 30 },
};

function sleep(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}

async function getCamera(video: MediaTrackConstraints): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: false });
  } catch {
    const { width: _w, height: _h, ...fallback } = video;
    return navigator.mediaDevices.getUserMedia({ video: fallback, audio: false });
  }
}

function isFrontCam(label: string) {
  return /front|user|face|delantera|frontal|frente|selfie/i.test(label);
}

function isUltraWide(label: string) {
  return /ultra|uw|super.?wide|\b0\s*[.,]\s*5\b|panoram/i.test(label);
}

function isTeleCam(label: string) {
  return /tele|\b3\s*x\b|\b3\s*[.,]\s*0\b/i.test(label);
}

function isOneX(label: string) {
  return /\b1\s*[.,]\s*0\b|\b1\s*x\b/i.test(label);
}

function rearCameras(videos: MediaDeviceInfo[]) {
  const inputs = videos.filter((d) => d.kind === "videoinput");
  const labeledBack = inputs.filter((d) =>
    /back|rear|environment|trasera/i.test(d.label),
  );
  if (labeledBack.length) return labeledBack;
  return inputs.filter((d) => !isFrontCam(d.label));
}

/**
 * facingMode: environment en Samsung abre la 0.5x.
 * La 1.0x es otra cámara trasera, no esa.
 */
function pickLensDevice(
  rear: MediaDeviceInfo[],
  uwDeviceId: string,
  lens: Lens,
): string | undefined {
  if (!rear.length) return undefined;
  if (lens === "0.5") {
    return (
      rear.find((d) => isUltraWide(d.label))?.deviceId ??
      rear.find((d) => /camera2\s*0\b/i.test(d.label))?.deviceId ??
      uwDeviceId ??
      rear[0].deviceId
    );
  }
  if (lens === "3") {
    return (
      rear.find((d) => isTeleCam(d.label))?.deviceId ??
      rear.find((d) => /camera2\s*3\b/i.test(d.label))?.deviceId ??
      (rear.length >= 3 ? rear[2].deviceId : undefined)
    );
  }

  const named = rear.find(
    (d) => isOneX(d.label) && !isUltraWide(d.label) && !isTeleCam(d.label),
  );
  if (named) return named.deviceId;

  const samsungMain = rear.find((d) => /camera2\s*2\b/i.test(d.label));
  if (samsungMain) return samsungMain.deviceId;

  const notUw = rear.filter(
    (d) =>
      d.deviceId !== uwDeviceId &&
      !isUltraWide(d.label) &&
      !isTeleCam(d.label) &&
      !/camera2\s*0\b/i.test(d.label),
  );
  if (notUw.length) return notUw[0].deviceId;

  const anyOther = rear.find((d) => d.deviceId !== uwDeviceId && !isTeleCam(d.label));
  if (anyOther) return anyOther.deviceId;

  return rear.length >= 2 ? rear[1].deviceId : rear[0].deviceId;
}

async function setZoom(track: MediaStreamTrack, value: number) {
  try {
    await track.applyConstraints({ advanced: [{ zoom: value }] });
    return;
  } catch {
    /* probar sin advanced */
  }
  try {
    await track.applyConstraints({ zoom: value });
  } catch {
    /* sin zoom */
  }
}

/** En Samsung, zoom 1 suele ser la 0.5x; zoom 2 es la 1.0x. */
function zoomForLens(caps: TrackCaps, lens: Lens, onUwDefault: boolean): number | null {
  if (!caps.zoom) return null;
  const { min, max } = caps.zoom;
  if (lens === "0.5") return min;
  if (lens === "3") {
    if (min < 1 && max >= 3) return Math.min(max, 3);
    if (max >= 6) return 6;
    return max;
  }
  if (min < 1 && max >= 1) return 1;
  if (onUwDefault && max >= 2) return 2;
  if (min <= 1 && max >= 1) return 1;
  return Math.min(max, min * 2);
}

async function applyLensZoom(track: MediaStreamTrack, lens: Lens, onUwDefault: boolean) {
  const caps = track.getCapabilities() as TrackCaps;
  const target = zoomForLens(caps, lens, onUwDefault);
  if (target == null) return;
  await setZoom(track, target);
  await sleep(120);
  await setZoom(track, target);
  const after = (track.getSettings() as MediaTrackSettings & { zoom?: number }).zoom;
  if (lens === "1" && onUwDefault && caps.zoom && (after == null || after <= 1) && caps.zoom.max >= 2) {
    await setZoom(track, 2);
  }
}

async function applyHd(track: MediaStreamTrack) {
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
}

async function applyConstraint(track: MediaStreamTrack, advanced: MediaTrackConstraintSet) {
  try {
    await track.applyConstraints({ advanced: [advanced] });
    return true;
  } catch {
    try {
      await track.applyConstraints(advanced);
      return true;
    } catch {
      return false;
    }
  }
}

function canAutofocus(caps: TrackCaps) {
  return Boolean(
    caps.focusMode?.includes("continuous") ||
      caps.focusMode?.includes("single-shot") ||
      caps.focusDistance,
  );
}

/** Samsung no arranca el autofoco solo: hay que dispararlo al centro (o al toque). */
async function kickFocus(track: MediaStreamTrack, point = { x: 0.5, y: 0.5 }) {
  const caps = track.getCapabilities() as TrackCaps;
  const x = Math.min(1, Math.max(0, point.x));
  const y = Math.min(1, Math.max(0, point.y));
  const poi = caps.pointsOfInterest ? { pointsOfInterest: [{ x, y }] } : {};

  if (caps.focusDistance) {
    const near = Math.min(caps.focusDistance.max, Math.max(caps.focusDistance.min, 0.22));
    const primed: MediaTrackConstraintSet = { focusDistance: near, ...poi };
    if (caps.focusMode?.includes("manual")) primed.focusMode = "manual";
    await applyConstraint(track, primed);
    await sleep(160);
  }

  if (caps.focusMode?.includes("single-shot")) {
    await applyConstraint(track, { focusMode: "single-shot", ...poi });
    await sleep(320);
  }

  if (caps.focusMode?.includes("continuous")) {
    await applyConstraint(track, { focusMode: "continuous", ...poi });
    return;
  }

  if (caps.focusMode?.includes("single-shot")) {
    await applyConstraint(track, { focusMode: "single-shot", ...poi });
  }
}

async function holdContinuousFocus(track: MediaStreamTrack) {
  const caps = track.getCapabilities() as TrackCaps;
  if (!caps.focusMode?.includes("continuous")) return;
  await applyConstraint(track, {
    focusMode: "continuous",
    ...(caps.pointsOfInterest ? { pointsOfInterest: [{ x: 0.5, y: 0.5 }] } : {}),
  });
}

async function openLensStream(lens: Lens): Promise<{
  stream: MediaStream;
  onUwDefault: boolean;
  rear: MediaDeviceInfo[];
  uwDeviceId: string;
}> {
  const probe = await getCamera({ facingMode: { ideal: "environment" } });
  const devices = await navigator.mediaDevices.enumerateDevices();
  const rear = rearCameras(devices);
  const uwDeviceId = probe.getVideoTracks()[0]?.getSettings().deviceId ?? "";
  const wantedId = pickLensDevice(rear, uwDeviceId, lens);
  probe.getTracks().forEach((track) => track.stop());
  await sleep(400);

  const others = rear
    .map((d) => d.deviceId)
    .filter((id) => id && id !== uwDeviceId && id !== wantedId);
  const order = [...new Set([wantedId, ...others, uwDeviceId].filter(Boolean))] as string[];

  let fallback: { stream: MediaStream; onUwDefault: boolean } | null = null;
  for (const id of order) {
    try {
      if (fallback) {
        await sleep(350);
      }
      const stream = await getCamera({
        ...HD,
        deviceId: { exact: id },
      });
      const caps = stream.getVideoTracks()[0].getCapabilities() as TrackCaps;
      const isUw = id === uwDeviceId;
      if (lens === "1" && canAutofocus(caps) && !isUw) {
        fallback?.stream.getTracks().forEach((t) => t.stop());
        return { stream, onUwDefault: false, rear, uwDeviceId };
      }
      if (!fallback) fallback = { stream, onUwDefault: isUw };
      else stream.getTracks().forEach((t) => t.stop());
    } catch {
      await sleep(250);
    }
  }

  if (fallback) return { ...fallback, rear, uwDeviceId };

  const stream = await getCamera({
    ...HD,
    facingMode: { ideal: "environment" },
  });
  return { stream, onUwDefault: true, rear, uwDeviceId };
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
  const streamRef = useRef<MediaStream | null>(null);
  const rearRef = useRef<MediaDeviceInfo[]>([]);
  const uwDeviceIdRef = useRef("");
  const onUwDefaultRef = useRef(true);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const handledRef = useRef(false);

  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [focusHint, setFocusHint] = useState<{ x: number; y: number } | null>(null);
  const [lens, setLens] = useState<Lens>("1");
  const [showLenses, setShowLenses] = useState(false);

  useEffect(() => {
    if (!open) return;
    handledRef.current = false;
    setError("");
    setManual("");
    setTorchOn(false);
    setHasTorch(false);
    setLens("1");
    setShowLenses(false);
    let cancelled = false;
    let timer = 0;
    let focusTimer = 0;

    async function attach(stream: MediaStream, onUwDefault: boolean, activeLens: Lens) {
      const video = videoRef.current;
      if (!video) return;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      streamRef.current = stream;
      await applyHd(track);
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "true");
      await video.play();
      if (cancelled) return;
      await sleep(200);
      if (cancelled) return;
      await applyLensZoom(track, activeLens, onUwDefault);
      if (cancelled) return;
      await sleep(250);
      if (cancelled) return;
      await kickFocus(track);
      const caps = track.getCapabilities() as TrackCaps;
      setHasTorch(Boolean(caps.torch));
      setShowLenses(rearRef.current.length > 1 || Boolean(caps.zoom && caps.zoom.max > caps.zoom.min));
    }

    async function start() {
      const video = videoRef.current;
      if (!video) return;
      try {
        const opened = await openLensStream("1");
        if (cancelled) {
          opened.stream.getTracks().forEach((t) => t.stop());
          return;
        }
        rearRef.current = opened.rear;
        uwDeviceIdRef.current = opened.uwDeviceId;
        onUwDefaultRef.current = opened.onUwDefault;
        await attach(opened.stream, opened.onUwDefault, "1");
        if (!cancelled) {
          focusTimer = window.setInterval(() => {
            const live = trackRef.current;
            if (live) void holdContinuousFocus(live);
          }, 1600);
        }

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
      window.clearInterval(focusTimer);
      trackRef.current = null;
      const video = videoRef.current;
      if (video) video.srcObject = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  async function switchLens(next: Lens) {
    setLens(next);
    const video = videoRef.current;
    if (!video) return;
    const wantedId = pickLensDevice(rearRef.current, uwDeviceIdRef.current, next);
    const currentId = trackRef.current?.getSettings().deviceId;
    const stay = !wantedId || wantedId === currentId;

    if (stay) {
      const track = trackRef.current;
      if (track) {
        await applyLensZoom(track, next, onUwDefaultRef.current || wantedId === uwDeviceIdRef.current);
        await sleep(250);
        await kickFocus(track);
      }
      return;
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    await sleep(400);
    const stream = await getCamera({
      ...HD,
      deviceId: { exact: wantedId },
    });
    const onUw = wantedId === uwDeviceIdRef.current;
    onUwDefaultRef.current = onUw;
    await applyHd(stream.getVideoTracks()[0]);
    trackRef.current = stream.getVideoTracks()[0];
    streamRef.current = stream;
    video.srcObject = stream;
    await video.play();
    await sleep(200);
    await applyLensZoom(trackRef.current, next, onUw);
    await sleep(250);
    await kickFocus(trackRef.current);
    const caps = trackRef.current.getCapabilities() as TrackCaps;
    setHasTorch(Boolean(caps.torch));
  }

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
    setFocusHint({
      x: clientX - host.getBoundingClientRect().left,
      y: clientY - host.getBoundingClientRect().top,
    });
    window.setTimeout(() => setFocusHint(null), 600);
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    await kickFocus(track, { x, y });
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

        {showLenses ? (
          <div className="pointer-events-auto absolute inset-x-0 bottom-3 flex justify-center">
            <div className="flex items-center gap-2 rounded-full bg-black/55 px-2 py-1.5" role="group" aria-label="Lente de la cámara">
              {(["0.5", "1", "3"] as Lens[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => void switchLens(value)}
                  aria-pressed={lens === value}
                  className={`focus-ring min-h-10 min-w-12 rounded-full px-3 text-sm font-bold ${
                    lens === value ? "bg-white text-ink" : "text-white"
                  }`}
                >
                  {value}x
                </button>
              ))}
            </div>
          </div>
        ) : null}
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
