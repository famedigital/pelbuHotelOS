import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button, GlassPanel, KpiCard, ModuleFrame } from "@hos-v2/ui";
import { formatNu } from "../lib/front-office-store";
import { useFnbStore } from "../lib/fnb-store";

const ME = {
  name: "Sonam Tobgay",
  dept: "F&B",
  role: "Waiter",
  tipPoints: 9,
  totalPoints: 57,
};

const ROTA = [
  { day: "Sun", shift: "07:00–15:00 · Restaurant" },
  { day: "Mon", shift: "OFF" },
  { day: "Tue", shift: "15:00–23:00 · Banquet" },
  { day: "Wed", shift: "07:00–15:00 · Restaurant" },
  { day: "Thu", shift: "15:00–23:00 · Bar" },
  { day: "Fri", shift: "12:00–20:00 · Restaurant" },
  { day: "Sat", shift: "12:00–20:00 · Restaurant" },
];

export function StaffPortalPage() {
  const reduce = useReducedMotion();
  const [clockedIn, setClockedIn] = useState(false);
  const [clockAt, setClockAt] = useState<string | null>(null);
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [reason, setReason] = useState("Family ceremony");
  const orders = useFnbStore((s) => s.orders);
  const pool = orders.reduce((s, o) => s + o.sc, 0) + 18500;
  const myShare = Math.round((pool * ME.tipPoints) / ME.totalPoints);

  return (
    <ModuleFrame
      title="Staff Portal"
      description={`${ME.name} · ${ME.dept} · ${ME.role}`}
    >
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Tip points" value={ME.tipPoints} />
        <KpiCard label="My SC share" value={formatNu(myShare)} delta="This month" />
      </div>

      <GlassPanel className="flex flex-col items-center gap-3 p-5">
        <div className={`size-28 rounded-full border-4 ${clockedIn ? "border-[var(--hos-emerald)] bg-emerald-500/15" : "border-[var(--hos-line)] bg-[var(--hos-cell)]"} flex items-center justify-center`}>
          <span className="text-sm font-bold">{clockedIn ? "ON DUTY" : "OFF"}</span>
        </div>
        <motion.div whileTap={reduce ? undefined : { scale: 0.97 }} className="w-full">
          <Button
            className="w-full"
            size="lg"
            variant={clockedIn ? "danger" : "primary"}
            onClick={() => {
              const next = !clockedIn;
              setClockedIn(next);
              setClockAt(new Date().toLocaleTimeString());
              toast.success(next ? "Clocked in" : "Clocked out", { description: clockAt ? `Previous ${clockAt}` : "ZK punch recorded" });
            }}
          >
            {clockedIn ? "1-Tap Clock-Out" : "1-Tap Clock-In"}
          </Button>
        </motion.div>
        {clockAt ? <p className="m-0 text-xs text-[var(--hos-ink-3)]">Last punch {clockAt}</p> : null}
      </GlassPanel>

      <GlassPanel className="p-4">
        <strong className="text-sm">My tip pool (10% SC)</strong>
        <p className="mt-1 text-xs text-[var(--hos-ink-3)]">
          Pool {formatNu(pool)} · your weight {ME.tipPoints}/{ME.totalPoints} pts → <strong className="text-[var(--hos-emerald)]">{formatNu(myShare)}</strong>
        </p>
      </GlassPanel>

      <GlassPanel className="p-4">
        <strong className="text-sm">This week rota</strong>
        <ul className="mt-2 m-0 list-none space-y-1.5 p-0">
          {ROTA.map((r) => (
            <li key={r.day} className="hos-cell flex justify-between rounded-lg px-3 py-2 text-xs">
              <span className="font-bold">{r.day}</span>
              <span className={r.shift === "OFF" ? "text-[var(--hos-ink-3)]" : "text-[var(--hos-ink)]"}>{r.shift}</span>
            </li>
          ))}
        </ul>
      </GlassPanel>

      <GlassPanel className="flex flex-col gap-2 p-4">
        <strong className="text-sm">Leave request</strong>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-xs" />
          <input type="date" value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-xs" />
        </div>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-xs" />
        <Button size="sm" variant="secondary" onClick={() => {
          if (!leaveFrom || !leaveTo) { toast.error("Pick dates"); return; }
          toast.success("Leave submitted", { description: `${leaveFrom} → ${leaveTo} · pending HR` });
        }}>Submit leave</Button>
      </GlassPanel>
    </div>
    </ModuleFrame>
  );
}
