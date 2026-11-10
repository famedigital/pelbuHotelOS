import { motion, useReducedMotion } from "motion/react";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  CurrencyCell,
  EmptyState,
  GlassPanel,
  KeycapBadge,
  LedBeacon,
  MorphTabs,
  Odometer,
  fadeSlide,
  staggerChildren,
  useIsPhone,
  useIsTablet,
} from "@hos-v2/ui";
import {
  Banknote,
  Crown,
  ListChecks,
  MoonStar,
  Search,
  Users,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  formatNu,
  folioBalance,
  nightsBetween,
  stayOnDate,
  useFrontOfficeStore,
  ymd,
  type Room,
  type Stay,
} from "../lib/front-office-store";
import { nightAuditReadiness } from "../lib/action-dispatcher";
import { useFiscalStore } from "../lib/fiscal-store";
import { useExtrasStore } from "../lib/extras-store";
import { useEnterpriseOpsStore } from "../lib/enterprise-ops-store";
import { playSfx } from "../lib/sfx";
import { MealBoardMissionCard } from "./MealBoardMissionCard";
import { DeskMobileView } from "./mobile/DeskMobileView";
import { DeskTabletView } from "./mobile/DeskTabletView";

type Tab = "arrivals" | "inHouse" | "departures" | "tomorrow";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function guestCountry(name: string): { flag: string; code: string } {
  if (
    name.includes("Dorji") ||
    name.includes("Pema") ||
    name.includes("Karma") ||
    name.includes("Tenzin") ||
    name.includes("Wangchuk") ||
    name.includes("Namgay") ||
    name.includes("Tshering")
  ) {
    return { flag: "🇧🇹", code: "BTN" };
  }
  if (
    name.includes("Kumar") ||
    name.includes("Sharma") ||
    name.includes("Patel") ||
    name.includes("Singh") ||
    name.includes("Gupta")
  ) {
    return { flag: "🇮🇳", code: "IND" };
  }
  if (
    name.includes("Müller") ||
    name.includes("Hans") ||
    name.includes("Weber") ||
    name.includes("Schmidt")
  ) {
    return { flag: "🇩🇪", code: "DEU" };
  }
  if (
    name.includes("Takahashi") ||
    name.includes("Sato") ||
    name.includes("Tanaka") ||
    name.includes("Kenji")
  ) {
    return { flag: "🇯🇵", code: "JPN" };
  }
  return { flag: "🇺🇸", code: "USA" };
}

function vipPreferences(name: string): string[] {
  if (name.includes("Dorji") || name.includes("Wangchuk")) {
    return ["Quiet Top Floor", "Cordyceps Tea", "Late Checkout"];
  }
  if (name.includes("Kumar") || name.includes("Sharma")) {
    return ["Pure Vegetarian", "Extra King Blanket", "High Floor"];
  }
  if (name.includes("Müller")) {
    return ["Hot Stone Bath", "Mountain View", "Gluten Free"];
  }
  return ["VIP Welcome Amenity", "Daily Pressing", "Quiet Wing"];
}

/** Quiet floor chips — occupied uses --hos-occupied-* (safe in light + midnight). */
function roomChipTone(
  room: Room,
  stay: Stay | undefined,
  today: string,
): string {
  if (room.hkStatus === "ooo")
    return "border-[var(--hos-line)] bg-[var(--hos-canvas-2)] text-[var(--hos-ruby)]";
  if (stay?.status === "checked_in")
    return "border-transparent bg-[var(--hos-occupied-bg)] text-[var(--hos-occupied-fg)]";
  if (
    stay &&
    ["confirmed", "held"].includes(stay.status) &&
    stay.checkIn === today
  )
    return "border-[var(--hos-primary)] bg-[color-mix(in_srgb,var(--hos-primary)_16%,var(--hos-cell))] text-[var(--hos-ink)]";
  if (room.hkStatus === "dirty")
    return "border-[color-mix(in_srgb,var(--hos-brass)_40%,var(--hos-line))] bg-[color-mix(in_srgb,var(--hos-brass)_12%,var(--hos-cell))] text-[var(--hos-brass-ink)]";
  return "border-[var(--hos-line)] bg-[var(--hos-canvas-2)] text-[var(--hos-ink-2)]";
}

