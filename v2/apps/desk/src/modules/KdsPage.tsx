import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  KpiCard,
  ModuleFrame,
  StatusLegend,
  Odometer,
  useIsPhone,
  useIsTablet,
} from "@hos-v2/ui";
import { ChefHat, Printer, RotateCcw } from "lucide-react";
import {
  STATIONS,
  elapsedMs,
  formatElapsed,
  timerTone,
  useFnbStore,
  type KdsStation,
  type KotTicket,
} from "../lib/fnb-store";
import { KdsMobileView } from "./mobile/KdsMobileView";

function toneMeta(tone: "green" | "amber" | "red") {
  if (tone === "green") {
    return {
      ring: "border-[color-mix(in_srgb,var(--hos-emerald)_42%,var(--hos-line))]",
      timer:
        "bg-[color-mix(in_srgb,var(--hos-emerald)_14%,var(--hos-cell))] text-[var(--hos-emerald)]",
      bar: "bg-[var(--hos-emerald)]",
      glow: "",
    };
  }
  if (tone === "amber") {
    return {
      ring: "border-[color-mix(in_srgb,var(--hos-brass)_48%,var(--hos-line))]",
      timer:
        "bg-[color-mix(in_srgb,var(--hos-brass)_14%,var(--hos-cell))] text-[var(--hos-brass-ink)]",
      bar: "bg-[var(--hos-brass)]",
      glow: "",
    };
  }
  return {
    ring: "border-[color-mix(in_srgb,var(--hos-ruby)_52%,var(--hos-line))]",
    timer:
      "bg-[color-mix(in_srgb,var(--hos-ruby)_16%,var(--hos-cell))] text-[var(--hos-ruby)]",
    bar: "bg-[var(--hos-ruby)]",
    glow: "shadow-[0_0_28px_-10px_color-mix(in_srgb,var(--hos-ruby)_50%,transparent)]",
  };
}

