import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard, TactileButton } from "@hotel-os/ui";
import { api } from "../api";

export function HousekeepingPage() {
  const [board, setBoard] = useState<{
    rooms: Array<Record<string, unknown>>;
    lostAndFound: Array<Record<string, unknown>>;
    maintenance: Array<Record<string, unknown>>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () => {
    start(async () => {
      try {
        setBoard(await api("/v1/hk/board"));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = (roomUnitId: string, status: string) => {
    start(async () => {
      await api("/v1/hk/status", {
        method: "POST",
        body: JSON.stringify({
          roomUnitId,
          status,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      load();
    });
  };

  return (
    <div className="desk-grid">
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>HK board</h2>
        {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
        {pending ? <p style={{ color: "#94a3b8", fontSize: 12 }}>Updating…</p> : null}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))",
            gap: 8,
          }}
        >
          {(board?.rooms || []).map((r) => (
            <div
              key={String(r.id)}
              style={{
                padding: 10,
                borderRadius: 10,
                background: "#0b1220",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <strong>{String(r.label)}</strong>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
                {String(r.housekeeping_status)}
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {["clean", "dirty", "inspect", "ooo"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(String(r.id), s)}
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background:
                        s === "clean"
                          ? "rgba(16,185,129,0.2)"
                          : s === "dirty"
                            ? "rgba(239,68,68,0.2)"
                            : "#111827",
                      color: "#e2e8f0",
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </NeoGlassCard>
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>Lost & found / maintenance</h2>
        <h3>Lost & found</h3>
        {(board?.lostAndFound || []).map((x) => (
          <div key={String(x.id)} style={{ fontSize: 12, background: "#0b1220", padding: 6 }}>
            {String(x.item)} · {String(x.status)}
          </div>
        ))}
        <h3>Maintenance</h3>
        {(board?.maintenance || []).map((x) => (
          <div key={String(x.id)} style={{ fontSize: 12, background: "#0b1220", padding: 6 }}>
            {String(x.title)} · {String(x.status)} · {String(x.priority)}
          </div>
        ))}
        <TactileButton style={{ marginTop: 12 }} onClick={load}>
          Refresh
        </TactileButton>
      </NeoGlassCard>
    </div>
  );
}
