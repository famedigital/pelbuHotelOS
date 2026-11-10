"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams, useSearchParams } from "next/navigation";

const API =
  process.env.NEXT_PUBLIC_HOTEL_OS_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:4100";

type PropertyPayload = {
  property: {
    id: string;
    name: string;
    slug: string;
    city: string | null;
  };
  roomTypes: Array<{ id: string; name: string; code: string }>;
  sellableUnits: number;
  quote: {
    nightlyFromBtn: number | null;
    stayFromBtn: number | null;
    nights: number;
    seasonKind: string;
    availableRooms: number;
    roomTypeQuotes: Array<{
      roomTypeId: string;
      name: string;
      nightlyBtn: number | null;
      stayTotalBtn: number | null;
    }>;
  } | null;
};

export default function BookStudioPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const slug = params.id;
  const [data, setData] = useState<PropertyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [checkIn, setCheckIn] = useState(search.get("checkIn") || "");
  const [checkOut, setCheckOut] = useState(search.get("checkOut") || "");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!slug) return;
    const q = new URLSearchParams();
    if (checkIn) q.set("checkIn", checkIn);
    if (checkOut) q.set("checkOut", checkOut);
    const qs = q.toString();
    void fetch(
      `${API}/v1/marketplace/property/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`,
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((payload: PropertyPayload) => {
        setData(payload);
        if (!roomTypeId && payload.quote?.roomTypeQuotes?.[0]?.roomTypeId) {
          setRoomTypeId(payload.quote.roomTypeQuotes[0].roomTypeId);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [slug, checkIn, checkOut]);

  const selectedQuote = data?.quote?.roomTypeQuotes?.find(
    (r) => r.roomTypeId === roomTypeId,
  );
  const serverNightly =
    selectedQuote?.nightlyBtn ?? data?.quote?.nightlyFromBtn ?? null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at top, #1e293b 0%, #020617 55%, #0f172a 100%)",
        color: "#f8fafc",
        padding: "48px 20px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <p style={{ letterSpacing: "0.12em", fontSize: 12, opacity: 0.7 }}>
          MARKETPLACE BOOK STUDIO
        </p>
        <h1 style={{ fontSize: 40, margin: "8px 0 12px", fontWeight: 700 }}>
          {data?.property.name || slug}
        </h1>
        <p style={{ opacity: 0.75, marginBottom: 24 }}>
          {data?.property.city || "Bhutan"} ·{" "}
          {data?.quote
            ? `${data.quote.availableRooms} available · ${data.quote.seasonKind}`
            : `${data?.sellableUnits ?? "—"} sellable units`}{" "}
          · RMA QR settle after confirm
        </p>
        {data?.quote?.nightlyFromBtn != null ? (
          <p style={{ color: "#fbbf24", fontSize: 14 }}>
            Server BAR from BTN {data.quote.nightlyFromBtn}/night
            {data.quote.stayFromBtn != null
              ? ` · stay from BTN ${data.quote.stayFromBtn}`
              : ""}
          </p>
        ) : null}
        {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!data?.property.id) return;
            start(async () => {
              try {
                setError(null);
                const res = await fetch(`${API}/v1/marketplace/book`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    propertyId: data.property.id,
                    contactName: name,
                    contactPhone: phone || undefined,
                    checkIn,
                    checkOut,
                    roomTypeId: roomTypeId || undefined,
                    idempotencyKey: crypto.randomUUID(),
                    market: "international",
                  }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || res.statusText);
                setResult(json);
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              }
            });
          }}
          style={{
            display: "grid",
            gap: 12,
            background: "rgba(15,23,42,0.7)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 20,
          }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Guest name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
            />
          </label>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Check-in
              <input
                type="date"
                required
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Check-out
              <input
                type="date"
                required
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                style={inputStyle}
              />
            </label>
          </div>
          {(data?.quote?.roomTypeQuotes?.length ||
            data?.roomTypes?.length) ? (
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Room type
              <select
                value={roomTypeId}
                onChange={(e) => setRoomTypeId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Any / lowest BAR</option>
                {(data?.quote?.roomTypeQuotes || []).map((rt) => (
                  <option key={rt.roomTypeId} value={rt.roomTypeId}>
                    {rt.name}
                    {rt.nightlyBtn != null ? ` · BTN ${rt.nightlyBtn}` : ""}
                  </option>
                ))}
                {!data?.quote?.roomTypeQuotes?.length
                  ? data?.roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.name} ({rt.code})
                      </option>
                    ))
                  : null}
              </select>
            </label>
          ) : null}
          <p style={{ fontSize: 13, margin: 0 }}>
            {serverNightly != null
              ? `BTN ${serverNightly}/night (server quote). Your booking is held until the hotel confirms your deposit.`
              : "Pick dates to see the nightly price."}
          </p>
          <button
            type="submit"
            disabled={pending}
            style={{
              marginTop: 8,
              padding: "12px 16px",
              borderRadius: 12,
              border: "none",
              background: "#F59E0B",
              color: "#111827",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {pending ? "Booking…" : "Confirm booking"}
          </button>
        </form>
        {result ? (
          <div
            style={{
              marginTop: 16,
              background: "#0b1220",
              padding: 16,
              borderRadius: 12,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: 0 }}>
              Held <strong>{String(result.confirmationCode ?? "")}</strong>
              {result.quotedTotalBtn != null
                ? ` · Nu ${String(result.quotedTotalBtn)}`
                : ""}
            </p>
            {typeof result.paymentPath === "string" && result.paymentPath ? (
              <p style={{ margin: "8px 0 0" }}>
                <a href={result.paymentPath} style={{ color: "#fbbf24" }}>
                  Pay deposit →
                </a>
              </p>
            ) : (
              <p style={{ margin: "8px 0 0", opacity: 0.75 }}>
                {String(result.payHint ?? "Awaiting deposit link")}
              </p>
            )}
            <button
              type="button"
              disabled={pending}
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: "#f8fafc",
                cursor: "pointer",
              }}
              onClick={() => {
                if (!data?.property.id || typeof result.bookingId !== "string") return;
                start(async () => {
                  try {
                    setError(null);
                    const res = await fetch(`${API}/v1/marketplace/confirm`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        propertyId: data.property.id,
                        bookingId: result.bookingId,
                        idempotencyKey: crypto.randomUUID(),
                        market: "international",
                      }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || res.statusText);
                    setResult({ ...result, ...json, confirmed: true });
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  }
                });
              }}
            >
              Confirm + accrue commission
            </button>
            {"commissionBtn" in result && result.commissionBtn != null ? (
              <p style={{ marginTop: 8, color: "#86efac" }}>
                Commission Nu {String(result.commissionBtn)} accrued
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#0b1220",
  color: "#f8fafc",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  padding: "10px 12px",
};
