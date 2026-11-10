import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NeoGlassCard, TactileButton } from "@hotel-os/ui";
import { useRamEngine } from "@hotel-os/engine";
import { api, setToken } from "../api";

type StaffRow = {
  id: string;
  fullName: string;
  employeeCode: string;
  deskRole: string | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export function PinGatewayPage() {
  const nav = useNavigate();
  const engine = useRamEngine();
  const [propertySlug, setPropertySlug] = useState(
    import.meta.env.VITE_PROPERTY_SLUG || "pelbu-olakha",
  );
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [property, setProperty] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selected, setSelected] = useState<StaffRow | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(null);
    void api<{
      property: { id: string; name: string };
      staff: StaffRow[];
    }>(`/v1/auth/staff?propertySlug=${encodeURIComponent(propertySlug)}`)
      .then((res) => {
        setProperty(res.property);
        setStaff(res.staff);
        setSelected((prev) =>
          prev && res.staff.some((s) => s.id === prev.id)
            ? prev
            : res.staff[0] || null,
        );
      })
      .catch((err) => setError(err.message));
  }, [propertySlug]);

  const submit = async () => {
    if (!selected || pin.length < 4) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{
        token: string;
        homeRoute: string;
        staff: { id: string; fullName: string };
        property: { id: string; name: string };
      }>("/v1/auth/pin", {
        method: "POST",
        body: JSON.stringify({
          propertySlug,
          staffId: selected.id,
          pin,
        }),
      });
      setToken(res.token);
      engine.setStaff(res.staff.id, res.staff.fullName);
      const snap = await api<Parameters<typeof engine.hydrateEngine>[0]>(
        `/v1/desk/snapshot?propertyId=${res.property.id}`,
      );
      await engine.hydrateEngine(snap);
      nav(res.homeRoute || "/desk");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "→"];

  return (
    <div className="pin-gateway">
      <NeoGlassCard className="pin-panel" style={{ padding: 0 }}>
        <div style={{ padding: 28, borderRight: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: "#d97706", fontWeight: 700 }}>
            HOTEL OS DESK
          </div>
          <h1 className="desk-page-title" style={{ marginTop: 8 }}>
            Staff PIN
          </h1>
          <p className="desk-page-sub">
            {property?.name || "Select property"} · touch your name, enter PIN
          </p>

          <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#64748b", marginBottom: 16 }}>
            Property slug
            <input
              value={propertySlug}
              onChange={(e) => setPropertySlug(e.target.value)}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                color: "#0f172a",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 14,
              }}
            />
          </label>

          <div className="pin-staff-list">
            {staff.map((s) => (
              <button
                key={s.id}
                type="button"
                className="pin-staff-card"
                data-selected={selected?.id === s.id}
                onClick={() => {
                  setSelected(s);
                  setPin("");
                  setError(null);
                }}
              >
                <span className="pin-avatar">{initials(s.fullName)}</span>
                <span style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.fullName}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {(s.deskRole || "staff").toUpperCase()} · {s.employeeCode}
                  </div>
                </span>
              </button>
            ))}
            {!staff.length && !error ? (
              <p style={{ color: "#64748b", fontSize: 13 }}>Loading staff…</p>
            ) : null}
          </div>
        </div>

        <div style={{ padding: 28, background: "rgba(248,250,252,0.9)" }}>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
            {selected ? `PIN for ${selected.fullName}` : "Select a staff member"}
          </div>
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 28,
              letterSpacing: 10,
              marginBottom: 16,
              color: "#0f172a",
              minHeight: 36,
            }}
          >
            {"•".repeat(pin.length).padEnd(4, "·")}
          </div>
          <div className="pin-pad">
            {digits.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  if (d === "C") setPin("");
                  else if (d === "→") void submit();
                  else if (pin.length < 8) setPin((p) => p + d);
                }}
              >
                {d}
              </button>
            ))}
          </div>
          <TactileButton
            style={{ marginTop: 16, width: "100%" }}
            disabled={loading || !selected || pin.length < 4}
            onClick={() => void submit()}
          >
            {loading ? "Verifying…" : "Enter workspace"}
          </TactileButton>
          {error ? (
            <p style={{ color: "#dc2626", fontSize: 12, marginTop: 12 }}>{error}</p>
          ) : null}
        </div>
      </NeoGlassCard>
    </div>
  );
}
