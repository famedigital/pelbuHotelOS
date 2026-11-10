import { useEffect, useState, useTransition } from "react";
import { Link } from "react-router-dom";
import { NeoGlassCard, TactileButton } from "@hotel-os/ui";
import { api } from "../api";
import { StayHubDrawer } from "../components/StayHubDrawer";
import { FastBookModal } from "../components/FastBookModal";

type DayBoard = {
  businessDate: string;
  arrivals: Array<Record<string, unknown>>;
  departures: Array<Record<string, unknown>>;
  inHouse: Array<Record<string, unknown>>;
  housekeeping: Record<string, number>;
  roomCount: number;
};

export function DeskPage() {
  const [board, setBoard] = useState<DayBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fastOpen, setFastOpen] = useState(false);
  const [pending, start] = useTransition();

  const load = () => {
    start(async () => {
      try {
        setError(null);
        setBoard(await api("/v1/desk/day"));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <h1 className="desk-page-title">Day board</h1>
          <p className="desk-page-sub" style={{ marginBottom: 0 }}>
            {board?.businessDate || "—"} · {board?.roomCount ?? 0} rooms
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <TactileButton onClick={() => setFastOpen(true)}>Fast Book</TactileButton>
          <Link to="/reservations" style={{ color: "#818cf8", fontSize: 13, alignSelf: "center" }}>
            Reservations hub →
          </Link>
          <Link to="/stayview" style={{ color: "#818cf8", fontSize: 13, alignSelf: "center" }}>
            StayView →
          </Link>
        </div>
      </div>
      {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
      {pending ? <p style={{ color: "#94a3b8", fontSize: 12 }}>Refreshing…</p> : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
          gap: 8,
          marginBottom: 12,
        }}
      >
        {Object.entries(board?.housekeeping || {}).map(([k, v]) => (
          <NeoGlassCard key={k}>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>
              {k}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>{v}</div>
          </NeoGlassCard>
        ))}
      </div>

      <div className="desk-grid">
        <Column
          title={`Arrivals (${board?.arrivals.length ?? 0})`}
          rows={board?.arrivals || []}
          onSelect={setSelectedId}
        />
        <Column
          title={`In-house (${board?.inHouse.length ?? 0})`}
          rows={board?.inHouse || []}
          onSelect={setSelectedId}
        />
        <Column
          title={`Departures (${board?.departures.length ?? 0})`}
          rows={board?.departures || []}
          onSelect={setSelectedId}
        />
      </div>

      <StayHubDrawer
        bookingId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={load}
      />
      <FastBookModal
        open={fastOpen}
        onClose={() => setFastOpen(false)}
        onCreated={(id) => {
          setFastOpen(false);
          setSelectedId(id);
          load();
        }}
      />
    </div>
  );
}

function Column({
  title,
  rows,
  onSelect,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  onSelect: (id: string) => void;
}) {
  return (
    <NeoGlassCard>
      <h2 style={{ marginTop: 0, fontSize: 15 }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r) => (
          <button
            key={String(r.id)}
            type="button"
            onClick={() => onSelect(String(r.id))}
            style={{
              textAlign: "left",
              padding: 10,
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              background: "#fff",
              color: "#0f172a",
              cursor: "pointer",
            }}
          >
            <strong>{String(r.contact_name)}</strong>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              {String(r.confirmation_code)} · {String(r.status)}
            </div>
          </button>
        ))}
        {!rows.length ? (
          <p style={{ color: "#64748b", fontSize: 12 }}>Empty</p>
        ) : null}
      </div>
    </NeoGlassCard>
  );
}
