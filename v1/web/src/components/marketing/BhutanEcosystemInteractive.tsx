"use client";

import { useState } from "react";
import {
  ShieldAlert,
  Utensils,
  Briefcase,
  Users,
  Store,
  Receipt,
  UserCheck,
  CheckCircle2,
} from "lucide-react";

type RingItem = {
  id: string;
  name: string;
  badge: string;
  icon: typeof ShieldAlert;
  problem: string;
  solution: string;
  bhutanDetail: string;
  workflowSample: {
    label: string;
    value: string;
    status: string;
  };
};

const RINGS: RingItem[] = [
  {
    id: "dot",
    name: "Trade & DOT",
    badge: "Classification & Safety",
    icon: ShieldAlert,
    problem:
      "Generic hotel systems have no concept of Bhutan Department of Tourism (DOT) 3-Star or 4-Star classification criteria, fire safety drills, or tourist SDF logging.",
    solution:
      "Built-in digital classification checklist ready for Trade & DOT inspectors. Print or export star classification audits with 1 click.",
    bhutanDetail:
      "Covers all 84 DOT audit standards: room square footage, emergency lighting, signage, and tourist registration records.",
    workflowSample: {
      label: "DOT Classification Status",
      value: "3-Star Standard Verified (84/84 Passed)",
      status: "Ready for Inspector",
    },
  },
  {
    id: "bafra",
    name: "BAFRA / BFDA",
    badge: "Food & Kitchen Safety",
    icon: Utensils,
    problem:
      "Kitchen food safety licenses and food handler medical certificates expire quietly, risking hefty fines during surprise BAFRA/BFDA food inspections.",
    solution:
      "Digital kitchen compliance registry that tracks cook medical fitness cards, kitchen sanitation logs, and food storage hygiene.",
    bhutanDetail:
      "Automatic 30-day alerts before any cook's health certificate expires. One-tap printout for municipal food inspectors.",
    workflowSample: {
      label: "Kitchen Health Compliance",
      value: "6 Food Handler Cards Active • Sanitation Log Current",
      status: "100% Compliant",
    },
  },
  {
    id: "agents",
    name: "Travel Agents",
    badge: "B2B MoU & City Ledger",
    icon: Briefcase,
    problem:
      "80% of Bhutan hotel revenue comes from travel agents who operate on credit with signed MoU agreements. Foreign PMS platforms force guest credit cards.",
    solution:
      "First-class Travel Partner Portal with bilateral MoU contract rates, agreed room allotments, and automated city ledger credit statements.",
    bhutanDetail:
      "Agents book online with their private PIN. Stays automatically charge the agent's account; payments settle in bulk at month-end.",
    workflowSample: {
      label: "Active Agent Agreement",
      value: "Soul Trips Bhutan • MAP Bilateral Rate Nu. 4,500/night",
      status: "Credit Limit: Nu. 350,000",
    },
  },
  {
    id: "guides",
    name: "Guides & Drivers",
    badge: "Complimentary Beds",
    icon: Users,
    problem:
      "Tour group arrivals include guides and drivers who need complimentary beds and meals. Generic systems lose track of them in paper notebooks.",
    solution:
      "Built-in guide bed and driver room allocation linked directly to the group arrival, with designated breakfast and meal credits.",
    bhutanDetail:
      "Never turn away a driver or double-book guide quarters. Track guide names, license numbers, and assigned parking spaces.",
    workflowSample: {
      label: "Group Logistics (Druk Asia 12 Pax)",
      value: "Guide Tashi Dorji (Guide Bed B-02) • Driver Karma (Dorm 4)",
      status: "Checked In with Group",
    },
  },
  {
    id: "suppliers",
    name: "Local Suppliers",
    badge: "Vegetable & Gas Accounts",
    icon: Store,
    problem:
      "The kitchen procures vegetables from Centenary Farmers Market, meat from local butchers, and gas cylinders on store accounts without software tracking.",
    solution:
      "Integrated Supplier Ledger for kitchen provisions. Log incoming vegetable crates, gas cylinders, and dry groceries directly to supplier balances.",
    bhutanDetail:
      "Eliminates paper chits. Match kitchen receipts against monthly supplier invoices and pay via Bhutan RMA bank transfer.",
    workflowSample: {
      label: "Centenary Veg Market Bill",
      value: "Chilli, Red Rice, Potato, Mushroom • Nu. 14,200",
      status: "Posted to Supplier Ledger",
    },
  },
  {
    id: "drc",
    name: "DRC Tax Dept",
    badge: "BST & Service Charge",
    icon: Receipt,
    problem:
      "Bhutan Department of Revenue & Customs requires strictly gapless sequential tax invoices, 10% Bhutan Sales Tax (BST), and 10% Service Charge separation.",
    solution:
      "Atomic invoice generator creating guaranteed gapless INV-YYYY-XXXXX sequence numbers with tamper-proof audit trails.",
    bhutanDetail:
      "Automated monthly DRC fiscal pack generation showing exact BST collected, Service Charge distribution to staff, and room revenue.",
    workflowSample: {
      label: "Fiscal Invoice Sequence",
      value: "INV-2026-00412 • 10% BST + 10% SC Calculated",
      status: "Gapless Audit Locked",
    },
  },
  {
    id: "direct",
    name: "Direct Guests",
    badge: "RMA QR & Web Booking",
    icon: UserCheck,
    problem:
      "Bhutanese direct guests and corporate delegates expect instant RMA QR code payment, without dealing with international card exchange fees.",
    solution:
      "White-label hotel booking engine with instant RMA National QR code generation for 0-fee local Bhutan bank transfers.",
    bhutanDetail:
      "Guests scan with Bank of Bhutan (mBOB), BNB M-Pay, Druk PNB, or T-Bank. Instant automated folio receipt.",
    workflowSample: {
      label: "RMA National QR Payment",
      value: "Nu. 8,500 Settled via mBOB • Txn #RMA-849201",
      status: "Folio Balance: Nu. 0.00",
    },
  },
];

