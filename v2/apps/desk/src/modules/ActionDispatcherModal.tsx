import { Command } from "cmdk";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import {
  executeDeskAction,
  parseDeskAction,
} from "../lib/action-dispatcher";
import {
  exportBst3Csv,
  exportPoliceManifestPreferApi,
} from "../lib/compliance-export";
import { useFrontOfficeStore } from "../lib/front-office-store";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SUGGESTIONS = [
  "extend Karma by 2 nights MAP",
  "post laundry 450 to 102",
  "assign Yangphel to Floor 2",
  "check in 301",
  "assign rooms",
  "night audit",
  "export police",
  "export bst-3",
  "fast book",
  "open stayview",
] as const;

export function ActionDispatcherModal({ open, onOpenChange }: Props) {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const openFastBook = useFrontOfficeStore((s) => s.openFastBook);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const parsed = useMemo(() => parseDeskAction(query), [query]);

  const run = (raw?: string) => {
    const text = (raw ?? query).trim();
    if (!text) {
      toast.message("Type an action", {
        description: "Try: fast book · night audit · assign rooms",
      });
      return;
    }
    const result = parseDeskAction(text);
    void executeDeskAction(result.intent, {
      navigate,
      openFastBook: () => openFastBook(),
      exportPoliceManifest: () => {
        void exportPoliceManifestPreferApi().then((r) => {
          toast.success("Police manifest exported", {
            description: `${r.rows} row(s) · ${r.filename} · ${r.source}`,
          });
        });
      },
      exportBst3: () => {
        const r = exportBst3Csv();
        toast.success("BST-3 return exported", {
          description: r.filename,
        });
      },
    }).then((exec) => {
      if (!exec.ok) {
        toast.error("Action failed", { description: exec.error });
        return;
      }
      toast.success(exec.message, { description: result.preview });
      onOpenChange(false);
    });
  };

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[85] flex items-start justify-center px-4 pt-[10vh]">
          <motion.button
            type="button"
            aria-label="Close action dispatcher"
            className="absolute inset-0 z-0 bg-[rgba(15,23,42,0.45)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-label="Natural language action dispatcher"
            className="hos-surface-glass relative z-10 w-full max-w-lg overflow-hidden rounded-[20px] border border-[var(--hos-glass-border)] shadow-[var(--hos-elevated-shadow)] [transform:translateZ(0)] [backdrop-filter:blur(24px)]"
            initial={reduce ? false : { opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-[var(--hos-line)] px-4 py-3">
              <span className="flex size-8 items-center justify-center rounded-xl bg-[#111] text-white shadow-[0_6px_16px_-8px_#111]">
                <Sparkles className="size-4" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block text-[13px] font-bold tracking-tight text-[var(--hos-ink)]">
                  Action Dispatcher
                </strong>
                <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                  Natural language · local FO engine · ⌘J
                </p>
              </div>
              <button
                type="button"
                className="hos-btn-tactile rounded-lg border border-[var(--hos-line)] px-2 py-1 text-[11px] font-bold text-[var(--hos-ink-3)]"
                onClick={() => onOpenChange(false)}
              >
                esc
              </button>
            </div>

            {/* Suggestions live outside cmdk — cmdk was swallowing chip clicks. */}
            <div className="border-b border-[var(--hos-line)] px-3 py-2.5">
              <p className="m-0 mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--hos-ink-3)]">
                Try
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="hos-btn-tactile rounded-full border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--hos-ink-2)] hover:border-[color-mix(in_srgb,var(--hos-primary)_40%,transparent)] hover:text-[var(--hos-primary)]"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setQuery(s);
                      run(s);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <Command shouldFilter={false} label="Action dispatcher">
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="check in 301 · assign rooms · night audit…"
                className="h-12 w-full border-b border-[var(--hos-line)] bg-transparent px-4 text-[15px] text-[var(--hos-ink)] outline-none placeholder:text-[var(--hos-ink-3)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    run();
                  }
                }}
              />
              <Command.List className="max-h-[240px] overflow-auto p-2">
                {query.trim() ? (
                  <Command.Item
                    value={query}
                    onSelect={() => run()}
                    className="flex cursor-pointer flex-col gap-0.5 rounded-[12px] px-3 py-3 aria-selected:bg-[rgba(17,17,17,0.06)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--hos-ink)]">
                        {parsed.intent.kind === "unknown"
                          ? "No match"
                          : parsed.intent.label}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-[var(--hos-ink-3)]">
                        {Math.round(parsed.confidence * 100)}%
                      </span>
                    </div>
                    <span className="text-[12px] text-[var(--hos-ink-3)]">
                      {parsed.preview}
                    </span>
                    {parsed.intent.kind !== "unknown" ? (
                      <span className="mt-1 text-[11px] font-bold text-[var(--hos-primary)]">
                        Press Enter to run
                      </span>
                    ) : null}
                  </Command.Item>
                ) : (
                  <p className="m-0 px-3 py-4 text-center text-[12px] text-[var(--hos-ink-3)]">
                    Tap a chip above or type a desk phrase
                  </p>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
