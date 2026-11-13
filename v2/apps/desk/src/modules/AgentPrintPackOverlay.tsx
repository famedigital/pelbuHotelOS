import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@hos-v2/ui";
import type { Agent, RateCell, Season } from "../lib/commercial-store";
import { rateCardById } from "../lib/commercial-store";
import type { FiscalDoc } from "../lib/extras-store";
import type { Stay } from "../lib/front-office-store";
import { useSettingsStore } from "../lib/settings-store";
import { useCommercialStore } from "../lib/commercial-store";
import {
  AGENT_PRINT_PACK_SECTION_META,
  anySectionOn,
  buildAgentPrintPack,
  defaultPeriodForAgent,
  sectionsForPreset,
  type AgentPrintPackPreset,
  type AgentPrintPackSections,
} from "../lib/agent-print-pack";
import type { AgentStatementLetterhead } from "./AgentStatementView";
import { AgentPrintPackView } from "./AgentPrintPackView";

type Props = {
  open: boolean;
  agent: Agent | null;
  stays: Stay[];
  fiscalDocs: FiscalDoc[];
  onClose: () => void;
};

export function AgentPrintPackOverlay({
  open,
  agent,
  stays,
  fiscalDocs,
  onClose,
}: Props) {
  const hotelName = useSettingsStore((s) => s.hotelName);
  const dzongkhag = useSettingsStore((s) => s.dzongkhag);
  const tpn = useSettingsStore((s) => s.tpn);
  const scEnabled = useSettingsStore((s) => s.scEnabled);
  const scRate = useSettingsStore((s) => s.scRate);
  const bnbAccountName = useSettingsStore((s) => s.bnbAccountName);
  const bnbAccountNo = useSettingsStore((s) => s.bnbAccountNo);
  const mbobMerchantId = useSettingsStore((s) => s.mbobMerchantId);
  const mbobQrNote = useSettingsStore((s) => s.mbobQrNote);

  const cells = useCommercialStore((s) => s.cells);
  const rateCards = useCommercialStore((s) => s.rateCards);
  const season = useCommercialStore((s) => s.season);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sections, setSections] = useState<AgentPrintPackSections>(() =>
    sectionsForPreset("clientPack"),
  );

  useEffect(() => {
    if (!open || !agent) return;
    const period = defaultPeriodForAgent({
      agent,
      stays,
      fiscalDocs,
    });
    setFrom(period.from);
    setTo(period.to);
    setSections(sectionsForPreset("clientPack"));
  }, [open, agent?.id]);

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

  const rateCardCode = agent
    ? rateCardById(rateCards, agent.rateCardId)?.code ?? agent.rateCardId
    : "";

  const pack = useMemo(() => {
    if (!agent || !from || !to) return null;
    return buildAgentPrintPack({
      agent,
      stays,
      fiscalDocs,
      sections,
      from,
      to,
      cells: cells as RateCell[],
      season: season as Season,
      rateCardCode,
      bank: {
        accountName: bnbAccountName,
        accountNo: bnbAccountNo,
        mbobMerchantId,
        note: mbobQrNote,
      },
    });
  }, [
    agent,
    stays,
    fiscalDocs,
    sections,
    from,
    to,
    cells,
    season,
    rateCardCode,
    bnbAccountName,
    bnbAccountNo,
    mbobMerchantId,
    mbobQrNote,
  ]);

  const applyPreset = (preset: AgentPrintPackPreset) => {
    setSections(sectionsForPreset(preset));
  };

  const toggleSection = (key: keyof AgentPrintPackSections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const runPrint = () => {
    if (!anySectionOn(sections)) {
      toast.error("Select at least one section");
      return;
    }
    if (!pack?.hasPrintableContent) {
      toast.error("Nothing to print in this period", {
        description: "Widen the date range or choose other sections.",
      });
      return;
    }
    window.print();
  };

  if (!open || !agent || !pack || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[200] flex flex-col bg-[rgba(15,23,42,0.55)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Agent print pack"
      data-testid="agent-print-pack-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-[var(--hos-canvas)] sm:mx-auto sm:my-3 sm:h-[min(96vh,960px)] sm:max-w-[960px] sm:rounded-2xl sm:border sm:border-[var(--hos-line)] sm:shadow-[0_40px_100px_-40px_rgba(15,23,42,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="hos-agent-print-pack-chrome flex shrink-0 flex-col gap-2 border-b border-[var(--hos-line)] bg-[var(--hos-surface)] px-3 py-2.5 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
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
              Print pack · {agent.name}
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
              onClick={runPrint}
              data-testid="agent-print-pack-print"
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
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ["clientPack", "Client pack"],
                ["fullArchive", "Full archive"],
                ["unpaidOnly", "Unpaid only"],
                ["clear", "Clear"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                size="sm"
                variant="ghost"
                className="!h-8 !rounded-lg !px-2 text-[11px]"
                onClick={() => applyPreset(id)}
              >
                {label}
              </Button>
            ))}
            <span className="ml-auto text-[10px] tabular-nums text-[var(--hos-ink-3)]">
              {pack.counts.unpaid} unpaid · {pack.counts.paid} paid ·{" "}
              {pack.counts.nights}n · {pack.counts.payments} receipts
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {AGENT_PRINT_PACK_SECTION_META.map((meta) => {
              const on = sections[meta.key];
              return (
                <label
                  key={meta.key}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                    on
                      ? "border-[var(--hos-brass)]/40 bg-[var(--hos-brass)]/10 text-[var(--hos-ink)]"
                      : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-3)]"
                  }`}
                  title={meta.hint}
                >
                  <input
                    type="checkbox"
                    className="size-3.5 accent-[var(--hos-brass)]"
                    checked={on}
                    onChange={() => toggleSection(meta.key)}
                    data-testid={`agent-print-pack-section-${meta.key}`}
                  />
                  {meta.label}
                </label>
              );
            })}
          </div>
        </header>

        <div className="hos-scrollbar-slim min-h-0 flex-1 overflow-auto bg-[#ebe6df] py-4">
          {pack.hasPrintableContent ? (
            <AgentPrintPackView pack={pack} letterhead={letterhead} />
          ) : (
            <p className="px-6 text-center text-sm text-[var(--hos-ink-3)]">
              No printable rows for the selected sections and dates.
            </p>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          .hos-agent-print-pack-chrome { display: none !important; }
          .no-print { display: none !important; }
          body * { visibility: hidden !important; }
          .hos-agent-print-pack-root, .hos-agent-print-pack-root * { visibility: visible !important; }
          .hos-agent-print-pack-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
          }
          .hos-print-pack-break {
            break-after: page;
            page-break-after: always;
          }
          .hos-agent-soa-chrome { display: none !important; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
