import { useState, useTransition } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { humanizeAuthError, portalEmailLogin, type AuthProperty } from "../lib/pin-auth-api";
import { writePortalSession } from "../lib/auth-session";
import { AuthGateShell } from "./AuthGateShell";

const ROLES = ["agent", "guide", "driver"] as const;
type PortalRole = (typeof ROLES)[number];

function isRole(v: string | undefined): v is PortalRole {
  return ROLES.includes(v as PortalRole);
}

const ROLE_META: Record<
  PortalRole,
  { kicker: string; title: string; lead: string; photo: string; placeholder: string }
> = {
  agent: {
    kicker: "Tour operator",
    title: "Partner sign in",
    lead: "One email across every hotel you are contracted with. No staff PIN.",
    photo: "/auth/lobby.png",
    placeholder: "Email",
  },
  guide: {
    kicker: "Guide",
    title: "Guide sign in",
    lead: "Licensed guide email for groups and field ops at linked hotels.",
    photo: "/auth/night.png",
    placeholder: "Email",
  },
  driver: {
    kicker: "Driver",
    title: "Driver sign in",
    lead: "Driver email for bay, dorm, and advances — separate from the desk.",
    photo: "/auth/night.png",
    placeholder: "Email",
  },
};

/** Email + password portal login — multi-hotel after auth. */
export function PortalLoginPage() {
  const { role: roleParam } = useParams();
  const role: PortalRole = isRole(roleParam) ? roleParam : "agent";
  const meta = ROLE_META[role];
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [properties, setProperties] = useState<AuthProperty[] | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [accountMeta, setAccountMeta] = useState<{
    loginCode: string;
    displayName: string;
    subjectId: string;
    homeRoute: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function enter(
    token: string,
    property: AuthProperty,
    account: { loginCode: string; displayName: string; subjectId: string; homeRoute: string },
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
      },
    );
    navigate(account.homeRoute || "/partner", { replace: true });
  }

  return (
    <AuthGateShell
      kicker={meta.kicker}
      title={properties ? "Choose hotel" : meta.title}
      lead={
        properties
          ? "This account is linked to more than one hotel."
          : role === "agent"
            ? "Tour-operator email only. Hotel owners: use Hotel desk — not this Partner screen."
            : meta.lead
      }
      photoSrc={meta.photo}
      footer={
        <div className="auth-gate-links">
          <Link to="/login/hotel">Hotel desk</Link>
          {ROLES.filter((r) => r !== role).map((r) => (
            <Link key={r} to={`/login/${r}`}>
              {r}
            </Link>
          ))}
        </div>
      }
    >
      {!properties ? (
        <>
          <label className="auth-gate-label" htmlFor={`${role}-email`}>
            Email
          </label>
          <input
            id={`${role}-email`}
            type="email"
            autoComplete="username"
            className="auth-gate-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={meta.placeholder}
          />
          <label className="auth-gate-label" htmlFor={`${role}-password`}>
            Password
          </label>
          <input
            id={`${role}-password`}
            type="password"
            autoComplete="current-password"
            className="auth-gate-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </>
      ) : (
        <>
          <label className="auth-gate-label" htmlFor={`${role}-property`}>
            Hotel
          </label>
          <select
            id={`${role}-property`}
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
          (!properties && (!email.trim() || password.length < 4)) ||
          (Boolean(properties) && !propertyId)
        }
        onClick={() => {
          setError(null);
          startTransition(() => {
            if (properties && pendingToken && accountMeta) {
              void portalEmailLogin({
                role,
                email,
                password,
                propertyId,
              }).then((r) => {
                if (!r.ok) {
                  setError(humanizeAuthError(r.error));
                  return;
                }
                enter(r.token, r.property, {
                  loginCode: r.account.loginCode,
                  displayName: r.account.displayName,
                  subjectId: r.account.subjectId,
                  homeRoute: r.homeRoute,
                });
              });
              return;
            }

            void portalEmailLogin({ role, email, password }).then((r) => {
              if (!r.ok) {
                setError(humanizeAuthError(r.error));
                return;
              }
              const account = {
                loginCode: r.account.loginCode,
                displayName: r.account.displayName,
                subjectId: r.account.subjectId,
                homeRoute: r.homeRoute,
              };
              if (r.properties.length > 1) {
                setProperties(r.properties);
                setPropertyId(r.property.id);
                setPendingToken(r.token);
                setAccountMeta(account);
                return;
              }
              enter(r.token, r.property, account);
            });
          });
        }}
      >
        {pending ? "Signing in…" : properties ? "Enter portal" : "Sign in"}
      </button>
    </AuthGateShell>
  );
}
