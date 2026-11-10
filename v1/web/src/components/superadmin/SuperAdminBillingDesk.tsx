"use client";

import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Building2,
  RefreshCw,
  Loader2,
  Key,
  Search,
  AlertTriangle,
  Store,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  NeoGlassCard,
  TactileButton,
  OdometerTicker,
} from "@/components/ui/neo-spatial";
import { EmptyState } from "@/components/ui/empty-state";
import { superadminFetchJson } from "@/lib/v2/superadmin-api-client";
import { readV2DeskToken } from "@/lib/v2/desk-api";

type TenantRow = {
  propertyId: string;
  name: string;
  slug: string;
  tier: string;
  status: string;
  mrrBtn: number;
  paidThrough: string | null;
  graceUntil: string | null;
};

type TenantsPayload = { tenants: TenantRow[] };

type CommissionRow = {
  id: string;
  property_id: string;
  booking_id: string | null;
  market: string;
  gross_btn: number;
  commission_rate: number;
  commission_btn: number;
  currency: string;
  created_at: string;
};

type CommissionsPayload = { rows: CommissionRow[] };

const LICENSE_STATUSES = [
  "active",
  "grace",
  "soft_lock",
  "hard_lock",
] as const;

const TIERS = ["boutique", "professional", "resort"] as const;

