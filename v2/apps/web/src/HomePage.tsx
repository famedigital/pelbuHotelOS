import { motion, useReducedMotion } from "motion/react";
import { InnorahotelLogo } from "@hos-v2/ui";
import {
  Bed,
  Building2,
  CalendarDays,
  CheckCircle2,
  Compass,
  FileCheck2,
  KeyRound,
  LayoutGrid,
  Lock,
  Receipt,
  Scale,
  ShieldCheck,
  Sparkles,
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

const PORTALS = [
  {
    role: "Hotelier & GM",
    icon: Building2,
    badge: "Front Office Cockpit",
    title: "Hotel Staff & Management",
    body: "Single sign-on for your property domain. Each front office clerk, cashier, and housekeeper unlocks their station with a zero-friction PIN.",
    href: `${DESK}/login/hotel`,
    cta: "Launch Hotel Desk",
  },
  {
    role: "Tour Operator",
    icon: Users,
    badge: "B2B Allotment Portal",
    title: "Travel Agencies & Wholesalers",
    body: "One unified email across every partner hotel in Bhutan. Live competitor-masked allotments, 48-hr MoU holds, and instant voucher settlement.",
    href: `${DESK}/login/agent`,
    cta: "Tour Operator Sign In",
  },
  {
    role: "Licensed Guide",
    icon: Compass,
    badge: "Guide Companion PWA",
    title: "Field Guides & Tour Escorts",
    body: "Mobile companion that works on mountain passes. Group digital check-in, 6:00 AM Tiger's Nest box breakfast dispatch, and dietary matrix sync.",
    href: `${DESK}/login/guide`,
    cta: "Open Guide Companion",
  },
  {
    role: "Fleet Driver",
    icon: Truck,
    badge: "Driver Fleet Hub",
    title: "Coaster & HiAce Chauffeurs",
    body: "Guaranteed driver dorm bunk, designated bus parking bay, and 1-tap Dochula pass fuel cash advances billed straight to the corporate ledger.",
    href: `${DESK}/login/driver`,
    cta: "Driver Hub Access",
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
            <a className="nav-cta btn-ghost" href={`${DESK}/login/agent`}>
              Partner Portal
            </a>
            <a className="nav-cta btn-gold" href={`${DESK}/login/hotel`}>
              Hotel Sign In
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
                The Sovereign Operating System for Himalayan Hospitality.
              </h1>

              <p className="hero-line">
                Unifying the front desk cockpit, licensed tour guides, coaster fleet drivers, B2B travel agents, and kitchen pass onto one atomic Bhutanese ledger.
              </p>

              <div className="hero-actions">
                <a className="btn-solid" href="#desk-section">
                  <Zap className="size-4" />
                  <span>Test-Drive Live Cockpit</span>
                </a>
                <a className="btn-line" href={`${DESK}/login/hotel`}>
                  <span>Hotel Sign In</span>
                </a>
                <a className="btn-ghost-hero" href="#broken-relay">
                  <span>See The Broken Relay →</span>
                </a>
              </div>

              <div className="hero-highlights">
                <div className="highlight-item">
                  <CheckCircle2 className="size-4 text-amber-400" />
                  <span>DRC BST-3 Tax Certified</span>
                </div>
                <div className="highlight-item">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <span>Nu. 0.50 Dual-Folio Gate</span>
                </div>
                <div className="highlight-item">
                  <CheckCircle2 className="size-4 text-cyan-400" />
                  <span>Driver Dorm & Bay Allocation</span>
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
                Sign in with your hotel email, choose the property, then each staff member unlocks with their desk PIN. Explore the real live v2 interface below.
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
              <span className="band-kicker">Architecture</span>
              <h2 className="band-title">Five Nodes. One Atomic Ledger.</h2>
              <p className="band-body max-w-2xl">
                Unlike Western hotel systems that stop at the lobby door, Innora coordinates the entire Himalayan travel loop in real time.
              </p>
            </div>

            <div className="ecosystem-cards-grid">
              <div className="ecosystem-card">
                <div className="node-icon-box text-amber-400">
                  <LayoutGrid className="size-6" />
                </div>
                <h3 className="node-title">1. Hotelier Desk Cockpit</h3>
                <p className="node-desc">
                  100vh zero-scroll front office control. Live room rack, till cash vault, instant FastBook (⌘B), and 1-tap automated night audit close.
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
                  Offline-first mobile PWA for licensed Bhutanese guides. Group check-in, 6:00 AM Tiger's Nest packed breakfasts, and guest dietary matrices.
                </p>
                <div className="node-tags">
                  <span>Group Check-In</span>
                  <span>Box Breakfasts</span>
                  <span>Dietary Matrix</span>
                </div>
              </div>

              <div className="ecosystem-card">
                <div className="node-icon-box text-cyan-400">
                  <Truck className="size-6" />
                </div>
                <h3 className="node-title">3. Fleet Driver Hub</h3>
                <p className="node-desc">
                  Dignified driver logistics. Dedicated dorm bed allocation (Bed B-02), coaster bus bay assignment, and Dochula pass fuel advances linked to agency ledger.
                </p>
                <div className="node-tags">
                  <span>Dorm Bed Allocation</span>
                  <span>Bus Bay</span>
                  <span>Fuel Cash Advance</span>
                </div>
              </div>

              <div className="ecosystem-card">
                <div className="node-icon-box text-purple-400">
                  <Users className="size-6" />
                </div>
                <h3 className="node-title">4. B2B Travel Agent Portal</h3>
                <p className="node-desc">
                  Real-time contracted rates, allotment balances, 48-hr MoU release holds, and competitor-masked occupancy for agencies like Yangphel and Druk Asia.
                </p>
                <div className="node-tags">
                  <span>Competitor Masking</span>
                  <span>MoU Holds</span>
                  <span>Instant Vouchers</span>
                </div>
              </div>

              <div className="ecosystem-card">
                <div className="node-icon-box text-rose-400">
                  <UtensilsCrossed className="size-6" />
                </div>
                <h3 className="node-title">5. Kitchen Display (KDS)</h3>
                <p className="node-desc">
                  Instant ticket pass chime (&lt;14ms). Packed breakfast countdowns, allergen tags, and instant room-charge posting with zero paper chits.
                </p>
                <div className="node-tags">
                  <span>Sub-14ms Chime</span>
                  <span>Allergen Safety</span>
                  <span>Paperless KOT</span>
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

        {/* SECTION 6: FOUR SOVEREIGN DOORS (PORTALS) */}
        <section id="portals" className="band band-darker">
          <div className="wrap">
            <div className="section-head text-center">
              <span className="band-kicker">Unified Access</span>
              <h2 className="band-title">Four Doors. One Stack.</h2>
              <p className="band-body mx-auto max-w-2xl">
                Hotel email unlocks the property. Partners sign in with their own email across every hotel they are contracted with.
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
            <h2 className="band-title">Ready When the Lobby Is.</h2>
            <p className="band-body max-w-xl">
              Zero upfront hardware. Self-hosted sovereign data. Experience the front office operating system built specifically for Bhutan.
            </p>
            <div className="flex flex-wrap gap-4 items-center">
              <a className="btn-solid" href={`${DESK}/login/hotel`}>
                Hotel Sign In
              </a>
              <a className="btn-line" href={`${DESK}/login/agent`}>
                Tour Operator Portal
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
              The Sovereign Operating System for Himalayan Hospitality.
            </p>
          </div>

          <div className="footer-nav">
            <a href="#desk-section">Desk Cockpit</a>
            <a href="#broken-relay">The Broken Relay</a>
            <a href="#ecosystem">5-Way Ecosystem</a>
            <a href="#compliance">DRC Tax & Legal</a>
            <a href="#roi-calc">ROI Calculator</a>
            <a href={`${DESK}/login/hotel`}>Hotel Login</a>
            <a href={`${DESK}/login/agent`}>Agent Portal</a>
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
        <a className="btn-line" href={`${DESK}/login/agent`} style={{ justifyContent: "center" }}>
          Partner Login
        </a>
        <a className="btn-solid" href={`${DESK}/login/hotel`} style={{ justifyContent: "center" }}>
          Hotel Sign In
        </a>
      </div>
    </div>
  );
}
