"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { MealCovers } from "@/lib/kitchen/covers";

interface KitchenBriefingPrintPassProps {
  covers: MealCovers;
  propertyTitle?: string;
  todayDate: string;
}

export function KitchenBriefingPrintPass({
  covers,
  propertyTitle = "Hotel OS Bhutan",
  todayDate,
}: KitchenBriefingPrintPassProps) {
  const handlePrint = () => {
    window.print();
  };

  const totalPax = covers.guests.reduce((s, g) => s + g.adults, 0);

  return (
    <div className="min-h-screen bg-white text-black p-4 sm:p-8 font-sans">
      {/* On-screen control bar (hidden in print) */}
      <div className="print:hidden mb-6 flex items-center justify-between p-4 rounded-xl bg-slate-100 border border-slate-300">
        <Link
          href="/erp/kitchen/board"
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-black"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Kitchen Board</span>
        </Link>

        <button
          onClick={handlePrint}
          className="px-6 py-2.5 rounded-lg bg-black text-white font-bold text-sm flex items-center gap-2 shadow hover:bg-slate-800 transition-all active:scale-95"
        >
          <Printer className="w-4 h-4" />
          <span>Print Pass (A4)</span>
        </button>
      </div>

      {/* PRINTABLE A4 CONTAINER */}
      <div className="max-w-[210mm] mx-auto border border-black p-8 text-black print:border-none print:p-0 print:max-w-none">
        {/* HEADER */}
        <div className="border-b-2 border-black pb-4 mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">{propertyTitle}</h1>
            <h2 className="text-base font-bold text-slate-800 tracking-wide mt-0.5">
              Daily Kitchen Morning Briefing Pass
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Briefing Schedule: 07:30 AM Daily Standup • Kitchen &amp; F&amp;B Operations
            </p>
          </div>

          <div className="text-right border border-black p-2.5 rounded text-xs">
            <span className="block font-bold">DATE:</span>
            <span className="font-mono text-sm font-black">{todayDate}</span>
            <span className="block mt-1 font-bold text-[10px] text-slate-600">IN-HOUSE PAX: {totalPax}</span>
          </div>
        </div>

        {/* 1. COVERS HEADCOUNT SUMMARY TABLE */}
        <div className="mb-6">
          <h3 className="text-xs font-black uppercase tracking-wider mb-2 border-b border-black pb-1">
            1. Meal Plan Headcounts (Covers Today)
          </h3>
          <table className="w-full text-xs border-collapse border border-black text-center">
            <thead>
              <tr className="bg-slate-200 border-b border-black font-bold">
                <th className="border border-black p-2 text-left">Service Period</th>
                <th className="border border-black p-2">Standard Meal Plan</th>
                <th className="border border-black p-2">Package Covers</th>
                <th className="border border-black p-2">Estimated Walk-In / Extra</th>
                <th className="border border-black p-2">Total Target Covers</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-2 text-left font-bold">Breakfast (07:00 - 10:00)</td>
                <td className="border border-black p-2">CP / BB / MAP / AP</td>
                <td className="border border-black p-2 font-mono font-bold text-sm">{covers.breakfast}</td>
                <td className="border border-black p-2 font-mono">+ 5</td>
                <td className="border border-black p-2 font-mono font-black text-sm">{covers.breakfast + 5}</td>
              </tr>
              <tr>
                <td className="border border-black p-2 text-left font-bold">Lunch (12:30 - 14:30)</td>
                <td className="border border-black p-2">MAP / AP / Groups</td>
                <td className="border border-black p-2 font-mono font-bold text-sm">{covers.lunch}</td>
                <td className="border border-black p-2 font-mono">+ 4</td>
                <td className="border border-black p-2 font-mono font-black text-sm">{covers.lunch + 4}</td>
              </tr>
              <tr>
                <td className="border border-black p-2 text-left font-bold">Dinner (19:00 - 21:30)</td>
                <td className="border border-black p-2">MAP / AP Buffet &amp; Set</td>
                <td className="border border-black p-2 font-mono font-bold text-sm">{covers.dinner}</td>
                <td className="border border-black p-2 font-mono">+ 8</td>
                <td className="border border-black p-2 font-mono font-black text-sm">{covers.dinner + 8}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2. SPECIAL DIETARY & ALLERGIES ALERT TABLE */}
        <div className="mb-6">
          <h3 className="text-xs font-black uppercase tracking-wider mb-2 border-b border-black pb-1 text-red-700 print:text-black">
            2. Special Dietary Restrictions &amp; Allergy Precautions
          </h3>
          <div className="border border-black p-3 text-xs bg-slate-50">
            <p className="font-bold mb-1">Critical Kitchen Directives:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Separate cookware and ladles for strict vegetarian (Jain/Buddhist) preparation.</li>
              <li>Verify all nut/gluten allergen disclaimers on breakfast buffet tags.</li>
              <li>Packed breakfasts for early tour departures must be boxed by 06:30 AM.</li>
            </ul>
          </div>
        </div>

        {/* 3. IN-HOUSE ROOM ROSTER & MEAL PLANS */}
        <div className="mb-6 page-break-inside-avoid">
          <h3 className="text-xs font-black uppercase tracking-wider mb-2 border-b border-black pb-1">
            3. In-House Stays &amp; Group Roster ({covers.guests.length} Rooms)
          </h3>
          <table className="w-full text-xs border-collapse border border-black">
            <thead>
              <tr className="bg-slate-200 border-b border-black font-bold text-left">
                <th className="border border-black p-1.5 w-20">Room #</th>
                <th className="border border-black p-1.5">Guest / Tour Group Name</th>
                <th className="border border-black p-1.5 text-center w-16">Adults</th>
                <th className="border border-black p-1.5 text-center w-20">Plan</th>
                <th className="border border-black p-1.5">Dietary / Notes</th>
              </tr>
            </thead>
            <tbody>
              {covers.guests.map((g, i) => (
                <tr key={i} className="border-b border-black">
                  <td className="border border-black p-1.5 font-mono font-bold">{g.rooms || "Assigned"}</td>
                  <td className="border border-black p-1.5 font-medium">{g.guestName}</td>
                  <td className="border border-black p-1.5 text-center font-mono">{g.adults}</td>
                  <td className="border border-black p-1.5 text-center font-bold font-mono">{g.mealPlanCode}</td>
                  <td className="border border-black p-1.5 text-slate-700 italic">
                    {g.mealPlanCode === "AP" ? "Full board" : g.mealPlanCode === "MAP" ? "Half board" : "Bed & Breakfast"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. CHEF SIGN-OFF & STANDUP VERIFICATION */}
        <div className="mt-8 pt-4 border-t-2 border-black grid grid-cols-2 gap-8 text-xs">
          <div>
            <span className="block font-bold">Briefing Conducted By:</span>
            <div className="mt-6 border-b border-black w-48" />
            <span className="text-[10px] text-slate-600">Executive Chef / Sous Chef</span>
          </div>

          <div className="text-right">
            <span className="block font-bold">F&amp;B / Front Office Acknowledged:</span>
            <div className="mt-6 border-b border-black w-48 ml-auto" />
            <span className="text-[10px] text-slate-600">Duty Manager / F&amp;B Captain</span>
          </div>
        </div>
      </div>
    </div>
  );
}
