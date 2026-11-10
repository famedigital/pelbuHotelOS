import { motion, useReducedMotion } from "motion/react";
import { InnoraLogo, InnorahotelLogo } from "@hos-v2/ui";

const DESK = (
  import.meta.env.VITE_DESK_ORIGIN as string | undefined
)?.replace(/\/$/, "") ?? "https://desk.innorahotel.com";

const PORTALS = [
  {
    label: "Hotelier",
    body: "Email unlocks the property. Each staff member enters with their own desk PIN.",
    href: `${DESK}/login/hotel`,
    cta: "Hotel sign in",
  },
  {
    label: "Tour operator",
    body: "One email across every contracted hotel — allotments, vouchers, never the staff PIN pad.",
    href: `${DESK}/login/agent`,
    cta: "Agent portal",
  },
  {
    label: "Guide",
    body: "Licensed guides open groups and field ops through a dedicated companion login.",
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
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            >
              <div style={{ marginBottom: "1.5rem" }}>
                <InnorahotelLogo size="xl" variant="sovereign" layout="stacked" />
              </div>
              <p className="hero-kicker">Bhutan · Himalaya · Sovereign hospitality</p>
              <h1 className="hero-brand" id="brand">
                Innora
              </h1>
              <p className="hero-line">The quiet operating system behind Himalayan hotels.</p>
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
                sovereign stack.
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
              <span className="frame-caption">Lobby · live desk</span>
            </div>
          </div>
        </section>

        <section className="band" style={{ paddingTop: 0 }}>
          <div className="wrap split reverse">
            <div className="copy">
              <p className="band-kicker">Operations</p>
              <h2 className="band-title">Luxury for the guest. Precision for the house.</h2>
              <p className="band-body">
                Cold-glass stay racks, gapless fiscal invoices, Bhutan compliance, agent credit —
                engineered for busy Himalayan shifts, not a marketing demo.
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
              <span className="frame-caption">Service · zero lag</span>
            </div>
          </div>
        </section>

        <section id="portals" className="band">
          <div className="wrap">
            <p className="band-kicker">Exclusive access</p>
            <h2 className="band-title">Four doors. One stack.</h2>
            <p className="band-body" style={{ marginBottom: "2.5rem" }}>
              Hotel email unlocks the property. Partners sign in with their own email — across
              every hotel they’re linked to.
            </p>
            <div className="portals">
              {PORTALS.map((p) => (
                <a key={p.label} className="portal-row" href={p.href}>
                  <strong>{p.label}</strong>
                  <p>{p.body}</p>
                  <span>{p.cta} →</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="desk" className="band">
          <div className="wrap">
            <p className="band-kicker">Sovereign desk</p>
            <h2 className="band-title">The front office, composed.</h2>
            <p className="band-body" style={{ marginBottom: "2rem" }}>
              Sign in with your hotel email, choose the property, then each staff member unlocks
              with their desk PIN.
            </p>
            <motion.div
              className="desk-shot"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
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
            Pelbu and every Innora tenant — email first, then the staff who run the house.
          </p>
          <a className="btn-solid" href={`${DESK}/login/hotel`}>
            Hotel sign in
          </a>
        </section>
      </main>

      <footer className="footer wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
        <InnorahotelLogo size="sm" variant="gold" />
        <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.75 }}>
          © {new Date().getFullYear()} innorahotel.com · Sovereign Hospitality OS · Bhutan & the Himalaya
        </p>
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
