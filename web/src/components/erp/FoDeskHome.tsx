"use client";

import {
  FoHkRail,
  FoStayCommandTable,
  FoStayMetrics,
} from "@/components/erp/FoCommandDesk";
import { FoOpsDashboard } from "@/components/erp/FoOpsDashboard";
import type { DailyDeskSnapshot } from "@/lib/erp/daily-desk";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const TABS = [
  { id: "home", label: "Dashboard" },
  { id: "checkout", label: "Checkout" },
  { id: "tomorrow", label: "Tomorrow checkout" },
  { id: "inhouse", label: "In house" },
  { id: "arrival", label: "Arrival" },
  { id: "empty", label: "Empty rooms" },
] as const;

type DeskTab = (typeof TABS)[number]["id"];

function isDeskTab(value: string | null): value is Exclude<DeskTab, "home"> {
  return (
    value === "checkout" ||
    value === "tomorrow" ||
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

  return (
    <div className="space-y-4">
      <nav
        aria-label="Front office"
        className="flex gap-1 overflow-x-auto border-b border-white/10 md:hidden"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openTab(item.id)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm whitespace-nowrap",
              tab === item.id
                ? "border-sky-400 font-semibold text-sky-300"
                : "border-transparent text-slate-400 hover:text-slate-200",
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "home" ? (
        <div className="space-y-4">
          <FoStayMetrics snap={snap} onOpen={openTab} />
          <div className="grid items-start gap-4 lg:grid-cols-3">
            <section className="fo-glass p-4 lg:col-span-2">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="text-base font-bold text-white">
                  Today&apos;s arrivals
                </h2>
                <p className="text-xs text-slate-400">
                  {snap.dayOps.arrivals.length} expected
                </p>
              </div>
              <FoStayCommandTable rows={snap.dayOps.arrivals} board="arrivals" />
            </section>
            <FoHkRail empty={snap.emptyRooms} pulse={snap.dayOpsPulse} />
          </div>
        </div>
      ) : tab === "arrival" ? (
        <div className="space-y-3">
          <p className="rounded-md border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">
            Press Check in on the row. The stay opens on the check-in step.
            Choose the room and how they pay, then confirm. If the room is
            still unassigned, assign it first.
          </p>
          <section className="fo-glass p-4">
            <FoStayCommandTable rows={snap.dayOps.arrivals} board="arrivals" />
          </section>
        </div>
      ) : tab === "tomorrow" ? (
        <FoOpsDashboard snap={snap} onInvalidate={onInvalidate} only="tomorrow" />
      ) : tab === "checkout" ? (
        <section className="fo-glass p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-white">Today&apos;s checkout</h2>
            <Link href="/erp/departures" className="text-xs text-sky-400 hover:underline">
              Bills and invoices
            </Link>
          </div>
          <FoStayCommandTable rows={snap.dayOps.departures} board="departures" />
        </section>
      ) : tab === "inhouse" ? (
        <section className="fo-glass p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-white">In house</h2>
            <Link href="/erp/in-house" className="text-xs text-sky-400 hover:underline">
              Full in-house list
            </Link>
          </div>
          <FoStayCommandTable rows={snap.dayOps.inHouse} board="in_house" />
        </section>
      ) : (
        <FoOpsDashboard snap={snap} onInvalidate={onInvalidate} only="empty" />
      )}
    </div>
  );
}
