import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard } from "@hotel-os/ui";
import { api } from "../api";

export function SettingsPage() {
  const [data, setData] = useState<{
    property: Record<string, unknown> | null;
    ai: {
      provider: string;
      model: string;
      isEnabled: boolean;
      hasApiKey: boolean;
    } | null;
    sequences: Array<Record<string, unknown>>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    start(async () => {
      try {
        setData(await api("/v1/settings/property"));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }, []);

  return (
    <div className="desk-grid">
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>Property</h2>
        {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
        {pending ? <p style={{ color: "#94a3b8" }}>Loading…</p> : null}
        {data?.property ? (
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            <div>
              <strong>{String(data.property.name)}</strong>
            </div>
            <div style={{ color: "#94a3b8" }}>
              /{String(data.property.slug)} · {String(data.property.timezone)} ·{" "}
              {String(data.property.currency)}
            </div>
            <div>{String(data.property.phone || "")}</div>
            <div>{String(data.property.email || "")}</div>
          </div>
        ) : null}
      </NeoGlassCard>
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>Copilot BYOK</h2>
        {data?.ai ? (
          <div style={{ fontSize: 13 }}>
            <p>
              {data.ai.provider} · {data.ai.model}
            </p>
            <p style={{ color: data.ai.hasApiKey ? "#34d399" : "#fbbf24" }}>
              {data.ai.isEnabled ? "Enabled" : "Disabled"} ·{" "}
              {data.ai.hasApiKey ? "API key present" : "No Gemini key — heuristics only"}
            </p>
            <p style={{ fontSize: 12, color: "#94a3b8" }}>
              Drafts only. Confirm still hits money RPCs.
            </p>
          </div>
        ) : (
          <p style={{ color: "#94a3b8" }}>No AI settings row</p>
        )}
        <h3>Sequences</h3>
        {(data?.sequences || []).map((s) => (
          <div key={String(s.kind)} style={{ fontSize: 12, background: "#0b1220", padding: 6 }}>
            {String(s.kind)} · {String(s.prefix || "")}
            {String(s.last_value ?? "")}
          </div>
        ))}
      </NeoGlassCard>
    </div>
  );
}
