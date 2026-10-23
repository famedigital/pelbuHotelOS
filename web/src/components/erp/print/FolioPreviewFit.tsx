"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const MM_TO_PX = 96 / 25.4;

/** Screen preview of an A4 sheet, scaled to the desk pane. Print stays full size. */
export function FolioPreviewFit({
  toolbar,
  children,
}: {
  toolbar: ReactNode;
  children: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.55);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fit = () => {
      const pad = 12;
      const width = Math.max(0, el.clientWidth - pad);
      const height = Math.max(0, el.clientHeight - pad);
      const next = Math.min(width / (210 * MM_TO_PX), height / (297 * MM_TO_PX));
      setZoom(Number.isFinite(next) && next > 0.2 ? next : 0.55);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="folio-print-stage flex h-[calc(100svh-6.5rem-env(safe-area-inset-bottom))] max-h-[calc(100svh-6.5rem-env(safe-area-inset-bottom))] flex-col overflow-hidden bg-[#d9d1c6] md:h-[calc(100svh-4.5rem)] md:max-h-[calc(100svh-4.5rem)] print:block print:h-auto print:max-h-none print:overflow-visible print:bg-white">
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-2 print:hidden">
        {toolbar}
      </div>
      <div ref={frame} className="flex min-h-0 flex-1 justify-center overflow-hidden print:block print:overflow-visible">
        <div className="folio-fit-zoom h-fit" style={{ zoom }}>
          {children}
        </div>
      </div>
    </div>
  );
}
