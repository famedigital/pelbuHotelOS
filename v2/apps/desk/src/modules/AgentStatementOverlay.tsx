import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Printer, X } from "lucide-react";
import { Button } from "@hos-v2/ui";
import { buildAgentStatement } from "../lib/b2b-portfolio";
import type { Agent } from "../lib/commercial-store";
import { defaultPeriod } from "../lib/finance-reports";
import type { FiscalDoc } from "../lib/extras-store";
import type { Stay } from "../lib/front-office-store";
import { useSettingsStore } from "../lib/settings-store";
import {
  AgentStatementView,
  type AgentStatementLetterhead,
} from "./AgentStatementView";

type Props = {
  open: boolean;
  agent: Agent | null;
  stays: Stay[];
  fiscalDocs: FiscalDoc[];
  onClose: () => void;
};

export function AgentStatementOverlay({
  open,
  agent,
  stays,
  fiscalDocs,
  onClose,
}: Props) {
  const period0 = defaultPeriod();
  const [from, setFrom] = useState(period0.from);
  const [to, setTo] = useState(period0.to);
  const hotelName = useSettingsStore((s) => s.hotelName);
  const dzongkhag = useSettingsStore((s) => s.dzongkhag);
  const tpn = useSettingsStore((s) => s.tpn);
  const scEnabled = useSettingsStore((s) => s.scEnabled);
  const scRate = useSettingsStore((s) => s.scRate);

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

  const letterhead: AgentStatementLetterhead = useMemo(
    () => ({
      hotelName,
      dzongkhag,
      tpn,
      scEnabled,
      scRate,
    }),
    [hotelName, dzongkhag, tpn, scEnabled, scRate],
  );

  const doc = useMemo(() => {
    if (!agent) return null;
    return buildAgentStatement({
      agent,
      stays,
      fiscalDocs,
      from,
      to,
    });
  }, [agent, stays, fiscalDocs, from, to]);

  if (!open || !agent || !doc || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[200] flex flex-col bg-[rgba(15,23,42,0.55)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Account statement"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-[var(--hos-canvas)] sm:mx-auto sm:my-3 sm:h-[min(96vh,960px)] sm:max-w-[920px] sm:rounded-2xl sm:border sm:border-[var(--hos-line)] sm:shadow-[0_40px_100px_-40px_rgba(15,23,42,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="hos-agent-soa-chrome flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--hos-line)] bg-[var(--hos-surface)] px-3 py-2.5 sm:px-4">
          <Button
            size="sm"
            variant="secondary"
            className="!min-h-10 shrink-0 !rounded-xl !px-3 font-semibold"
            onClick={onClose}
          >
            <ArrowLeft className="size-4" strokeWidth={2.25} />
            Back
          </Button>
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--hos-ink)]">
            Account statement · {agent.name}
          </p>
          <label className="flex items-center gap-1 text-[10px] font-semibold text-[var(--hos-ink-3)]">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-1.5 py-1 text-xs text-[var(--hos-ink)]"
            />
          </label>
          <label className="flex items-center gap-1 text-[10px] font-semibold text-[var(--hos-ink-3)]">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-1.5 py-1 text-xs text-[var(--hos-ink)]"
            />
          </label>
          <Button
            size="sm"
            className="!min-h-10 shrink-0 !rounded-xl !px-3"
            onClick={() => window.print()}
          >
            <Printer className="size-3.5" strokeWidth={2} />
            Print / PDF
          </Button>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="hidden size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] sm:inline-flex"
          >
            <X className="size-4" strokeWidth={2.25} />
          </button>
        </header>

        <div className="hos-scrollbar-slim min-h-0 flex-1 overflow-auto py-4">
          <AgentStatementView doc={doc} letterhead={letterhead} printRoot />
        </div>
      </div>

      <style>{`
        @media print {
          .hos-agent-soa-chrome { display: none !important; }
          .no-print { display: none !important; }
          body * { visibility: hidden !important; }
          .hos-agent-soa-print-root, .hos-agent-soa-print-root * { visibility: visible !important; }
          .hos-agent-soa-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}
