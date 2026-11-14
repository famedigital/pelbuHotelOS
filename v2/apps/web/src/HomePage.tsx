import { motion, useReducedMotion } from "motion/react";
import { InnorahotelLogo } from "@hos-v2/ui";
import {
  Building2,
  CheckCircle2,
  Compass,
  FileCheck2,
  KeyRound,
  LayoutGrid,
  Receipt,
  Scale,
  ShieldCheck,
  Truck,
  Users,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { LiveDeskPreview } from "./components/LiveDeskPreview";
import { BrokenRelaySimulator } from "./components/BrokenRelaySimulator";
import { RoiCalculator } from "./components/RoiCalculator";

const DESK = (
  import.meta.env.VITE_DESK_ORIGIN as string | undefined
)?.replace(/\/$/, "") ?? "https://desk.innorahotel.com";

const SIGN_IN = `${DESK}/login`;

const PORTALS = [
  {
    role: "Hotelier & GM",
    icon: Building2,
    badge: "Front Office Cockpit",
    title: "Hotels & property teams",
    body: "One sign-in opens your property. Front office, cashiers, and housekeepers unlock their station with a desk PIN — Bhutan tax, dual folio, night audit.",
    href: SIGN_IN,
    cta: "Sign in",
  },
  {
    role: "Tour Operator",
    icon: Users,
    badge: "B2B Partner Portal",
    title: "Travel agencies & wholesalers",
    body: "Same sign-in routes you to Partner. Masked sellable rooms at contracted hotels, MoU holds, vouchers, and guide/fleet request board.",
    href: SIGN_IN,
    cta: "Sign in",
  },
  {
    role: "Licensed Guide",
    icon: Compass,
    badge: "Guide Companion",
    title: "Licensed guides & escorts",
    body: "Field companion for group check-in, dietary matrices, and early box breakfasts — plus presence on the Innora guide request board.",
    href: SIGN_IN,
    cta: "Sign in",
  },
  {
    role: "Fleet Driver",
    icon: Truck,
    badge: "Fleet Driver Hub",
    title: "Coaster & HiAce chauffeurs",
    body: "Dorm bunk, parking bay, and fuel advances on the ledger — with fleet request board so hotels and agents can find free cars.",
    href: SIGN_IN,
    cta: "Sign in",
  },
] as const;

export function HomePage() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="home-root">
      {/* Sovereign Sticky Header */}
      <header className="nav">
        <div className="wrap nav-inner">
          <a href="#top" aria-label="innorahotel.com" className="brand-link">
            <InnorahotelLogo size="sm" variant="gold" />
          </a>

          <nav className="nav-links" aria-label="Primary">
            <a href="#desk-section">Desk Cockpit</a>
            <a href="#broken-relay">The Broken Relay</a>
            <a href="#ecosystem">5-Way Ecosystem</a>
            <a href="#compliance">DRC Tax & Legal</a>
            <a href="#roi-calc">ROI Calculator</a>
            <a href="#portals">Portals</a>
          </nav>

          <div className="nav-actions">
            <a className="nav-cta btn-ghost" href="#ecosystem">
              Explore ecosystem
            </a>
            <a className="nav-cta btn-gold" href={SIGN_IN}>
              Sign in
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Section */}
        <section className="hero" aria-labelledby="brand">
          <div className="hero-photo" aria-hidden="true">
            <img
              src="/marketing/places/night.png"
              alt="Himalayan valley under starry night"
              width={1920}
              height={1080}
              fetchPriority="high"
            />
          </div>
          <div className="hero-shade" aria-hidden="true" />

          <div className="wrap hero-wrap">
            <motion.div
              className="hero-copy"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="hero-telemetry-badge">
                <span className="telemetry-live-dot" />
                <span className="telemetry-text">
                  Paro PBH: Clear · Dochula: 8°C · Live Sync: &lt;14ms
                </span>
              </div>

              <h1 className="hero-brand" id="brand">
                Innora
              </h1>

              <p className="hero-line">
                The sovereign operating system for Himalayan hospitality — hotels, tour agents, licensed guides, and fleet drivers on one network and one atomic Bhutanese ledger.
              </p>

              <div className="hero-actions">
                <a className="btn-solid" href={SIGN_IN}>
                  <KeyRound className="size-4" />
                  <span>Sign in</span>
                </a>
                <a className="btn-line" href="#desk-section">
                  <Zap className="size-4" />
                  <span>Test-drive desk</span>
                </a>
                <a className="btn-ghost-hero" href="#ecosystem">
                  <span>Who Innora is for →</span>
                </a>
              </div>

              <div className="hero-highlights">
                <div className="highlight-item">
                  <CheckCircle2 className="size-4 text-amber-400" />
                  <span>One login · role-aware portals</span>
                </div>
                <div className="highlight-item">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <span>Agents: masked free rooms</span>
                </div>
                <div className="highlight-item">
                  <CheckCircle2 className="size-4 text-cyan-400" />
                  <span>Innora Bot on Telegram</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* SECTION 1: THE LIVE DESK COCKPIT SHOWCASE (Direct Fix for "we have change our ui") */}
        <section id="desk-section" className="band band-desk">
          <div className="wrap">
            <div className="section-head text-center">
              <span className="band-kicker">Interactive Product Cockpit</span>
              <h2 className="band-title">The Front Office, Composed.</h2>
              <p className="band-body mx-auto max-w-2xl">
                Hotel teams sign in once, choose the property, then unlock with a desk PIN. Agents, guides, and drivers use the same Sign in — we route them to Partner, Guide, or Fleet.
              </p>
            </div>

            <motion.div
              className="desk-showcase-wrapper"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
            >
              <LiveDeskPreview />
            </motion.div>
          </div>
        </section>

        {/* SECTION 2: THE BROKEN RELAY (Real Bhutan Hospitality Friction vs Innora Cure) */}
        <section id="broken-relay" className="band band-darker">
          <div className="wrap">
            <div className="section-head text-center">
              <span className="band-kicker">Operational Reality</span>
              <h2 className="band-title">Built for the Handoff that Usually Breaks.</h2>
              <p className="band-body mx-auto max-w-2xl">
                Front desk, kitchen, travel agents, tour guides, and drivers rarely share one ledger. Here is how legacy hospitality leaks revenue and how Innora cures it.
              </p>
            </div>

            <BrokenRelaySimulator />
          </div>
        </section>

        {/* SECTION 3: 5-WAY SYNCHRONIZED ECOSYSTEM */}
        <section id="ecosystem" className="band">
          <div className="wrap">
            <div className="section-head">
              <span className="band-kicker">What Innora is</span>
              <h2 className="band-title">One network for Himalayan hospitality.</h2>
              <p className="band-body max-w-2xl">
                Innora is not hotel software alone. It is the operating system that links property desks, tour operators, licensed guides, and fleet drivers — so rooms, field capacity, and ops alerts stay on one ledger.
              </p>
            </div>

            <div className="ecosystem-cards-grid">
              <div className="ecosystem-card">
                <div className="node-icon-box text-amber-400">
                  <LayoutGrid className="size-6" />
                </div>
                <h3 className="node-title">1. Hotelier Desk Cockpit</h3>
                <p className="node-desc">
                  Live room rack, till vault, Fast Book, and night audit. Free rooms at your property — plus posting need-a-guide / need-a-car requests to the network board.
                </p>
                <div className="node-tags">
                  <span>Till Vault</span>
                  <span>StayHub Folio</span>
                  <span>1-Tap Night Audit</span>
                </div>
              </div>

              <div className="ecosystem-card">
                <div className="node-icon-box text-emerald-400">
                  <Compass className="size-6" />
                </div>
                <h3 className="node-title">2. Tour Guide Companion</h3>
                <p className="node-desc">
                  Group check-in, Tiger&apos;s Nest box breakfasts, dietary matrices — and guide presence so hotels and agents can request licensed capacity.
                </p>
                <div className="node-tags">
                  <span>Group Check-In</span>
                  <span>Box Breakfasts</span>
                  <span>Request board</span>
                </div>
              </div>

              <div className="ecosystem-card">
                <div className="node-icon-box text-cyan-400">
                  <Truck className="size-6" />
                </div>
                <h3 className="node-title">3. Fleet Driver Hub</h3>
                <p className="node-desc">
                  Dorm bunk, bus bay, fuel advances — and fleet presence so agencies and hotels can find free coasters when the mountain road fills.
                </p>
                <div className="node-tags">
                  <span>Dorm & Bay</span>
                  <span>Fuel Advance</span>
                  <span>Request board</span>
                </div>
              </div>

              <div className="ecosystem-card">
                <div className="node-icon-box text-purple-400">
                  <Users className="size-6" />
                </div>
                <h3 className="node-title">4. B2B Travel Agent Portal</h3>
                <p className="node-desc">
                  Live masked sellable rooms at contracted hotels, MoU holds, vouchers — plus Guides &amp; cars when you need field capacity for a group.
                </p>
                <div className="node-tags">
                  <span>Masked inventory</span>
                  <span>MoU Holds</span>
                  <span>Guides &amp; cars</span>
                </div>
              </div>

              <div className="ecosystem-card">
                <div className="node-icon-box text-rose-400">
                  <UtensilsCrossed className="size-6" />
                </div>
                <h3 className="node-title">5. Kitchen + Innora Bot</h3>
                <p className="node-desc">
                  KDS tickets and allergen tags on the property ledger. Innora Bot on Telegram keeps FO, HK, kitchen, and agents in the ops loop (guide/driver pairing expanding).
                </p>
                <div className="node-tags">
                  <span>Paperless KOT</span>
                  <span>Innora Bot</span>
                  <span>Agent alerts</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: DRC TAX & LEGAL COMPLIANCE */}
        <section id="compliance" className="band band-darker">
          <div className="wrap">
            <div className="split-compliance">
              <div className="compliance-copy">
                <span className="band-kicker">Tax & Regulatory Integrity</span>
                <h2 className="band-title">Engineered for Bhutan's Department of Revenue & Customs.</h2>
                <p className="band-body">
                  No generic foreign software correctly handles Bhutan's statutory 10% Service Charge compounding into 5% Bhutan Sales Tax (BST), nor the gapless PSBN voucher numbering mandated by the Ministry of Finance.
                </p>

                <div className="compliance-features">
                  <div className="feat-row">
                    <ShieldCheck className="size-5 text-emerald-400 shrink-0" />
                    <div>
                      <strong>DRC BST-3 One-Click Return</strong>
                      <p>Generate monthly DRC BST-3 tax filing schedules with gapless sales sequences and zero rounding drift.</p>
                    </div>
                  </div>

                  <div className="feat-row">
                    <Scale className="size-5 text-amber-400 shrink-0" />
                    <div>
                      <strong>Compounding Math Engine</strong>
                      <p>10% Service Charge calculated first, with 5% BST applied accurately across food, beverage, and accommodation.</p>
                    </div>
                  </div>

                  <div className="feat-row">
                    <FileCheck2 className="size-5 text-cyan-400 shrink-0" />
                    <div>
                      <strong>RBP Immigration Manifest</strong>
                      <p>Daily Royal Bhutan Police immigration manifest export for foreign tourist passport verification.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="compliance-math-card">
                <div className="math-card-header">
                  <Receipt className="size-4 text-amber-400" />
                  <span>Bhutan Tax Calculation Engine</span>
                  <span className="math-badge">Statutory BST-3</span>
                </div>

                <div className="math-lines">
                  <div className="math-line">
                    <span>Base Room & F&B Charges:</span>
                    <span className="font-mono">Nu. 10,000.00</span>
                  </div>
                  <div className="math-line">
                    <span>+ 10% Mandatory Service Charge (SC):</span>
                    <span className="font-mono text-amber-300">Nu. 1,000.00</span>
                  </div>
                  <div className="math-line border-t border-zinc-700 pt-2">
                    <span>Subtotal Subject to Tax:</span>
                    <span className="font-mono">Nu. 11,000.00</span>
                  </div>
                  <div className="math-line">
                    <span>+ 5% Bhutan Sales Tax (BST on Subtotal):</span>
                    <span className="font-mono text-cyan-300">Nu. 550.00</span>
                  </div>
                  <div className="math-line border-t-2 border-amber-500/40 pt-2 font-bold text-amber-300">
                    <span>Total Tax-Compliant Settlement:</span>
                    <span className="font-mono text-emerald-400 text-[16px]">Nu. 11,550.00</span>
                  </div>
                </div>

                <div className="math-footer">
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                  <span>Zero rounding drift across master and personal split folios.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: TACTILE FINANCIAL ROI CALCULATOR */}
        <section id="roi-calc" className="band">
          <div className="wrap">
            <RoiCalculator />
          </div>
        </section>

        {/* SECTION 6: WHO IT IS FOR */}
        <section id="portals" className="band band-darker">
          <div className="wrap">
            <div className="section-head text-center">
              <span className="band-kicker">For whom</span>
              <h2 className="band-title">Four audiences. One Sign in.</h2>
              <p className="band-body mx-auto max-w-2xl">
                Hotels, tour agents, guides, and drivers each get a purpose-built portal. You sign in once — Innora routes you by role.
              </p>
            </div>

            <div className="portals-cards-grid">
              {PORTALS.map((p) => {
                const IconComponent = p.icon;
                return (
                  <div key={p.role} className="portal-box">
                    <div className="portal-box-top">
                      <div className="portal-icon-wrapper">
                        <IconComponent className="size-5" />
                      </div>
                      <span className="portal-badge">{p.badge}</span>
                    </div>

                    <h3 className="portal-heading">{p.title}</h3>
                    <p className="portal-description">{p.body}</p>

                    <a className="portal-btn" href={p.href}>
                      <span>{p.cta}</span>
                      <span aria-hidden="true">→</span>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 7: EXECUTIVE TESTIMONIALS */}
        <section className="band">
          <div className="wrap">
            <div className="section-head text-center">
              <span className="band-kicker">Field Endorsement</span>
              <h2 className="band-title">Trusted by Himalayan Hoteliers & Guides.</h2>
            </div>

            <div className="testimonials-grid">
              <div className="testimonial-card">
                <p className="quote-text">
                  "Before Innora, our guides were calling reception at midnight for early Tiger's Nest breakfasts. Now with the Guide Companion, boxes are ready at 05:45 AM without a single miscommunication."
                </p>
                <div className="quotee-info">
                  <strong>Dorji Tshering</strong>
                  <span>Senior Expedition Guide · Yangphel Adventure Travel</span>
                </div>
              </div>

              <div className="testimonial-card">
                <p className="quote-text">
                  "The dual-folio settlement gate saved us tens of thousands in uncollected bar bills and minibar disputes during Paro Tshechu. The night audit rolls in 3 seconds flat."
                </p>
                <div className="quotee-info">
                  <strong>Pema Wangchuk</strong>
                  <span>General Manager · Pelbu Suites, Paro</span>
                </div>
              </div>

              <div className="testimonial-card">
                <p className="quote-text">
                  "Having our coaster bus bay and dorm bed assigned in advance makes our drivers feel valued. It changed the entire dynamic between transport and front desk."
                </p>
                <div className="quotee-info">
                  <strong>Karma Tenzin</strong>
                  <span>Fleet Operations Lead · Druk Asia Bhutan</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINALE CTA */}
        <section className="finale wrap">
          <div className="finale-box">
            <span className="band-kicker">Immediate Deployment</span>
            <h2 className="band-title">Ready when the lobby — and the mountain road — are.</h2>
            <p className="band-body max-w-xl">
              Self-hosted sovereign data for Bhutan. One Sign in for hotels, agents, guides, and drivers.
            </p>
            <div className="flex flex-wrap gap-4 items-center">
              <a className="btn-solid" href={SIGN_IN}>
                Sign in
              </a>
              <a className="btn-line" href="#ecosystem">
                Explore the network
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Sovereign Footer */}
      <footer className="footer wrap">
        <div className="footer-inner">
          <div className="footer-brand">
            <InnorahotelLogo size="sm" variant="gold" />
            <p className="footer-tagline">
              Innora — hotels, agents, guides, and drivers on one Himalayan ledger.
            </p>
          </div>

          <div className="footer-nav">
            <a href="#desk-section">Desk Cockpit</a>
            <a href="#broken-relay">The Broken Relay</a>
            <a href="#ecosystem">Network</a>
            <a href="#compliance">DRC Tax & Legal</a>
            <a href="#roi-calc">ROI Calculator</a>
            <a href={SIGN_IN}>Sign in</a>
          </div>

          <div className="footer-bottom">
            <p>
              © {new Date().getFullYear()} innorahotel.com · Kingdom of Bhutan. Engineered with atomic ledger safety.
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile Sticky Quick Action Bar */}
      <div className="mobile-bar" aria-label="Quick actions">
        <a className="btn-line" href="#ecosystem" style={{ justifyContent: "center" }}>
          Network
        </a>
        <a className="btn-solid" href={SIGN_IN} style={{ justifyContent: "center" }}>
          Sign in
        </a>
      </div>
    </div>
  );
}
