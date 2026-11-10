import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Printer, X } from "lucide-react";
import { Button } from "@hos-v2/ui";
import type { RateSheetPack } from "../lib/rate-sheet-share";
import { RateSheetPrintView } from "./RateSheetPrintView";

type Props = {
  open: boolean;
  onClose: () => void;
  pack: RateSheetPack;
  title?: string;
};

/**
 * Body-portaled print preview — fixed overlays inside ModuleFrame / motion
 * ancestors get clipped or miss clicks (same lesson as InvoiceModal).
 */
export function RateSheetPrintOverlay({ open, onClose, pack, title }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const heading =
    title ??
    `Print / Save PDF · ${pack.cards.map((c) => c.code).join(", ") || "sheet"} · ${pack.season} · ${pack.mealPlan}`;

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[200] flex flex-col bg-[rgba(15,23,42,0.55)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Print rate sheet"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-[var(--hos-canvas)] sm:mx-auto sm:my-3 sm:h-[min(96vh,960px)] sm:max-w-[920px] sm:rounded-2xl sm:border sm:border-[var(--hos-line)] sm:shadow-[0_40px_100px_-40px_rgba(15,23,42,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="hos-rate-print-chrome flex shrink-0 items-center gap-2 border-b border-[var(--hos-line)] bg-[var(--hos-surface)] px-3 py-2.5 sm:px-4">
          <Button
            size="sm"
            variant="secondary"
            className="hos-btn-tactile !min-h-10 shrink-0 !rounded-xl !px-3 font-semibold"
            onClick={onClose}
            aria-label="Back to rates"
          >
            <ArrowLeft className="size-4" strokeWidth={2.25} />
            Back
          </Button>
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--hos-ink)]">
            {heading}
          </p>
          <Button
            size="sm"
            className="hos-btn-ink !min-h-10 shrink-0 !rounded-xl !px-3"
            onClick={() => window.print()}
          >
            <Printer className="size-3.5" strokeWidth={2} />
            Print / PDF
          </Button>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="hos-btn-tactile hidden size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] sm:inline-flex"
          >
            <X className="size-4" strokeWidth={2.25} />
          </button>
        </header>

        <div className="hos-scrollbar-slim min-h-0 flex-1 overflow-auto py-4">
          <RateSheetPrintView pack={pack} printRoot />
        </div>
      </div>

      <style>{`
        @media print {
          .hos-rate-print-chrome { display: none !important; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
