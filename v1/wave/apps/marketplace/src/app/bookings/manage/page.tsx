"use client";

import { useState, useTransition } from "react";

const API =
  process.env.NEXT_PUBLIC_HOTEL_OS_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:4100";

type LookupResult = {
  ok?: boolean;
  error?: string;
  booking?: {
    id: string;
    confirmationCode: string;
    status: string;
    checkIn: string;
    checkOut: string;
    contactName: string;
    quotedTotalBtn: number | null;
    propertyName?: string;
  };
};

export default function ManageBookingPage() {
  const [code, setCode] = useState("");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px", color: "#f8fafc" }}>
      <a href="/" style={{ color: "#94a3b8", fontSize: 14 }}>
        ← Stay Bhutan
      </a>
      <h1 style={{ fontSize: 32, margin: "16px 0 8px" }}>Manage booking</h1>
      <p style={{ opacity: 0.8, fontSize: 14, lineHeight: 1.5 }}>
        Look up a marketplace hold/confirmation with your code and the email or phone used at book.
      </p>
      <form
        style={{ display: "grid", gap: 12, marginTop: 24 }}
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            try {
              const q = new URLSearchParams({
                confirmation: code.trim(),
                contact: emailOrPhone.trim(),
              });
              const res = await fetch(`${API}/v1/marketplace/booking-lookup?${q}`);
              const json = (await res.json()) as LookupResult;
              if (!res.ok) {
                setResult({ error: json.error || `Lookup failed (${res.status})` });
                return;
              }
              setResult(json);
            } catch (err) {
              setResult({
                error: err instanceof Error ? err.message : String(err),
              });
            }
          });
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Confirmation code (PS-…)"
          required
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "#0f172a",
            color: "#f8fafc",
          }}
        />
        <input
          value={emailOrPhone}
          onChange={(e) => setEmailOrPhone(e.target.value)}
          placeholder="Email or phone on the booking"
          required
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "#0f172a",
            color: "#f8fafc",
          }}
        />
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "12px 16px",
            borderRadius: 999,
            border: "none",
            background: "#fbbf24",
            color: "#0f172a",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {pending ? "Looking up…" : "Find booking"}
        </button>
      </form>
      {result?.error ? (
        <p style={{ marginTop: 20, color: "#fca5a5", fontSize: 14 }}>{result.error}</p>
      ) : null}
      {result?.booking ? (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.15)",
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          <div>
            <strong>{result.booking.confirmationCode}</strong> · {result.booking.status}
          </div>
          <div>
            {result.booking.checkIn} → {result.booking.checkOut}
          </div>
          <div>{result.booking.contactName}</div>
          {result.booking.quotedTotalBtn != null ? (
            <div>Quoted Nu {result.booking.quotedTotalBtn}</div>
          ) : null}
          <p style={{ opacity: 0.7, marginTop: 8, fontSize: 12 }}>
            Changes/cancels follow hotel policy — contact the property or your agent. Platform admin
            sees commission on confirm under /admin/commissions.
          </p>
        </div>
      ) : null}
    </main>
  );
}
