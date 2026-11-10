"use client";

import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  RefreshCw,
  Loader2,
  Clock,
  BedDouble,
  LogOut,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { NeoGlassCard, TactileButton } from "@/components/ui/neo-spatial";
import { V2StayHubDrawer } from "@/components/v2/V2StayHubDrawer";
import { deskFetchJson, DeskApiError } from "@/lib/v2/desk-api-client";
import { readV2DeskToken } from "@/lib/v2/desk-api";

type DayBoard = {
  businessDate: string;
  arrivals: Array<Record<string, unknown>>;
  departures: Array<Record<string, unknown>>;
  inHouse: Array<Record<string, unknown>>;
  housekeeping: Record<string, number>;
  roomCount: number;
};

type StayViewPayload = {
  from: string;
  to: string;
  nights: number;
  rooms: Array<{
    id: string;
    label: string;
    roomTypeId: string;
    roomTypeName: string | null;
    hkStatus: string | null;
  }>;
  stays: Array<{
    bookingId: string;
    confirmationCode: string;
    guestName: string;
    status: string;
    checkIn: string;
    checkOut: string;
    roomUnitIds: string[];
  }>;
};

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000)
    .toISOString()
    .slice(0, 10);
}

function guestLabel(row: Record<string, unknown>): string {
  return String(row.contact_name ?? row.guestName ?? "—");
}

function bookingIdFromRow(row: Record<string, unknown>): string | null {
  const id = row.id ?? row.bookingId;
  return typeof id === "string" ? id : null;
}

function agencyLabel(row: Record<string, unknown>): string {
  const agents = row.agents as { company_name?: string } | null | undefined;
  if (agents?.company_name) return agents.company_name;
  return "Direct";
}

