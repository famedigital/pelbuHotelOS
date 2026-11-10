import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  Bed,
  CheckCircle2,
  Clock,
  Compass,
  FileSpreadsheet,
  MessageSquareWarning,
  Receipt,
  ShieldCheck,
  Smartphone,
  Truck,
  Users,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";

interface CaseStudy {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  broken: {
    icon: typeof AlertTriangle;
    label: string;
    points: string[];
    lossMetric: string;
    lossLabel: string;
  };
  cure: {
    icon: typeof ShieldCheck;
    label: string;
    points: string[];
    winMetric: string;
    winLabel: string;
  };
}

const CASES: CaseStudy[] = [
  {
    id: "whatsapp-blackhole",
    badge: "Field Operations",
    title: "The Reception Phone & WhatsApp Black Hole",
    subtitle: "When 14 tourists need packed breakfasts at 6:00 AM for the Tiger's Nest hike.",
    broken: {
      icon: MessageSquareWarning,
      label: "Legacy Bhutan Hotel Reality",
      points: [
        "Tour guide sends an unread WhatsApp voice note to receptionist's personal phone at 9:45 PM.",
        "Shift handover paper notebook misses the breakfast note; kitchen staff starts cooking at 7:00 AM.",
        "14 tourists wait hungry in the lobby; tour schedule slips, ruining their hike and causing negative TripAdvisor reviews.",
      ],
      lossMetric: "45 mins",
      lossLabel: "Morning lobby delay & guide friction",
    },
    cure: {
      icon: ShieldCheck,
      label: "The Innora Relay",
      points: [
        "Licensed guide taps 'Dispatch 14 Box Breakfasts' in the Guide Companion PWA with dietary restrictions.",
        "Kitchen KDS screen chimes instantly with exact countdown: 8 vegetarian, 6 regular packs.",
        "Front desk duty board auto-links meal pack status to Room 204 master folio.",
      ],
      winMetric: "0 mins",
      winLabel: "Boxes waiting packed at desk at 5:45 AM",
    },
  },
  {
    id: "driver-dorm-bed",
    badge: "Fleet & Hospitality",
    title: "Driver Dorm Bed & Coaster Bus Parking Scramble",
    subtitle: "Where do 6 Toyota Coaster buses park and where do drivers sleep during Paro Tshechu?",
    broken: {
      icon: Truck,
      label: "Legacy Bhutan Hotel Reality",
      points: [
        "Hotel overbooks guest rooms; forgets to reserve driver dorm beds in the lower wing.",
        "Drivers are forced to sleep in cold 22-seater coaster buses with engines idling for heat.",
        "No dedicated bus parking spots; tourist rental cars get blocked in the main courtyard.",
      ],
      lossMetric: "Nu. 12,000",
      lossLabel: "Wasted diesel & damaged tour agency goodwill",
    },
    cure: {
      icon: Bed,
      label: "The Innora Relay",
      points: [
        "Driver Dorm Bed B-02 and Bus Bay #3 assigned automatically upon group booking confirmation.",
        "Driver receives offline SMS/PWA pass with room key, clean linen pin, and dinner token.",
        "Fuel cash advance (Nu. 3,500) disbursed from front desk cashier till, tracked on tour operator MoU.",
      ],
      winMetric: "100%",
      winLabel: "Guaranteed driver bunk & designated bus bay",
    },
  },
  {
    id: "late-rollaway-bed",
    badge: "Housekeeping",
    title: "The 8:30 PM Late Rollaway Bed Emergency",
    subtitle: "A family arrives with a child needing an extra mattress after housekeeping shifts end.",
    broken: {
      icon: AlertTriangle,
      label: "Legacy Bhutan Hotel Reality",
      points: [
        "Desk agent searches for physical storehouse keys; housekeeping staff has already gone home.",
        "Extra bed charge (Nu. 1,800 + tax) written on scrap paper and forgotten at checkout.",
        "Guest waits 40 minutes while night porter drags a dusty mattress across the lobby.",
      ],
      lossMetric: "Nu. 1,800",
      lossLabel: "Unbilled extra bed revenue per incident",
    },
    cure: {
      icon: CheckCircle2,
      label: "The Innora Relay",
      points: [
        "One tap in FastBook adds 'Rollaway Bed' with instant Housekeeping Hallway Mode notification.",
        "Exact inventory location (Storehouse B, Rack 2) surfaced on porter's mobile screen.",
        "Nu. 1,800 + 10% Service Charge + 5% BST auto-posted to folio ledger with zero manual math.",
      ],
      winMetric: "4 mins",
      winLabel: "Bed delivered and billed automatically",
    },
  },
  {
    id: "agent-allotments",
    badge: "B2B Allotments",
    title: "The Tour Operator Allotment Blindspot",
    subtitle: "Yangphel and Druk Asia asking for the same 6 valley rooms during festival season.",
    broken: {
      icon: FileSpreadsheet,
      label: "Legacy Bhutan Hotel Reality",
      points: [
        "Hotel manages allotments across 4 disparate Excel spreadsheets on a shared desktop.",
        "Reservations manager promises the same rooms to two rival high-value agencies.",
        "Double-booking discovered on arrival night; guest relocated to a competitor hotel at triple cost.",
      ],
      lossMetric: "Nu. 85,000",
      lossLabel: "Relocation loss + lost travel agency contract",
    },
    cure: {
      icon: ShieldCheck,
      label: "The Innora Relay",
      points: [
        "Dedicated B2B Partner Portal with live competitor room masking (e.g. 'Occupied · Tour Group').",
        "48-hour automated release timers on festival MoU holds; expired rooms instantly re-pool.",
        "Agencies view real-time contracted rates, allotment balances, and issue guaranteed vouchers.",
      ],
      winMetric: "0 Duplicates",
      winLabel: "Live synchronized multi-agent inventory",
    },
  },
  {
    id: "dual-folio-dispute",
    badge: "Finance & DRC BST-3",
    title: "The Dual-Folio Incidental Checkout Dispute",
    subtitle: "Agency pays room & board, but guest leaves Nu. 3,400 minibar/laundry bill unpaid.",
    broken: {
      icon: Receipt,
      label: "Legacy Bhutan Hotel Reality",
      points: [
        "Tour guide hurries the group into coaster buses; front desk prints a messy combined 4-page bill.",
        "Tourist claims 'Everything was included in our Bhutan package' and refuses to pay beer charges.",
        "Hotel ends up writing off Nu. 3,400 in bar revenue or waiting 60 days to dispute with the agency.",
      ],
      lossMetric: "Nu. 3,400",
      lossLabel: "Lost incidentals written off per tour group",
    },
    cure: {
      icon: ShieldCheck,
      label: "The Innora Relay",
      points: [
        "Strict Split-Folio Architecture: Folio A (Agency Master) vs. Folio B (Guest Personal Incidentals).",
        "Nu. 0.50 Personal Settlement Gate: Desk checkout button is locked until personal balance is zero.",
        "Guest settles personal folio via DrukPay / mBOB QR or card; agency voucher closes cleanly.",
      ],
      winMetric: "Nu. 0.00",
      winLabel: "Zero financial leakage at group checkout",
    },
  },
];

