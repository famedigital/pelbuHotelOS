"use client";

import React, { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { Globe2, Landmark, Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { NeoGlassCard, TactileButton } from "@/components/ui/neo-spatial";
import { EmptyState } from "@/components/ui/empty-state";
import { getDeskApiBaseUrl } from "@/lib/v2/desk-api";
import { newIdempotencyKey } from "@/lib/v2/desk-api-client";
import { superadminFetchJson } from "@/lib/v2/superadmin-api-client";

type ExploreRow = {
  propertyId: string;
  name: string;
  slug: string;
  availableRooms: number;
  nightlyFromBtn: number | null;
  stayFromBtn: number | null;
  nights: number;
  seasonKind: string;
  commissionRate: number;
  currency: string;
  quoteWarning?: string;
};

type ExplorePayload = {
  checkIn: string;
  checkOut: string;
  results: ExploreRow[];
  error?: string;
};

type PropertyQuote = {
  property: { id: string; name: string; slug: string };
  roomTypes: Array<{ id: string; name: string; code: string }>;
  quote: {
    roomTypeQuotes: Array<{
      roomTypeId: string;
      name: string;
      nightlyBtn: number | null;
    }>;
    nightlyFromBtn: number | null;
    availableRooms: number;
  } | null;
};

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim(),
  );
}

function defaultDates() {
  const inDate = new Date();
  inDate.setUTCDate(inDate.getUTCDate() + 1);
  const outDate = new Date(inDate);
  outDate.setUTCDate(outDate.getUTCDate() + 2);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { checkIn: fmt(inDate), checkOut: fmt(outDate) };
}

