"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { formatGuestBtn } from "@/lib/pricing";
import {
  DownloadIcon,
  FileSpreadsheetIcon,
  PrinterIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import ExcelJS from "exceljs";

export interface SpreadsheetRow {
  id: string;
  roomLabel: string;
  guestName: string;
  agentName?: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  status: "confirmed" | "checked_in" | "checked_out" | "held" | "cancelled";
  grossAmountBtn: number;
  paidAmountBtn: number;
  dueAmountBtn: number;
  guideNumber?: string | null;
}

interface DensePineSpreadsheetProps {
  data: SpreadsheetRow[];
  onSelectRow?: (row: SpreadsheetRow) => void;
  title?: string;
  hotelName?: string;
}

export function DensePineSpreadsheet({
  data,
  onSelectRow,
  title = "Operational Bookings Ledger",
  hotelName = "Pelbu Suites Olakha",
}: DensePineSpreadsheetProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<keyof SpreadsheetRow>("roomLabel");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // 0-LATENCY RAM-FIRST FILTERING & SORTING (< 2ms in CPU memory)
  const filteredRows = useMemo(() => {
    let result = [...data];

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }

    // Instant search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.guestName.toLowerCase().includes(q) ||
          r.roomLabel.toLowerCase().includes(q) ||
          (r.agentName && r.agentName.toLowerCase().includes(q)) ||
          (r.guideNumber && r.guideNumber.toLowerCase().includes(q))
      );
    }

    // Sorting in RAM
    result.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      const cmp = valA < valB ? -1 : 1;
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return result;
  }, [data, search, statusFilter, sortField, sortOrder]);

  // Aggregated footer sums (Instant in RAM)
  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.nights += r.nights;
        acc.gross += r.grossAmountBtn;
        acc.paid += r.paidAmountBtn;
        acc.due += r.dueAmountBtn;
        return acc;
      },
      { nights: 0, gross: 0, paid: 0, due: 0 }
    );
  }, [filteredRows]);

  // 1-CLICK EXCEL (.XLSX) EXPORT VIA EXCELJS
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Operational Ledger");

    worksheet.columns = [
      { header: "Room", key: "roomLabel", width: 12 },
      { header: "Guest Name", key: "guestName", width: 24 },
      { header: "Agent / Company", key: "agentName", width: 20 },
      { header: "Check In", key: "checkIn", width: 14 },
      { header: "Check Out", key: "checkOut", width: 14 },
      { header: "Nights", key: "nights", width: 10 },
      { header: "Status", key: "status", width: 14 },
      { header: "Gross (BTN)", key: "grossAmountBtn", width: 16 },
      { header: "Paid (BTN)", key: "paidAmountBtn", width: 16 },
      { header: "Due (BTN)", key: "dueAmountBtn", width: 16 },
    ];

    filteredRows.forEach((r) => {
      worksheet.addRow({
        roomLabel: r.roomLabel,
        guestName: r.guestName,
        agentName: r.agentName || "Direct",
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        nights: r.nights,
        status: r.status.toUpperCase(),
        grossAmountBtn: r.grossAmountBtn,
        paidAmountBtn: r.paidAmountBtn,
        dueAmountBtn: r.dueAmountBtn,
      });
    });

    // Add totals row
    worksheet.addRow({
      roomLabel: "TOTALS",
      guestName: "",
      agentName: "",
      checkIn: "",
      checkOut: "",
      nights: totals.nights,
      status: "",
      grossAmountBtn: totals.gross,
      paidAmountBtn: totals.paid,
      dueAmountBtn: totals.due,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${hotelName.toLowerCase().replace(/\s+/g, "-")}-ledger-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleSort = (field: keyof SpreadsheetRow) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  return (
    <div className="sovereign-glass overflow-hidden">
      {/* 1. TOP INTERACTION & ACTION DOCK */}
      <div className="flex flex-col gap-3 border-b border-black/5 dark:border-white/10 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Instant Search Omnibar (0ms RAM filtering) */}
        <div className="relative min-w-[240px] flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guest, room 102, guide #, Soul Trips..."
            className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/50 dark:bg-black/40 pl-9 pr-3.5 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#1a4332] dark:focus:ring-[#d97706]"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: "all", label: "All Stays" },
            { id: "checked_in", label: "In-House" },
            { id: "confirmed", label: "Arrivals" },
            { id: "checked_out", label: "Departed" },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap",
                statusFilter === pill.id
                  ? "bg-[#1a4332] text-white shadow-xs dark:bg-[#d97706]"
                  : "bg-black/5 dark:bg-white/10 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/15"
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Dual Actions: Export Excel & Clean Print */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportExcel}
            title="Download formatted Excel spreadsheet"
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/30 bg-emerald-500/10 dark:bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-all"
          >
            <FileSpreadsheetIcon className="size-3.5" />
            <span>Export .xlsx</span>
          </button>
          <button
            onClick={handlePrint}
            title="Print clean spreadsheet"
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/10 px-3 py-2 text-xs font-semibold text-foreground hover:bg-black/10 transition-all"
          >
            <PrinterIcon className="size-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* 2. DENSE PINE SPREADSHEET TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold uppercase tracking-wider">
              <th
                onClick={() => toggleSort("roomLabel")}
                className="cursor-pointer px-4 py-3 hover:text-foreground"
              >
                Room
              </th>
              <th
                onClick={() => toggleSort("guestName")}
                className="cursor-pointer px-4 py-3 hover:text-foreground"
              >
                Guest / Party
              </th>
              <th
                onClick={() => toggleSort("checkIn")}
                className="cursor-pointer px-4 py-3 hover:text-foreground"
              >
                Stay Window
              </th>
              <th
                onClick={() => toggleSort("nights")}
                className="cursor-pointer px-3 py-3 text-center hover:text-foreground"
              >
                Nts
              </th>
              <th className="px-3 py-3 text-center">Status</th>
              <th
                onClick={() => toggleSort("grossAmountBtn")}
                className="cursor-pointer px-4 py-3 text-right hover:text-foreground"
              >
                Gross Total
              </th>
              <th
                onClick={() => toggleSort("dueAmountBtn")}
                className="cursor-pointer px-4 py-3 text-right hover:text-foreground"
              >
                Balance Due
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No bookings match your 0-latency filter.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => {
                return (
                  <tr
                    key={r.id}
                    onClick={() => onSelectRow?.(r)}
                    className="sovereign-table-row cursor-pointer select-none"
                  >
                    {/* Room with Status Indicator Tag */}
                    <td className="px-4 py-3 font-mono font-bold text-foreground">
                      <span className="rounded-md bg-black/5 dark:bg-white/10 px-2 py-0.5">
                        {r.roomLabel}
                      </span>
                    </td>

                    {/* Guest & Agent Details */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{r.guestName}</div>
                      {r.agentName ? (
                        <div className="text-[11px] text-[#d97706] dark:text-[#f59e0b] font-medium">
                          {r.agentName}
                        </div>
                      ) : null}
                    </td>

                    {/* Stay Dates */}
                    <td className="tabular-stat px-4 py-3 text-muted-foreground">
                      {r.checkIn.slice(5)} → {r.checkOut.slice(5)}
                    </td>

                    {/* Nights */}
                    <td className="tabular-stat px-3 py-3 text-center font-semibold text-foreground">
                      {r.nights}
                    </td>

                    {/* Status Badge */}
                    <td className="px-3 py-3 text-center">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          r.status === "checked_in"
                            ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                            : r.status === "confirmed"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {r.status.replace(/_/g, " ")}
                      </span>
                    </td>

                    {/* Gross Amount */}
                    <td className="tabular-stat px-4 py-3 text-right font-medium text-foreground">
                      {formatGuestBtn(r.grossAmountBtn)}
                    </td>

                    {/* Net Balance Due */}
                    <td
                      className={cn(
                        "tabular-stat px-4 py-3 text-right font-bold",
                        r.dueAmountBtn > 0.5
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {r.dueAmountBtn > 0.5
                        ? formatGuestBtn(r.dueAmountBtn)
                        : "0.00 (Settled)"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* 3. STICKY TOTALS FOOTER */}
          <tfoot>
            <tr className="border-t-2 border-black/10 dark:border-white/15 bg-black/[0.04] dark:bg-white/[0.04] font-bold">
              <td colSpan={3} className="px-4 py-3 text-foreground uppercase tracking-wider text-[11px]">
                Totals ({filteredRows.length} Bookings)
              </td>
              <td className="tabular-stat px-3 py-3 text-center text-foreground">
                {totals.nights}
              </td>
              <td></td>
              <td className="tabular-stat px-4 py-3 text-right text-foreground">
                {formatGuestBtn(totals.gross)}
              </td>
              <td
                className={cn(
                  "tabular-stat px-4 py-3 text-right",
                  totals.due > 0.5 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"
                )}
              >
                {formatGuestBtn(totals.due)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
