"use client";

import { updateOrderKotStatus } from "@/app/actions/erp-pos";
import { Button } from "@/components/ui/button";
import { useKotNotifier } from "@/hooks/use-kot-notifier";
import type { OpenPosTicket } from "@/lib/pos";
import {
  KOT_BOARD_COLUMNS,
  KOT_LABEL,
  prepStationLabel,
  sortPrepStations,
} from "@/lib/kot";
import {
  AlertTriangleIcon,
  CheckIcon,
  ClockIcon,
  MaximizeIcon,
  MinimizeIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

/**
 * Kitchen Display System (KDS) board — runs fullscreen on a wall TV wired to
 * a mini-PC / laptop / tablet via HDMI.
 *
 * Three columns (New → Preparing → Ready) mirroring the canonical KOT flow.
 * Each card groups items by prep_station so the right station picks the right
 * work. A Web Audio chime fires on every board change (new ticket, status
 * advance, void) so the kitchen hears it even when not looking. The page
 * auto-refreshes its data on version change and ticks elapsed timers every
 * second.
 *
 * Auth/layout: this route bypasses the DeskShell (see `erp/layout.tsx`) so the
 * TV gets a clean surface. The page handler still requires desk auth.
 */
export function KitchenDisplayBoard({
  tickets,
  propertyName,
}: {
  tickets: OpenPosTicket[];
  propertyName: string;
}) {
  const router = useRouter();
  const {
    status,
    muted,
    toggleMute,
    testSound,
    lastChangedAt,
  } = useKotNotifier({ intervalMs: 4000 });

  const [fs, setFs] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Tick "Xm ago" labels every 15s — cheap, no re-render storms.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  // Enter native fullscreen on the TV.
  useEffect(() => {
    if (fs) {
      const el = document.documentElement;
      const anyEl = el as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      const req =
        el.requestFullscreen?.bind(el) ??
        anyEl.webkitRequestFullscreen?.bind(anyEl);
      req?.().catch(() => {});
      return () => {
        if (document.fullscreenElement) {
          (document.exitFullscreen ?? (document as Document & {
            webkitExitFullscreen?: () => Promise<void>;
          }).webkitExitFullscreen)?.().catch(() => {});
        }
      };
    }
    return;
  }, [fs]);

  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement && fs) setFs(false);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [fs]);

  const columns = useMemo(() => {
    const map: Record<string, OpenPosTicket[]> = {
      new: [],
      preparing: [],
      ready: [],
    };
    for (const t of tickets) {
      // Skip pending-confirm public orders — kitchen shouldn't fire on those.
      if (t.order_source === "public" && !t.confirmed_at) continue;
      if (t.kot_status in map) {
        map[t.kot_status].push(t);
      }
    }
    // Sort each column oldest first (longest-waiting at top).
    for (const col of KOT_BOARD_COLUMNS) {
      map[col].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    }
    return map;
  }, [tickets]);

  const counts = useMemo(
    () => ({
      new: columns.new.length,
      preparing: columns.preparing.length,
      ready: columns.ready.length,
    }),
    [columns],
  );

  function advance(orderId: string, nextStatus: string) {
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("kot_status", nextStatus);
    startTransition(async () => {
      await updateOrderKotStatus(fd);
      startTransition(() => router.refresh());
    });
  }

  const offline = status === "offline";
  const updatedSecondsAgo = Math.max(
    0,
    Math.round((now - lastChangedAt) / 1000),
  );

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Header — large, readable from across the kitchen. */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <p className="text-base font-semibold tracking-tight md:text-lg">
            {propertyName}
            <span className="ml-2 text-[11px] font-medium tracking-[0.2em] text-accent uppercase">
              Kitchen
            </span>
          </p>
          <StatusPill offline={offline} updatedSecondsAgo={updatedSecondsAgo} />
        </div>
        <div className="flex items-center gap-2">
          <ColumnCountBadges counts={counts} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10"
            onClick={testSound}
            title="Test sound"
          >
            <Volume2Icon className="size-4" />
            <span className="hidden text-xs sm:inline">Test</span>
          </Button>
          <Button
            type="button"
            variant={muted ? "outline" : "citrus"}
            size="sm"
            className="h-10"
            onClick={toggleMute}
            aria-pressed={!muted}
            title={muted ? "Unmute alerts" : "Mute alerts"}
          >
            {muted ? (
              <VolumeXIcon className="size-4" />
            ) : (
              <Volume2Icon className="size-4" />
            )}
            <span className="hidden text-xs sm:inline">
              {muted ? "Muted" : "Sound on"}
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10"
            onClick={() => setFs((v) => !v)}
            aria-pressed={fs}
            title={fs ? "Exit fullscreen" : "Fullscreen"}
          >
            {fs ? (
              <MinimizeIcon className="size-4" />
            ) : (
              <MaximizeIcon className="size-4" />
            )}
          </Button>
        </div>
      </header>

      {/* Board — three columns, fill viewport height, scroll per column. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 md:grid-cols-3 md:p-4">
        {KOT_BOARD_COLUMNS.map((col) => (
          <Column
            key={col}
            status={col}
            tickets={columns[col]}
            now={now}
            onAdvance={advance}
          />
        ))}
      </div>
    </div>
  );
}

function StatusPill({
  offline,
  updatedSecondsAgo,
}: {
  offline: boolean;
  updatedSecondsAgo: number;
}) {
  if (offline) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
        <AlertTriangleIcon className="size-3.5" />
        Board offline
      </span>
    );
  }
  const fresh = updatedSecondsAgo < 10;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
      <span
        className={`size-2 rounded-full ${
          fresh ? "bg-accent" : "bg-accent/50"
        }`}
      />
      Live · updated {updatedSecondsAgo}s ago
    </span>
  );
}

function ColumnCountBadges({
  counts,
}: {
  counts: { new: number; preparing: number; ready: number };
}) {
  return (
    <div className="hidden items-center gap-1.5 md:flex">
      <CountBadge label="New" value={counts.new} tone="secondary" />
      <CountBadge label="Cooking" value={counts.preparing} tone="accent" />
      <CountBadge label="Ready" value={counts.ready} tone="gold" />
    </div>
  );
}

function CountBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "secondary" | "accent" | "gold";
}) {
  const toneClass =
    tone === "accent"
      ? "border-accent/30 bg-accent/10 text-accent"
      : tone === "gold"
        ? "border-gold/40 bg-gold/10 text-gold"
        : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}
    >
      <span className="tabular-nums">{value}</span>
      <span>{label}</span>
    </span>
  );
}

function Column({
  status,
  tickets,
  now,
  onAdvance,
}: {
  status: string;
  tickets: OpenPosTicket[];
  now: number;
  onAdvance: (orderId: string, nextStatus: string) => void;
}) {
  const headerTone =
    status === "new"
      ? "border-border bg-muted/40 text-muted-foreground"
      : status === "preparing"
        ? "border-accent/30 bg-accent/10 text-accent"
        : "border-gold/40 bg-gold/10 text-gold";
  const nextStatus =
    status === "new" ? "preparing" : status === "preparing" ? "ready" : null;
  const nextLabel =
    nextStatus === "preparing" ? "Start cooking" : "Mark ready";

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-border/60 bg-card/60">
      <header
        className={`flex items-center justify-between gap-2 rounded-t-xl border-b px-4 py-2.5 ${headerTone}`}
      >
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          {KOT_LABEL[status]}
        </h2>
        <span className="text-lg font-bold tabular-nums">{tickets.length}</span>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {tickets.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Nothing here.
          </p>
        ) : (
          tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              now={now}
              nextStatus={nextStatus}
              nextLabel={nextLabel}
              isReady={status === "ready"}
              onAdvance={onAdvance}
            />
          ))
        )}
      </div>
    </section>
  );
}

function TicketCard({
  ticket,
  now,
  nextStatus,
  nextLabel,
  isReady,
  onAdvance,
}: {
  ticket: OpenPosTicket;
  now: number;
  nextStatus: string | null;
  nextLabel: string | null;
  isReady: boolean;
  onAdvance: (orderId: string, nextStatus: string) => void;
}) {
  const createdMs = new Date(ticket.created_at).getTime();
  const elapsedMin = Math.max(0, Math.floor((now - createdMs) / 60_000));
  // Red tint after 12 minutes — calls attention to tickets that are dragging.
  const slow = elapsedMin >= 12;

  // Group lines by prep_station inside this single ticket.
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; course_no: number }[]>();
    for (const item of ticket.order_items) {
      const station = item.prep_station || "kitchen";
      const list = map.get(station) ?? [];
      list.push({
        name: item.name_snapshot,
        qty: item.qty,
        course_no: item.course_no,
      });
      map.set(station, list);
    }
    return sortPrepStations([...map.keys()]).map((station) => ({
      station,
      label: prepStationLabel(station),
      lines: map.get(station) ?? [],
    }));
  }, [ticket.order_items]);

  const mixed = groups.length > 1;
  const isOnline = ticket.order_source === "public";

  return (
    <article
      className={`rounded-lg border p-3 ${
        isReady
          ? "border-gold/50 bg-gold/5"
          : slow
            ? "border-destructive/40 bg-destructive/5"
            : "border-border bg-card"
      }`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {ticket.customer_name || "Walk-in"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            <span className="font-mono">{ticket.id.slice(0, 6)}</span>
            {ticket.table_id ? ` · ${ticket.table_id.slice(0, 6)}` : ""}
            {ticket.covers ? ` · ${ticket.covers}pax` : ""}
            {isOnline
              ? ticket.delivery_type === "taxi"
                ? ` · taxi · ${ticket.delivery_area ?? "Thimphu"}`
                : " · pickup"
              : ""}
          </p>
        </div>
        <ElapsedPill minutes={elapsedMin} slow={slow} />
      </header>

      <div className="mt-3 space-y-2">
        {groups.map((g) => (
          <div key={g.station} className="space-y-1">
            {mixed ? (
              <p className="text-[10px] font-bold uppercase tracking-wide text-accent">
                {g.label}
              </p>
            ) : null}
            <ul className="space-y-0.5 text-sm text-foreground">
              {g.lines.map((line, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="text-base font-bold tabular-nums text-foreground">
                    {line.qty}×
                  </span>
                  <span className="flex-1">{line.name}</span>
                  {line.course_no > 1 ? (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      c{line.course_no}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {nextStatus && nextLabel ? (
        <button
          type="button"
          onClick={() => onAdvance(ticket.id, nextStatus)}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          {nextStatus === "ready" ? (
            <CheckIcon className="size-4" />
          ) : (
            <ClockIcon className="size-4" />
          )}
          {nextLabel}
        </button>
      ) : isReady ? (
        <button
          type="button"
          onClick={() => onAdvance(ticket.id, "served")}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-gold/50 bg-gold/10 text-sm font-semibold text-gold transition-colors hover:bg-gold/20"
        >
          <CheckIcon className="size-4" />
          Mark served
        </button>
      ) : null}
    </article>
  );
}

function ElapsedPill({ minutes, slow }: { minutes: number; slow: boolean }) {
  const label = minutes < 1 ? "now" : minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h${minutes % 60}m`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
        slow
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      <ClockIcon className="size-3" />
      {label}
    </span>
  );
}
