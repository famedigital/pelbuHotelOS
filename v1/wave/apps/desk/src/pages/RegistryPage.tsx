import { useEffect, useState } from "react";
import { NeoGlassCard, TactileButton } from "@hotel-os/ui";
import { api } from "../api";

export function RegistryPage() {
  const [tab, setTab] = useState<"agents" | "guides" | "fleet" | "staff">(
    "staff",
  );
  const [rows, setRows] = useState<unknown[]>([]);
  const [plate, setPlate] = useState("");

  const load = () => {
    const path =
      tab === "agents"
        ? "/v1/registry/agents"
        : tab === "guides"
          ? "/v1/registry/guides"
          : tab === "fleet"
            ? "/v1/registry/fleet"
            : "/v1/registry/staff";
    void api<Record<string, unknown[]>>(path).then((r) => {
      const key = Object.keys(r)[0];
      setRows((key ? r[key] : []) || []);
    });
  };

  useEffect(() => {
    load();
  }, [tab]);

  return (
    <div style={{ padding: 16 }}>
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>Master Registry</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["staff", "agents", "guides", "fleet"] as const).map((t) => (
            <TactileButton
              key={t}
              variant={tab === t ? "primary" : "ghost"}
              onClick={() => setTab(t)}
            >
              {t}
            </TactileButton>
          ))}
        </div>
        {tab === "fleet" ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="BP-1-Axxxx"
              style={{ background: "#0b1220", color: "white", padding: 8 }}
            />
            <TactileButton
              onClick={() => {
                void api("/v1/registry/fleet", {
                  method: "POST",
                  body: JSON.stringify({
                    plateNumber: plate,
                    vehicleType: "hiace",
                  }),
                }).then(() => {
                  setPlate("");
                  load();
                });
              }}
            >
              Add vehicle
            </TactileButton>
          </div>
        ) : null}
        <pre
          style={{
            fontSize: 11,
            maxHeight: 520,
            overflow: "auto",
            background: "#0b1220",
            padding: 12,
            borderRadius: 12,
          }}
        >
          {JSON.stringify(rows, null, 2)}
        </pre>
      </NeoGlassCard>
    </div>
  );
}
