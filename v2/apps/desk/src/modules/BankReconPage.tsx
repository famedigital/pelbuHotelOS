import { useMemo, useState, useTransition } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  Banknote,
  CheckCircle2,
  Link2,
  Printer,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  GlassPanel,
  KpiCard,
  MorphTabs,
  ModuleFrame,
} from "@hos-v2/ui";
import { formatNu, useEnterpriseOpsStore } from "../lib/enterprise-ops-store";
import { useExtrasStore } from "../lib/extras-store";
import { useFiscalStore } from "../lib/fiscal-store";
import {
  buildBankReconSummary,
  exportCsv,
} from "../lib/finance-reports";

type BankTab = "all" | "bob" | "bnb" | "drukpnb";
type ViewTab = "timeline" | "statements";

const BANK_LABEL: Record<"bob" | "bnb" | "drukpnb", string> = {
  bob: "BoB / mBoB",
  bnb: "BNB",
  drukpnb: "DrukPNB",
};

type CashTimelineEntry = {
  id: string;
  sortAt: string;
  dateLabel: string;
  kind: string;
  label: string;
  ref: string;
  amountBtn: number;
  direction: "in" | "out";
  source: "till" | "purchase" | "shift" | "statement" | "deposit";
  matched: boolean;
};

type MatchSuggestion = {
  bankLineId: string;
  bankDescription: string;
  bankAmount: number;
  bankDate: string;
  targetType: "fiscal" | "purchase" | "deposit" | "shift";
  targetId: string;
  targetLabel: string;
  score: number;
  reason: string;
};

function parsePsbnRef(text: string): string | null {
  const m = text.match(/(?:[A-Z]{2,4}PSBN\d{5}|PSBN-\d{4}-\d+)/i);
  return m ? m[0]!.toUpperCase() : null;
}

function sameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

function withinOneDay(a: string, b: string): boolean {
  const da = new Date(`${a.slice(0, 10)}T12:00:00`).getTime();
  const db = new Date(`${b.slice(0, 10)}T12:00:00`).getTime();
  return Math.abs(da - db) <= 86_400_000;
}

function amountEq(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.02;
}

