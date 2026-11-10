import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard } from "@hotel-os/ui";
import { api } from "../api";

export function ChannelPage() {
  const [data, setData] = useState<{
    connections: Array<Record<string, unknown>>;
    ariQueue?: Array<Record<string, unknown>>;
    warning?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    start(async () => {
      try {
        setData(await api("/v1/channel/status"));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }, []);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Channel / OTA</h1>
      {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
      {data?.warning ? (
        <p style={{ color: "#fbbf24", fontSize: 12 }}>{data.warning}</p>
      ) : null}
      {pending ? <p style={{ color: "#94a3b8" }}>Loading…</p> : null}
      <div className="desk-grid">
        <NeoGlassCard>
          <h2 style={{ marginTop: 0 }}>Connections</h2>
          {(data?.connections || []).map((c) => (
            <div
              key={String(c.id)}
              style={{
                padding: 8,
                background: "#0b1220",
                marginBottom: 6,
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <strong>{String(c.channel)}</strong> · {String(c.status)}
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                Last sync {String(c.last_sync_at || "—")}
              </div>
            </div>
          ))}
          {!data?.connections?.length ? (
            <p style={{ color: "#94a3b8" }}>No channel connections</p>
          ) : null}
        </NeoGlassCard>
        <NeoGlassCard>
          <h2 style={{ marginTop: 0 }}>ARI queue</h2>
          {(data?.ariQueue || []).map((q) => (
            <div
              key={String(q.id)}
              style={{
                padding: 8,
                background: "#0b1220",
                marginBottom: 6,
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              {String(q.kind)} · {String(q.status)} · {String(q.created_at)}
              {q.error ? (
                <div style={{ color: "#f87171" }}>{String(q.error)}</div>
              ) : null}
            </div>
          ))}
          {!data?.ariQueue?.length ? (
            <p style={{ color: "#94a3b8" }}>Queue empty</p>
          ) : null}
        </NeoGlassCard>
      </div>
    </div>
  );
}
