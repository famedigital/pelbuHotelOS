"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, RefreshCw, Users, X } from "lucide-react";
import { NeoGlassCard, TactileButton } from "@/components/ui/neo-spatial";
import { deskFetchJson, DeskApiError } from "@/lib/v2/desk-api-client";
import { readV2DeskToken } from "@/lib/v2/desk-api";

type AgentRow = {
  id: string;
  linkId: string;
  companyName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  market: string | null;
  rateTier: string;
  linkStatus: string;
  isActive: boolean;
  creditLimitBtn: number;
  balanceBtn: number;
  creditAvailableBtn: number;
  openRoomCap: number | null;
};

type Dossier = {
  agent: {
    id: string;
    company_name: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    market: string | null;
    status: string | null;
    commission_pct: number | null;
  };
  creditLedger: Array<{
    id: string;
    entry_type: string;
    amount_btn: number;
    balance_after_btn: number;
    note: string | null;
    created_at: string;
  }>;
};

export const V2AgentsWorkspace: React.FC = () => {
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dossier, setDossier] = useState<Dossier | null>(null);

  const signedIn = Boolean(readV2DeskToken());

  const load = useCallback(() => {
    if (!signedIn) return;
    start(async () => {
      try {
        setError(null);
        const res = await deskFetchJson<{ agents: AgentRow[] }>("/v1/agents");
        setRows(res.agents ?? []);
      } catch (err) {
        console.error("[V2AgentsWorkspace]", err);
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

  useEffect(() => {
    if (!detailId || !signedIn) {
      setDossier(null);
      return;
    }
    start(async () => {
      try {
        const d = await deskFetchJson<Dossier>(`/v1/agents/${detailId}`);
        setDossier(d);
      } catch (err) {
        console.error("[V2AgentsWorkspace] dossier", err);
        toast.error(err instanceof DeskApiError ? err.message : String(err));
        setDossier(null);
      }
    });
  }, [detailId, signedIn]);

  if (!signedIn) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-100">
        <NeoGlassCard className="max-w-md p-6 text-center glass-card">
          <p className="text-sm">
            <Link href="/v2" className="text-indigo-400 underline">
              Sign in
            </Link>{" "}
            to load agents for this property.
          </p>
        </NeoGlassCard>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col lg:flex-row overflow-hidden bg-[#030712] text-slate-100">
      <div className="flex-1 min-h-0 flex flex-col p-4 overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <div>
              <h1 className="text-lg font-bold text-white">Tour operators</h1>
              <p className="text-[11px] text-slate-400">GET /v1/agents · credit from agent_property_links</p>
            </div>
          </div>
          <TactileButton
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => load()}
            icon={pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          >
            Reload
          </TactileButton>
        </div>

        <NeoGlassCard className="p-3 mb-3 text-[11px] text-slate-400 border-amber-500/20 glass-card">
          <strong className="text-amber-300">Tour master split:</strong> no POST in apps/api for a one-click split in
          Wave C — that flow remains Innora-only until a dedicated atomic RPC exists. This screen is credit + ledger
          only.
        </NeoGlassCard>

        {error ? <p className="text-xs text-rose-400 mb-2">{error}</p> : null}

        <div className="flex-1 min-h-0 rounded-xl border border-white/10 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-900/95 z-10 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="p-2">Company</th>
                <th className="p-2">Link</th>
                <th className="p-2 text-right">Credit limit</th>
                <th className="p-2 text-right">Used</th>
                <th className="p-2 text-right">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.length === 0 && !pending ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 italic">
                    No agent_property_links for this hotel.
                  </td>
                </tr>
              ) : (
                rows.map((a) => (
                  <tr
                    key={a.id}
                    className={`hover:bg-white/[0.03] cursor-pointer ${detailId === a.id ? "bg-indigo-500/10" : ""}`}
                    onClick={() => setDetailId(a.id)}
                  >
                    <td className="p-2 text-white font-medium">{a.companyName || "—"}</td>
                    <td className="p-2 text-slate-400">{a.linkStatus}</td>
                    <td className="p-2 text-right font-mono">Nu. {a.creditLimitBtn.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono text-amber-400">Nu. {a.balanceBtn.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono text-emerald-400">Nu. {a.creditAvailableBtn.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailId && (
        <aside className="w-full lg:w-[400px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-slate-950/90 p-4 overflow-y-auto">
          <div className="flex justify-between items-start mb-3">
            <h2 className="text-sm font-bold text-white">Credit ledger</h2>
            <button
              type="button"
              onClick={() => setDetailId(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {!dossier ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : (
            <>
              <NeoGlassCard className="p-3 mb-3 glass-card text-xs">
                <div className="font-bold text-white">{dossier.agent.company_name}</div>
                <div className="text-slate-400 mt-1">{dossier.agent.contact_phone || dossier.agent.contact_email}</div>
              </NeoGlassCard>
              <div className="space-y-2 text-[11px]">
                {dossier.creditLedger.length === 0 ? (
                  <p className="text-slate-500 italic">No ledger rows.</p>
                ) : (
                  dossier.creditLedger.map((e) => (
                    <div key={e.id} className="border-b border-white/5 py-2">
                      <div className="flex justify-between text-white">
                        <span className="uppercase text-[10px] text-slate-400">{e.entry_type}</span>
                        <span className="font-mono">Nu. {e.amount_btn}</span>
                      </div>
                      <div className="text-slate-500 text-[10px]">{new Date(e.created_at).toLocaleString()}</div>
                      {e.note ? <div className="text-slate-400 mt-0.5">{e.note}</div> : null}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </aside>
      )}
    </div>
  );
};
