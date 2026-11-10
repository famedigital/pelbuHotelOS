import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard } from "@hotel-os/ui";
import { api } from "../api";

export function AgentsPage() {
  const [agents, setAgents] = useState<
    Array<{
      id: string;
      companyName: string;
      contactName: string | null;
      phone: string | null;
      creditLimitBtn: number;
      balanceBtn: number;
      isActive: boolean;
      agentCode: string | null;
    }>
  >([]);
  const [dossier, setDossier] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    start(async () => {
      try {
        const res = await api<{ agents: typeof agents }>("/v1/agents");
        setAgents(res.agents);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }, []);

  return (
    <div className="desk-grid">
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>B2B agents</h2>
        {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
        {pending ? <p style={{ color: "#94a3b8" }}>Loading…</p> : null}
        {agents.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() =>
              start(async () => {
                setDossier(await api(`/v1/agents/${a.id}`));
              })
            }
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: 10,
              marginBottom: 6,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "#0b1220",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <strong>{a.companyName}</strong>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {a.agentCode || "—"} · bal BTN {a.balanceBtn.toLocaleString()} / limit{" "}
              {a.creditLimitBtn.toLocaleString()}
            </div>
          </button>
        ))}
        {!agents.length && !pending ? (
          <p style={{ color: "#94a3b8" }}>No agents</p>
        ) : null}
      </NeoGlassCard>
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>Dossier</h2>
        {dossier ? (
          <pre
            style={{
              fontSize: 11,
              background: "#0b1220",
              padding: 10,
              borderRadius: 8,
              overflow: "auto",
              maxHeight: 480,
            }}
          >
            {JSON.stringify(dossier, null, 2)}
          </pre>
        ) : (
          <p style={{ color: "#94a3b8" }}>Select an agent</p>
        )}
      </NeoGlassCard>
    </div>
  );
}
