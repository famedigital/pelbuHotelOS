import { useState, useTransition } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginHotelEmail, type AuthProperty } from "../lib/pin-auth-api";
import { writeHotelGate } from "../lib/auth-session";
import { AuthGateShell } from "./AuthGateShell";

/** Hotel org email/password → staff PIN pad for unlocked property. */
export function HotelLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [properties, setProperties] = useState<AuthProperty[] | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function enterPin(token: string, property: AuthProperty) {
    writeHotelGate(token, {
      id: property.id,
      slug: property.slug,
      name: property.name,
    });
    navigate("/pin", { replace: true });
  }

  return (
    <AuthGateShell
      kicker="Hotel desk"
      title={properties ? "Choose property" : "Hotel sign in"}
      lead={
        properties
          ? "Open the PIN pad for the property you run tonight."
          : "Hotel email unlocks the property. Each staff member then enters their own PIN."
      }
      photoSrc="/auth/night.png"
      footer={
        <div className="auth-gate-links">
          <Link to="/login/agent">Agent</Link>
          <Link to="/login/guide">Guide</Link>
          <Link to="/login/driver">Driver</Link>
        </div>
      }
    >
      {!properties ? (
        <>
          <label className="auth-gate-label" htmlFor="hotel-email">
            Email
          </label>
          <input
            id="hotel-email"
            type="email"
            autoComplete="username"
            className="auth-gate-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
          <label className="auth-gate-label" htmlFor="hotel-password">
            Password
          </label>
          <input
            id="hotel-password"
            type="password"
            autoComplete="current-password"
            className="auth-gate-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </>
      ) : (
        <>
          <label className="auth-gate-label" htmlFor="hotel-property">
            Property
          </label>
          <select
            id="hotel-property"
            className="auth-gate-select"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </>
      )}

      {error ? <p className="auth-gate-error">{error}</p> : null}

      <button
        type="button"
        className="auth-gate-btn"
        disabled={
          pending ||
          (!properties && (!email.trim() || password.length < 6)) ||
          (Boolean(properties) && !propertyId)
        }
        onClick={() => {
          setError(null);
          startTransition(() => {
            if (properties && pendingToken) {
              const chosen = properties.find((p) => p.id === propertyId);
              if (!chosen) {
                setError("Select a property");
                return;
              }
              void loginHotelEmail({
                email,
                password,
                propertyId: chosen.id,
              }).then((r) => {
                if (!r.ok) {
                  setError(r.error);
                  return;
                }
                enterPin(r.token, r.property);
              });
              return;
            }

            void loginHotelEmail({ email, password }).then((r) => {
              if (!r.ok) {
                setError(r.error);
                return;
              }
              if (r.properties.length > 1) {
                setProperties(r.properties);
                setPropertyId(r.property.id);
                setPendingToken(r.token);
                return;
              }
              enterPin(r.token, r.property);
            });
          });
        }}
      >
        {pending
          ? "Signing in…"
          : properties
            ? "Continue to staff PIN"
            : "Sign in"}
      </button>
    </AuthGateShell>
  );
}
