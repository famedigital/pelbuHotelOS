import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  EmptyState,
  springButter,
  springPress,
  springSoft,
} from "@hos-v2/ui";
import { toast } from "sonner";
import { CalendarDays, ChevronRight, Search, Wand2, Zap } from "lucide-react";
import {
  addDays,
  computeMonthStayviewStats,
  firstOfMonth,
  formatNu,
  folioBalance,
  listTourGroups,
  parseYearMonth,
  stayOnDate,
  unassignedNearTerm,
  useFrontOfficeStore,
  ymd,
  type HkStatus,
  type MealPlan,
  type Room,
  type Stay,
} from "../../lib/front-office-store";
import { MobileRackCalendar } from "./MobileRackCalendar";
import {
  SmartAssignSheet,
  type SmartAssignMode,
} from "../SmartAssignSheet";
import { deskCan } from "../../lib/desk-auth";

type FilterId = "all" | "occupied" | "vacant" | "dirty" | "due" | "need";
type ViewMode = "rooms" | "rack";

function stayMatchesQuery(stay: Stay, q: string): boolean {
  if (!q) return true;
  const hay = [
    stay.guestName,
    stay.confirmationNo,
    stay.roomNumber,
    stay.groupName,
    stay.agencyName,
    stay.guestPhone,
    stay.typeCode,
    stay.mealPlan,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

const MEALS: MealPlan[] = ["EP", "CP", "MAP", "AP"];

function dayLabel(ymdStr: string, today: string): string {
  if (ymdStr === today) return "Td";
  if (ymdStr === addDays(today, 1)) return "Tm";
  return new Date(`${ymdStr}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
  });
}

function roomAccent(stay: Stay | undefined, hk: HkStatus, groupColor?: string): string {
  if (stay?.groupId && groupColor) return groupColor;
  if (stay?.status === "checked_in") return "var(--hos-emerald)";
  if (stay && ["confirmed", "held"].includes(stay.status)) return "var(--hos-primary)";
  if (hk === "dirty") return "var(--hos-brass)";
  if (hk === "ooo") return "var(--hos-ruby)";
  return "var(--hos-line)";
}

/** Phone StayView — dense list + group strip; light & midnight token-safe. */
export function StayViewMobileView() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const rooms = useFrontOfficeStore((s) => s.rooms);
  const stays = useFrontOfficeStore((s) => s.stays);
  const groupMeta = useFrontOfficeStore((s) => s.groupMeta);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const openFastBook = useFrontOfficeStore((s) => s.openFastBook);
  const smartAutoAssign = useFrontOfficeStore((s) => s.smartAutoAssign);
  const applyGroupMealPlan = useFrontOfficeStore((s) => s.applyGroupMealPlan);
  const apiOffline = useFrontOfficeStore((s) => s.apiOffline);
  const canWriteStayview = deskCan("stayview", "write");

  const today = businessDate || ymd(new Date());
  const guardWrite = (fn: () => void) => {
    if (!canWriteStayview) {
      toast.error("No StayView write permission");
      return;
    }
    fn();
  };
  const [selected, setSelected] = useState(today);
  const [rackAnchor, setRackAnchor] = useState(today);
  const [viewMode, setViewMode] = useState<ViewMode>("rooms");
  const [floor, setFloor] = useState<number | "all">("all");
  const [filter, setFilter] = useState<FilterId>("all");
  const [groupFilter, setGroupFilter] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const [assignMode, setAssignMode] = useState<SmartAssignMode | null>(null);

  const groups = useMemo(
    () => listTourGroups(stays, groupMeta).filter((g) => g.members.length > 0),
    [stays, groupMeta],
  );
  const unassigned = useMemo(
    () => unassignedNearTerm(stays, today, 2),
    [stays, today],
  );
  const dates = useMemo(
    () => Array.from({ length: 10 }, (_, i) => addDays(today, i)),
    [today],
  );
  const floors = useMemo(
    () => [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b),
    [rooms],
  );

  const monthStats = useMemo(() => {
    const { year, month } = parseYearMonth(selected);
    return computeMonthStayviewStats(rooms, stays, year, month);
  }, [rooms, stays, selected]);

  const dayStats = useMemo(() => {
    const occupied = rooms.filter((r) =>
      stays.some((s) => s.roomId === r.id && stayOnDate(s, selected)),
    ).length;
    const vacant = rooms.filter(
      (r) =>
        r.hkStatus !== "ooo" &&
        !stays.some((s) => s.roomId === r.id && stayOnDate(s, selected)),
    ).length;
    const dirty = rooms.filter((r) => r.hkStatus === "dirty").length;
    const arrivals = stays.filter(
      (s) => s.checkIn === selected && ["confirmed", "held"].includes(s.status),
    ).length;
    const occPct = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0;
    return { occupied, vacant, dirty, arrivals, occPct };
  }, [rooms, stays, selected]);

  const qNorm = query.trim().toLowerCase();
  const dueCount = useMemo(
    () =>
      stays.filter((s) => s.status === "checked_in" && folioBalance(s) > 0.5)
        .length,
    [stays],
  );

  const roomCards = useMemo(() => {
    const rows = [...rooms]
      .sort((a, b) => a.floor - b.floor || a.number.localeCompare(b.number))
      .map((room) => {
        const stay = stays.find(
          (s) => s.roomId === room.id && stayOnDate(s, selected),
        );
        return { room, stay };
      });

    return rows.filter(({ room, stay }) => {
      if (floor !== "all" && room.floor !== floor) return false;
      if (groupFilter !== "all" && stay?.groupId !== groupFilter) return false;
      if (qNorm) {
        const roomHit =
          room.number.includes(qNorm) ||
          room.typeCode.toLowerCase().includes(qNorm) ||
          room.typeName.toLowerCase().includes(qNorm);
        const stayHit = stay ? stayMatchesQuery(stay, qNorm) : false;
        if (!roomHit && !stayHit) return false;
      }
      if (filter === "occupied") return Boolean(stay);
      if (filter === "vacant") return !stay && room.hkStatus !== "ooo";
      if (filter === "dirty") return room.hkStatus === "dirty";
      if (filter === "due")
        return Boolean(stay && stay.status === "checked_in" && folioBalance(stay) > 0.5);
      if (filter === "need") return false;
      return true;
    });
  }, [rooms, stays, selected, floor, filter, groupFilter, qNorm]);

  const grouped = useMemo(() => {
    const map = new Map<number, { room: Room; stay: Stay | undefined }[]>();
    for (const row of roomCards) {
      const list = map.get(row.room.floor) ?? [];
      list.push(row);
      map.set(row.room.floor, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [roomCards]);

  const selectedGroup = groups.find((g) => g.id === groupFilter);

  return (
    <div
      className={[
        "hos-mobile-page",
        viewMode === "rack"
          ? "h-[calc(100dvh-var(--mobile-dock-height)-env(safe-area-inset-bottom,0px)-0.5rem)] overflow-hidden"
          : "",
      ].join(" ")}
    >
      <motion.div
        className="hos-mobile-hero"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSoft}
      >
        <div className="min-w-0">
          <h1 className="hos-mobile-hero-title">StayView</h1>
          <p className="hos-mobile-hero-meta">
            Occ {dayStats.occPct}% · {dayStats.occupied} in · {dayStats.vacant} vac ·{" "}
            {dayStats.arrivals} arr
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            className={[
              "hos-btn-tactile !h-8 !min-h-8 !rounded-full !px-2.5 text-[12px]",
              viewMode === "rack" ? "hos-btn-primary" : "",
            ].join(" ")}
            onClick={() => setViewMode((m) => (m === "rack" ? "rooms" : "rack"))}
            aria-pressed={viewMode === "rack"}
          >
            <CalendarDays className="size-3.5" strokeWidth={2} />
            {viewMode === "rack" ? "List" : "Cal"}
          </Button>
          {unassigned.length > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              className="!h-8 !min-h-8 !rounded-full !px-2.5 text-[12px]"
              onClick={() =>
                guardWrite(() => setAssignMode({ kind: "queue" }))
              }
            >
              <Wand2 className="size-3.5" strokeWidth={2} />
              {unassigned.length}
            </Button>
          ) : null}
          <Button
            size="sm"
            className="hos-btn-ink !h-8 !min-h-8 !rounded-full !px-2.5 text-[12px]"
            onClick={() =>
              guardWrite(() =>
                openFastBook({
                  checkIn: selected,
                  checkOut: addDays(selected, 1),
                }),
              )
            }
          >
            <Zap className="size-3.5" strokeWidth={2} />
            Book
          </Button>
        </div>
      </motion.div>

      {apiOffline ? (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--hos-ruby)_40%,transparent)] bg-[color-mix(in_srgb,var(--hos-ruby)_10%,transparent)] px-3 py-2 text-[11px] text-[var(--hos-ruby)]">
          API offline — book / assign blocked until hydrate succeeds
        </div>
      ) : null}

      <label className="hos-search-field relative shrink-0">
        <Search className="hos-search-icon size-3.5" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Guest, room, PS-, group…"
          className="hos-search-input !h-9 !min-h-9 w-full !rounded-full !text-[13px]"
          aria-label="Search rooms and guests"
        />
      </label>

      <div className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-1.5 text-[11px]">
        <label className="inline-flex items-center gap-1.5 font-semibold text-[var(--hos-ink)]">
          <CalendarDays className="size-3.5 text-[var(--hos-primary)]" />
          <input
            type="month"
            className="hos-input !min-h-7 !w-auto !rounded-lg !px-1.5 !py-0.5 !text-[11px]"
            aria-label="Jump to month"
            value={`${parseYearMonth(selected).year}-${String(parseYearMonth(selected).month).padStart(2, "0")}`}
            onChange={(e) => {
              const v = e.target.value;
              if (!/^\d{4}-\d{2}$/.test(v)) return;
              const [y, m] = v.split("-").map(Number);
              if (!y || !m) return;
              const start = firstOfMonth(y, m);
              setSelected(start);
              setRackAnchor(start);
            }}
          />
        </label>
        <span className="font-mono tabular-nums text-[var(--hos-ink-2)]">
          Rooms <strong className="text-[var(--hos-ink)]">{monthStats.totalRooms}</strong>
        </span>
        <span className="font-mono tabular-nums text-[var(--hos-ink-2)]">
          Occ{" "}
          <strong
            className={
              monthStats.occPct >= 90
                ? "text-[var(--hos-ruby)]"
                : "text-[var(--hos-emerald)]"
            }
          >
            {monthStats.occPct}%
          </strong>
        </span>
        <span className="font-mono tabular-nums text-[var(--hos-ink-2)]">
          Rev{" "}
          <strong className="text-[var(--hos-primary)]">
            {formatNu(monthStats.projectedRevenue)}
          </strong>
        </span>
      </div>

      {viewMode === "rack" ? (
        <MobileRackCalendar
          today={today}
          anchor={rackAnchor}
          days={10}
          rooms={
            floor === "all" ? rooms : rooms.filter((r) => r.floor === floor)
          }
          stays={stays}
          onShiftAnchor={(delta) => {
            if (delta === 0) {
              setRackAnchor(today);
              return;
            }
            setRackAnchor((a) => addDays(a, delta));
          }}
          onSelectStay={openStay}
          onBookCell={(room, date) =>
            guardWrite(() =>
              openFastBook({
                checkIn: date,
                checkOut: addDays(date, 1),
                typeCode: room.typeCode,
                roomId: room.id,
              }),
            )
          }
        />
      ) : (
        <>
          {groups.length > 0 ? (
            <div className="hos-mobile-segment-rail -mx-0.5 px-0.5">
              <button
                type="button"
                data-active={groupFilter === "all" ? "true" : undefined}
                className="hos-mobile-segment"
                onClick={() => setGroupFilter("all")}
              >
                All groups
              </button>
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  data-active={groupFilter === g.id ? "true" : undefined}
                  className="hos-mobile-segment gap-1.5"
                  onClick={() => setGroupFilter(g.id)}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: g.color }}
                  />
                  <span className="max-w-[7rem] truncate">{g.name.split(" ")[0]}</span>
                  <span className="hos-mobile-segment-count">{g.members.length}</span>
                </button>
              ))}
            </div>
          ) : null}

          {selectedGroup ? (
            <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-[var(--hos-line)] bg-[var(--hos-cell)] px-1.5 py-1">
              {MEALS.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={!canWriteStayview}
                  onClick={() => {
                    guardWrite(() => {
                      void applyGroupMealPlan(selectedGroup.id, m).then((res) => {
                        if (!res.ok) toast.error(res.error);
                        else toast.success(`${m} · ${res.updated} rooms`);
                      });
                    });
                  }}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    selectedGroup.mealPlan === m
                      ? "bg-[var(--hos-primary)] text-white"
                      : "text-[var(--hos-ink-2)]"
                  }`}
                >
                  {m}
                </button>
              ))}
              <button
                type="button"
                className="ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium text-[var(--hos-primary)]"
                onClick={() => navigate(`/groups?id=${selectedGroup.id}`)}
              >
                Groups
              </button>
            </div>
          ) : null}

          {unassigned.length > 0 ? (
            <div className="flex items-center gap-2 overflow-x-auto">
              <Button
                size="sm"
                className="hos-btn-ink !h-7 shrink-0 !rounded-full !px-2.5 text-[11px]"
                onClick={() => {
                  guardWrite(() => {
                    void smartAutoAssign(unassigned.map((s) => s.id)).then((res) => {
                      if (res.assigned === 0 && res.conflicts.length) {
                        toast.error(res.conflicts.slice(0, 2).join(" · "));
                        return;
                      }
                      toast.success(`Assigned ${res.assigned}`);
                    });
                  });
                }}
              >
                ⚡ Assign {unassigned.length}
              </Button>
              {unassigned.slice(0, 6).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setAssignMode({ kind: "stay", stayId: s.id })}
                  className="shrink-0 rounded-full border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-1 text-left text-[11px]"
                >
                  <span className="font-medium text-[var(--hos-ink)]">{s.guestName.split(" ")[0]}</span>
                  <span className="ml-1 font-mono text-[var(--hos-ink-3)]">{s.typeCode}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="hos-mobile-segment-rail -mx-0.5 px-0.5">
            {dates.map((d) => {
              const active = d === selected;
              return (
                <motion.button
                  key={d}
                  type="button"
                  onClick={() => setSelected(d)}
                  whileTap={reduce ? undefined : { scale: 0.95, transition: springPress }}
                  className={[
                    "relative flex h-10 min-w-[40px] shrink-0 flex-col items-center justify-center rounded-full px-2",
                    active
                      ? "bg-[var(--hos-primary)] text-white shadow-[var(--hos-primary-glow)]"
                      : "bg-[var(--hos-cell)] text-[var(--hos-ink)] shadow-[var(--hos-card-shadow)]",
                  ].join(" ")}
                >
                  {active && !reduce ? (
                    <motion.span
                      layoutId="stayDateGlow"
                      className="pointer-events-none absolute inset-0 rounded-full"
                      transition={springButter}
                    />
                  ) : null}
                  <span className="relative z-10 text-[9px] font-medium uppercase opacity-80">
                    {dayLabel(d, today)}
                  </span>
                  <span className="relative z-10 font-mono text-[13px] font-medium tabular-nums leading-none">
                    {d.slice(8, 10)}
                  </span>
                </motion.button>
              );
            })}
          </div>

          <div className="hos-mobile-segment-rail">
            <button
              type="button"
              data-active={floor === "all" ? "true" : undefined}
              className="hos-mobile-segment"
              onClick={() => setFloor("all")}
            >
              Floors
            </button>
            {floors.map((f) => (
              <button
                key={f}
                type="button"
                data-active={floor === f ? "true" : undefined}
                className="hos-mobile-segment"
                onClick={() => setFloor(f)}
              >
                F{f}
              </button>
            ))}
            <span className="mx-0.5 h-4 w-px shrink-0 bg-[var(--hos-line)]" aria-hidden />
            {(
              [
                { id: "all" as const, label: "All", count: 0 },
                { id: "occupied" as const, label: "In", count: dayStats.occupied },
                { id: "vacant" as const, label: "Vac", count: dayStats.vacant },
                { id: "dirty" as const, label: "Dirty", count: dayStats.dirty },
                { id: "due" as const, label: "Due", count: dueCount },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                data-active={filter === f.id ? "true" : undefined}
                className="hos-mobile-segment"
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                {f.count > 0 ? (
                  <span className="hos-mobile-segment-count">{f.count}</span>
                ) : null}
              </button>
            ))}
            {unassigned.length > 0 ? (
              <button
                type="button"
                data-active={filter === "need" ? "true" : undefined}
                className="hos-mobile-segment"
                onClick={() => {
                  setFilter("need");
                  setAssignMode({ kind: "queue" });
                }}
              >
                Need
                <span className="hos-mobile-segment-count">{unassigned.length}</span>
              </button>
            ) : null}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${selected}-${floor}-${filter}-${groupFilter}-${qNorm}`}
              className="hos-scrollbar-slim flex flex-col gap-1 pb-2"
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0 }}
            >
              {roomCards.length === 0 ? (
                <EmptyState
                  title="No rooms match"
                  description="Clear search or filters."
                  action={
                    <Button
                      size="sm"
                      className="hos-btn-ink !rounded-full"
                      onClick={() => {
                        setFilter("all");
                        setQuery("");
                        setFloor("all");
                        setGroupFilter("all");
                      }}
                    >
                      Clear
                    </Button>
                  }
                />
              ) : (
                grouped.map(([fl, rows]) => (
                  <section key={fl} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between px-0.5 py-0.5">
                      <h2 className="m-0 text-[11px] font-medium text-[var(--hos-ink-3)]">
                        Floor {fl}
                      </h2>
                      <span className="font-mono text-[10px] text-[var(--hos-ink-3)]">
                        {rows.filter((r) => r.stay).length}/{rows.length}
                      </span>
                    </div>
                    {rows.map(({ room, stay }) => {
                      const bal = stay ? folioBalance(stay) : 0;
                      const gColor = stay?.groupId
                        ? groupMeta[stay.groupId]?.color
                        : undefined;
                      return (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => {
                            if (stay) openStay(stay.id);
                            else if (room.hkStatus === "ooo") return;
                            else if (unassigned.length > 0)
                              setAssignMode({
                                kind: "room",
                                roomId: room.id,
                                date: selected,
                              });
                            else
                              guardWrite(() =>
                                openFastBook({
                                  checkIn: selected,
                                  checkOut: addDays(selected, 1),
                                  typeCode: room.typeCode,
                                  roomId: room.id,
                                }),
                              );
                          }}
                          className="flex h-12 items-center gap-2 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 text-left active:bg-[color-mix(in_srgb,var(--hos-primary)_8%,var(--hos-cell))]"
                          style={{
                            borderLeftWidth: 3,
                            borderLeftColor: roomAccent(stay, room.hkStatus, gColor),
                          }}
                        >
                          <span
                            className={[
                              "flex size-9 shrink-0 flex-col items-center justify-center rounded-lg font-mono",
                              stay
                                ? "bg-[var(--hos-primary)] text-white"
                                : "bg-[color-mix(in_srgb,var(--hos-ink)_6%,transparent)] text-[var(--hos-ink)]",
                            ].join(" ")}
                          >
                            <span className="text-[12px] font-semibold leading-none">
                              {room.number}
                            </span>
                            <span className="mt-0.5 text-[7px] uppercase opacity-80">
                              {room.typeCode}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            {stay ? (
                              <>
                                <span className="flex items-center gap-1">
                                  <strong className="truncate text-[13px] font-medium text-[var(--hos-ink)]">
                                    {stay.guestName}
                                  </strong>
                                  {stay.vip ? (
                                    <span className="text-[10px] text-[var(--hos-brass)]">VIP</span>
                                  ) : null}
                                  {stay.groupId ? (
                                    <span
                                      className="size-1.5 shrink-0 rounded-full"
                                      style={{
                                        background:
                                          groupMeta[stay.groupId]?.color ??
                                          "var(--hos-primary)",
                                      }}
                                    />
                                  ) : null}
                                </span>
                                <span className="block font-mono text-[10px] text-[var(--hos-ink-3)]">
                                  {stay.mealPlan} · {stay.status.replace("_", " ")}
                                </span>
                              </>
                            ) : (
                              <>
                                <strong className="text-[13px] font-medium text-[var(--hos-ink)]">
                                  Vacant
                                </strong>
                                <span className="block text-[10px] capitalize text-[var(--hos-ink-3)]">
                                  HK {room.hkStatus}
                                </span>
                              </>
                            )}
                          </span>
                          {stay ? (
                            <span
                              className={[
                                "shrink-0 font-mono text-[11px] font-medium tabular-nums",
                                bal > 0.5
                                  ? "text-[var(--hos-ruby)]"
                                  : "text-[var(--hos-emerald)]",
                              ].join(" ")}
                            >
                              {formatNu(bal)}
                            </span>
                          ) : null}
                          <ChevronRight
                            className="size-3.5 shrink-0 text-[var(--hos-ink-3)]"
                            strokeWidth={2}
                          />
                        </button>
                      );
                    })}
                  </section>
                ))
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}

      <SmartAssignSheet
        open={Boolean(assignMode)}
        mode={assignMode}
        queue={unassigned}
        onClose={() => setAssignMode(null)}
      />
    </div>
  );
}