export default function V2MarketplacePage() {
  const defaults = defaultDates();
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [market, setMarket] = useState<"local" | "international">("local");
  const [rows, setRows] = useState<ExploreRow[] | null>(null);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [bookFor, setBookFor] = useState<ExploreRow | null>(null);
  const [propQuote, setPropQuote] = useState<PropertyQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [bookResult, setBookResult] = useState<Record<string, unknown> | null>(null);

  const [commissionOpen, setCommissionOpen] = useState(false);
  const [commissionPropertyId, setCommissionPropertyId] = useState("");
  const [commissionBookingId, setCommissionBookingId] = useState("");
  const [commissionGross, setCommissionGross] = useState("");
  const [commissionMarket, setCommissionMarket] = useState<"local" | "international">("local");

  const runExplore = useCallback(() => {
    start(async () => {
      try {
        setExploreError(null);
        setRows(null);
        const base = getDeskApiBaseUrl();
        const url = new URL(`${base}/v1/marketplace/explore`);
        url.searchParams.set("checkIn", checkIn);
        url.searchParams.set("checkOut", checkOut);
        url.searchParams.set("market", market);
        const res = await fetch(url.toString(), { credentials: "omit" });
        const json = (await res.json()) as ExplorePayload;
        if (!res.ok) {
          throw new Error(json.error || `Explore failed (${res.status})`);
        }
        setRows(json.results ?? []);
      } catch (err) {
        console.error("[v2/marketplace] explore", err);
        setExploreError(err instanceof Error ? err.message : String(err));
      }
    });
  }, [checkIn, checkOut, market]);

  const openBook = (r: ExploreRow) => {
    setBookFor(r);
    setBookResult(null);
    setContactName("");
    setContactPhone("");
    setRoomTypeId("");
    setPropQuote(null);
    setQuoteLoading(true);
    void (async () => {
      try {
        const base = getDeskApiBaseUrl();
        const url = new URL(`${base}/v1/marketplace/property/${encodeURIComponent(r.slug)}`);
        url.searchParams.set("checkIn", checkIn);
        url.searchParams.set("checkOut", checkOut);
        const res = await fetch(url.toString(), { credentials: "omit" });
        const json = (await res.json()) as PropertyQuote & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || `Property load failed (${res.status})`);
        }
        setPropQuote(json);
        const first = json.quote?.roomTypeQuotes?.[0]?.roomTypeId;
        if (first) setRoomTypeId(first);
      } catch (err) {
        console.error("[v2/marketplace] property quote", err);
        toast.error(err instanceof Error ? err.message : String(err));
        setBookFor(null);
      } finally {
        setQuoteLoading(false);
      }
    })();
  };

  const submitBook = () => {
    if (!bookFor || !contactName.trim()) {
      toast.error("Guest name is required.");
      return;
    }
    start(async () => {
      try {
        const base = getDeskApiBaseUrl();
        const res = await fetch(`${base}/v1/marketplace/book`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: bookFor.propertyId,
            contactName: contactName.trim(),
            contactPhone: contactPhone.trim() || undefined,
            checkIn,
            checkOut,
            market,
            rooms: 1,
            adults: 2,
            roomTypeId: roomTypeId || undefined,
            idempotencyKey: newIdempotencyKey(),
          }),
        });
        const json = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          throw new Error(String(json.error || res.statusText));
        }
        setBookResult(json);
        toast.success("Hold created — server-quoted total");
      } catch (err) {
        console.error("[v2/marketplace] book", err);
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  };

  const submitCommission = () => {
    const gross = Number(commissionGross);
    if (!commissionPropertyId.trim() || !isUuid(commissionPropertyId)) {
      toast.error("Valid property UUID is required.");
      return;
    }
    if (!Number.isFinite(gross) || gross <= 0) {
      toast.error("Gross BTN must be a positive number.");
      return;
    }
    start(async () => {
      try {
        const body: Record<string, unknown> = {
          propertyId: commissionPropertyId.trim(),
          market: commissionMarket,
          grossBtn: gross,
        };
        const bid = commissionBookingId.trim();
        if (bid && isUuid(bid)) {
          body.bookingId = bid;
        }
        await superadminFetchJson("/v1/marketplace/commission", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success("Commission row posted to marketplace_commission_ledger");
        setCommissionOpen(false);
      } catch (err) {
        console.error("[v2/marketplace] commission", err);
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <div className="flex-1 min-h-[calc(100vh-56px)] bg-[#030712] text-slate-100 p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center [transform:translateZ(0)]">
              <Globe2 className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">National marketplace</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Explore uses GET <code className="text-slate-400">/v1/marketplace/explore</code>. Confirm is POST{" "}
                <code className="text-slate-400">/v1/marketplace/book</code> (server quote only). Commission ledger:
                POST <code className="text-slate-400">/v1/marketplace/commission</code> (platform admin JWT).
              </p>
            </div>
          </div>
          <Link
            href="/v2"
            className="text-xs text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-xl border border-white/10"
          >
            ← v2 hub
          </Link>
        </div>

        <NeoGlassCard className="p-4 sm:p-5 glass-card border-white/[0.12] [transform:translateZ(0)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <label className="text-xs text-slate-400 grid gap-1">
              Check-in
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
              />
            </label>
            <label className="text-xs text-slate-400 grid gap-1">
              Check-out
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
              />
            </label>
            <label className="text-xs text-slate-400 grid gap-1">
              Market
              <select
                value={market}
                onChange={(e) => setMarket(e.target.value as "local" | "international")}
                className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
              >
                <option value="local">Local (3% commission)</option>
                <option value="international">International (5%)</option>
              </select>
            </label>
            <TactileButton
              variant="primary"
              size="md"
              disabled={pending}
              onClick={() => runExplore()}
              icon={<ShoppingBag className="w-4 h-4" />}
            >
              Search inventory
            </TactileButton>
          </div>
          {exploreError ? (
            <p className="text-sm text-rose-400 mt-3" role="alert">
              {exploreError}
            </p>
          ) : null}
        </NeoGlassCard>

        <NeoGlassCard className="p-4 glass-card border-amber-500/20 [transform:translateZ(0)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-amber-200 flex items-center gap-2">
                <Landmark className="w-4 h-4" /> Confirm path & commission
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-3xl">
                Book creates a <strong className="text-slate-300">held</strong> row with server{" "}
                <code className="text-slate-400">quoted_total_btn</code>. The API message states commission posts when
                the property confirms the stay — there is no public “confirm hold” route in apps/api. Use desk workflows
                (deposit / Innora) to move status off hold. Platform admins can still POST manual rows to{" "}
                <code className="text-slate-400">marketplace_commission_ledger</code> via{" "}
                <code className="text-slate-400">/v1/marketplace/commission</code>.
              </p>
            </div>
            <TactileButton variant="secondary" size="sm" onClick={() => setCommissionOpen((v) => !v)}>
              {commissionOpen ? "Hide" : "Record commission"} (admin)
            </TactileButton>
          </div>
          {commissionOpen ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 border-t border-white/10 pt-4">
              <input
                placeholder="propertyId (uuid)"
                value={commissionPropertyId}
                onChange={(e) => setCommissionPropertyId(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
              <input
                placeholder="bookingId (optional uuid)"
                value={commissionBookingId}
                onChange={(e) => setCommissionBookingId(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
              <input
                placeholder="gross BTN"
                value={commissionGross}
                onChange={(e) => setCommissionGross(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
              <select
                value={commissionMarket}
                onChange={(e) =>
                  setCommissionMarket(e.target.value as "local" | "international")
                }
                className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="local">local</option>
                <option value="international">international</option>
              </select>
              <TactileButton variant="amber" size="md" disabled={pending} onClick={() => submitCommission()}>
                Post ledger row
              </TactileButton>
            </div>
          ) : null}
        </NeoGlassCard>

        {rows && rows.length === 0 && !exploreError ? (
          <EmptyState
            className="border-white/10 bg-slate-900/40 text-slate-100"
            title="No properties"
            description="The explore response had zero rows (check API logs or date range)."
          />
        ) : null}

        {rows && rows.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-slate-950/80">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500 uppercase text-[10px] border-b border-white/10">
                <tr>
                  <th className="py-3 px-3">Property</th>
                  <th className="py-3 px-3">Avail</th>
                  <th className="py-3 px-3">From / stay</th>
                  <th className="py-3 px-3">Commission</th>
                  <th className="py-3 px-3 text-right">Hold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r) => (
                  <tr key={r.propertyId} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-3">
                      <p className="text-sm font-bold text-white">{r.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{r.slug}</p>
                      {r.quoteWarning ? (
                        <p className="text-[10px] text-amber-400 mt-1">{r.quoteWarning}</p>
                      ) : null}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">{r.availableRooms}</td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {r.nightlyFromBtn != null ? `Nu. ${r.nightlyFromBtn}/nt` : "—"}
                      {r.stayFromBtn != null ? (
                        <span className="block text-[10px] text-slate-500">
                          stay Nu. {r.stayFromBtn}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 px-3 text-amber-400 font-mono">
                      {(r.commissionRate * 100).toFixed(0)}% · {r.currency}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <TactileButton variant="secondary" size="sm" onClick={() => openBook(r)}>
                        Book hold
                      </TactileButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {bookFor ? (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <NeoGlassCard className="w-full max-w-lg p-6 glass-card border-white/[0.12] max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-white mb-1">Create held booking</h2>
              <p className="text-[11px] text-slate-500 mb-4">{bookFor.name}</p>
              {quoteLoading ? (
                <p className="text-sm text-slate-400 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading quote…
                </p>
              ) : propQuote?.quote ? (
                <div className="text-xs text-slate-400 space-y-2 mb-4">
                  <p>
                    Available rooms:{" "}
                    <span className="text-white font-mono">{propQuote.quote.availableRooms}</span>
                  </p>
                  <label className="grid gap-1 text-slate-400">
                    Room type (server-priced)
                    <select
                      value={roomTypeId}
                      onChange={(e) => setRoomTypeId(e.target.value)}
                      className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                    >
                      {propQuote.quote.roomTypeQuotes.length === 0 ? (
                        <option value="">BAR (lowest)</option>
                      ) : (
                        propQuote.quote.roomTypeQuotes.map((q) => (
                          <option key={q.roomTypeId} value={q.roomTypeId}>
                            {q.name} — Nu. {q.nightlyBtn ?? "—"}/nt
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                </div>
              ) : (
                <p className="text-rose-400 text-sm mb-4">No quote for those dates — pick other dates.</p>
              )}
              <label className="grid gap-1 text-xs text-slate-400 mb-2">
                Guest name
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                  required
                />
              </label>
              <label className="grid gap-1 text-xs text-slate-400 mb-4">
                Phone (optional)
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </label>
              <div className="flex gap-2 justify-end">
                <TactileButton variant="ghost" size="md" onClick={() => setBookFor(null)}>
                  Cancel
                </TactileButton>
                <TactileButton variant="primary" size="md" disabled={pending} onClick={() => submitBook()}>
                  Submit hold
                </TactileButton>
              </div>
              {bookResult ? (
                <pre className="mt-4 text-[10px] text-emerald-400/90 bg-slate-950 p-3 rounded-xl overflow-x-auto border border-emerald-500/20">
                  {JSON.stringify(bookResult, null, 2)}
                </pre>
              ) : null}
            </NeoGlassCard>
          </div>
        ) : null}

        {pending ? (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-slate-200 px-3 py-2 rounded-xl border border-white/10 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Working…
          </div>
        ) : null}
      </div>
    </div>
  );
}
