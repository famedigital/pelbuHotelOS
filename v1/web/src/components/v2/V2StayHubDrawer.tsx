"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { isBrowserOnline } from "@hotel-os/engine";
import { X, Loader2 } from "lucide-react";
import { NeoGlassCard, TactileButton } from "@/components/ui/neo-spatial";
import {
  newIdempotencyKey,
  deskFetchJson,
  DeskApiError,
} from "@/lib/v2/desk-api-client";
import { refreshV2DeskEngine } from "@/lib/v2/rehydrate-engine";

type StaySummary = {
  bookingId: string;
  confirmationCode: string;
  guestName: string;
  phone: string | null;
  status: string;
  checkIn: string;
  checkOut: string;
  mealPlan: string | null;
  balanceBtn: number;
  chargesBtn: number;
  paidBtn: number;
  folioLines: Array<{
    id: string;
    description: string | null;
    total_btn: number | null;
    source_type: string | null;
    status: string | null;
    created_at: string | null;
  }>;
  assignments: unknown[];
};

export function V2StayHubDrawer({
  bookingId,
  onClose,
  onMutated,
}: {
  bookingId: string | null;
  onClose: () => void;
  /** Called after successful check-in/out/charge/pay (parent may reload boards). */
  onMutated?: () => void;
}) {
  const [stay, setStay] = useState<StaySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payAmt, setPayAmt] = useState("");
  const [chargeAmt, setChargeAmt] = useState("");
  const [chargeDesc, setChargeDesc] = useState("Misc charge");
  const [pending, start] = useTransition();
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : isBrowserOnline(),
  );

  useEffect(() => {
    const sync = () => setOnline(isBrowserOnline());
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const loadStay = useCallback(() => {
    if (!bookingId) return;
    start(async () => {
      try {
        setError(null);
        const raw = await deskFetchJson<Record<string, unknown>>(
          `/v1/stays/${bookingId}`,
        );
        setStay({
          bookingId: String(raw.bookingId ?? ""),
          confirmationCode: String(raw.confirmationCode ?? ""),
          guestName: String(raw.guestName ?? ""),
          phone: (raw.phone as string | null) ?? null,
          status: String(raw.status ?? ""),
          checkIn: String(raw.checkIn ?? ""),
          checkOut: String(raw.checkOut ?? ""),
          mealPlan: (raw.mealPlan as string | null) ?? null,
          balanceBtn: Number(raw.balanceBtn ?? 0),
          chargesBtn: Number(raw.chargesBtn ?? 0),
          paidBtn: Number(raw.paidBtn ?? 0),
          folioLines: Array.isArray(raw.folioLines)
            ? (raw.folioLines as StaySummary["folioLines"])
            : [],
          assignments: Array.isArray(raw.assignments) ? raw.assignments : [],
        });
      } catch (err) {
        console.error("[V2StayHubDrawer] load failed", { bookingId, err });
        setError(err instanceof Error ? err.message : String(err));
        setStay(null);
      }
    });
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) {
      setStay(null);
      return;
    }
    loadStay();
  }, [bookingId, loadStay]);

  if (!bookingId) return null;

  const assertOnline = (label: string) => {
    if (!isBrowserOnline()) {
      throw new Error(`Offline — ${label} requires a live API connection.`);
    }
  };

  const handleApiError = (err: unknown, context: string) => {
    console.error(`[V2StayHubDrawer] ${context}`, err);
    const msg =
      err instanceof DeskApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    setError(msg);
    toast.error(msg);
  };

  const afterMoneySuccess = async () => {
    try {
      await refreshV2DeskEngine();
    } catch (err) {
      console.error("[V2StayHubDrawer] snapshot refresh after mutation", err);
      toast.message("Mutation saved — refresh snapshot from header if totals look stale.");
    }
    loadStay();
    onMutated?.();
  };

  return (
    <aside
      className="flex flex-col border-t md:border-t-0 md:border-l border-white/[0.08] bg-slate-950/90 p-6 gap-4 overflow-y-auto min-h-0 lg:max-w-[420px] lg:ml-auto lg:w-full"
      aria-label="StayHub"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-bold text-white m-0">StayHub</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadStay()}
            disabled={pending}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            aria-label="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!online ? (
        <p className="text-xs text-amber-400 border border-amber-500/25 rounded-xl p-2 bg-amber-500/10">
          Offline — money and stay actions are disabled until you reconnect.
        </p>
      ) : null}

      {error ? (
        <p className="text-xs text-rose-400 border border-rose-500/25 rounded-xl p-2">{error}</p>
      ) : null}

      {pending && !stay ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading stay…
        </div>
      ) : null}

      {stay ? (
        <div className="flex flex-col gap-3">
          <NeoGlassCard className="p-3 glass-card [transform:translateZ(0)]">
            <div className="font-bold text-white">{stay.guestName}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              {stay.confirmationCode} · {stay.status}
            </div>
            <div className="text-xs text-slate-300 mt-2">
              {stay.checkIn} → {stay.checkOut} · {stay.mealPlan || "EP"}
            </div>
            {stay.phone ? (
              <div className="text-[11px] text-slate-500 mt-1">Phone: {stay.phone}</div>
            ) : null}
          </NeoGlassCard>

          <NeoGlassCard className="p-3 glass-card [transform:translateZ(0)]">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-2">Folio</div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Charges</span>
              <span className="font-mono text-white">Nu. {stay.chargesBtn.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-300 mt-1">
              <span>Paid</span>
              <span className="font-mono text-white">Nu. {stay.paidBtn.toLocaleString()}</span>
            </div>
            <div
              className={`flex justify-between text-sm font-bold mt-2 pt-2 border-t border-white/10 ${
                stay.balanceBtn > 0.009 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              <span>Balance</span>
              <span className="font-mono">Nu. {stay.balanceBtn.toLocaleString()}</span>
            </div>
          </NeoGlassCard>

          <div className="flex flex-col gap-2">
            <TactileButton
              variant="emerald"
              size="lg"
              disabled={
                pending ||
                !online ||
                stay.status === "checked_in" ||
                stay.status === "checked_out" ||
                stay.status === "cancelled"
              }
              onClick={() =>
                start(async () => {
                  try {
                    assertOnline("check-in");
                    setError(null);
                    await deskFetchJson("/v1/stays/check-in", {
                      method: "POST",
                      body: JSON.stringify({
                        bookingId: stay.bookingId,
                        idempotencyKey: newIdempotencyKey(),
                      }),
                    });
                    toast.success("Checked in");
                    await afterMoneySuccess();
                  } catch (err) {
                    handleApiError(err, "check-in");
                  }
                })
              }
            >
              Check in (API)
            </TactileButton>

            <TactileButton
              variant="crimson"
              size="lg"
              disabled={pending || !online || stay.status !== "checked_in"}
              onClick={() =>
                start(async () => {
                  try {
                    assertOnline("check-out");
                    setError(null);
                    await deskFetchJson("/v1/stays/checkout", {
                      method: "POST",
                      body: JSON.stringify({
                        bookingId: stay.bookingId,
                        idempotencyKey: newIdempotencyKey(),
                        allowBalance: stay.balanceBtn > 0.009,
                      }),
                    });
                    toast.success("Checked out");
                    await afterMoneySuccess();
                    onClose();
                  } catch (err) {
                    handleApiError(err, "check-out");
                  }
                })
              }
            >
              Check out (API)
            </TactileButton>
          </div>

          <NeoGlassCard className="p-3 glass-card [transform:translateZ(0)]">
            <div className="text-xs text-slate-400 mb-2">Post charge</div>
            <input
              value={chargeDesc}
              onChange={(e) => setChargeDesc(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mb-2"
            />
            <input
              value={chargeAmt}
              onChange={(e) => setChargeAmt(e.target.value)}
              placeholder="Amount BTN (incl. tax if applicable)"
              type="number"
              step="any"
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono"
            />
            <TactileButton
              variant="primary"
              size="md"
              className="mt-2 w-full"
              disabled={pending || !online}
              onClick={() =>
                start(async () => {
                  try {
                    assertOnline("folio charge");
                    setError(null);
                    const amt = Number(chargeAmt);
                    if (!Number.isFinite(amt) || amt < 0.01) {
                      throw new Error("Enter a valid charge amount (BTN).");
                    }
                    await deskFetchJson("/v1/folio/charge", {
                      method: "POST",
                      body: JSON.stringify({
                        bookingId: stay.bookingId,
                        description: chargeDesc.trim() || "Desk charge",
                        amountBtn: amt,
                        kind: "service",
                        idempotencyKey: newIdempotencyKey(),
                      }),
                    });
                    toast.success("Charge posted");
                    setChargeAmt("");
                    await afterMoneySuccess();
                  } catch (err) {
                    handleApiError(err, "charge");
                  }
                })
              }
            >
              Post charge
            </TactileButton>
          </NeoGlassCard>

          <NeoGlassCard className="p-3 glass-card [transform:translateZ(0)]">
            <div className="text-xs text-slate-400 mb-2">Record cash payment</div>
            <input
              value={payAmt}
              onChange={(e) => setPayAmt(e.target.value)}
              placeholder="Amount BTN"
              type="number"
              step="any"
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono"
            />
            <TactileButton
              variant="amber"
              size="md"
              className="mt-2 w-full"
              disabled={pending || !online}
              onClick={() =>
                start(async () => {
                  try {
                    assertOnline("payment");
                    setError(null);
                    const amt = Number(payAmt);
                    if (!Number.isFinite(amt) || amt < 0.01) {
                      throw new Error("Enter a valid payment amount (BTN).");
                    }
                    await deskFetchJson("/v1/folio/payment", {
                      method: "POST",
                      body: JSON.stringify({
                        bookingId: stay.bookingId,
                        amountBtn: amt,
                        method: "cash",
                        kind: "settlement",
                        idempotencyKey: newIdempotencyKey(),
                      }),
                    });
                    toast.success("Payment recorded");
                    setPayAmt("");
                    await afterMoneySuccess();
                  } catch (err) {
                    handleApiError(err, "payment");
                  }
                })
              }
            >
              Record payment
            </TactileButton>
          </NeoGlassCard>

          <div className="text-[10px] text-slate-500 border border-white/10 rounded-xl p-2">
            Folio lines (latest). Full detail in{" "}
            <Link href="/erp" className="text-indigo-400 underline">
              Innora
            </Link>{" "}
            if needed.
          </div>
          <div className="max-h-40 overflow-y-auto flex flex-col gap-1 text-[11px]">
            {stay.folioLines.length === 0 ? (
              <p className="text-slate-500 italic text-center py-2">No lines yet.</p>
            ) : (
              stay.folioLines.slice(0, 24).map((line) => (
                <div
                  key={line.id}
                  className="flex justify-between border-b border-white/5 py-1 text-slate-300"
                >
                  <span className="truncate pr-2">{line.description ?? "—"}</span>
                  <span className="font-mono text-white shrink-0">
                    Nu. {Number(line.total_btn ?? 0).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
