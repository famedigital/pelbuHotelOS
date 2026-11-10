"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Moon, RefreshCw, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { NeoGlassCard, TactileButton } from "@/components/ui/neo-spatial";
import {
  deskFetchJson,
  newIdempotencyKey,
  DeskApiError,
} from "@/lib/v2/desk-api-client";
import { readV2DeskToken } from "@/lib/v2/desk-api";

type Preview = {
  businessDate: string;
  closeTime: string | null;
  inHouseCount: number;
  arrivalCount: number;
  departureCount: number;
  openFolioCount: number;
  blockers: string[];
  runAvailable: boolean;
  runWhere: string;
};

export const V2NightAuditPage: React.FC = () => {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<Record<string, unknown> | null>(null);
  const [pending, start] = useTransition();

  const signedIn = Boolean(readV2DeskToken());

  const load = useCallback(() => {
    if (!signedIn) return;
    start(async () => {
      try {
        setError(null);
        const p = await deskFetchJson<Preview>("/v1/night-audit/preview");
        setPreview(p);
      } catch (err) {
        console.error("[V2NightAuditPage] preview", err);
        const msg =
          err instanceof DeskApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        setError(msg);
      }
    });
  }, [signedIn]);

  useEffect(() => {
    load();
  }, [load]);

  const run = () => {
    start(async () => {
      try {
        setRunResult(null);
        const res = await deskFetchJson<Record<string, unknown>>("/v1/night-audit/run", {
          method: "POST",
          body: JSON.stringify({
            idempotencyKey: newIdempotencyKey(),
          }),
        });
        setRunResult(res);
        toast.success("Night audit completed");
        load();
      } catch (err) {
        console.error("[V2NightAuditPage] run", err);
        const msg =
          err instanceof DeskApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        toast.error(msg);
        setError(msg);
      }
    });
  };

  if (!signedIn) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-100 bg-[#030712]">
        <NeoGlassCard className="max-w-md p-6 text-center glass-card">
          <p className="text-sm">
            <Link href="/v2" className="text-indigo-400 underline">
              Sign in
            </Link>{" "}
            with a staff JWT that has night-audit role (owner/gm/front_desk/cashier).
          </p>
        </NeoGlassCard>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto p-4 md:p-6 bg-[#030712] text-slate-100">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Moon className="w-6 h-6 text-indigo-400" />
            <div>
              <h1 className="text-lg font-bold text-white">Night audit</h1>
              <p className="text-[11px] text-slate-400">
                Preview GET /v1/night-audit/preview · run POST /v1/night-audit/run (core executeNightAudit)
              </p>
            </div>
          </div>
          <TactileButton
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => load()}
            icon={pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh preview
          </TactileButton>
        </div>

        {error ? (
          <NeoGlassCard className="p-3 border-rose-500/30 text-rose-300 text-sm">{error}</NeoGlassCard>
        ) : null}

        {preview ? (
          <>
            <NeoGlassCard className="p-4 glass-card">
              <div className="text-xs text-slate-400 mb-2">Business date</div>
              <div className="text-xl font-mono font-bold text-white">{preview.businessDate}</div>
              {preview.closeTime ? (
                <div className="text-[11px] text-slate-500 mt-1">Close time: {preview.closeTime}</div>
              ) : null}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-center">
                {[
                  ["In-house", preview.inHouseCount],
                  ["Arrivals", preview.arrivalCount],
                  ["Departures", preview.departureCount],
                  ["Open folios", preview.openFolioCount],
                ].map(([label, n]) => (
                  <div key={String(label)} className="rounded-xl bg-slate-900/80 border border-white/10 p-2">
                    <div className="text-[10px] text-slate-400 uppercase">{label}</div>
                    <div className="text-lg font-bold text-white font-mono">{n as number}</div>
                  </div>
                ))}
              </div>

              {preview.blockers.length > 0 ? (
                <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold mb-1">Blockers</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {preview.blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2 text-emerald-400 text-xs">
                  <CheckCircle2 className="w-4 h-4" /> No blockers in preview
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2 items-center">
                <TactileButton
                  variant="amber"
                  size="lg"
                  disabled={!preview.runAvailable || pending}
                  onClick={() => run()}
                >
                  Confirm run (API)
                </TactileButton>
                {!preview.runAvailable ? (
                  <span className="text-[11px] text-slate-500">
                    Run unavailable (role, duplicate for date, or blockers — check API message if forced in Innora).
                  </span>
                ) : null}
              </div>
            </NeoGlassCard>

            {runResult ? (
              <NeoGlassCard className="p-4 glass-card text-xs font-mono text-slate-300 overflow-x-auto">
                <div className="text-slate-400 mb-2">Last run response</div>
                <pre className="whitespace-pre-wrap break-all">{JSON.stringify(runResult, null, 2)}</pre>
              </NeoGlassCard>
            ) : null}
          </>
        ) : (
          <p className="text-slate-500 text-sm">{pending ? "Loading preview…" : "No preview"}</p>
        )}
      </div>
    </div>
  );
};
