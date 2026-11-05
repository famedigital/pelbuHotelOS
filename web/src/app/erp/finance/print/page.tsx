import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId, loadProperty } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildHotelAccountSnapshot } from "@/lib/accounting/hotel-account";
import { loadClosedDay } from "@/lib/finance/closed-day";
import { thimphuToday, fmtDate } from "@/lib/erp-lists";
import { formatGuestBtn } from "@/lib/pricing";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Daily Cashier & Treasury Summary (A4) | Hotel OS Bhutan",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpFinancePrintPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const today = thimphuToday();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [snap, closed, property] = await Promise.all([
    buildHotelAccountSnapshot(admin, propertyId, monthStart, today),
    loadClosedDay(admin, propertyId, today),
    loadProperty(admin, propertyId),
  ]);

  const vault = snap.vault;
  const totalRevenue = closed.room + closed.fnb + closed.laundry;

  return (
    <div className="min-h-screen bg-white text-black p-4 sm:p-8 font-sans">
      {/* On-screen controls */}
      <div className="print:hidden mb-6 flex items-center justify-between p-4 rounded-xl bg-slate-100 border border-slate-300">
        <Link
          href="/erp/finance"
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-black"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Finance</span>
        </Link>

        <button
          onClick={() => {
            if (typeof window !== "undefined") window.print();
          }}
          className="px-6 py-2.5 rounded-lg bg-black text-white font-bold text-sm flex items-center gap-2 shadow hover:bg-slate-800 transition-all active:scale-95"
        >
          <Printer className="w-4 h-4" />
          <span>Print Cashier Summary (A4)</span>
        </button>
      </div>

      {/* A4 Container */}
      <div className="max-w-[210mm] mx-auto border border-black p-8 text-black print:border-none print:p-0 print:max-w-none">
        {/* Header */}
        <div className="border-b-2 border-black pb-4 mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">
              {property?.name || "Hotel OS Bhutan"}
            </h1>
            <h2 className="text-base font-bold text-slate-800 tracking-wide mt-0.5">
              Daily Cashier Treasury &amp; Revenue Reconciliation
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              End-of-Day Front Desk &amp; F&amp;B Cash Handover Pass
            </p>
          </div>

          <div className="text-right border border-black p-2.5 rounded text-xs">
            <span className="block font-bold">BUSINESS DATE:</span>
            <span className="font-mono text-sm font-black">{fmtDate(today)}</span>
            <span className="block mt-1 font-bold text-[10px] text-slate-600">
              STATUS: CLOSED DAY
            </span>
          </div>
        </div>

        {/* 1. LIQUID TREASURY SNAPSHOT */}
        <div className="mb-6">
          <h3 className="text-xs font-black uppercase tracking-wider mb-2 border-b border-black pb-1">
            1. Current Hotel Treasury Position
          </h3>
          <div className="grid grid-cols-3 gap-3 text-xs border border-black p-3 bg-slate-50">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-600 block">💵 Physical Cash in Drawer</span>
              <span className="font-mono text-base font-black">Nu. {formatGuestBtn(vault.cashBtn)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-600 block">🏦 Bank Operating (BoB / BNB)</span>
              <span className="font-mono text-base font-black">Nu. {formatGuestBtn(vault.bankBtn)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-600 block">💳 Cards Clearing</span>
              <span className="font-mono text-base font-black">Nu. {formatGuestBtn(vault.cardClearingBtn)}</span>
            </div>
          </div>
        </div>

        {/* 2. TODAY'S REVENUE BREAKDOWN */}
        <div className="mb-6">
          <h3 className="text-xs font-black uppercase tracking-wider mb-2 border-b border-black pb-1">
            2. Today&apos;s Revenue Breakdown
          </h3>
          <table className="w-full text-xs border-collapse border border-black">
            <thead>
              <tr className="bg-slate-200 border-b border-black font-bold text-left">
                <th className="border border-black p-2">Revenue Category</th>
                <th className="border border-black p-2 text-right">Amount (Nu.)</th>
                <th className="border border-black p-2">Tender Verification</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-2 font-medium">Room Nights &amp; Accommodation</td>
                <td className="border border-black p-2 text-right font-mono font-bold">
                  Nu. {formatGuestBtn(closed.room)}
                </td>
                <td className="border border-black p-2 text-slate-600">In-House Stays &amp; Early Check-Ins</td>
              </tr>
              <tr>
                <td className="border border-black p-2 font-medium">Food &amp; Beverage (Restaurant / Bar)</td>
                <td className="border border-black p-2 text-right font-mono font-bold">
                  Nu. {formatGuestBtn(closed.fnb)}
                </td>
                <td className="border border-black p-2 text-slate-600">Restaurant POS Tickets &amp; KOTs</td>
              </tr>
              <tr>
                <td className="border border-black p-2 font-medium">Guest Laundry &amp; Incidentals</td>
                <td className="border border-black p-2 text-right font-mono font-bold">
                  Nu. {formatGuestBtn(closed.laundry)}
                </td>
                <td className="border border-black p-2 text-slate-600">Service Charges &amp; Laundry Lines</td>
              </tr>
              <tr className="bg-slate-100 font-bold border-t-2 border-black">
                <td className="border border-black p-2 font-black uppercase">Total Daily Revenue</td>
                <td className="border border-black p-2 text-right font-mono font-black text-sm">
                  Nu. {formatGuestBtn(totalRevenue)}
                </td>
                <td className="border border-black p-2 font-mono">
                  Cash: {formatGuestBtn(closed.cash)} | Bank: {formatGuestBtn(closed.bank)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 3. PHYSICAL CASH COUNT CHECKLIST */}
        <div className="mb-6">
          <h3 className="text-xs font-black uppercase tracking-wider mb-2 border-b border-black pb-1">
            3. Physical Cash Denominations (End-of-Shift Handover)
          </h3>
          <div className="grid grid-cols-4 gap-2 text-xs border border-black p-3">
            <div className="border border-black p-1 text-center font-mono">Nu. 1000 × _____</div>
            <div className="border border-black p-1 text-center font-mono">Nu. 500 × _____</div>
            <div className="border border-black p-1 text-center font-mono">Nu. 100 × _____</div>
            <div className="border border-black p-1 text-center font-mono">Nu. 50 × _____</div>
            <div className="border border-black p-1 text-center font-mono">Nu. 20 × _____</div>
            <div className="border border-black p-1 text-center font-mono">Nu. 10 × _____</div>
            <div className="border border-black p-1 text-center font-mono">Nu. 5 × _____</div>
            <div className="border border-black p-1 text-center font-mono font-bold bg-slate-100">
              Total Count: Nu. _____
            </div>
          </div>
        </div>

        {/* 4. SIGN-OFF */}
        <div className="mt-8 pt-4 border-t-2 border-black grid grid-cols-2 gap-8 text-xs">
          <div>
            <span className="block font-bold">Cash Handed Over By (Duty Cashier):</span>
            <div className="mt-6 border-b border-black w-48" />
            <span className="text-[10px] text-slate-600">Front Desk Staff / Cashier</span>
          </div>

          <div className="text-right">
            <span className="block font-bold">Cash Verified &amp; Received By:</span>
            <div className="mt-6 border-b border-black w-48 ml-auto" />
            <span className="text-[10px] text-slate-600">Duty Manager / General Manager</span>
          </div>
        </div>
      </div>
    </div>
  );
}