export const SuperAdminBillingDesk: React.FC = () => {
  const signedIn = Boolean(readV2DeskToken());
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [bypassToken, setBypassToken] = useState<{ token: string; expiresAt: string } | null>(null);
  const [bypassForName, setBypassForName] = useState<string>("");
  const [pending, start] = useTransition();

  const loadAll = useCallback(() => {
    if (!signedIn) return;
    start(async () => {
      try {
        setLoadError(null);
        const [t, c] = await Promise.all([
          superadminFetchJson<TenantsPayload>("/v1/superadmin/tenants"),
          superadminFetchJson<CommissionsPayload>("/v1/superadmin/marketplace-commissions?limit=100"),
        ]);
        setTenants(t.tenants ?? []);
        setCommissions(c.rows ?? []);
      } catch (err) {
        console.error("[SuperAdminBillingDesk] load", err);
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(msg);
        toast.error(msg);
      }
    });
  }, [signedIn]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.propertyId.toLowerCase().includes(q),
    );
  }, [tenants, searchQuery]);

  const totalMrr = useMemo(
    () => tenants.reduce((s, t) => s + Number(t.mrrBtn || 0), 0),
    [tenants],
  );

  const updateLicense = (
    propertyId: string,
    patch: { tier?: string; status?: string; paidThrough?: string },
    current: { tier: string; status: string },
  ) => {
    start(async () => {
      try {
        await superadminFetchJson("/v1/superadmin/license", {
          method: "POST",
          body: JSON.stringify({
            propertyId,
            tier: patch.tier ?? current.tier,
            status: patch.status ?? current.status,
            ...(patch.paidThrough !== undefined ? { paidThrough: patch.paidThrough } : {}),
          }),
        });
        toast.success("License updated");
        loadAll();
      } catch (err) {
        console.error("[SuperAdminBillingDesk] license", err);
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  };

  const issueBypass = (propertyId: string, name: string) => {
    start(async () => {
      try {
        const res = await superadminFetchJson<{ token: string; expiresAt: string }>(
          "/v1/superadmin/bypass-token",
          { method: "POST", body: JSON.stringify({ propertyId }) },
        );
        setBypassToken(res);
        setBypassForName(name);
        toast.success("Bypass token issued");
      } catch (err) {
        console.error("[SuperAdminBillingDesk] bypass", err);
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] bg-[#030712] text-slate-100 font-sans p-4 sm:p-6 overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Platform SuperAdmin</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Tenants & marketplace fees</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            GET <code className="text-slate-500">/v1/superadmin/tenants</code>, POST{" "}
            <code className="text-slate-500">/v1/superadmin/license</code> /{" "}
            <code className="text-slate-500">bypass-token</code>. Commission ledger: GET{" "}
            <code className="text-slate-500">/v1/superadmin/marketplace-commissions</code>. Use a platform-admin staff
            PIN on <Link href="/v2" className="text-indigo-400 underline">/v2</Link>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TactileButton
            variant="secondary"
            size="md"
            disabled={!signedIn || pending}
            onClick={() => loadAll()}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </TactileButton>
        </div>
      </div>

      {!signedIn ? (
        <NeoGlassCard className="p-4 mb-4 border-amber-500/25 glass-card">
          <p className="text-sm text-amber-200">
            Sign in on <Link href="/v2" className="underline font-medium">/v2</Link> with a user listed in{" "}
            <code className="text-slate-400">platform_admins</code>.
          </p>
        </NeoGlassCard>
      ) : null}

      <NeoGlassCard className="p-4 mb-6 border-amber-500/20 glass-card [transform:translateZ(0)]">
        <div className="flex items-start gap-2 text-xs text-amber-200/90">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-100">Gap vs ENTERPRISE-SPEC §11</p>
            <p className="text-slate-400 mt-1 text-[11px] leading-relaxed">
              There are no API routes for mBoB wire approval, RMA QR payment capture, or subscription dunning. This UI
              only reflects <code className="text-slate-500">saas_tenant_licenses</code> and{" "}
              <code className="text-slate-500">marketplace_commission_ledger</code> exposed in apps/api.
            </p>
          </div>
        </div>
      </NeoGlassCard>

      {loadError ? (
        <p className="text-sm text-rose-400 mb-4" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <NeoGlassCard className="p-5 glass-card border-white/[0.08]">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Aggregated MRR (license rows)</p>
          <OdometerTicker value={totalMrr} prefix="Nu. " className="text-2xl font-bold text-white mt-1 block" />
        </NeoGlassCard>
        <NeoGlassCard className="p-5 glass-card border-white/[0.08]">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Properties</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{tenants.length}</p>
        </NeoGlassCard>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, slug, property id…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500"
          />
        </div>
      </div>

      {signedIn && !loadError && filtered.length === 0 && tenants.length === 0 && !pending ? (
        <EmptyState
          className="mb-8 border-white/10 bg-slate-900/40 text-slate-100"
          title="No tenants"
          description="properties + saas_tenant_licenses returned empty, or you lack platform admin on this JWT."
        />
      ) : null}

      <NeoGlassCard className="p-0 overflow-hidden mb-8 glass-card border-white/[0.08]">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-bold text-white">Tenants</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/10">
              <tr>
                <th className="py-3 px-3">Property</th>
                <th className="py-3 px-3">Tier</th>
                <th className="py-3 px-3">MRR</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Paid / grace</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((t) => (
                <tr key={t.propertyId} className="hover:bg-white/[0.02]">
                  <td className="py-3 px-3">
                    <p className="font-semibold text-white text-sm">{t.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{t.slug}</p>
                  </td>
                  <td className="py-3 px-3">
                    <select
                      value={t.tier}
                      onChange={(e) =>
                        updateLicense(t.propertyId, { tier: e.target.value }, { tier: t.tier, status: t.status })
                      }
                      disabled={pending}
                      className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-white text-[11px]"
                    >
                      {TIERS.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-200">Nu. {Number(t.mrrBtn).toLocaleString()}</td>
                  <td className="py-3 px-3">
                    <select
                      value={t.status}
                      onChange={(e) =>
                        updateLicense(t.propertyId, { status: e.target.value }, { tier: t.tier, status: t.status })
                      }
                      disabled={pending}
                      className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-white text-[11px]"
                    >
                      {LICENSE_STATUSES.map((x) => (
                        <option key={x} value={x}>
                          {x.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-3 text-[10px] text-slate-500 font-mono leading-tight">
                    <span className="block text-slate-400">paid: {t.paidThrough ?? "—"}</span>
                    <span>grace: {t.graceUntil ?? "—"}</span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <TactileButton
                      size="sm"
                      variant="amber"
                      disabled={pending}
                      onClick={() => issueBypass(t.propertyId, t.name)}
                      icon={<Key className="w-3.5 h-3.5" />}
                    >
                      48h bypass
                    </TactileButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </NeoGlassCard>

      <NeoGlassCard className="p-0 overflow-hidden glass-card border-white/[0.08]">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <Store className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white">Marketplace commission ledger</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] border-b border-white/10">
              <tr>
                <th className="py-2.5 px-3">Created</th>
                <th className="py-2.5 px-3">Property</th>
                <th className="py-2.5 px-3">Market</th>
                <th className="py-2.5 px-3 text-right">Gross</th>
                <th className="py-2.5 px-3 text-right">Rate</th>
                <th className="py-2.5 px-3 text-right">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {commissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-3 text-slate-500 text-center">
                    No rows in marketplace_commission_ledger yet.
                  </td>
                </tr>
              ) : (
                commissions.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 px-3 text-slate-500 font-mono whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300 text-[10px]">{r.property_id}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold ${
                          r.market === "local"
                            ? "bg-emerald-500/12 text-emerald-400 border-emerald-500/25"
                            : "bg-indigo-500/12 text-indigo-300 border-indigo-500/25"
                        }`}
                      >
                        {r.market}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                      {r.currency} {Number(r.gross_btn).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                      {(Number(r.commission_rate) * 100).toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-400">
                      {r.currency} {Number(r.commission_btn).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </NeoGlassCard>

      {bypassToken ? (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <NeoGlassCard className="w-full max-w-md p-6 glass-card border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-bold text-white">Bypass token</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">{bypassForName}</p>
            <p className="text-2xl font-mono font-bold text-amber-300 tracking-wider text-center py-4 bg-amber-500/10 rounded-xl border border-amber-500/25">
              {bypassToken.token}
            </p>
            <p className="text-[10px] text-slate-500 text-center mt-2 font-mono">expires {bypassToken.expiresAt}</p>
            <div className="flex justify-end gap-2 mt-6">
              <TactileButton variant="secondary" size="md" onClick={() => setBypassToken(null)}>
                Close
              </TactileButton>
              <TactileButton
                variant="amber"
                size="md"
                onClick={() => {
                  void navigator.clipboard?.writeText(bypassToken.token);
                  toast.success("Copied");
                }}
              >
                Copy
              </TactileButton>
            </div>
          </NeoGlassCard>
        </div>
      ) : null}

      {pending ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-slate-200 px-3 py-2 rounded-xl border border-white/10 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Working…
        </div>
      ) : null}
    </div>
  );
};
