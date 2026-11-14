import { useState, useTransition } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  filterDeskProperties,
  humanizeAuthError,
  portalEmailLogin,
  preferLiveProperty,
  type AuthProperty,
} from "../lib/pin-auth-api";
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

/**
 * Email + password portal login.
 * Never ask which hotel after sign-in — partner app picks hotel on book / check.
 */
export function PortalLoginPage() {
  const { role: roleParam } = useParams();
  const role: PortalRole = isRole(roleParam) ? roleParam : "agent";
  const meta = ROLE_META[role];
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function enter(
    token: string,
    property: AuthProperty,
    account: { loginCode: string; displayName: string; subjectId: string; homeRoute: string },
    properties: AuthProperty[],
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
        properties: properties.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
        })),
      },
    );
    navigate(account.homeRoute || "/partner", { replace: true });
  }

  return (
    <AuthGateShell
      kicker={meta.kicker}
      title={meta.title}
      lead={
        role === "agent"
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

      {error ? <p className="auth-gate-error">{error}</p> : null}

      <button
        type="button"
        className="auth-gate-btn"
        disabled={pending || !email.trim() || password.length < 4}
        onClick={() => {
          setError(null);
          startTransition(() => {
            void (async () => {
              const r = await portalEmailLogin({ role, email, password });
              if (!r.ok) {
                const msg = humanizeAuthError(r.error);
                setError(msg);
                if (/hotel desk/i.test(r.error) || /hotel desk/i.test(msg)) {
                  navigate("/login/hotel", { replace: true, state: { email } });
                }
                return;
              }
              const account = {
                loginCode: r.account.loginCode,
                displayName: r.account.displayName,
                subjectId: r.account.subjectId,
                homeRoute: r.homeRoute,
              };
              const ranked = filterDeskProperties(r.properties);
              const preferred = preferLiveProperty(
                ranked.length > 0 ? ranked : r.properties,
                r.property,
              );
              /* Re-bind JWT to live hotel when API still scoped to a seed/demo shell. */
              if (preferred.id !== r.property.id) {
                const again = await portalEmailLogin({
                  role,
                  email,
                  password,
                  propertyId: preferred.id,
                });
                if (again.ok) {
                  enter(again.token, again.property, {
                    loginCode: again.account.loginCode,
                    displayName: again.account.displayName,
                    subjectId: again.account.subjectId,
                    homeRoute: again.homeRoute,
                  }, again.properties);
                  return;
                }
              }
              enter(r.token, preferred, account, r.properties);
            })();
          });
        }}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </AuthGateShell>
  );
}