function KotCard({
  kot,
  now,
  dense,
  onBump,
  onRecall,
  onPrint,
}: {
  kot: KotTicket;
  now: number;
  dense?: boolean;
  onBump: () => void;
  onRecall: () => void;
  onPrint: () => void;
}) {
  const reduce = useReducedMotion();
  const ms = elapsedMs(kot.createdAt, now);
  const tone = timerTone(ms);
  const styles = toneMeta(tone);
  const progress = Math.min(100, (ms / (20 * 60_000)) * 100);
  const station =
    STATIONS.find((s) => s.id === kot.station)?.label ?? kot.station;

  return (
    <motion.article
      layout
      initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
      className={`hos-cell flex flex-col border-2 p-3.5 ${styles.ring} ${styles.glow} ${
        dense ? "rounded-xl" : "rounded-2xl"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-xs font-bold text-[var(--hos-primary)]">
            {kot.ticketNo}
          </div>
          <div className="mt-0.5 truncate text-sm font-bold text-[var(--hos-ink)]">
            {kot.tableLabel}
            {kot.roomNumber ? ` · Rm ${kot.roomNumber}` : ""}
          </div>
          {kot.guestName ? (
            <div className="truncate text-[11px] text-[var(--hos-ink-3)]">
              {kot.guestName}
            </div>
          ) : null}
        </div>
        <div
          className={`shrink-0 rounded-xl px-2.5 py-1.5 font-mono text-sm font-black tabular-nums ${styles.timer}`}
        >
          {formatElapsed(ms)}
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--hos-ink)_8%,transparent)]">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${styles.bar}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="mt-3 m-0 flex-1 list-none space-y-1.5 p-0">
        {kot.lines.map((line, idx) => (
          <li
            key={`${line.menuItemId}-${idx}`}
            className="rounded-xl bg-[color-mix(in_srgb,var(--hos-primary)_7%,var(--hos-cell))] px-2.5 py-2 text-xs"
          >
            <div className="flex items-baseline justify-between gap-2">
              <strong className="text-[var(--hos-ink)]">{line.name}</strong>
              <span className="font-mono font-bold text-[var(--hos-primary)]">
                ×{line.qty}
              </span>
            </div>
            {line.note ? (
              <div className="mt-0.5 italic text-[var(--hos-brass-ink)]">
                Note: {line.note}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        {kot.status !== "bumped" ? (
          <motion.div
            className="min-w-[7rem] flex-1"
            whileTap={reduce ? undefined : { scale: 0.97 }}
          >
            <Button
              className={`hos-btn-ink w-full !rounded-xl ${dense ? "!min-h-11" : ""}`}
              size="sm"
              onClick={onBump}
            >
              Bump ready
            </Button>
          </motion.div>
        ) : (
          <motion.div
            className="min-w-[7rem] flex-1"
            whileTap={reduce ? undefined : { scale: 0.97 }}
          >
            <Button
              className={`w-full !rounded-xl ${dense ? "!min-h-11" : ""}`}
              size="sm"
              variant="secondary"
              onClick={onRecall}
            >
              <RotateCcw className="size-3.5" strokeWidth={2} />
              Recall
            </Button>
          </motion.div>
        )}
        <Button
          size="sm"
          variant="ghost"
          className={`!rounded-xl ${dense ? "!min-h-11 !min-w-11 !px-0" : ""}`}
          aria-label="Print ticket"
          onClick={onPrint}
        >
          <Printer className="size-3.5" strokeWidth={2} />
          {dense ? null : <span className="ml-1">Print</span>}
        </Button>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
        <span>{station}</span>
        <Badge
          tone={
            kot.status === "bumped"
              ? "success"
              : kot.status === "ready"
                ? "teal"
                : tone === "red"
                  ? "danger"
                  : "default"
          }
        >
          {kot.status === "bumped"
            ? "served"
            : tone === "red"
              ? "urgent"
              : kot.status}
        </Badge>
      </div>
    </motion.article>
  );
}

export function KdsPage() {
  const isPhone = useIsPhone();
  const isTablet = useIsTablet();
  const reduce = useReducedMotion();
  const [, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [showBumped, setShowBumped] = useState(false);

  const kots = useFnbStore((s) => s.kots);
  const menu = useFnbStore((s) => s.menu);
  const kdsStation = useFnbStore((s) => s.kdsStation);
  const setKdsStation = useFnbStore((s) => s.setKdsStation);
  const bumpKot = useFnbStore((s) => s.bumpKot);
  const recallKot = useFnbStore((s) => s.recallKot);
  const mark86 = useFnbStore((s) => s.mark86);
  const hydrateCatalog = useFnbStore((s) => s.hydrateCatalog);

  useEffect(() => {
    void hydrateCatalog();
  }, [hydrateCatalog]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const active = useMemo(() => {
    return kots
      .filter((k) => {
        if (kdsStation !== "all" && k.station !== kdsStation) return false;
        if (showBumped) return k.status === "bumped";
        return (
          k.status === "preparing" ||
          k.status === "ready" ||
          k.status === "queued"
        );
      })
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [kots, kdsStation, showBumped]);

  const openCount = kots.filter(
    (k) =>
      k.status === "preparing" ||
      k.status === "ready" ||
      k.status === "queued",
  ).length;
  const urgent = kots.filter(
    (k) =>
      (k.status === "preparing" || k.status === "ready") &&
      timerTone(elapsedMs(k.createdAt, now)) === "red",
  ).length;
  const amber = kots.filter(
    (k) =>
      (k.status === "preparing" || k.status === "ready") &&
      timerTone(elapsedMs(k.createdAt, now)) === "amber",
  ).length;
  const bumpedToday = kots.filter((k) => k.status === "bumped").length;

  const stationFilters: { id: KdsStation | "all"; label: string }[] = [
    { id: "all", label: "All stations" },
    ...STATIONS,
  ];

  if (isPhone) return <KdsMobileView />;

  const dense = isTablet;

  return (
    <ModuleFrame
      title="KDS Kitchen Pass"
      description="Bump · recall · 86 · light & midnight"
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusLegend
            dense
            className="hidden md:flex"
            items={[
              { id: "new", label: "New", swatch: "var(--hos-ruby)" },
              { id: "prep", label: "Prep", swatch: "var(--hos-brass)" },
              { id: "ready", label: "Ready", swatch: "var(--hos-emerald)" },
              { id: "bump", label: "Bumped", swatch: "var(--hos-ink-3)" },
            ]}
          />
          <Button
            size="sm"
            variant={showBumped ? "secondary" : "ghost"}
            className="!rounded-xl"
            onClick={() => setShowBumped((v) => !v)}
          >
            {showBumped ? "Show active" : "Show bumped"}
          </Button>
          <select
            className="hos-input !rounded-xl !py-1.5 !text-xs font-semibold"
            defaultValue=""
            aria-label="86 menu item"
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              const res = mark86(id, true);
              if (!res.ok) toast.error(res.error);
              else toast.message("Item 86'd — hidden on POS");
              e.target.value = "";
            }}
          >
            <option value="">86 menu item…</option>
            {menu.slice(0, 16).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ChefHat
                className="size-5 text-[var(--hos-primary)]"
                strokeWidth={2}
              />
              <h1 className="m-0 text-xl font-bold tracking-tight text-[var(--hos-ink)] md:text-2xl">
                Kitchen pass
              </h1>
              <Badge tone="muted">
                {dense ? "Tablet" : "Desk"} · theme aware
              </Badge>
            </div>
            <p className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
              Emerald &lt;10m · Brass 10–20m · Ruby urgent &gt;20m
            </p>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="hos-mobile-kpi-cell !min-h-[4.25rem] justify-center p-3">
            <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
              Open
            </span>
            <Odometer
              value={openCount}
              className="font-mono text-[1.2rem] font-black tabular-nums text-[var(--hos-ink)]"
            />
            <p className="m-0 text-[10px] text-[var(--hos-ink-3)]">On pass</p>
          </div>
          <KpiCard label="Amber" value={amber} delta="10–20 min" />
          <div
            className="hos-mobile-kpi-cell !min-h-[4.25rem] justify-center p-3"
            data-glow="ruby"
          >
            <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
              Urgent
            </span>
            <Odometer
              value={urgent}
              className="font-mono text-[1.2rem] font-black tabular-nums text-[var(--hos-ruby)]"
            />
            <p className="m-0 text-[10px] text-[var(--hos-ink-3)]">&gt;20 min</p>
          </div>
          <KpiCard label="Bumped" value={bumpedToday} delta="Served" />
        </div>

        <div className="no-print shrink-0 rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-1.5 shadow-[var(--hos-card-shadow)]">
          <div className="relative flex flex-wrap gap-1">
            {stationFilters.map((s) => {
              const activeStation = kdsStation === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setKdsStation(s.id)}
                  className={`hos-btn-tactile relative rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    dense ? "min-h-11" : ""
                  }`}
                >
                  {activeStation ? (
                    <motion.span
                      layoutId="kdsStationPill"
                      className="absolute inset-0 rounded-xl border border-[var(--hos-primary)] bg-[color-mix(in_srgb,var(--hos-primary)_14%,var(--hos-cell))]"
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 500, damping: 35 }
                      }
                    />
                  ) : null}
                  <span
                    className={`relative z-10 ${
                      activeStation
                        ? "text-[var(--hos-primary)]"
                        : "text-[var(--hos-ink-2)]"
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="hos-scrollbar-slim min-h-0 flex-1 overflow-y-auto">
          {active.length === 0 ? (
            <EmptyState
              title={showBumped ? "No bumped tickets yet" : "Pass is clear"}
              description={
                showBumped
                  ? "Bump a preparing ticket to see it here."
                  : "Fire a KOT from POS Till to populate this station."
              }
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  className="!rounded-xl"
                  onClick={() => setShowBumped(false)}
                >
                  View active
                </Button>
              }
            />
          ) : (
            <div
              className={`grid gap-3 ${
                dense
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
              }`}
            >
              <AnimatePresence mode="popLayout">
                {active.map((kot) => (
                  <KotCard
                    key={kot.id}
                    kot={kot}
                    now={now}
                    dense={dense}
                    onBump={() => {
                      start(() => {
                        void bumpKot(kot.id).then((res) => {
                          if (!res.ok) toast.error(res.error);
                          else {
                            toast.success(`${kot.ticketNo} bumped ready`, {
                              description:
                                "Runner notified · ESC/POS bump slip queued",
                            });
                          }
                        });
                      });
                    }}
                    onRecall={() => {
                      start(() => {
                        void recallKot(kot.id).then((res) => {
                          if (!res.ok) toast.error(res.error);
                          else
                            toast.message(`${kot.ticketNo} recalled to pass`);
                        });
                      });
                    }}
                    onPrint={() => {
                      toast.success(`Printing ${kot.ticketNo}`, {
                        description: `${kot.station.toUpperCase()} · ${kot.lines.length} lines · silent ESC/POS`,
                      });
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="shrink-0 rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5">
          <strong className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
            Timer legend
          </strong>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--hos-emerald)_14%,var(--hos-cell))] px-2.5 py-1 font-semibold text-[var(--hos-emerald)]">
              <span className="size-2 rounded-full bg-[var(--hos-emerald)]" />
              &lt; 10 min
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--hos-brass)_14%,var(--hos-cell))] px-2.5 py-1 font-semibold text-[var(--hos-brass-ink)]">
              <span className="size-2 rounded-full bg-[var(--hos-brass)]" />
              10–20 min
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--hos-ruby)_14%,var(--hos-cell))] px-2.5 py-1 font-semibold text-[var(--hos-ruby)]">
              <span className="size-2 rounded-full bg-[var(--hos-ruby)]" />
              &gt; 20 min urgent
            </span>
          </div>
        </div>
      </div>
    </ModuleFrame>
  );
}
