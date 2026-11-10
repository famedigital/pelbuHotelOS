import {
  Badge,
  Button,
  GlassPanel,
  KpiCard,
  ModuleFrame,
  StatusLegend,
} from "@hos-v2/ui";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { formatNu } from "../lib/front-office-store";

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

function apiBase(): string {
  const raw =
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_HOTEL_OS_API_URL ||
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_API_URL ||
    "";
  return String(raw).replace(/\/$/, "") || "http://127.0.0.1:4100";
}

function platformAdminToken(): string | null {
  try {
    return (
      sessionStorage.getItem("hos.platformAdminJwt") ||
      localStorage.getItem("hos.platformAdminJwt") ||
      sessionStorage.getItem("hos.deskJwt") ||
      localStorage.getItem("hos.deskJwt")
    );
  } catch {
    return null;
  }
}

/**
 * SaaS SuperAdmin — live tenants from `/v1/superadmin/tenants`.
 * Canonical national control plane remains Next `/admin` (hotels, MoU, Hermes, OTA).
 * Mock TENANTS arrays are banned here.
 */
export function SuperAdminPage() {
  const [, start] = useTransition();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bypassProperty, setBypassProperty] = useState("");
  const [tokens, setTokens] = useState<{ code: string; property: string; expires: string }[]>([]);

  const load = useCallback(() => {
    start(async () => {
      try {
        setLoadError(null);
        const token = platformAdminToken();
        const res = await fetch(`${apiBase()}/v1/superadmin/tenants`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as TenantsPayload;
        const list = json.tenants ?? [];
        setTenants(list);
        if (!bypassProperty && list[0]) setBypassProperty(list[0].propertyId);
      } catch (err) {
        console.error("[SuperAdminPage] load tenants", err);
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(msg);
        setTenants([]);
        toast.error("Could not load SaaS tenants — use /admin for platform console", {
          description: msg.slice(0, 160),
        });
      }
    });
  }, [bypassProperty]);

  useEffect(() => {
    load();
  }, [load]);

  const mrr = useMemo(
    () =>
      tenants
        .filter((t) => t.status === "active" || t.status === "grace")
        .reduce((s, t) => s + Number(t.mrrBtn || 0), 0),
    [tenants],
  );
  const arr = mrr * 12;
  const pastDue = tenants.filter(
    (t) => t.status === "soft_lock" || t.status === "hard_lock",
  ).length;

  return (
    <ModuleFrame
      title="Super Admin"
      description="Tenants · platform controls"
      actions={
        <StatusLegend
          dense
          items={[
            { id: "live", label: "Live", swatch: "var(--hos-emerald)" },
            { id: "trial", label: "Trial", swatch: "var(--hos-brass)" },
            { id: "off", label: "Suspended", swatch: "var(--hos-ruby)" },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-2xl font-bold text-[var(--hos-ink)]">SaaS SuperAdmin</h1>
            <Badge tone="default" className="border border-[var(--hos-primary)]">
              Live API
            </Badge>
          </div>
          <p className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
            Wired to <code>/v1/superadmin/tenants</code>. Full MoU · Hermes · OTA commission console:{" "}
            <strong>/admin</strong> on Innora web.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Tenants" value={tenants.length} delta="National portfolio" />
          <KpiCard label="MRR" value={formatNu(mrr)} delta="Nu / month" />
          <KpiCard label="ARR" value={formatNu(arr)} delta="Run-rate" />
          <KpiCard label="Locked" value={pastDue} />
        </div>

        {loadError ? (
          <GlassPanel className="p-3.5 text-sm text-[var(--hos-danger)]">
            {loadError}
            <div className="mt-2">
              <Button size="sm" variant="secondary" onClick={load}>
                Retry
              </Button>
            </div>
          </GlassPanel>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <GlassPanel className="overflow-x-auto p-3.5">
            <strong className="text-sm text-[var(--hos-ink)]">Tenant portfolio</strong>
            {tenants.length === 0 && !loadError ? (
              <p className="mt-3 text-xs text-[var(--hos-ink-3)]">
                No tenants returned. Onboard via platform admin or check API auth.
              </p>
            ) : (
              <table className="mt-3 w-full min-w-[720px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                    <th className="px-2 py-2">Property</th>
                    <th className="px-2 py-2">Tier</th>
                    <th className="px-2 py-2">MRR</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Paid through</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hos-line)]">
                  {tenants.map((t) => (
                    <tr key={t.propertyId}>
                      <td className="px-2 py-2">
                        <strong>{t.name}</strong>
                        <div className="font-mono text-[10px] text-[var(--hos-ink-3)]">
                          {t.slug}
                        </div>
                      </td>
                      <td className="px-2 py-2 capitalize">{t.tier}</td>
                      <td className="px-2 py-2 font-mono font-semibold">
                        {formatNu(t.mrrBtn)}
                      </td>
                      <td className="px-2 py-2">
                        <Badge
                          tone={
                            t.status === "active"
                              ? "success"
                              : t.status === "grace"
                                ? "vip"
                                : "danger"
                          }
                        >
                          {t.status}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-[var(--hos-ink-3)]">
                        {t.paidThrough ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </GlassPanel>

          <div className="flex flex-col gap-4">
            <GlassPanel className="p-3.5">
              <strong className="text-sm text-[var(--hos-ink)]">48h emergency bypass</strong>
              <p className="mt-1 text-[11px] text-[var(--hos-ink-3)]">
                Calls <code>POST /v1/superadmin/bypass-token</code> (platform admin JWT required).
              </p>
              <select
                value={bypassProperty}
                onChange={(e) => setBypassProperty(e.target.value)}
                className="mt-2 w-full rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-xs"
              >
                {tenants.map((t) => (
                  <option key={t.propertyId} value={t.propertyId}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Button
                className="mt-2 w-full"
                size="sm"
                disabled={!bypassProperty}
                onClick={() => {
                  start(async () => {
                    try {
                      const token = platformAdminToken();
                      const res = await fetch(`${apiBase()}/v1/superadmin/bypass-token`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({ propertyId: bypassProperty }),
                      });
                      if (!res.ok) throw new Error(await res.text());
                      const json = (await res.json()) as {
                        token: string;
                        expiresAt: string;
                      };
                      const prop =
                        tenants.find((t) => t.propertyId === bypassProperty)?.slug ??
                        bypassProperty;
                      setTokens((t) => [
                        { code: json.token, property: prop, expires: json.expiresAt },
                        ...t,
                      ]);
                      toast.success(`Bypass ${json.token}`, {
                        description: `Valid 48h for ${prop}`,
                      });
                    } catch (err) {
                      console.error("[SuperAdminPage] bypass", err);
                      toast.error(
                        err instanceof Error ? err.message : "Bypass failed — use /admin/hotels",
                      );
                    }
                  });
                }}
              >
                Generate HOS token
              </Button>
              <ul className="mt-3 m-0 list-none space-y-2 p-0">
                {tokens.map((t) => (
                  <li key={t.code} className="hos-cell rounded-lg px-2 py-2 font-mono text-[11px]">
                    <strong className="text-[var(--hos-primary)]">{t.code}</strong>
                    <div className="text-[var(--hos-ink-3)]">
                      {t.property} · exp {new Date(t.expires).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            </GlassPanel>

            <GlassPanel className="p-3.5">
              <strong className="text-sm text-[var(--hos-ink)]">Platform /admin</strong>
              <p className="mt-1 text-[11px] text-[var(--hos-ink-3)]">
                OTA commissions, MoU registry, Hermes fleet, vault, and licence controls live on the
                Innora Next admin console — not mock data here.
              </p>
              <Button
                className="mt-2"
                size="sm"
                variant="secondary"
                onClick={() => {
                  window.open("/admin", "_blank", "noopener,noreferrer");
                }}
              >
                Open /admin
              </Button>
            </GlassPanel>
          </div>
        </div>
      </div>
    </ModuleFrame>
  );
}
