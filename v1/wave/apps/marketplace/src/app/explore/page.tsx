type ExploreResult = {
  propertyId: string;
  name: string;
  slug: string;
  city: string | null;
  availableRooms: number;
  nightlyFromBtn: number | null;
  stayFromBtn: number | null;
  nights: number;
  seasonKind: string;
  commissionRate: number;
  currency: string;
};

type ExploreResponse = {
  checkIn: string;
  checkOut: string;
  results: ExploreResult[];
  error?: string;
};

function defaultDates() {
  const inDate = new Date();
  inDate.setUTCDate(inDate.getUTCDate() + 1);
  const outDate = new Date(inDate);
  outDate.setUTCDate(outDate.getUTCDate() + 2);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { checkIn: fmt(inDate), checkOut: fmt(outDate) };
}

async function loadInventory(
  checkIn: string,
  checkOut: string,
): Promise<ExploreResponse> {
  const base =
    process.env.HOTEL_OS_API_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_HOTEL_OS_API_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:4100";
  const url = new URL(`${base}/v1/marketplace/explore`);
  url.searchParams.set("checkIn", checkIn);
  url.searchParams.set("checkOut", checkOut);
  url.searchParams.set("market", "local");

  const res = await fetch(url.toString(), { next: { revalidate: 30 } });
  const json = (await res.json()) as ExploreResponse;
  if (!res.ok) {
    return {
      checkIn,
      checkOut,
      results: [],
      error: json.error || `Explore failed (${res.status})`,
    };
  }
  return json;
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams?: Promise<{ checkIn?: string; checkOut?: string; q?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const defaults = defaultDates();
  const checkIn = sp.checkIn && /^\d{4}-\d{2}-\d{2}$/.test(sp.checkIn)
    ? sp.checkIn
    : defaults.checkIn;
  const checkOut = sp.checkOut && /^\d{4}-\d{2}-\d{2}$/.test(sp.checkOut)
    ? sp.checkOut
    : defaults.checkOut;
  const q = (sp.q ?? "").trim().toLowerCase();

  let data: ExploreResponse;
  try {
    data = await loadInventory(checkIn, checkOut);
    if (q && data.results.length) {
      data = {
        ...data,
        results: data.results.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.slug.toLowerCase().includes(q) ||
            (r.city ?? "").toLowerCase().includes(q),
        ),
      };
    }
  } catch (e) {
    data = {
      checkIn,
      checkOut,
      results: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return (
    <main style={{ padding: "32px 20px", maxWidth: 960, margin: "0 auto" }}>
      <h1>Explore · Priced inventory</h1>
      <p style={{ opacity: 0.75 }}>
        {checkIn} → {checkOut} · BAR from room_rates · commission 3% local / 5%
        international
      </p>
      <form
        method="get"
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 16,
          alignItems: "end",
        }}
      >
        <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
          Check-in
          <input type="date" name="checkIn" defaultValue={checkIn} />
        </label>
        <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
          Check-out
          <input type="date" name="checkOut" defaultValue={checkOut} />
        </label>
        <button type="submit" style={{ padding: "8px 14px" }}>
          Search
        </button>
      </form>
      {data.error ? (
        <p style={{ color: "#f87171", marginTop: 16 }} role="alert">
          {data.error}
        </p>
      ) : null}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
          marginTop: 24,
        }}
      >
        {data.results.map((r) => (
          <article
            key={r.propertyId}
            style={{
              background: "rgba(15,23,42,0.75)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: 16,
            }}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>{r.name}</h2>
            <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>
              {r.city || r.slug} · {r.seasonKind}
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>{r.availableRooms}</strong> available ·{" "}
              {r.nightlyFromBtn != null
                ? `from BTN ${r.nightlyFromBtn}/night`
                : "rate TBA"}
              {r.stayFromBtn != null
                ? ` · stay from BTN ${r.stayFromBtn}`
                : ""}
            </p>
            <p style={{ fontSize: 12, opacity: 0.7 }}>
              fee {(r.commissionRate * 100).toFixed(0)}% · {r.currency}
            </p>
            <a
              href={`/book/${r.slug}?checkIn=${checkIn}&checkOut=${checkOut}`}
              style={{ color: "#fbbf24", fontSize: 14 }}
            >
              Book studio →
            </a>
          </article>
        ))}
        {!data.results.length && !data.error ? (
          <p>No properties with inventory for these dates.</p>
        ) : null}
      </div>
    </main>
  );
}
