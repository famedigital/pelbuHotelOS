"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  UtensilsCrossed,
  Briefcase,
  Clock,
  ShieldCheck,
  ArrowRight,
  Lock,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ChevronRight,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { BRAND_ICONS } from "@/lib/brand";
import { SITE_NAME } from "@/lib/site";

export type ActiveSessionSummary = {
  isDesk: boolean;
  staffName?: string | null;
  department?: string | null;
  canAccessDesk?: boolean;
  agentName?: string | null;
  agentCode?: string | null;
};

interface UnifiedLoginHubProps {
  activeSession: ActiveSessionSummary;
  isSwitchMode?: boolean;
}

type WorkspaceItem = {
  id: string;
  keyNumber: string;
  title: string;
  href: string;
  roleBadge: string;
  badgeTone: string;
  icon: typeof Building2;
  description: string;
  credentials: string;
  features: string[];
};

const WORKSPACES: WorkspaceItem[] = [
  {
    id: "desk",
    keyNumber: "1",
    title: "Front Desk & Operations",
    href: "/erp/login",
    roleBadge: "Front Office",
    badgeTone: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    icon: Building2,
    description: "Stayview room rack, fast guest check-in, dynamic multi-guest folios, city ledger & night audit.",
    credentials: "Hotel code + personal PIN",
    features: ["Room Rack StayView", "Group Allocations", "Bhutan BST/SC Folio", "Night Audit Roll"],
  },
  {
    id: "pos",
    keyNumber: "2",
    title: "Restaurant & Bar POS",
    href: "/erp/pos/login",
    roleBadge: "Till Register",
    badgeTone: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    icon: UtensilsCrossed,
    description: "Touch-first dining register. Route food and beverage tickets straight to guest room folios in BTN.",
    credentials: "Till user ID + register PIN",
    features: ["Table Orders", "Room Charge in BTN", "Kitchen KDS Pass", "Bhutan RMA QR Bills"],
  },
  {
    id: "agents",
    keyNumber: "3",
    title: "Travel Partner Portal",
    href: "/agents/login",
    roleBadge: "B2B Partner",
    badgeTone: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    icon: Briefcase,
    description: "Approved Bhutan tour operators access signed MoU rates, reserve room allotments, and track credit.",
    credentials: "Agent code + partner PIN",
    features: ["Agreed Contract Rates", "Instant Allotment Hold", "MoU City Ledger", "Voucher PDF"],
  },
  {
    id: "staff",
    keyNumber: "4",
    title: "Staff Self-Service & HR",
    href: "/staff/login",
    roleBadge: "Staff HR",
    badgeTone: "bg-violet-500/10 text-violet-400 border-violet-500/30",
    icon: Clock,
    description: "Department duty rota, daily shift clock-in, leave requests, monthly salary slips, and uniform laundry.",
    credentials: "Hotel code, staff ID + PIN",
    features: ["Biometric/PIN Time Clock", "Duty Rota", "Leave Balances", "Payslip Download"],
  },
  {
    id: "admin",
    keyNumber: "5",
    title: "Platform Fleet Control",
    href: "/admin/login",
    roleBadge: "Super Admin",
    badgeTone: "bg-slate-500/10 text-slate-300 border-slate-500/30",
    icon: SlidersHorizontal,
    description: "Multi-property provisioning, DRC fiscal sequence health, and platform tenant management.",
    credentials: "Platform administrator credentials",
    features: ["Tenant Fleet Directory", "Tax Sequence Audits", "Package Licensing"],
  },
];

