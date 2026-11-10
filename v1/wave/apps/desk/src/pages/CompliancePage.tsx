import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard } from "@hotel-os/ui";
import { api } from "../api";

export function CompliancePage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    start(async () => {
      try {
        const res = await api<{
          items: Array<Record<string, unknown>>;
          warning?: string;
        }>("/v1/compliance");
        setItems(res.items);
        setWarning(res.warning || null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }, []);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Compliance</h1>
      {warning ? <p style={{ color: "#fbbf24", fontSize: 12 }}>{warning}</p> : null}
      {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
      {pending ? <p style={{ color: "#94a3b8" }}>Loading…</p> : null}
      <NeoGlassCard>
        {items.map((it) => (
          <div
            key={String(it.id)}
            style={{
              padding: 10,
              background: "#0b1220",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              fontSize: 13,
            }}
          >
            <strong>{String(it.title)}</strong> · {String(it.kind)} ·{" "}
            {String(it.status)}
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              Due {String(it.due_at || "—")}
            </div>
          </div>
        ))}
        {!items.length && !pending ? (
          <p style={{ color: "#94a3b8" }}>No compliance items</p>
        ) : null}
      </NeoGlassCard>
    </div>
  );
}
