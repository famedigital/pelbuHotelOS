"use client";

import React, { useState } from "react";
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Building2,
  CheckCircle2,
  Layers,
  TrendingUp,
  Receipt,
  Users,
  ShieldCheck,
  Search,
  ChevronRight,
  QrCode,
  DollarSign,
} from "lucide-react";
import { NeoGlassCard, TactileButton } from "@/components/ui/neo-spatial";

export interface ReportDefinition {
  id: string;
  number: number;
  binder: "operations" | "revenue" | "purchases" | "b2b";
  title: string;
  description: string;
  format: "A4_PORTRAIT" | "A4_LANDSCAPE" | "THERMAL_80MM";
  frequency: "Daily" | "Shift-End" | "Monthly" | "On-Demand";
  authority: "DRC Tax" | "DOT & Police" | "Hotel Ops" | "B2B Travel Agent";
}

const REPORT_CATALOG: ReportDefinition[] = [
  // 1. Daily Operations
  { id: "rep-01", number: 1, binder: "operations", title: "Arrival & Departure Manifest", description: "Daily guest movements, room assignments, meal plans & vehicle plates.", format: "A4_LANDSCAPE", frequency: "Daily", authority: "Hotel Ops" },
  { id: "rep-02", number: 2, binder: "operations", title: "Police & DOT Immigration Report", description: "Foreign tourist passport registry, visa clearance IDs & licensed tour guide links.", format: "A4_LANDSCAPE", frequency: "Daily", authority: "DOT & Police" },
  { id: "rep-03", number: 3, binder: "operations", title: "Housekeeping Discrepancy Sheet", description: "System status (Occupied) vs physical room inspection (Clean/Dirty/Vacant).", format: "A4_PORTRAIT", frequency: "Daily", authority: "Hotel Ops" },
  { id: "rep-04", number: 4, binder: "operations", title: "Shift Cashier Reconciliation Slip", description: "Opening till, cash collected, petty cash vouchers & closing physical cash count.", format: "THERMAL_80MM", frequency: "Shift-End", authority: "Hotel Ops" },

  // 2. Sales & Revenue
  { id: "rep-05", number: 5, binder: "revenue", title: "Daily Night Audit Revenue Ledger", description: "Audited daily gross: Room nights, F&B dining, bar, laundry & tax accruals.", format: "A4_PORTRAIT", frequency: "Daily", authority: "Hotel Ops" },
  { id: "rep-06", number: 6, binder: "revenue", title: "POS Itemized Sales Velocity", description: "Best-selling Bhutanese dishes, beverage volume, and outlet performance.", format: "A4_LANDSCAPE", frequency: "Daily", authority: "Hotel Ops" },
  { id: "rep-07", number: 7, binder: "revenue", title: "Kitchen Meal Plan Pax Forecast", description: "Daily breakfast, lunch, and dinner pax counts for kitchen prep (EP/CP/MAP/AP).", format: "A4_PORTRAIT", frequency: "Daily", authority: "Hotel Ops" },
  { id: "rep-08", number: 8, binder: "revenue", title: "Monthly RevPAR & Occupancy Matrix", description: "Room nights sold, Average Daily Rate (ADR), and RevPAR performance.", format: "A4_LANDSCAPE", frequency: "Monthly", authority: "Hotel Ops" },
  { id: "rep-09", number: 9, binder: "revenue", title: "Official DRC Form BST-3 Return", description: "Mandatory Bhutan Sales Tax (BST) & 10% Service Charge breakdown for DRC audit.", format: "A4_PORTRAIT", frequency: "Monthly", authority: "DRC Tax" },

  // 3. Purchases & Expenses
  { id: "rep-10", number: 10, binder: "purchases", title: "Daily Petty Cash Outflow Ledger", description: "Every cash payout from front desk till matched to supplier vouchers.", format: "A4_PORTRAIT", frequency: "Daily", authority: "Hotel Ops" },
  { id: "rep-11", number: 11, binder: "purchases", title: "Category-Wise Expense Distribution", description: "Centenary veg/meat vs utilities vs gas LPG vs payroll distribution.", format: "A4_LANDSCAPE", frequency: "Monthly", authority: "Hotel Ops" },
  { id: "rep-12", number: 12, binder: "purchases", title: "Supplier Accounts Payable Ledger", description: "Unpaid vendor bills, credit balances, and payment due schedules.", format: "A4_LANDSCAPE", frequency: "Monthly", authority: "Hotel Ops" },
  { id: "rep-13", number: 13, binder: "purchases", title: "F&B Food Cost Percentage Audit", description: "Kitchen purchases compared directly against dining revenue (Target: <32%).", format: "A4_PORTRAIT", frequency: "Monthly", authority: "Hotel Ops" },

  // 4. B2B Tour Operators & Hospitality
  { id: "rep-14", number: 14, binder: "b2b", title: "Tour Operator Credit Aging Analysis", description: "Druk Asia, Wind Horse, and Blue Poppy credit aged 0-30, 31-60, 60+ days.", format: "A4_LANDSCAPE", frequency: "Monthly", authority: "B2B Travel Agent" },
  { id: "rep-15", number: 15, binder: "b2b", title: "Group Master Folio Statement", description: "Official B2B bilateral tax invoice for travel agency accounting.", format: "A4_PORTRAIT", frequency: "On-Demand", authority: "B2B Travel Agent" },
  { id: "rep-16", number: 16, binder: "b2b", title: "Guide & Driver Hospitality Log", description: "Audit of complimentary guide rooms, driver dorm beds, and buffet coupons.", format: "A4_PORTRAIT", frequency: "Daily", authority: "Hotel Ops" },
];

