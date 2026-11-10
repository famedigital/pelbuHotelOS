"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Printer,
  Calendar,
  Search,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { NeoGlassCard, TactileButton } from "@/components/ui/neo-spatial";
import { deskFetchJson, DeskApiError } from "@/lib/v2/desk-api-client";
import { readV2DeskToken } from "@/lib/v2/desk-api";

type CatalogEntry = {
  id: string;
  number: number;
  binder: string;
  title: string;
};

type ReportPayload = {
  meta: CatalogEntry;
  property: {
    name?: string | null;
    legalName?: string | null;
    tpn?: string | null;
    license?: string | null;
    address?: string | null;
  };
  asOf: string;
  rows: Record<string, unknown>[];
  verificationHash: string;
  format: "A4" | "THERMAL_80MM";
};

/** Honest API limitations vs binder titles (richer ledgers = Wave F). */
export const WAVE_E_REPORT_GAPS: { id: string; gap: string }[] = [
  {
    id: "rep-02",
    gap:
      "Guest registry only (passport/CID/SDF) — visa agency IDs and guide links need dedicated columns or joins.",
  },
  {
    id: "rep-04",
    gap:
      "Uses cash_till_shifts opened today; multi-shift / physical count variance not stored here.",
  },
  {
    id: "rep-08",
    gap:
      "Rough occupancy from booking_night_meals row count; ADR/RevPAR use folio room lines — comps and group blocks need Wave F refinements.",
  },
  {
    id: "rep-13",
    gap:
      "Food cost uses all inventory PO lines vs F&B outlet order totals — not recipe-level COGS.",
  },
  {
    id: "rep-14",
    gap:
      "Credit limit/used from agent_property_links — true aging buckets need dated agent_credit_ledger rollups.",
  },
  {
    id: "rep-15",
    gap:
      "Lists open master folios — line detail and B2B tax invoice layout are Wave F.",
  },
];

function rowCells(row: Record<string, unknown>): { k: string; v: string }[] {
  return Object.entries(row).map(([k, v]) => ({
    k,
    v:
      v === null || v === undefined
        ? "—"
        : typeof v === "object"
          ? JSON.stringify(v)
          : String(v),
  }));
}

