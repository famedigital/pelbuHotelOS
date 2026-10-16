"use client";

import {
  acceptAiDraft,
  draftCheckoutChecklist,
  draftInvoiceNotes,
  draftPosTicket,
  draftStayFromText,
  explainAgentDue,
  explainFolioDue,
  draftCheckInFromStay,
  summarizeNightClose,
  draftAgentRateSheet,
  draftFoShiftBriefing,
  type AiDraftResult,
} from "@/app/actions/erp-ai-assist";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  parseAssistDraft,
  parseCheckoutChecklistDraft,
  parseExplainDueDraft,
  parseInvoiceNotesDraft,
  parsePosTicketDraft,
  parseStayDraft,
  parseCheckInDraft,
  parseNightCloseDraft,
  parseAgentRateSheetDraft,
  parseShiftBriefingDraft,
} from "@/lib/ai/assist-draft-schemas";
import { recordAssistMetric } from "@/lib/erp/desk-surface-metrics";
import { useState, useTransition } from "react";

export type AiAssistMode =
  | "paste_to_stay"
  | "explain_due"
  | "explain_agent_due"
  | "checkout_checklist"
  | "pos_ticket"
  | "invoice_notes"
  | "check_in"
  | "night_close"
  | "rate_sheet"
  | "shift_briefing";

type DraftOk = Extract<AiDraftResult, { ok: true }>;

/**
 * Draft-only Gemini Assist. Never mutates money — Confirm hands draft to parent.
 */
