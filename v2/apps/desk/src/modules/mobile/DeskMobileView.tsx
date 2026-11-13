import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, Odometer } from "@hos-v2/ui";
import { CalendarDays, Crown, KeyRound, LayoutGrid, MoonStar, Table2, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  formatNu,
  folioBalance,
  nightsBetween,
  stayOnDate,
  useFrontOfficeStore,
  ymd,
  type Stay,
} from "../../lib/front-office-store";
import { nightAuditReadiness } from "../../lib/action-dispatcher";
import { staysForCalendarDay } from "./MobileMonthCalendar";
import { MobileCalendarSheet } from "./MobileCalendarSheet";

type Tab = "arrivals" | "inHouse" | "departures" | "tomorrow" | "day";
type ListMode = "table" | "cards";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Phone Desk — table (default) + boarding-pass cards for Arrivals / In-house / Checkout. */
export function DeskMobileView() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("arrivals");
  const [listMode, setListMode] = useState<ListMode>("cards");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [vipOnly, setVipOnly] = useState(false);
  const stays = useFrontOfficeStore((s) => s.stays);
  const rooms = useFrontOfficeStore((s) => s.rooms);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const openFastBook = useFrontOfficeStore((s) => s.openFastBook);
  const checkIn = useFrontOfficeStore((s) => s.checkIn);
  const checkOut = useFrontOfficeStore((s) => s.checkOut);
  const smartAutoAssign = useFrontOfficeStore((s) => s.smartAutoAssign);
  const auditReady = useMemo(
    () => nightAuditReadiness(),
    [stays, businessDate, rooms],
  );

  const today = businessDate || ymd(new Date());
  const [calSelected, setCalSelected] = useState(today);
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
  const dirty = rooms.filter((r) => r.hkStatus === "dirty").length;
  const unassigned = arrivals.filter((s) => !s.roomId).length;
  const roomRev = Math.round(inHouse.reduce((sum, s) => sum + s.nightlyNet, 0) * 1.21);

  const base: Stay[] =
    tab === "day"
      ? staysForCalendarDay(stays, calSelected)
      : tab === "arrivals"
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
      (s.roomNumber ?? "").includes(q) ||
      (s.groupName ?? "").toLowerCase().includes(q)
    );
  });

  const calDayPretty = new Date(`${calSelected}T12:00:00`).toLocaleDateString(
    "en-GB",
    { weekday: "short", day: "2-digit", month: "short" },
  );

  const kpis = [
    {
      label: "Occupancy",
      value: occPct,
      suffix: "%",
      meta: `${occRooms}/${rooms.length} rooms`,
      glow: "sapphire" as const,
    },
    {
      label: "Arrivals",
      value: arrivals.length,
      meta: unassigned ? `${unassigned} no room` : "All assigned",
      glow: "gold" as const,
    },
    {
      label: "Departures",
      value: departures.length,
      meta: `${dirty} dirty rooms`,
      glow: "emerald" as const,
    },
    {
      label: "Yield",
      value: roomRev,
      prefix: "Nu. ",
      meta: "incl. 10% SC",
      glow: "emerald" as const,
    },
  ];

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "arrivals", label: "Arrivals", count: arrivals.length },
    { id: "inHouse", label: "In-house", count: inHouse.length },
    { id: "departures", label: "Checkout", count: departures.length },
    { id: "tomorrow", label: "Tomorrow", count: tomorrowArrivals.length },
    ...(tab === "day" || calSelected !== today
      ? [
          {
            id: "day" as const,
            label: calDayPretty,
            count: staysForCalendarDay(stays, calSelected).length,
          },
        ]
      : []),
  ];

  return (
    <div className="hos-mobile-page">
      <div className="hos-mobile-hero">
        <div className="min-w-0">
          <h1 className="hos-mobile-hero-title">Mission Control</h1>
          <p className="hos-mobile-hero-meta">
            {new Date(`${today}T12:00:00`).toLocaleDateString("en-GB", {
              weekday: "short",
              day: "2-digit",
              month: "short",
            })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            className="hos-btn-tactile shrink-0 !min-h-9 !rounded-xl !px-2.5 text-[12px] font-bold"
            onClick={() => setCalendarOpen(true)}
            aria-label="Open calendar sheet"
          >
            <CalendarDays className="size-3.5" strokeWidth={2} />
            Cal
          </Button>
          <Button
            size="sm"
            className={[
              "hos-btn-tactile shrink-0 !min-h-9 !rounded-xl !px-2.5 text-[12px] font-bold",
              auditReady.blockers === 0
                ? "!text-[var(--hos-emerald)]"
                : "!text-[var(--hos-ruby)]",
            ].join(" ")}
            onClick={() => navigate("/night-audit")}
            aria-label="Night audit"
          >
            <MoonStar className="size-3.5" strokeWidth={2} />
            {auditReady.score}%
          </Button>
          <Button
            size="sm"
            className="hos-btn-ink hos-btn-spring shrink-0 !min-h-9 !rounded-xl !px-3 text-[12px]"
            onClick={() => openFastBook()}
          >
            <Zap className="size-3.5" strokeWidth={2} />
            Book
          </Button>
        </div>
      </div>

      <div className="hos-mobile-kpi-grid">
        {kpis.map((k) => (
          <div key={k.label} className="hos-mobile-kpi-cell" data-glow={k.glow}>
            <span className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
              {k.label}
            </span>
            <Odometer
              value={k.value}
              prefix={"prefix" in k ? k.prefix : undefined}
              suffix={"suffix" in k ? k.suffix : undefined}
              className="mt-0.5 font-mono text-[1.05rem] font-black tabular-nums tracking-tight text-[var(--hos-ink)]"
            />
            <p className="m-0 mt-0.5 truncate text-[10px] font-medium text-[var(--hos-ink-3)]">
              {k.meta}
            </p>
          </div>
        ))}
      </div>

      <div className="hos-mobile-toolbar">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Guest, room, voucher…"
          className="hos-input !min-h-9 flex-1 !rounded-xl !px-3 !text-[15px]"
          inputMode="search"
          enterKeyHint="search"
        />
        <button
          type="button"
          onClick={() => setVipOnly((v) => !v)}
          className={`hos-btn-tactile inline-flex min-h-9 min-w-9 items-center justify-center rounded-xl border px-2 text-[12px] font-bold ${
            vipOnly
              ? "border-[var(--hos-brass)] bg-[rgba(245,158,11,0.16)] text-[var(--hos-brass-ink)]"
              : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]"
          }`}
          aria-pressed={vipOnly}
          aria-label="VIP only"
        >
          <Crown className="size-3.5" strokeWidth={2} />
        </button>
        <div
          className="flex shrink-0 overflow-hidden rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]"
          role="group"
          aria-label="List layout"
        >
          <button
            type="button"
            onClick={() => setListMode("table")}
            className={`hos-btn-tactile inline-flex min-h-9 min-w-9 items-center justify-center px-2 ${
              listMode === "table"
                ? "bg-[var(--hos-primary)] text-white"
                : "text-[var(--hos-ink-2)]"
            }`}
            aria-pressed={listMode === "table"}
            aria-label="Table view"
            title="Table view"
          >
            <Table2 className="size-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => setListMode("cards")}
            className={`hos-btn-tactile inline-flex min-h-9 min-w-9 items-center justify-center px-2 ${
              listMode === "cards"
                ? "bg-[var(--hos-primary)] text-white"
                : "text-[var(--hos-ink-2)]"
            }`}
            aria-pressed={listMode === "cards"}
            aria-label="Card view"
            title="Card view"
          >
            <LayoutGrid className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="hos-mobile-segment-rail -mx-1 px-1">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <motion.button
              key={t.id}
              type="button"
              data-active={active ? "true" : undefined}
              onClick={() => setTab(t.id)}
              whileTap={reduce ? undefined : { scale: 0.96 }}
              className="hos-mobile-segment"
            >
              {t.label}
              <span className="hos-mobile-segment-count">{t.count}</span>
            </motion.button>
          );
        })}
      </div>

      {tab === "arrivals" && unassigned > 0 ? (
        <Button
          size="sm"
          className="hos-btn-ink hos-btn-spring shrink-0 !min-h-9 !rounded-xl text-[12px]"
          onClick={() => {
            void smartAutoAssign().then((res) => {
              if (res.assigned === 0 && res.conflicts.length) {
                toast.error("Auto-assign blocked", {
                  description: res.conflicts.slice(0, 2).join(" · "),
                });
                return;
              }
              toast.success(`⚡ Assigned ${res.assigned}`, {
                description:
                  res.conflicts.length > 0
                    ? `${res.conflicts.length} conflict(s) left`
                    : "Groups clustered · VIP floor 3",
              });
            });
          }}
        >
          Auto-Assign Arrivals (⚡ Smart)
        </Button>
      ) : null}

      <div className="hos-scrollbar-slim flex flex-col gap-2 pb-3">
        {rows.length === 0 ? (
          <EmptyState
            title={tab === "day" ? "No stays this day" : "Nothing in this list"}
            description={
              tab === "day"
                ? "Open Cal and pick another date, or create a booking."
                : "Switch segment or create a booking."
            }
            action={
              <Button
                size="sm"
                className="hos-btn-ink !text-white"
                onClick={() =>
                  openFastBook(
                    tab === "day" ? { checkIn: calSelected } : undefined,
                  )
                }
              >
                Fast Book
              </Button>
            }
          />
        ) : listMode === "table" ? (
          <div className="overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
            <table className="w-full min-w-[34rem] border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-[var(--hos-line)] text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--hos-ink-3)]">
                  <th className="px-2.5 py-2">Guest</th>
                  <th className="px-2 py-2">Rm</th>
                  <th className="px-2 py-2">Stay</th>
                  <th className="px-2 py-2">Meal</th>
                  <th className="px-2 py-2 text-right">Balance</th>
                  <th className="px-2.5 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hos-line)]">
                {rows.map((s) => {
                  const bal = folioBalance(s);
                  const canCheckIn =
                    ["confirmed", "held"].includes(s.status) && Boolean(s.roomId);
                  const canCheckOut = s.status === "checked_in";
                  return (
                    <tr
                      key={s.id}
                      className="active:bg-[rgba(37,99,235,0.06)]"
                      onClick={() => openStay(s.id)}
                    >
                      <td className="max-w-[9rem] px-2.5 py-2.5">
                        <div className="truncate font-semibold text-[var(--hos-ink)]">
                          {s.guestName}
                          {s.vip ? " ★" : ""}
                        </div>
                        <div className="truncate font-mono text-[10px] text-[var(--hos-ink-3)]">
                          {s.confirmationNo}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 font-mono font-bold tabular-nums text-[var(--hos-primary)]">
                        {s.roomNumber ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-[var(--hos-ink-2)]">
                        {nightsBetween(s.checkIn, s.checkOut)}N
                        <div className="text-[10px] text-[var(--hos-ink-3)]">
                          {s.checkIn.slice(5)}→{s.checkOut.slice(5)}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 font-mono text-[var(--hos-ink-2)]">
                        {s.mealPlan}
                      </td>
                      <td
                        className={[
                          "px-2 py-2.5 text-right font-mono font-bold tabular-nums",
                          bal > 0.5
                            ? "text-[var(--hos-ruby)]"
                            : "text-[var(--hos-emerald)]",
                        ].join(" ")}
                      >
                        {formatNu(bal)}
                      </td>
                      <td
                        className="px-2.5 py-2 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canCheckIn ? (
                          <Button
                            size="sm"
                            className="hos-btn-ink !min-h-8 !rounded-lg !px-2.5 text-[11px]"
                            onClick={() => {
                              void (async () => {
                                const res = await checkIn(s.id);
                                if (!res.ok) toast.error(res.error);
                                else
                                  toast.success(`Checked in · Rm ${s.roomNumber}`);
                              })();
                            }}
                          >
                            CI
                          </Button>
                        ) : canCheckOut ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="!min-h-8 !rounded-lg !px-2.5 text-[11px]"
                            onClick={() => {
                              void (async () => {
                                const res = await checkOut(s.id);
                                if (!res.ok) {
                                  toast.error(res.error);
                                  if (bal > 0.5) openStay(s.id);
                                  return;
                                }
                                toast.success("Checked out");
                              })();
                            }}
                          >
                            CO
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="!min-h-8 !rounded-lg !px-2.5 text-[11px]"
                            onClick={() => openStay(s.id)}
                          >
                            Folio
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          rows.map((s, i) => {
            const bal = folioBalance(s);
            const canCheckIn =
              ["confirmed", "held"].includes(s.status) && Boolean(s.roomId);
            const canCheckOut = s.status === "checked_in";
            return (
              <motion.article
                key={s.id}
                data-status={s.status}
                className="hos-mobile-pass hos-butter-card"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.18) }}
                whileTap={reduce ? undefined : { scale: 0.99 }}
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-2.5 text-left"
                  onClick={() => openStay(s.id)}
                >
                  <div className="hos-mobile-avatar">{initials(s.guestName)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <strong className="truncate text-[14px] font-bold tracking-tight text-[var(--hos-ink)]">
                        {s.guestName}
                      </strong>
                      {s.vip ? <Badge tone="vip">VIP</Badge> : null}
                      {!s.roomId ? (
                        <Badge tone="danger">No room</Badge>
                      ) : (
                        <span className="rounded-full bg-[rgba(17,17,17,0.07)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--hos-ink)]">
                          Rm {s.roomNumber}
                        </span>
                      )}
                    </div>
                    <p className="m-0 mt-0.5 font-mono text-[11px] tabular-nums text-[var(--hos-ink-3)]">
                      {s.confirmationNo} · {nightsBetween(s.checkIn, s.checkOut)}N ·{" "}
                      {s.mealPlan}
                      {s.groupName ? ` · ${s.groupName}` : ""}
                    </p>
                    <p
                      className={[
                        "m-0 mt-1 font-mono text-[13px] font-bold tabular-nums",
                        bal > 0.5
                          ? "text-[var(--hos-ruby)]"
                          : "text-[var(--hos-emerald)]",
                      ].join(" ")}
                    >
                      {formatNu(bal)} {bal > 0.5 ? "due" : "settled"}
                    </p>
                  </div>
                </button>

                <div className="grid grid-cols-2 gap-1.5">
                  {canCheckIn ? (
                    <Button
                      size="sm"
                      className="hos-btn-ink col-span-2 !min-h-9 !rounded-xl text-[12px]"
                      onClick={() => {
                        void (async () => {
                          const res = await checkIn(s.id);
                          if (!res.ok) toast.error(res.error);
                          else
                            toast.success(`Checked in · Rm ${s.roomNumber}`, {
                              description: "Keycard encode queued",
                            });
                        })();
                      }}
                    >
                      <Zap className="size-3.5" strokeWidth={2} />
                      Check in
                    </Button>
                  ) : null}
                  {canCheckOut ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="!min-h-9 !rounded-xl text-[12px]"
                      onClick={() => {
                        void (async () => {
                          const res = await checkOut(s.id);
                          if (!res.ok) {
                            toast.error(res.error);
                            if (bal > 0.5) openStay(s.id);
                            return;
                          }
                          toast.success("Checked out");
                        })();
                      }}
                    >
                      Check out
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="!min-h-9 !rounded-xl text-[12px]"
                      onClick={() =>
                        toast.message("Keycard", {
                          description: s.roomNumber
                            ? `Rm ${s.roomNumber}`
                            : "Assign room first",
                        })
                      }
                    >
                      <KeyRound className="size-3.5" />
                      Keycard
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="!min-h-9 !rounded-xl border border-[var(--hos-line)] text-[12px]"
                    onClick={() => openStay(s.id)}
                  >
                    Open stay
                  </Button>
                </div>
              </motion.article>
            );
          })
        )}
      </div>

      <MobileCalendarSheet
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        selected={calSelected}
        today={today}
        stays={stays}
        rooms={rooms}
        onSelectDate={(date) => {
          setCalSelected(date);
          setTab("day");
        }}
        title="Desk calendar"
      />
    </div>
  );
}
