import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  MorphTabs,
  Odometer,
} from "@hos-v2/ui";
import { Crown, Users, Zap } from "lucide-react";
import {
  formatNu,
  folioBalance,
  nightsBetween,
  stayOnDate,
  useFrontOfficeStore,
  ymd,
  type Stay,
} from "../../lib/front-office-store";
import { useFiscalStore } from "../../lib/fiscal-store";

type Tab = "arrivals" | "inHouse" | "departures" | "tomorrow";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Tablet Desk (768–1024) — dual pane workstation:
 * left worklist + right radar, 48px touch targets, no desktop sidebar clutter.
 */
export function DeskTabletView() {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<Tab>("arrivals");
  const [query, setQuery] = useState("");
  const [vipOnly, setVipOnly] = useState(false);
  const stays = useFrontOfficeStore((s) => s.stays);
  const rooms = useFrontOfficeStore((s) => s.rooms);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const openFastBook = useFrontOfficeStore((s) => s.openFastBook);
  const checkIn = useFrontOfficeStore((s) => s.checkIn);
  const checkOut = useFrontOfficeStore((s) => s.checkOut);
  const tillBalance = useFiscalStore((s) => s.tillBalance);

  const today = businessDate || ymd(new Date());
  const tomorrow = useMemo(() => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return ymd(d);
  }, [today]);

  const arrivals = stays.filter(
    (s) => s.checkIn === today && ["confirmed", "held"].includes(s.status),
  );
  const inHouse = stays.filter((s) => s.status === "checked_in");
  const departures = stays.filter(
    (s) => s.checkOut === today && s.status === "checked_in",
  );
  const tomorrowArrivals = stays.filter(
    (s) => s.checkIn === tomorrow && ["confirmed", "held"].includes(s.status),
  );
  const occRooms = rooms.filter((r) =>
    stays.some((s) => s.roomId === r.id && stayOnDate(s, today)),
  ).length;
  const occPct = rooms.length ? Math.round((occRooms / rooms.length) * 100) : 0;
  const cleanReady = rooms.filter(
    (r) => r.hkStatus === "clean" || r.hkStatus === "inspected",
  ).length;
  const dirty = rooms.filter((r) => r.hkStatus === "dirty").length;
  const unassigned = arrivals.filter((s) => !s.roomId).length;
  const vips = inHouse.filter((s) => s.vip);
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; rooms: number }>();
    for (const s of inHouse) {
      if (!s.groupName) continue;
      const cur = map.get(s.groupName) ?? { name: s.groupName, rooms: 0 };
      cur.rooms += 1;
      map.set(s.groupName, cur);
    }
    return [...map.values()];
  }, [inHouse]);

  const base: Stay[] =
    tab === "arrivals"
      ? arrivals
      : tab === "inHouse"
        ? inHouse
        : tab === "departures"
          ? departures
          : tomorrowArrivals;

  const rows = base.filter((s) => {
    if (vipOnly && !s.vip) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      s.guestName.toLowerCase().includes(q) ||
      s.confirmationNo.toLowerCase().includes(q) ||
      (s.roomNumber ?? "").includes(q)
    );
  });

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "arrivals", label: "Arrivals", count: arrivals.length },
    { id: "inHouse", label: "In-house", count: inHouse.length },
    { id: "departures", label: "Departures", count: departures.length },
    { id: "tomorrow", label: "Tomorrow", count: tomorrowArrivals.length },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h1 className="m-0 text-base font-bold tracking-tight text-[var(--hos-ink)]">
          Desk
          <span className="ml-2 text-[12px] font-medium text-[var(--hos-ink-3)]">
            {new Date(`${today}T12:00:00`).toLocaleDateString("en-GB", {
              weekday: "short",
              day: "2-digit",
              month: "short",
            })}
          </span>
        </h1>
        <Button
          size="sm"
          className="hos-btn-ink hos-btn-spring !min-h-11 !rounded-xl !px-3.5"
          onClick={() => openFastBook()}
        >
          <Zap className="size-3.5" strokeWidth={2} />
          Fast Book
        </Button>
      </div>

      {/* Compact KPI strip — 4 tiles with butter stagger */}
      <motion.div
        className="grid shrink-0 grid-cols-4 gap-2"
        initial={reduce ? false : "hidden"}
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: { staggerChildren: 0.05, delayChildren: 0.04 },
          },
        }}
      >
        {[
          { label: "Occ", value: occPct, suffix: "%", meta: `${occRooms}/${rooms.length}` },
          { label: "Arrivals", value: arrivals.length, meta: unassigned ? `${unassigned} open` : "ready" },
          { label: "Out", value: departures.length, meta: `${dirty} dirty` },
          { label: "Clean", value: cleanReady, meta: "ready" },
        ].map((k) => (
          <motion.div
            key={k.label}
            className="hos-luxury-card hos-interactive hos-butter-card px-2.5 py-2"
            variants={{
              hidden: { opacity: 0, y: 10, scale: 0.97 },
              show: { opacity: 1, y: 0, scale: 1 },
            }}
            whileHover={reduce ? undefined : { y: -2 }}
            whileTap={reduce ? undefined : { scale: 0.98 }}
          >
            <div className="hos-section-label">{k.label}</div>
            <Odometer
              value={k.value}
              suffix={"suffix" in k ? (k as { suffix?: string }).suffix : undefined}
              className="font-mono text-lg font-black tabular-nums text-[var(--hos-ink)]"
            />
            <p className="m-0 text-[10px] text-[var(--hos-ink-3)]">{k.meta}</p>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid min-h-0 flex-1 grid-cols-[58%_42%] gap-2.5 overflow-hidden">
        {/* Worklist */}
        <div className="hos-luxury-card flex min-h-0 flex-col gap-2 overflow-hidden p-2.5">
          <MorphTabs
            glowId="deskTabletTab"
            value={tab}
            onChange={setTab}
            items={tabs.map((t) => ({ id: t.id, label: t.label, count: t.count }))}
          />
          <div className="flex shrink-0 gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="hos-input !min-h-11 flex-1 !rounded-xl !text-[15px]"
            />
            <button
              type="button"
              onClick={() => setVipOnly((v) => !v)}
              className={`hos-btn-tactile inline-flex min-h-11 items-center gap-1 rounded-xl border px-3 text-[12px] font-bold ${
                vipOnly
                  ? "border-[var(--hos-brass)] bg-[rgba(245,158,11,0.14)] text-[var(--hos-brass-ink)]"
                  : "border-[var(--hos-line)] text-[var(--hos-ink-2)]"
              }`}
            >
              <Crown className="size-3.5" /> VIP
            </button>
          </div>

          <div className="hos-scrollbar-slim flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {rows.length === 0 ? (
              <EmptyState
                title="Empty list"
                description="Try another segment."
                action={
                  <Button size="sm" onClick={() => openFastBook()}>
                    Fast Book
                  </Button>
                }
              />
            ) : (
              rows.map((s) => {
                const bal = folioBalance(s);
                return (
                  <motion.div
                    key={s.id}
                    data-status={s.status}
                    className="hos-boarding-pass shrink-0 p-3"
                    whileHover={reduce ? undefined : { y: -1 }}
                    whileTap={reduce ? undefined : { scale: 0.99 }}
                  >
                    <button
                      type="button"
                      className="flex w-full items-start gap-2.5 text-left"
                      onClick={() => openStay(s.id)}
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--hos-primary-grad)] text-[12px] font-bold text-white">
                        {initials(s.guestName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1">
                          <strong className="truncate text-[14px] text-[var(--hos-ink)]">
                            {s.guestName}
                          </strong>
                          {s.vip ? <Badge tone="vip">VIP</Badge> : null}
                          {!s.roomId ? (
                            <Badge tone="danger">No room</Badge>
                          ) : (
                            <span className="font-mono text-[11px] font-bold text-[var(--hos-primary)]">
                              Rm {s.roomNumber}
                            </span>
                          )}
                        </div>
                        <p className="m-0 mt-0.5 font-mono text-[11px] text-[var(--hos-ink-3)]">
                          {s.confirmationNo} · {nightsBetween(s.checkIn, s.checkOut)}N ·{" "}
                          {s.mealPlan}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-mono text-[12px] font-bold tabular-nums ${
                          bal > 0.5
                            ? "text-[var(--hos-ruby)]"
                            : "text-[var(--hos-emerald)]"
                        }`}
                      >
                        {formatNu(bal)}
                      </span>
                    </button>
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[var(--hos-line)] pt-2">
                      {["confirmed", "held"].includes(s.status) ? (
                        <Button
                          size="sm"
                          className="hos-btn-primary !min-h-11 !rounded-xl !text-white"
                          disabled={!s.roomId}
                          onClick={() => {
                            void (async () => {
                              const res = await checkIn(s.id);
                              if (!res.ok) toast.error(res.error);
                              else toast.success(`Checked in · Rm ${s.roomNumber}`);
                            })();
                          }}
                        >
                          Check in
                        </Button>
                      ) : null}
                      {s.status === "checked_in" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="!min-h-11 !rounded-xl"
                          onClick={() => {
                            void (async () => {
                              const res = await checkOut(s.id);
                              if (!res.ok) {
                                toast.error(res.error);
                                openStay(s.id);
                                return;
                              }
                              toast.success("Checked out");
                            })();
                          }}
                        >
                          Check out
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="!min-h-11 !rounded-xl border border-[var(--hos-line)]"
                        onClick={() => openStay(s.id)}
                      >
                        Open stay
                      </Button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Radar */}
        <div className="hos-scrollbar-slim flex min-h-0 flex-col gap-2 overflow-y-auto">
          <div className="hos-luxury-card p-3">
            <strong className="hos-section-label flex items-center gap-1">
              <Crown className="size-3.5 text-[var(--hos-brass)]" /> VIP
            </strong>
            {vips.length === 0 ? (
              <p className="m-0 mt-2 text-xs text-[var(--hos-ink-3)]">None in-house</p>
            ) : (
              <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
                {vips.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => openStay(v.id)}
                      className="hos-btn-tactile flex min-h-12 w-full items-center justify-between rounded-xl border border-[var(--hos-line)] px-2.5 text-left"
                    >
                      <span>
                        <span className="block text-[13px] font-semibold text-[var(--hos-ink)]">
                          {v.guestName}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--hos-ink-3)]">
                          Rm {v.roomNumber}
                        </span>
                      </span>
                      <Badge tone="vip">VIP</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="hos-luxury-card p-3">
            <strong className="hos-section-label flex items-center gap-1">
              <Users className="size-3.5 text-[var(--hos-teal)]" /> Groups
            </strong>
            {groups.length === 0 ? (
              <p className="m-0 mt-2 text-xs text-[var(--hos-ink-3)]">None in-house</p>
            ) : (
              <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
                {groups.map((g) => (
                  <li
                    key={g.name}
                    className="rounded-xl border border-[var(--hos-line)] px-2.5 py-2.5 text-[13px]"
                  >
                    <strong className="text-[var(--hos-ink)]">{g.name}</strong>
                    <p className="m-0 mt-0.5 font-mono text-[10px] text-[var(--hos-ink-3)]">
                      {g.rooms} rooms
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="hos-luxury-card p-3">
            <strong className="hos-section-label">Till</strong>
            <Odometer
              value={tillBalance}
              prefix="Nu. "
              className="mt-1 block font-mono text-xl font-black tabular-nums text-[var(--hos-emerald)]"
            />
            <Button
              size="sm"
              variant="secondary"
              className="mt-2 !min-h-11 w-full !rounded-xl"
              onClick={() => toast.message("Cash audit — use Purchases / Till")}
            >
              Cash audit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
