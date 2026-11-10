import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Crown,
  Zap,
  LayoutDashboard,
  MapPin,
  Ticket,
  Radar,
  Command,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
} from "lucide-react";
import { Button } from "@hos-v2/ui";
import { useSettingsStore } from "../lib/settings-store";
import { toast } from "sonner";

interface TourStep {
  id: number;
  selector: string;
  title: string;
  description: string;
  icon: typeof Crown;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    selector: '[data-tour="header"]',
    title: "Executive Flight Deck Header",
    description:
      "This locked 46px bar displays your live Cashier Till float with pulsing emerald radar dot, business date (Shift 1), quick print studio, and staff PIN switch.",
    icon: Crown,
  },
  {
    id: 2,
    selector: '[data-tour="fast-book"]',
    title: "Fast Book Studio (⌘B)",
    description:
      "Create reservations in under 8 seconds. Press ⌘B anywhere to open tactile steppers for adults/children, room categories with live availability, and DRC BST-3 tax quotes.",
    icon: Zap,
  },
  {
    id: 3,
    selector: '[data-tour="kpis"]',
    title: "Bento KPI Mission Ribbon",
    description:
      "Monitor Occupancy %, RevPAR Yield, Arrivals flight status (with unassigned room alerts), and real-time Housekeeping room readiness without leaving row 1.",
    icon: LayoutDashboard,
  },
  {
    id: 4,
    selector: '[data-tour="floormap"]',
    title: "Floor Map Quick Strip",
    description:
      "Every room across all floors is rendered as an interactive tactile jewel tile. Click any room chip to immediately open the guest folio or inspect room status.",
    icon: MapPin,
  },
  {
    id: 5,
    selector: '[data-tour="worklist"]',
    title: "Luxury Boarding-Pass Worklist",
    description:
      "Guest reservations are styled as luxury travel boarding passes with nationality flags, meal plan pills, settled/due chips, and 1-tap Check In (Keycard Encode) triggers. Use J/K to navigate.",
    icon: Ticket,
  },
  {
    id: 6,
    selector: '[data-tour="radar"]',
    title: "Operations Radar & Till Vault",
    description:
      "Keep watch over active VIP guests and personalized stay preferences, Tour Group rosters, and execute CFM till advances.",
    icon: Radar,
  },
  {
    id: 7,
    selector: '[data-tour="search"]',
    title: "Command Palette & Voice Dispatcher (⌘K / ⌘J)",
    description:
      "Press ⌘K to search any guest, voucher, or room number instantly. Press ⌘J to execute natural language dispatching.",
    icon: Command,
  },
];

type SpotlightRect = { top: number; left: number; width: number; height: number };

export function InteractiveStaffTour() {
  const isStaffTourOpen = useSettingsStore((s) => s.isStaffTourOpen);
  const closeStaffTour = useSettingsStore((s) => s.closeStaffTour);
  const completeStaffTour = useSettingsStore((s) => s.completeStaffTour);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [spot, setSpot] = useState<SpotlightRect | null>(null);

  const currentStep = TOUR_STEPS[currentStepIndex];

  useEffect(() => {
    if (!isStaffTourOpen) return;
    const measure = () => {
      const el = document.querySelector(currentStep.selector);
      if (!(el instanceof HTMLElement)) {
        setSpot(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const pad = 8;
      setSpot({
        top: Math.max(8, r.top - pad),
        left: Math.max(8, r.left - pad),
        width: Math.min(window.innerWidth - 16, r.width + pad * 2),
        height: Math.min(window.innerHeight - 16, r.height + pad * 2),
      });
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [isStaffTourOpen, currentStep.selector, currentStepIndex]);

  if (!isStaffTourOpen) return null;

  const Icon = currentStep.icon;
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      completeStaffTour();
      toast.success("Tutorial Complete!", {
        description: "You're all set to operate Hotel OS Sovereign Desk.",
      });
    } else {
      setCurrentStepIndex((i) => i + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) setCurrentStepIndex((i) => i - 1);
  };

  const handleDismiss = () => {
    closeStaffTour();
    toast.message("Tutorial paused", {
      description: "You can restart the tour anytime from Help or Settings.",
    });
  };

  const cardTop = spot
    ? Math.min(
        window.innerHeight - 280,
        Math.max(16, spot.top + spot.height + 12),
      )
    : undefined;
  const cardLeft = spot
    ? Math.min(window.innerWidth - 496, Math.max(16, spot.left))
    : undefined;

  return (
    <div className="fixed inset-0 z-[180]">
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <mask id="hos-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {spot ? (
              <rect
                x={spot.left}
                y={spot.top}
                width={spot.width}
                height={spot.height}
                rx={12}
                fill="black"
              />
            ) : null}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(15,23,42,0.72)"
          mask="url(#hos-tour-mask)"
          className="pointer-events-auto"
          onClick={handleDismiss}
        />
      </svg>

      {spot ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-blue-400/80 ring-offset-2 ring-offset-transparent"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: "0 0 0 9999px rgba(15,23,42,0.0), 0 0 32px rgba(59,130,246,0.45)",
          }}
        />
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep.id}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          className="hos-luxury-card pointer-events-auto absolute z-10 w-[min(480px,calc(100vw-2rem))] overflow-hidden border border-white/20 bg-[var(--hos-cell)] p-5 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.65)]"
          style={
            spot && cardTop != null && cardLeft != null
              ? { top: cardTop, left: cardLeft }
              : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white shadow-md shadow-blue-500/25 ring-1 ring-white/30">
                <Icon className="size-4.5" strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
                    Staff Flight Guide
                  </span>
                  <span className="rounded-full bg-blue-500/10 px-1.5 font-mono text-[9px] font-bold text-blue-600">
                    {currentStep.id} / {TOUR_STEPS.length}
                  </span>
                </div>
                <h3 className="m-0 text-sm font-black tracking-tight text-[var(--hos-ink)]">
                  {currentStep.title}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="hos-btn-tactile rounded-full border border-[var(--hos-line)] p-1 text-[var(--hos-ink-3)] hover:text-[var(--hos-ink)]"
              aria-label="Close tour"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <p className="m-0 mt-3 text-xs leading-relaxed text-[var(--hos-ink-2)]">
            {currentStep.description}
          </p>

          <div className="mt-4 flex items-center justify-center gap-1.5">
            {TOUR_STEPS.map((s, idx) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentStepIndex
                    ? "w-6 bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.6)]"
                    : idx < currentStepIndex
                      ? "w-1.5 bg-emerald-500"
                      : "w-1.5 bg-[var(--hos-line)]"
                }`}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-[var(--hos-line)] pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={isFirst}
              className="hos-btn-tactile !h-7 gap-1 text-[11px]"
            >
              <ChevronLeft className="size-3.5" /> Back
            </Button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDismiss}
                className="text-[11px] font-semibold text-[var(--hos-ink-3)] hover:underline"
              >
                Skip
              </button>
              <Button
                size="sm"
                onClick={handleNext}
                className="hos-btn-spring !h-7 gap-1 !border-0 !bg-gradient-to-r !from-blue-600 !to-indigo-600 !px-3 text-[11px] !text-white !shadow-sm"
              >
                {isLast ? (
                  <>
                    Get Started <Check className="size-3 stroke-[3]" />
                  </>
                ) : (
                  <>
                    Next <ChevronRight className="size-3" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
