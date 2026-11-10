"use client";

import { useState } from "react";
import {
  CalendarDays,
  UtensilsCrossed,
  Receipt,
  ShieldCheck,
  Send,
  CheckCircle2,
} from "lucide-react";
import { ProductFrame } from "@/components/marketing/ProductFrame";
import { RackStill } from "@/components/marketing/product-stills";

type StudioTab = {
  id: string;
  name: string;
  badge: string;
  icon: typeof CalendarDays;
  headline: string;
  description: string;
};

const TABS: StudioTab[] = [
  {
    id: "stayview",
    name: "Room Rack & Desk",
    badge: "0-Latency StayView",
    icon: CalendarDays,
    headline: "Instant visual room rack with 0-millisecond stay shifting",
    description:
      "Engineered with RAM-first caching. Drag-and-drop bookings, assign rooms, split group reservations, and check in arriving guests in under 2 seconds.",
  },
  {
    id: "folio",
    name: "Dynamic Folio & Ledger",
    badge: "Bilateral City Ledger",
    icon: Receipt,
    headline: "Dual-stream billing separating tour vouchers from personal extras",
    description:
      "Travel agent vouchers settle to the B2B city ledger on credit, while guest dining and minibar settle to cash, card, or Bhutan RMA QR. Zero math mistakes.",
  },
  {
    id: "pos",
    name: "Restaurant & Bar POS",
    badge: "Direct Room Charge",
    icon: UtensilsCrossed,
    headline: "Dining tickets post straight to guest room folios in BTN",
    description:
      "Install on any touch till or tablet. Table management, kitchen pass printing, and 1-tap room charge that hits the guest folio with 10% BST + 10% Service Charge.",
  },
  {
    id: "dot",
    name: "Trade, DOT & BAFRA",
    badge: "Official Inspection Ready",
    icon: ShieldCheck,
    headline: "Full Star Hotel Classification & Food License Checklist",
    description:
      "Be ready before the inspectors walk through the door. 84 DOT classification criteria, food safety certificates, fire inspections, and tourist SDF records.",
  },
  {
    id: "hermes",
    name: "Hermes Telegram Engine",
    badge: "Zero-App Mobile Ops",
    icon: Send,
    headline: "Two-way Telegram supergroup topics replace sluggish internal chats",
    description:
      "Housekeeping receives instant turnover alerts on Telegram with inline [Mark Clean] buttons. Front desk gets arrival briefings without opening laptops.",
  },
];

