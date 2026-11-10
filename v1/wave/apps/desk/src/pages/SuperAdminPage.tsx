import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard, TactileButton } from "@hotel-os/ui";
import { api } from "../api";

type Tenant = {
  propertyId: string;
  name: string;
  slug: string;
  tier: string;
  status: string;
  mrrBtn: number;
  paidThrough?: string | null;
};

export function SuperAdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tokenMsg, setTokenMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reload = () =>
    start(async () => {
      try {
        setError(null);
        const r = await api<{ tenants: Tenant[] }>("/v1/superadmin/tenants");
        setTenants(r.tenants);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });

  useEffect(() => {
    reload();
  }, []);

  const setLicense = (
    propertyId: string,
    status: "active" | "soft_lock" | "hard_lock" | "grace",
    tier: "boutique" | "professional" | "resort" = "boutique",
  ) => {
    start(async () => {
      await api("/v1/superadmin/license", {
        method: "POST",
        body: JSON.stringify({ propertyId, status, tier }),
      });
      reload();
    });
  };

  const mrr = tenants.reduce((s, t) => s + (t.status === "active" ? t.mrrBtn : 0), 0);

  return (
    <div style={{ padding: 4 }}>
      <NeoGlassCard>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ marginTop: 0 }}>SuperAdmin · SaaS billing</h2>
            <p style={{ fontSize: 12, color: "#94a3b8" }}>
              Active MRR Nu {mrr.toLocaleString()} · soft lock blocks writes via
              license hook · hard lock renew required
            </p>
          </div>
          <TactileButton variant="ghost" onClick={reload}>
            Refresh
          </TactileButton>
        </div>
        {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
        {pending ? <p style={{ color: "#94a3b8", fontSize: 12 }}>Working…</p> : null}
        <table style={{ width: "100%", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#94a3b8" }}>
              <th>Hotel</th>
              <th>Tier</th>
              <th>Status</th>
              <th>MRR</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.propertyId}>
                <td style={{ padding: 8, background: "#0b1220" }}>
                  {t.name}
                  <div style={{ fontSize: 11, color: "#64748b" }}>{t.slug}</div>
                </td>
                <td style={{ background: "#0b1220" }}>{t.tier}</td>
                <td style={{ background: "#0b1220" }}>{t.status}</td>
                <td style={{ background: "#0b1220" }}>Nu {t.mrrBtn}</td>
                <td style={{ background: "#0b1220" }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <TactileButton
                      variant="ghost"
                      onClick={() => setLicense(t.propertyId, "active", t.tier as "boutique")}
                    >
                      Active
                    </TactileButton>
                    <TactileButton
                      variant="ghost"
                      onClick={() => setLicense(t.propertyId, "soft_lock")}
                    >
                      Soft lock
                    </TactileButton>
                    <TactileButton
                      variant="ghost"
                      onClick={() => setLicense(t.propertyId, "hard_lock")}
                    >
                      Hard lock
                    </TactileButton>
                    <TactileButton
                      variant="ghost"
                      onClick={() => {
                        void api<{ token: string; expiresAt: string }>(
                          "/v1/superadmin/bypass-token",
                          {
                            method: "POST",
                            body: JSON.stringify({ propertyId: t.propertyId }),
                          },
                        ).then((r) =>
                          setTokenMsg(
                            `${t.name}: ${r.token} until ${r.expiresAt}`,
                          ),
                        );
                      }}
                    >
                      48h bypass
                    </TactileButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tokenMsg ? <p style={{ color: "#fbbf24" }}>{tokenMsg}</p> : null}
      </NeoGlassCard>
    </div>
  );
}
