import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "react-router-dom";
import { NeoGlassCard, TactileButton } from "@hotel-os/ui";
import { api } from "../api";
import { StayHubDrawer } from "../components/StayHubDrawer";
import { FastBookModal } from "../components/FastBookModal";

type Reservation = {
  id: string;
  confirmationCode: string;
  guestName: string;
  phone: string | null;
  status: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms: number;
  mealPlan: string | null;
  quotedTotalBtn: number;
  agentName: string | null;
  roomLabel: string | null;
};

const VIEWS = [
  { id: "in_house", label: "In-house" },
  { id: "arrivals", label: "Arrivals" },
  { id: "departures", label: "Departures" },
  { id: "upcoming", label: "Upcoming" },
  { id: "all", label: "All" },
] as const;

export function ReservationsPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") || "in_house";
  const q = params.get("q") || "";
  const [rows, setRows] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fastOpen, setFastOpen] = useState(params.get("fast") === "1");
  const [pending, start] = useTransition();

  const load = () => {
    start(async () => {
      try {
        setError(null);
        const res = await api<{ reservations: Reservation[] }>(
          `/v1/reservations?view=${encodeURIComponent(view)}&q=${encodeURIComponent(q)}`,
        );
        setRows(res.reservations);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  useEffect(() => {
    load();
  }, [view, q]);

  useEffect(() => {
    if (params.get("fast") === "1") setFastOpen(true);
  }, [params]);

  const exportCsv = () => {
    const header = "code,guest,status,checkIn,checkOut,rooms,meal,total\n";
    const body = rows
      .map(
        (r) =>
          `${r.confirmationCode},${JSON.stringify(r.guestName)},${r.status},${r.checkIn},${r.checkOut},${r.rooms},${r.mealPlan},${r.quotedTotalBtn}`,
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reservations-${view}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20 }}>Reservations</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <TactileButton onClick={() => setFastOpen(true)}>Fast Book</TactileButton>
          <TactileButton variant="ghost" onClick={exportCsv}>
            Export CSV
          </TactileButton>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("view", v.id);
              setParams(next);
            }}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: view === v.id ? "rgba(245,158,11,0.25)" : "#0b1220",
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {v.label}
          </button>
        ))}
        <input
          defaultValue={q}
          placeholder="Search code / guest / phone"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const next = new URLSearchParams(params);
              next.set("q", (e.target as HTMLInputElement).value);
              setParams(next);
            }
          }}
          style={{
            marginLeft: "auto",
            background: "#0b1220",
            color: "#f8fafc",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "6px 10px",
            minWidth: 220,
          }}
        />
      </div>

      {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
      {pending ? <p style={{ color: "#94a3b8", fontSize: 12 }}>Refreshing…</p> : null}

      <NeoGlassCard>
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                <th style={th}>Code</th>
                <th style={th}>Guest</th>
                <th style={th}>Stay</th>
                <th style={th}>Room</th>
                <th style={th}>Status</th>
                <th style={th}>Agent</th>
                <th style={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  style={{
                    cursor: "pointer",
                    background:
                      selectedId === r.id ? "rgba(59,130,246,0.15)" : "transparent",
                  }}
                >
                  <td style={td}>{r.confirmationCode}</td>
                  <td style={td}>
                    <strong>{r.guestName}</strong>
                    {r.phone ? (
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{r.phone}</div>
                    ) : null}
                  </td>
                  <td style={td}>
                    {r.checkIn} → {r.checkOut}
                  </td>
                  <td style={td}>{r.roomLabel || "—"}</td>
                  <td style={td}>{r.status}</td>
                  <td style={td}>{r.agentName || "FIT"}</td>
                  <td style={td}>BTN {r.quotedTotalBtn.toLocaleString()}</td>
                </tr>
              ))}
              {!rows.length && !pending ? (
                <tr>
                  <td colSpan={7} style={{ ...td, color: "#94a3b8" }}>
                    No reservations in this view
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </NeoGlassCard>

      <StayHubDrawer
        bookingId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={load}
      />
      <FastBookModal
        open={fastOpen}
        onClose={() => {
          setFastOpen(false);
          const next = new URLSearchParams(params);
          next.delete("fast");
          setParams(next);
        }}
        onCreated={(id) => {
          setFastOpen(false);
          setSelectedId(id);
          load();
        }}
      />
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "8px 6px",
  borderBottom: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#64748b",
};
const td: React.CSSProperties = {
  padding: "10px 6px",
  borderBottom: "1px solid #f1f5f9",
  background: "#fff",
  color: "#0f172a",
};