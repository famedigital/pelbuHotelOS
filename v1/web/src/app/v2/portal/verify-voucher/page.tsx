"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { TicketCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { NeoGlassCard, TactileButton } from "@/components/ui/neo-spatial";
import { EmptyState } from "@/components/ui/empty-state";
import { deskFetchJson, DeskApiError } from "@/lib/v2/desk-api-client";
import { readV2DeskToken } from "@/lib/v2/desk-api";

type VerifyPayload = {
  booking: {
    id: string;
    confirmation_code: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    status: string | null;
    check_in: string;
    check_out: string;
    quoted_total_btn: number | null;
    guest_origin: string | null;
    source: string | null;
  } | null;
};

export default function V2VerifyVoucherPage() {
  const signedIn = Boolean(readV2DeskToken());
  const [code, setCode] = useState("");
  const [result, setResult] = useState<VerifyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const lookup = () => {
    if (!signedIn) {
      toast.error("Sign in on /v2 first.");
      return;
    }
    const c = code.trim();
    if (!c) {
      toast.error("Enter a confirmation code.");
      return;
    }
    start(async () => {
      try {
        setError(null);
        const data = await deskFetchJson<VerifyPayload>(
          `/v1/bookings/by-confirmation?code=${encodeURIComponent(c)}`,
        );
        setResult(data);
        if (!data.booking) {
          toast.message("No booking matched", { description: c });
        } else {
          toast.success("Booking found");
        }
      } catch (err) {
        console.error("[v2/verify-voucher]", err);
        const msg = err instanceof DeskApiError ? err.message : String(err);
        setError(msg);
        setResult(null);
      }
    });
  };

  const b = result?.booking;

  return (
    <div className="flex-1 min-h-[calc(100vh-56px)] bg-[#030712] text-slate-100 p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center [transform:translateZ(0)]">
            <TicketCheck className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Verify code</h1>
            <p className="text-[11px] text-slate-500">
              GET <code className="text-slate-400">/v1/bookings/by-confirmation</code> — matches{" "}
              <code className="text-slate-400">bookings.confirmation_code</code> for your property.
            </p>
          </div>
        </div>

        {!signedIn ? (
          <NeoGlassCard className="p-4 border-amber-500/25 glass-card">
            <p className="text-sm text-amber-200">
              Sign in on <Link href="/v2" className="underline">/v2</Link> (desk JWT) to verify against your tenant.
            </p>
          </NeoGlassCard>
        ) : null}

        <NeoGlassCard className="p-4 glass-card border-white/[0.12] [transform:translateZ(0)]">
          <label className="grid gap-1 text-xs text-slate-400 mb-3">
            Confirmation / voucher code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. BK-…"
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
            />
          </label>
          <TactileButton
            variant="primary"
            size="md"
            disabled={!signedIn || pending}
            onClick={() => lookup()}
            icon={pending ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
          >
            Lookup
          </TactileButton>
          {error ? (
            <p className="text-sm text-rose-400 mt-3" role="alert">
              {error}
            </p>
          ) : null}
        </NeoGlassCard>

        {signedIn && result && !b ? (
          <EmptyState
            className="border-white/10 bg-slate-900/40 text-slate-100"
            title="No match"
            description="No booking with that confirmation code in this property."
          />
        ) : null}

        {b ? (
          <NeoGlassCard className="p-5 glass-card border-emerald-500/20 [transform:translateZ(0)] space-y-2 text-sm">
            <p className="text-xs text-slate-500 uppercase font-semibold">Stay</p>
            <p className="text-lg font-bold text-white font-mono">{b.confirmation_code || "—"}</p>
            <p className="text-slate-200">{b.contact_name || "Guest"}</p>
            <p className="text-xs text-slate-500 font-mono">
              {b.check_in} → {b.check_out}
            </p>
            <div className="flex flex-wrap gap-2 pt-2 text-[11px]">
              <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-white/10 text-slate-300">
                status: {b.status ?? "—"}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-white/10 text-slate-300">
                source: {b.source ?? "—"}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-white/10 text-slate-300">
                origin: {b.guest_origin ?? "—"}
              </span>
            </div>
            {b.quoted_total_btn != null ? (
              <p className="text-amber-400 font-mono pt-2">Quoted Nu. {b.quoted_total_btn}</p>
            ) : null}
          </NeoGlassCard>
        ) : null}
      </div>
    </div>
  );
}
