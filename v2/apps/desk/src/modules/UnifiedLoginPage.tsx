import { useId, useState, useTransition } from "react";
import { useNavigate } from "react-router-dom";
import {
  humanizeAuthError,
  preferLiveProperty,
  switchHotelProperty,
  unifiedLogin,
  type AuthProperty,
} from "../lib/pin-auth-api";
import { writeHotelGate, writePortalSession } from "../lib/auth-session";
import { AuthGateShell } from "./AuthGateShell";

/**
 * Single Hotel OS sign-in.
 * Server resolves hotel desk vs agent / guide / driver; hotel still picks property → PIN.
 */
export function UnifiedLoginPage() {
  const navigate = useNavigate();
  const formId = useId();
  const [email, setEmail] = useState("");
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

  function enterPortal(
    token: string,
    property: AuthProperty,
    role: "agent" | "guide" | "driver",
    account: {
      loginCode: string;
      displayName: string;
      subjectId: string;
      homeRoute: string;
    },
    list: AuthProperty[],
  ) {
    writePortalSession(
      token,
      { id: property.id, slug: property.slug, name: property.name },
      {
        role,
        loginCode: account.loginCode,
        displayName: account.displayName,
        subjectId: account.subjectId,
        homeRoute: account.homeRoute,
        properties: list.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
        })),
      },
    );
    navigate(account.homeRoute || "/partner", { replace: true });
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
        void switchHotelProperty({
          propertyId: chosen.id,
          propertySlug: chosen.slug,
        })
          .then((r) => {
            if (r.ok) {
              enterPin(r.token, r.property);
              return;
            }
            return unifiedLogin({
              email,
              password,
              propertyId: chosen.id,
            }).then((login) => {
              if (!login.ok) {
                setError(humanizeAuthError(login.error));
                return;
              }
              if (login.kind !== "hotel") {
                setError("This account is not a hotel desk login.");
                return;
              }
              enterPin(login.token, login.property);
            });
          })
          .catch(() =>
            unifiedLogin({
              email,
              password,
              propertyId: chosen.id,
            }).then((login) => {
              if (!login.ok) {
                setError(humanizeAuthError(login.error));
                return;
              }
              if (login.kind !== "hotel") {
                setError("This account is not a hotel desk login.");
                return;
              }
              enterPin(login.token, login.property);
            }),
          );
        return;
      }

      void unifiedLogin({ email, password }).then((r) => {
        if (!r.ok) {
          setError(humanizeAuthError(r.error));
          return;
        }
        if (r.kind === "portal") {
          enterPortal(r.token, r.property, r.role, r.account, r.properties);
          return;
        }
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
    ((!properties && email.trim().length > 0 && password.length >= 4) ||
      (Boolean(properties) && Boolean(propertyId)));

  return (
    <AuthGateShell
      kicker="Hotel OS"
      title={properties ? "Choose property" : "Sign in"}
      lead={
        properties
          ? "Pick the live hotel — then every staff member unlocks with their own PIN."
          : "One sign-in for hotels, tour agents, guides, and drivers. We route you to the right portal."
      }
      photoSrc="/auth/night.png"
      badge="Innora · Live"
      atmosphere={{
        title: "One network. Four portals.",
        lead: "Desk · Partner · Guide · Fleet — same credentials, role-aware destination. Mountain hospitality on one ledger.",
      }}
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
            <label className="auth-gate-label" htmlFor="hos-email">
              Email
            </label>
            <div className="auth-gate-field">
              <input
                id="hos-email"
                type="email"
                autoComplete="username"
                autoFocus
                inputMode="email"
                className="auth-gate-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hotel.bt or agency@…"
              />
            </div>
            <label className="auth-gate-label" htmlFor="hos-password">
              Password
            </label>
            <div className="auth-gate-field">
              <input
                id="hos-password"
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
            ? "Signing in…"
            : properties
              ? "Continue to staff PIN"
              : "Sign in"}
        </button>
      </form>
    </AuthGateShell>
  );
}
