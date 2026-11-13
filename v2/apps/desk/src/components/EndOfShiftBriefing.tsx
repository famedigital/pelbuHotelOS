import { useMemo, useState, useTransition } from "react";
import { ClipboardCheck, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@hos-v2/ui";
import {
  buildBriefingDraft,
  fileBriefing,
  printBriefingHtml,
} from "../lib/dept-briefing";
import { readDeskStaff } from "../lib/desk-session";
import { useFrontOfficeStore } from "../lib/front-office-store";

/** Print / sign / file shift handover — mounts on dept homes. */
export function EndOfShiftBriefing({ className }: { className?: string }) {
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const staff = readDeskStaff();
  const draft = useMemo(
    () => buildBriefingDraft(staff?.deskRole),
    [staff?.deskRole, businessDate],
  );
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const propertySlug =
    localStorage.getItem("hos.v2.propertySlug")?.trim() || "demo-hotel";

  const onFile = (printed: boolean) => {
    startTransition(() => {
      try {
        const row = fileBriefing({
          propertySlug,
          businessDate,
          notes,
          printed,
          deskRole: staff?.deskRole,
        });
        if (printed) {
          printBriefingHtml(row);
        }
        toast.success(printed ? "Briefing printed & filed" : "Briefing filed", {
          description: `${row.shiftLabel} · ${row.dept}`,
        });
        setNotes("");
      } catch (err) {
        console.error("[briefing] file", err);
        toast.error(err instanceof Error ? err.message : "Could not file briefing");
      }
    });
  };

  return (
    <section
      className={[
        "hos-glass-card rounded-[16px] border border-[var(--hos-glass-border)] p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]",
        className ?? "",
      ].join(" ")}
      aria-label="End of shift briefing"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="m-0 text-[13px] font-bold tracking-tight text-[var(--hos-ink)]">
            End of shift · {draft.shiftLabel}
          </h2>
          <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-2)]">
            {draft.dept.toUpperCase()} handover · print, sign, file
          </p>
        </div>
        <ClipboardCheck className="size-4 shrink-0 text-[var(--hos-primary)]" aria-hidden />
      </div>
      {draft.rhythmNote ? (
        <p className="m-0 mb-2 rounded-lg bg-[color-mix(in_srgb,var(--hos-primary)_10%,transparent)] px-2 py-1.5 text-[11px] font-medium text-[var(--hos-ink)]">
          {draft.rhythmNote}
        </p>
      ) : null}
      <ul className="m-0 mb-2 list-disc space-y-0.5 pl-4 text-[11px] text-[var(--hos-ink-2)]">
        {draft.checklist.slice(0, 5).map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <textarea
        className="mb-2 w-full resize-y rounded-[10px] border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-2 text-[12px] text-[var(--hos-ink)]"
        rows={2}
        placeholder="Handover notes (VIP, cash variance, open tickets…)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
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
      </div>
    </section>
  );
}
