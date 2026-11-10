import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard, TactileButton } from "@hotel-os/ui";
import { api } from "../api";

type Ticket = {
  id: string;
  status: string;
  station: string;
  created_at: string;
  orders?: {
    table_label?: string;
    order_lines?: Array<{ name: string; qty: number; notes?: string }>;
  };
};

export function KdsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () => {
    start(async () => {
      try {
        setError(null);
        const res = await api<{ tickets: Ticket[] }>("/v1/kds/tickets");
        setTickets(res.tickets);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const bump = (kotId: string, status: "preparing" | "ready" | "served") => {
    start(async () => {
      await api("/v1/kds/status", {
        method: "POST",
        body: JSON.stringify({
          kotId,
          status,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      load();
    });
  };

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Kitchen display</h1>
      {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
      {pending ? <p style={{ color: "#94a3b8", fontSize: 12 }}>Syncing…</p> : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
          gap: 12,
        }}
      >
        {tickets.map((t) => (
          <NeoGlassCard key={t.id}>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              {t.station} · {t.status} · {t.orders?.table_label || "—"}
            </div>
            <div style={{ marginTop: 8 }}>
              {(t.orders?.order_lines || []).map((l, i) => (
                <div key={i} style={{ fontSize: 14, background: "#0b1220", padding: 4 }}>
                  <strong>
                    {l.qty}× {l.name}
                  </strong>
                  {l.notes ? (
                    <div style={{ fontSize: 11, color: "#fbbf24" }}>{l.notes}</div>
                  ) : null}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <TactileButton onClick={() => bump(t.id, "preparing")}>Prep</TactileButton>
              <TactileButton onClick={() => bump(t.id, "ready")}>Ready</TactileButton>
              <TactileButton variant="ghost" onClick={() => bump(t.id, "served")}>
                Served
              </TactileButton>
            </div>
          </NeoGlassCard>
        ))}
      </div>
      {!tickets.length && !pending ? (
        <p style={{ color: "#94a3b8" }}>No open KOTs</p>
      ) : null}
    </div>
  );
}
