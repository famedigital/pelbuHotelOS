"use client";

import { DocPrintControls } from "@/components/erp/DocPrintControls";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { DocumentPaperSize } from "@/lib/property-settings";
import { ChevronDown, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const MM_TO_PX = 96 / 25.4;
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2;

export type FolioPreviewMode = "width" | "page" | "continuous";

export type FolioPreviewGroupItem = {
  id: string;
  href: string;
  label: string;
  meta: string;
  active: boolean;
  agent?: string | null;
  rooms?: string | null;
  amount?: string | null;
};

export type FolioPreviewGroupSection = {
  title: string;
  items: FolioPreviewGroupItem[];
};

const FIT_LABEL: Record<FolioPreviewMode, string> = {
  width: "Fit width",
  page: "Fit page",
  continuous: "Continuous",
};

/** Screen preview of the bill. Print stays full size, one sheet after another. */
export function FolioPreviewFit({
  backHref,
  backLabel = "Back",
  group,
  printLabel = "Print / PDF",
  allowThermal = false,
  initialMode = "page",
  fullPage: _fullPage = false,
  toolbar,
  children,
}: {
  backHref: string;
  backLabel?: string;
  group?: {
    title: string;
    printHref?: string;
    items?: FolioPreviewGroupItem[];
    sections?: FolioPreviewGroupSection[];
  };
  printLabel?: string;
  /** 80mm only on the food bill. Room and tax papers stay A4. */
  allowThermal?: boolean;
  initialMode?: FolioPreviewMode;
  /** Group print has no desk chrome, so the preview uses the whole window. */
  fullPage?: boolean;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const sheets = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<FolioPreviewMode>(initialMode);
  const [customZoom, setCustomZoomFlag] = useState(false);
  const [paper, setPaper] = useState<DocumentPaperSize>("a4");
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [pageText, setPageText] = useState("1");

  useEffect(() => {
    const el = frame.current;
    if (!el || customZoom) return;
    const fit = () => {
      const pad = mode === "page" ? 28 : 36;
      const width = Math.max(0, el.clientWidth - pad);
      const height = Math.max(0, el.clientHeight - pad);
      const pageWidth = (paper === "thermal" ? 80 : 210) * MM_TO_PX;
      const pageHeight = (paper === "thermal" ? 200 : 297) * MM_TO_PX;
      const byWidth = width / pageWidth;
      const next = mode === "page" ? Math.min(byWidth, height / pageHeight) : byWidth;
      setZoom(Number.isFinite(next) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)) : 1);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode, paper, customZoom]);

  useEffect(() => {
    const root = sheets.current;
    const frameEl = frame.current;
    if (!root || !frameEl) return;
    const nodes = () => [...root.querySelectorAll<HTMLElement>(".folio-a4")];
    const count = () => {
      const total = nodes().length;
      setPageCount(Math.max(1, total));
    };
    const onScroll = () => {
      const list = nodes();
      if (!list.length) return;
      const mark = frameEl.getBoundingClientRect().top + Math.min(96, frameEl.clientHeight * 0.28);
      let current = 1;
      list.forEach((node, index) => {
        if (node.getBoundingClientRect().top <= mark) current = index + 1;
      });
      setPage(current);
      setPageText(String(current));
    };
    count();
    onScroll();
    const observer = new MutationObserver(() => {
      count();
      onScroll();
    });
    observer.observe(root, { childList: true, subtree: true });
    frameEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      frameEl.removeEventListener("scroll", onScroll);
    };
  }, [mode, zoom]);

  function chooseFit(next: FolioPreviewMode) {
    setCustomZoomFlag(false);
    setMode(next);
  }

  function setCustomZoom(value: number) {
    setCustomZoomFlag(true);
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)));
  }

  function goTo(next: number) {
    const frameEl = frame.current;
    const list = sheets.current?.querySelectorAll<HTMLElement>(".folio-a4");
    const target = Math.min(Math.max(1, next), list?.length || 1);
    const node = list?.[target - 1];
    setPage(target);
    setPageText(String(target));
    if (!frameEl || !node) return;
    const delta = node.getBoundingClientRect().top - frameEl.getBoundingClientRect().top;
    frameEl.scrollTo({ top: frameEl.scrollTop + delta - 12, behavior: "smooth" });
  }

  const percent = Math.round(zoom * 100);

  return (
    <div
      data-paper={paper}
      className={cn(
        "desk-print-flow folio-print-stage flex flex-col overflow-hidden bg-[#d9d1c6] print:block print:h-auto print:max-h-none print:overflow-visible print:bg-white",
        "h-full min-h-0 flex-1",
      )}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <header className="print-hide flex shrink-0 items-center gap-2 border-b bg-[#f6f1ea] px-3 py-1.5 print:hidden">
          <a href={backHref} className="shrink-0 text-sm font-medium underline-offset-4 hover:underline">
            {backLabel}
          </a>
          {group ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border bg-card px-2.5 text-xs font-medium">
                {group.title}
                <ChevronDown className="size-3.5 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[min(92vw,46rem)] overflow-hidden p-0">
                {group.printHref ? (
                  <div className="border-b px-3 py-2">
                    <DropdownMenuItem asChild className="px-0">
                      <a href={group.printHref} className="text-sm font-medium">
                        Print group
                      </a>
                    </DropdownMenuItem>
                  </div>
                ) : null}
                <div
                  className="grid max-h-[min(70vh,32rem)] overflow-hidden"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, (group.sections ?? [{ title: "", items: group.items ?? [] }]).length)}, minmax(0, 1fr))`,
                  }}
                >
                  {(group.sections?.length
                    ? group.sections
                    : [{ title: "", items: group.items ?? [] }]
                  ).map((section) => (
                    <div key={section.title || "list"} className="min-w-0 overflow-y-auto border-r last:border-r-0">
                      {section.title ? (
                        <p className="sticky top-0 z-10 border-b bg-[#f6f1ea] px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          {section.title}
                        </p>
                      ) : null}
                      {section.items.length ? (
                        section.items.map((item) => (
                          <DropdownMenuItem key={item.id} asChild className="items-start rounded-none px-0 py-0">
                            <a
                              href={item.href}
                              className={cn(
                                "block w-full px-3 py-2",
                                item.active && "bg-emerald-100",
                              )}
                            >
                              <span className="block truncate text-sm font-medium">{item.label}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {item.agent?.trim() || "Direct"}
                              </span>
                              <span className="mt-0.5 flex items-baseline justify-between gap-2 text-xs">
                                <span className="truncate text-muted-foreground">
                                  {item.rooms?.trim() || item.meta}
                                </span>
                                {item.amount ? (
                                  <span className="shrink-0 font-medium tabular-nums">{item.amount}</span>
                                ) : null}
                              </span>
                            </a>
                          </DropdownMenuItem>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-xs text-muted-foreground">None</p>
                      )}
                    </div>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {toolbar ? (
            <div className="min-w-0 flex-1 [&_p]:line-clamp-2 [&_p]:max-w-none">{toolbar}</div>
          ) : null}
        </header>

        <div
          ref={frame}
          className={cn(
            "folio-print-frame min-h-0 flex-1",
            mode === "page"
              ? "flex items-start justify-center overflow-auto"
              : "flex items-start justify-center overflow-auto px-3 py-3",
          )}
        >
          <div
            ref={sheets}
            className={cn(
              "desk-print-flow folio-fit-zoom",
              mode === "continuous" && "flex flex-col items-center gap-4",
            )}
            style={{ zoom }}
          >
            {children}
          </div>
        </div>

        <div className="print-hide flex shrink-0 justify-center border-t bg-[#f6f1ea] px-3 py-2 print:hidden">
          <div className="flex max-w-full flex-wrap items-center justify-center gap-1">
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full text-[#1a1410] hover:bg-black/5 disabled:opacity-30"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => goTo(page - 1)}
            >
              <ChevronLeft className="size-4" />
            </button>
            <label className="flex items-center gap-1 text-xs text-[#1a1410]">
              <span className="sr-only">Page</span>
              <input
                inputMode="numeric"
                aria-label="Page number"
                className="h-7 w-8 rounded border bg-white text-center text-xs"
                value={pageText}
                onChange={(event) => setPageText(event.target.value.replace(/\D/g, "").slice(0, 3))}
                onBlur={() => goTo(Number(pageText) || page)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") goTo(Number(pageText) || page);
                }}
              />
              <span className="pr-1 text-muted-foreground">/ {pageCount}</span>
            </label>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full text-[#1a1410] hover:bg-black/5 disabled:opacity-30"
              aria-label="Next page"
              disabled={page >= pageCount}
              onClick={() => goTo(page + 1)}
            >
              <ChevronRight className="size-4" />
            </button>

            <span className="mx-0.5 h-5 w-px bg-[#1a1410]/15" />

            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full hover:bg-black/5"
              aria-label="Zoom out"
              onClick={() => setCustomZoom(zoom - 0.1)}
            >
              <Minus className="size-3.5" />
            </button>
            <input
              type="range"
              min={Math.round(ZOOM_MIN * 100)}
              max={Math.round(ZOOM_MAX * 100)}
              step={5}
              value={percent}
              aria-label="Zoom"
              className="h-7 w-24 accent-[#1a1410]"
              onChange={(event) => setCustomZoom(Number(event.target.value) / 100)}
            />
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full hover:bg-black/5"
              aria-label="Zoom in"
              onClick={() => setCustomZoom(zoom + 0.1)}
            >
              <Plus className="size-3.5" />
            </button>
            <span className="w-10 text-center text-xs tabular-nums">{percent}%</span>

            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs font-medium hover:bg-black/5">
                {customZoom ? "Custom" : FIT_LABEL[mode]}
                <ChevronDown className="size-3.5 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(FIT_LABEL) as FolioPreviewMode[]).map((id) => (
                  <DropdownMenuItem key={id} onSelect={() => chooseFit(id)}>
                    {FIT_LABEL[id]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DocPrintControls
              defaultSize="a4"
              allowThermal={allowThermal}
              printLabel={printLabel}
              onSizeChange={setPaper}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
