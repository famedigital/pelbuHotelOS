"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ChefHat, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { NeoGlassCard, TactileButton } from "@/components/ui/neo-spatial";
import { EmptyState } from "@/components/ui/empty-state";
import {
  deskFetchJson,
  newIdempotencyKey,
  DeskApiError,
} from "@/lib/v2/desk-api-client";
import { readV2DeskToken } from "@/lib/v2/desk-api";

type KdsTicket = {
  id: string;
  status: string;
  station: string;
  created_at: string;
  orders: {
    id: string;
    table_label: string | null;
    booking_id: string | null;
    total_btn: number;
    order_lines: Array<{
      id: string;
      name: string;
      qty: number;
      notes: string | null;
      status: string;
    }>;
  };
};

export default function V2StaffKdsPage() {
  const signedIn = Boolean(readV2DeskToken());
  const [tickets, setTickets] = useState<KdsTicket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const loadKds = useCallback(() => {
    if (!signedIn) return;
    start(async () => {
      try {
        setError(null);
        const data = await deskFetchJson<{ tickets: KdsTicket[] }>("/v1/kds/tickets");
        setTickets(data.tickets ?? []);
      } catch (err) {
        console.error("[v2/staff/kds] tickets", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }, [signedIn]);

  useEffect(() => {
    loadKds();
    const t = window.setInterval(loadKds, 8000);
    return () => window.clearInterval(t);
  }, [loadKds]);

  const bump = (kotId: string, status: "preparing" | "ready" | "served") => {
    start(async () => {
      try {
        await deskFetchJson("/v1/kds/status", {
          method: "POST",
          body: JSON.stringify({
            kotId,
            status,
            idempotencyKey: newIdempotencyKey(),
          }),
        });
        toast.success(`KOT → ${status}`);
        loadKds();
      } catch (err) {
        console.error("[v2/staff/kds] bump", err);
        toast.error(err instanceof DeskApiError ? err.message : String(err));
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-56px)] bg-[#030712] text-slate-100 p-4 sm:p-6 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center [transform:translateZ(0)]">
            <ChefHat className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Kitchen display</h1>
            <p className="text-[11px] text-slate-500">
              GET <code className="text-slate-400">/v1/kds/tickets</code> · POST{" "}
              <code className="text-slate-400">/v1/kds/status</code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TactileButton
            variant="secondary"
            size="sm"
            disabled={!signedIn || pending}
            onClick={() => loadKds()}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </TactileButton>
          <Link
            href="/v2"
            className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded-lg border border-white/10"
          >
            PIN
          </Link>
        </div>
      </div>

      {!signedIn ? (
        <NeoGlassCard className="p-4 mb-4 border-amber-500/20 glass-card">
          <p className="text-sm text-amber-200">
            Sign in on <Link href="/v2" className="underline">/v2</Link> to poll KDS tickets.
          </p>
        </NeoGlassCard>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-400 mb-4" role="alert">
          {error}
        </p>
      ) : null}

      {signedIn && !error && tickets.length === 0 && !pending ? (
        <EmptyState
          className="border-white/10 bg-slate-900/40 text-slate-100"
          title="No open KOT tickets"
          description="Fire an order from POS, or wait for new kitchen tickets."
        />
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {tickets.map((t) => (
          <NeoGlassCard
            key={t.id}
            className="p-4 glass-card border-white/[0.12] bg-slate-900/80 [transform:translateZ(0)]"
          >
            <div className="flex justify-between text-xs text-slate-400 mb-2 font-mono">
              <span>{t.orders.table_label || t.station}</span>
              <span className="text-amber-400">{t.status}</span>
            </div>
            {t.orders.order_lines.map((l) => (
              <div key={l.id} className="text-sm text-white py-0.5 border-b border-white/5 last:border-0">
                <span className="font-mono text-indigo-400 mr-2">{l.qty}×</span>
                {l.name}
                {l.notes ? (
                  <span className="block text-[10px] text-slate-500">{l.notes}</span>
                ) : null}
              </div>
            ))}
            <p className="text-[10px] text-slate-500 mt-2 font-mono">
              Nu. {t.orders.total_btn} · {new Date(t.created_at).toLocaleTimeString()}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => bump(t.id, "preparing")}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30"
              >
                Cook
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => bump(t.id, "ready")}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              >
                Ready
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => bump(t.id, "served")}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-200 border border-white/10"
              >
                Served
              </button>
            </div>
          </NeoGlassCard>
        ))}
      </div>

      {pending ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-slate-200 px-3 py-2 rounded-xl border border-white/10 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : null}
    </div>
  );
}
