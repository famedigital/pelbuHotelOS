import Link from "next/link";

function defaultDates() {
  const inDate = new Date();
  inDate.setUTCDate(inDate.getUTCDate() + 1);
  const outDate = new Date(inDate);
  outDate.setUTCDate(outDate.getUTCDate() + 2);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { checkIn: fmt(inDate), checkOut: fmt(outDate) };
}

const DESTINATIONS = [
  { slug: "thimphu", label: "Thimphu" },
  { slug: "paro", label: "Paro" },
  { slug: "punakha", label: "Punakha" },
  { slug: "bumthang", label: "Bumthang" },
];

export default function HomePage() {
  const { checkIn, checkOut } = defaultDates();
  const exploreQs = `checkIn=${checkIn}&checkOut=${checkOut}`;

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at top, #1e293b 0%, #020617 50%, #0f172a 100%)",
        color: "#f8fafc",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "56px 24px 80px" }}>
        <p
          style={{
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            opacity: 0.7,
            fontSize: 12,
          }}
        >
          Stay Bhutan · Innora OTA
        </p>
        <h1
          style={{
            fontSize: "clamp(2.6rem, 7vw, 4.2rem)",
            margin: "12px 0 8px",
            fontWeight: 700,
            lineHeight: 1.05,
          }}
        >
          Book Bhutan hotels live
        </h1>
        <p style={{ fontSize: 18, maxWidth: 540, lineHeight: 1.55, opacity: 0.85 }}>
          Search licensed inventory, hold with server rates, pay deposit via RMA / mBoB. Innora
          earns commission only on bookings made through this platform — not desk walk-ins.
        </p>

        <form
          action="/explore"
          method="get"
          style={{
            marginTop: 28,
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            alignItems: "end",
            padding: 16,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(15,23,42,0.65)",
          }}
        >
          <label style={{ fontSize: 12, opacity: 0.8 }}>
            Check-in
            <input
              type="date"
              name="checkIn"
              defaultValue={checkIn}
              required
              style={{
                display: "block",
                width: "100%",
                marginTop: 6,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "#0f172a",
                color: "#f8fafc",
              }}
            />
          </label>
          <label style={{ fontSize: 12, opacity: 0.8 }}>
            Check-out
            <input
              type="date"
              name="checkOut"
              defaultValue={checkOut}
              required
              style={{
                display: "block",
                width: "100%",
                marginTop: 6,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "#0f172a",
                color: "#f8fafc",
              }}
            />
          </label>
          <button
            type="submit"
            style={{
              padding: "12px 18px",
              borderRadius: 999,
              border: "none",
              background: "#fbbf24",
              color: "#0f172a",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Search stays
          </button>
        </form>

        <div style={{ marginTop: 36 }}>
          <p style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.65 }}>
            Destinations
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
            {DESTINATIONS.map((d) => (
              <Link
                key={d.slug}
                href={`/destinations/${d.slug}?${exploreQs}`}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "#e2e8f0",
                  textDecoration: "none",
                  fontSize: 14,
                }}
              >
                {d.label}
              </Link>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            marginTop: 40,
            fontSize: 14,
          }}
        >
          <Link href={`/explore?${exploreQs}`} style={{ color: "#fbbf24" }}>
            Explore all →
          </Link>
          <Link href="/learn/sdf" style={{ color: "#94a3b8" }}>
            SDF & visa
          </Link>
          <Link href="/bookings/manage" style={{ color: "#94a3b8" }}>
            Manage booking
          </Link>
          <Link href="/agents" style={{ color: "#94a3b8" }}>
            Agents
          </Link>
          <Link href="/onboard" style={{ color: "#94a3b8" }}>
            Hotel onboard
          </Link>
        </div>
      </div>
    </main>
  );
}