export function BhutanEcosystemInteractive() {
  const [activeId, setActiveId] = useState<string>("agents");
  const activeRing = RINGS.find((r) => r.id === activeId) ?? RINGS[0];
  const Icon = activeRing.icon;

  return (
    <div className="w-full">
      {/* 7-Ring Selector Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {RINGS.map((ring) => {
          const isSelected = ring.id === activeId;
          const RingIcon = ring.icon;

          return (
            <button
              key={ring.id}
              onClick={() => setActiveId(ring.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.98] ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40 -translate-y-0.5"
                  : "border border-border/80 bg-card/60 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
              }`}
            >
              <RingIcon className="size-3.5" />
              <span>{ring.name}</span>
            </button>
          );
        })}
      </div>

      {/* Detail Showcase Panel */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-border/80 bg-card/70 p-6 shadow-xl backdrop-blur-xl md:p-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Context & Solution */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Icon className="size-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">
                  {activeRing.badge}
                </span>
                <h3 className="text-2xl font-bold tracking-tight text-foreground">
                  The {activeRing.name} Reality
                </h3>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-xs text-muted-foreground leading-relaxed">
                <p className="font-semibold text-destructive">The Problem in Bhutan:</p>
                <p className="mt-1">{activeRing.problem}</p>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground leading-relaxed">
                <p className="font-semibold text-primary">How Hotel OS Solves It:</p>
                <p className="mt-1">{activeRing.solution}</p>
              </div>

              <p className="text-xs text-muted-foreground italic leading-relaxed pt-1">
                📌 {activeRing.bhutanDetail}
              </p>
            </div>
          </div>

          {/* Right Column: Live Operational Card Simulation */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-border/90 bg-muted/40 p-5 shadow-inner">
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Hotel OS Bhutan Ledger Spec
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  <span>{activeRing.workflowSample.status}</span>
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">{activeRing.workflowSample.label}</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                    {activeRing.workflowSample.value}
                  </p>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/80 p-3 text-xs space-y-1.5">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Audit Status:</span>
                    <span className="font-medium text-foreground">Verified & Immutable</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Currency:</span>
                    <span className="font-medium text-foreground">BTN (Bhutanese Ngultrum)</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Multi-Tenant Property:</span>
                    <span className="font-medium text-foreground">Pelbu Suites / Demo Hotel</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-border/70 pt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>0-Latency RAM-First</span>
                <span className="font-medium text-primary">Standard Operation</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
