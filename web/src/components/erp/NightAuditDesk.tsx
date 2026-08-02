"use client";

import { NightAuditPipelineList } from "@/components/erp/NightAuditPipelineList";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBtn } from "@/lib/pricing";
import {
  applyPipelineStep,
  initialNightAuditPipeline,
  type NightAuditPipelineStep,
  type NightAuditStepEvent,
} from "@/lib/night-audit/steps";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
  "Fails loudly if close-day checks fail — use notes force close to override.",
];

export type NightAuditHistoryRow = {
  id: string;
  business_date: string;
  rooms_occupied: number;
  rooms_comp: number;
  folio_charges_btn: number;
  folio_payments_btn: number;
  open_folios: number;
  notes: string | null;
  pipeline: NightAuditPipelineStep[] | null;
  room_nights_posted: number;
  room_nights_skipped: number;
};

type LiveState = {
  businessDate: string;
  steps: NightAuditPipelineStep[];
  error: string | null;
  done: boolean;
};

async function consumeSse(
  response: Response,
  handlers: {
    onStep: (event: NightAuditStepEvent) => void;
    onComplete: (data: Record<string, unknown>) => void;
    onError: (message: string) => void;
  },
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onError("No response stream.");
    return;
  }
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const block of parts) {
      if (!block.trim()) continue;
      let eventName = "message";
      let dataLine = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLine += line.slice(5).trim();
        }
      }
      if (!dataLine) continue;
      try {
        const data = JSON.parse(dataLine) as Record<string, unknown>;
        if (eventName === "step") {
          handlers.onStep(data as unknown as NightAuditStepEvent);
        } else if (eventName === "complete") {
          handlers.onComplete(data);
        } else if (eventName === "error") {
          handlers.onError(
            typeof data.message === "string"
              ? data.message
              : "Night audit failed.",
          );
        }
      } catch {
        // ignore malformed chunk
      }
    }
  }
}

