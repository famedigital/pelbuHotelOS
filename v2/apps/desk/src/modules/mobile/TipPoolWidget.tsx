import { useMemo } from "react";
import { Badge } from "@hos-v2/ui";
import { useEnterpriseOpsStore } from "../../lib/enterprise-ops-store";
import { formatNu, useFnbStore } from "../../lib/fnb-store";
import { useFrontOfficeStore } from "../../lib/front-office-store";

/**
 * Handheld tip-pool accumulator — shows this waiter’s share of 10% SC pool
 * from settled POS + in-house room SC for the open month.
 */
export function TipPoolWidget({
  staffId = "st-4",
}: {
  /** Default Sonam Tobgay (waiter) from HR seed */
  staffId?: string;
}) {
  const orders = useFnbStore((s) => s.orders);
  const stays = useFrontOfficeStore((s) => s.stays);
  const hrStaff = useEnterpriseOpsStore((s) => s.hrStaff);
  const runTipPool = useEnterpriseOpsStore((s) => s.runTipPool);

  const periodYm = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const snapshot = useMemo(() => {
    const result = runTipPool(periodYm);
    const line = result.lines.find((l) => l.staffId === staffId);
    const me = hrStaff.find((s) => s.id === staffId);
    const posSc = orders.reduce((s, o) => s + (o.sc ?? 0), 0);
    const roomSc = stays
      .filter((st) => st.status === "checked_in")
      .reduce(
        (s, st) =>
          s +
          st.folioLines
            .filter((l) => !l.voided && l.kind === "room")
            .reduce((a, l) => a + l.scAmount, 0),
        0,
      );
    return {
      me,
      shareBtn: line?.shareBtn ?? 0,
      poolBtn: result.poolBtn,
      liveSc: Math.round((posSc + roomSc) * 100) / 100,
      tipPoints: me?.tipPoints ?? 1.5,
    };
  }, [runTipPool, periodYm, staffId, hrStaff, orders, stays]);

  return (
    <div
      className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.1)] px-3 py-2"
      role="status"
      aria-label="Tip pool share"
    >
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--hos-emerald)]">
          Tip pool · 10% SC
        </div>
        <div className="truncate text-[12px] font-semibold text-[var(--hos-ink)]">
          {snapshot.me?.name ?? "Staff"} · {snapshot.tipPoints} pts
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-[15px] font-black tabular-nums text-[var(--hos-ink)]">
          {formatNu(snapshot.shareBtn)}
        </div>
        <Badge tone="success" className="!text-[9px]">
          of {formatNu(snapshot.poolBtn || snapshot.liveSc)}
        </Badge>
      </div>
    </div>
  );
}
