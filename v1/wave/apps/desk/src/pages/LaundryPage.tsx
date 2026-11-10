import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard } from "@hotel-os/ui";
import { api } from "../api";

export function LaundryPage() {
  const [tickets, setTickets] = useState<Array<Record<string, unknown>>>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    start(async () => {
      try {
        const res = await api<{
          tickets: Array<Record<string, unknown>>;
          warning?: string;
        }>("/v1/laundry");
        setTickets(res.tickets);
        setWarning(res.warning || null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }, []);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Laundry</h1>
      {warning ? <p style={{ color: "#fbbf24", fontSize: 12 }}>{warning}</p> : null}
      {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
      {pending ? <p style={{ color: "#94a3b8" }}>Loading…</p> : null}
      <NeoGlassCard>
        {tickets.map((t) => (
          <div
            key={String(t.id)}
            style={{
              padding: 10,
              background: "#0b1220",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              fontSize: 13,
            }}
          >
            <strong>{String(t.guest_name || "Guest")}</strong> · {String(t.status)} ·{" "}
            {String(t.piece_count || 0)} pcs · BTN {Number(t.total_btn || 0)}
          </div>
        ))}
        {!tickets.length && !pending ? (
          <p style={{ color: "#94a3b8" }}>No laundry tickets</p>
        ) : null}
      </NeoGlassCard>
    </div>
  );
}
