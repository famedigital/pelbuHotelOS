import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard } from "@hotel-os/ui";
import { api } from "../api";

export function LoyaltyPage() {
  const [members, setMembers] = useState<Array<Record<string, unknown>>>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    start(async () => {
      try {
        const res = await api<{
          members: Array<Record<string, unknown>>;
          warning?: string;
        }>("/v1/loyalty");
        setMembers(res.members);
        setWarning(res.warning || null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }, []);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Loyalty</h1>
      {warning ? <p style={{ color: "#fbbf24", fontSize: 12 }}>{warning}</p> : null}
      {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
      {pending ? <p style={{ color: "#94a3b8" }}>Loading…</p> : null}
      <NeoGlassCard>
        {members.map((m) => (
          <div
            key={String(m.id)}
            style={{
              padding: 10,
              background: "#0b1220",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              fontSize: 13,
            }}
          >
            <strong>{String(m.guest_name)}</strong> · {String(m.tier)} ·{" "}
            {Number(m.points || 0)} pts
          </div>
        ))}
        {!members.length && !pending ? (
          <p style={{ color: "#94a3b8" }}>No loyalty members</p>
        ) : null}
      </NeoGlassCard>
    </div>
  );
}
