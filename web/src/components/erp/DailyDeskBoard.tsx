"use client";

import { fetchDailyDeskSnapshot } from "@/app/actions/desk-read-loaders";
import { AgentFollowupPanel } from "@/components/erp/AgentFollowupPanel";
import { DailyStayTable } from "@/components/erp/DailyStayTable";
import { FoTodayWorklist } from "@/components/erp/FoTodayWorklist";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DailyDeskSnapshot } from "@/lib/erp/daily-desk";
import { cn } from "@/lib/utils";
import {
  CalendarClockIcon,
  ClipboardListIcon,
  PackageIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

function CountChip({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: "default" | "warn" | "ok";
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-w-[5.5rem] rounded-xl border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-accent/50 bg-accent/10"
          : "border-border bg-card hover:border-accent/30 hover:bg-muted/40",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-2xl font-semibold tabular-nums tracking-tight",
          tone === "warn" && value > 0
            ? "text-destructive"
            : tone === "ok"
              ? "text-citrus"
              : "text-foreground",
        )}
      >
        {value}
      </p>
    </button>
  );
}

/** Daily FO home: CI / CO / in-house boards + agent pay follow-up + rota/stores. */
export function DailyDeskBoard({ initial }: { initial: DailyDeskSnapshot }) {
  const [snap, setSnap] = useState(initial);
  const [tab, setTab] = useState("arrivals");

  const onInvalidate = useCallback(async () => {
    const result = await fetchDailyDeskSnapshot();
    if (!result.ok) throw new Error(result.error);
    setSnap(result.data);
  }, []);

  const arrivals = snap.dayOps.arrivals;
  const departures = snap.dayOps.departures;
  const inHouse = snap.dayOps.inHouse;
  const actionCount = snap.actions.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          One screen for today&apos;s stays — no Ctrl+K hunt for lists.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <FrontDeskLiveRefresh onInvalidate={onInvalidate} />
          <Link
            href="/erp/calendar"
            className="text-sm text-accent underline-offset-4 hover:underline"
          >
            Stay View
          </Link>
        </div>
      </div>

      {snap.nightAuditStale ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
          <p className="text-sm text-foreground">
            Working date is still{" "}
            <span className="font-medium tabular-nums">{snap.businessDate}</span>
            . Close the prior day before new check-ins.
          </p>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/erp/night-audit">Night Audit</Link>
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <CountChip
          label="Check-in"
          value={arrivals.length}
          active={tab === "arrivals"}
          onClick={() => setTab("arrivals")}
        />
        <CountChip
          label="Check-out"
          value={departures.length}
          active={tab === "departures"}
          onClick={() => setTab("departures")}
        />
        <CountChip
          label="In-house"
          value={inHouse.length}
          tone="ok"
          active={tab === "in_house"}
          onClick={() => setTab("in_house")}
        />
        <CountChip
          label="Pay follow-up"
          value={snap.agentUnpaidCount}
          tone="warn"
          active={tab === "agents"}
          onClick={() => setTab("agents")}
        />
        {actionCount > 0 ? (
          <CountChip
            label="Do next"
            value={actionCount}
            active={tab === "actions"}
            onClick={() => setTab("actions")}
          />
        ) : null}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-3">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4 lg:w-fit lg:grid-cols-5">
          <TabsTrigger value="arrivals" className="gap-1.5 py-2">
            Check-in
            <span className="tabular-nums text-muted-foreground">
              {arrivals.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="departures" className="gap-1.5 py-2">
            Check-out
            <span className="tabular-nums text-muted-foreground">
              {departures.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="in_house" className="gap-1.5 py-2">
            In-house
            <span className="tabular-nums text-muted-foreground">
              {inHouse.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-1.5 py-2">
            Agents
            {snap.agentUnpaidCount > 0 ? (
              <span className="tabular-nums text-destructive">
                {snap.agentUnpaidCount}
              </span>
            ) : null}
          </TabsTrigger>
          {actionCount > 0 ? (
            <TabsTrigger value="actions" className="gap-1.5 py-2">
              Do next
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="arrivals" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Agent, guide #, rooms, room assignment, meal plan.
          </p>
          <DailyStayTable
            rows={arrivals}
            board="arrivals"
            emptyMessage="No check-ins today."
          />
        </TabsContent>

        <TabsContent value="departures" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Rooms, agent, payment status, room #, folio balance, meal plan.
          </p>
          <DailyStayTable
            rows={departures}
            board="departures"
            emptyMessage="No check-outs today."
          />
        </TabsContent>

        <TabsContent value="in_house" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Guests in house — room # and meal plan (kitchen covers).
          </p>
          <DailyStayTable
            rows={inHouse}
            board="in_house"
            emptyMessage="No guests in house."
          />
        </TabsContent>

        <TabsContent value="agents">
          <AgentFollowupPanel
            rows={snap.agentFollowup}
            unpaidCount={snap.agentUnpaidCount}
            paidCount={snap.agentPaidCount}
          />
        </TabsContent>

        {actionCount > 0 ? (
          <TabsContent value="actions" className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Ranked jobs when something is stuck — otherwise use the boards
              above.
            </p>
            <FoTodayWorklist actions={snap.actions} />
          </TabsContent>
        ) : null}
      </Tabs>

      <DailyToolsStrip snap={snap} />
    </div>
  );
}

function DailyToolsStrip({ snap }: { snap: DailyDeskSnapshot }) {
  const rota = snap.tools.rotaToday;
  return (
    <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClockIcon className="size-4 text-accent" />
          Rota today
          <span className="font-normal tabular-nums text-muted-foreground">
            · {rota.length}
          </span>
        </div>
        {rota.length === 0 ? (
          <p className="text-xs text-muted-foreground">No shifts published.</p>
        ) : (
          <ul className="max-h-28 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {rota.slice(0, 8).map((s) => (
              <li key={s.id} className="flex justify-between gap-2">
                <span className="truncate text-foreground">{s.staffName}</span>
                <span className="shrink-0 tabular-nums">
                  {s.startsAt.slice(0, 5)}–{s.endsAt.slice(0, 5)}
                  {s.outlet ? ` · ${s.outlet.replace(/_/g, " ")}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/erp/hr/rota"
          className="inline-flex text-xs text-accent underline-offset-4 hover:underline"
        >
          Open rota →
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <PackageIcon className="size-4 text-accent" />
          Store requisitions
        </div>
        <p className="text-xs text-muted-foreground">
          Issues today:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {snap.tools.issueMovesToday}
          </span>
          {" · "}
          Open POs:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {snap.tools.openPurchaseOrders}
          </span>
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <Link
            href="/erp/inventory/moves"
            className="text-accent underline-offset-4 hover:underline"
          >
            Issue / transfer
          </Link>
          <Link
            href="/erp/inventory/purchase-orders"
            className="text-accent underline-offset-4 hover:underline"
          >
            Purchase orders
          </Link>
          <Link
            href="/erp/kitchen/shopping"
            className="text-accent underline-offset-4 hover:underline"
          >
            Kitchen shopping
          </Link>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardListIcon className="size-4 text-accent" />
          Daily forms
        </div>
        <p className="text-xs text-muted-foreground">
          Compliance pack, fire drill, cleaning logs — when the hotel needs
          paper trails.
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <Link
            href="/erp/compliance"
            className="text-accent underline-offset-4 hover:underline"
          >
            Compliance forms
          </Link>
          <Link
            href="/erp/calendar/day-sheet"
            className="text-accent underline-offset-4 hover:underline"
          >
            Print day sheet
          </Link>
          <Link
            href="/erp/agents/call-tasks"
            className="text-accent underline-offset-4 hover:underline"
          >
            <UsersIcon className="mr-0.5 inline size-3" />
            Agent calls
          </Link>
        </div>
      </div>
    </section>
  );
}
