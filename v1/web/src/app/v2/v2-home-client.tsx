"use client";

import React from "react";
import Link from "next/link";
import {
  Building2,
  UtensilsCrossed,
  ShoppingCart,
  FileText,
  ShieldAlert,
  ArrowRight,
  Zap,
} from "lucide-react";
import { TouchStaffPinGateway } from "@/components/auth/TouchStaffPinGateway";
import { NeoGlassCard } from "@/components/ui/neo-spatial";

export interface V2HomeClientProps {
  /** Resolved on the server from FLAGSHIP / NEXT_PUBLIC defaults. */
  defaultPropertySlug: string;
}

export function V2HomeClient({ defaultPropertySlug }: V2HomeClientProps) {
  return (
    <div className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full flex flex-col gap-8">
      <section>
        <TouchStaffPinGateway propertySlug={defaultPropertySlug} />
      </section>

      <section className="pt-6 border-t border-white/[0.08]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Direct Enterprise Workspaces (Bypass PIN)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Jump straight into any v2 operational screen without legacy v1
              redirects.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Link href="/v2/desk" className="group">
            <NeoGlassCard className="p-4 h-full flex flex-col justify-between hover:border-indigo-500/50 transition-all cursor-pointer">
              <div>
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Building2 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-indigo-300">
                  Front Desk Cockpit
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  0ms In-Memory Tape Chart, arrivals, StayHub drawer & folios.
                </p>
              </div>
              <span className="text-xs font-semibold text-indigo-400 mt-3 inline-flex items-center gap-1">
                Open{" "}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </NeoGlassCard>
          </Link>

          <Link href="/v2/pos" className="group">
            <NeoGlassCard className="p-4 h-full flex flex-col justify-between hover:border-emerald-500/50 transition-all cursor-pointer">
              <div>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <UtensilsCrossed className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-emerald-300">
                  1-Tap POS Till
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Touch menu, 1-tap room charge, 10% BST/SC & RMA QR.
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-400 mt-3 inline-flex items-center gap-1">
                Open{" "}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </NeoGlassCard>
          </Link>

          <Link href="/v2/purchases" className="group">
            <NeoGlassCard className="p-4 h-full flex flex-col justify-between hover:border-amber-500/50 transition-all cursor-pointer">
              <div>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-amber-300">
                  Purchases & Till
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Centenary Market ledger + automated cash drawer auto-deduction.
                </p>
              </div>
              <span className="text-xs font-semibold text-amber-400 mt-3 inline-flex items-center gap-1">
                Open{" "}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </NeoGlassCard>
          </Link>

          <Link href="/v2/reports" className="group">
            <NeoGlassCard className="p-4 h-full flex flex-col justify-between hover:border-sky-500/50 transition-all cursor-pointer">
              <div>
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-sky-300">
                  16-Report Studio
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  DRC Form BST-3, Daily Audit, 80mm thermal slip & B2B MoUs.
                </p>
              </div>
              <span className="text-xs font-semibold text-sky-400 mt-3 inline-flex items-center gap-1">
                Open{" "}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </NeoGlassCard>
          </Link>

          <Link href="/v2/superadmin" className="group">
            <NeoGlassCard className="p-4 h-full flex flex-col justify-between hover:border-purple-500/50 transition-all cursor-pointer">
              <div>
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-purple-300">
                  SuperAdmin Billing
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Live tenants from API, license tier/status, bypass tokens,
                  marketplace commission ledger.
                </p>
              </div>
              <span className="text-xs font-semibold text-purple-400 mt-3 inline-flex items-center gap-1">
                Open{" "}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </NeoGlassCard>
          </Link>
        </div>
      </section>
    </div>
  );
}
