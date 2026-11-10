import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge, Button, GlassPanel, KpiCard, SpotlightCard,
  ModuleFrame,
} from "@hos-v2/ui";
import { formatNu, useEnterpriseOpsStore } from "../lib/enterprise-ops-store";

function daysUntil(ymd: string): number {
  return Math.ceil(
    (new Date(`${ymd}T12:00:00`).getTime() - Date.now()) / 86400000,
  );
}

export function UtilitiesPage() {
  const [, start] = useTransition();
  const meters = useEnterpriseOpsStore((s) => s.meters);
  const recordUtilityBill = useEnterpriseOpsStore((s) => s.recordUtilityBill);
  const [units, setUnits] = useState("12610");
  const [amount, setAmount] = useState("44120");
  const [meterId, setMeterId] = useState(meters[0]?.id ?? "");

  const dueSoon = meters.filter((m) => daysUntil(m.dueDate) <= 14).length;
  const monthSpend = meters.reduce((s, m) => s + m.lastBillBtn, 0);

  return (
    <ModuleFrame
      title="Utilities"
      description="Power · water · meter readings"
    >
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="m-0 text-2xl font-bold text-[var(--hos-ink)]">
            Utilities
          </h1>
          <Badge tone="default">BPC · Water · Telecom</Badge>
        </div>
        <p className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
          Meter register · bill capture · due alerts
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Meters" value={meters.length} />
        <KpiCard label="Month spend" value={formatNu(monthSpend)} />
        <KpiCard label="Due ≤14d" value={dueSoon} delta="Pay queue" />
        <KpiCard
          label="Next due"
          value={
            meters
              .slice()
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
              ?.dueDate ?? "—"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <SpotlightCard className="flex flex-col gap-3 p-3.5">
          <strong className="text-sm">Post meter bill</strong>
          <label className="grid gap-1 text-[11px] font-medium">
            Meter
            <select
              value={meterId}
              onChange={(e) => setMeterId(e.target.value)}
              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs"
            >
              {meters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-[11px] font-medium">
              Units
              <input
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs"
              />
            </label>
            <label className="grid gap-1 text-[11px] font-medium">
              Amount Nu
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs"
              />
            </label>
          </div>
          <Button
            onClick={() => {
              start(() => {
                recordUtilityBill(
                  meterId,
                  Number(amount) || 0,
                  Number(units) || 0,
                );
                toast.success("Utility bill recorded");
              });
            }}
          >
            Save bill
          </Button>
        </SpotlightCard>

        <div className="grid gap-3 sm:grid-cols-2">
          {meters.map((m) => {
            const d = daysUntil(m.dueDate);
            return (
              <GlassPanel key={m.id} className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{m.label}</div>
                    <div className="font-mono text-[11px] text-[var(--hos-ink-3)]">
                      {m.consumerNo}
                    </div>
                  </div>
                  <Badge tone={d <= 7 ? "vip" : "muted"}>{m.kind}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="text-[var(--hos-ink-3)]">Last units</span>
                  <span className="text-right tabular-nums">{m.lastUnits}</span>
                  <span className="text-[var(--hos-ink-3)]">Last bill</span>
                  <span className="text-right font-mono">
                    {formatNu(m.lastBillBtn)}
                  </span>
                  <span className="text-[var(--hos-ink-3)]">Due</span>
                  <span className="text-right">
                    <Badge tone={d < 0 ? "danger" : d <= 14 ? "vip" : "success"}>
                      {m.dueDate} · {d < 0 ? "overdue" : `${d}d`}
                    </Badge>
                  </span>
                </div>
              </GlassPanel>
            );
          })}
        </div>
      </div>
    </div>
    </ModuleFrame>
  );
}
