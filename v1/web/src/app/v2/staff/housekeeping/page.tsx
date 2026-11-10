"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { BrushCleaning, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { NeoGlassCard, TactileButton } from "@/components/ui/neo-spatial";
import { EmptyState } from "@/components/ui/empty-state";
import {
  deskFetchJson,
  newIdempotencyKey,
  DeskApiError,
} from "@/lib/v2/desk-api-client";
import { readV2DeskToken } from "@/lib/v2/desk-api";

type HkRoom = {
  id: string;
  label: string;
  hk_status: string;
  housekeeping_status?: string;
  floor_label: string | null;
  occupant?: { bookingId: string; guest: string | null; status: string | null } | null;
};

type HkBoard = {
  rooms: HkRoom[];
};

const STATUS_OPTIONS = ["clean", "dirty", "inspect", "ooo"] as const;

export default function V2StaffHousekeepingPage() {
  const signedIn = Boolean(readV2DeskToken());
  const [board, setBoard] = useState<HkBoard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const loadBoard = useCallback(() => {
    if (!signedIn) return;
    start(async () => {
      try {
        setLoadError(null);
        const data = await deskFetchJson<HkBoard>("/v1/hk/board");
        setBoard(data);
      } catch (err) {
        console.error("[v2/staff/housekeeping] board", err);
        setLoadError(err instanceof Error ? err.message : String(err));
      }
    });
  }, [signedIn]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const setStatus = (roomUnitId: string, status: (typeof STATUS_OPTIONS)[number]) => {
    if (!signedIn) return;
    start(async () => {
      try {
        await deskFetchJson("/v1/hk/status", {
          method: "POST",
          body: JSON.stringify({
            roomUnitId,
            status,
            idempotencyKey: newIdempotencyKey(),
          }),
        });
        toast.success(`Room → ${status}`);
        loadBoard();
      } catch (err) {
        console.error("[v2/staff/housekeeping] status", err);
        toast.error(err instanceof DeskApiError ? err.message : String(err));
      }
    });
  };

  const rooms = board?.rooms ?? [];
  const dirtyFirst = [...rooms].sort((a, b) => {
    const ao = (a.housekeeping_status ?? a.hk_status) === "dirty" ? 0 : 1;
    const bo = (b.housekeeping_status ?? b.hk_status) === "dirty" ? 0 : 1;
    return ao - bo || String(a.label).localeCompare(String(b.label));
  });

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-56px)] bg-[#030712] text-slate-100 p-4 sm:p-6 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center [transform:translateZ(0)]">
            <BrushCleaning className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Housekeeping</h1>
            <p className="text-[11px] text-slate-500">
              GET <code className="text-slate-400">/v1/hk/board</code> · POST{" "}
              <code className="text-slate-400">/v1/hk/status</code> (idempotent)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TactileButton
            variant="secondary"
            size="sm"
            disabled={!signedIn || pending}
            onClick={() => loadBoard()}
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
            Sign in on <Link href="/v2" className="underline">/v2</Link> to load the HK board.
          </p>
        </NeoGlassCard>
      ) : null}

      {loadError ? (
        <p className="text-sm text-rose-400 mb-4" role="alert">
          {loadError}
        </p>
      ) : null}

      {signedIn && !loadError && rooms.length === 0 && !pending ? (
        <EmptyState
          className="border-white/10 bg-slate-900/40 text-slate-100"
          title="No room units"
          description="This property has no rows in room_units, or the board query returned empty."
        />
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {dirtyFirst.map((r) => {
          const hk = r.housekeeping_status ?? r.hk_status;
          const occ = r.occupant;
          const occupiedBlock = hk === "occupied";
          return (
            <NeoGlassCard
              key={r.id}
              className={`p-4 glass-card border-white/[0.12] [transform:translateZ(0)] ${
                hk === "dirty" ? "border-rose-500/35" : "border-white/[0.12]"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-lg font-bold text-white font-mono">{r.label}</p>
                  <p className="text-[10px] text-slate-500 uppercase">{r.floor_label || "Floor —"}</p>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border ${
                    hk === "clean"
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : hk === "dirty"
                        ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                        : "bg-amber-500/15 text-amber-300 border-amber-500/25"
                  }`}
                >
                  {hk}
                </span>
              </div>
              {occ ? (
                <p className="text-xs text-slate-400 mb-3 truncate" title={occ.guest ?? ""}>
                  {occ.guest || "Occupant"} · {occ.status || "—"}
                </p>
              ) : (
                <p className="text-xs text-slate-500 mb-3">Vacant / no assignment tonight</p>
              )}
              {occupiedBlock ? (
                <p className="text-[11px] text-rose-300">
                  Occupied — HK changes at checkout (API rule).
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={pending}
                      onClick={() => setStatus(r.id, s)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                        hk === s
                          ? "bg-indigo-600/40 border-indigo-400 text-white"
                          : "bg-slate-900/80 border-white/10 text-slate-300 hover:border-white/25"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </NeoGlassCard>
          );
        })}
      </div>

      {pending ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-slate-200 px-3 py-2 rounded-xl border border-white/10 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : null}
    </div>
  );
}
