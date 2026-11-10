import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { Badge, GlassPanel, SpotlightCard,
  ModuleFrame,
} from "@hos-v2/ui";
import {
  useFrontOfficeStore,
  type HkStatus,
  type Room,
  type Stay,
} from "../lib/front-office-store";
import { useOpsStore } from "../lib/ops-store";

function floorLabel(n: number): string {
  if (n === 0) return "Ground Floor";
  if (n === 1) return "1st Floor";
  if (n === 2) return "2nd Floor";
  if (n === 3) return "3rd Floor";
  return `Floor ${n}`;
}

type Amenity = {
  id: string;
  label: string;
  zone: string;
};

const GROUND_AMENITIES: Amenity[] = [
  { id: "lobby", label: "Lobby", zone: "front" },
  { id: "restaurant", label: "Restaurant", zone: "dining" },
  { id: "bar", label: "Bar", zone: "dining" },
  { id: "spa", label: "Spa", zone: "wellness" },
  { id: "lift", label: "Lift", zone: "core" },
  { id: "stairs", label: "Stairs", zone: "core" },
];

type StaySignal = "vacant" | "arriving" | "in_house" | "departing";

function stayForRoom(
  room: Room,
  stays: Stay[],
  businessDate: string,
): Stay | undefined {
  return stays.find(
    (s) =>
      s.roomId === room.id &&
      !["cancelled", "no_show", "checked_out"].includes(s.status) &&
      s.checkIn <= businessDate &&
      businessDate < s.checkOut,
  );
}

function signalFor(
  _room: Room,
  stay: Stay | undefined,
  businessDate: string,
): StaySignal {
  if (!stay) return "vacant";
  if (stay.status === "checked_in") {
    return stay.checkOut === businessDate ? "departing" : "in_house";
  }
  if (["confirmed", "held"].includes(stay.status)) {
    return stay.checkIn <= businessDate ? "arriving" : "vacant";
  }
  return "vacant";
}

function hkFill(hk: HkStatus): string {
  switch (hk) {
    case "clean":
      return "bg-[rgba(16,185,129,0.22)]";
    case "dirty":
      return "bg-[rgba(245,158,11,0.28)]";
    case "inspected":
      return "bg-[rgba(59,130,246,0.22)]";
    case "ooo":
      return "bg-[rgba(239,68,68,0.28)]";
    case "occupied":
      return "bg-[rgba(37,99,235,0.14)]";
    default:
      return "bg-[var(--hos-cell)]";
  }
}

function stayBorder(signal: StaySignal): string {
  switch (signal) {
    case "vacant":
      return "border-[rgba(15,23,42,0.12)] shadow-none";
    case "arriving":
      return "border-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,0.45),0_0_18px_-4px_rgba(34,211,238,0.55)] animate-pulse";
    case "in_house":
      return "border-[var(--hos-primary)] shadow-[0_0_0_1px_rgba(37,99,235,0.35),0_0_20px_-6px_rgba(37,99,235,0.55)]";
    case "departing":
      return "border-orange-400 shadow-[0_0_0_1px_rgba(251,146,60,0.45),0_0_18px_-4px_rgba(251,146,60,0.5)]";
    default:
      return "border-[var(--hos-line)]";
  }
}

function paxGuess(stay: Stay | undefined): number {
  if (!stay) return 0;
  if (stay.typeCode.includes("T")) return 2;
  if (stay.typeCode.startsWith("EXE") || stay.typeCode.startsWith("VAL")) return 2;
  return stay.vip ? 2 : 1;
}