export function BankReconPage() {
  const navigate = useNavigate();
  const [pasteBank, setPasteBank] = useState<"bob" | "bnb" | "drukpnb">("bob");
  const [pasteText, setPasteText] = useState("");
  const [, start] = useTransition();
  const bankLines = useEnterpriseOpsStore((s) => s.bankLines);
  const movements = useEnterpriseOpsStore((s) => s.movements);
  const advances = useEnterpriseOpsStore((s) => s.advances);
  const shift = useEnterpriseOpsStore((s) => s.shift);
  const matchBankLine = useEnterpriseOpsStore((s) => s.matchBankLine);
  const matchBankLineRemote = useEnterpriseOpsStore((s) => s.matchBankLineRemote);
  const pushBankStatementRemote = useEnterpriseOpsStore(
    (s) => s.pushBankStatementRemote,
  );
  const ingestBankStatementText = useEnterpriseOpsStore(
    (s) => s.ingestBankStatementText,
  );
  const purchases = useFiscalStore((s) => s.purchases);
  const tillBalance = useFiscalStore((s) => s.tillBalance);
  const fiscalDocs = useExtrasStore((s) => s.fiscalDocs);
  const tillShifts = useExtrasStore((s) => s.tillShifts);
  const bankDeposits = useExtrasStore((s) => s.bankDeposits);

  const [tab, setTab] = useState<BankTab>("all");
  const [view, setView] = useState<ViewTab>("timeline");

  const statementRows =
    tab === "all" ? bankLines : bankLines.filter((l) => l.bankCode === tab);
  const openLines = bankLines.filter((l) => l.status === "open");
  const openAmt = openLines.reduce((s, l) => s + l.amountBtn, 0);
  const openShift = tillShifts.find((t) => !t.closedAt);
  const reconSummary = useMemo(
    () => buildBankReconSummary(bankLines),
    [bankLines],
  );

  const timeline = useMemo(() => {
    const items: CashTimelineEntry[] = [];

    for (const m of movements) {
      items.push({
        id: `mov-${m.id}`,
        sortAt: m.at,
        dateLabel: m.at.slice(0, 10),
        kind: "till_movement",
        label: m.note,
        ref: m.kind,
        amountBtn: m.amountBtn,
        direction: m.direction === "in" ? "in" : "out",
        source: "till",
        matched: true,
      });
    }

    for (const p of purchases) {
      if (p.paymentMode !== "cash" && p.paymentMode !== "bank") continue;
      items.push({
        id: `pur-${p.id}`,
        sortAt: `${p.billDate}T12:00:00.000Z`,
        dateLabel: p.billDate,
        kind: "purchase",
        label: `${p.supplierName} · ${p.billNo}`,
        ref: p.journalNo,
        amountBtn: p.grandTotalBtn,
        direction: "out",
        source: "purchase",
        matched: p.paymentMode !== "cash",
      });
    }

    for (const s of tillShifts.filter((t) => t.closedAt)) {
      items.push({
        id: `shift-${s.id}`,
        sortAt: s.closedAt!,
        dateLabel: s.closedAt!.slice(0, 10),
        kind: "shift_close",
        label: `Shift close · ${s.cashier}`,
        ref: s.id.slice(0, 8),
        amountBtn: s.counted ?? s.expected,
        direction: "in",
        source: "shift",
        matched: s.variance !== null && Math.abs(s.variance) < 1,
      });
    }

    for (const d of bankDeposits) {
      items.push({
        id: `dep-${d.id}`,
        sortAt: d.at,
        dateLabel: d.at.slice(0, 10),
        kind: "bank_deposit",
        label: `Deposit ${d.ref}`,
        ref: d.ref,
        amountBtn: d.amount,
        direction: "in",
        source: "deposit",
        matched: Boolean(d.matchedShiftId),
      });
    }

    for (const l of bankLines) {
      items.push({
        id: `stmt-${l.id}`,
        sortAt: `${l.txnDate}T18:00:00.000Z`,
        dateLabel: l.txnDate,
        kind: "statement",
        label: l.description,
        ref: BANK_LABEL[l.bankCode],
        amountBtn: l.amountBtn,
        direction: l.direction,
        source: "statement",
        matched: l.status === "matched",
      });
    }

    return items.sort(
      (a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime(),
    );
  }, [movements, purchases, tillShifts, bankDeposits, bankLines]);

  const suggestions = useMemo(() => {
    const out: MatchSuggestion[] = [];
    const open = bankLines.filter((l) => l.status === "open" && l.direction === "in");

    for (const line of open) {
      const psbn = parsePsbnRef(line.description);
      if (psbn) {
        const doc = fiscalDocs.find(
          (d) => d.docNo.toUpperCase() === psbn && d.status !== "void",
        );
        if (doc && amountEq(doc.amount, line.amountBtn)) {
          out.push({
            bankLineId: line.id,
            bankDescription: line.description,
            bankAmount: line.amountBtn,
            bankDate: line.txnDate,
            targetType: "fiscal",
            targetId: doc.id,
            targetLabel: doc.docNo,
            score: 100,
            reason: "PSBN ref + amount",
          });
          continue;
        }
      }

      for (const p of purchases.filter((x) => x.paymentMode === "bank")) {
        if (!amountEq(p.grandTotalBtn, line.amountBtn)) continue;
        if (sameDay(p.billDate, line.txnDate) || withinOneDay(p.billDate, line.txnDate)) {
          out.push({
            bankLineId: line.id,
            bankDescription: line.description,
            bankAmount: line.amountBtn,
            bankDate: line.txnDate,
            targetType: "purchase",
            targetId: p.id,
            targetLabel: `${p.billNo} · ${p.supplierName}`,
            score: 85,
            reason: "Amount + bill date",
          });
        }
      }

      for (const d of bankDeposits) {
        if (amountEq(d.amount, line.amountBtn) && withinOneDay(d.at, line.txnDate)) {
          out.push({
            bankLineId: line.id,
            bankDescription: line.description,
            bankAmount: line.amountBtn,
            bankDate: line.txnDate,
            targetType: "deposit",
            targetId: d.id,
            targetLabel: d.ref,
            score: 80,
            reason: "Deposit amount + date",
          });
        }
      }

      const closed = tillShifts.find(
        (s) =>
          s.closedAt &&
          amountEq(s.counted ?? s.expected, line.amountBtn) &&
          withinOneDay(s.closedAt, line.txnDate),
      );
      if (closed) {
        out.push({
          bankLineId: line.id,
          bankDescription: line.description,
          bankAmount: line.amountBtn,
          bankDate: line.txnDate,
          targetType: "shift",
          targetId: closed.id,
          targetLabel: `Shift ${closed.cashier}`,
          score: 75,
          reason: "Closed shift count + date",
        });
      }
    }

    return out.sort((a, b) => b.score - a.score);
  }, [bankLines, fiscalDocs, purchases, bankDeposits, tillShifts]);

  const ritual = useMemo(
    () => ({
      float: openShift?.openingFloat ?? shift.openingFloatBtn,
      openAdvances: advances.filter((a) => a.status === "open").length,
      deposits: bankDeposits.length,
      unmatched: openLines.length,
      till: tillBalance,
    }),
    [
      openShift,
      shift.openingFloatBtn,
      advances,
      bankDeposits.length,
      openLines.length,
      tillBalance,
    ],
  );

  const applySuggestion = (s: MatchSuggestion) => {
    start(() => {
      matchBankLine(s.bankLineId);
      toast.success("Statement line matched", {
        description: `${s.targetLabel} · ${s.reason}`,
      });
    });
  };

  return (
    <ModuleFrame
      title="Bank Reconciliation"
      description="Statement match · till bridge"
    >
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <Banknote className="size-6 text-[var(--hos-primary)]" aria-hidden />
          <h1 className="m-0 text-2xl font-bold text-[var(--hos-ink)]">
            Bank recon
          </h1>
          <Badge tone="default">BoB · BNB · DrukPNB</Badge>
        </div>
        <p className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
          Unified cash timeline · smart match · close-day bridge to print
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <KpiCard label="Lines" value={String(reconSummary.totalLines)} />
          <KpiCard
            label="Matched"
            value={String(reconSummary.matched)}
            delta={`${reconSummary.matchPct}% match`}
          />
          <KpiCard label="Open" value={String(reconSummary.open)} />
          <KpiCard label="Open in" value={formatNu(reconSummary.openIn)} />
          <KpiCard label="Open out" value={formatNu(reconSummary.openOut)} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="hos-btn-tactile"
            onClick={() => {
              const rows =
                tab === "all"
                  ? bankLines
                  : bankLines.filter((l) => l.bankCode === tab);
              const res = exportCsv(
                `bank-recon-${tab}-${new Date().toISOString().slice(0, 10)}.csv`,
                ["Date", "Bank", "Description", "Direction", "Amount", "Status"],
                rows.map((l) => [
                  l.txnDate,
                  l.bankCode,
                  l.description,
                  l.direction,
                  String(l.amountBtn),
                  l.status,
                ]),
              );
              toast.success(`Exported ${res.rows} lines`, {
                description: res.filename,
              });
            }}
          >
            <Printer className="mr-1 size-3.5" />
            Export CSV
          </Button>
          {(["bob", "bnb", "drukpnb"] as const).map((code) => (
            <Button
              key={code}
              size="sm"
              variant="secondary"
              className="hos-btn-tactile"
              onClick={() => {
                start(async () => {
                  const res = await pushBankStatementRemote({ bankCode: code });
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success(`${BANK_LABEL[code]} imported`, {
                    description: `Statement ${res.statementId.slice(0, 8)} · Postgres`,
                  });
                });
              }}
            >
              <ArrowDownToLine className="mr-1 size-3.5" />
              Push {BANK_LABEL[code]}
            </Button>
          ))}
        </div>
        <GlassPanel className="mt-3 flex flex-col gap-2 p-3">
          <strong className="text-[10px] font-bold uppercase tracking-widest text-[var(--hos-ink-3)]">
            Drop / paste statement (BoB · BNB · DrukPNB)
          </strong>
          <div className="flex flex-wrap gap-2">
            {(["bob", "bnb", "drukpnb"] as const).map((code) => (
              <button
                key={code}
                type="button"
                className={`hos-btn-tactile rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  pasteBank === code
                    ? "bg-[var(--hos-primary)] text-white"
                    : "border border-[var(--hos-glass-border)] bg-[var(--hos-surface)] text-[var(--hos-ink-2)]"
                }`}
                onClick={() => setPasteBank(code)}
              >
                {BANK_LABEL[code]}
              </button>
            ))}
          </div>
          <label
            className="hos-btn-tactile flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--hos-line)] bg-[rgba(15,23,42,0.02)] px-3 py-4 text-center"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (!file) return;
              void file.text().then((text) => {
                setPasteText(text);
                toast.message(`Loaded ${file.name}`, {
                  description: `${BANK_LABEL[pasteBank]} · ${text.split(/\r?\n/).length} lines`,
                });
              });
            }}
          >
            <span className="text-[12px] font-semibold text-[var(--hos-ink)]">
              Drop CSV / TXT here
            </span>
            <span className="text-[10px] text-[var(--hos-ink-3)]">
              or click to choose a file
            </span>
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void file.text().then((text) => {
                  setPasteText(text);
                  toast.message(`Loaded ${file.name}`, {
                    description: `${BANK_LABEL[pasteBank]} · ${text.split(/\r?\n/).length} lines`,
                  });
                });
                e.target.value = "";
              }}
            />
          </label>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
            placeholder="Paste export text…"
            className="hos-scrollbar-slim w-full rounded-xl border border-[var(--hos-glass-border)] bg-[var(--hos-cell)] px-3 py-2 font-mono text-[11px] tabular-nums text-[var(--hos-ink)]"
          />
          <Button
            size="sm"
            className="hos-btn-tactile w-fit"
            onClick={() => {
              start(() => {
                const res = ingestBankStatementText({
                  bankCode: pasteBank,
                  text: pasteText,
                });
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                setPasteText("");
                toast.success(`Parsed ${res.lineCount} lines`, {
                  description:
                    res.warnings.length > 0
                      ? `${res.warnings.length} warnings`
                      : BANK_LABEL[pasteBank],
                });
              });
            }}
          >
            Parse into open lines
          </Button>
        </GlassPanel>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Open lines" value={openLines.length} />
        <KpiCard label="Open amount" value={formatNu(openAmt)} />
        <KpiCard
          label="Matched"
          value={bankLines.filter((l) => l.status === "matched").length}
        />
        <KpiCard label="Live till" value={formatNu(tillBalance)} delta="Drawer" />
      </div>

      <GlassPanel className="flex flex-col gap-3 p-3.5">
        <strong className="text-xs font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
          Close-day ritual
        </strong>
        <ol className="m-0 grid list-none gap-2 p-0 sm:grid-cols-5">
          {[
            {
              key: "float",
              label: "Opening float",
              value: formatNu(ritual.float),
              icon: Wallet,
              ok: ritual.float > 0,
            },
            {
              key: "adv",
              label: "CFM advances",
              value: String(ritual.openAdvances),
              icon: ArrowDownToLine,
              ok: ritual.openAdvances === 0,
            },
            {
              key: "dep",
              label: "Deposits logged",
              value: String(ritual.deposits),
              icon: Banknote,
              ok: ritual.deposits > 0,
            },
            {
              key: "unm",
              label: "Unmatched stmt",
              value: String(ritual.unmatched),
              icon: Link2,
              ok: ritual.unmatched === 0,
            },
            {
              key: "print",
              label: "Print pack",
              value: "80mm + A4",
              icon: Printer,
              ok: true,
            },
          ].map((step) => {
            const Icon = step.icon;
            return (
              <li
                key={step.key}
                className="hos-cell flex flex-col gap-1 rounded-xl px-3 py-2.5"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-[var(--hos-ink-3)]">
                  <Icon className="size-3.5" aria-hidden />
                  {step.label}
                  {step.ok ? (
                    <CheckCircle2
                      className="ml-auto size-3.5 text-[var(--hos-emerald)]"
                      aria-hidden
                    />
                  ) : null}
                </div>
                <strong className="text-sm tabular-nums text-[var(--hos-ink)]">
                  {step.value}
                </strong>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={() => navigate("/purchases")}
          >
            Purchases &amp; advances
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            asChild
          >
            <Link to="/print">
              <Printer className="size-3.5" aria-hidden />
              Cash drawer print
            </Link>
          </Button>
        </div>
      </GlassPanel>

      <MorphTabs
        glowId="bankViewGlow"
        value={view}
        onChange={setView}
        size="md"
        items={[
          { id: "timeline", label: "Cash timeline" },
          { id: "statements", label: "Statements" },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {view === "timeline" ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3.5">
              {timeline.length === 0 ? (
                <EmptyState
                  title="No cash events"
                  description="Till movements, purchases, and statement lines merge here."
                />
              ) : (
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                      <th className="px-2 py-2">When</th>
                      <th className="px-2 py-2">Source</th>
                      <th className="px-2 py-2">Detail</th>
                      <th className="px-2 py-2">Ref</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                      <th className="px-2 py-2">Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hos-line)]">
                    {timeline.map((e) => (
                      <tr key={e.id}>
                        <td className="px-2 py-2 tabular-nums whitespace-nowrap">
                          {e.dateLabel}
                        </td>
                        <td className="px-2 py-2">
                          <Badge tone="muted">{e.source}</Badge>
                        </td>
                        <td className="px-2 py-2 max-w-[280px] truncate" title={e.label}>
                          {e.label}
                        </td>
                        <td className="px-2 py-2 font-mono text-[10px]">{e.ref}</td>
                        <td
                          className={`px-2 py-2 text-right font-mono font-semibold tabular-nums ${
                            e.direction === "in"
                              ? "text-[var(--hos-emerald)]"
                              : "text-[var(--hos-ruby)]"
                          }`}
                        >
                          {e.direction === "in" ? "+" : "−"}
                          {formatNu(e.amountBtn)}
                        </td>
                        <td className="px-2 py-2">
                          {e.matched ? (
                            <CheckCircle2
                              className="size-4 text-[var(--hos-emerald)]"
                              aria-label="Matched"
                            />
                          ) : (
                            <Badge tone="vip">open</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <>
              <MorphTabs
                glowId="bankTabGlow"
                value={tab}
                onChange={setTab}
                size="md"
                items={[
                  { id: "all", label: "All" },
                  { id: "bob", label: "BoB" },
                  { id: "bnb", label: "BNB" },
                  { id: "drukpnb", label: "DrukPNB" },
                ]}
              />
              <div className="overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3.5">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Bank</th>
                      <th className="px-2 py-2">Description</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hos-line)]">
                    {statementRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-2 py-8">
                          <EmptyState
                            title="No statement lines"
                            description="Import or seed bank lines for this rail."
                          />
                        </td>
                      </tr>
                    ) : (
                      statementRows.map((l) => (
                        <tr key={l.id}>
                          <td className="px-2 py-2 tabular-nums">{l.txnDate}</td>
                          <td className="px-2 py-2">{BANK_LABEL[l.bankCode]}</td>
                          <td className="px-2 py-2">{l.description}</td>
                          <td className="px-2 py-2 text-right font-mono font-semibold tabular-nums">
                            {l.direction === "in" ? "+" : "−"}
                            {formatNu(l.amountBtn)}
                          </td>
                          <td className="px-2 py-2">
                            <Badge tone={l.status === "open" ? "vip" : "success"}>
                              {l.status}
                            </Badge>
                          </td>
                          <td className="px-2 py-2 text-right">
                            {l.status === "open" ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  start(() => {
                                    void (async () => {
                                      const res = await matchBankLineRemote({
                                        statementLineId: l.id,
                                        matchKind: "manual",
                                        matchEntityId: l.id,
                                        amountBtn: l.amountBtn,
                                      });
                                      if (!res.ok) {
                                        matchBankLine(l.id);
                                        toast.message("Matched locally", {
                                          description: res.error,
                                        });
                                        return;
                                      }
                                      toast.success("Line matched", {
                                        description: "Persisted to v2.reconciliation_matches",
                                      });
                                    })();
                                  });
                                }}
                              >
                                Match
                              </Button>
                            ) : (
                              <span className="text-[10px] text-[var(--hos-ink-3)]">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <GlassPanel className="flex h-fit flex-col gap-3 p-3.5">
          <strong className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4 text-[var(--hos-brass-ink)]" aria-hidden />
            Smart match rail
          </strong>
          <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
            Amount + date + PSBN/ref heuristics for open inflows
          </p>
          {suggestions.length === 0 ? (
            <EmptyState
              title="No suggestions"
              description="All statement lines matched or no confident pairs."
            />
          ) : (
            <ul className="m-0 max-h-[480px] list-none space-y-2 overflow-auto p-0">
              {suggestions.slice(0, 12).map((s) => (
                <li
                  key={`${s.bankLineId}-${s.targetId}`}
                  className="hos-cell rounded-xl px-3 py-2.5"
                >
                  <div className="text-[10px] font-mono text-[var(--hos-ink-3)]">
                    {s.bankDate} · {formatNu(s.bankAmount)}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[var(--hos-ink)]">
                    {s.bankDescription.slice(0, 48)}
                    {s.bankDescription.length > 48 ? "…" : ""}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--hos-ink-2)]">
                    → {s.targetLabel}
                    <Badge tone="muted" className="ml-1.5">
                      {s.reason}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    variant="secondary"
                    onClick={() => applySuggestion(s)}
                  >
                    Accept match
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>
    </div>
    </ModuleFrame>
  );
}