export function MarketingProductStudio() {
  const [activeTabId, setActiveTabId] = useState<string>("stayview");
  const currentTab = TABS.find((t) => t.id === activeTabId) ?? TABS[0];
  const Icon = currentTab.icon;

  return (
    <div className="w-full">
      {/* Studio Tab Navigation */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {TABS.map((tab) => {
          const isSelected = tab.id === activeTabId;
          const TabIcon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-200 active:scale-[0.98] ${
                isSelected
                  ? "bg-foreground text-background shadow-lg ring-2 ring-foreground/20 -translate-y-0.5"
                  : "border border-border/80 bg-card/60 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
              }`}
            >
              <TabIcon className="size-4" />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Studio Interactive Frame */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-border/80 bg-card/70 p-6 shadow-2xl backdrop-blur-xl md:p-8">
        {/* Header of Active Tab */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/70 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Icon className="size-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
                {currentTab.badge}
              </span>
              <h3 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
                {currentTab.headline}
              </h3>
            </div>
          </div>

          <p className="max-w-md text-xs text-muted-foreground leading-relaxed">
            {currentTab.description}
          </p>
        </div>

        {/* Tab Specific Simulation Canvas */}
        <div className="mt-6">
          {activeTabId === "stayview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border/60 bg-background/70 p-3.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">Occupancy Today</p>
                  <p className="mt-1 font-mono text-xl font-bold text-foreground">87.5%</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">14 of 16 Rooms Sold</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/70 p-3.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">Expected Arrivals</p>
                  <p className="mt-1 font-mono text-xl font-bold text-foreground">5 Groups</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">3 Soul Trips • 2 Walk-in</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/70 p-3.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">In-House Balance</p>
                  <p className="mt-1 font-mono text-xl font-bold text-foreground">Nu. 142,800</p>
                  <p className="text-[10px] text-sky-600 dark:text-sky-400">Guaranteed by Agent MoU</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/70 p-3.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">Turnover Status</p>
                  <p className="mt-1 font-mono text-xl font-bold text-foreground">12 Clean</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">2 In Progress • 0 Dirty</p>
                </div>
              </div>

              <ProductFrame url="app.innorahotel.com/erp/stayview">
                <RackStill />
              </ProductFrame>
            </div>
          )}

          {activeTabId === "folio" && (
            <div className="space-y-4">
              <ProductFrame url="app.innorahotel.com/erp/folios/stay-842">
                <div className="p-4 bg-white text-slate-900 font-sans text-xs">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <p className="font-bold text-base">Stay #STAY-2026-0842 · Room 204</p>
                      <p className="text-slate-500">Guest: Dr. Tandin Wangchuk · 2 Pax · MAP Plan</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                      Atomic Balance: Nu. 0.00 Due
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {/* Tab A: Agent City Ledger */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="font-semibold text-sky-700">Tab A: Agent Voucher (Soul Trips Bhutan)</p>
                      <p className="text-[11px] text-slate-500">Billed to Agent City Ledger #AGT-004</p>
                      <ul className="mt-2 space-y-1 text-slate-700">
                        <li className="flex justify-between">
                          <span>2 Nights Deluxe Room (MAP)</span>
                          <span className="font-mono">Nu. 9,000.00</span>
                        </li>
                        <li className="flex justify-between font-semibold border-t pt-1">
                          <span>Agent Total:</span>
                          <span className="font-mono text-sky-700">Nu. 9,000.00 (Settled to Ledger)</span>
                        </li>
                      </ul>
                    </div>

                    {/* Tab B: Personal Extras */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="font-semibold text-amber-700">Tab B: Guest Extras & Minibar</p>
                      <p className="text-[11px] text-slate-500">Settled directly at Reception Desk</p>
                      <ul className="mt-2 space-y-1 text-slate-700">
                        <li className="flex justify-between">
                          <span>Kewa Datshi & Red Rice Room Svc</span>
                          <span className="font-mono">Nu. 480.00</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Laundry 2 Gho + 1 Kira Pressed</span>
                          <span className="font-mono">Nu. 350.00</span>
                        </li>
                        <li className="flex justify-between font-semibold border-t pt-1">
                          <span>Settled via RMA QR (mBOB):</span>
                          <span className="font-mono text-emerald-700">Nu. 830.00 (Receipt #INV-00412)</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </ProductFrame>
            </div>
          )}

          {activeTabId === "pos" && (
            <div className="space-y-4">
              <ProductFrame url="app.innorahotel.com/erp/pos">
                <div className="p-4 bg-white text-slate-900 font-sans text-xs">
                  <div className="flex items-center justify-between border-b pb-3">
                    <p className="font-bold text-sm">Restaurant Till POS · Table 04</p>
                    <span className="rounded-md bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      Waiter: Pema Dorji
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border p-2 bg-slate-50">
                      <p className="font-semibold text-slate-800">Kewa Datshi</p>
                      <p className="text-slate-500">Bhutanese Chilli & Cheese</p>
                      <p className="mt-1 font-mono font-bold text-emerald-700">Nu. 320</p>
                    </div>
                    <div className="rounded-md border p-2 bg-slate-50">
                      <p className="font-semibold text-slate-800">Shakam Paa</p>
                      <p className="text-slate-500">Dried Beef with Radish</p>
                      <p className="mt-1 font-mono font-bold text-emerald-700">Nu. 550</p>
                    </div>
                    <div className="rounded-md border p-2 bg-slate-50">
                      <p className="font-semibold text-slate-800">Red Rice & Suja</p>
                      <p className="text-slate-500">Traditional Butter Tea</p>
                      <p className="mt-1 font-mono font-bold text-emerald-700">Nu. 280</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-100 p-3">
                    <div>
                      <p className="font-semibold">Subtotal: Nu. 1,150 + 10% BST + 10% SC = Nu. 1,380</p>
                      <p className="text-[11px] text-slate-500">Route to Room 102 Folio?</p>
                    </div>
                    <button className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-600">
                      ⚡ 1-Tap Charge to Room Folio
                    </button>
                  </div>
                </div>
              </ProductFrame>
            </div>
          )}

          {activeTabId === "dot" && (
            <div className="space-y-4">
              <ProductFrame url="app.innorahotel.com/erp/compliance/dot">
                <div className="p-4 bg-white text-slate-900 font-sans text-xs space-y-3">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <p className="font-bold text-sm">Tourism Council / DOT Star Classification Audit</p>
                      <p className="text-slate-500">Category: 3-Star Standard Hotel · Thimphu District</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-800">
                      Score: 84 / 84 Standards Passed
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border p-3 bg-emerald-50/50">
                      <p className="font-semibold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        Fire Safety & Evacuation
                      </p>
                      <p className="text-slate-600 mt-1">Inspected: 12 extinguishers recharged, drill recorded on 15 Oct 2026.</p>
                    </div>
                    <div className="rounded-md border p-3 bg-emerald-50/50">
                      <p className="font-semibold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        BAFRA Food Hygiene Certificate
                      </p>
                      <p className="text-slate-600 mt-1">License #BFDA-THI-2026-90 Valid through 31 Dec 2027.</p>
                    </div>
                  </div>
                </div>
              </ProductFrame>
            </div>
          )}

          {activeTabId === "hermes" && (
            <div className="space-y-4">
              <ProductFrame url="t.me/hotel_operations_bhutan">
                <div className="p-4 bg-[#0e1621] text-white font-sans text-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <p className="font-bold text-sm text-sky-400">Hermes Telegram Forum · Supergroup</p>
                    <span className="text-[11px] text-slate-400">Active Telegram Bot Webhook</span>
                  </div>

                  <div className="space-y-2">
                    <div className="rounded-lg bg-[#182533] p-3 border border-white/5">
                      <p className="text-emerald-400 font-semibold">#front-office · New Booking Alert</p>
                      <p className="mt-1 text-slate-200">
                        🛎️ Soul Trips Bhutan booked Room 201 (Deluxe Heritage) for 3 nights. Check-in 14 Nov.
                      </p>
                    </div>

                    <div className="rounded-lg bg-[#182533] p-3 border border-white/5">
                      <p className="text-amber-400 font-semibold">#housekeeping · Turnover Request</p>
                      <p className="mt-1 text-slate-200">
                        🧹 Room 104 guest checked out. Linen trolley dispatched to Floor 1.
                      </p>
                    </div>
                  </div>
                </div>
              </ProductFrame>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