export function DeskPage() {
  const isPhone = useIsPhone();
  const isTablet = useIsTablet();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<Tab>("arrivals");
  const [query, setQuery] = useState("");
  const [vipOnly, setVipOnly] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advAmount, setAdvAmount] = useState("3000");
  const [advName, setAdvName] = useState("CFM runner");
  const [focusIdx, setFocusIdx] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const lastUndoStayId = useRef<string | null>(null);
  const [, start] = useTransition();
  const staysRaw = useFrontOfficeStore((s) => s.stays);
  const roomsRaw = useFrontOfficeStore((s) => s.rooms);
  const stays = useDeferredValue(staysRaw);
  const rooms = useDeferredValue(roomsRaw);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const openFastBook = useFrontOfficeStore((s) => s.openFastBook);
  const smartAutoAssign = useFrontOfficeStore((s) => s.smartAutoAssign);
  const checkIn = useFrontOfficeStore((s) => s.checkIn);
  const revertCheckIn = useFrontOfficeStore((s) => s.revertCheckIn);
  const checkOut = useFrontOfficeStore((s) => s.checkOut);
  const tillBalance = useFiscalStore((s) => s.tillBalance);
  const auditReady = useMemo(
    () => nightAuditReadiness(),
    [stays, businessDate, rooms],
  );
  const tillShifts = useExtrasStore((s) => s.tillShifts);
  const issueAdvanceRemote = useEnterpriseOpsStore((s) => s.issueAdvanceRemote);

  const today = businessDate || ymd(new Date());
  const tomorrow = useMemo(() => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return ymd(d);
  }, [today]);

  const arrivals = useMemo(
    () =>
      stays.filter(
        (s) => s.checkIn === today && ["confirmed", "held"].includes(s.status),
      ),
    [stays, today],
  );
  const inHouse = useMemo(
    () => stays.filter((s) => s.status === "checked_in"),
    [stays],
  );
  const checkedOutToday = useMemo(
    () =>
      stays.filter(
        (s) => s.checkOut === today && s.status === "checked_out",
      ),
    [stays, today],
  );
  /** Due-out in-house + already checked out today (same-day departures board). */
  const departures = useMemo(
    () =>
      stays.filter(
        (s) =>
          s.checkOut === today &&
          (s.status === "checked_in" || s.status === "checked_out"),
      ),
    [stays, today],
  );
  const tomorrowArrivals = useMemo(
    () =>
      stays.filter(
        (s) => s.checkIn === tomorrow && ["confirmed", "held"].includes(s.status),
      ),
    [stays, tomorrow],
  );

  const occRooms = useMemo(
    () =>
      rooms.filter((r) =>
        stays.some((s) => s.roomId === r.id && stayOnDate(s, today)),
      ).length,
    [rooms, stays, today],
  );
  const occPct = rooms.length ? Math.round((occRooms / rooms.length) * 100) : 0;
  const roomRev = useMemo(
    () => inHouse.reduce((s, st) => s + st.nightlyNet, 0),
    [inHouse],
  );
  const adr = occRooms ? Math.round(roomRev / occRooms) : 0;
  const dailyYield = Math.round(roomRev * 1.21);

  const cleanReady = useMemo(
    () =>
      rooms.filter(
        (r) => r.hkStatus === "clean" || r.hkStatus === "inspected",
      ).length,
    [rooms],
  );
  const dirty = useMemo(
    () => rooms.filter((r) => r.hkStatus === "dirty").length,
    [rooms],
  );
  const ooo = useMemo(
    () => rooms.filter((r) => r.hkStatus === "ooo").length,
    [rooms],
  );
  const inProgress = useMemo(
    () => rooms.filter((r) => r.hkStatus === "occupied").length,
    [rooms],
  );
  const unassigned = arrivals.filter((s) => !s.roomId).length;
  const pendingSettle = departures.filter(
    (s) => s.status === "checked_in" && folioBalance(s, "personal") > 0.5,
  ).length;
  const vips = inHouse.filter((s) => s.vip);
  const openShift = tillShifts.find((t) => !t.closedAt);

  const floors = useMemo(() => {
    const fs = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
    return fs.map((f) => ({
      floor: f,
      rooms: rooms
        .filter((r) => r.floor === f)
        .sort((a, b) => a.number.localeCompare(b.number)),
    }));
  }, [rooms]);

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; rooms: number; pax: number }>();
    for (const s of inHouse) {
      if (!s.groupName) continue;
      const cur = map.get(s.groupName) ?? {
        name: s.groupName,
        rooms: 0,
        pax: 0,
      };
      cur.rooms += 1;
      cur.pax += 2;
      map.set(s.groupName, cur);
    }
    return [...map.values()];
  }, [inHouse]);

  const baseRows: Stay[] =
    tab === "arrivals"
      ? arrivals
      : tab === "inHouse"
        ? inHouse
        : tab === "departures"
          ? departures
          : tomorrowArrivals;

  const rows = baseRows.filter((s) => {
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

  useEffect(() => {
    setFocusIdx((i) => (rows.length === 0 ? 0 : Math.min(i, rows.length - 1)));
  }, [rows.length, tab, query, vipOnly]);

  function runCheckIn(stay: Stay) {
    void (async () => {
      const res = await checkIn(stay.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      playSfx("keycard");
      lastUndoStayId.current = stay.id;
      toast.success(`Checked in · Rm ${stay.roomNumber}`, {
        description: "Keycard encode · ⌘Z to undo (5s)",
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            void revertCheckIn(stay.id).then((undo) => {
              if (!undo.ok) toast.error(undo.error);
              else {
                lastUndoStayId.current = null;
                toast.message("Check-in undone");
              }
            });
          },
        },
      });
    })();
  }

  useEffect(() => {
    if (isPhone || isTablet) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        t?.isContentEditable
      ) {
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && shortcutsOpen) {
        e.preventDefault();
        setShortcutsOpen(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        const id = lastUndoStayId.current;
        if (!id) {
          toast.message("Nothing to undo");
          return;
        }
        void revertCheckIn(id).then((undo) => {
          if (!undo.ok) toast.error(undo.error);
          else {
            lastUndoStayId.current = null;
            toast.message("Check-in undone");
          }
        });
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const focused = rows[focusIdx];
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        setFocusIdx((i) => Math.min(i + 1, Math.max(0, rows.length - 1)));
        return;
      }
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        setFocusIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "x" || e.key === "X") {
        e.preventDefault();
        if (!focused) return;
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(focused.id)) next.delete(focused.id);
          else next.add(focused.id);
          return next;
        });
        return;
      }
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        if (!focused) return;
        if (["confirmed", "held"].includes(focused.status)) runCheckIn(focused);
        else toast.message("Check-in not available for this stay");
        return;
      }
      if (e.key === "o" || e.key === "O") {
        e.preventDefault();
        if (!focused || focused.status !== "checked_in") {
          toast.message("Check-out not available for this stay");
          return;
        }
        const personalBal = folioBalance(focused, "personal");
        if (personalBal > 0.5) {
          toast.error("Checkout blocked", {
            description: `Guest has unpaid personal balance of ${formatNu(personalBal)}. Settle guest extras first.`,
          });
          openStay(focused.id);
          return;
        }
        void (async () => {
          const res = await checkOut(focused.id);
          if (!res.ok) {
            toast.error("Checkout blocked", { description: res.error });
            if (folioBalance(focused, "personal") > 0.5) openStay(focused.id);
            return;
          }
          toast.success("Checked out");
        })();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    isPhone,
    isTablet,
    rows,
    focusIdx,
    shortcutsOpen,
    checkIn,
    checkOut,
    revertCheckIn,
    openStay,
  ]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "arrivals", label: "Arrivals", count: arrivals.length },
    { id: "inHouse", label: "In-House", count: inHouse.length },
    { id: "departures", label: "Departures", count: departures.length },
    { id: "tomorrow", label: "Tomorrow", count: tomorrowArrivals.length },
  ];

  const datePretty = new Date(`${today}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  if (isPhone) return <DeskMobileView />;
  if (isTablet) return <DeskTabletView />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className="flex h-7 shrink-0 items-center gap-2">
        <h1 className="m-0 truncate text-sm font-semibold tracking-tight text-[var(--hos-ink)]">
          Desk
          <span className="ml-2 font-normal text-[var(--hos-ink-3)]">
            {datePretty}
          </span>
        </h1>
        <button
          type="button"
          onClick={() => navigate("/night-audit")}
          title={
            auditReady.blockers === 0
              ? "Night audit ready"
              : `${auditReady.blockers} blocker(s) before close`
          }
          className={[
            "hos-btn-tactile ml-auto inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 text-[12px] font-medium tracking-tight text-[var(--hos-ink-2)]",
            auditReady.blockers > 0 && auditReady.score < 50
              ? "!border-[color-mix(in_srgb,var(--hos-ruby)_40%,transparent)] !text-[var(--hos-ruby)]"
              : "",
          ].join(" ")}
        >
          <MoonStar className="size-3.5 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
          <span>Audit</span>
          <span className="font-mono text-[12px] font-semibold tabular-nums tracking-tight text-[var(--hos-ink)]">
            {auditReady.score}%
          </span>
        </button>
      </div>

      <motion.div
        data-tour="kpis"
        className="hos-desk-kpi-strip grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--hos-line)] bg-[var(--hos-line)] sm:grid-cols-3 lg:grid-cols-5"
        variants={staggerChildren}
        initial={reduce ? false : "hidden"}
        animate="show"
      >
        <motion.div
          variants={fadeSlide}
          className="hos-desk-kpi"
          data-jewel="sapphire"
        >
          <div className="relative flex items-center justify-between gap-2">
            <span className="hos-desk-kpi-label">Occupancy</span>
            <span className="hos-desk-kpi-trend">↑ 12.4%</span>
          </div>
          <div className="relative flex items-baseline gap-2">
            <Odometer
              value={occPct}
              suffix="%"
              className="font-mono text-[1.375rem] font-semibold tabular-nums tracking-tight text-[var(--hos-ink)]"
            />
            <span className="font-mono text-[11px] tabular-nums text-[var(--hos-ink-3)]">
              {occRooms}/{rooms.length}
            </span>
          </div>
          <div className="hos-desk-kpi-bar" aria-hidden>
            <span
              className="bg-[var(--hos-primary)]"
              style={{ width: `${Math.min(100, occPct)}%` }}
            />
            <span
              className="bg-[var(--hos-emerald)]"
              style={{
                width: `${Math.min(100 - occPct, Math.round((cleanReady / Math.max(1, rooms.length)) * 100))}%`,
              }}
            />
          </div>
        </motion.div>

        <motion.div
          variants={fadeSlide}
          className="hos-desk-kpi"
          data-jewel="emerald"
        >
          <div className="relative flex items-center gap-1.5">
            <span className="hos-desk-kpi-label">RevPAR</span>
            <LedBeacon tone="emerald" />
          </div>
          <Odometer
            value={dailyYield}
            prefix="Nu. "
            className="relative font-mono text-[1.375rem] font-semibold tabular-nums tracking-tight text-[var(--hos-ink)]"
          />
          <p className="relative m-0 font-mono text-[10px] tabular-nums text-[var(--hos-ink-3)]">
            ADR {formatNu(adr)} · 10% SC in
          </p>
        </motion.div>

        <motion.div
          variants={fadeSlide}
          className="hos-desk-kpi"
          data-jewel="indigo"
        >
          <span className="hos-desk-kpi-label">Arrivals</span>
          <div className="relative flex items-baseline gap-2">
            <Odometer
              value={arrivals.length}
              className="font-mono text-[1.375rem] font-semibold tabular-nums tracking-tight text-[var(--hos-ink)]"
            />
            {unassigned > 0 ? (
              <span className="rounded-md bg-[color-mix(in_srgb,var(--hos-ruby)_14%,transparent)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--hos-ruby)]">
                ⚠ {unassigned} unassigned
              </span>
            ) : (
              <span className="text-[11px] text-[var(--hos-ink-3)]">assigned</span>
            )}
          </div>
        </motion.div>

        <motion.div
          variants={fadeSlide}
          className="hos-desk-kpi"
          data-jewel="slate"
        >
          <span className="hos-desk-kpi-label">Departures</span>
          <div className="relative flex items-baseline gap-2">
            <Odometer
              value={departures.length}
              className="font-mono text-[1.375rem] font-semibold tabular-nums tracking-tight text-[var(--hos-ink)]"
            />
            <span
              className={`text-[11px] font-medium ${
                pendingSettle > 0
                  ? "text-[var(--hos-ruby)]"
                  : "text-[var(--hos-ink-3)]"
              }`}
            >
              {pendingSettle > 0
                ? `${pendingSettle} pending settle`
                : `${checkedOutToday.length} checked-out`}
            </span>
          </div>
        </motion.div>

        <motion.div
          variants={fadeSlide}
          className="hos-desk-kpi col-span-2 sm:col-span-1"
          data-jewel="brass"
        >
          <span className="hos-desk-kpi-label">Housekeeping</span>
          <div className="relative mt-0.5 flex flex-wrap gap-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--hos-emerald)_14%,transparent)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--hos-emerald)]">
              <LedBeacon tone="emerald" pulse={false} /> {cleanReady}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--hos-primary)_14%,transparent)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--hos-primary)]">
              <LedBeacon tone="sapphire" pulse={false} /> {inProgress}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--hos-brass)_16%,transparent)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--hos-brass-ink)]">
              <LedBeacon tone="brass" pulse={false} /> {dirty}
            </span>
            {ooo > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--hos-ruby)_14%,transparent)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--hos-ruby)]">
                <LedBeacon tone="ruby" pulse={false} /> {ooo}
              </span>
            ) : null}
          </div>
        </motion.div>
      </motion.div>

      {(() => {
        const holds = stays.filter((s) => s.status === "held");
        if (holds.length === 0) return null;
        return (
          <div className="hos-scrollbar-slim flex shrink-0 gap-2 overflow-x-auto rounded-xl border border-[var(--hos-brass)]/30 bg-[rgba(245,158,11,0.08)] px-2 py-1.5">
            <span className="hos-section-label shrink-0 !m-0 self-center text-[var(--hos-brass-ink)]">
              Holds
            </span>
            {holds.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => openStay(s.id)}
                className="hos-btn-tactile hos-cell shrink-0 rounded-lg px-2.5 py-1 text-left text-[11px]"
              >
                <span className="font-semibold text-[var(--hos-ink)]">{s.guestName}</span>
                <span className="ml-2 font-mono tabular-nums text-[var(--hos-ink-3)]">
                  {s.confirmationNo} · {s.checkIn.slice(5)}
                </span>
              </button>
            ))}
          </div>
        );
      })()}

      <div
        data-tour="floormap"
        className="hos-floor-rail shrink-0 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]"
      >
        <span className="hos-section-label shrink-0 !m-0">
          Floors
        </span>
        <div className="hos-floor-rail-scroll">
          {floors.map((f) => (
            <div key={f.floor} className="hos-floor-group">
              <span className="hos-floor-label">F{f.floor}</span>
              {f.rooms.map((room) => {
                const stay =
                  stays.find(
                    (s) =>
                      s.roomId === room.id &&
                      !["cancelled", "no_show", "checked_out"].includes(
                        s.status,
                      ) &&
                      s.checkIn <= today &&
                      today < s.checkOut,
                  ) ??
                  stays.find(
                    (s) =>
                      s.roomId === room.id &&
                      ["confirmed", "held"].includes(s.status) &&
                      s.checkIn === today,
                  );
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => {
                      if (stay) openStay(stay.id);
                      else
                        toast.message(`Room ${room.number}`, {
                          description: room.hkStatus,
                        });
                    }}
                    className={`hos-btn-tactile hos-floor-chip border ${roomChipTone(room, stay, today)}`}
                    title={stay?.guestName ?? room.hkStatus}
                  >
                    {room.number}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden md:grid-cols-[60%_40%] xl:grid-cols-[65%_35%]">
        <GlassPanel className="flex min-h-0 flex-col gap-3 overflow-hidden p-3">
          <MorphTabs
            glowId="deskTab"
            value={tab}
            onChange={setTab}
            items={tabs.map((t) => ({
              id: t.id,
              label: t.label,
              count: t.count,
            }))}
          />
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="hos-search-field min-w-[140px] flex-1">
              <Search className="hos-search-icon" strokeWidth={2} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search guest, room, voucher…"
                className="hos-search-input !h-8 !min-h-8 !rounded-full !text-[12px]"
              />
            </div>
            <button
              type="button"
              onClick={() => setVipOnly((v) => !v)}
              className={`hos-btn-tactile rounded-md border px-2.5 py-1.5 text-[11px] font-medium ${
                vipOnly
                  ? "border-[var(--hos-ink)] bg-[var(--hos-ink)] text-white"
                  : "border-[var(--hos-line)] text-[var(--hos-ink-2)]"
              }`}
            >
              VIP
            </button>
            {tab === "arrivals" ? (
              <Button
                size="sm"
                variant="secondary"
                className="!h-9 !min-h-9 !rounded-full !px-4 text-[13px] font-medium"
                onClick={() => {
                  start(() => {
                    void smartAutoAssign().then((res) => {
                      if (res.assigned === 0 && res.conflicts.length) {
                        toast.error("Auto-assign blocked", {
                          description: res.conflicts.slice(0, 2).join(" · "),
                        });
                        return;
                      }
                      toast.success(`⚡ Smart assigned ${res.assigned}`, {
                        description:
                          res.conflicts.length > 0
                            ? `${res.conflicts.length} conflict(s) remaining`
                            : "Groups clustered · VIP floor 3 · tetris gaps avoided",
                      });
                    });
                  });
                }}
              >
                Auto-assign
              </Button>
            ) : null}
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title={`No ${tabs.find((t) => t.id === tab)?.label.toLowerCase()} yet`}
              description="Fast Book or wait for channel / group arrivals."
              action={
                <Button
                  size="sm"
                  className="hos-btn-ink !rounded-full"
                  onClick={() => openFastBook()}
                >
                  Fast Book
                </Button>
              }
            />
          ) : (
            <div className="hos-scrollbar-slim flex min-h-0 flex-1 flex-col overflow-y-auto">
              {rows.map((s, idx) => {
                const masterBal = folioBalance(s, "master");
                const personalBal = folioBalance(s, "personal");
                const bal = masterBal + personalBal;
                const nights = nightsBetween(s.checkIn, s.checkOut);
                const roomObj = rooms.find((r) => r.id === s.roomId);
                const roomTypeLabel = roomObj?.typeName ?? "—";
                const country = guestCountry(s.guestName);
                const personalDue = personalBal > 0.5;
                const agencyDue = masterBal > 0.5;
                const due = personalDue || agencyDue;
                const focused = idx === focusIdx;
                const batch = selectedIds.has(s.id);
                return (
                  <div
                    key={s.id}
                    data-tour={idx === 0 ? "worklist" : undefined}
                    className={`group flex shrink-0 cursor-pointer flex-col gap-2 border-b border-[var(--hos-line)] px-1 py-3 last:border-b-0 hover:bg-[color-mix(in_srgb,var(--hos-ink)_3%,transparent)] ${
                      focused
                        ? "bg-[color-mix(in_srgb,var(--hos-primary)_8%,transparent)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--hos-primary)_35%,transparent)]"
                        : ""
                    } ${batch ? "border-l-2 border-l-[var(--hos-brass)]" : ""}`}
                    onClick={() => {
                      setFocusIdx(idx);
                      openStay(s.id);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--hos-canvas-2)] text-[11px] font-semibold tracking-tight text-[var(--hos-ink-2)]">
                        {initials(s.guestName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <strong className="truncate text-[14px] font-semibold tracking-tight text-[var(--hos-ink)]">
                            {s.guestName}
                          </strong>
                          <span className="text-[11px] text-[var(--hos-ink-3)]">
                            {country.flag} {country.code}
                          </span>
                          {s.vip ? (
                            <span className="text-[11px] font-medium text-[var(--hos-brass-ink)]">
                              VIP
                            </span>
                          ) : null}
                        </div>
                        <p className="m-0 mt-0.5 truncate font-mono text-[11px] tabular-nums text-[var(--hos-ink-3)]">
                          {s.confirmationNo}
                          <span className="mx-1.5 opacity-40">·</span>
                          {s.roomId ? (
                            <>
                              Rm {s.roomNumber}
                              <span className="mx-1 opacity-40">·</span>
                              {roomTypeLabel}
                            </>
                          ) : (
                            <span className="font-semibold text-[var(--hos-ruby)]">
                              Unassigned
                            </span>
                          )}
                          <span className="mx-1.5 opacity-40">·</span>
                          {nights}N · {s.mealPlan}
                          {s.groupName ? (
                            <>
                              <span className="mx-1.5 opacity-40">·</span>
                              {s.groupName}
                            </>
                          ) : null}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <CurrencyCell
                          amount={personalDue ? personalBal : bal}
                          showCents
                          className={`justify-end text-[13px] ${
                            personalDue
                              ? "text-[var(--hos-ruby)]"
                              : "text-[var(--hos-ink)]"
                          }`}
                        />
                        <span className="text-[10px] text-[var(--hos-ink-3)]">
                          {personalDue
                            ? "Guest due"
                            : agencyDue
                              ? `Agency ${formatNu(masterBal)}`
                              : "Settled"}
                        </span>
                      </div>
                    </div>
                    <div
                      className="flex flex-wrap items-center gap-1.5 pl-12"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {["confirmed", "held"].includes(s.status) ? (
                        <Button
                          size="sm"
                          className="hos-btn-ink !h-8 !min-h-8 gap-1 !rounded-full !px-3 text-[12px] font-medium"
                          disabled={!s.roomId}
                          onClick={() => runCheckIn(s)}
                        >
                          <Zap className="size-3" strokeWidth={2.25} />
                          Check in
                        </Button>
                      ) : null}
                      {s.status === "checked_in" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="!h-8 !min-h-8 !rounded-full !px-3 text-[12px] font-medium"
                          disabled={personalDue}
                          title={
                            personalDue
                              ? `Settle guest extras ${formatNu(personalBal)} before checkout`
                              : agencyDue
                                ? `Agency ${formatNu(masterBal)} remains on city ledger`
                                : undefined
                          }
                          onClick={() => {
                            if (personalBal > 0.5) {
                              toast.error("Checkout blocked", {
                                description: `Guest has unpaid personal balance of ${formatNu(personalBal)}. Settle guest extras first.`,
                              });
                              openStay(s.id);
                              return;
                            }
                            void (async () => {
                              const res = await checkOut(s.id);
                              if (!res.ok) {
                                toast.error("Checkout blocked", {
                                  description: res.error,
                                });
                                if (folioBalance(s, "personal") > 0.5) openStay(s.id);
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
                        className="!h-8 !min-h-8 !rounded-full !px-3 text-[12px] font-medium text-[var(--hos-ink-2)]"
                        onClick={() => openStay(s.id)}
                      >
                        Folio
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassPanel>

        <div
          data-tour="radar"
          className="hos-scrollbar-slim flex min-h-0 flex-col gap-3 overflow-y-auto"
        >
          <MealBoardMissionCard />

          <section className="shrink-0 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
            <div className="flex items-center justify-between">
              <strong className="hos-section-label !m-0 flex items-center gap-1.5">
                <Crown className="size-3 text-[var(--hos-ink-3)]" strokeWidth={2} />
                VIP in-house
              </strong>
              <span className="font-mono text-[11px] tabular-nums text-[var(--hos-ink-3)]">
                {vips.length}
              </span>
            </div>
            {vips.length === 0 ? (
              <p className="m-0 mt-2 text-xs text-[var(--hos-ink-3)]">
                No VIPs in-house
              </p>
            ) : (
              <ul className="m-0 mt-2 list-none divide-y divide-[var(--hos-line)] p-0">
                {vips.map((v) => {
                  const prefs = vipPreferences(v.guestName);
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => openStay(v.id)}
                        className="flex w-full flex-col gap-0.5 py-2 text-left hover:opacity-80"
                      >
                        <div className="flex w-full items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-medium text-[var(--hos-ink)]">
                            {v.guestName}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--hos-ink-3)]">
                            Rm {v.roomNumber}
                          </span>
                        </div>
                        <p className="m-0 truncate text-[10px] text-[var(--hos-ink-3)]">
                          {prefs.join(" · ")}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="shrink-0 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
            <div className="flex items-center justify-between">
              <strong className="hos-section-label !m-0 flex items-center gap-1.5">
                <Users className="size-3 text-[var(--hos-ink-3)]" strokeWidth={2} />
                Groups
              </strong>
              <span className="font-mono text-[11px] tabular-nums text-[var(--hos-ink-3)]">
                {groups.length}
              </span>
            </div>
            {groups.length === 0 ? (
              <p className="m-0 mt-2 text-xs text-[var(--hos-ink-3)]">
                No groups in-house
              </p>
            ) : (
              <ul className="m-0 mt-2 list-none divide-y divide-[var(--hos-line)] p-0">
                {groups.map((g) => (
                  <li key={g.name} className="py-2 text-[13px]">
                    <div className="flex items-baseline justify-between gap-2">
                      <strong className="font-medium text-[var(--hos-ink)]">
                        {g.name}
                      </strong>
                      <span className="font-mono text-[11px] tabular-nums text-[var(--hos-ink-3)]">
                        {g.rooms} rm · {g.pax} pax
                      </span>
                    </div>
                    <p className="m-0 mt-0.5 text-[10px] text-[var(--hos-ink-3)]">
                      Guide Sangay Dorji · Bus BP-1-A2041
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="shrink-0 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
            <div className="flex items-center justify-between">
              <strong className="hos-section-label !m-0 flex items-center gap-1.5">
                <Banknote className="size-3 text-[var(--hos-ink-3)]" strokeWidth={2} />
                Till
              </strong>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--hos-ink-3)]">
                <LedBeacon
                  tone={openShift ? "emerald" : "brass"}
                  pulse={Boolean(openShift)}
                />
                {openShift ? "Open" : "Closed"}
              </span>
            </div>
            <Odometer
              value={tillBalance}
              prefix="Nu. "
              className="mt-1.5 block font-mono text-xl font-semibold tabular-nums tracking-tight text-[var(--hos-ink)]"
            />
            <p className="m-0 mt-0.5 font-mono text-[10px] tabular-nums text-[var(--hos-ink-3)]">
              Opening {formatNu(openShift?.openingFloat ?? 10000)}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                className="hos-btn-spring !h-7 !px-2.5 text-[11px]"
                onClick={() => setAdvanceOpen((v) => !v)}
              >
                + Cash Advance
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="hos-btn-spring !h-7 !px-2 text-[11px]"
                onClick={() => toast.message("Cash drop queued")}
              >
                − Till Drop
              </Button>
            </div>
            {advanceOpen ? (
              <div className="mt-2.5 space-y-2 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5">
                <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
                  CFM market advance · till floats down now
                </p>
                <label className="grid gap-0.5 text-[10px] font-medium text-[var(--hos-ink-2)]">
                  Issued to
                  <input
                    value={advName}
                    onChange={(e) => setAdvName(e.target.value)}
                    className="hos-input !min-h-9 !rounded-lg !px-2 !text-xs"
                  />
                </label>
                <label className="grid gap-0.5 text-[10px] font-medium text-[var(--hos-ink-2)]">
                  Amount (Nu)
                  <input
                    type="number"
                    min={1}
                    value={advAmount}
                    onChange={(e) => setAdvAmount(e.target.value)}
                    className="hos-input !min-h-9 !rounded-lg !px-2 !text-xs"
                  />
                </label>
                <Button
                  size="sm"
                  magnetic
                  className="hos-btn-spring !h-9 w-full !rounded-full !bg-[#111] !text-white"
                  onClick={() => {
                    start(async () => {
                      const res = await issueAdvanceRemote({
                        amountBtn: Number(advAmount) || 0,
                        issuedToName: advName.trim() || "CFM runner",
                        purpose: "cfm_market",
                      });
                      if (!res.ok) {
                        toast.error(res.error);
                        return;
                      }
                      playSfx("register");
                      toast.success("CFM advance issued", {
                        description: `${formatNu(res.advance.amountBtn)} · till ${formatNu(useFiscalStore.getState().tillBalance)} · ${res.persistence === "postgres" ? "ledger saved" : "local demo"}`,
                      });
                      setAdvanceOpen(false);
                    });
                  }}
                >
                  Issue from till
                </Button>
              </div>
            ) : null}
          </section>

          <section className="shrink-0 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
            <strong className="hos-section-label !m-0 flex items-center gap-1.5">
              <ListChecks className="size-3 text-[var(--hos-ink-3)]" strokeWidth={1.75} />
              Shift checklist
            </strong>
            <ul className="m-0 mt-2 list-none space-y-2 p-0 text-[12px] text-[var(--hos-ink-2)]">
              {[
                "Arrivals assigned",
                "VIP keycards",
                "Till float counted",
                "Immigration manifest",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="size-3.5 rounded border border-[var(--hos-line)]" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {shortcutsOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(15,23,42,0.55)] p-4 backdrop-blur-sm"
          role="dialog"
          aria-label="Keyboard shortcuts"
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            className="hos-surface-glass w-full max-w-md rounded-2xl border border-[var(--hos-glass-border)] p-5 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.55)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <strong className="text-sm text-[var(--hos-ink)]">
                Desk shortcuts
              </strong>
              <KeycapBadge keys="Esc" />
            </div>
            <ul className="m-0 grid list-none gap-2 p-0 text-[12px] text-[var(--hos-ink-2)]">
              {(
                [
                  ["J / K", "Next / previous boarding pass"],
                  ["C", "Check in (keycard encode)"],
                  ["O", "Check out focused stay"],
                  ["X", "Toggle batch select"],
                  ["⌘Z", "Undo last check-in (5s)"],
                  ["?", "Toggle this HUD"],
                  ["⌘B", "Fast Book"],
                  ["⌘K / ⌘J", "Command palette / Dispatcher"],
                ] as const
              ).map(([k, label]) => (
                <li
                  key={k}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2"
                >
                  <span>{label}</span>
                  <KeycapBadge keys={k} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
