import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose?: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ open, title, onClose, children, wide }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "button, [href], input, select, textarea",
      );
      focusable?.focus();
    }, 10);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && onClose) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-ink/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 shadow-[0_20px_25px_rgba(0,0,0,0.15)] sm:rounded-3xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-lg font-semibold text-foreground">
            {title}
          </h2>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="focus-ring inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="Cerrar"
            >
              <X size={18} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
