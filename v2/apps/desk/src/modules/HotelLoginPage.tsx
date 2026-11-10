import { useId, useState, useTransition } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  humanizeAuthError,
  loginHotelEmail,
  preferLiveProperty,
  switchHotelProperty,
  type AuthProperty,
} from "../lib/pin-auth-api";
import { writeHotelGate } from "../lib/auth-session";
import { AuthGateShell } from "./AuthGateShell";

/** Hotel org email/password → property pick → staff PIN pad. */
export function HotelLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const formId = useId();
  const prefill =
    typeof (location.state as { email?: unknown } | null)?.email === "string"
      ? String((location.state as { email: string }).email)
      : "";
  const [email, setEmail] = useState(prefill);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  function submit() {
    setError(null);
    startTransition(() => {
      if (properties && pendingToken) {
        const chosen = properties.find((p) => p.id === propertyId);
        if (!chosen) {
          setError("Select a property");
          return;
        }
        // Prefer switch-property (no second GoTrue hit); fall back to re-login.
        void switchHotelProperty({
          propertyId: chosen.id,
          propertySlug: chosen.slug,
        })
          .then((r) => {
            if (r.ok) {
              enterPin(r.token, r.property);
              return;
            }
            return loginHotelEmail({
              email,
              password,
              propertyId: chosen.id,
            }).then((login) => {
              if (!login.ok) {
                setError(humanizeAuthError(login.error));
                return;
              }
              enterPin(login.token, login.property);
            });
          })
          .catch(() =>
            loginHotelEmail({
              email,
              password,
              propertyId: chosen.id,
            }).then((login) => {
              if (!login.ok) {
                setError(humanizeAuthError(login.error));
                return;
              }
              enterPin(login.token, login.property);
            }),
          );
        return;
      }

      void loginHotelEmail({ email, password }).then((r) => {
        if (!r.ok) {
          setError(humanizeAuthError(r.error));
          return;
        }
        // Always stop for hotel selection — default to live Pelbu, never Demo.
        const list = r.properties.length > 0 ? r.properties : [r.property];
        const preferred = preferLiveProperty(list, r.property);
        setProperties(list);
        setPropertyId(preferred.id);
        setPendingToken(r.token);
        writeHotelGate(r.token, {
          id: preferred.id,
          slug: preferred.slug,
          name: preferred.name,
        });
      });
    });
  }

  const canSubmit =
    !pending &&
    ((!properties && email.trim().length > 0 && password.length >= 6) ||
      (Boolean(properties) && Boolean(propertyId)));

  return (
    <AuthGateShell
      kicker="Hotel desk"
      title={properties ? "Choose property" : "Sign in to the desk"}
      lead={
        properties
          ? "Pick the live hotel — then every staff member unlocks with their own PIN."
          : "Owner email unlocks the property. Front office, night FO, and managers each use their own PIN."
      }
      photoSrc="/auth/night.png"
      badge="Sovereign desk · Live"
      atmosphere={{
        title: "Night operations, zero friction",
        lead: "Sub-20s check-ins. Dual folio. Bhutan-ready fiscal spine — built for the mountain desk.",
      }}
      footer={
        <div className="auth-gate-links">
          <Link to="/login/agent">Agent portal</Link>
          <Link to="/login/guide">Guide</Link>
          <Link to="/login/driver">Driver</Link>
        </div>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) submit();
        }}
      >
        {!properties ? (
          <>
            <label className="auth-gate-label" htmlFor="hotel-email">
              Hotel email
            </label>
            <div className="auth-gate-field">
              <input
                id="hotel-email"
                type="email"
                autoComplete="username"
                autoFocus
                inputMode="email"
                className="auth-gate-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@yourhotel.bt"
              />
            </div>
            <label className="auth-gate-label" htmlFor="hotel-password">
              Password
            </label>
            <div className="auth-gate-field">
              <input
                id="hotel-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="auth-gate-input has-toggle"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="auth-gate-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="auth-gate-label">Property</p>
            <div className="auth-gate-properties" role="listbox" aria-label="Hotels">
              {properties.map((p) => {
                const active = p.id === propertyId;
                const mark = (p.name.trim()[0] || "H").toUpperCase();
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className="auth-gate-property"
                    data-active={active ? "true" : "false"}
                    onClick={() => setPropertyId(p.id)}
                  >
                    <span className="auth-gate-property-mark" aria-hidden="true">
                      {mark}
                    </span>
                    <span className="auth-gate-property-copy">
                      <p className="auth-gate-property-name">{p.name}</p>
                      <p className="auth-gate-property-slug">{p.slug}</p>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {error ? (
          <p className="auth-gate-error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="auth-gate-btn"
          data-pending={pending ? "true" : "false"}
          disabled={!canSubmit}
        >
          {pending
            ? "Unlocking…"
            : properties
              ? "Continue to staff PIN"
              : "Enter sovereign desk"}
        </button>
      </form>
    </AuthGateShell>
  );
}