export function BrokenRelaySimulator() {
  const [activeId, setActiveId] = useState(CASES[0].id);

  const activeCase = CASES.find((c) => c.id === activeId) || CASES[0];

  return (
    <div className="relay-simulator-card">
      {/* Category Pills Header */}
      <div className="relay-nav">
        {CASES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`relay-pill ${c.id === activeId ? "active" : ""}`}
            onClick={() => setActiveId(c.id)}
          >
            <span className="pill-badge">{c.badge}</span>
            <span className="pill-title">{c.title.split(" ")[1] || c.title}</span>
          </button>
        ))}
      </div>

      {/* Active Case Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCase.id}
          className="relay-content"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          <div className="case-header">
            <span className="case-badge">{activeCase.badge}</span>
            <h3 className="case-title">{activeCase.title}</h3>
            <p className="case-sub">{activeCase.subtitle}</p>
          </div>

          <div className="comparison-grid">
            {/* The Broken Reality */}
            <div className="comparison-side broken-side">
              <div className="side-header">
                <div className="side-icon-box text-rose-400">
                  <XCircle className="size-5" />
                </div>
                <div>
                  <h4 className="side-title text-rose-300">The Broken Way</h4>
                  <p className="side-subtitle">Paper notes, WhatsApp messages & Excel sheets</p>
                </div>
              </div>

              <ul className="points-list">
                {activeCase.broken.points.map((pt, i) => (
                  <li key={i} className="point-item broken-point">
                    <span className="bullet text-rose-500">•</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>

              <div className="side-metric-box broken-metric">
                <span className="metric-figure text-rose-400">{activeCase.broken.lossMetric}</span>
                <span className="metric-desc">{activeCase.broken.lossLabel}</span>
              </div>
            </div>

            {/* The Innora Sovereign Cure */}
            <div className="comparison-side cure-side">
              <div className="side-header">
                <div className="side-icon-box text-emerald-400">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <h4 className="side-title text-emerald-300">The Innora Sovereign Relay</h4>
                  <p className="side-subtitle">Synchronized real-time desk, field & ledger</p>
                </div>
              </div>

              <ul className="points-list">
                {activeCase.cure.points.map((pt, i) => (
                  <li key={i} className="point-item cure-point">
                    <span className="bullet text-emerald-400">✓</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>

              <div className="side-metric-box cure-metric">
                <span className="metric-figure text-emerald-400">{activeCase.cure.winMetric}</span>
                <span className="metric-desc">{activeCase.cure.winLabel}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
