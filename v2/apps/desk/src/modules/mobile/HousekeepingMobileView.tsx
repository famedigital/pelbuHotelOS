import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  EmptyState,
  butterCard,
  springButter,
  springPress,
  springSoft,
  staggerButter,
} from "@hos-v2/ui";
import {
  stayOnDate,
  useFrontOfficeStore,
  ymd,
  type HkStatus,
} from "../../lib/front-office-store";

function tone(st: HkStatus): string {
  if (st === "clean" || st === "inspected")
    return "border-[rgba(16,185,129,0.4)] bg-[rgba(16,185,129,0.12)]";
  if (st === "dirty")
    return "border-[rgba(245,158,11,0.45)] bg-[rgba(245,158,11,0.12)]";
  if (st === "occupied")
    return "border-[rgba(59,130,246,0.4)] bg-[rgba(59,130,246,0.12)]";
  return "border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.12)]";
}

/** Phone HK — hallway mode: 2-col tiles + Mark Clean / Dirty / Inspect. */
export function HousekeepingMobileView() {
  const reduce = useReducedMotion();
  const rooms = useFrontOfficeStore((s) => s.rooms);
  const stays = useFrontOfficeStore((s) => s.stays);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const setRoomHkStatus = useFrontOfficeStore((s) => s.setRoomHkStatus);
  const today = businessDate || ymd(new Date());

  const floors = useMemo(() => {
    return [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
  }, [rooms]);

  const [floor, setFloor] = useState(floors[0] ?? 1);

  const floorRooms = useMemo(
    () =>
      rooms
        .filter((r) => r.floor === floor)
        .sort((a, b) => a.number.localeCompare(b.number)),
    [rooms, floor],
  );

  const turnoverIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of rooms) {
      const departed = stays.some(
        (s) =>
          s.roomId === r.id &&
          s.checkOut === today &&
          s.status === "checked_out",
      );
      const arriving = stays.some(
        (s) =>
          s.roomId === r.id &&
          s.checkIn === today &&
          ["confirmed", "held"].includes(s.status),
      );
      const vacantDirty =
        r.hkStatus === "dirty" &&
        !stays.some((s) => s.roomId === r.id && stayOnDate(s, today));
      if ((departed && arriving) || (vacantDirty && arriving)) set.add(r.id);
    }
    return set;
  }, [rooms, stays, today]);

  const setStatus = (roomId: string, number: string, st: HkStatus) => {
    const res = setRoomHkStatus(roomId, st);
    if (!res.ok) toast.error(res.error);
    else toast.success(`Rm ${number} → ${st}`);
  };

  return (
    <div className="hos-mobile-page">
      <motion.div
        className="hos-mobile-hero"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSoft}
      >
        <div>
          <h1 className="hos-mobile-hero-title">Hallway</h1>
          <p className="hos-mobile-hero-meta">
            1-tap status · turnover rooms ringed
          </p>
        </div>
      </motion.div>

      <div className="hos-mobile-segment-rail -mx-1 px-1">
        {floors.map((f) => (
          <motion.button
            key={f}
            type="button"
            data-active={floor === f ? "true" : undefined}
            onClick={() => setFloor(f)}
            whileTap={reduce ? undefined : { scale: 0.94, transition: springPress }}
            className="hos-mobile-segment"
          >
            Floor {f}
          </motion.button>
        ))}
      </div>

      {floorRooms.length === 0 ? (
        <EmptyState title="No rooms on this floor" />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={floor}
            className="hos-scrollbar-slim grid grid-cols-2 gap-2.5 overflow-y-auto pb-2"
            variants={reduce ? undefined : staggerButter}
            initial={reduce ? false : "hidden"}
            animate="show"
            exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
          >
            {floorRooms.map((r) => {
              const priority = turnoverIds.has(r.id);
              return (
                <motion.div
                  key={r.id}
                  layout
                  variants={reduce ? undefined : butterCard}
                  whileTap={
                    reduce ? undefined : { scale: 0.97, transition: springPress }
                  }
                  className={[
                    "hos-luxury-card hos-butter-card relative flex min-h-[168px] flex-col gap-2 border p-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
                    tone(r.hkStatus),
                    priority ? "ring-2 ring-[var(--hos-ruby)]" : "",
                  ].join(" ")}
                >
                  {priority ? (
                    <motion.div
                      className="absolute right-2 top-2"
                      animate={
                        reduce
                          ? undefined
                          : { scale: [1, 1.06, 1], opacity: [1, 0.85, 1] }
                      }
                      transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <Badge tone="danger">Turnover</Badge>
                    </motion.div>
                  ) : null}
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="font-mono text-[1.5rem] font-black tabular-nums text-[var(--hos-ink)]">
                      {r.number}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
                      {r.hkStatus}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-[var(--hos-ink-3)]">
                    {r.typeCode}
                  </span>
                  <div className="mt-auto grid grid-cols-1 gap-1.5">
                    {(
                      [
                        { st: "clean" as const, label: "Clean" },
                        { st: "dirty" as const, label: "Dirty" },
                        { st: "inspected" as const, label: "Inspect" },
                      ] as const
                    ).map(({ st, label }) => (
                      <motion.button
                        key={st}
                        type="button"
                        whileTap={
                          reduce
                            ? undefined
                            : { scale: 0.96, transition: springPress }
                        }
                        className={`hos-btn-spring min-h-12 rounded-xl px-2 text-[13px] font-bold ${
                          r.hkStatus === st
                            ? "bg-[var(--hos-primary)] text-white"
                            : "border border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink)]"
                        }`}
                        onClick={() => setStatus(r.id, r.number, st)}
                      >
                        {label}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
