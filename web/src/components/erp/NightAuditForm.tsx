"use client";

import { runNightAudit, type ErpFolioOpsState } from "@/app/actions/erp-folio-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState, useState } from "react";

const initial: ErpFolioOpsState = { ok: false };

const CHECKLIST = [
  "Close all open POS shifts (settle or void every ticket).",
  "Review in-house folios — post payments or comps before roll if needed.",
  "Confirm HK has updated room statuses (dirty/clean) on departures.",
  "Run once per business date — automatic cron also runs at midnight Thimphu.",
];

const OUTCOMES = [
  "Posts room rent for every checked-in sellable room (idempotent — skips if already posted).",
  "Snapshots occupancy: sellable rooms vs guide/driver comp beds.",
  "Totals folio charges and payments posted on the business date.",
  "Counts open folios still carrying a balance.",
  "Emails + stores a full hotel Excel backup (ops + settings) for continuity.",
  "Fails loudly if any room-night post errors — nothing is saved for that date.",
];

export function NightAuditForm({ defaultDate }: { defaultDate: string }) {
  const [state, action, pending] = useActionState(runNightAudit, initial);
  const [downloadDate, setDownloadDate] = useState(defaultDate);
  useActionToast(state, { successMessage: "Night audit complete" });
  return (
    <form action={action} className="erp space-y-4 rounded-lg border bg-card p-4">
      <div>
        <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Close day (night audit)
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Manager action — rolls the business date, posts room nights to open
          folios, and saves an audit record. In-house guests may show balance Nu
          0 until this runs; that is expected.
        </p>
      </div>

      <div className="rounded-md border bg-muted/30 p-3">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Before you run
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          {CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-md border bg-muted/30 p-3">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          What this does
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          {OUTCOMES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="business_date" className="text-xs text-muted-foreground">
          Business date
        </Label>
        <Input
          id="business_date"
          type="date"
          name="business_date"
          defaultValue={defaultDate}
          required
          onChange={(e) => setDownloadDate(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-xs text-muted-foreground">
          Notes (optional)
        </Label>
        <Input id="notes" name="notes" placeholder="e.g. Manual run before cron" />
      </div>
      <Button type="submit" variant="citrus" disabled={pending} className="h-10 w-full">
        {pending ? "Running…" : "Complete night audit"}
      </Button>
      <Button asChild variant="outline" className="h-10 w-full">
        <a
          href={`/api/erp/night-audit/continuity?date=${encodeURIComponent(downloadDate)}`}
          download
        >
          Download hotel backup
        </a>
      </Button>
      {state.ok || state.error ? (
        <p
          className={`text-sm ${state.ok ? "text-foreground" : "text-destructive"}`}
          role="status"
        >
          {state.ok ? state.message : state.error}
        </p>
      ) : null}
    </form>
  );
}
