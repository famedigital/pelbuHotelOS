import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  Odometer,
  springPress,
  springSoft,
} from "@hos-v2/ui";
import {
  ChefHat,
  Printer,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import {
  STATIONS,
  elapsedMs,
  formatElapsed,
  timerTone,
  useFnbStore,
  type KdsStation,
  type KotTicket,
} from "../../lib/fnb-store";

function toneMeta(tone: "green" | "amber" | "red") {
  if (tone === "green") {
    return {
      ring: "border-[color-mix(in_srgb,var(--hos-emerald)_45%,var(--hos-line))]",
      timer:
        "bg-[color-mix(in_srgb,var(--hos-emerald)_16%,var(--hos-cell))] text-[var(--hos-emerald)]",
      bar: "bg-[var(--hos-emerald)]",
      glow: undefined as string | undefined,
    };
  }
  if (tone === "amber") {
    return {
      ring: "border-[color-mix(in_srgb,var(--hos-brass)_50%,var(--hos-line))]",
      timer:
        "bg-[color-mix(in_srgb,var(--hos-brass)_16%,var(--hos-cell))] text-[var(--hos-brass-ink)]",
      bar: "bg-[var(--hos-brass)]",
      glow: undefined,
    };
  }
  return {
    ring: "border-[color-mix(in_srgb,var(--hos-ruby)_55%,var(--hos-line))]",
    timer:
      "bg-[color-mix(in_srgb,var(--hos-ruby)_18%,var(--hos-cell))] text-[var(--hos-ruby)]",
    bar: "bg-[var(--hos-ruby)]",
    glow: "shadow-[0_0_28px_-10px_color-mix(in_srgb,var(--hos-ruby)_55%,transparent)]",
  };
}

function MobileKotCard({
  kot,
  now,
  onBump,
  onRecall,
  onPrint,
}: {
  kot: KotTicket;
  now: number;
  onBump: () => void;
  onRecall: () => void;
  onPrint: () => void;
}) {
  const reduce = useReducedMotion();
  const ms = elapsedMs(kot.createdAt, now);
  const tone = timerTone(ms);
  const styles = toneMeta(tone);
  const progress = Math.min(100, (ms / (20 * 60_000)) * 100);
  const station = STATIONS.find((s) => s.id === kot.station)?.label ?? kot.station;

  return (
    <motion.article
      layout
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.97 }}
      className={`hos-mobile-pass hos-butter-card !gap-3 border-2 ${styles.ring} ${styles.glow ?? ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[11px] font-bold text-[var(--hos-primary)]">
            {kot.ticketNo}
          </div>
          <div className="truncate text-[15px] font-black text-[var(--hos-ink)]">
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
          className={`shrink-0 rounded-xl px-2.5 py-1.5 font-mono text-[15px] font-black tabular-nums ${styles.timer}`}
        >
          {formatElapsed(ms)}
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--hos-ink)_8%,transparent)]">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${styles.bar}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="m-0 list-none space-y-1.5 p-0">
        {kot.lines.map((line, idx) => (
          <li
            key={`${line.menuItemId}-${idx}`}
            className="rounded-xl bg-[color-mix(in_srgb,var(--hos-ink)_5%,var(--hos-cell))] px-3 py-2.5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <strong className="text-[14px] text-[var(--hos-ink)]">{line.name}</strong>
              <span className="font-mono text-[13px] font-black text-[var(--hos-primary)]">
                ×{line.qty}
              </span>
            </div>
            {line.note ? (
              <div className="mt-0.5 text-[12px] italic text-[var(--hos-brass-ink)]">
                Note: {line.note}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-[var(--hos-ink-3)]">
        <span>{station}</span>
        <Badge
          tone={
            kot.status === "bumped"
              ? "success"
              : tone === "red"
                ? "danger"
                : "default"
          }
        >
          {kot.status === "bumped" ? "served" : tone === "red" ? "urgent" : kot.status}
        </Badge>
      </div>

      <div className="flex gap-2">
        {kot.status !== "bumped" ? (
          <motion.div
            className="flex-1"
            whileTap={reduce ? undefined : { scale: 0.97, transition: springPress }}
          >
            <Button
              size="sm"
              className="hos-btn-ink !min-h-12 w-full !rounded-xl text-[14px] font-bold"
              onClick={onBump}
            >
              Bump ready
            </Button>
          </motion.div>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="!min-h-12 flex-1 !rounded-xl"
            onClick={onRecall}
          >
            <RotateCcw className="size-3.5" strokeWidth={2} />
            Recall
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="!min-h-12 !min-w-12 !rounded-xl !px-0"
          aria-label="Print ticket"
          onClick={onPrint}
        >
          <Printer className="size-4" strokeWidth={2} />
        </Button>
      </div>
    </motion.article>
  );
}

/** Phone / compact tablet KDS — touch-first bump pass. */
export function KdsMobileView() {
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
        return k.status === "preparing" || k.status === "ready" || k.status === "queued";
      })
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [kots, kdsStation, showBumped]);

  const openCount = kots.filter(
    (k) => k.status === "preparing" || k.status === "ready" || k.status === "queued",
  ).length;
  const urgent = kots.filter(
    (k) =>
      (k.status === "preparing" || k.status === "ready") &&
      timerTone(elapsedMs(k.createdAt, now)) === "red",
  ).length;

  const stationFilters: { id: KdsStation | "all"; label: string }[] = [
    { id: "all", label: "All" },
    ...STATIONS.map((s) => ({ id: s.id, label: s.label.split(" ")[0] ?? s.label })),
  ];

  return (
    <div className="hos-mobile-page !gap-2.5">
      <motion.div
        className="hos-mobile-hero"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSoft}
      >
        <div className="min-w-0">
          <h1 className="hos-mobile-hero-title flex items-center gap-2">
            <ChefHat className="size-5 text-[var(--hos-primary)]" strokeWidth={2} />
            Kitchen pass
          </h1>
          <p className="hos-mobile-hero-meta">
            {showBumped ? "Bumped / served" : "Active tickets"} · bump · recall · 86
          </p>
        </div>
        <Button
          size="sm"
          variant={showBumped ? "secondary" : "ghost"}
          className="hos-btn-tactile !min-h-10 shrink-0 !rounded-xl"
          onClick={() => setShowBumped((v) => !v)}
        >
          {showBumped ? "Active" : "Bumped"}
        </Button>
      </motion.div>

      <div className="hos-mobile-kpi-grid !grid-cols-2">
        <div className="hos-mobile-kpi-cell" data-glow="sapphire">
          <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
            Open
          </span>
          <Odometer
            value={openCount}
            className="mt-0.5 font-mono text-[1.25rem] font-black tabular-nums text-[var(--hos-ink)]"
          />
        </div>
        <div className="hos-mobile-kpi-cell" data-glow="ruby">
          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
            <TriangleAlert className="size-3" strokeWidth={2.5} />
            Urgent
          </span>
          <Odometer
            value={urgent}
            className="mt-0.5 font-mono text-[1.25rem] font-black tabular-nums text-[var(--hos-ruby)]"
          />
        </div>
      </div>

      <div className="hos-mobile-segment-rail -mx-1 px-1">
        {stationFilters.map((s) => (
          <motion.button
            key={s.id}
            type="button"
            data-active={kdsStation === s.id ? "true" : undefined}
            onClick={() => setKdsStation(s.id)}
            whileTap={reduce ? undefined : { scale: 0.96, transition: springPress }}
            className="hos-mobile-segment"
          >
            {s.label}
          </motion.button>
        ))}
      </div>

      <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[var(--hos-ink-3)]">
        86 menu item
        <select
          className="hos-input !min-h-11 !rounded-xl !text-[14px]"
          defaultValue=""
          onChange={(e) => {
            const id = e.target.value;
            if (!id) return;
            const res = mark86(id, true);
            if (!res.ok) toast.error(res.error);
            else toast.message("Item 86'd — hidden on POS");
            e.target.value = "";
          }}
        >
          <option value="">Select item…</option>
          {menu.slice(0, 16).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
        <span className="rounded-full bg-[color-mix(in_srgb,var(--hos-emerald)_14%,var(--hos-cell))] px-2 py-1 text-[var(--hos-emerald)]">
          &lt;10m
        </span>
        <span className="rounded-full bg-[color-mix(in_srgb,var(--hos-brass)_14%,var(--hos-cell))] px-2 py-1 text-[var(--hos-brass-ink)]">
          10–20m
        </span>
        <span className="rounded-full bg-[color-mix(in_srgb,var(--hos-ruby)_14%,var(--hos-cell))] px-2 py-1 text-[var(--hos-ruby)]">
          &gt;20m urgent
        </span>
      </div>

      {active.length === 0 ? (
        <EmptyState
          title={showBumped ? "No bumped tickets" : "Pass is clear"}
          description={
            showBumped
              ? "Bump a preparing ticket to see it here."
              : "Fire a KOT from POS to populate this station."
          }
          action={
            showBumped ? (
              <Button size="sm" variant="secondary" onClick={() => setShowBumped(false)}>
                View active
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
          <AnimatePresence mode="popLayout">
            {active.map((kot) => (
              <MobileKotCard
                key={kot.id}
                kot={kot}
                now={now}
                onBump={() => {
                  start(() => {
                    void bumpKot(kot.id).then((res) => {
                      if (!res.ok) toast.error(res.error);
                      else
                        toast.success(`${kot.ticketNo} bumped`, {
                          description: "Runner notified",
                        });
                    });
                  });
                }}
                onRecall={() => {
                  start(() => {
                    void recallKot(kot.id).then((res) => {
                      if (!res.ok) toast.error(res.error);
                      else toast.message(`${kot.ticketNo} recalled`);
                    });
                  });
                }}
                onPrint={() => {
                  toast.success(`Printing ${kot.ticketNo}`, {
                    description: `${kot.station.toUpperCase()} · ${kot.lines.length} lines`,
                  });
                }}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
