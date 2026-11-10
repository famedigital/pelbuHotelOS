import { motion, useReducedMotion } from "motion/react";
import { InnorahotelLogo } from "@hos-v2/ui";

const DESK = (
  import.meta.env.VITE_DESK_ORIGIN as string | undefined
)?.replace(/\/$/, "") ?? "https://desk.innorahotel.com";

const PORTALS = [
  {
    label: "Hotelier",
    body: "Hotel email unlocks the property. Each staff member enters with their own desk PIN.",
    href: `${DESK}/login/hotel`,
    cta: "Hotel sign in",
  },
  {
    label: "Tour operator",
    body: "One email across every contracted hotel — allotments and vouchers, never the staff PIN pad.",
    href: `${DESK}/login/agent`,
    cta: "Agent portal",
  },
  {
    label: "Guide",
    body: "Licensed guides open groups and field ops through a companion login.",
    href: `${DESK}/login/guide`,
    cta: "Guide portal",
  },
  {
    label: "Driver",
    body: "Bay, dorm, and advances — credentials that stay with the fleet, not the front desk.",
    href: `${DESK}/login/driver`,
    cta: "Driver portal",
  },
] as const;

export function HomePage() {
  const reduceMotion = useReducedMotion();

  return (
    <div>
      <header className="nav">
        <div className="wrap nav-inner">
          <a href="#top" aria-label="innorahotel.com" style={{ textDecoration: "none" }}>
            <InnorahotelLogo size="sm" variant="gold" />
          </a>
          <nav className="nav-links" aria-label="Primary">
            <a href="#craft">Craft</a>
            <a href="#portals">Portals</a>
            <a href="#desk">Desk</a>
          </nav>
          <a className="nav-cta" href={`${DESK}/login/hotel`}>
            Sign in
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="brand">
          <div className="hero-photo" aria-hidden="true">
            <img
              src="/marketing/places/night.png"
              alt=""
              width={1920}
              height={1080}
              fetchPriority="high"
            />
          </div>
          <div className="hero-shade" aria-hidden="true" />
          <div className="wrap">
            <motion.div
              className="hero-copy"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="hero-kicker">Bhutan · Himalaya</p>
              <h1 className="hero-brand" id="brand">
                Innora
              </h1>
              <p className="hero-line">
                The operating system behind Himalayan hotels — desk, partners, and field in one stack.
              </p>
              <div className="hero-actions">
                <a className="btn-solid" href={`${DESK}/login/hotel`}>
                  Hotel sign in
                </a>
                <a className="btn-line" href={`${DESK}/login/agent`}>
                  Partner portals
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="craft" className="band">
          <div className="wrap split">
            <div className="copy">
              <p className="band-kicker">Why it exists</p>
              <h2 className="band-title">Built for the handoff that usually breaks.</h2>
              <p className="band-body">
                Front desk, kitchen, agents, guides, and drivers rarely share one ledger.
                Innora keeps each door exclusive — and every folio, SDF, and allotment in one
                stack.
              </p>
            </div>
            <div className="frame">
              <img
                src="/marketing/places/lobby.png"
                alt="Hotel lobby"
                loading="lazy"
                width={900}
                height={675}
              />
              <span className="frame-caption">Lobby</span>
            </div>
          </div>
        </section>

        <section className="band" style={{ paddingTop: 0 }}>
          <div className="wrap split reverse">
            <div className="copy">
              <p className="band-kicker">Operations</p>
              <h2 className="band-title">Calm for the guest. Exact for the house.</h2>
              <p className="band-body">
                Stay racks, gapless fiscal invoices, Bhutan compliance, agent credit —
                built for busy Himalayan shifts.
              </p>
            </div>
            <div className="frame">
              <img
                src="/marketing/places/dining.png"
                alt="Dining service"
                loading="lazy"
                width={900}
                height={675}
              />
              <span className="frame-caption">Service</span>
            </div>
          </div>
        </section>

        <section id="portals" className="band">
          <div className="wrap">
            <p className="band-kicker">Access</p>
            <h2 className="band-title">Four doors. One stack.</h2>
            <p className="band-body" style={{ marginBottom: "32px" }}>
              Hotel email unlocks the property. Partners sign in with their own email across
              every hotel they are linked to.
            </p>
            <div className="portals">
              {PORTALS.map((p) => (
                <a key={p.label} className="portal-row" href={p.href}>
                  <strong>{p.label}</strong>
                  <p>{p.body}</p>
                  <span>{p.cta}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="desk" className="band">
          <div className="wrap">
            <p className="band-kicker">Desk</p>
            <h2 className="band-title">The front office, composed.</h2>
            <p className="band-body" style={{ marginBottom: "28px" }}>
              Sign in with your hotel email, choose the property, then each staff member unlocks
              with their desk PIN.
            </p>
            <motion.div
              className="desk-shot"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <img
                src="/marketing/screens/desk.png"
                alt="Innora desk"
                loading="lazy"
                width={1200}
                height={750}
              />
            </motion.div>
          </div>
        </section>

        <section className="finale wrap">
          <p className="band-kicker">Begin</p>
          <h2 className="band-title">Ready when the lobby is.</h2>
          <p className="band-body">
            Email first, then the staff who run the house.
          </p>
          <a className="btn-solid" href={`${DESK}/login/hotel`}>
            Hotel sign in
          </a>
        </section>
      </main>

      <footer className="footer wrap">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <InnorahotelLogo size="sm" variant="gold" />
          <p style={{ margin: 0 }}>
            © {new Date().getFullYear()} innorahotel.com · Bhutan & the Himalaya
          </p>
        </div>
      </footer>

      <div className="mobile-bar" aria-label="Quick actions">
        <a className="btn-line" href={`${DESK}/login/agent`} style={{ justifyContent: "center" }}>
          Agent
        </a>
        <a className="btn-solid" href={`${DESK}/login/hotel`} style={{ justifyContent: "center" }}>
          Hotel
        </a>
      </div>
    </div>
  );
}