export function AiAssistPanel({
  propertyId,
  bookingId = null,
  agentId = null,
  mode,
  title,
  placeholder,
  onApplyDraft,
  menuHints,
  compact = false,
  briefingContext,
}: {
  propertyId: string;
  bookingId?: string | null;
  agentId?: string | null;
  mode: AiAssistMode;
  title?: string;
  placeholder?: string;
  onApplyDraft?: (draft: unknown, meta: DraftOk) => void;
  menuHints?: string[];
  compact?: boolean;
  /** Aggregated counts for shift briefing (no PII dump). */
  briefingContext?: Record<string, unknown>;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftOk | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [pending, start] = useTransition();

  const labels: Record<AiAssistMode, { title: string; placeholder: string }> = {
    paste_to_stay: {
      title: "Paste to stay",
      placeholder: "Paste agent WhatsApp / email…",
    },
    explain_due: {
      title: "Why is Due this?",
      placeholder: "Optional notes…",
    },
    explain_agent_due: {
      title: "Explain partner due",
      placeholder: "",
    },
    checkout_checklist: {
      title: "Checkout check",
      placeholder: "Optional notes…",
    },
    pos_ticket: {
      title: "Paste order",
      placeholder: "2 momo, 1 suja, room 502…",
    },
    invoice_notes: {
      title: "Invoice notes draft",
      placeholder: "Guest/agent note…",
    },
    check_in: {
      title: "Check-in draft",
      placeholder: "Optional notes…",
    },
    night_close: {
      title: "Night close summary",
      placeholder: "Optional notes…",
    },
    rate_sheet: {
      title: "Agents rate propose",
      placeholder: "e.g. 90% of Public…",
    },
    shift_briefing: {
      title: "Rewrite briefing",
      placeholder: "",
    },
  };

  const copy = labels[mode];

  function runDraft() {
    setError(null);
    start(async () => {
      let result: AiDraftResult;
      if (mode === "paste_to_stay") {
        if (!text.trim()) {
          setError("Paste a message first.");
          return;
        }
        result = await draftStayFromText({ propertyId, text });
      } else if (mode === "explain_due") {
        if (!bookingId) {
          setError("Open a stay first.");
          return;
        }
        result = await explainFolioDue({ propertyId, bookingId });
      } else if (mode === "explain_agent_due") {
        if (!agentId) {
          setError("Open a partner first.");
          return;
        }
        result = await explainAgentDue({ propertyId, agentId });
      } else if (mode === "checkout_checklist") {
        if (!bookingId) {
          setError("Open a stay first.");
          return;
        }
        result = await draftCheckoutChecklist({ propertyId, bookingId });
      } else if (mode === "pos_ticket") {
        if (!text.trim()) {
          setError("Paste or type the order first.");
          return;
        }
        result = await draftPosTicket({ propertyId, text, menuHints });
      } else if (mode === "invoice_notes") {
        if (!bookingId) {
          setError("Open a stay first.");
          return;
        }
        result = await draftInvoiceNotes({
          propertyId,
          bookingId,
          context: text || undefined,
        });
      } else if (mode === "check_in") {
        if (!bookingId) {
          setError("Open a stay first.");
          return;
        }
        result = await draftCheckInFromStay({ propertyId, bookingId });
      } else if (mode === "night_close") {
        result = await summarizeNightClose({
          propertyId,
          notes: text || undefined,
        });
      } else if (mode === "rate_sheet") {
        result = await draftAgentRateSheet({
          propertyId,
          hint: text || undefined,
        });
      } else {
        result = await draftFoShiftBriefing({
          propertyId,
          snapshot: briefingContext ?? {},
        });
      }
      if (!result.ok) {
        setDraft(null);
        setError(result.error);
        return;
      }
      recordAssistMetric("assist_drafts");
      setDraft(result);
    });
  }

  function confirmApply() {
    if (!draft || !onApplyDraft) return;
    start(async () => {
      await acceptAiDraft({
        propertyId,
        mode: draft.mode,
        promptHash: draft.promptHash,
        entityType: bookingId ? "booking" : agentId ? "agent" : "ai_assist",
        entityId: bookingId ?? agentId,
      });
      recordAssistMetric("assist_confirms");
      onApplyDraft(draft.draft, draft);
      setDraft(null);
      setText("");
    });
  }

  const shell = compact ? (
    <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-3">
      {inner()}
    </div>
  ) : (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
          Assist
        </p>
        <CardTitle className="text-sm">{title ?? copy.title}</CardTitle>
        <CardDescription className="text-[11px]">
          Draft only · Confirm required for writes
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">{inner()}</CardContent>
    </Card>
  );

  function inner() {
    return (
      <>
        {compact ? (
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
                Assist
              </p>
              <h3 className="text-sm font-semibold text-foreground">
                {title ?? copy.title}
              </h3>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Draft only · Confirm required
            </p>
          </div>
        ) : null}

        {mode === "paste_to_stay" ||
        mode === "pos_ticket" ||
        mode === "invoice_notes" ||
        mode === "night_close" ||
        mode === "rate_sheet" ? (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder ?? copy.placeholder}
            rows={compact ? 2 : 3}
            className="mb-2 text-sm"
          />
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={runDraft}
          >
            {pending ? "Drafting…" : "Draft with Gemini"}
          </Button>
          {draft ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={pending || !onApplyDraft}
                onClick={confirmApply}
              >
                Confirm draft
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setDraft(null)}
              >
                Discard
              </Button>
            </>
          ) : null}
        </div>

        {error ? (
          <p className="mt-2 text-xs text-destructive">{error}</p>
        ) : null}

        {draft ? (
          <div className="mt-3 space-y-2">
            <TypedDraftCard mode={mode} raw={draft.draft} />
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setShowJson((v) => !v)}
            >
              {showJson ? "Hide JSON" : "Show JSON (advanced)"}
            </button>
            {showJson ? (
              <pre className="max-h-40 overflow-auto rounded-md bg-muted/40 p-2 text-[11px] whitespace-pre-wrap">
                {JSON.stringify(draft.draft, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Gemini never posts, voids, pays, or issues invoices without Confirm.
          </p>
        )}
      </>
    );
  }

  return shell;
}

function TypedDraftCard({ mode, raw }: { mode: AiAssistMode; raw: unknown }) {
  if (mode === "paste_to_stay") {
    const p = parseAssistDraft(parseStayDraft, raw);
    if (!p.ok) return <p className="text-xs text-destructive">{p.error}</p>;
    const d = p.data;
    return (
      <ul className="space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-xs">
        {d.guestName ? <li>Guest: {d.guestName}</li> : null}
        {d.checkIn || d.checkOut ? (
          <li>
            Dates: {d.checkIn ?? "?"} → {d.checkOut ?? "?"}
          </li>
        ) : null}
        {d.rooms != null ? <li>Rooms: {d.rooms}</li> : null}
        {d.mealPlan ? <li>Meal: {d.mealPlan}</li> : null}
        {d.nightlyRateBtn != null ? <li>Rate: Nu {d.nightlyRateBtn}</li> : null}
        {d.agentName ? <li>Agent: {d.agentName}</li> : null}
        {d.summary ? (
          <li className="text-muted-foreground">{d.summary}</li>
        ) : null}
      </ul>
    );
  }
  if (mode === "explain_due" || mode === "explain_agent_due") {
    const p = parseAssistDraft(parseExplainDueDraft, raw);
    if (!p.ok) return <p className="text-xs text-destructive">{p.error}</p>;
    const d = p.data;
    return (
      <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-xs">
        {d.dueBtn != null ? (
          <p className="font-semibold tabular-nums">Due Nu {d.dueBtn}</p>
        ) : null}
        {d.plainExplanation ? <p>{d.plainExplanation}</p> : null}
        {d.suggestedSteps?.length ? (
          <ol className="list-decimal pl-4">
            {d.suggestedSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        ) : null}
      </div>
    );
  }
  if (mode === "checkout_checklist") {
    const p = parseAssistDraft(parseCheckoutChecklistDraft, raw);
    if (!p.ok) return <p className="text-xs text-destructive">{p.error}</p>;
    const d = p.data;
    return (
      <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-xs">
        {d.plainSummary ? <p>{d.plainSummary}</p> : null}
        {d.checklist?.map((c) => (
          <p key={c.item}>
            {c.ok ? "✓" : "·"} {c.item}
            {c.hint ? (
              <span className="text-muted-foreground"> — {c.hint}</span>
            ) : null}
          </p>
        ))}
      </div>
    );
  }
  if (mode === "pos_ticket") {
    const p = parseAssistDraft(parsePosTicketDraft, raw);
    if (!p.ok) return <p className="text-xs text-destructive">{p.error}</p>;
    const d = p.data;
    return (
      <ul className="space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-xs">
        {(d.lines ?? []).map((l, i) => (
          <li key={`${l.name}-${i}`}>
            {l.qty ?? 1}× {l.name}
            {l.notes ? (
              <span className="text-muted-foreground"> ({l.notes})</span>
            ) : null}
          </li>
        ))}
        {d.summary ? (
          <li className="text-muted-foreground">{d.summary}</li>
        ) : null}
      </ul>
    );
  }
  if (mode === "invoice_notes") {
    const p = parseAssistDraft(parseInvoiceNotesDraft, raw);
    if (!p.ok) return <p className="text-xs text-destructive">{p.error}</p>;
    return (
      <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
        {p.data.notes || p.data.shareText || "—"}
      </p>
    );
  }
  if (mode === "check_in") {
    const p = parseAssistDraft(parseCheckInDraft, raw);
    if (!p.ok) return <p className="text-xs text-destructive">{p.error}</p>;
    const d = p.data;
    return (
      <ul className="space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-xs">
        {d.nationality ? <li>Nationality: {d.nationality}</li> : null}
        {d.adults != null ? <li>Adults: {d.adults}</li> : null}
        {d.children != null ? <li>Children: {d.children}</li> : null}
        {d.guideNumber ? <li>Guide: {d.guideNumber}</li> : null}
        {d.roomSuggestion ? <li>Room: {d.roomSuggestion}</li> : null}
        {d.summary ? (
          <li className="text-muted-foreground">{d.summary}</li>
        ) : null}
      </ul>
    );
  }
  if (mode === "night_close") {
    const p = parseAssistDraft(parseNightCloseDraft, raw);
    if (!p.ok) return <p className="text-xs text-destructive">{p.error}</p>;
    const d = p.data;
    return (
      <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-xs">
        {d.plainSummary ? <p>{d.plainSummary}</p> : null}
        {d.blockers?.length ? (
          <ul className="list-disc pl-4">
            {d.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No blockers listed.</p>
        )}
      </div>
    );
  }
  if (mode === "rate_sheet") {
    const p = parseAssistDraft(parseAgentRateSheetDraft, raw);
    if (!p.ok) return <p className="text-xs text-destructive">{p.error}</p>;
    const d = p.data;
    return (
      <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-xs">
        {d.agentsPctOfPublic != null ? (
          <p className="font-semibold">{d.agentsPctOfPublic}% of Public</p>
        ) : null}
        {d.summary ? <p>{d.summary}</p> : null}
      </div>
    );
  }
  if (mode === "shift_briefing") {
    const p = parseAssistDraft(parseShiftBriefingDraft, raw);
    if (!p.ok) return <p className="text-xs text-destructive">{p.error}</p>;
    return (
      <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
        {p.data.briefing}
      </p>
    );
  }
  return null;
}
