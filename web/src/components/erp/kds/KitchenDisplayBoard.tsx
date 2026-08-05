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
import Link from "next/link";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";

export type KdsRole = "kitchen" | "pass";

/**
 * Kitchen Display (cook line) or Pass/Expo Display (F&B service).
 * Board data: fetch on Supabase-driven SSE events (via useKotNotifier),
 * not a 1.5s Vercel poll. Safety re-sync is 60s / tab focus.
 */
export function KitchenDisplayBoard({
  initialTickets,
  propertyName,
  role = "kitchen",
}: {
  initialTickets: OpenPosTicket[];
  propertyName: string;
  role?: KdsRole;
}) {
  const isPass = role === "pass";
  const {
    status,
    muted,
    armed,
    armAudio,
    toggleMute,
    testSound,
    lastChangedAt,
    refresh,
  } = useKotNotifier({
    safetyPollMs: 60_000,
    speak: true,
    preferReadyAlert: isPass,
  });

  const [tickets, setTickets] = useState<OpenPosTicket[]>(initialTickets);
  const [fetchError, setFetchError] = useState(false);
  const [fs, setFs] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [advancing, setAdvancing] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/erp/kot-board", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) {
        setFetchError(true);
        return;
      }
      const data = (await res.json()) as { tickets?: OpenPosTicket[] };
      setTickets(data.tickets ?? []);
      setFetchError(false);
    } catch {
      setFetchError(true);
    }
  }, []);

  // Push-driven: notifier bumps lastChangedAt on SSE `kot` + safety poll.
  useEffect(() => {
    void fetchBoard();
  }, [lastChangedAt, fetchBoard]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!fs) return;
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
        (
          document.exitFullscreen ??
          (document as Document & {
            webkitExitFullscreen?: () => Promise<void>;
          }).webkitExitFullscreen
        )
          ?.()
          .catch(() => {});
      }
    };
  }, [fs]);

  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement && fs) setFs(false);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [fs]);

  const columnMap = useMemo(() => {
    const map: Record<string, OpenPosTicket[]> = {
      new: [],
      preparing: [],
      ready: [],
    };
    /** Cook line: kitchen / grill / cold / pastry. Bar items stay off /erp/kds. */
    const COOK_STATIONS = new Set(["kitchen", "grill", "cold", "pastry"]);

    for (const raw of tickets) {
      if (
        raw.order_source === "public" &&
        (!raw.confirmed_at || !raw.payment_recorded_at)
      ) {
        continue;
      }

      let t = raw;
      // Kitchen TV only shows dishes prepared on the cook line. Pass sees full
      // tickets so expo can plate + serve everything ordered.
      if (!isPass) {
        const cookLines = raw.order_items.filter((item) =>
          COOK_STATIONS.has(item.prep_station || "kitchen"),
        );
        if (cookLines.length === 0) continue;
        t = { ...raw, order_items: cookLines };
      }

      if (t.kot_status in map) {
        map[t.kot_status].push(t);
      }
    }
    for (const col of KOT_BOARD_COLUMNS) {
      map[col].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    }
    return map;
  }, [tickets, isPass]);

  const counts = useMemo(
    () => ({
      new: columnMap.new.length,
      preparing: columnMap.preparing.length,
      ready: columnMap.ready.length,
    }),
    [columnMap],
  );

  function advance(orderId: string, nextStatus: string) {
    setAdvancing(orderId);
    // Optimistic local move; SSE will re-sync peers.
    setTickets((prev) =>
      prev.map((t) =>
        t.id === orderId ? { ...t, kot_status: nextStatus } : t,
      ),
    );
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("kot_status", nextStatus);
    startTransition(async () => {
      try {
        await updateOrderKotStatus(fd);
        void fetchBoard();
        refresh();
      } catch {
        void fetchBoard();
      } finally {
        setAdvancing(null);
      }
    });
  }

  const offline = status === "offline" || fetchError;
  const updatedSecondsAgo = Math.max(
    0,
    Math.round((now - lastChangedAt) / 1000),
  );

  const columnsToShow = isPass
    ? (["ready"] as const)
    : KOT_BOARD_COLUMNS;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {!armed && (
        <div className="z-50 flex items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500 px-4 py-3 text-amber-950">
          <p className="text-sm font-semibold sm:text-base">
            Tap to enable loud kitchen alarms + voice. Browsers block sound until
            you click.
          </p>
          <Button
            type="button"
            size="lg"
            className="h-12 shrink-0 bg-background text-foreground hover:bg-background/90"
            onClick={armAudio}
          >
            <Volume2Icon className="size-5" />
            Enable loud sound
          </Button>
        </div>
      )}

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 md:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <p className="text-base font-semibold tracking-tight md:text-lg">
            {propertyName}
            <span className="ml-2 text-[11px] font-medium tracking-[0.2em] text-accent uppercase">
              {isPass ? "Pass / Expo" : "Kitchen"}
            </span>
          </p>
          <StatusPill offline={offline} updatedSecondsAgo={updatedSecondsAgo} />
          {!isPass ? (
            <Link
              href="/erp/kds/pass"
              className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Open Pass screen
            </Link>
          ) : (
            <Link
              href="/erp/kds"
              className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Open Kitchen TV
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ColumnCountBadges counts={counts} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11"
            onClick={testSound}
            title="Test loud alarm"
          >
            <Volume2Icon className="size-4" />
            <span className="hidden text-xs sm:inline">Test loud</span>
          </Button>
          <Button
            type="button"
            variant={muted ? "outline" : "citrus"}
            size="sm"
            className="h-11"
            onClick={toggleMute}
            aria-pressed={!muted}
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
            className="h-11"
            onClick={() => setFs((v) => !v)}
            aria-pressed={fs}
          >
            {fs ? (
              <MinimizeIcon className="size-4" />
            ) : (
              <MaximizeIcon className="size-4" />
            )}
          </Button>
        </div>
      </header>

      {isPass && (
        <p className="border-b bg-gold/10 px-4 py-2 text-center text-sm text-foreground md:px-6">
          Service screen — only tickets kitchen marked <strong>Ready</strong>.
          Tap <strong>Mark served</strong> when food leaves the pass.
        </p>
      )}

      <div
        className={`grid min-h-0 flex-1 gap-3 p-3 md:p-4 ${
          isPass ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"
        }`}
      >
        {columnsToShow.map((col) => (
          <Column
            key={col}
            status={col}
            tickets={columnMap[col]}
            now={now}
            isPass={isPass}
            advancingId={advancing}
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
  const fresh = updatedSecondsAgo < 5;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
      <span
        className={`size-2 rounded-full ${
          fresh ? "animate-pulse bg-accent" : "bg-accent/50"
        }`}
      />
      Live · {updatedSecondsAgo}s
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
  isPass,
  advancingId,
  onAdvance,
}: {
  status: string;
  tickets: OpenPosTicket[];
  now: number;
  isPass: boolean;
  advancingId: string | null;
  onAdvance: (orderId: string, nextStatus: string) => void;
}) {
  const headerTone =
    status === "new"
      ? "border-border bg-muted/40 text-muted-foreground"
      : status === "preparing"
        ? "border-accent/30 bg-accent/10 text-accent"
        : "border-gold/40 bg-gold/10 text-gold";

  // Kitchen: new → prepare → ready. Pass: ready → served.
  // Kitchen must NOT mark served (that's the expo/pass job).
  const nextStatus =
    isPass && status === "ready"
      ? "served"
      : !isPass && status === "new"
        ? "preparing"
        : !isPass && status === "preparing"
          ? "ready"
          : null;
  const nextLabel =
    nextStatus === "preparing"
      ? "Start cooking"
      : nextStatus === "ready"
        ? "Mark ready"
        : nextStatus === "served"
          ? "Mark served"
          : null;

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-border/60 bg-card/60">
      <header
        className={`flex items-center justify-between gap-2 rounded-t-xl border-b px-4 py-2.5 ${headerTone}`}
      >
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          {isPass ? "Ready for service" : KOT_LABEL[status]}
        </h2>
        <span className="text-lg font-bold tabular-nums">{tickets.length}</span>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {tickets.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            {isPass ? "Nothing waiting at the pass." : "Nothing here."}
          </p>
        ) : (
          tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              now={now}
              nextStatus={nextStatus}
              nextLabel={nextLabel}
              busy={advancingId === t.id}
              bigServe={isPass}
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
  busy,
  bigServe,
  onAdvance,
}: {
  ticket: OpenPosTicket;
  now: number;
  nextStatus: string | null;
  nextLabel: string | null;
  busy: boolean;
  bigServe: boolean;
  onAdvance: (orderId: string, nextStatus: string) => void;
}) {
  const createdMs = new Date(ticket.created_at).getTime();
  const elapsedMin = Math.max(0, Math.floor((now - createdMs) / 60_000));
  const slow = elapsedMin >= 12;

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { name: string; qty: number; course_no: number }[]
    >();
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
        bigServe
          ? "border-gold/50 bg-gold/5"
          : slow
            ? "border-destructive/40 bg-destructive/5"
            : "border-border bg-card"
      }`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground sm:text-lg">
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
              <p className="text-[10px] font-bold tracking-wide text-accent uppercase">
                {g.label}
              </p>
            ) : null}
            <ul className="space-y-0.5 text-sm text-foreground sm:text-base">
              {g.lines.map((line, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="text-base font-bold tabular-nums sm:text-lg">
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
          disabled={busy}
          onClick={() => onAdvance(ticket.id, nextStatus)}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-md text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 ${
            bigServe
              ? "h-14 bg-gold text-base text-background"
              : "h-11 bg-accent text-accent-foreground"
          }`}
        >
          {nextStatus === "ready" || nextStatus === "served" ? (
            <CheckIcon className="size-5" />
          ) : (
            <ClockIcon className="size-4" />
          )}
          {busy ? "Updating…" : nextLabel}
        </button>
      ) : null}
    </article>
  );
}

function ElapsedPill({ minutes, slow }: { minutes: number; slow: boolean }) {
  const label =
    minutes < 1
      ? "now"
      : minutes < 60
        ? `${minutes}m`
        : `${Math.floor(minutes / 60)}h${minutes % 60}m`;
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