export const V2FrontDeskCockpit: React.FC = () => {
  const [board, setBoard] = useState<DayBoard | null>(null);
  const [stayView, setStayView] = useState<StayViewPayload | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [tapeError, setTapeError] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const signedIn = Boolean(readV2DeskToken());

  const loadBoard = useCallback(() => {
    start(async () => {
      try {
        setBoardError(null);
        const data = await deskFetchJson<DayBoard>("/v1/desk/day");
        setBoard(data);
      } catch (err) {
        console.error("[V2FrontDeskCockpit] day board", err);
        const msg =
          err instanceof DeskApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        setBoardError(msg);
        toast.error(msg);
      }
    });
  }, []);

  const loadStayView = useCallback(
    (from: string) => {
      start(async () => {
        try {
          setTapeError(null);
          const data = await deskFetchJson<StayViewPayload>(
            `/v1/calendar/stayview?from=${encodeURIComponent(from)}&nights=14`,
          );
          setStayView(data);
        } catch (err) {
          console.error("[V2FrontDeskCockpit] stayview", err);
          const msg =
            err instanceof DeskApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : String(err);
          setTapeError(msg);
        }
      });
    },
    [],
  );

  useEffect(() => {
    if (!signedIn) return;
    loadBoard();
  }, [signedIn, loadBoard]);

  useEffect(() => {
    if (!signedIn || !board?.businessDate) return;
    loadStayView(board.businessDate);
  }, [signedIn, board?.businessDate, loadStayView]);

  const tapeDates = useMemo(() => {
    if (!stayView) return [];
    return Array.from({ length: stayView.nights }, (_, i) => addDays(stayView.from, i));
  }, [stayView]);

  const stayOnTape = (roomId: string, date: string) =>
    stayView?.stays.find(
      (s) =>
        s.roomUnitIds.includes(roomId) && s.checkIn <= date && s.checkOut > date,
    );

  const arrivals = board?.arrivals ?? [];
  const departures = board?.departures ?? [];
  const inHouse = board?.inHouse ?? [];
  const hk = board?.housekeeping ?? {};

  const occupancyPct =
    board && board.roomCount > 0
      ? Math.round((inHouse.length / board.roomCount) * 100)
      : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-[#030712] text-slate-100 overflow-hidden font-sans">
      <header className="h-14 border-b border-white/[0.12] bg-slate-950/95 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 glass-card [transform:translateZ(0)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white truncate">Unified today cockpit</h1>
            <p className="text-[10px] text-slate-400 font-mono truncate">
              {board?.businessDate ?? "—"} · API day + StayView tape ·{" "}
              {signedIn ? "JWT" : "not signed in"}
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-400 text-xs max-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate">Ctrl+K</span>
        </div>

        <div className="flex items-center gap-2">
          <TactileButton
            variant="secondary"
            size="sm"
            disabled={!signedIn || pending}
            onClick={() => {
              loadBoard();
              if (board?.businessDate) loadStayView(board.businessDate);
            }}
            icon={pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </TactileButton>
          {!signedIn ? (
            <Link
              href="/v2"
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30"
            >
              PIN sign-in
            </Link>
          ) : null}
        </div>
      </header>

      {!signedIn ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <NeoGlassCard className="max-w-md p-6 text-center glass-card [transform:translateZ(0)]">
            <p className="text-sm text-slate-300 mb-4">
              Sign in with staff PIN on{" "}
              <Link href="/v2" className="text-indigo-400 underline">
                /v2
              </Link>{" "}
              to load live arrivals, the tape, and StayHub against the desk API.
            </p>
            <Link
              href="/v2"
              className="inline-flex text-xs font-semibold px-4 py-2 rounded-xl bg-indigo-600 text-white"
            >
              Open PIN gateway
            </Link>
          </NeoGlassCard>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden min-h-0">
          {/* Pulse */}
          <div className="col-span-12 md:col-span-3 border-r border-white/[0.08] bg-slate-950/40 p-4 flex flex-col gap-4 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Today&apos;s pulse
              </span>
              {pending ? <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> : null}
            </div>

            {boardError ? (
              <p className="text-xs text-rose-400">{boardError}</p>
            ) : null}

            <div className="flex flex-wrap gap-2 text-[10px] font-mono">
              {Object.entries(hk).map(([k, v]) => (
                <span
                  key={k}
                  className="px-2 py-0.5 rounded border border-white/10 bg-slate-900/80 text-slate-300"
                >
                  {k}: {v}
                </span>
              ))}
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white mb-2">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Arrivals ({arrivals.length})
              </div>
              {arrivals.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No arrivals for business date.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {arrivals.map((row, idx) => {
                    const bid = bookingIdFromRow(row);
                    return (
                      <button
                        key={bid ?? `arrival-${idx}`}
                        type="button"
                        disabled={!bid}
                        onClick={() => bid && setSelectedBookingId(bid)}
                        className={`text-left p-3 rounded-xl border text-xs transition-colors ${
                          bid && selectedBookingId === bid
                            ? "bg-indigo-600/20 border-indigo-500"
                            : "bg-slate-900/60 border-white/5 hover:border-white/15"
                        }`}
                      >
                        <div className="font-semibold text-white truncate">{guestLabel(row)}</div>
                        <div className="text-[10px] text-slate-500 truncate">{agencyLabel(row)}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white mb-2">
                <BedDouble className="w-3.5 h-3.5 text-emerald-400" />
                In-house ({inHouse.length})
              </div>
              {inHouse.length === 0 ? (
                <p className="text-xs text-slate-500 italic">None.</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {inHouse.map((row, idx) => {
                    const bid = bookingIdFromRow(row);
                    return (
                      <button
                        key={bid ?? `inhouse-${idx}`}
                        type="button"
                        disabled={!bid}
                        onClick={() => bid && setSelectedBookingId(bid)}
                        className={`text-left p-2 rounded-lg border text-[11px] ${
                          bid && selectedBookingId === bid
                            ? "border-indigo-500 bg-indigo-600/15"
                            : "border-white/5 bg-slate-900/50"
                        }`}
                      >
                        <span className="text-white font-medium truncate block">{guestLabel(row)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white mb-2">
                <LogOut className="w-3.5 h-3.5 text-amber-400" />
                Departures ({departures.length})
              </div>
              {departures.length === 0 ? (
                <p className="text-xs text-slate-500 italic">None.</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                  {departures.map((row, idx) => {
                    const r = row as Record<string, unknown>;
                    const bid = bookingIdFromRow(r);
                    return (
                      <button
                        key={bid ?? `dep-${idx}`}
                        type="button"
                        disabled={!bid}
                        onClick={() => bid && setSelectedBookingId(bid)}
                        className="text-left p-2 rounded-lg border border-white/5 bg-slate-900/50 text-[11px] text-white truncate"
                      >
                        {guestLabel(r)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Tape */}
          <div className="col-span-12 md:col-span-5 flex flex-col min-h-0 p-4 overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
              <div>
                <h2 className="text-base font-bold text-white">Tape chart</h2>
                <p className="text-[11px] text-slate-400">
                  From GET /v1/calendar/stayview · opaque cells
                </p>
              </div>
            </div>
            {tapeError ? <p className="text-xs text-rose-400 mb-2">{tapeError}</p> : null}
            <div className="flex-1 min-h-0 rounded-xl border border-white/10 bg-slate-950 overflow-auto">
              {!stayView ? (
                <div className="p-8 text-center text-slate-500 text-sm">Loading tape…</div>
              ) : stayView.rooms.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No room units for property.</div>
              ) : (
                <table className="border-collapse text-[10px] min-w-max">
                  <thead>
                    <tr className="bg-slate-900 sticky top-0 z-10">
                      <th className="sticky left-0 z-20 bg-slate-900 border-b border-white/10 p-2 text-left text-slate-300 font-semibold min-w-[88px]">
                        Room
                      </th>
                      {tapeDates.map((d) => (
                        <th
                          key={d}
                          className="border-b border-white/10 p-1.5 text-slate-400 font-mono min-w-[56px]"
                        >
                          {d.slice(5)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stayView.rooms.map((room) => (
                      <tr key={room.id}>
                        <td className="sticky left-0 z-10 bg-slate-950 border-b border-white/5 p-2 align-top">
                          <div className="font-semibold text-white">{room.label}</div>
                          <div className="text-[9px] text-slate-500 truncate max-w-[80px]">
                            {room.roomTypeName || room.hkStatus || "—"}
                          </div>
                        </td>
                        {tapeDates.map((d) => {
                          const stay = stayOnTape(room.id, d);
                          return (
                            <td key={d} className="border-b border-white/5 p-0.5 align-top">
                              {stay ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedBookingId(stay.bookingId)}
                                  className={`w-full min-h-[32px] rounded px-0.5 py-1 text-[9px] leading-tight text-left text-white border border-white/10 ${
                                    stay.status === "checked_in"
                                      ? "bg-indigo-900/90"
                                      : "bg-amber-900/80"
                                  }`}
                                  title={stay.confirmationCode}
                                >
                                  {stay.guestName.split(/\s+/)[0]}
                                </button>
                              ) : (
                                <div className="min-h-[32px] rounded bg-slate-900/80 border border-dashed border-white/5" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <NeoGlassCard className="mt-3 p-3 flex items-center justify-between glass-card [transform:translateZ(0)] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Occupancy (in-house)</p>
                  <p className="text-sm font-bold text-white font-mono">
                    {occupancyPct}% ({inHouse.length} / {board?.roomCount ?? "—"})
                  </p>
                </div>
              </div>
            </NeoGlassCard>
          </div>

          {/* StayHub */}
          <V2StayHubDrawer
            bookingId={selectedBookingId}
            onClose={() => setSelectedBookingId(null)}
            onMutated={() => {
              loadBoard();
              if (board?.businessDate) loadStayView(board.businessDate);
            }}
          />
        </div>
      )}
    </div>
  );
};
