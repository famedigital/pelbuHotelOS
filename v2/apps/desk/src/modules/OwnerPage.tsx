import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Badge, Button, GlassPanel, KpiCard, ModuleFrame } from "@hos-v2/ui";
import {
  formatNu,
  folioBalance,
  useFrontOfficeStore,
} from "../lib/front-office-store";
import { useFnbStore } from "../lib/fnb-store";
import { useFiscalStore } from "../lib/fiscal-store";
import { useExtrasStore } from "../lib/extras-store";
import { useOpsStore } from "../lib/ops-store";
import { useCommercialStore } from "../lib/commercial-store";

const MTD_TARGET = 2_500_000;

export function OwnerPage() {
  const reduce = useReducedMotion();
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const stays = useFrontOfficeStore((s) => s.stays);
  const rooms = useFrontOfficeStore((s) => s.rooms);
  const orders = useFnbStore((s) => s.orders);
  const kots = useFnbStore((s) => s.kots);
  const tillBalance = useFiscalStore((s) => s.tillBalance);
  const tillShifts = useExtrasStore((s) => s.tillShifts);
  const bags = useOpsStore((s) => s.bags);
  const agents = useCommercialStore((s) => s.agents);
  const pulse = useMemo(
    () => useExtrasStore.getState().ownerPulse(),
    [stays, rooms, orders, tillShifts, tillBalance],
  );

  const inHouse = stays.filter((s) => s.status === "checked_in");
  const roomRev = inHouse.reduce((sum, s) => sum + s.nightlyNet, 0);
  const fbRev = orders.reduce((sum, o) => sum + o.total, 0);
  const laundryRev = bags
    .filter((b) => b.status === "posted")
    .reduce((sum, b) => sum + b.netAmount, 0);
  const gross = roomRev + fbRev + laundryRev;

  const spark = useMemo(
    () => [42, 48, 51, 55, 58, 61, pulse.occPct],
    [pulse.occPct],
  );

  const mtdActual = Math.round(gross * 18 + 420000);
  const mtdPct = Math.min(100, Math.round((mtdActual / MTD_TARGET) * 100));
  const projected = Math.round(mtdActual / Math.max(1, new Date().getDate()) * 30);

  const radar: { severity: "high" | "med"; text: string }[] = [];
  const openShift = tillShifts.find((t) => !t.closedAt);
  if (openShift && openShift.counted == null) {
    radar.push({ severity: "med", text: "Till shift still open — unreconciled float" });
  }
  if (tillBalance > 80000) {
    radar.push({ severity: "high", text: `Till cash ${formatNu(tillBalance)} exceeds bank-drop comfort` });
  }
  const cancelledKots = kots.filter((k) => k.status === "cancelled");
  for (const k of cancelledKots) {
    radar.push({ severity: "high", text: `Voided POS/KOT ${k.ticketNo} · manager PIN audit required` });
  }
  // Demo void flag if none
  if (cancelledKots.length === 0 && orders.length === 0) {
    radar.push({ severity: "med", text: "No voided tickets today — radar clear for F&B voids" });
  }
  const keyDup = stays.filter(
    (s) => ["confirmed", "held"].includes(s.status) && s.roomId && s.checkIn === businessDate,
  );
  // Key without check-in: assigned but not checked in past arrival day start
  for (const s of keyDup) {
    radar.push({
      severity: "med",
      text: `Key/room ${s.roomNumber} assigned without check-in · ${s.guestName}`,
    });
  }
  for (const a of agents) {
    if (a.usedCredit / a.creditLimit > 0.9) {
      radar.push({
        severity: "high",
        text: `${a.name} credit ${Math.round((a.usedCredit / a.creditLimit) * 100)}% of MoU limit`,
      });
    }
  }
  const heavyFolios = inHouse.filter((s) => folioBalance(s) > 25000);
  for (const s of heavyFolios) {
    radar.push({
      severity: "med",
      text: `Folio Rm ${s.roomNumber} ${formatNu(folioBalance(s))} — watch settlement`,
    });
  }

  const dirty = rooms.filter((r) => r.hkStatus === "dirty").length;
  const openBal = inHouse.filter((s) => folioBalance(s) > 0).length;

  const waPreview = [
    `🏨 ${businessDate} Night Audit Preview`,
    `Occ ${pulse.occPct}% · ADR ${formatNu(pulse.adr)} · RevPAR ${formatNu(pulse.revpar)}`,
    `Gross ${formatNu(gross)} = Rooms ${formatNu(roomRev)} + F&B ${formatNu(fbRev)} + Laundry ${formatNu(laundryRev)}`,
    `In-house ${inHouse.length} · Dirty ${dirty} · Open folios ${openBal}`,
    `Till ${formatNu(tillBalance)} · Radar flags ${radar.filter((r) => r.severity === "high").length} high`,
    `MTD ${formatNu(mtdActual)} / target ${formatNu(MTD_TARGET)} (${mtdPct}%)`,
  ].join("\n");

  return (
    <ModuleFrame
      title="Owner · Pocket CEO"
      description="Live odometers · loss prevention · 23:30 WhatsApp bot · MTD pacing"
      actions={
        <motion.div whileTap={reduce ? undefined : { scale: 0.97 }}>
          <Button
            onClick={() =>
              toast.success("Test WhatsApp dispatched", {
                description: "Owner + GM group · night audit summary simulated",
              })
            }
          >
            Trigger Test Dispatch
          </Button>
        </motion.div>
      }
    >
    <div className="flex flex-col gap-4">

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Occupancy" value={`${pulse.occPct}%`} sparkline={spark} delta="7-day trend" />
        <KpiCard label="ADR" value={formatNu(pulse.adr)} delta="Net room" />
        <KpiCard label="RevPAR" value={formatNu(pulse.revpar)} delta="Per key" />
        <KpiCard label="Gross today" value={formatNu(gross)} delta="All depts" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="hos-cell rounded-xl p-3">
          <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Rooms</div>
          <strong className="text-lg tabular-nums text-[var(--hos-ink)]">{formatNu(roomRev)}</strong>
        </div>
        <div className="hos-cell rounded-xl p-3">
          <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">F&B</div>
          <strong className="text-lg tabular-nums text-[var(--hos-ink)]">{formatNu(fbRev)}</strong>
        </div>
        <div className="hos-cell rounded-xl p-3">
          <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Laundry</div>
          <strong className="text-lg tabular-nums text-[var(--hos-ink)]">{formatNu(laundryRev)}</strong>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel className="p-4">
          <strong className="text-sm text-[var(--hos-ink)]">Anti-theft & loss prevention</strong>
          <ul className="mt-3 m-0 list-none space-y-2 p-0">
            {radar.slice(0, 8).map((f) => (
              <li
                key={f.text}
                className={`hos-cell rounded-xl px-3 py-2 text-xs font-medium ${
                  f.severity === "high" ? "text-[var(--hos-ruby)]" : "text-[var(--hos-brass-ink)]"
                }`}
              >
                <Badge tone={f.severity === "high" ? "danger" : "vip"} className="mr-2">
                  {f.severity}
                </Badge>
                {f.text}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-[var(--hos-ink-3)]">
            Flags: unrecorded till opens · voided POS with PIN trail · keys without check-in · MoU credit overages · heavy folios
          </p>
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-3 p-4">
          <strong className="text-sm">23:30 WhatsApp Night Audit Bot</strong>
          <p className="m-0 text-xs text-[var(--hos-ink-3)]">
            Live preview of the automated message ready for Owner / GM phones.
          </p>
          <pre className="hos-cell m-0 flex-1 whitespace-pre-wrap rounded-xl p-3 font-sans text-[11px] leading-relaxed text-[var(--hos-ink-2)]">
            {waPreview}
          </pre>
          <motion.div whileTap={reduce ? undefined : { scale: 0.97 }}>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() =>
                toast.success("Test dispatch sent", {
                  description: "Simulated WA to +975-17… Owner group",
                })
              }
            >
              1-Tap Trigger Test Dispatch
            </Button>
          </motion.div>
        </GlassPanel>
      </div>

      <GlassPanel className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <strong className="text-sm text-[var(--hos-ink)]">MTD vs target revenue</strong>
            <p className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
              Actual {formatNu(mtdActual)} · Target {formatNu(MTD_TARGET)} · Projected month-end {formatNu(projected)}
            </p>
          </div>
          <Badge tone={mtdPct >= 80 ? "success" : mtdPct >= 55 ? "vip" : "danger"}>
            {mtdPct}% paced
          </Badge>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)] dark:bg-[rgba(255,255,255,0.08)]">
          <motion.div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--hos-primary-mid),var(--hos-primary))]"
            initial={{ width: 0 }}
            animate={{ width: `${mtdPct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </GlassPanel>
    </div>
    </ModuleFrame>
  );
}
