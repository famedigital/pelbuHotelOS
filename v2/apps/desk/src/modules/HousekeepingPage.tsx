import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge, Button, GlassPanel, KpiCard, ModuleFrame, useIsPhone } from "@hos-v2/ui";
import { useFrontOfficeStore, type HkStatus } from "../lib/front-office-store";
import { useOpsStore } from "../lib/ops-store";
import { HousekeepingMobileView } from "./mobile/HousekeepingMobileView";

const STATUS_ORDER: HkStatus[] = ["dirty", "clean", "inspected", "occupied", "ooo"];

function hkTone(s: HkStatus) {
  if (s === "clean" || s === "inspected")
    return "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300";
  if (s === "dirty") return "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300";
  if (s === "ooo") return "bg-slate-500/20 border-slate-500/40 text-slate-600 dark:text-slate-300";
  return "bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300";
}

export function HousekeepingPage() {
  const isPhone = useIsPhone();
  const reduce = useReducedMotion();
  const [, start] = useTransition();
  const [floorFilter, setFloorFilter] = useState<number | "all">("all");
  const [woTitle, setWoTitle] = useState("AC repair");
  const [woRoomId, setWoRoomId] = useState("rm-207");
  const [woCat, setWoCat] = useState<"ac" | "plumbing" | "electrical" | "furniture">("ac");

  const rooms = useFrontOfficeStore((s) => s.rooms);
  const stays = useFrontOfficeStore((s) => s.stays);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const maids = useOpsStore((s) => s.maids);
  const assignments = useOpsStore((s) => s.assignments);
  const workOrders = useOpsStore((s) => s.workOrders);
  const assignMaid = useOpsStore((s) => s.assignMaid);
  const setHk = useOpsStore((s) => s.setHk);
  const createWorkOrder = useOpsStore((s) => s.createWorkOrder);
  const completeWorkOrder = useOpsStore((s) => s.completeWorkOrder);

  const floors = useMemo(
    () => [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b),
    [rooms],
  );

  const visible = rooms.filter((r) => floorFilter === "all" || r.floor === floorFilter);

  const dirty = rooms.filter((r) => r.hkStatus === "dirty").length;
  const clean = rooms.filter((r) => r.hkStatus === "clean" || r.hkStatus === "inspected").length;
  const ooo = rooms.filter((r) => r.hkStatus === "ooo").length;

  const discrepancies = rooms
    .map((r) => {
      const stay = stays.find((s) => s.roomId === r.id && s.status === "checked_in");
      const fdOccupied = Boolean(stay);
      const hkVacant = r.hkStatus === "clean" || r.hkStatus === "inspected" || r.hkStatus === "dirty";
      if (fdOccupied && r.hkStatus !== "occupied" && r.hkStatus !== "dirty") {
        return {
          room: r.number,
          issue: `FD Occupied (${stay!.guestName}) vs HK ${r.hkStatus}`,
          stayId: stay!.id,
        };
      }
      if (!fdOccupied && r.hkStatus === "occupied") {
        return {
          room: r.number,
          issue: "HK Occupied but no in-house stay on FO",
          stayId: null as string | null,
        };
      }
      if (hkVacant && fdOccupied && r.hkStatus === "clean") {
        return {
          room: r.number,
          issue: `FD Occupied vs HK Vacant/Clean — ${stay!.guestName}`,
          stayId: stay!.id,
        };
      }
      return null;
    })
    .filter(Boolean) as { room: string; issue: string; stayId: string | null }[];

  if (isPhone) return <HousekeepingMobileView />;

  return (
    <ModuleFrame
      title="Housekeeping"
      description="Floor grid · maid assign · 1-tap status · FD vs HK discrepancy · maintenance OOO"
      actions={
        <Badge tone="default" className="border border-[var(--hos-primary)]">
          Discrepancy Grid
        </Badge>
      }
    >
    <div className="flex flex-col gap-4">

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Dirty" value={dirty} delta="Needs service" />
        <KpiCard label="Ready" value={clean} delta="Clean / Inspected" />
        <KpiCard label="OOO" value={ooo} delta="Blocked inventory" />
        <KpiCard label="Discrepancies" value={discrepancies.length} delta="FD ↔ HK" />
      </div>

      <div className="relative flex flex-wrap gap-1 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-1 w-fit">
        <button
          type="button"
          onClick={() => setFloorFilter("all")}
          className="relative px-3 py-1.5 text-xs font-semibold"
        >
          {floorFilter === "all" ? (
            <motion.span
              layoutId="hkFloorPill"
              className="absolute inset-0 rounded-lg border border-[var(--hos-primary)]/30 bg-[var(--hos-primary)]/15"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          ) : null}
          <span className={`relative z-10 ${floorFilter === "all" ? "text-[var(--hos-primary)]" : "text-[var(--hos-ink-2)]"}`}>
            All floors
          </span>
        </button>
        {floors.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFloorFilter(f)}
            className="relative px-3 py-1.5 text-xs font-semibold"
          >
            {floorFilter === f ? (
              <motion.span
                layoutId="hkFloorPill"
                className="absolute inset-0 rounded-lg border border-[var(--hos-primary)]/30 bg-[var(--hos-primary)]/15"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            ) : null}
            <span className={`relative z-10 ${floorFilter === f ? "text-[var(--hos-primary)]" : "text-[var(--hos-ink-2)]"}`}>
              Floor {f}
            </span>
          </button>
        ))}
      </div>

      {/* Tablet hallway strip — large 1-tap status cards (phone uses HousekeepingMobileView) */}
      <div className="hidden flex-col gap-2 md:flex lg:hidden">
        <p className="m-0 px-1 text-[9px] font-bold uppercase tracking-widest text-[var(--hos-ink-3)]">
          Hallway mode
        </p>
        {visible.map((r) => {
          const stay = stays.find((s) => s.roomId === r.id && s.status === "checked_in");
          return (
            <div
              key={`hall-${r.id}`}
              className={`hos-glass-card p-3 ${hkTone(r.hkStatus)}`}
              data-glow={r.hkStatus === "clean" || r.hkStatus === "inspected" ? "emerald" : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <strong className="font-mono text-2xl font-black tabular-nums tracking-tight">
                    {r.number}
                  </strong>
                  <div className="text-xs opacity-80">
                    {r.typeCode}
                    {stay ? ` · ${stay.guestName.split(" ")[0]}` : " · Vacant"}
                  </div>
                </div>
                <span className="rounded-full border border-black/10 px-2 py-1 text-[10px] font-bold uppercase">
                  {r.hkStatus}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(
                  [
                    { st: "clean" as const, label: "Mark Clean" },
                    { st: "dirty" as const, label: "Mark Dirty" },
                    { st: "inspected" as const, label: "Inspect" },
                  ] as const
                ).map(({ st, label }) => (
                  <button
                    key={st}
                    type="button"
                    className={`hos-btn-tactile min-h-12 rounded-xl px-2 text-[11px] font-bold ${
                      r.hkStatus === st
                        ? "bg-[var(--hos-primary)] text-white"
                        : "border border-[var(--hos-glass-border)] bg-[var(--hos-surface)] text-[var(--hos-ink)]"
                    }`}
                    onClick={() => {
                      start(() => {
                        const res = setHk(r.id, st);
                        if (!res.ok) toast.error(res.error);
                        else toast.success(`${r.number} → ${st}`);
                      });
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden grid-cols-1 gap-4 md:grid xl:grid-cols-[1fr_320px]">
        <GlassPanel className="p-3.5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {visible.map((r) => {
              const stay = stays.find((s) => s.roomId === r.id && s.status === "checked_in");
              const maidId = assignments[r.id];
              const maid = maids.find((m) => m.id === maidId);
              return (
                <motion.div
                  key={r.id}
                  className={`rounded-2xl border p-3 ${hkTone(r.hkStatus)}`}
                >
                  <div className="flex items-start justify-between">
                    <strong className="text-lg tabular-nums">{r.number}</strong>
                    <span className="text-[9px] font-bold uppercase">{r.hkStatus}</span>
                  </div>
                  <div className="mt-1 text-[10px] opacity-80">{r.typeCode}</div>
                  {stay ? (
                    <button
                      type="button"
                      className="mt-1 block truncate text-[10px] font-semibold underline"
                      onClick={() => openStay(stay.id)}
                    >
                      {stay.guestName.split(" ")[0]}
                    </button>
                  ) : (
                    <div className="mt-1 text-[10px] opacity-70">Vacant</div>
                  )}
                  <select
                    value={maidId ?? ""}
                    onChange={(e) => {
                      if (e.target.value) assignMaid(r.id, e.target.value);
                    }}
                    className="mt-2 w-full rounded-md border border-black/10 bg-white/50 px-1 py-1 text-[10px] dark:bg-black/20"
                  >
                    <option value="">Maid…</option>
                    {maids.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name.split(" ")[0]}
                      </option>
                    ))}
                  </select>
                  {maid ? (
                    <div className="mt-1 text-[9px] font-medium">{maid.name}</div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {STATUS_ORDER.map((st) => (
                      <motion.button
                        key={st}
                        type="button"
                        whileTap={reduce ? undefined : { scale: 0.95 }}
                        onClick={() => {
                          start(() => {
                            const res = setHk(r.id, st);
                            if (!res.ok) toast.error(res.error);
                            else toast.success(`${r.number} → ${st}`);
                          });
                        }}
                        className={`hos-btn-tactile min-h-9 min-w-9 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase md:min-h-0 md:min-w-0 md:rounded md:px-1.5 md:py-0.5 md:text-[9px] ${
                          r.hkStatus === st ? "bg-black/20" : "bg-black/5 dark:bg-white/10"
                        }`}
                      >
                        {st.slice(0, 3)}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </GlassPanel>

        <div className="flex flex-col gap-4">
          <GlassPanel className="p-3.5">
            <strong className="text-sm text-[var(--hos-ink)]">FD ↔ HK discrepancies</strong>
            {discrepancies.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--hos-emerald)]">All clear — no mismatches.</p>
            ) : (
              <ul className="mt-2 m-0 list-none space-y-2 p-0">
                {discrepancies.map((d) => (
                  <li key={d.room + d.issue} className="hos-cell rounded-lg p-2 text-xs">
                    <strong className="text-[var(--hos-ruby)]">Rm {d.room}</strong>
                    <div className="text-[var(--hos-ink-2)]">{d.issue}</div>
                    {d.stayId ? (
                      <Button size="sm" variant="ghost" className="mt-1" onClick={() => openStay(d.stayId!)}>
                        Open StayHub
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>

          <GlassPanel className="p-3.5">
            <strong className="text-sm text-[var(--hos-ink)]">Maintenance / OOO</strong>
            <div className="mt-2 grid gap-2">
              <select
                value={woRoomId}
                onChange={(e) => setWoRoomId(e.target.value)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.number} · {r.hkStatus}
                  </option>
                ))}
              </select>
              <select
                value={woCat}
                onChange={(e) => setWoCat(e.target.value as typeof woCat)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
              >
                <option value="ac">AC</option>
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="furniture">Furniture</option>
              </select>
              <input
                value={woTitle}
                onChange={(e) => setWoTitle(e.target.value)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
              />
              <Button
                size="sm"
                onClick={() => {
                  const res = createWorkOrder({
                    roomId: woRoomId,
                    category: woCat,
                    title: woTitle,
                    costNu: 2500,
                    markOoo: true,
                  });
                  if (!res.ok) toast.error(res.error);
                  else toast.success("Work order opened · room OOO");
                }}
              >
                Open WO + mark OOO
              </Button>
            </div>
            <ul className="mt-3 m-0 max-h-48 list-none space-y-2 overflow-auto p-0">
              {workOrders.map((w) => (
                <li key={w.id} className="hos-cell rounded-lg p-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <strong>
                      {w.roomNumber} · {w.category}
                    </strong>
                    <Badge tone={w.status === "done" ? "success" : "vip"}>{w.status}</Badge>
                  </div>
                  <div className="text-[var(--hos-ink-3)]">{w.title}</div>
                  <div className="tabular-nums">Nu. {w.costNu.toLocaleString()}</div>
                  {w.status !== "done" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-1"
                      onClick={() => {
                        completeWorkOrder(w.id);
                        toast.success("WO done · room returned dirty for HK");
                      }}
                    >
                      Complete
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </GlassPanel>
        </div>
      </div>
    </div>
    </ModuleFrame>
  );
}