export function UnifiedLoginHub({
  activeSession,
  isSwitchMode = false,
}: UnifiedLoginHubProps) {
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Keyboard shortcut listener: Pressing 1, 2, 3, 4, 5 opens the corresponding workspace
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const match = WORKSPACES.find((w) => w.keyNumber === e.key);
      if (match) {
        e.preventDefault();
        router.push(match.href);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const hasActiveSession =
    activeSession.isDesk ||
    Boolean(activeSession.staffName) ||
    Boolean(activeSession.agentName);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#060A12] text-slate-100 flex flex-col justify-between">
      {/* Background Ambient Lighting (Himalayan Jewels: Pine Green + Saffron Gold + Midnight Slate) */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full blur-[140px] opacity-25"
        style={{
          background:
            "radial-gradient(circle, #059669 0%, rgba(5, 150, 105, 0) 70%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full blur-[160px] opacity-20"
        style={{
          background:
            "radial-gradient(circle, #d97706 0%, rgba(217, 119, 6, 0) 70%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[700px] w-[900px] rounded-full blur-[180px] opacity-10"
        style={{
          background:
            "radial-gradient(circle, #0284c7 0%, rgba(2, 132, 199, 0) 70%)",
        }}
        aria-hidden
      />

      {/* Top Header Bar */}
      <header className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 transition-opacity hover:opacity-85"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND_ICONS.markLight || BRAND_ICONS.mark}
              alt={SITE_NAME}
              className="h-9 w-9 rounded-xl object-contain ring-1 ring-white/10"
              width={36}
              height={36}
            />
            <div>
              <p className="font-display text-base font-semibold tracking-tight text-white">
                {SITE_NAME}
              </p>
              <p className="text-[10px] font-medium tracking-[0.16em] text-emerald-400 uppercase">
                Hotel OS Bhutan
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHelp((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <HelpCircle className="size-3.5 text-amber-400" />
              <span>Login Help</span>
            </button>
            <Link
              href="/"
              className="text-xs text-slate-400 underline-offset-4 hover:text-white hover:underline hidden sm:inline-block"
            >
              ← Public Site
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-12">
        {/* Active Session Warning / Switcher Banner */}
        {hasActiveSession && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4 shadow-lg backdrop-blur-xl md:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-sm font-semibold text-white">
                      Active Session Detected
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-emerald-200/80">
                    {activeSession.isDesk
                      ? "Front Desk Session is active on this terminal."
                      : activeSession.staffName
                        ? `Logged in as ${activeSession.staffName} (${activeSession.department || "Staff"}).`
                        : activeSession.agentName
                          ? `Authenticated as partner: ${activeSession.agentName} (${activeSession.agentCode}).`
                          : "You have an active session."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Link
                  href={
                    activeSession.isDesk
                      ? "/erp"
                      : activeSession.staffName
                        ? activeSession.canAccessDesk
                          ? "/erp"
                          : "/staff"
                        : "/agents/app"
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-500 active:scale-[0.98]"
                >
                  <span>Resume Workspace</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            <Sparkles className="size-3.5" />
            <span>
              {isSwitchMode
                ? "Workspace Switcher · Switch Active Portal"
                : "Kingdom of Bhutan Unified Enterprise Gateway"}
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {isSwitchMode ? "Switch your workspace" : "Choose your workspace"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base leading-relaxed">
            Select your operational role below, or press keys{" "}
            <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-xs font-mono text-amber-300">
              1
            </kbd>{" "}
            through{" "}
            <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-xs font-mono text-amber-300">
              5
            </kbd>{" "}
            for instant keyboard navigation.
          </p>
        </div>

        {/* Help Accordion if toggled */}
        {showHelp && (
          <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Info className="size-4" />
                <h2 className="text-sm font-semibold text-white">
                  Credentials & Login Instructions
                </h2>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close ×
              </button>
            </div>
            <div className="mt-4 grid gap-4 text-xs text-slate-300 sm:grid-cols-2 md:grid-cols-3">
              <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                <p className="font-semibold text-emerald-400">Hotel Code (e.g. ABC12345)</p>
                <p className="mt-1 leading-relaxed text-slate-400">
                  Assigned to each registered property. Front Desk and POS require the 6–8 character hotel code plus property desk password.
                </p>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                <p className="font-semibold text-sky-400">Travel Agent Code & PIN</p>
                <p className="mt-1 leading-relaxed text-slate-400">
                  Issued upon signing a bilateral MoU rate agreement. Gives tour operators direct live room allotments and city ledger credit.
                </p>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                <p className="font-semibold text-violet-400">Staff Employee PIN</p>
                <p className="mt-1 leading-relaxed text-slate-400">
                  Configured by your General Manager in the HR roster. Used for shift punch-in, room turnover checklists, and payslips.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Workspaces Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {WORKSPACES.map((ws) => {
            const Icon = ws.icon;
            const isHovered = hoveredId === ws.id;

            return (
              <Link
                key={ws.id}
                href={ws.href}
                onMouseEnter={() => setHoveredId(ws.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-all duration-200 active:scale-[0.98] ${
                  isHovered
                    ? "border-emerald-500/50 bg-white/[0.07] shadow-[0_16px_36px_-10px_rgba(5,150,105,0.25)] -translate-y-1"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                }`}
                style={{
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                }}
              >
                {/* 1px Specular Top Rim */}
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  aria-hidden
                />

                <div>
                  {/* Top Bar: Icon + Badge + Key Hint */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-100 transition-colors group-hover:bg-emerald-500/20 group-hover:text-emerald-300`}
                      >
                        <Icon className="size-5" />
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${ws.badgeTone}`}
                      >
                        {ws.roleBadge}
                      </span>
                    </div>

                    <kbd
                      title={`Press ${ws.keyNumber} to open`}
                      className="flex size-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 font-mono text-xs font-bold text-slate-300 group-hover:border-emerald-500/50 group-hover:text-emerald-300 group-hover:bg-emerald-500/10"
                    >
                      {ws.keyNumber}
                    </kbd>
                  </div>

                  {/* Title & Description */}
                  <div className="mt-4">
                    <h2 className="text-lg font-semibold tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                      {ws.title}
                    </h2>
                    <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                      {ws.description}
                    </p>
                  </div>

                  {/* Feature Bullets */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {ws.features.map((feat) => (
                      <span
                        key={feat}
                        className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-slate-400 group-hover:text-slate-300"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-3 text-xs">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Lock className="size-3 text-slate-500" />
                    <span>{ws.credentials}</span>
                  </div>

                  <span className="flex items-center gap-1 font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
                    <span>Open</span>
                    <ChevronRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Security & Regulatory Certifications Footer */}
        <div className="mt-12 rounded-2xl border border-white/5 bg-black/40 p-5 backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-400" />
                <span className="font-medium text-slate-300">
                  DRC Invoicing Compliant (10% BST + 10% SC)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block size-1.5 rounded-full bg-amber-400" />
                <span>Bhutan RMA QR Gateway Ready</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block size-1.5 rounded-full bg-sky-400" />
                <span>Offline RAM-First Desk Resilient</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Encrypted Tenant Session Partitioning
            </p>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 border-t border-white/5 bg-black/30 px-6 py-4 text-center text-xs text-slate-400">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {SITE_NAME} · Built for the Kingdom of Bhutan
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="text-slate-400 hover:text-white transition-colors"
            >
              Pricing in BTN
            </Link>
            <Link
              href="/conditions"
              className="text-slate-400 hover:text-white transition-colors"
            >
              Conditions
            </Link>
            <Link
              href="/demo"
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Book a Demo
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
