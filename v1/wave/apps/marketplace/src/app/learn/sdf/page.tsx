import Link from "next/link";

export default function LearnSdfPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px", color: "#f8fafc" }}>
      <Link href="/" style={{ color: "#94a3b8", fontSize: 14 }}>
        ← Stay Bhutan
      </Link>
      <h1 style={{ fontSize: 36, margin: "16px 0 12px" }}>SDF & visa (education)</h1>
      <p style={{ lineHeight: 1.6, opacity: 0.9 }}>
        The Sustainable Development Fee (SDF) is a daily levy for visitors to Bhutan. Innora helps
        you book licensed hotels and partners — we do <strong>not</strong> replace the Department of
        Immigration or Tourism Council portals for visa / SDF payment.
      </p>
      <ul style={{ lineHeight: 1.7, opacity: 0.85, paddingLeft: 18 }}>
        <li>USD-band tourists: check current SDF incentives on official Visit Bhutan FAQ.</li>
        <li>Indian nationals: preferential Nu. rate may apply — confirm on government sites.</li>
        <li>Children and day-border exemptions follow official rules.</li>
      </ul>
      <p style={{ marginTop: 24, fontSize: 14 }}>
        Official references:{" "}
        <a
          href="https://visit.doi.gov.bt/help/faq"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#fbbf24" }}
        >
          Visit Bhutan FAQ
        </a>
        {" · "}
        <a
          href="https://services.bhutan.travel/registration"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#fbbf24" }}
        >
          Bhutan Tourism Services Portal
        </a>
      </p>
      <Link href="/explore" style={{ display: "inline-block", marginTop: 28, color: "#94a3b8" }}>
        Back to explore →
      </Link>
    </main>
  );
}