export const SixteenReportStudio: React.FC = () => {
  const [selectedReportId, setSelectedReportId] = useState<string>("rep-09");
  const [activeBinder, setActiveBinder] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const activeReport = REPORT_CATALOG.find((r) => r.id === selectedReportId) || REPORT_CATALOG[0];

  const filteredCatalog = REPORT_CATALOG.filter((rep) => {
    if (activeBinder !== "all" && rep.binder !== activeBinder) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!rep.title.toLowerCase().includes(q) && !rep.description.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-[#030712] text-slate-100 overflow-hidden font-sans">
      {/* 1. Header Toolbar */}
      <header className="border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Enterprise 16-Report Studio</h1>
            <p className="text-xs text-slate-400">
              Department of Revenue & Customs (DRC), DOT Immigration, and Audit Binders
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <TactileButton
            variant="secondary"
            size="md"
            onClick={handleTriggerPrint}
            icon={<Printer className="w-4 h-4" />}
          >
            Print {activeReport.format === "THERMAL_80MM" ? "Thermal Slip" : "Document (PDF)"}
          </TactileButton>
        </div>
      </header>

      {/* 2. Main Two-Column Studio Layout */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* Left Column: Report Catalog Index (35%) */}
        <div className="col-span-12 lg:col-span-4 border-r border-white/[0.08] bg-slate-950/40 p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Binder Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-900/60 border border-white/5 text-[11px]">
            <button
              onClick={() => setActiveBinder("all")}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeBinder === "all" ? "bg-indigo-600 text-white font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              All (16)
            </button>
            <button
              onClick={() => setActiveBinder("operations")}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeBinder === "operations" ? "bg-indigo-600 text-white font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              Operations (4)
            </button>
            <button
              onClick={() => setActiveBinder("revenue")}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeBinder === "revenue" ? "bg-indigo-600 text-white font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              Revenue & Tax (5)
            </button>
            <button
              onClick={() => setActiveBinder("purchases")}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeBinder === "purchases" ? "bg-indigo-600 text-white font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              Purchases (4)
            </button>
            <button
              onClick={() => setActiveBinder("b2b")}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeBinder === "b2b" ? "bg-indigo-600 text-white font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              B2B Tour (3)
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title or compliance authority..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
            />
          </div>

          {/* List of Reports */}
          <div className="flex flex-col gap-2">
            {filteredCatalog.map((rep) => {
              const isSelected = selectedReportId === rep.id;
              return (
                <div
                  key={rep.id}
                  onClick={() => setSelectedReportId(rep.id)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? "bg-indigo-600/20 border-indigo-500 shadow-[0_0_20px_-4px_rgba(99,102,241,0.4)]"
                      : "bg-slate-900/60 border-white/5 hover:border-white/15"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold text-white">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center font-mono text-[10px] text-indigo-300">
                        {rep.number}
                      </span>
                      <span>{rep.title}</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                      {rep.format.replace("_", " ")}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{rep.description}</p>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="text-amber-400/80">{rep.authority}</span>
                    <span className="font-mono">{rep.frequency}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Document Preview Canvas (65%) */}
        <div className="col-span-12 lg:col-span-8 p-6 overflow-y-auto flex flex-col items-center justify-start bg-slate-950/80">
          {/* Document Sheet Container */}
          <div
            className={`w-full bg-white text-slate-950 p-8 rounded-xl shadow-2xl border border-slate-300 transition-all ${
              activeReport.format === "THERMAL_80MM"
                ? "max-w-xs font-mono text-[11px] leading-tight"
                : activeReport.format === "A4_LANDSCAPE"
                ? "max-w-4xl"
                : "max-w-2xl"
            }`}
          >
            {/* Header / Letterhead */}
            <div className="border-b border-slate-900 pb-4 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold tracking-tight uppercase">PARO GRAND RESORT & SPA</h2>
                  <p className="text-xs text-slate-600">Post Box 142, Paro Valley, Kingdom of Bhutan</p>
                  <p className="text-xs text-slate-600">Tax Payer Number (TPN): 10294819 | License: 104291</p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] font-bold uppercase">
                    {activeReport.authority}
                  </span>
                  <p className="text-xs font-mono mt-1 text-slate-500">
                    DOC #{activeReport.id.toUpperCase()}-2026-11
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-2 border-t border-slate-200 flex items-center justify-between">
                <h3 className="text-base font-bold text-indigo-900 uppercase">{activeReport.title}</h3>
                <span className="text-xs text-slate-600 font-mono">Date: 06 Nov 2026</span>
              </div>
            </div>

            {/* Document Content Simulation */}
            {activeReport.id === "rep-09" ? (
              /* DRC FORM BST-3 SIMULATION */
              <div className="space-y-4 text-xs">
                <p className="text-[11px] text-slate-600">
                  Official tax return filed under Section 42 of the Bhutan Sales Tax Act for Department of Revenue & Customs (DRC).
                </p>

                <table className="w-full text-left border-collapse border border-slate-300">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th className="border border-slate-300 p-2">Revenue Stream</th>
                      <th className="border border-slate-300 p-2 text-right">Net Sales (BTN)</th>
                      <th className="border border-slate-300 p-2 text-right">10% SC (BTN)</th>
                      <th className="border border-slate-300 p-2 text-right">10% BST (BTN)</th>
                      <th className="border border-slate-300 p-2 text-right">Total Gross (BTN)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 p-2 font-medium">Room Accommodation</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">142,000.00</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">14,200.00</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">15,620.00</td>
                      <td className="border border-slate-300 p-2 text-right font-mono font-bold">171,820.00</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 p-2 font-medium">Food & Dining (Restaurant)</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">32,450.00</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">3,245.00</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">3,569.50</td>
                      <td className="border border-slate-300 p-2 text-right font-mono font-bold">39,264.50</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 p-2 font-medium">Bar & Beverages (Alcohol)</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">18,200.00</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">1,820.00</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">2,002.00</td>
                      <td className="border border-slate-300 p-2 text-right font-mono font-bold">22,022.00</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-900">
                      <td className="border border-slate-300 p-2 uppercase">Total Accrued to DRC</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">192,650.00</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">19,265.00</td>
                      <td className="border border-slate-300 p-2 text-right font-mono text-indigo-900">21,191.50</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">233,106.50</td>
                    </tr>
                  </tbody>
                </table>

                {/* Footer Signatures */}
                <div className="grid grid-cols-2 gap-8 pt-8 mt-6 border-t border-slate-200">
                  <div className="text-center">
                    <p className="border-b border-slate-400 pb-6"></p>
                    <p className="text-[10px] text-slate-600 mt-1 uppercase font-semibold">
                      Prepared by Hotel Chief Accountant
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="border-b border-slate-400 pb-6"></p>
                    <p className="text-[10px] text-slate-600 mt-1 uppercase font-semibold">
                      General Manager Approval & Stamp
                    </p>
                  </div>
                </div>
              </div>
            ) : activeReport.format === "THERMAL_80MM" ? (
              /* THERMAL RECEIPT FORMAT */
              <div className="space-y-2 text-center">
                <p className="font-bold">SHIFT CASHIER RECONCILIATION</p>
                <p>CASHIER: DECHEN PELDEN (PIN 4)</p>
                <p>TIME: 06-NOV-2026 21:45</p>
                <div className="border-t border-b border-dashed border-slate-800 py-2 text-left my-2 space-y-1">
                  <div className="flex justify-between">
                    <span>OPENING TILL:</span>
                    <span>Nu. 15,000.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CASH COLLECTED:</span>
                    <span>Nu. 32,450.00</span>
                  </div>
                  <div className="flex justify-between text-rose-700">
                    <span>PETTY CASH OUT:</span>
                    <span>-Nu. 2,450.00</span>
                  </div>
                  <div className="border-t border-dashed border-slate-800 pt-1 flex justify-between font-bold">
                    <span>CLOSING DRAWER:</span>
                    <span>Nu. 45,000.00</span>
                  </div>
                </div>
                <p className="text-[10px]">VERIFIED HASH: #88fa2901c2</p>
                <p className="text-[9px] italic">THANK YOU - TASHI DELEK</p>
              </div>
            ) : (
              /* GENERIC DATA TABLE FORMAT */
              <div className="space-y-4 text-xs">
                <p className="text-slate-600">{activeReport.description}</p>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded text-center text-slate-500 italic py-12">
                  Live data compiled from in-memory system heap. Ready for instant print or export.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
