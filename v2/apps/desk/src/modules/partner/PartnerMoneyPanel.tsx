/**
 * Partner Money — MoU credit, city ledger, deposit proof + voucher rail.
 */
import { useMemo, useState } from "react";
import {
  Download,
  FileStack,
  Printer,
  Upload,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  GlassPanel,
  cn,
} from "@hos-v2/ui";
import { PERSONAL_CHECKOUT_GATE_BTN } from "@hos-v2/domain";
import type { Agent } from "../../lib/commercial-store";
import { formatNu } from "../../lib/front-office-store";
import {
  exportPartnerInvoicesExcel,
  filterPartnerInvoices,
  filterPartnerInvoicesBySource,
  type PartnerInvoiceRow,
  type PartnerLedgerSource,
  type PartnerPayFilter,
} from "../../lib/partner-intelligence";
import type {
  DepositMatchHint,
  PartnerDepositSlip,
} from "../../lib/partner-portal-store";
import type { PartnerVoucherUpload } from "../../lib/ecosystem-store";

function shortDoc(docNo: string): string {
  if (docNo.length <= 22) return docNo;
  return `${docNo.slice(0, 10)}…${docNo.slice(-6)}`;
}

function kindLabel(kind: PartnerInvoiceRow["kind"], source: PartnerInvoiceRow["source"]) {
  if (source === "stay" || kind === "FOLIO") return "Working";
  return kind;
}

type Props = {
  agent: Agent;
  agencyCode: string;
  agencyName: string;
  invoices: PartnerInvoiceRow[];
  depositSlips: PartnerDepositSlip[];
  vouchers: PartnerVoucherUpload[];
  onOpenInvoice: (row: PartnerInvoiceRow, print: boolean) => void;
  onPrintPack: () => void;
  uploadDeposit: (input: {
    amount: number;
    method: "wire" | "mbob";
    ref: string;
    note: string;
  }) => { ok: true; slip: PartnerDepositSlip } | { ok: false; error: string };
  suggestDepositMatches: (amount: number) => DepositMatchHint[];
  uploadVoucherPdf: (input: {
    fileName: string;
    amountBtn: number;
  }) => Promise<
    | { ok: true; voucher: PartnerVoucherUpload }
    | { ok: false; error: string }
  >;
};

