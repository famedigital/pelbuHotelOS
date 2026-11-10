import { useEffect, useState } from "react";
import { NeoGlassCard, OdometerTicker } from "@hotel-os/ui";
import { api } from "../api";

export function OwnerPage() {
  const [pulse, setPulse] = useState<{
    inHouse: number;
    tillExpectedBtn: number;
    asOf: string;
  } | null>(null);

  useEffect(() => {
    void api<typeof pulse>("/v1/owner/pulse").then(setPulse);
    const t = setInterval(() => {
      void api<typeof pulse>("/v1/owner/pulse").then(setPulse);
    }, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>Pocket CEO · Owner Pulse</h2>
        {!pulse ? (
          <p>Loading…</p>
        ) : (
          <>
            <p style={{ color: "#94a3b8" }}>Business date {pulse.asOf}</p>
            <div style={{ fontSize: 14 }}>In-house: {pulse.inHouse}</div>
            <div style={{ marginTop: 8 }}>
              Anti-theft till radar{" "}
              <OdometerTicker
                value={pulse.tillExpectedBtn}
                prefix="Nu. "
                className="text-emerald-400 text-2xl font-mono"
              />
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 16 }}>
              23:30 WhatsApp night-audit bot uses existing CallMeBot / Resend
              workers on the droplet — configure OWNER_WHATSAPP_E164 on api.
            </p>
          </>
        )}
      </NeoGlassCard>
    </div>
  );
}
