"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { HkRoomCardData } from "./GlanceableHousekeepingBoard";

interface HousekeepingFloorPrintPassProps {
  rooms: HkRoomCardData[];
  propertyTitle?: string;
  todayDate: string;
}

export function HousekeepingFloorPrintPass({
  rooms,
  propertyTitle = "Hotel OS Bhutan",
  todayDate,
}: HousekeepingFloorPrintPassProps) {
  const handlePrint = () => {
    window.print();
  };

  const dirtyCount = rooms.filter((r) => r.hkStatus === "dirty").length;
  const stayoverCount = rooms.filter((r) => r.occupancyStatus === "occupied").length;
  const cleanCount = rooms.filter((r) => r.hkStatus === "clean").length;

  return (
    <div className="min-h-screen bg-white text-black p-4 sm:p-8 font-sans">
      {/* On-screen control bar (hidden in print) */}
      <div className="print:hidden mb-6 flex items-center justify-between p-4 rounded-xl bg-slate-100 border border-slate-300">
        <Link
          href="/erp/hk/board"
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-black"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to HK Board</span>
        </Link>

        <button
          onClick={handlePrint}
          className="px-6 py-2.5 rounded-lg bg-black text-white font-bold text-sm flex items-center gap-2 shadow hover:bg-slate-800 transition-all active:scale-95"
        >
          <Printer className="w-4 h-4" />
          <span>Print Floor Sheet (A4)</span>
        </button>
      </div>

      {/* PRINTABLE A4 CONTAINER */}
      <div className="max-w-[210mm] mx-auto border border-black p-8 text-black print:border-none print:p-0 print:max-w-none">
        {/* HEADER */}
        <div className="border-b-2 border-black pb-4 mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">{propertyTitle}</h1>
            <h2 className="text-base font-bold text-slate-800 tracking-wide mt-0.5">
              Housekeeping Daily Morning Floor Run Sheet
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Floor Shift: 08:00 AM - 16:30 PM • Room Turnover, Linen &amp; Amenities
            </p>
          </div>

          <div className="text-right border border-black p-2.5 rounded text-xs">
            <span className="block font-bold">BUSINESS DATE:</span>
            <span className="font-mono text-sm font-black">{todayDate}</span>
            <span className="block mt-1 font-bold text-[10px] text-slate-600">
              DIRTY: {dirtyCount} | STAYOVERS: {stayoverCount} | CLEAN: {cleanCount}
            </span>
          </div>
        </div>

        {/* 1. ROOM-BY-ROOM HK RUN TABLE */}
        <div className="mb-6">
          <table className="w-full text-xs border-collapse border border-black">
            <thead>
              <tr className="bg-slate-200 border-b border-black font-bold text-left">
                <th className="border border-black p-1.5 w-16 text-center">Room</th>
                <th className="border border-black p-1.5 w-24">Status</th>
                <th className="border border-black p-1.5 w-24">Occupancy</th>
                <th className="border border-black p-1.5">Guest / Due Out / Arrival ETA</th>
                <th className="border border-black p-1.5 w-24">Assigned To</th>
                <th className="border border-black p-1.5 w-16 text-center">Linen ✓</th>
                <th className="border border-black p-1.5 w-16 text-center">Done ✓</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r, i) => (
                <tr key={i} className="border-b border-black">
                  <td className="border border-black p-1.5 text-center font-mono font-black text-sm">
                    {r.label}
                  </td>
                  <td className="border border-black p-1.5 font-bold uppercase text-[11px]">
                    {r.hkStatus === "dirty" ? "🔴 Dirty" : r.hkStatus === "clean" ? "🟢 Clean" : r.hkStatus}
                  </td>
                  <td className="border border-black p-1.5 capitalize font-medium">
                    {r.occupancyStatus}
                  </td>
                  <td className="border border-black p-1.5">
                    {r.guestName && <span className="font-semibold block">{r.guestName}</span>}
                    {r.checkoutTime && (
                      <span className="text-[11px] text-slate-700 block">Due Out: {r.checkoutTime}</span>
                    )}
                    {r.arrivalEta && (
                      <span className="text-[11px] text-slate-700 block">Arrival ETA: {r.arrivalEta}</span>
                    )}
                    {r.notes && <span className="text-[10px] italic text-slate-600 block">{r.notes}</span>}
                  </td>
                  <td className="border border-black p-1.5"></td>
                  <td className="border border-black p-1.5 text-center">
                    <div className="w-4 h-4 border border-black mx-auto" />
                  </td>
                  <td className="border border-black p-1.5 text-center">
                    <div className="w-4 h-4 border border-black mx-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 2. HK SUPERVISOR SIGN-OFF */}
        <div className="mt-8 pt-4 border-t-2 border-black grid grid-cols-2 gap-8 text-xs">
          <div>
            <span className="block font-bold">HK Supervisor Verification:</span>
            <div className="mt-6 border-b border-black w-48" />
            <span className="text-[10px] text-slate-600">Executive Housekeeper / Supervisor</span>
          </div>

          <div className="text-right">
            <span className="block font-bold">Front Office Room Handover:</span>
            <div className="mt-6 border-b border-black w-48 ml-auto" />
            <span className="text-[10px] text-slate-600">Front Desk Manager (Rooms Released)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
