"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  UtensilsCrossed,
  ShoppingCart,
  FileText,
  ShieldAlert,
  Sparkles,
  Search,
  KeyRound,
  LogOut,
  CalendarRange,
  Users,
  Moon,
  BrushCleaning,
  ChefHat,
  Globe2,
  Sprout,
  TicketCheck,
  BookUser,
  Cpu,
} from "lucide-react";
import { OdometerTicker } from "@/components/ui/neo-spatial";
import { useRamEngine, getExpectedCashTillBtn } from "@hotel-os/engine";
import { V2DeskSnapshotHydration } from "@/components/v2/V2DeskSnapshotHydration";
import { V2DeskWsRefresh } from "@/components/v2/V2DeskWsRefresh";
import { V2CommandPaletteHost } from "@/components/v2/V2CommandPaletteHost";
import {
  clearV2Session,
  readV2DeskToken,
  readV2Staff,
} from "@/lib/v2/desk-api";

const V2_RAIL = [
  { href: "/v2/desk", label: "Desk", icon: Building2 },
  { href: "/v2/stayview", label: "Tape", icon: CalendarRange },
  { href: "/v2/pos", label: "POS", icon: UtensilsCrossed },
  { href: "/v2/staff/housekeeping", label: "HK", icon: BrushCleaning },
  { href: "/v2/staff/kds", label: "KDS", icon: ChefHat },
  { href: "/v2/purchases", label: "Buy", icon: ShoppingCart },
  { href: "/v2/agents", label: "Agents", icon: Users },
  { href: "/v2/registry", label: "Reg", icon: BookUser },
  { href: "/v2/hardware", label: "HW", icon: Cpu },
  { href: "/v2/marketplace", label: "MP", icon: Globe2 },
  { href: "/v2/portal/verify-voucher", label: "Voucher", icon: TicketCheck },
  { href: "/v2/reports", label: "Reports", icon: FileText },
  { href: "/v2/night-audit", label: "Audit", icon: Moon },
  { href: "/v2/platform/onboard", label: "Onboard", icon: Sprout },
  { href: "/v2/superadmin", label: "SaaS", icon: ShieldAlert },
];

export function V2ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { propertyName, cashTill, syncState, lastSyncedAt, staffName } = useRamEngine();
  const expectedCashBtn = getExpectedCashTillBtn(cashTill);
  const [signedInName, setSignedInName] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setSignedInName(readV2Staff()?.fullName ?? null);
    setHasToken(Boolean(readV2DeskToken()));
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === "hotel_os_v2_desk_staff_json" ||
        e.key === "hotel_os_v2_desk_jwt" ||
        e.key === null
      ) {
        setSignedInName(readV2Staff()?.fullName ?? null);
        setHasToken(Boolean(readV2DeskToken()));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [pathname]);

  const syncLabel = useMemo(() => {
    if (syncState === "syncing") return "Syncing snapshot…";
    if (syncState === "conflict") return "Snapshot error — check API";
    if (syncState === "offline_buffered") return "Offline / cache";
    return lastSyncedAt
      ? `RAM · ${new Date(lastSyncedAt).toLocaleTimeString()}`
      : "Awaiting snapshot";
  }, [syncState, lastSyncedAt]);

  const onSignOut = () => {
    clearV2Session();
    setSignedInName(null);
    setHasToken(false);
    useRamEngine.getState().setStaff("", "");
    router.push("/v2");
  };

  return (
    <div className="v2-cockpit dark min-h-[var(--app-height,100dvh)] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white v2-cockpit-ambient">
      <V2DeskSnapshotHydration />
      <V2DeskWsRefresh />
      <V2CommandPaletteHost />

      <div className="bg-amber-500/12 border-b border-amber-400/25 text-amber-100 text-xs px-4 py-2 text-center shrink-0">
        v2 preview cockpit — Innora <code className="text-amber-200">/erp</code> stays live until{" "}
        <code className="text-amber-200">V2_DESK_CUTOVER=true</code>. Requires{" "}
        <code className="text-amber-200">apps/api</code> +{" "}
        <code className="text-amber-200">NEXT_PUBLIC_DESK_API_URL</code>.
      </div>

      <header className="v2-chrome-bar h-14 px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-50 transform-gpu [transform:translateZ(0)]">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/v2" className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white shadow-[0_0_16px_rgba(99,102,241,0.5)] [transform:translateZ(0)]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors truncate">
                  Hotel OS v2
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-semibold shrink-0">
                  COCKPIT
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">{propertyName || "Property"}</p>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-400 text-xs max-w-[220px] lg:max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">Ctrl+K command palette</span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Till (snapshot)
            </span>
            <OdometerTicker
              value={expectedCashBtn}
              prefix="Nu. "
              className="text-sm font-bold text-emerald-400 font-mono"
            />
          </div>

          <div className="text-[10px] text-slate-500 max-w-[120px] hidden lg:block text-right leading-tight">
            {syncLabel}
          </div>

          {hasToken ? (
            <div className="flex items-center gap-2">
              <Link
                href="/v2"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-xs transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <div className="text-left hidden sm:block min-w-0">
                  <span className="text-white font-medium block leading-tight truncate max-w-[100px]">
                    {signedInName || staffName || "Signed in"}
                  </span>
                  <span className="text-[10px] text-indigo-400 block -mt-0.5">Switch PIN</span>
                </div>
              </Link>
              <button
                type="button"
                onClick={onSignOut}
                className="p-2 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/erp/login"
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside
          className="v2-rail hidden sm:flex w-16 shrink-0 flex-col items-center gap-2 py-3 border-r border-white/[0.08] [transform:translateZ(0)]"
          aria-label="v2 module rail"
        >
          {V2_RAIL.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-colors [transform:translateZ(0)] ${
                  active
                    ? "bg-indigo-600/25 border-indigo-500/50 text-white shadow-[0_0_14px_rgba(99,102,241,0.35)]"
                    : "bg-slate-900/70 border-white/10 text-slate-400 hover:text-white hover:border-white/20"
                }`}
              >
                <Icon className="w-5 h-5" />
              </Link>
            );
          })}
        </aside>

        <main className="flex-1 min-w-0 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
