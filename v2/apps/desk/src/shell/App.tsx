import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  CalendarDays,
  CloudOff,
  Moon,
  Printer,
  Search,
  Sparkles,
  Sun,
  Zap,
} from "lucide-react";
import { NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { toast, Toaster } from "sonner";
import {
  Button,
  CommandPalette,
  CurrencyCell,
  InnoraLogo,
  KeycapBadge,
  LedBeacon,
  PageTransition,
  SIDEBAR_GROUPS,
  springButter,
  useIsPhone,
  type CommandItem,
} from "@hos-v2/ui";
import { ModuleIcon } from "./module-icons";
import {
  stayOnDate,
  useFrontOfficeStore,
} from "../lib/front-office-store";
import { useFiscalStore } from "../lib/fiscal-store";
import { useSettingsStore } from "../lib/settings-store";
import { apiGet, runCommandRaw, sessionPropertyId } from "../lib/api";
import { nightAuditReadiness } from "../lib/action-dispatcher";
import {
  flushOfflineBuffer,
  subscribeOfflineBuffer,
  type OfflineBufferSnapshot,
} from "../lib/offline-buffer";
import {
  onLiveEvent,
  startLiveSync,
  subscribeLiveSync,
  type LiveSnapshot,
} from "../lib/live-sync";
import { PinGateway } from "../modules/PinGateway";
import { HotelLoginPage } from "../modules/HotelLoginPage";
import { PortalLoginPage } from "../modules/PortalLoginPage";
import { readDeskToken } from "../lib/desk-session";
import { readHotelToken, readPortalMeta, readPortalToken } from "../lib/auth-session";
import { DeskPage } from "../modules/DeskPage";
import { StayViewPage } from "../modules/StayViewPage";
import { FastBookModal } from "../modules/FastBookModal";
import { StayHubDrawer } from "../modules/StayHubDrawer";
import { DepartmentPrintModal } from "../modules/DepartmentPrintModal";
import { ActionDispatcherModal } from "../modules/ActionDispatcherModal";
import { HotelOnboardingWizard } from "../modules/HotelOnboardingWizard";
import { InteractiveStaffTour } from "../modules/InteractiveStaffTour";
import { MobileNav } from "./MobileNav";

const SettingsPage = lazy(() =>
  import("../modules/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const HrPage = lazy(() => import("../modules/HrPage").then((m) => ({ default: m.HrPage })));
const RatesPage = lazy(() =>
  import("../modules/RatesPage").then((m) => ({ default: m.RatesPage })),
);
const RateSheetSharePage = lazy(() =>
  import("../modules/RateSheetSharePage").then((m) => ({
    default: m.RateSheetSharePage,
  })),
);
const ReservationsPage = lazy(() =>
  import("../modules/ReservationsPage").then((m) => ({ default: m.ReservationsPage })),
);
const GuestsPage = lazy(() =>
  import("../modules/GuestsPage").then((m) => ({ default: m.GuestsPage })),
);
const GroupsPage = lazy(() =>
  import("../modules/GroupsPage").then((m) => ({ default: m.GroupsPage })),
);
const NightAuditPage = lazy(() =>
  import("../modules/NightAuditPage").then((m) => ({ default: m.NightAuditPage })),
);
const PosPage = lazy(() => import("../modules/PosPage").then((m) => ({ default: m.PosPage })));
const KdsPage = lazy(() => import("../modules/KdsPage").then((m) => ({ default: m.KdsPage })));
const HousekeepingPage = lazy(() =>
  import("../modules/HousekeepingPage").then((m) => ({ default: m.HousekeepingPage })),
);
const LaundryPage = lazy(() =>
  import("../modules/LaundryPage").then((m) => ({ default: m.LaundryPage })),
);
const AgentsPage = lazy(() =>
  import("../modules/AgentsPage").then((m) => ({ default: m.AgentsPage })),
);
const PartnerPortalPage = lazy(() =>
  import("../modules/PartnerPortalPage").then((m) => ({ default: m.PartnerPortalPage })),
);
const GuideCompanionPage = lazy(() =>
  import("../modules/ecosystem/GuideCompanionPage").then((m) => ({
    default: m.GuideCompanionPage,
  })),
);
const DriverCompanionPage = lazy(() =>
  import("../modules/ecosystem/DriverCompanionPage").then((m) => ({
    default: m.DriverCompanionPage,
  })),
);
const ReportsPage = lazy(() =>
  import("../modules/ReportsPage").then((m) => ({ default: m.ReportsPage })),
);
const PurchasesPage = lazy(() =>
  import("../modules/PurchasesPage").then((m) => ({ default: m.PurchasesPage })),
);
const StockPage = lazy(() =>
  import("../modules/StockPage").then((m) => ({ default: m.StockPage })),
);
const UtilitiesPage = lazy(() =>
  import("../modules/UtilitiesPage").then((m) => ({ default: m.UtilitiesPage })),
);
const AmcPage = lazy(() => import("../modules/AmcPage").then((m) => ({ default: m.AmcPage })));
const BankReconPage = lazy(() =>
  import("../modules/BankReconPage").then((m) => ({ default: m.BankReconPage })),
);
const SuperAdminPage = lazy(() =>
  import("../modules/SuperAdminPage").then((m) => ({ default: m.SuperAdminPage })),
);
const FinancePage = lazy(() =>
  import("../modules/FinancePage").then((m) => ({ default: m.FinancePage })),
);
const CompliancePage = lazy(() =>
  import("../modules/CompliancePage").then((m) => ({ default: m.CompliancePage })),
);
const TelegramPage = lazy(() =>
  import("../modules/telegram/TelegramPage").then((m) => ({
    default: m.TelegramPage,
  })),
);
const ChannelPage = lazy(() =>
  import("../modules/ChannelPage").then((m) => ({ default: m.ChannelPage })),
);
const LoyaltyPage = lazy(() =>
  import("../modules/LoyaltyPage").then((m) => ({ default: m.LoyaltyPage })),
);
const RegistryPage = lazy(() =>
  import("../modules/RegistryPage").then((m) => ({ default: m.RegistryPage })),
);
const StaffPortalPage = lazy(() =>
  import("../modules/StaffPortalPage").then((m) => ({ default: m.StaffPortalPage })),
);
const OwnerPage = lazy(() =>
  import("../modules/OwnerPage").then((m) => ({ default: m.OwnerPage })),
);
const EventsPage = lazy(() =>
  import("../modules/EventsPage").then((m) => ({ default: m.EventsPage })),
);
const ServicesPage = lazy(() =>
  import("../modules/ServicesPage").then((m) => ({ default: m.ServicesPage })),
);
const CmsPage = lazy(() => import("../modules/CmsPage").then((m) => ({ default: m.CmsPage })));
const MarketingPage = lazy(() =>
  import("../modules/MarketingPage").then((m) => ({ default: m.MarketingPage })),
);
const InnoraAiPage = lazy(() =>
  import("../modules/InnoraAiPage").then((m) => ({ default: m.InnoraAiPage })),
);
const WebsiteNotesPage = lazy(() =>
  import("../modules/WebsiteNotesPage").then((m) => ({ default: m.WebsiteNotesPage })),
);
const FloorMapPage = lazy(() =>
  import("../modules/FloorMapPage").then((m) => ({ default: m.FloorMapPage })),
);
const PrintStudioPage = lazy(() =>
  import("../modules/PrintStudioPage").then((m) => ({ default: m.PrintStudioPage })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="hos-glass-card flex items-center gap-2 rounded-full px-4 py-2 text-xs text-[var(--hos-ink-3)]">
        <span className="hos-live-dot" data-status="connecting" aria-hidden />
        Loading module…
      </div>
    </div>
  );
}

const TITLE: Record<string, string> = {
  desk: "Desk (Today)",
  reservations: "Reservations",
  stayview: "StayView",
  groups: "Groups",
  guests: "Guests",
  telegram: "Hermes Telegram",
  "night-audit": "Night Audit",
  housekeeping: "Housekeeping",
  laundry: "Laundry",
  floormap: "Floor Map",
  pos: "POS",
  kds: "KDS",
  rates: "Rates",
  agents: "Agents",
  partner: "Partner Portal",
  guide: "Guide Marketplace",
  driver: "Fleet Marketplace",
  channel: "Channel",
  loyalty: "Loyalty",
  registry: "Guides & Fleet",
  finance: "Finance",
  purchases: "Purchases",
  stock: "Stock",
  "bank-recon": "Bank recon",
  utilities: "Utilities",
  amc: "AMC",
  compliance: "Compliance",
  hr: "HR",
  "staff-portal": "Staff Portal",
  reports: "Reports",
  owner: "Owner",
  settings: "Settings",
  superadmin: "Super-admin",
  cms: "CMS",
  marketing: "Marketing",
  "innora-ai": "Innora AI",
  services: "Services",
  events: "Events & Banquets",
  website: "Website notes",
};

/** Every sidebar module has a deep page — ModulePage stubs are retired. */
const DEEP = new Set(Object.keys(TITLE));

function navBadge(
  id: string,
  arrivalsLeft: number,
  occPct: number,
  dirty: number,
): string | null {
  if (id === "desk" && arrivalsLeft > 0) return String(arrivalsLeft);
  if (id === "stayview") return `${occPct}%`;
  if (id === "housekeeping" && dirty > 0) return String(dirty);
  return null;
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPhone = useIsPhone();
  const [railCollapsed, setRailCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 768px) and (max-width: 1023px)").matches;
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dispatcherOpen, setDispatcherOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [offlineSnap, setOfflineSnap] = useState<OfflineBufferSnapshot>({
    pending: 0,
    online: true,
    syncing: false,
    lastSyncAt: null,
    lastError: null,
  });
  const openFastBook = useFrontOfficeStore((s) => s.openFastBook);
  const hydrateFromApi = useFrontOfficeStore((s) => s.hydrateFromApi);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const stays = useFrontOfficeStore((s) => s.stays);
  const rooms = useFrontOfficeStore((s) => s.rooms);
  const deferredStays = useDeferredValue(stays);
  const deferredRooms = useDeferredValue(rooms);
  const tillBalance = useFiscalStore((s) => s.tillBalance);
  const hotelName = useSettingsStore((s) => s.hotelName);
  const hotelInitial = useSettingsStore((s) => s.hotelInitial);
  const dotStars = useSettingsStore((s) => s.dotStars);
  const [liveSnap, setLiveSnap] = useState<LiveSnapshot>({
    status: "idle",
    cursor: 0,
    lastEventAt: null,
    lastEventType: null,
    lastError: null,
    eventsReceived: 0,
    mode: "none",
  });
  const auditReady = useMemo(
    () => nightAuditReadiness(),
    [deferredStays, businessDate, deferredRooms],
  );

  const arrivalsLeft = useMemo(
    () =>
      deferredStays.filter(
        (st) =>
          st.checkIn === businessDate && ["confirmed", "held"].includes(st.status),
      ).length,
    [deferredStays, businessDate],
  );
  const dirtyCount = useMemo(
    () => deferredRooms.filter((r) => r.hkStatus === "dirty").length,
    [deferredRooms],
  );
  const occPct = useMemo(() => {
    const occTonight = deferredRooms.filter((r) =>
      deferredStays.some((s) => s.roomId === r.id && stayOnDate(s, businessDate)),
    ).length;
    return deferredRooms.length
      ? Math.round((occTonight / deferredRooms.length) * 100)
      : 0;
  }, [deferredRooms, deferredStays, businessDate]);

  const bizLabel = useMemo(() => {
    const d = new Date(`${businessDate}T12:00:00`);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    });
  }, [businessDate]);
  const [theme, setTheme] = useState<"light" | "midnight">(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem("hos_theme");
    if (saved === "midnight" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "midnight"
      : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "midnight") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("hos_theme", theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiGet<{
          ok: boolean;
          tillBalanceBtn?: number;
          error?: string;
        }>(`/v1/finance/till?propertyId=${sessionPropertyId()}`);
        if (cancelled || !res.ok || typeof res.tillBalanceBtn !== "number") {
          return;
        }
        useFiscalStore.setState({ tillBalance: res.tillBalanceBtn });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[shell] till chip using local fiscal store", { err: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "b") {
        e.preventDefault();
        openFastBook();
      }
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (meta && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setDispatcherOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openFastBook]);

  useEffect(() => {
    const unsub = subscribeOfflineBuffer(setOfflineSnap);
    const sync = () => {
      void flushOfflineBuffer(runCommandRaw).then((r) => {
        if (r.flushed > 0) {
          toast.success(`Synced ${r.flushed} offline command(s)`, {
            description: r.failed ? `${r.failed} still queued` : "Idempotent replay ok",
          });
        }
      });
    };
    window.addEventListener("online", sync);
    if (navigator.onLine) sync();
    return () => {
      unsub();
      window.removeEventListener("online", sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const run = () => {
      void hydrateFromApi().then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          console.warn("[shell] FO hydrate deferred", res.error);
          attempt += 1;
          if (attempt < 4) {
            window.setTimeout(run, 600 * attempt);
          }
          return;
        }
        if (res.merged > 0) {
          toast.message(`FO board hydrated · ${res.merged} API booking(s)`);
        }
      });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [hydrateFromApi]);

  useEffect(() => {
    const stop = startLiveSync();
    const unsubSnap = subscribeLiveSync(setLiveSnap);
    let folioHydrateTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubEvents = onLiveEvent((ev, source) => {
      if (source === "tab") return;
      const t = ev.type.toLowerCase();
      const moneyOrStay =
        t.includes("folio") ||
        t.includes("payment") ||
        t.includes("charge") ||
        t.includes("void") ||
        t.includes("check") ||
        t.includes("booking") ||
        t.includes("settle");
      if (moneyOrStay) {
        /* Debounce StayHub / desk folio refresh from outbox deltas. */
        if (folioHydrateTimer) clearTimeout(folioHydrateTimer);
        folioHydrateTimer = setTimeout(() => {
          void hydrateFromApi().then((res) => {
            if (!res.ok) {
              console.warn("[shell] live folio hydrate failed", res.error);
            }
          });
        }, 1_200);
      }
      if (t.includes("hk") || t.includes("booking.confirmed") || t.includes("audit.")) {
        toast.message(`Live · ${ev.type}`, {
          description: source.toUpperCase(),
          duration: 2200,
        });
      }
    });
    return () => {
      stop();
      unsubSnap();
      unsubEvents();
      if (folioHydrateTimer) clearTimeout(folioHydrateTimer);
    };
  }, [hydrateFromApi]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
    const sync = () => {
      if (mq.matches) setRailCollapsed(true);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /* StayView needs max rack width — collapse rail while on the tape chart. */
  useEffect(() => {
    if (location.pathname === "/stayview") {
      setRailCollapsed(true);
    }
  }, [location.pathname]);

  const commandItems = useMemo<CommandItem[]>(
    () => [
      {
        id: "desk",
        label: "Desk · Today",
        hint: "FO",
        group: "Front Office",
        onSelect: () => navigate("/desk"),
      },
      {
        id: "reservations",
        label: "Reservations",
        hint: "FO",
        group: "Front Office",
        onSelect: () => navigate("/reservations"),
      },
      {
        id: "fast-book",
        label: "Fast Book",
        hint: "⌘B",
        group: "Front Office",
        onSelect: () => openFastBook(),
      },
      {
        id: "stayview",
        label: "StayView rack",
        hint: "FO",
        group: "Front Office",
        onSelect: () => navigate("/stayview"),
      },
      {
        id: "guests",
        label: "Guests",
        group: "Front Office",
        onSelect: () => navigate("/guests"),
      },
      {
        id: "telegram",
        label: "Hermes Telegram",
        hint: "OCR",
        group: "Front Office",
        onSelect: () => navigate("/telegram"),
      },
      {
        id: "groups",
        label: "Groups",
        group: "Front Office",
        onSelect: () => navigate("/groups"),
      },
      {
        id: "night-audit",
        label: "Night Audit Cockpit",
        hint: auditReady.blockers === 0 ? "Ready" : `${auditReady.blockers} gates`,
        group: "Front Office",
        onSelect: () => navigate("/night-audit"),
      },
      {
        id: "action-dispatch",
        label: "Action Dispatcher",
        hint: "⌘J",
        group: "Front Office",
        onSelect: () => setDispatcherOpen(true),
      },
      {
        id: "compliance",
        label: "Compliance · BST-3 / Police",
        group: "Finance",
        onSelect: () => navigate("/compliance"),
      },
      {
        id: "pos",
        label: "POS Till",
        hint: "F&B",
        group: "F&B",
        onSelect: () => navigate("/pos"),
      },
      {
        id: "kds",
        label: "KDS Kitchen Pass",
        hint: "F&B",
        group: "F&B",
        onSelect: () => navigate("/kds"),
      },
      {
        id: "housekeeping",
        label: "Housekeeping",
        group: "Rooms",
        onSelect: () => navigate("/housekeeping"),
      },
      {
        id: "laundry",
        label: "Laundry",
        group: "Rooms",
        onSelect: () => navigate("/laundry"),
      },
      {
        id: "floormap",
        label: "Floor Map",
        group: "Rooms",
        onSelect: () => navigate("/floormap"),
      },
      {
        id: "print-passes",
        label: "Print Passes Studio",
        group: "Front Office",
        onSelect: () => navigate("/print"),
      },
      {
        id: "rates",
        label: "Rates",
        group: "Sales",
        onSelect: () => navigate("/rates"),
      },
      {
        id: "agents",
        label: "B2B Agents",
        group: "Sales",
        onSelect: () => navigate("/agents"),
      },
      {
        id: "partner",
        label: "Partner Portal",
        group: "Sales",
        onSelect: () => navigate("/partner"),
      },
      {
        id: "guide",
        label: "Guide Marketplace",
        hint: "Mobile",
        group: "Field",
        onSelect: () => navigate("/ecosystem/guide"),
      },
      {
        id: "driver",
        label: "Fleet Marketplace",
        hint: "Outdoor",
        group: "Field",
        onSelect: () => navigate("/ecosystem/driver"),
      },
      {
        id: "reports",
        label: "16 DRC Reports",
        group: "Finance",
        onSelect: () => navigate("/reports"),
      },
      {
        id: "purchases",
        label: "Purchases / Till",
        group: "Finance",
        onSelect: () => navigate("/purchases"),
      },
      {
        id: "stock",
        label: "Stock on-hand",
        group: "Finance",
        onSelect: () => navigate("/stock"),
      },
      {
        id: "hr",
        label: "HR",
        group: "People",
        onSelect: () => navigate("/hr"),
      },
      {
        id: "superadmin",
        label: "SuperAdmin SaaS",
        group: "Platform",
        onSelect: () => navigate("/superadmin"),
      },
      {
        id: "settings",
        label: "Settings",
        group: "Platform",
        onSelect: () => navigate("/settings"),
      },
      {
        id: "pin",
        label: "PIN Gateway",
        group: "Navigate",
        onSelect: () => navigate("/"),
      },
    ],
    [navigate, openFastBook, auditReady.blockers],
  );

  const toggleTheme = () =>
    setTheme((t) => (t === "light" ? "midnight" : "light"));

  const railWidth = railCollapsed ? 64 : 210;

  const isDeskRoute = location.pathname === "/desk";
  const isStayViewRoute = location.pathname === "/stayview";
  const isPinRoute = location.pathname === "/" || location.pathname === "/pin";
  const isLoginRoute = location.pathname.startsWith("/login/");
  const isShareRoute = location.pathname.startsWith("/rates/share/");
  const isFieldPortalRoute =
    location.pathname === "/partner" ||
    location.pathname === "/guide" ||
    location.pathname === "/driver" ||
    location.pathname === "/ecosystem/guide" ||
    location.pathname === "/ecosystem/driver";
  /** PIN, logins, rate share, and field portals — no desk rail / till / FO dock. */
  const isChromeLess =
    isPinRoute || isLoginRoute || isShareRoute || isFieldPortalRoute;
  /* StayView rack is zero-scroll on all viewports; Desk cockpit desktop-only */
  const isZeroScrollRoute =
    isPinRoute || isStayViewRoute || (isDeskRoute && !isPhone);

  return (
    <div
      className={[
        /* Transparent so GlassShell StillWaterSurface L0 shows through gaps */
        "grid h-screen overflow-hidden bg-transparent",
        isChromeLess ? "grid-rows-[1fr]" : "grid-rows-[46px_1fr]",
      ].join(" ")}
    >
        {isChromeLess ? null : (
        <header
          data-tour="header"
          className="hos-surface-glass z-10 flex h-[46px] shrink-0 items-center px-3"
        >
          {/* Phone sticky top bar */}
          <div className="flex w-full items-center gap-2 md:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <InnoraLogo size="sm" variant="sovereign" showText={false} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <strong className="truncate text-[14px] font-bold tracking-tight text-[var(--hos-ink)]">
                    {hotelName}
                  </strong>
                  <span className="shrink-0 font-mono text-[10px] font-bold tracking-tight text-[var(--hos-brass)]">
                    {"★".repeat(Math.max(1, Math.min(5, dotStars)))}
                  </span>
                </div>
                <p className="m-0 truncate font-mono text-[10px] tabular-nums text-[var(--hos-ink-3)]">
                  {bizLabel} · live desk
                </p>
              </div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <div
                className="hos-glass-card flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px]"
                data-glow="emerald"
              >
                <LedBeacon tone="emerald" />
                <CurrencyCell
                  amount={tillBalance}
                  showCents
                  className="text-[11px] text-[var(--hos-ink)]"
                />
              </div>
              <button
                type="button"
                className="hos-btn-tactile inline-flex size-10 items-center justify-center rounded-xl border border-[var(--hos-glass-border)] bg-[var(--hos-surface)]"
                onClick={() => setPaletteOpen(true)}
                aria-label="Search"
              >
                <Search className="size-4" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="hos-btn-tactile flex size-10 items-center justify-center rounded-full border border-[var(--hos-glass-border)] bg-[var(--hos-surface)]"
                title="Switch Staff PIN"
                aria-label="Cashier"
              >
                <span className="hos-btn-primary flex size-7 items-center justify-center rounded-full text-[10px] font-semibold text-white">
                  KD
                </span>
              </button>
            </div>
          </div>

          {/* Tablet / desktop chrome */}
          <div className="hidden w-full items-center gap-2 md:flex">
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="hos-btn-tactile !h-8 !min-h-8 !px-2"
                aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={() => setRailCollapsed((v) => !v)}
              >
                {railCollapsed ? "»" : "«"}
              </Button>
              <button
                type="button"
                className="hos-btn-tactile flex items-center gap-2.5 rounded-lg text-left"
                onClick={() => setPrintOpen(true)}
                title="innorahotel.com · Sovereign Desk"
                aria-label="innorahotel.com · Sovereign Desk"
              >
                <InnoraLogo size="sm" variant="sovereign" showText={false} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <strong className="truncate text-[14px] font-bold tracking-tight text-[var(--hos-ink)]">
                      {hotelName}
                    </strong>
                    <span className="font-mono text-[10px] tracking-tight text-[var(--hos-brass)]">
                      {"★".repeat(Math.max(1, Math.min(5, dotStars)))}
                    </span>
                  </div>
                  <p className="m-0 hidden truncate text-[10px] text-[var(--hos-ink-3)] lg:block font-mono">
                    {hotelInitial || "PS"} · desk.innorahotel.com
                  </p>
                </div>
              </button>
            </div>

            <button
              type="button"
              data-tour="search"
              onClick={() => setPaletteOpen(true)}
              className="no-print mx-auto flex w-full max-w-[320px] flex-1 items-center gap-2 rounded-full border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3.5 py-2 text-left text-[13px] text-[var(--hos-ink-3)] shadow-[var(--hos-card-shadow)] transition-[box-shadow,border-color] hover:border-[color-mix(in_srgb,var(--hos-primary)_35%,var(--hos-line))] hover:shadow-[var(--hos-elevated-shadow)]"
            >
              <Search className="size-3 shrink-0 text-[var(--hos-primary)]" strokeWidth={1.75} />
              <span className="truncate">Search reservation, guest, room #</span>
              <KeycapBadge keys="⌘K" className="ml-auto" />
            </button>

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <span className="hos-glass-card hidden items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-[var(--hos-ink-2)] lg:inline-flex">
                <CalendarDays className="size-3 text-[var(--hos-primary)]" strokeWidth={1.75} />
                <span className="font-mono tabular-nums tracking-tight">{bizLabel}</span>
                <span className="text-[var(--hos-ink-3)]">· S1</span>
              </span>

              <button
                type="button"
                onClick={() => navigate("/night-audit")}
                className={[
                  "hidden items-center gap-1.5 rounded-full border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-1.5 text-[11px] font-medium text-[var(--hos-ink-2)] md:inline-flex",
                  auditReady.blockers > 0 && auditReady.score < 50
                    ? "!border-[color-mix(in_srgb,var(--hos-ruby)_40%,transparent)] !text-[var(--hos-ruby)]"
                    : "",
                ].join(" ")}
                title="Night audit readiness"
              >
                <span className="hidden lg:inline">Audit</span>
                <span className="font-mono font-semibold tabular-nums text-[var(--hos-ink)]">
                  {auditReady.score}%
                </span>
              </button>

              {offlineSnap.pending > 0 || !offlineSnap.online ? (
                <button
                  type="button"
                  onClick={() => {
                    void flushOfflineBuffer(runCommandRaw).then((r) => {
                      toast.message(
                        r.flushed
                          ? `Flushed ${r.flushed}`
                          : offlineSnap.online
                            ? "Queue idle"
                            : "Still offline",
                        {
                          description: `${offlineSnap.pending} pending · idempotent replay`,
                        },
                      );
                    });
                  }}
                  className="hos-glass-card inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-[var(--hos-brass-ink)]"
                  title="Offline command buffer"
                >
                  <CloudOff className="size-3" strokeWidth={2} />
                  <span className="font-mono tabular-nums">
                    {offlineSnap.syncing ? "…" : offlineSnap.pending}
                  </span>
                </button>
              ) : null}

              <div
                className="hos-glass-card flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px]"
                data-glow={
                  liveSnap.status === "live"
                    ? "emerald"
                    : liveSnap.status === "offline"
                      ? "ruby"
                      : "amber"
                }
                title={
                  liveSnap.lastError
                    ? `Live sync · ${liveSnap.lastError}`
                    : `Live sync · ${liveSnap.mode} · cursor ${liveSnap.cursor}`
                }
              >
                <LedBeacon
                  tone={
                    liveSnap.status === "live"
                      ? "emerald"
                      : liveSnap.status === "offline"
                        ? "ruby"
                        : "brass"
                  }
                  pulse={liveSnap.status !== "offline"}
                />
                <span className="hidden font-medium text-[var(--hos-ink-3)] lg:inline">
                  {liveSnap.status === "live"
                    ? "Live"
                    : liveSnap.status === "poll"
                      ? "Poll"
                      : liveSnap.status === "connecting"
                        ? "Sync"
                        : liveSnap.status === "offline"
                          ? "Offline"
                          : "Till"}
                </span>
                <CurrencyCell
                  amount={tillBalance}
                  showCents
                  className="text-[11px] text-[var(--hos-ink)]"
                />
              </div>

              <button
                type="button"
                className="hos-btn-tactile no-print hidden size-8 items-center justify-center rounded-lg border border-[var(--hos-glass-border)] bg-[var(--hos-surface)] sm:inline-flex"
                onClick={() => setDispatcherOpen(true)}
                aria-label="Action dispatcher"
                title="Action Dispatcher ⌘J"
              >
                <Sparkles className="size-3.5" strokeWidth={1.75} />
              </button>

              <button
                type="button"
                className="hos-btn-tactile no-print inline-flex size-8 items-center justify-center rounded-lg border border-[var(--hos-glass-border)] bg-[var(--hos-surface)]"
                onClick={() => setPrintOpen(true)}
                aria-label="Print passes"
              >
                <Printer className="size-3.5" strokeWidth={1.75} />
              </button>

              <Button
                size="sm"
                magnetic
                data-tour="fast-book"
                onClick={() => openFastBook()}
                aria-label="Fast Book"
                className="hos-btn-gemini hos-btn-spring !h-9 !min-h-9 gap-1.5 !rounded-full !px-4 text-[13px] font-medium"
              >
                <Zap className="size-3.5 lg:hidden" strokeWidth={2} />
                <span className="hidden lg:inline">Fast Book</span>
                <KeycapBadge
                  keys="⌘B"
                  className="hidden border-white/25 bg-white/12 text-white lg:inline"
                />
              </Button>

              <button
                type="button"
                onClick={toggleTheme}
                className={`hos-btn-tactile inline-flex size-8 items-center justify-center rounded-full border transition ${
                  theme === "midnight"
                    ? "border-[color-mix(in_srgb,var(--hos-brass)_40%,transparent)] bg-[color-mix(in_srgb,var(--hos-brass)_14%,var(--hos-surface))] text-[var(--hos-brass-ink)] shadow-[0_0_20px_-8px_rgba(232,196,122,0.55)]"
                    : "border-[var(--hos-glass-border)] bg-[var(--hos-surface)] text-[var(--hos-primary)]"
                }`}
                title={theme === "light" ? "Premium midnight" : "Light desk"}
                aria-label={theme === "light" ? "Switch to midnight theme" : "Switch to light theme"}
              >
                {theme === "light" ? (
                  <Moon className="size-3.5" strokeWidth={1.75} />
                ) : (
                  <Sun className="size-3.5" strokeWidth={1.75} />
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate("/")}
                className="hos-btn-tactile flex items-center gap-1 rounded-full border border-[var(--hos-glass-border)] bg-[var(--hos-surface)] py-0.5 pl-0.5 pr-1.5 text-[10px] font-semibold text-[var(--hos-ink-2)]"
                title="Switch Staff PIN"
              >
                <span className="hos-btn-primary flex size-5 items-center justify-center rounded-full text-[9px] font-bold text-white">
                  KD
                </span>
                <span className="hidden lg:inline">Karma</span>
              </button>
            </div>
          </div>
        </header>
        )}

        <div className="flex min-h-0 min-w-0 overflow-hidden">
          {isChromeLess ? null : (
          <nav
            style={{ width: railWidth }}
            className="hos-glass hos-scrollbar-slim hidden h-full shrink-0 overflow-y-auto border-b-0 border-l-0 border-t-0 p-2 md:flex md:flex-col"
            aria-label="Desk modules"
          >
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                [
                  "relative mb-1 flex items-center gap-2.5 rounded-full px-3 py-2 text-[13px] transition-colors",
                  isActive
                    ? "font-medium text-[var(--hos-primary-on-container)]"
                    : "font-medium text-[var(--hos-ink-2)] hover:bg-[color-mix(in_srgb,var(--hos-primary)_8%,transparent)]",
                ].join(" ")
              }
            >
              {location.pathname === "/" ? (
                <motion.span
                  layoutId="activeNavPill"
                  className="absolute inset-0 rounded-full bg-[var(--hos-primary-container)]"
                  transition={springButter}
                />
              ) : null}
              <span className="relative z-10">
                <ModuleIcon id="pin" className="size-3.5" />
              </span>
              <span className="relative z-10">{railCollapsed ? "PIN" : "PIN Gateway"}</span>
            </NavLink>
            {SIDEBAR_GROUPS.map((g) => (
              <div key={g.id} className="mb-1">
                {!railCollapsed ? (
                  <h3 className="hos-rail-section" data-tone={g.tone}>
                    {g.label}
                  </h3>
                ) : (
                  <div
                    className="mx-auto mb-1 mt-2 h-0.5 w-5 rounded-full opacity-70"
                    style={{
                      background:
                        g.tone === "sapphire"
                          ? "var(--hos-primary)"
                          : g.tone === "emerald"
                            ? "var(--hos-emerald)"
                            : g.tone === "brass"
                              ? "var(--hos-brass)"
                              : g.tone === "ruby"
                                ? "var(--hos-ruby)"
                                : g.tone === "teal"
                                  ? "var(--hos-teal)"
                                  : "var(--hos-ink-3)",
                    }}
                    aria-hidden
                  />
                )}
                {g.items.map((id) => {
                  const path =
                    id === "guide"
                      ? "/ecosystem/guide"
                      : id === "driver"
                        ? "/ecosystem/driver"
                        : `/${id}`;
                  const active =
                    location.pathname === path ||
                    (id === "guide" && location.pathname === "/guide") ||
                    (id === "driver" && location.pathname === "/driver");
                  const badge = navBadge(id, arrivalsLeft, occPct, dirtyCount);
                  return (
                    <NavLink
                      key={id}
                      to={path}
                      end
                      title={TITLE[id] ?? id}
                      className={({ isActive }) =>
                        [
                          "relative mb-0.5 flex items-center gap-2.5 truncate rounded-full px-3 py-2 text-[13px] transition-colors",
                          isActive || active
                            ? "font-medium text-[var(--hos-primary-on-container)]"
                            : "font-medium text-[var(--hos-ink-2)] hover:bg-[color-mix(in_srgb,var(--hos-primary)_7%,transparent)] hover:text-[var(--hos-ink)]",
                        ].join(" ")
                      }
                    >
                      {active ? (
                        <motion.span
                          layoutId="activeNavPill"
                          className="absolute inset-0 rounded-full bg-[var(--hos-primary-container)]"
                          transition={springButter}
                        />
                      ) : null}
                      <span
                        className={[
                          "relative z-10 shrink-0",
                          active ? "text-[var(--hos-primary)]" : "",
                        ].join(" ")}
                      >
                        <ModuleIcon id={id} className="size-3.5" />
                      </span>
                      {!railCollapsed ? (
                        <span className="relative z-10 min-w-0 flex-1 truncate">
                          {TITLE[id] ?? id}
                          {!DEEP.has(id) ? " ·" : ""}
                        </span>
                      ) : null}
                      {badge && !railCollapsed ? (
                        <span className="relative z-10 ml-auto rounded-full bg-[color-mix(in_srgb,var(--hos-primary)_16%,transparent)] px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-[var(--hos-primary)]">
                          {badge}
                        </span>
                      ) : null}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>
          )}

          <main
            className={[
              "desk-main min-h-0 min-w-0 flex-1",
              isChromeLess
                ? "p-0"
                : isStayViewRoute
                  /* Edge-to-edge rack on phone; dock clearance matches glass-dock height once */
                  ? "px-0 pt-0 pb-[calc(var(--mobile-dock-height)+env(safe-area-inset-bottom,0px))] md:p-2"
                  /* Symmetric gutters; md+ has no dock so drop the dock clearance */
                  : "px-3 pt-3 pb-[calc(var(--mobile-dock-height)+env(safe-area-inset-bottom,0px))] md:p-3",
              /* Non–zero-scroll modules need both axes (wide ledgers / mobile) */
              isZeroScrollRoute
                ? "flex flex-col overflow-hidden"
                : "hos-scrollbar-slim overflow-auto",
            ].join(" ")}
          >
            <PageTransition
              routeKey={location.pathname}
              className={isZeroScrollRoute ? "flex min-h-0 flex-1 flex-col" : "min-h-0"}
            >
              <Suspense fallback={<RouteFallback />}>
                <AppRoutes location={location} />
              </Suspense>
            </PageTransition>
          </main>
        </div>

        {/* Floating quick dock retired — iOS Clear uses nav bar + phone tab bar */}
        {isChromeLess ? null : (
          <MobileNav moreOpen={moreOpen} onMoreOpenChange={setMoreOpen} />
        )}
        <FastBookModal />
        <StayHubDrawer />
        <DepartmentPrintModal open={printOpen} onClose={() => setPrintOpen(false)} />
        <HotelOnboardingWizard />
        <InteractiveStaffTour />

        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          items={commandItems}
          placeholder="Jump to module or Fast Book…"
        />
        <ActionDispatcherModal
          open={dispatcherOpen}
          onOpenChange={setDispatcherOpen}
        />
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "hos-glass !bg-[var(--hos-surface-2)] !text-[var(--hos-ink)]",
          }}
        />
    </div>
  );
}

function AuthEntry() {
  if (readDeskToken()) return <Navigate to="/desk" replace />;
  if (readHotelToken()) return <Navigate to="/pin" replace />;
  if (readPortalToken()) {
    const meta = readPortalMeta();
    return <Navigate to={meta?.homeRoute || "/partner"} replace />;
  }
  return <Navigate to="/login/hotel" replace />;
}

function RequireStaffSession({ children }: { children?: React.ReactNode }) {
  if (!readDeskToken()) {
    if (readHotelToken()) return <Navigate to="/pin" replace />;
    return <Navigate to="/login/hotel" replace />;
  }
  return children ? <>{children}</> : <Outlet />;
}

function RequirePortalSession({
  role,
  children,
}: {
  role: "agent" | "guide" | "driver";
  children: React.ReactNode;
}) {
  const token = readPortalToken();
  const meta = readPortalMeta();
  if (!token || meta?.role !== role) {
    return <Navigate to={`/login/${role}`} replace />;
  }
  return <>{children}</>;
}

function AppRoutes({ location }: { location: ReturnType<typeof useLocation> }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<AuthEntry />} />
      <Route path="/login/hotel" element={<HotelLoginPage />} />
      <Route path="/login/:role" element={<PortalLoginPage />} />
      <Route path="/pin" element={<PinGateway />} />
      <Route path="/rates/share/:token" element={<RateSheetSharePage />} />
      <Route element={<RequireStaffSession />}>
      <Route path="/desk" element={<DeskPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/hr" element={<HrPage />} />
      <Route path="/rates" element={<RatesPage />} />
      <Route path="/reservations" element={<ReservationsPage />} />
      <Route path="/stayview" element={<StayViewPage />} />
      <Route path="/guests" element={<GuestsPage />} />
      <Route path="/telegram" element={<TelegramPage />} />
      <Route path="/groups" element={<GroupsPage />} />
      <Route path="/night-audit" element={<NightAuditPage />} />
      <Route path="/pos" element={<PosPage />} />
      <Route path="/kds" element={<KdsPage />} />
      <Route path="/housekeeping" element={<HousekeepingPage />} />
      <Route path="/laundry" element={<LaundryPage />} />
      <Route path="/floormap" element={<FloorMapPage />} />
      <Route path="/agents" element={<AgentsPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/purchases" element={<PurchasesPage />} />
      <Route path="/stock" element={<StockPage />} />
      <Route path="/bank-recon" element={<BankReconPage />} />
      <Route path="/utilities" element={<UtilitiesPage />} />
      <Route path="/amc" element={<AmcPage />} />
      <Route path="/superadmin" element={<SuperAdminPage />} />
      <Route path="/finance" element={<FinancePage />} />
      <Route path="/compliance" element={<CompliancePage />} />
      <Route path="/channel" element={<ChannelPage />} />
      <Route path="/loyalty" element={<LoyaltyPage />} />
      <Route path="/registry" element={<RegistryPage />} />
      <Route path="/staff-portal" element={<StaffPortalPage />} />
      <Route path="/owner" element={<OwnerPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/cms" element={<CmsPage />} />
      <Route path="/marketing" element={<MarketingPage />} />
      <Route path="/innora-ai" element={<InnoraAiPage />} />
      <Route path="/website" element={<WebsiteNotesPage />} />
      <Route path="/print" element={<PrintStudioPage />} />
      <Route path="/print/:pass" element={<PrintStudioPage />} />
      </Route>
      <Route
        path="/partner"
        element={
          <RequirePortalSession role="agent">
            <PartnerPortalPage />
          </RequirePortalSession>
        }
      />
      <Route
        path="/ecosystem/guide"
        element={
          <RequirePortalSession role="guide">
            <GuideCompanionPage />
          </RequirePortalSession>
        }
      />
      <Route
        path="/ecosystem/driver"
        element={
          <RequirePortalSession role="driver">
            <DriverCompanionPage />
          </RequirePortalSession>
        }
      />
      <Route
        path="/guide"
        element={
          <RequirePortalSession role="guide">
            <GuideCompanionPage />
          </RequirePortalSession>
        }
      />
      <Route
        path="/driver"
        element={
          <RequirePortalSession role="driver">
            <DriverCompanionPage />
          </RequirePortalSession>
        }
      />
    </Routes>
  );
}