export const V2ReportStudio: React.FC = () => {
  const signedIn = Boolean(readV2DeskToken());
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [catError, setCatError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("rep-09");
  const [asOf, setAsOf] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" }),
  );
  const [binderFilter, setBinderFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCatalog = useCallback(async () => {
    if (!signedIn) return;
    try {
      setCatError(null);
      const res = await deskFetchJson<{ reports: CatalogEntry[] }>(
        "/v1/reports/catalog",
      );
      setCatalog(res.reports ?? []);
    } catch (err) {
      console.error("[v2/reports] catalog", err);
      setCatError(err instanceof Error ? err.message : String(err));
    }
  }, [signedIn]);

  const loadReport = useCallback(async () => {
    if (!signedIn) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await deskFetchJson<ReportPayload>(
        `/v1/reports/${encodeURIComponent(selectedId)}?date=${encodeURIComponent(asOf)}`,
      );
      setPayload(data);
    } catch (err) {
      console.error("[v2/reports] report", err);
      setPayload(null);
      setLoadError(err instanceof DeskApiError ? err.message : String(err));
      toast.error("Could not load report");
    } finally {
      setLoading(false);
    }
  }, [signedIn, selectedId, asOf]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const filtered = useMemo(() => {
    const list = catalog ?? [];
    return list.filter((r) => {
      if (binderFilter !== "all" && r.binder !== binderFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !r.title.toLowerCase().includes(q) &&
          !r.id.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [catalog, binderFilter, search]);

  const gapFor = WAVE_E_REPORT_GAPS.find((g) => g.id === selectedId);

  const isThermal = payload?.format === "THERMAL_80MM";

  return (
    <>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #v2-report-print-root,
          #v2-report-print-root * {
            visibility: visible;
          }
          #v2-report-print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: #0f172a !important;
            padding: 12mm;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="flex flex-col h-[calc(100vh-56px)] bg-[#030712] text-slate-100 overflow-hidden font-sans no-print">
        <header className="border-b border-white/[0.08] bg-slate-950/80 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 glass-card [transform:translateZ(0)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-white truncate">
                16-Report studio (API)
              </h1>
              <p className="text-[11px] text-slate-400">
                Live rows from GET <code className="text-indigo-300">/v1/reports/:id</code>{" "}
                · Bhutan calendar date (Thimphu)
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-[11px] text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
              <input
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-white text-xs"
              />
            </label>
            <TactileButton
              variant="secondary"
              size="sm"
              onClick={() => void loadReport()}
              disabled={!signedIn || loading}
              icon={
                loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )
              }
            >
              Refresh
            </TactileButton>
            <TactileButton
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
              disabled={!payload}
              icon={<Printer className="w-3.5 h-3.5" />}
            >
              Print
            </TactileButton>
          </div>
        </header>

        {!signedIn ? (
          <NeoGlassCard className="m-4 p-4 text-sm text-amber-200 border-amber-500/30 glass-card">
            Sign in on <code className="text-amber-100">/v2</code> with PIN to load reports.
          </NeoGlassCard>
        ) : null}

        {catError ? (
          <p className="px-4 text-xs text-rose-400">{catError}</p>
        ) : null}
        {loadError ? (
          <p className="px-4 text-xs text-rose-400">{loadError}</p>
        ) : null}

        <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden min-h-0">
          <div className="col-span-12 lg:col-span-4 border-r border-white/[0.08] bg-slate-950/40 p-3 flex flex-col gap-3 overflow-y-auto">
            <div className="flex flex-wrap gap-1 text-[10px]">
              {["all", "operations", "revenue", "purchases", "b2b"].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBinderFilter(b)}
                  className={`px-2 py-1 rounded-lg capitalize ${
                    binderFilter === b
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-900/80 text-slate-400"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title or id…"
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-8 pr-2 py-2 text-xs text-white"
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto">
              {filtered.map((r) => {
                const sel = selectedId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`text-left p-2.5 rounded-xl border text-[11px] transition-colors ${
                      sel
                        ? "bg-indigo-600/20 border-indigo-500/50"
                        : "bg-slate-900/50 border-white/5 hover:border-white/15"
                    }`}
                  >
                    <span className="font-mono text-indigo-300">{r.id}</span>{" "}
                    <span className="text-white font-semibold">{r.title}</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5 capitalize">
                      {r.binder}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 p-4 overflow-y-auto bg-slate-950/80">
            {gapFor ? (
              <div className="mb-3 flex items-start gap-2 text-[11px] text-amber-200 bg-amber-950/40 border border-amber-500/25 rounded-xl p-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{gapFor.gap}</span>
              </div>
            ) : null}
            <div
              id="v2-report-print-root"
              className={`mx-auto bg-white text-slate-900 shadow-xl border border-slate-200 rounded-xl ${
                isThermal ? "max-w-xs font-mono text-[11px] p-4" : "max-w-3xl p-8"
              }`}
            >
              {payload ? (
                <>
                  <div className="border-b border-slate-300 pb-3 mb-4">
                    <p className="text-[10px] uppercase text-slate-500 font-semibold">
                      {payload.meta.binder} · Report {payload.meta.number}
                    </p>
                    <h2 className="text-lg font-bold text-slate-900">
                      {payload.meta.title}
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      {payload.property.legalName || payload.property.name || "Property"}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 mt-2 font-mono">
                      <span>As of {payload.asOf}</span>
                      {payload.property.tpn ? (
                        <span>TPN {payload.property.tpn}</span>
                      ) : null}
                      {payload.property.license ? (
                        <span>License {payload.property.license}</span>
                      ) : null}
                    </div>
                  </div>

                  {payload.rows.length === 0 ? (
                    <p className="text-sm text-slate-500">No rows for this filter.</p>
                  ) : isThermal ? (
                    <div className="space-y-1">
                      {payload.rows.map((row, i) => (
                        <div key={i} className="text-left space-y-0.5 border-b border-dashed border-slate-300 pb-1 mb-1 last:border-0">
                          {rowCells(row).map((c) => (
                            <div key={c.k} className="flex justify-between gap-2">
                              <span className="text-slate-600 capitalize">{c.k}</span>
                              <span className="font-mono">{c.v}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                      <p className="text-[9px] text-slate-500 pt-2 border-t border-dashed border-slate-400">
                        Hash {payload.verificationHash}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse border border-slate-300">
                        <thead>
                          <tr className="bg-slate-100">
                            {rowCells(payload.rows[0]!).map((c) => (
                              <th
                                key={c.k}
                                className="border border-slate-300 p-2 text-left font-semibold capitalize"
                              >
                                {c.k.replace(/([A-Z])/g, " $1").trim()}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {payload.rows.map((row, ri) => (
                            <tr key={ri} className="odd:bg-white even:bg-slate-50">
                              {rowCells(row).map((c) => (
                                <td key={c.k} className="border border-slate-300 p-2 font-mono">
                                  {c.v}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="text-[10px] text-slate-500 mt-3 font-mono">
                        Verification hash {payload.verificationHash}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    "Select a report"
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
