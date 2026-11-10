import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard, TactileButton } from "@hotel-os/ui";
import { api } from "../api";

export function GroupsPage() {
  const [parties, setParties] = useState<Array<Record<string, unknown>>>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () => {
    start(async () => {
      try {
        setError(null);
        const res = await api<{
          parties: Array<Record<string, unknown>>;
          warning?: string;
        }>("/v1/groups");
        setParties(res.parties);
        setWarning(res.warning || null);
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
      <h1 style={{ marginTop: 0 }}>Groups / parties</h1>
      {warning ? <p style={{ color: "#fbbf24", fontSize: 12 }}>{warning}</p> : null}
      {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
      <NeoGlassCard>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Party name"
            style={{
              flex: 1,
              background: "#0b1220",
              color: "#f8fafc",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          />
          <TactileButton
            disabled={pending || !name.trim()}
            onClick={() =>
              start(async () => {
                await api("/v1/groups", {
                  method: "POST",
                  body: JSON.stringify({
                    name: name.trim(),
                    idempotencyKey: crypto.randomUUID(),
                  }),
                });
                setName("");
                load();
              })
            }
          >
            Create party
          </TactileButton>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {parties.map((p) => (
            <div
              key={String(p.id)}
              style={{
                padding: 10,
                borderRadius: 10,
                background: "#0b1220",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <strong>{String(p.name)}</strong>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {String(p.created_at || "")}
              </div>
            </div>
          ))}
          {!parties.length && !pending ? (
            <p style={{ color: "#94a3b8" }}>No parties yet</p>
          ) : null}
        </div>
      </NeoGlassCard>
    </div>
  );
}
