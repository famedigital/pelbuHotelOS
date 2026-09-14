"use client";

import type {
  StayHubLedgerSummary,
  StayHubMoneyLine,
} from "@/app/actions/stay-hub";
import { VoidLineButton } from "@/components/erp/FolioOpsForms";
import {
  isPaymentLine,
  lineMatchesLedgerFilter,
  type LedgerFilterKind,
} from "@/lib/folio/ledger-summary";
import { formatGuestBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

const FILTERS: { id: LedgerFilterKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "room", label: "Room" },
  { id: "extra", label: "Extra" },
  { id: "payment", label: "Payment" },
  { id: "agent", label: "Agent tab" },
];

function typeLabel(sourceType: string): string {
  const st = (sourceType ?? "").toLowerCase();
  if (isPaymentLine(st)) return st === "deposit" ? "Deposit" : "Payment";
  if (st === "room") return "Room";
  if (st === "meal_plan") return "Meal";
  if (st === "extra_bed") return "Extra bed";
  if (st === "order" || st === "pos") return "POS";
  if (st === "laundry") return "Laundry";
  if (st === "adjustment" || st === "comp") return "Adj";
  return (sourceType || "other").replace(/_/g, " ");
}

/**
 * eZee Manage Folio muscle memory: summary strip + dense ledger grid.
 * Stays inside StayHub Folio → Bill.
 */
