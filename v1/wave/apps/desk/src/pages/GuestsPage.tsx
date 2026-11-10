import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard } from "@hotel-os/ui";
import { api } from "../api";

export function GuestsPage() {
  const [q, setQ] = useState("");
  const [guests, setGuests] = useState<Array<Record<string, unknown>>>([]);
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = (needle: string) => {
    start(async () => {
      try {
        setError(null);
        const res = await api<{
          guests: Array<Record<string, unknown>>;
          source: string;
        }>(`/v1/guests?q=${encodeURIComponent(needle)}`);
        setGuests(res.guests);
        setSource(res.source);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  useEffect(() => {
    load("");
  }, []);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Guests</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && load(q)}
        placeholder="Search name / phone / email"
        style={{
          width: "min(420px, 100%)",
          background: "#0b1220",
          color: "#f8fafc",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: "8px 10px",
          marginBottom: 12,
        }}
      />
      {source ? (
        <p style={{ fontSize: 11, color: "#94a3b8" }}>Source: {source}</p>
      ) : null}
      {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
      {pending ? <p style={{ color: "#94a3b8", fontSize: 12 }}>Loading…</p> : null}
      <NeoGlassCard>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "#94a3b8", textAlign: "left" }}>
              <th style={th}>Name</th>
              <th style={th}>Phone</th>
              <th style={th}>Email / stays</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((g, i) => (
              <tr key={String(g.id || g.name || i)}>
                <td style={td}>{String(g.full_name || g.name || "—")}</td>
                <td style={td}>{String(g.phone || "—")}</td>
                <td style={td}>
                  {String(g.email || "")}
                  {g.stays != null ? ` · ${g.stays} stays` : ""}
                  {g.lastStay ? ` · last ${String(g.lastStay)}` : ""}
                </td>
              </tr>
            ))}
            {!guests.length && !pending ? (
              <tr>
                <td colSpan={3} style={{ ...td, color: "#94a3b8" }}>
                  No guests found
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </NeoGlassCard>
    </div>
  );
}

const th: React.CSSProperties = { padding: 8, borderBottom: "1px solid rgba(255,255,255,0.08)" };
const td: React.CSSProperties = {
  padding: 8,
  borderBottom: "1px solid rgba(255,255,255,0.05)",
  background: "#0b1220",
};
