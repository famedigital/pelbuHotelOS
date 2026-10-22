"use client";

import { FoOpsDashboard } from "@/components/erp/FoOpsDashboard";
import { Button } from "@/components/ui/button";
import type { DailyDeskSnapshot } from "@/lib/erp/daily-desk";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";

const TABS = [
  { id: "home", label: "Dashboard" },
  { id: "checkout", label: "Checkout" },
  { id: "inhouse", label: "In house" },
  { id: "arrival", label: "Arrival" },
  { id: "empty", label: "Empty rooms" },
] as const;

type DeskTab = (typeof TABS)[number]["id"];

const MEAL_NAME: Record<string, string> = {
  EP: "Room only",
  BB: "Breakfast",
  CP: "Breakfast",
  MAP: "Breakfast and dinner",
  AP: "All meals",
};

function isDeskTab(value: string | null): value is Exclude<DeskTab, "home"> {
  return (
    value === "checkout" ||
    value === "inhouse" ||
    value === "arrival" ||
    value === "empty"
  );
}

export function FoDeskHome({
  snap,
  onInvalidate,
}: {
  snap: DailyDeskSnapshot;
  onInvalidate?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab");
  const tab: DeskTab = isDeskTab(raw) ? raw : "home";

  function openTab(next: DeskTab) {
    const query = new URLSearchParams(searchParams.toString());
    if (next === "home") query.delete("tab");
    else query.set("tab", next);
    const qs = query.toString();
    router.push(qs ? `/erp/stayview?${qs}` : "/erp/stayview");
  }

  const pax = snap.dayOpsPulse.inHousePax;
  const meals = snap.inHouseMealBuckets ?? [];
  const nations = snap.nationalityCounts ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <nav
          aria-label="Front office"
          className="flex flex-wrap gap-1"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openTab(item.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                tab === item.id
                  ? "bg-foreground font-medium text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
        {tab !== "home" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => openTab("home")}
          >
            Back to dashboard
          </Button>
        ) : null}
      </div>

      {tab === "home" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CountCard
              label="Checkout"
              value={snap.dayOps.departures.length}
              hint="Leaving today"
              onClick={() => openTab("checkout")}
            />
            <CountCard
              label="In house"
              value={snap.dayOps.inHouse.length}
              hint="Staying tonight"
              onClick={() => openTab("inhouse")}
            />
            <CountCard
              label="Arrival"
              value={snap.dayOps.arrivals.length}
              hint="Arriving today"
              onClick={() => openTab("arrival")}
            />
            <CountCard
              label="Empty rooms"
              value={snap.emptyRooms.vacant}
              hint="Vacant and sellable"
              onClick={() => openTab("empty")}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => openTab("inhouse")}
              className="rounded-md border bg-card px-4 py-4 text-left hover:bg-muted/40"
            >
              <p className="text-sm text-muted-foreground">Guests in house</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums">{pax}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Adults and children on the stays
              </p>
            </button>

            <section className="rounded-md border bg-card px-4 py-4">
              <h3 className="text-sm font-medium">Nationality</h3>
              {nations.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No nationality saved on these guests.
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {nations.map((row) => (
                    <li key={row.label}>
                      <button
                        type="button"
                        onClick={() => openTab("inhouse")}
                        className="flex w-full items-baseline justify-between gap-3 rounded px-1 py-1 text-left text-sm hover:bg-muted"
                      >
                        <span>{row.label}</span>
                        <span className="font-semibold tabular-nums">
                          {row.guests}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-md border bg-card px-4 py-4">
              <h3 className="text-sm font-medium">Meal plan</h3>
              {meals.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No one in house.
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {meals.map((row) => (
                    <li key={row.code}>
                      <button
                        type="button"
                        onClick={() => openTab("inhouse")}
                        className="flex w-full items-baseline justify-between gap-3 rounded px-1 py-1 text-left text-sm hover:bg-muted"
                      >
                        <span>
                          {MEAL_NAME[row.code] ?? row.code}
                          <span className="ml-1 text-xs text-muted-foreground">
                            {row.code}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums">
                          <span className="font-semibold">{row.pax}</span>
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            guests · {row.rooms} rooms
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {tab === "arrival" ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              To check a guest in, press{" "}
              <span className="font-medium">Check in</span> on their row. The
              stay opens on the check-in step. Choose the room and how they
              pay, then confirm. If the room is not assigned yet, press{" "}
              <span className="font-medium">Assign room</span> first.
            </p>
          ) : null}
          <FoOpsDashboard
            snap={snap}
            onInvalidate={onInvalidate}
            only={tab}
          />
        </div>
      )}
    </div>
  );
}

function CountCard({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border bg-card px-4 py-4 text-left hover:bg-muted/40"
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-4xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </button>
  );
}
