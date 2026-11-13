import { useEffect, useMemo, useState, useTransition } from "react";
import { ClipboardCheck, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@hos-v2/ui";
import {
  buildBriefingDraft,
  fileBriefing,
  listBriefings,
  printBriefingHtml,
  type BriefingFile,
} from "../lib/dept-briefing";
import { readDeskProperty, readDeskStaff } from "../lib/desk-session";
import { useFrontOfficeStore } from "../lib/front-office-store";

type EndOfShiftBriefingProps = {
  className?: string;
  triggerLabel?: string;
  /** Hide the default trigger when a parent renders its own open control. */
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * FO / dept end-of-shift handover as a modal.
 * Never mount the form inline on Desk — the Today board stays the hero.
 */
export function EndOfShiftBriefing({
  className,
  triggerLabel = "End of shift",
  hideTrigger = false,
  open: openControlled,
  onOpenChange,
}: EndOfShiftBriefingProps) {
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const staff = readDeskStaff();
  const property = readDeskProperty();
  const draft = useMemo(
    () => buildBriefingDraft(staff?.deskRole),
    [staff?.deskRole, businessDate],
  );
  const [openUncontrolled, setOpenUncontrolled] = useState(false);
  const open = openControlled ?? openUncontrolled;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openControlled === undefined) setOpenUncontrolled(next);
  };
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [filedTick, setFiledTick] = useState(0);

  const propertySlug =
    property?.slug?.trim() ||
    localStorage.getItem("hos.v2.propertySlug")?.trim() ||
    "demo-hotel";

  const filedToday = useMemo(() => {
    void filedTick;
    return listBriefings(propertySlug, businessDate);
  }, [propertySlug, businessDate, filedTick]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onFile = (printed: boolean) => {
    const trimmed = notes.trim();
    if (!trimmed) {
      toast.error("Type a handover note before filing");
      return;
    }
    startTransition(() => {
      try {
        const row = fileBriefing({
          propertySlug,
          businessDate,
          notes: trimmed,
          printed,
          deskRole: staff?.deskRole,
        });
        if (printed) {
          printBriefingHtml(row);
        }
        setFiledTick((n) => n + 1);
        toast.success(printed ? "Briefing printed & filed" : "Briefing filed", {
          description: `${row.shiftLabel} · saved under ${propertySlug} · ${row.notes.slice(0, 80)}${row.notes.length > 80 ? "…" : ""}`,
        });
        setNotes("");
        setOpen(false);
      } catch (err) {
        console.error("[briefing] file", err);
        toast.error(err instanceof Error ? err.message : "Could not file briefing");
      }
    });
  };

  const reprint = (row: BriefingFile) => {
    try {
      printBriefingHtml(row);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Print blocked");
    }
  };

  return (
    <>
      {hideTrigger ? null : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={["hos-btn-tactile shrink-0", className ?? ""].join(" ")}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <ClipboardCheck className="mr-1.5 size-3.5" aria-hidden />
          {triggerLabel}
          <span className="ml-1.5 hidden font-normal text-[var(--hos-ink-3)] sm:inline">
            · {draft.shiftLabel}
          </span>
          {filedToday.length > 0 ? (
            <span className="ml-1.5 rounded-full bg-[color-mix(in_srgb,var(--hos-emerald)_18%,transparent)] px-1.5 font-mono text-[10px] tabular-nums text-[var(--hos-emerald)]">
              {filedToday.length}
            </span>
          ) : null}
        </Button>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(15,23,42,0.55)] p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`End of shift · ${draft.shiftLabel}`}
            className="hos-glass-card max-h-[min(92vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--hos-glass-border)] p-4 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.55),inset_0_1px_1px_rgba(255,255,255,0.15)]"
            style={{ transform: "translateZ(0)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="m-0 text-[15px] font-bold tracking-tight text-[var(--hos-ink)]">
                  End of shift · {draft.shiftLabel}
                </h2>
                <p className="m-0 mt-0.5 text-[12px] text-[var(--hos-ink-2)]">
                  {draft.dept.toUpperCase()} handover · print, sign, file · {businessDate}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]"
                aria-label="Close end of shift"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            {draft.rhythmNote ? (
              <p className="m-0 mb-3 rounded-lg bg-[color-mix(in_srgb,var(--hos-primary)_10%,transparent)] px-2.5 py-2 text-[12px] font-medium text-[var(--hos-ink)]">
                {draft.rhythmNote}
              </p>
            ) : null}

            <ul className="m-0 mb-3 list-disc space-y-1 pl-4 text-[12px] text-[var(--hos-ink-2)]">
              {draft.checklist.slice(0, 8).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>

            <textarea
              className="mb-3 w-full resize-y rounded-[12px] border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5 text-[13px] text-[var(--hos-ink)]"
              rows={3}
              placeholder="Handover notes (VIP, cash variance, open tickets…)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoFocus
            />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={pending}
                onClick={() => onFile(true)}
              >
                <Printer className="mr-1 size-3.5" aria-hidden />
                Print &amp; file
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => onFile(false)}
              >
                File only
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>

            {filedToday.length > 0 ? (
              <div className="mt-4 border-t border-[var(--hos-line)] pt-3">
                <p className="m-0 mb-1.5 text-[11px] font-semibold text-[var(--hos-ink)]">
                  Filed today ({filedToday.length})
                </p>
                <ul className="m-0 max-h-36 list-none space-y-1.5 overflow-y-auto p-0">
                  {filedToday.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-start justify-between gap-2 rounded-lg bg-[var(--hos-cell)] px-2.5 py-2 text-[12px]"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--hos-ink)]">
                          {row.shiftLabel}
                          {row.printed ? " · printed" : " · filed"}
                        </div>
                        <div className="truncate text-[var(--hos-ink-3)]">
                          {row.notes || "(no note text)"}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="shrink-0"
                        onClick={() => reprint(row)}
                      >
                        Print
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="m-0 mt-3 text-[11px] text-[var(--hos-ink-3)]">
                Empty notes are blocked. Filed handovers for {businessDate} show here.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
