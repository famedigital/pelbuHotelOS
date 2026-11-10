"use client";

import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { RefreshCw, Loader2, Building2 } from "lucide-react";
import { NeoGlassCard, TactileButton } from "@/components/ui/neo-spatial";
import { V2StayHubDrawer } from "@/components/v2/V2StayHubDrawer";
import {
  deskFetchJson,
  newIdempotencyKey,
  DeskApiError,
} from "@/lib/v2/desk-api-client";
import { readV2DeskToken } from "@/lib/v2/desk-api";
import { refreshV2DeskEngine } from "@/lib/v2/rehydrate-engine";

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

export const V2StayViewPage: React.FC = () => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" });
  const [from, setFrom] = useState(today);
  const [data, setData] = useState<StayViewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const signedIn = Boolean(readV2DeskToken());

  const dragBookingRef = React.useRef<{
    bookingId: string;
    checkIn: string;
    checkOut: string;
  } | null>(null);

  const load = useCallback(() => {
    if (!signedIn) return;
    start(async () => {
      try {
        setError(null);
        const res = await deskFetchJson<StayViewPayload>(
          `/v1/calendar/stayview?from=${encodeURIComponent(from)}&nights=14`,
        );
        setData(res);
      } catch (err) {
        console.error("[V2StayViewPage]", err);
        const msg =
          err instanceof DeskApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        setError(msg);
      }
    });
  }, [signedIn, from]);

  useEffect(() => {
    load();
  }, [load]);

  const dates = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: data.nights }, (_, i) => addDays(data.from, i));
  }, [data]);

  const stayOn = (roomId: string, date: string) =>
    data?.stays.find(
      (s) =>
        s.roomUnitIds.includes(roomId) && s.checkIn <= date && s.checkOut > date,
    );

  const onDragStartStay = (
    e: React.DragEvent,
    stay: StayViewPayload["stays"][0],
  ) => {
    dragBookingRef.current = {
      bookingId: stay.bookingId,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
    };
    e.dataTransfer.setData("text/plain", stay.bookingId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDropAssign = (e: React.DragEvent, roomId: string) => {
    e.preventDefault();
    const ctx = dragBookingRef.current;
    dragBookingRef.current = null;
    if (!ctx || !signedIn) return;
    start(async () => {
      try {
        await deskFetchJson("/v1/stays/assign-room", {
          method: "POST",
          body: JSON.stringify({
            bookingId: ctx.bookingId,
            roomUnitId: roomId,
            idempotencyKey: newIdempotencyKey(),
          }),
        });
        toast.success("Room assignment saved");
        await refreshV2DeskEngine();
        load();
      } catch (err) {
        console.error("[V2StayViewPage] assign-room", err);
        toast.error(err instanceof DeskApiError ? err.message : String(err));
      }
    });
  };

  if (!signedIn) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-[#030712] text-slate-100">
        <NeoGlassCard className="max-w-md p-6 text-center glass-card">
          <Building2 className="w-10 h-10 mx-auto text-indigo-400 mb-3" />
          <p className="text-sm text-slate-300 mb-4">
            Sign in on <Link href="/v2" className="text-indigo-400 underline">/v2</Link> to load StayView from the API.
          </p>
        </NeoGlassCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)] bg-[#030712] text-slate-100 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 min-h-0 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 shrink-0">
          <div>
            <h1 className="text-lg font-bold text-white">StayView</h1>
            <p className="text-[11px] text-slate-400">GET /v1/calendar/stayview · drag stay onto row = assign-room</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white"
            />
            <TactileButton
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => load()}
              icon={pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </TactileButton>
          </div>
        </div>

        {error ? <p className="text-xs text-rose-400 mb-2">{error}</p> : null}

        <div className="flex-1 min-h-0 rounded-xl border border-white/10 bg-slate-950 overflow-auto">
          {!data ? (
            <div className="p-8 text-center text-slate-500">Loading…</div>
          ) : data.rooms.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No room units</div>
          ) : (
            <table className="border-collapse text-[10px] min-w-max">
              <thead>
                <tr className="bg-slate-900 sticky top-0 z-10">
                  <th className="sticky left-0 z-20 bg-slate-900 border-b border-white/10 p-2 text-left min-w-[100px]">
                    Room
                  </th>
                  {dates.map((d) => (
                    <th key={d} className="border-b border-white/10 p-1.5 text-slate-400 font-mono min-w-[64px]">
                      {d.slice(5)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rooms.map((room) => (
                  <tr key={room.id}>
                    <td
                      className="sticky left-0 z-10 bg-slate-950 border-b border-white/5 p-2 align-top"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => onDropAssign(e, room.id)}
                    >
                      <div className="font-semibold text-white">{room.label}</div>
                      <div className="text-[9px] text-slate-500">{room.roomTypeName || room.hkStatus}</div>
                    </td>
                    {dates.map((d) => {
                      const stay = stayOn(room.id, d);
                      return (
                        <td key={d} className="border-b border-white/5 p-0.5 align-top">
                          {stay ? (
                            <button
                              type="button"
                              draggable
                              onDragStart={(ev) => onDragStartStay(ev, stay)}
                              onClick={() => setSelectedId(stay.bookingId)}
                              className={`w-full min-h-[36px] rounded px-1 py-1 text-[9px] text-left text-white border border-white/10 ${
                                stay.status === "checked_in" ? "bg-indigo-900/90" : "bg-amber-900/75"
                              }`}
                            >
                              {stay.guestName.split(/\s+/)[0]}
                            </button>
                          ) : (
                            <div
                              className="min-h-[36px] rounded bg-slate-900/50 border border-dashed border-white/5"
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => onDropAssign(e, room.id)}
                            />
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
      </div>

      <V2StayHubDrawer
        bookingId={selectedId}
        onClose={() => setSelectedId(null)}
        onMutated={() => load()}
      />
    </div>
  );
};