export function StayHubFolioLedgerTable({
  lines,
  summary,
  siblingFolios = [],
  empty,
  onVoided,
  onOptimisticVoid,
}: {
  lines: StayHubMoneyLine[];
  summary: StayHubLedgerSummary;
  siblingFolios?: Array<{ id: string; label: string }>;
  empty: string;
  onVoided: () => void;
  onOptimisticVoid?: (lineId: string) => void;
}) {
  const [filter, setFilter] = useState<LedgerFilterKind>("all");
  const [showVoided, setShowVoided] = useState(false);

  const visible = useMemo(() => {
    return lines.filter((l) => {
      const st = (l.status ?? "posted").toLowerCase();
      if (!showVoided && st === "voided") return false;
      if (st !== "posted" && st !== "voided") return false;
      return lineMatchesLedgerFilter(l, filter);
    });
  }, [lines, filter, showVoided]);

  const voidedCount = lines.filter(
    (l) => (l.status ?? "").toLowerCase() === "voided",
  ).length;

  return (
    <div className="space-y-1.5">
      {/* Manage Folio strip */}
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-5">
        {(
          [
            ["Rate", summary.rateBtn],
            ["Ext", summary.extBtn],
            ["Disc", summary.discountBtn],
            ["Paid", summary.paymentBtn],
            ["Balance", summary.balanceBtn],
          ] as const
        ).map(([label, amt]) => (
          <div
            key={label}
            className={cn(
              "rounded-md border border-border/70 bg-muted/20 px-2 py-1.5",
              label === "Balance" && "sm:col-span-1 border-foreground/15",
            )}
          >
            <p className="text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {label}
            </p>
            <p
              className={cn(
                "text-sm font-semibold tabular-nums tracking-tight",
                label === "Paid" &&
                  "text-emerald-800 dark:text-emerald-300",
                label === "Balance" &&
                  Math.abs(amt) > 0.5 &&
                  "text-maroon",
              )}
            >
              {formatGuestBtn(amt)}
            </p>
          </div>
        ))}
      </div>

      {siblingFolios.length > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Other open folios on this stay:{" "}
          {siblingFolios.map((f) => f.label).join(" · ")}. Use Advanced / full
          folio for multi-account split.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1">
        <div
          className="flex flex-1 flex-wrap gap-0.5 rounded-md border bg-muted/25 p-0.5"
          role="tablist"
          aria-label="Ledger filters"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "min-h-7 rounded px-2 text-[11px] font-medium transition-colors",
                filter === f.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {voidedCount > 0 ? (
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              checked={showVoided}
              onChange={(e) => setShowVoided(e.target.checked)}
              className="size-3 accent-foreground"
            />
            Voided ({voidedCount})
          </label>
        ) : null}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[36rem] text-left text-xs">
          <thead className="sticky top-0 bg-muted/50 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-2 py-1.5">Date</th>
              <th className="px-2 py-1.5">Type</th>
              <th className="px-2 py-1.5">Description</th>
              <th className="px-2 py-1.5">Bill to</th>
              <th className="px-2 py-1.5 text-right">Tax</th>
              <th className="px-2 py-1.5 text-right">Total</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-2 py-4 text-muted-foreground"
                >
                  {empty}
                </td>
              </tr>
            ) : (
              visible.map((l) => {
                const amt = Number(l.total_btn ?? 0);
                const isVoid = (l.status ?? "").toLowerCase() === "voided";
                const isPay = isPaymentLine(l.source_type);
                const canVoid =
                  !isVoid && !isPay && amt > 0;
                return (
                  <tr
                    key={l.id}
                    className={cn(
                      "border-t border-border/60 hover:bg-muted/30",
                      isVoid && "opacity-50",
                    )}
                  >
                    <td className="px-2 py-1 font-mono tabular-nums text-[11px]">
                      {l.date ?? "—"}
                    </td>
                    <td className="px-2 py-1 capitalize">
                      {typeLabel(l.source_type)}
                    </td>
                    <td className="max-w-[14rem] truncate px-2 py-1 font-medium">
                      {l.description || typeLabel(l.source_type)}
                    </td>
                    <td className="px-2 py-1 text-[11px] capitalize text-muted-foreground">
                      {l.bill_to === "agent" ? "Agent" : "Guest"}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                      {l.gst_btn != null && Math.abs(l.gst_btn) > 0.005
                        ? formatGuestBtn(l.gst_btn)
                        : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-2 py-1 text-right font-semibold tabular-nums",
                        (isPay || amt < 0) &&
                          "text-emerald-800 dark:text-emerald-300",
                      )}
                    >
                      {formatGuestBtn(amt)}
                    </td>
                    <td className="px-2 py-1 text-[10px] capitalize text-muted-foreground">
                      {l.status ?? "posted"}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {canVoid ? (
                        <div
                          className="inline-flex justify-end"
                          onSubmitCapture={() => {
                            onOptimisticVoid?.(l.id);
                            window.setTimeout(onVoided, 600);
                          }}
                        >
                          <VoidLineButton
                            lineId={l.id}
                            description={l.description ?? undefined}
                            collapsed
                          />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked ledger */}
      <ul className="divide-y overflow-y-auto rounded-md border bg-card md:hidden max-h-[min(22rem,48vh)]">
        {visible.length === 0 ? (
          <li className="px-2.5 py-3 text-xs text-muted-foreground">{empty}</li>
        ) : (
          visible.map((l) => {
            const amt = Number(l.total_btn ?? 0);
            const isVoid = (l.status ?? "").toLowerCase() === "voided";
            const isPay = isPaymentLine(l.source_type);
            const canVoid = !isVoid && !isPay && amt > 0;
            return (
              <li
                key={l.id}
                className={cn(
                  "flex flex-col gap-0.5 px-2.5 py-1.5",
                  isVoid && "opacity-50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">
                      {l.description || typeLabel(l.source_type)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {l.date ?? "—"} · {typeLabel(l.source_type)}
                      {l.bill_to === "agent" ? " · agent" : ""}
                      {isVoid ? " · voided" : ""}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-[12px] font-semibold tabular-nums",
                      (isPay || amt < 0) &&
                        "text-emerald-800 dark:text-emerald-300",
                    )}
                  >
                    {formatGuestBtn(amt)}
                  </p>
                </div>
                {canVoid ? (
                  <div
                    className="flex justify-end"
                    onSubmitCapture={() => {
                      onOptimisticVoid?.(l.id);
                      window.setTimeout(onVoided, 600);
                    }}
                  >
                    <VoidLineButton
                      lineId={l.id}
                      description={l.description ?? undefined}
                      collapsed
                    />
                  </div>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