export function FloorMapPage() {
  const reduce = useReducedMotion();
  const rooms = useFrontOfficeStore((s) => s.rooms);
  const stays = useFrontOfficeStore((s) => s.stays);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const workOrders = useOpsStore((s) => s.workOrders);

  const floors = useMemo(() => {
    const nums = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
    const withGround = nums[0] === 0 ? nums : [0, ...nums];
    return withGround.map((id) => ({ id, label: floorLabel(id) }));
  }, [rooms]);

  const [floor, setFloor] = useState<number>(() => floors.find((f) => f.id === 1)?.id ?? floors[0]?.id ?? 1);

  const floorRooms = useMemo(
    () => rooms.filter((r) => r.floor === floor).sort((a, b) => a.number.localeCompare(b.number)),
    [rooms, floor],
  );

  const openWo = (roomId: string) =>
    workOrders.some(
      (w) => w.roomId === roomId && (w.status === "open" || w.status === "in_progress"),
    );

  const openRoom = (room: Room) => {
    const stay =
      stayForRoom(room, stays, businessDate) ??
      stays.find(
        (s) =>
          s.roomId === room.id &&
          ["confirmed", "held", "checked_in"].includes(s.status),
      );
    if (stay) {
      openStay(stay.id);
      return;
    }
    const walk = stays.find(
      (s) =>
        !s.roomId &&
        ["confirmed", "held"].includes(s.status) &&
        s.checkIn === businessDate,
    );
    if (walk) openStay(walk.id);
  };

  return (
    <ModuleFrame
      title="Floor Map"
      description="Spatial room status"
    >
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="m-0 text-2xl font-bold text-[var(--hos-ink)]">3D Floor Map</h1>
          <p className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
            Dual-signal room tiles · HK fill + stay border · click opens StayHub
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-[rgba(16,185,129,0.5)]" /> Clean
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-[rgba(245,158,11,0.55)]" /> Dirty
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-[rgba(59,130,246,0.5)]" /> Inspected
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-[rgba(239,68,68,0.5)]" /> OOO
          </span>
        </div>
      </div>

      <div className="relative flex gap-1 overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-1">
        {floors.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFloor(f.id)}
            className="relative flex-1 whitespace-nowrap px-3 py-2 text-xs font-semibold text-[var(--hos-ink-2)]"
          >
            {floor === f.id ? (
              <motion.span
                layoutId="floorMapTab"
                className="absolute inset-0 rounded-lg border border-[var(--hos-primary)]/30 bg-[var(--hos-primary)]/15"
                transition={{ type: "spring", stiffness: 480, damping: 34 }}
              />
            ) : null}
            <span className={`relative z-10 ${floor === f.id ? "text-[var(--hos-primary)]" : ""}`}>
              {f.label}
            </span>
          </button>
        ))}
      </div>

      <GlassPanel className="overflow-hidden p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone="teal">West Wing</Badge>
          <Badge tone="default">Corridor</Badge>
          <Badge tone="vip">East Wing</Badge>
          <span className="text-[11px] text-[var(--hos-ink-3)]">
            Business date {businessDate}
          </span>
        </div>

        {floor === 0 ? (
          <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {GROUND_AMENITIES.map((a) => (
                <motion.div
                  key={a.id}
                  className="hos-cell flex min-h-[96px] flex-col justify-between rounded-2xl border border-[var(--hos-line)] p-3"
                >
                  <span className="text-[10px] uppercase tracking-wide text-[var(--hos-ink-3)]">
                    {a.zone}
                  </span>
                  <strong className="text-sm text-[var(--hos-ink)]">{a.label}</strong>
                </motion.div>
              ))}
            </div>
            <div className="hos-cell flex flex-col justify-center rounded-2xl p-4 text-sm text-[var(--hos-ink-2)]">
              <strong className="text-[var(--hos-ink)]">Public amenity deck</strong>
              <p className="m-0 mt-2 text-xs leading-relaxed text-[var(--hos-ink-3)]">
                Lobby check-in island feeds StayHub. Restaurant & Bar post to personal folio via
                POS. Spa packages and lift/stairs cores are mapped for guest wayfinding.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="rounded-xl border border-dashed border-[var(--hos-line)] bg-[rgba(15,23,42,0.03)] px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--hos-ink-3)] dark:bg-[rgba(255,255,255,0.03)]">
              Main corridor · Floor {floor}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {floorRooms.map((room) => {
                const stay = stayForRoom(room, stays, businessDate);
                const signal = signalFor(room, stay, businessDate);
                const pax = paxGuess(stay);
                const maint = openWo(room.id);
                return (
                  <SpotlightCard
                    key={room.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openRoom(room)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openRoom(room);
                      }
                    }}
                    className={`relative flex min-h-[110px] cursor-pointer flex-col items-start justify-between !rounded-2xl border-2 p-3 text-left transition-shadow ${hkFill(room.hkStatus)} ${stayBorder(signal)}`}
                  >
                    {maint ? (
                      <span
                        className="absolute left-2 top-2 rounded bg-[var(--hos-ruby)]/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--hos-ruby)]"
                        title="Open work order"
                      >
                        WO
                      </span>
                    ) : null}
                    {pax > 0 ? (
                      <span className="absolute right-2 top-2 rounded-full bg-[rgba(15,23,42,0.08)] px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-[var(--hos-ink)] dark:bg-[rgba(255,255,255,0.1)]">
                        {pax}p
                      </span>
                    ) : null}
                    <div>
                      <div className="text-lg font-bold tabular-nums text-[var(--hos-ink)]">
                        {room.number}
                      </div>
                      <div className="text-[10px] font-medium text-[var(--hos-ink-3)]">
                        {room.typeCode}
                      </div>
                    </div>
                    <div className="w-full">
                      <div className="truncate text-[11px] font-semibold text-[var(--hos-ink)]">
                        {stay?.guestName ?? "Vacant"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge
                          tone={
                            room.hkStatus === "clean" || room.hkStatus === "inspected"
                              ? "success"
                              : room.hkStatus === "ooo"
                                ? "danger"
                                : "vip"
                          }
                        >
                          {room.hkStatus}
                        </Badge>
                        {signal !== "vacant" ? (
                          <Badge tone={signal === "departing" ? "vip" : "default"}>
                            {signal.replace("_", " ")}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </SpotlightCard>
                );
              })}
            </div>
            {floorRooms.length === 0 ? (
              <p className="m-0 text-center text-sm text-[var(--hos-ink-3)]">
                No rooms mapped on this floor
              </p>
            ) : null}
          </div>
        )}
      </GlassPanel>
    </div>
    </ModuleFrame>
  );
}
