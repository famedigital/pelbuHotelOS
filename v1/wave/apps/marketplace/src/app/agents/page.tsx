import Link from "next/link";

export default function AgentsPublicPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px", color: "#f8fafc" }}>
      <Link href="/" style={{ color: "#94a3b8", fontSize: 14 }}>
        ← Stay Bhutan
      </Link>
      <h1 style={{ fontSize: 36, margin: "16px 0 12px" }}>Tour operators & agents</h1>
      <p style={{ lineHeight: 1.6, opacity: 0.9 }}>
        Book Bhutan hotels with live MoU allotment, vouchers, and B2B credit. Agent portal bookings
        are commissionable to Innora unless a MoU waiver applies. Desk walk-ins are not.
      </p>
      <ul style={{ lineHeight: 1.7, opacity: 0.85 }}>
        <li>Live inventory & rates for MoU hotels</li>
        <li>All bookings ledger & commercial statements</li>
        <li>Hermes Telegram alerts (MoU-gated)</li>
        <li>Propose guides / drivers from national vault</li>
      </ul>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
        <a
          href="/agents/login"
          style={{
            padding: "12px 18px",
            borderRadius: 999,
            background: "#fbbf24",
            color: "#0f172a",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Agent login
        </a>
        <Link href="/explore" style={{ alignSelf: "center", color: "#94a3b8" }}>
          Guest explore →
        </Link>
      </div>
      <p style={{ marginTop: 24, fontSize: 13, opacity: 0.65 }}>
        Login is served by Innora web (<code>/agents/login</code>). This page is marketing + routing
        only — no fake voucher verify.
      </p>
    </main>
  );
}