export function NightAuditDesk({
  defaultDate,
  history,
}: {
  defaultDate: string;
  history: NightAuditHistoryRow[];
}) {
  const router = useRouter();
  const [businessDate, setBusinessDate] = useState(defaultDate);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [live, setLive] = useState<LiveState | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formDisabled = pending;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const date = businessDate.slice(0, 10);
    setPending(true);
    setLive({
      businessDate: date,
      steps: initialNightAuditPipeline(),
      error: null,
      done: false,
    });

    try {
      const res = await fetch("/api/erp/night-audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_date: date,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }

      await consumeSse(res, {
        onStep: (event) => {
          setLive((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              steps: applyPipelineStep(prev.steps, event),
            };
          });
        },
        onComplete: (data) => {
          const message =
            typeof data.message === "string"
              ? data.message
              : "Night audit complete";
          toast.success(message);
          setLive((prev) =>
            prev
              ? {
                  ...prev,
                  done: true,
                  steps: Array.isArray(data.pipeline)
                    ? (data.pipeline as NightAuditPipelineStep[])
                    : prev.steps,
                }
              : prev,
          );
          router.refresh();
        },
        onError: (message) => {
          toast.error(message);
          setLive((prev) =>
            prev ? { ...prev, error: message, done: false } : prev,
          );
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Night audit failed.";
      toast.error(message);
      setLive((prev) =>
        prev ? { ...prev, error: message } : prev,
      );
    } finally {
      setPending(false);
    }
  }

  const showLiveInHistory = live !== null && (pending || !live.done || live.error);

  const historyWithLive = useMemo(() => history, [history]);

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      <form
        onSubmit={onSubmit}
        className="erp space-y-4 rounded-lg border bg-card p-4"
      >
        <div>
          <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Close day (night audit)
          </h3>
          <p className="mt-2 text-xs text-muted-foreground">
            Manager action — rolls the business date, posts room nights to open
            folios, and saves an audit record. Progress ticks appear live in
            History as each step completes.
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
            value={businessDate}
            required
            disabled={formDisabled}
            onChange={(e) => setBusinessDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-xs text-muted-foreground">
            Notes (optional)
          </Label>
          <Input
            id="notes"
            name="notes"
            value={notes}
            disabled={formDisabled}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='e.g. force close'
          />
          <p className="text-[10px] text-muted-foreground">
            Type force close in notes to override open-balance / dirty-HK
            blockers.
          </p>
        </div>
        <Button
          type="submit"
          variant="citrus"
          disabled={formDisabled}
          className="h-10 w-full"
        >
          {pending ? "Running…" : "Complete night audit"}
        </Button>
        <Button asChild variant="outline" className="h-10 w-full">
          <a
            href={`/api/erp/night-audit/continuity?date=${encodeURIComponent(businessDate)}`}
            download
          >
            Download hotel backup
          </a>
        </Button>
        {live?.error ? (
          <p className="text-sm text-destructive" role="alert">
            {live.error}
          </p>
        ) : null}
      </form>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {showLiveInHistory && live ? (
            <div
              className="rounded-lg border border-accent/30 bg-accent/5 p-4"
              aria-live="polite"
            >
              <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
                {live.done && !live.error
                  ? `Closed ${live.businessDate}`
                  : `Closing ${live.businessDate}…`}
              </p>
              <div className="mt-3">
                <NightAuditPipelineList steps={live.steps} />
              </div>
              {live.error ? (
                <p className="mt-3 text-xs text-destructive">{live.error}</p>
              ) : null}
            </div>
          ) : null}

          {historyWithLive.length === 0 && !showLiveInHistory ? (
            <p className="text-sm text-muted-foreground">
              No night audits yet. Run close day — steps will tick here live.
            </p>
          ) : (
            <ul className="divide-y">
              {historyWithLive.map((a) => {
                const expanded = expandedId === a.id;
                return (
                  <li key={a.id} className="py-4 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium text-foreground">
                        {a.business_date}
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        {a.pipeline && a.pipeline.length > 0 ? (
                          <button
                            type="button"
                            className="text-xs font-medium text-accent underline-offset-4 hover:underline"
                            onClick={() =>
                              setExpandedId(expanded ? null : a.id)
                            }
                          >
                            {expanded ? "Hide steps" : "Show steps"}
                          </button>
                        ) : null}
                        <a
                          href={`/api/erp/night-audit/continuity?date=${encodeURIComponent(a.business_date)}`}
                          className="text-xs font-medium text-accent underline-offset-4 hover:underline"
                          download
                        >
                          Download backup
                        </a>
                        <Link
                          href={`/erp/night-audit/${a.id}/print`}
                          className="text-xs font-medium text-accent underline-offset-4 hover:underline"
                        >
                          Print pack →
                        </Link>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sellable {a.rooms_occupied} · Comp {a.rooms_comp} · Open
                      folios {a.open_folios}
                    </p>
                    <p className="mt-1 text-xs tabular-nums text-foreground">
                      Charges {formatBtn(a.folio_charges_btn)} · Payments{" "}
                      {formatBtn(a.folio_payments_btn)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Room nights: {a.room_nights_posted} posted
                      {a.room_nights_skipped > 0
                        ? ` · ${a.room_nights_skipped} skipped (already posted)`
                        : ""}
                    </p>
                    {a.notes ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.notes}
                      </p>
                    ) : null}
                    {expanded && a.pipeline && a.pipeline.length > 0 ? (
                      <div className="mt-3 rounded-md border bg-muted/20 p-3">
                        <NightAuditPipelineList steps={a.pipeline} compact />
                      </div>
                    ) : null}
                    {!expanded && a.pipeline && a.pipeline.length > 0 ? (
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {a.pipeline.filter((s) => s.status === "done").length}/
                        {a.pipeline.length} steps completed
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
