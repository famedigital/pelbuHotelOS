"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  Printer,
  PlusCircle,
  LogOut,
  BedDouble,
  TrendingUp,
} from "lucide-react";
import {
  NeoGlassCard,
  TactileButton,
  OdometerTicker,
} from "@/components/ui/neo-spatial";
import {
  useRamEngine,
  getExpectedCashTillBtn,
  type EngineStay,
  type EngineRoom,
} from "@hotel-os/engine";
import { V2FrontDeskCockpit } from "@/components/v2/V2FrontDeskCockpit";

function thimphuToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" });
}

function nightCount(stay: EngineStay): number {
  const a = Date.parse(stay.arrivalDate);
  const d = Date.parse(stay.departureDate);
  if (!Number.isFinite(a) || !Number.isFinite(d)) return 0;
  const nights = Math.round((d - a) / 86400000);
  return Math.max(0, nights);
}

export type FrontDeskCockpitProps = {
  /**
   * `ram` — optimistic RAM/WAL queue (legacy /erp/today).
   * `api` — `/v2/desk` unified cockpit: day board + StayView tape + StayHub → real desk API.
   */
  variant?: "ram" | "api";
};

export const FrontDeskCockpit: React.FC<FrontDeskCockpitProps> = ({ variant = "ram" }) => {
  if (variant === "api") {
    return <V2FrontDeskCockpit />;
  }

  const {
    propertyName,
    syncState,
    lastSyncedAt,
    cashTill,
    rooms,
    stays,
    staffId,
    staffName,
    checkInStay,
    checkOutStay,
    shiftRoom,
    setHousekeepingStatus,
    postFolioCharge,
  } = useRamEngine();

  const [selectedStayId, setSelectedStayId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const deskStaffId = staffId || "unknown_staff";

  const today = thimphuToday();

  useEffect(() => {
    if (stays.length === 0) {
      setSelectedStayId(null);
      return;
    }
    setSelectedStayId((prev) => {
      if (prev && stays.some((s) => s.id === prev)) return prev;
      const inHouse = stays.find((s) => s.status === "in_house");
      return inHouse?.id ?? stays[0]!.id;
    });
  }, [stays]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const selectedStay = stays.find((s) => s.id === selectedStayId) ?? null;
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  const arrivals = stays.filter((s) => s.status === "confirmed" || s.status === "expected");
  const inHouse = stays.filter((s) => s.status === "in_house");
  const departuresToday = inHouse.filter((s) => s.departureDate === today);

  const cleanRoomsCount = rooms.filter((r) => r.status === "clean").length;
  const dirtyRoomsCount = rooms.filter((r) => r.status === "dirty").length;
  const expectedCashBtn = getExpectedCashTillBtn(cashTill);

  const firstVacantCleanRoom = useMemo((): EngineRoom | null => {
    const occupied = new Set(
      stays.filter((s) => s.status === "in_house" && s.roomId).map((s) => s.roomId as string),
    );
    return (
      rooms.find(
        (r) => r.status === "clean" && !r.occupiedStayId && !occupied.has(r.id),
      ) ?? null
    );
  }, [rooms, stays]);

  const handleInstantCheckIn = (stayId: string, targetRoomId: string) => {
    void checkInStay(stayId, targetRoomId, deskStaffId);
    showToast("Check-in queued in RAM (sync to API in a later wave)");
  };

  const handleInstantCheckOut = (stayId: string) => {
    void checkOutStay(stayId, deskStaffId);
    showToast("Check-out queued in RAM (sync to API in a later wave)");
  };

  const handleAddSampleCharge = (stayId: string) => {
    void postFolioCharge({
      id: `chg_${Date.now()}`,
      stayId,
      description: "Room Dining: Ema Datshi & Red Rice",
      category: "fnb",
      quantity: 1,
      rateBtn: 480,
      serviceChargeBtn: 48,
      bstTaxBtn: 52.8,
      totalBtn: 580.8,
      postedAt: new Date().toISOString(),
      postedByStaffId: deskStaffId,
    });
    showToast("Charge queued in RAM (confirm on production folio APIs)");
  };

  const syncPill =
    syncState === "syncing"
      ? "Syncing snapshot…"
      : syncState === "conflict"
      ? "Snapshot error"
      : syncState === "offline_buffered"
      ? "Cache / offline"
      : lastSyncedAt
      ? `Live · ${new Date(lastSyncedAt).toLocaleTimeString()}`
      : "Empty board";

  const occupancyPct =
    rooms.length > 0 ? Math.round((inHouse.length / rooms.length) * 100) : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-[#030712] text-slate-100 overflow-hidden font-sans">
      {/* Nested 56px cockpit chrome (primary viewport below layout header) */}
      <header className="h-14 border-b border-white/[0.12] bg-slate-950/95 px-6 flex items-center justify-between shrink-0 z-30 glass-card [transform:translateZ(0)]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-[0_0_12px_rgba(99,102,241,0.5)] [transform:translateZ(0)]">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">{propertyName || "—"}</h1>
              <p className="text-[10px] text-slate-400 font-mono">{syncPill}</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>RAM engine</span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-400 text-xs w-72 [transform:translateZ(0)]">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <span>Ctrl+K — command palette</span>
          <kbd className="ml-auto text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-white/10">
            ⌘K
          </kbd>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
              Expected till cash
            </p>
            <OdometerTicker value={expectedCashBtn} prefix="Nu. " className="text-sm font-bold text-emerald-400" />
          </div>

          <Link
            href="/erp/login"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 transition-colors text-xs [transform:translateZ(0)]"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-[10px] font-bold text-white">
              {(staffName || cashTill.activeShiftStaffName || "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="text-left hidden sm:block">
              <span className="font-medium text-white block">
                {staffName || cashTill.activeShiftStaffName || "Not signed in"}
              </span>
              <span className="text-[10px] text-slate-400 block -mt-0.5">PIN switch</span>
            </div>
          </Link>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* COLUMN 1: TODAY'S PULSE (~25%) */}
        <div className="col-span-12 md:col-span-3 border-r border-white/[0.08] bg-slate-950/40 p-4 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              Today&apos;s pulse
            </span>
            <div className="flex gap-2 text-[11px] font-mono">
              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {cleanRoomsCount} clean
              </span>
              <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                {dirtyRoomsCount} dirty
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Expected arrivals ({arrivals.length})</span>
              </span>
            </div>

            {arrivals.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-2">
                No confirmed/expected stays in the snapshot window.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {arrivals.map((stay) => (
                  <div
                    key={stay.id}
                    onClick={() => setSelectedStayId(stay.id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      selectedStayId === stay.id
                        ? "bg-indigo-600/20 border-indigo-500"
                        : "bg-slate-900/60 border-white/5 hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span>{stay.guestName}</span>
                      <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                        {stay.mealPlan}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{stay.agencyName || "Direct"}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {nightCount(stay)} nt
                      </span>
                      <TactileButton
                        size="sm"
                        variant="emerald"
                        disabled={!firstVacantCleanRoom}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (firstVacantCleanRoom) {
                            handleInstantCheckIn(stay.id, firstVacantCleanRoom.id);
                          }
                        }}
                      >
                        {firstVacantCleanRoom
                          ? `Check in · ${firstVacantCleanRoom.roomNumber}`
                          : "No vacant room"}
                      </TactileButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <BedDouble className="w-3.5 h-3.5 text-emerald-400" />
                <span>In-house ({inHouse.length})</span>
              </span>
            </div>

            {inHouse.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-2">No in-house guests in snapshot.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {inHouse.map((stay) => (
                  <div
                    key={stay.id}
                    onClick={() => setSelectedStayId(stay.id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      selectedStayId === stay.id
                        ? "bg-indigo-600/20 border-indigo-500"
                        : "bg-slate-900/60 border-white/5 hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold text-white gap-2">
                      <span className="truncate">
                        Room {stay.roomNumber ?? "—"} · {stay.guestName}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                          stay.balanceDueBtn > 0
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400"
                        }`}
                      >
                        {stay.balanceDueBtn > 0 ? `Nu. ${stay.balanceDueBtn}` : "Settled"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{stay.agencyName || "Direct"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <LogOut className="w-3.5 h-3.5 text-amber-400" />
                <span>Departures today ({departuresToday.length})</span>
              </span>
            </div>
            {departuresToday.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-2">No departures for {today}.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {departuresToday.map((stay) => (
                  <button
                    key={stay.id}
                    type="button"
                    onClick={() => setSelectedStayId(stay.id)}
                    className="text-left p-3 rounded-xl border border-white/5 bg-slate-900/50 hover:border-white/15 text-xs text-white"
                  >
                    Rm {stay.roomNumber} · {stay.guestName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2: ROOM RACK (~flex + StayHub 420px) */}
        <div className="col-span-12 md:col-span-5 p-6 overflow-y-auto flex flex-col gap-6 min-h-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="text-base font-bold text-white">StayView room rack</h2>
              <p className="text-xs text-slate-400">
                Opaque cells — tap a room to open StayHub ({rooms.length} units)
              </p>
            </div>
          </div>

          {rooms.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
              No rooms in snapshot. Sign in on <Link href="/erp/login" className="text-indigo-400 underline">/erp/login</Link>{" "}
              with a property that has room_units, or verify API connectivity.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {rooms.map((room) => {
                const occupiedStay = stays.find((s) => s.id === room.occupiedStayId);
                const isOccupied = !!occupiedStay;
                const isDirty = room.status === "dirty";

                return (
                  <div
                    key={room.id}
                    onClick={() => {
                      setSelectedRoomId(room.id);
                      if (room.occupiedStayId) {
                        setSelectedStayId(room.occupiedStayId);
                      }
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden [transform:translateZ(0)] ${
                      selectedRoomId === room.id ? "ring-2 ring-indigo-400 border-indigo-400" : ""
                    } ${
                      isOccupied
                        ? "bg-gradient-to-br from-indigo-950/60 to-slate-900/90 border-indigo-500/30"
                        : isDirty
                        ? "bg-gradient-to-br from-rose-950/40 to-slate-900/80 border-rose-500/30"
                        : "bg-gradient-to-br from-emerald-950/30 to-slate-900/80 border-emerald-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold text-white">{room.roomNumber}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-semibold ${
                          isOccupied
                            ? "bg-indigo-500/20 text-indigo-300"
                            : isDirty
                            ? "bg-rose-500/20 text-rose-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {isOccupied ? "Occupied" : room.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 truncate">{room.category}</p>

                    <div className="mt-3 pt-2 border-t border-white/5 text-[11px]">
                      {isOccupied ? (
                        <span className="text-white font-medium truncate block">
                          {occupiedStay?.guestName}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic block">Vacant</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <NeoGlassCard className="p-4 flex items-center justify-between glass-card [transform:translateZ(0)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Occupancy (rack)</p>
                <p className="text-lg font-bold text-white">
                  {occupancyPct}% ({inHouse.length} / {rooms.length || "—"})
                </p>
              </div>
            </div>
          </NeoGlassCard>
        </div>

        {/* COLUMN 3: STAYHUB (~420px) */}
        <div className="col-span-12 md:col-span-4 lg:max-w-[420px] lg:ml-auto lg:w-full border-t md:border-t-0 md:border-l border-white/[0.08] bg-slate-950/80 p-6 flex flex-col gap-6 overflow-y-auto min-h-0">
          {selectedStay ? (
            <>
              <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded mb-1">
                    <span>{selectedStay.bookingRef}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white">{selectedStay.guestName}</h3>
                  <p className="text-xs text-slate-400">
                    Phone: {selectedStay.guestPhone || "—"}
                  </p>
                </div>

                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase ${
                    selectedStay.status === "in_house"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  }`}
                >
                  {selectedStay.status === "in_house" ? "In-house" : selectedStay.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                  <span className="text-slate-400 block text-[10px] uppercase">Room</span>
                  <span className="text-sm font-bold text-white">
                    {selectedStay.roomNumber ? `Room ${selectedStay.roomNumber}` : "Unassigned"}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                  <span className="text-slate-400 block text-[10px] uppercase">Meal plan</span>
                  <span className="text-sm font-bold text-indigo-400">{selectedStay.mealPlan}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase">Agency</span>
                  <span className="text-sm font-medium text-white">
                    {selectedStay.agencyName || "Direct / FIT"}
                  </span>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2 min-h-0">
                <div className="flex items-center justify-between text-xs font-semibold text-white">
                  <span>Folio lines ({selectedStay.folioCharges.length})</span>
                  <TactileButton
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAddSampleCharge(selectedStay.id)}
                    icon={<PlusCircle className="w-3.5 h-3.5" />}
                  >
                    Add F&B (RAM)
                  </TactileButton>
                </div>

                <div className="flex-1 bg-slate-900/80 rounded-xl border border-white/5 p-3 flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {selectedStay.folioCharges.length === 0 ? (
                    <p className="text-xs text-slate-500 italic text-center py-4">
                      No charges in snapshot for this stay.
                    </p>
                  ) : (
                    selectedStay.folioCharges.map((chg) => (
                      <div
                        key={chg.id}
                        className="flex items-center justify-between text-xs py-1 border-b border-white/5"
                      >
                        <div>
                          <p className="text-white font-medium">{chg.description}</p>
                          <p className="text-[10px] text-slate-500">From Pelbu ledger</p>
                        </div>
                        <span className="font-mono text-white">Nu. {chg.totalBtn.toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase">Balance due</span>
                    <p className="text-base font-bold text-emerald-400 font-mono">
                      Nu. {selectedStay.balanceDueBtn.toFixed(2)}
                    </p>
                  </div>

                  <TactileButton
                    size="sm"
                    variant="amber"
                    onClick={() => showToast("mBoB QR — wire in Wave C via payment adapter")}
                  >
                    mBoB QR
                  </TactileButton>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.08]">
                {selectedStay.status === "in_house" ? (
                  <TactileButton
                    variant="crimson"
                    size="lg"
                    onClick={() => handleInstantCheckOut(selectedStay.id)}
                    icon={<LogOut className="w-4 h-4" />}
                  >
                    Check out (RAM queue)
                  </TactileButton>
                ) : (
                  <TactileButton
                    variant="emerald"
                    size="lg"
                    disabled={!firstVacantCleanRoom}
                    onClick={() =>
                      firstVacantCleanRoom &&
                      handleInstantCheckIn(selectedStay.id, firstVacantCleanRoom.id)
                    }
                    icon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    {firstVacantCleanRoom
                      ? `Check in · Rm ${firstVacantCleanRoom.roomNumber}`
                      : "No vacant clean room"}
                  </TactileButton>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <TactileButton
                    variant="secondary"
                    size="md"
                    disabled={selectedStay.status !== "in_house" || rooms.filter((r) => r.id !== selectedStay.roomId).length === 0}
                    onClick={() => {
                      const alt = rooms.find((r) => r.id !== selectedStay.roomId);
                      if (alt) void shiftRoom(selectedStay.id, alt.id, deskStaffId);
                    }}
                    icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                  >
                    Shift room
                  </TactileButton>

                  <TactileButton
                    variant="secondary"
                    size="md"
                    onClick={() => showToast("Print — connect thermal in Wave C")}
                    icon={<Printer className="w-3.5 h-3.5" />}
                  >
                    Print bill
                  </TactileButton>
                </div>

                {rooms.find((r) => r.status === "dirty") ? (
                  <TactileButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const d = rooms.find((r) => r.status === "dirty");
                      if (d) void setHousekeepingStatus(d.id, "clean", deskStaffId);
                    }}
                  >
                    Mark first dirty room clean (RAM)
                  </TactileButton>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <Building2 className="w-12 h-12 stroke-[1.2] mb-3 text-slate-600" />
              <p className="text-sm font-medium text-slate-300">StayHub</p>
              <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
                Select a room or stay from the rack. Data comes from `/v1/desk/snapshot` after PIN sign-in.
              </p>
            </div>
          )}
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-[0_8px_32px_rgba(16,185,129,0.4)] text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