export function PartnerMoneyPanel({
  agent,
  agencyCode,
  agencyName,
  invoices,
  depositSlips,
  vouchers,
  onOpenInvoice,
  onPrintPack,
  uploadDeposit,
  suggestDepositMatches,
  uploadVoucherPdf,
}: Props) {
  const [payFilter, setPayFilter] = useState<PartnerPayFilter>("all");
  const [sourceFilter, setSourceFilter] =
    useState<PartnerLedgerSource>("all");
  const [query, setQuery] = useState("");
  const [depAmt, setDepAmt] = useState(25_000);
  const [depRef, setDepRef] = useState("");
  const [depMethod, setDepMethod] = useState<"wire" | "mbob">("mbob");
  const [matchHints, setMatchHints] = useState<DepositMatchHint[]>([]);
  const [voucherFile, setVoucherFile] = useState("");
  const [voucherAmt, setVoucherAmt] = useState(25_000);

  const headroom = Math.max(0, agent.creditLimit - agent.usedCredit);
  const utilPct =
    agent.creditLimit > 0
      ? Math.min(100, Math.round((agent.usedCredit / agent.creditLimit) * 100))
      : 0;

  const totals = useMemo(() => {
    const open = invoices.filter((r) => r.status === "unpaid");
    const paid = invoices.filter((r) => r.status === "paid");
    const fiscal = invoices.filter((r) => r.source === "fiscal");
    const working = invoices.filter((r) => r.source === "stay");
    return {
      unpaidCount: open.length,
      paidCount: paid.length,
      unpaidAmt: open.reduce((s, r) => s + r.balance, 0),
      paidAmt: paid.reduce((s, r) => s + r.amount, 0),
      allCount: invoices.filter((r) => r.status !== "void").length,
      fiscalCount: fiscal.filter((r) => r.status !== "void").length,
      workingCount: working.filter((r) => r.status !== "void").length,
    };
  }, [invoices]);

  const filtered = useMemo(() => {
    const byPay = filterPartnerInvoices(invoices, payFilter);
    const bySource = filterPartnerInvoicesBySource(byPay, sourceFilter);
    const q = query.trim().toLowerCase();
    if (!q) return bySource;
    return bySource.filter(
      (r) =>
        r.docNo.toLowerCase().includes(q) ||
        r.guest.toLowerCase().includes(q) ||
        (r.stayRef ?? "").toLowerCase().includes(q),
    );
  }, [invoices, payFilter, sourceFilter, query]);

  const agingBuckets = [
    { id: "current", label: "Current", amount: agent.aging.current },
    { id: "d30", label: "30d", amount: agent.aging.d30 },
    { id: "d60", label: "60d", amount: agent.aging.d60 },
    { id: "d90", label: "90d+", amount: agent.aging.d90 },
  ] as const;

  return (
    <div className="flex flex-col gap-4" data-testid="partner-money-panel">
      {/* MoU credit strip — one bright commercial moment */}
      <GlassPanel className="overflow-hidden p-3.5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <strong className="flex items-center gap-1.5 text-sm text-[var(--hos-ink)]">
              <Wallet className="size-4 text-[var(--hos-primary)]" />
              MoU credit · {agencyName}
            </strong>
            <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
              Terms {agent.termsDays}d · headroom for new blocks
            </p>
          </div>
          <Badge tone={utilPct >= 85 ? "danger" : utilPct >= 60 ? "vip" : "success"}>
            {utilPct}% used
          </Badge>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5">
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
              Limit
            </div>
            <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-[var(--hos-ink)]">
              {formatNu(agent.creditLimit)}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5">
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
              Used
            </div>
            <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-[var(--hos-ink)]">
              {formatNu(agent.usedCredit)}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5">
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
              Headroom
            </div>
            <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-[var(--hos-emerald)]">
              {formatNu(headroom)}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5">
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
              Open AR
            </div>
            <div
              className={cn(
                "mt-0.5 font-mono text-sm font-bold tabular-nums",
                totals.unpaidAmt > 0.5
                  ? "text-[var(--hos-ruby)]"
                  : "text-[var(--hos-ink)]",
              )}
            >
              {formatNu(totals.unpaidAmt)}
            </div>
          </div>
        </div>

        <div
          className="mb-3 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--hos-primary)_12%,transparent)]"
          role="progressbar"
          aria-valuenow={utilPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="MoU credit utilization"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-200",
              utilPct >= 85
                ? "bg-[var(--hos-ruby)]"
                : utilPct >= 60
                  ? "bg-[var(--hos-brass)]"
                  : "bg-[var(--hos-primary)]",
            )}
            style={{ width: `${utilPct}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {agingBuckets.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-2 text-center"
            >
              <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--hos-ink-3)]">
                {b.label}
              </div>
              <strong
                className={cn(
                  "font-mono text-[12px] tabular-nums",
                  b.amount > 0.5
                    ? "text-[var(--hos-ruby)]"
                    : "text-[var(--hos-ink-2)]",
                )}
              >
                {formatNu(b.amount)}
              </strong>
            </div>
          ))}
        </div>
      </GlassPanel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.85fr)]">
        <GlassPanel className="overflow-hidden p-3.5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <strong className="flex items-center gap-1.5 text-sm">
                <FileStack className="size-4 text-[var(--hos-primary)]" />
                City ledger
              </strong>
              <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
                Tax invoices, PSBN &amp; open working folios for {agencyName}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="!min-h-9 !rounded-full !px-3"
              onClick={onPrintPack}
              data-testid="partner-print-pack"
            >
              <Printer className="size-3.5" strokeWidth={2} />
              Print pack
            </Button>
          </div>

          <div className="mb-2 flex flex-wrap gap-1.5">
            {(
              [
                { id: "all" as const, label: "All", count: totals.allCount },
                {
                  id: "unpaid" as const,
                  label: "Unpaid",
                  count: totals.unpaidCount,
                },
                {
                  id: "paid" as const,
                  label: "Paid",
                  count: totals.paidCount,
                },
              ] as const
            ).map((f) => {
              const active = payFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPayFilter(f.id)}
                  className={cn(
                    "hos-btn-tactile inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold transition",
                    active
                      ? f.id === "unpaid"
                        ? "bg-[var(--hos-ruby)] text-white"
                        : f.id === "paid"
                          ? "bg-[var(--hos-emerald)] text-white"
                          : "bg-[var(--hos-ink)] text-white"
                      : "border border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]",
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                      active ? "bg-white/20" : "bg-[rgba(17,17,17,0.06)]",
                    )}
                  >
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {(
              [
                { id: "all" as const, label: "All docs", count: totals.allCount },
                {
                  id: "fiscal" as const,
                  label: "Invoices",
                  count: totals.fiscalCount,
                },
                {
                  id: "working" as const,
                  label: "Working",
                  count: totals.workingCount,
                },
              ] as const
            ).map((f) => {
              const active = sourceFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSourceFilter(f.id)}
                  className={cn(
                    "inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold transition",
                    active
                      ? "bg-[color-mix(in_srgb,var(--hos-primary)_14%,transparent)] text-[var(--hos-primary)]"
                      : "text-[var(--hos-ink-3)] hover:bg-[color-mix(in_srgb,var(--hos-primary)_7%,transparent)]",
                  )}
                >
                  {f.label}
                  <span className="font-mono text-[10px] tabular-nums">{f.count}</span>
                </button>
              );
            })}
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5 text-center text-[11px]">
              <div className="text-[var(--hos-ink-3)]">Unpaid</div>
              <strong className="font-mono tabular-nums text-[var(--hos-ruby)]">
                {formatNu(totals.unpaidAmt)}
              </strong>
            </div>
            <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5 text-center text-[11px]">
              <div className="text-[var(--hos-ink-3)]">Paid</div>
              <strong className="font-mono tabular-nums text-[var(--hos-emerald)]">
                {formatNu(totals.paidAmt)}
              </strong>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="partner-money-search">
              Search ledger
            </label>
            <input
              id="partner-money-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search doc, guest, stay ref…"
              className="hos-input min-w-[160px] flex-1 !min-h-10 !rounded-xl !text-[13px]"
              inputMode="search"
            />
            <Button
              size="sm"
              variant="secondary"
              className="hos-btn-tactile !min-h-10 gap-1.5 !rounded-xl text-[12px] font-bold"
              disabled={filtered.length === 0}
              onClick={() => {
                const res = exportPartnerInvoicesExcel(agencyCode, filtered);
                toast.success("Invoices exported for Excel", {
                  description: `${res.filename} · ${res.rows} row(s)`,
                });
              }}
            >
              <Download className="size-3.5" strokeWidth={2} />
              Export Excel
            </Button>
          </div>

          <div className="hos-scrollbar-slim max-h-[min(520px,60vh)] overflow-auto rounded-xl border border-[var(--hos-line)]">
            <table className="hos-data w-full min-w-[640px] text-left text-xs">
              <thead className="sticky top-0 z-[1] bg-[var(--hos-cell)]">
                <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase tracking-wide text-[var(--hos-ink-3)]">
                  <th className="px-2.5 py-2.5">Guest / group</th>
                  <th className="px-2.5 py-2.5">Doc</th>
                  <th className="px-2.5 py-2.5">Date</th>
                  <th className="px-2.5 py-2.5 text-right">Amount</th>
                  <th className="px-2.5 py-2.5 text-right">Balance</th>
                  <th className="px-2.5 py-2.5">Status</th>
                  <th className="px-2.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hos-line)] bg-white text-[var(--hos-ink)] dark:bg-[var(--hos-cell)]">
                {filtered.map((d) => {
                  const when = new Date(d.at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                  });
                  const canOpen = Boolean(d.stayId);
                  const openBal = d.balance > PERSONAL_CHECKOUT_GATE_BTN;
                  return (
                    <tr
                      key={d.id}
                      className={cn(
                        "align-middle transition-colors",
                        canOpen &&
                          "cursor-pointer hover:bg-[color-mix(in_srgb,var(--hos-primary)_6%,transparent)]",
                      )}
                      onClick={() => {
                        if (canOpen) onOpenInvoice(d, false);
                      }}
                    >
                      <td className="px-2.5 py-2.5">
                        <div className="font-semibold text-[var(--hos-ink)]">
                          {d.guest}
                        </div>
                        {d.stayRef ? (
                          <div className="mt-0.5 font-mono text-[10px] text-[var(--hos-ink-3)]">
                            {d.stayRef}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-2.5 py-2.5">
                        <button
                          type="button"
                          title={d.docNo}
                          className={cn(
                            "text-left font-mono text-[11px] font-semibold",
                            canOpen
                              ? "text-[var(--hos-primary)] underline-offset-2 hover:underline"
                              : "text-[var(--hos-ink)]",
                          )}
                          disabled={!canOpen}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenInvoice(d, false);
                          }}
                        >
                          {shortDoc(d.docNo)}
                        </button>
                        <div className="mt-0.5">
                          <Badge tone={d.source === "fiscal" ? "teal" : "muted"}>
                            {kindLabel(d.kind, d.source)}
                          </Badge>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-2.5 font-mono tabular-nums text-[var(--hos-ink-2)]">
                        {when}
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                        {formatNu(d.amount)}
                      </td>
                      <td
                        className={cn(
                          "px-2.5 py-2.5 text-right font-mono font-bold tabular-nums",
                          openBal
                            ? "text-[var(--hos-ruby)]"
                            : "text-[var(--hos-emerald)]",
                        )}
                      >
                        {formatNu(d.balance)}
                      </td>
                      <td className="px-2.5 py-2.5">
                        <Badge
                          tone={
                            d.status === "paid"
                              ? "success"
                              : d.status === "void"
                                ? "muted"
                                : "danger"
                          }
                        >
                          {d.status}
                        </Badge>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="!min-h-8 !rounded-lg !px-2 text-[11px] font-bold"
                            disabled={!canOpen}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenInvoice(d, false);
                            }}
                          >
                            Open
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="!min-h-8 gap-1 !rounded-lg !px-2 text-[11px] font-bold"
                            disabled={!canOpen}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenInvoice(d, true);
                            }}
                          >
                            <Printer className="size-3" strokeWidth={2} />
                            Print
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-10">
                      <EmptyState
                        title={
                          payFilter === "paid"
                            ? "No paid invoices"
                            : payFilter === "unpaid"
                              ? "No unpaid balance"
                              : sourceFilter === "fiscal"
                                ? "No fiscal invoices yet"
                                : sourceFilter === "working"
                                  ? "No open working folios"
                                  : "No ledger rows"
                        }
                        description="Fiscal docs and open stay folios with a real balance appear here."
                      />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-3 p-3.5">
          <div>
            <strong className="flex items-center gap-1.5 text-sm">
              <Wallet className="size-4 text-[var(--hos-primary)]" />
              Deposit proof
            </strong>
            <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
              Match bank / mBoB proof against unpaid invoices, then send to desk.
            </p>
          </div>

          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
            Amount (Nu.)
            <input
              type="number"
              value={depAmt}
              onChange={(e) => setDepAmt(Number(e.target.value) || 0)}
              className="hos-input !rounded-xl !text-[13px] font-semibold normal-case tracking-normal text-[var(--hos-ink)]"
            />
          </label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
            Bank / mBoB ref
            <input
              value={depRef}
              onChange={(e) => setDepRef(e.target.value)}
              placeholder="e.g. BNB-TRF-992184"
              className="hos-input !rounded-xl !text-[13px] font-semibold normal-case tracking-normal text-[var(--hos-ink)]"
            />
          </label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
            Method
            <select
              value={depMethod}
              onChange={(e) => setDepMethod(e.target.value as "wire" | "mbob")}
              className="hos-input !rounded-xl !text-[13px] font-semibold normal-case tracking-normal text-[var(--hos-ink)]"
            >
              <option value="mbob">mBoB</option>
              <option value="wire">Wire</option>
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="!rounded-full"
              onClick={() => setMatchHints(suggestDepositMatches(depAmt))}
            >
              Suggest match
            </Button>
            <Button
              size="sm"
              className="hos-btn-ink !rounded-full"
              onClick={() => {
                const res = uploadDeposit({
                  amount: depAmt,
                  method: depMethod,
                  ref: depRef,
                  note: `${agencyCode} portal upload`,
                });
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success("Uploaded for desk verify", {
                  description: res.slip.ref,
                });
                setDepRef("");
              }}
            >
              <Upload className="mr-1 size-3.5" />
              Upload for desk
            </Button>
          </div>

          {matchHints.length ? (
            <ul className="m-0 list-none space-y-1 p-0 text-[11px]">
              {matchHints.map((h) => (
                <li
                  key={h.fiscalDocId}
                  className="flex justify-between rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-2"
                >
                  <span>
                    {h.docNo} · {formatNu(h.amount)}
                  </span>
                  <span className="font-mono text-[var(--hos-ink-3)]">
                    Δ {formatNu(h.delta)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="space-y-1.5">
            {depositSlips.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-2 text-[11px]"
              >
                <span>
                  {formatNu(s.amount)} · {s.ref}
                </span>
                <Badge
                  tone={
                    s.status === "verified"
                      ? "success"
                      : s.status === "rejected"
                        ? "danger"
                        : "vip"
                  }
                >
                  {s.status}
                </Badge>
              </div>
            ))}
          </div>
          <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
            Desk verifies deposits on Agents · Operator 360.
          </p>

          <div className="border-t border-[var(--hos-line)] pt-3">
            <strong className="text-xs font-bold text-[var(--hos-ink)]">
              Voucher → master folio
            </strong>
            <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
              Link a tour voucher PDF to the agency master folio.
            </p>
            <label className="mt-2 grid gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
              File name
              <input
                value={voucherFile}
                onChange={(e) => setVoucherFile(e.target.value)}
                placeholder="voucher-Oct-2026.pdf"
                className="hos-input !rounded-xl !text-[13px] font-semibold normal-case tracking-normal text-[var(--hos-ink)]"
              />
            </label>
            <label className="mt-2 grid gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
              Amount (Nu.)
              <input
                type="number"
                value={voucherAmt}
                onChange={(e) => setVoucherAmt(Number(e.target.value) || 0)}
                className="hos-input !rounded-xl !text-[13px] font-semibold normal-case tracking-normal text-[var(--hos-ink)]"
              />
            </label>
            <Button
              size="sm"
              className="mt-2 !min-h-12 w-full !rounded-xl"
              onClick={() => {
                void uploadVoucherPdf({
                  fileName: voucherFile || "voucher.pdf",
                  amountBtn: voucherAmt,
                }).then((res) => {
                  if (!res.ok) toast.error(res.error);
                  else
                    toast.success("Voucher linked to master folio", {
                      description: res.voucher.fileName,
                    });
                });
              }}
            >
              <FileStack className="mr-1 size-3.5" />
              Upload voucher PDF
            </Button>
            {vouchers.length > 0 ? (
              <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[11px]">
                {vouchers.slice(0, 5).map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5"
                  >
                    <span className="truncate">
                      {v.fileName} · {formatNu(v.amountBtn)}
                    </span>
                    <Badge
                      tone={
                        v.status === "linked"
                          ? "success"
                          : v.status === "failed"
                            ? "danger"
                            : "vip"
                      }
                    >
                      {v.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
