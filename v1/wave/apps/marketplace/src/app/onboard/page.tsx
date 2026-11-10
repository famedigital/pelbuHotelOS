"use client";

import { useState, useTransition } from "react";

const API =
  process.env.NEXT_PUBLIC_HOTEL_OS_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:4100";

export default function OnboardPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(160deg, #0f172a 0%, #1e293b 40%, #020617 100%)",
        color: "#f8fafc",
        padding: "48px 20px",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1 style={{ fontSize: 36, marginBottom: 8 }}>Onboard a hotel</h1>
        <p style={{ opacity: 0.75, marginBottom: 24 }}>
          60-second property create — boutique license seeded active at Nu 3,500
          MRR.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              try {
                setError(null);
                const res = await fetch(`${API}/v1/onboard/property`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name,
                    slug,
                    city: city || undefined,
                    ownerEmail: email || undefined,
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
          style={{ display: "grid", gap: 12 }}
        >
          <input
            required
            placeholder="Hotel name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) {
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                );
              }
            }}
            style={inputStyle}
          />
          <input
            required
            placeholder="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={inputStyle}
          />
          <input
            type="email"
            placeholder="Owner email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            style={{
              padding: 14,
              borderRadius: 12,
              border: "none",
              background: "#10B981",
              color: "#042f2e",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {pending ? "Creating…" : "Create property"}
          </button>
        </form>
        {result ? (
          <pre
            style={{
              marginTop: 16,
              background: "#0b1220",
              padding: 16,
              borderRadius: 12,
              fontSize: 12,
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
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
