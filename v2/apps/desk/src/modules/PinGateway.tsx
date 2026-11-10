import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  clearHotelGate,
  clearPortalSession,
  readHotelProperty,
  readHotelToken,
  writeHotelGate,
} from "../lib/auth-session";
import { clearDeskSession } from "../lib/desk-session";
import {
  Badge,
  Button,
  easeVolary,
  InnorahotelLogo,
  springLayout,
  springSnappy,
  useIsPhone,
  useIsTablet,
  useMediaQuery,
} from "@hos-v2/ui";
import {
  Cloud,
  CloudRain,
  CloudSnow,
  Delete,
  Fingerprint,
  Lock,
  LogOut,
  MapPin,
  ShieldCheck,
  Sparkles,
  Sun,
  Zap,
} from "lucide-react";
import { useSettingsStore } from "../lib/settings-store";
import {
  FIELD_DEMO_HINTS,
  useFieldPortalAuth,
  type FieldPortalRole,
} from "../lib/field-portal-auth";
import {
  DZONGKHAG_COORDS,
  fetchPinWeather,
  weatherTone,
  type PinWeatherSnapshot,
} from "../lib/pin-weather";
import {
  fetchAuthProperties,
  fetchAuthStaff,
  switchHotelProperty,
  verifyStaffPin,
  type AuthProperty,
  type AuthStaff,
} from "../lib/pin-auth-api";
import { writeDeskSession } from "../lib/desk-session";

type StaffPreset = {
  id: string;
  name: string;
  role: string;
  badge: string;
  pin?: string;
  route: string;
  initials: string;
  accent: string;
  live?: boolean;
  pinResetRequired?: boolean;
};

const FIELD_STAFF: StaffPreset[] = [
  {
    id: "guide",
    name: "Tour Guide",
    role: "Field · Guide",
    badge: "GD",
    pin: "4455",
    route: "/guide",
    initials: "GD",
    accent: "#0d9488",
  },
  {
    id: "driver",
    name: "Fleet Driver",
    role: "Field · Driver",
    badge: "DR",
    pin: "5566",
    route: "/driver",
    initials: "DR",
    accent: "#f59e0b",
  },
  {
    id: "partner",
    name: "Yangphel Partner",
    role: "B2B Agency",
    badge: "AG",
    pin: "1111",
    route: "/partner",
    initials: "YP",
    accent: "#0284c7",
  },
];

/** Demo presets kept only when API has no login-enabled staff (local UI work). */
const DEMO_STAFF: StaffPreset[] = [
  {
    id: "karma",
    name: "Karma Dorji",
    role: "Front Desk Lead",
    badge: "FO",
    pin: "1234",
    route: "/desk",
    initials: "KD",
    accent: "#2563eb",
  },
  {
    id: "deki",
    name: "Deki Yangzom",
    role: "F&B Cashier",
    badge: "POS",
    pin: "2345",
    route: "/pos",
    initials: "DY",
    accent: "#10b981",
  },
  {
    id: "tshering",
    name: "Tshering Tobgay",
    role: "Housekeeping",
    badge: "HK",
    pin: "3456",
    route: "/housekeeping",
    initials: "TT",
    accent: "#f59e0b",
  },
  {
    id: "ugyen",
    name: "Ugyen Penjor",
    role: "Night Auditor",
    badge: "NA",
    pin: "4567",
    route: "/night-audit",
    initials: "UP",
    accent: "#6366f1",
  },
  {
    id: "tenzin",
    name: "Tenzin Norbu",
    role: "General Manager",
    badge: "GM",
    pin: "9999",
    route: "/owner",
    initials: "TN",
    accent: "#111111",
  },
];

const ROLE_ACCENTS = ["#2563eb", "#10b981", "#f59e0b", "#6366f1", "#111111", "#0d9488", "#0284c7"];

function staffFromApi(row: AuthStaff, index: number): StaffPreset {
  const initials = row.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "ST";
  const role = row.deskRole || "Staff";
  const badge = (role.replace(/_/g, " ").split(/\s+/)[0] ?? "ST").slice(0, 3).toUpperCase();
  return {
    id: row.id,
    name: row.fullName,
    role,
    badge,
    route: row.homeRoute || "/desk",
    initials,
    accent: ROLE_ACCENTS[index % ROLE_ACCENTS.length]!,
    live: true,
    pinResetRequired: row.pinResetRequired || !row.pinSet,
  };
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"] as const;

function greetingForHour(h: number): string {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function WeatherGlyph({
  code,
  className,
}: {
  code: number;
  className?: string;
}) {
  const tone = weatherTone(code);
  const cls = className ?? "size-4";
  if (tone === "sun") return <Sun className={cls} strokeWidth={2} />;
  if (tone === "rain") return <CloudRain className={cls} strokeWidth={2} />;
  if (tone === "snow") return <CloudSnow className={cls} strokeWidth={2} />;
  if (tone === "storm") return <Zap className={cls} strokeWidth={2} />;
  return <Cloud className={cls} strokeWidth={2} />;
}

function PinPlaceWeather({
  compact,
  hotelName,
  dzongkhag,
  weather,
  loading,
}: {
  compact?: boolean;
  hotelName: string;
  dzongkhag: string;
  weather: PinWeatherSnapshot | null;
  loading: boolean;
}) {
  const place = DZONGKHAG_COORDS[dzongkhag as keyof typeof DZONGKHAG_COORDS];
  const locLabel = place?.label ?? dzongkhag;

  if (compact) {
    return (
      <div
        className="hos-glass-card flex items-center gap-2 rounded-[14px] px-2.5 py-1.5 shadow-[var(--hos-shadow-volaro)]"
        aria-live="polite"
      >
        <MapPin
          className="size-3.5 shrink-0 text-[var(--hos-primary)]"
          strokeWidth={2}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] font-bold tracking-tight text-[var(--hos-ink)]">
            {locLabel}
            <span className="font-semibold text-[var(--hos-ink-3)]"> · Bhutan</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 font-mono text-[12px] font-black tabular-nums text-[var(--hos-ink)]">
          {weather ? (
            <>
              <WeatherGlyph
                code={weather.code}
                className="size-3.5 text-[var(--hos-gold)]"
              />
              {weather.tempC}°
            </>
          ) : (
            <span className="text-[10px] font-semibold text-[var(--hos-ink-3)]">
              {loading ? "…" : "—"}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="hos-glass-card flex items-stretch gap-3 rounded-[16px] px-3 py-2.5 shadow-[var(--hos-shadow-volaro)]"
      aria-live="polite"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <span
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[11px] bg-[rgba(37,99,235,0.12)] text-[var(--hos-primary)]"
          aria-hidden
        >
          <MapPin className="size-3.5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[12px] font-black tracking-tight text-[var(--hos-ink)]">
            {hotelName}
          </div>
          <div className="mt-0.5 truncate text-[10px] font-semibold text-[var(--hos-ink-3)]">
            {locLabel}, Bhutan
            {place ? (
              <span className="ml-1 font-mono text-[9px] tabular-nums opacity-80">
                {place.lat.toFixed(2)}°N · {Math.abs(place.lon).toFixed(2)}°E
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-center border-l border-[var(--hos-line)] pl-3">
        {weather ? (
          <>
            <div className="flex items-center gap-1.5">
              <WeatherGlyph
                code={weather.code}
                className="size-4 text-[var(--hos-gold)]"
              />
              <span className="font-mono text-[1.15rem] font-black tabular-nums leading-none text-[var(--hos-ink)]">
                {weather.tempC}°
              </span>
            </div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
              {weather.label}
              <span className="mx-1 opacity-40">·</span>
              feels {weather.feelsC}°
            </div>
            <div className="mt-0.5 text-[9px] font-semibold tabular-nums text-[var(--hos-ink-3)]">
              RH {weather.humidity}% · wind {weather.windKmh} km/h
            </div>
          </>
        ) : (
          <div className="text-[11px] font-semibold text-[var(--hos-ink-3)]">
            {loading ? "Reading sky…" : "Weather offline"}
          </div>
        )}
      </div>
    </div>
  );
}

function setPointerVars(el: HTMLElement, e: ReactMouseEvent) {
  const rect = el.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
  const y = ((e.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
  el.style.setProperty("--hos-mx", `${x.toFixed(1)}%`);
  el.style.setProperty("--hos-my", `${y.toFixed(1)}%`);
}

function PinDots({
  digits,
  shake,
  reduce,
  premium,
}: {
  digits: string;
  shake: boolean;
  reduce: boolean | null;
  premium?: boolean;
}) {
  return (
    <motion.div
      className={["flex justify-center", premium ? "gap-4" : "gap-3 sm:gap-3.5"].join(" ")}
      animate={shake ? { x: [-10, 10, -7, 7, -3, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      aria-label={`${digits.length} of 4 digits entered`}
    >
      {[0, 1, 2, 3].map((i) => {
        const filled = digits.length > i;
        return (
          <motion.span
            key={i}
            className={
              premium
                ? "hos-pin-dot"
                : [
                    "size-3.5 rounded-full border-2 sm:size-4",
                    filled
                      ? "border-[#111] bg-[#111] shadow-[0_0_0_4px_rgba(17,17,17,0.08)]"
                      : "border-[var(--hos-line)] bg-transparent",
                    shake && filled ? "!border-[var(--hos-ruby)] !bg-[var(--hos-ruby)]" : "",
                  ].join(" ")
            }
            data-filled={premium && filled ? "true" : undefined}
            data-error={premium && shake && filled ? "true" : undefined}
            animate={filled && !reduce ? { scale: [1, 1.28, 1] } : { scale: 1 }}
            transition={springSnappy}
          />
        );
      })}
    </motion.div>
  );
}

function Keypad({
  unlocking,
  accent,
  reduce,
  onKey,
  compact,
  premium,
}: {
  unlocking: boolean;
  accent: string;
  reduce: boolean | null;
  onKey: (key: (typeof KEYS)[number]) => void;
  compact?: boolean;
  /** Round tactile keys for phone vault. */
  premium?: boolean;
}) {
  return (
    <div
      className={
        premium
          ? "hos-pin-keypad"
          : ["grid grid-cols-3", compact ? "gap-2" : "gap-2.5"].join(" ")
      }
      style={{ "--hos-hover-accent": accent } as CSSProperties}
    >
      {KEYS.map((key) => {
        const isAction = key === "C" || key === "⌫";
        return (
          <motion.button
            key={key}
            type="button"
            disabled={unlocking}
            whileHover={reduce || premium ? undefined : { y: -1 }}
            whileTap={reduce ? undefined : { scale: 0.92 }}
            transition={springSnappy}
            onClick={() => onKey(key)}
            onMouseMove={(e) => setPointerVars(e.currentTarget, e)}
            data-action={isAction ? "true" : undefined}
            className={[
              "hos-interactive hos-btn-tactile flex items-center justify-center font-bold tabular-nums tracking-tight touch-manipulation",
              premium
                ? "hos-pin-key text-[var(--hos-ink)]"
                : compact
                  ? "min-h-12 rounded-[14px] text-[18px]"
                  : "min-h-14 rounded-[16px] text-[20px] md:min-h-16",
              premium
                ? isAction
                  ? "border border-[var(--hos-line)] text-[var(--hos-ink-2)]"
                  : "border border-[var(--hos-line)] bg-[var(--hos-cell)]"
                : isAction
                  ? "border border-[var(--hos-line)] bg-[rgba(15,23,42,0.04)] text-[var(--hos-ink-2)]"
                  : "border border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink)] shadow-[var(--hos-shadow-volaro)]",
            ].join(" ")}
            aria-label={
              key === "⌫" ? "Delete" : key === "C" ? "Clear" : `Digit ${key}`
            }
          >
            {key === "⌫" ? (
              <Delete
                className={premium ? "size-[1.15em]" : "size-5"}
                strokeWidth={1.75}
              />
            ) : (
              key
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

function UnlockBlock({
  unlocking,
  digits,
  onUnlock,
}: {
  unlocking: boolean;
  digits: string;
  onUnlock: () => void;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={unlocking ? "go" : digits.length > 0 ? "enter" : "idle"}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
      >
        {unlocking ? (
          <div className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#111] px-4 py-3 text-[13px] font-semibold text-white">
            <ShieldCheck className="size-4" strokeWidth={2} />
            Unlocking…
          </div>
        ) : (
          <Button
            magnetic
            disabled={digits.length < 4}
            className="hos-btn-ink hos-btn-spring !h-12 w-full !rounded-full text-[14px] disabled:!bg-[var(--hos-ink-3)]"
            onClick={onUnlock}
          >
            Unlock desk
          </Button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function IdentityHero({
  staff,
  align = "center",
}: {
  staff: StaffPreset;
  align?: "center" | "left";
}) {
  return (
    <div
      className={[
        "flex gap-3",
        align === "center" ? "flex-col items-center text-center" : "items-center text-left",
      ].join(" ")}
    >
      <span
        className={[
          "hos-interactive flex shrink-0 items-center justify-center rounded-[16px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.4)]",
          align === "center" ? "size-14 text-[15px]" : "size-12 text-[13px]",
        ].join(" ")}
        style={{
          background: `linear-gradient(145deg, ${staff.accent}, #111)`,
          ["--hos-hover-accent" as string]: staff.accent,
        }}
      >
        {staff.initials}
      </span>
      <div className="min-w-0">
        <div
          className={[
            "font-bold tracking-tight text-[var(--hos-ink)]",
            align === "center" ? "text-[18px]" : "truncate text-[15px]",
          ].join(" ")}
        >
          {staff.name}
        </div>
        <div
          className={[
            "text-[var(--hos-ink-3)]",
            align === "center" ? "text-[12px]" : "truncate text-[12px]",
          ].join(" ")}
        >
          {staff.role} · {staff.badge}
        </div>
      </div>
    </div>
  );
}

function StaffPicker({
  staff,
  selectedId,
  onSelect,
  mode,
  reduce,
}: {
  staff: StaffPreset[];
  selectedId: string;
  onSelect: (id: string) => void;
  mode: "avatars" | "list" | "grid";
  reduce: boolean | null;
}) {
  if (mode === "avatars") {
    return (
      <ul
        className="hos-scrollbar-slim m-0 -mx-1 flex list-none gap-2.5 overflow-x-auto px-1 pb-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="listbox"
        aria-label="Staff"
      >
        {staff.map((s) => {
          const active = s.id === selectedId;
          return (
            <li key={s.id} className="snap-center shrink-0 first:ml-1 last:mr-1">
              <motion.button
                type="button"
                role="option"
                aria-selected={active}
                aria-label={s.name}
                data-testid={`pin-staff-${s.id}`}
                data-active={active ? "true" : undefined}
                whileTap={reduce ? undefined : { scale: 0.94 }}
                onClick={() => onSelect(s.id)}
                className="hos-interactive hos-pin-staff-chip hos-btn-tactile relative flex flex-col items-center gap-1.5"
                style={{ "--hos-hover-accent": s.accent } as CSSProperties}
              >
                {active && !reduce ? (
                  <motion.span
                    layoutId="pinMobileStaffGlow"
                    className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-white/25"
                    transition={springLayout}
                  />
                ) : null}
                <span
                  className={[
                    "hos-pin-staff-avatar relative z-10 flex items-center justify-center font-black text-white",
                    active
                      ? "shadow-[0_10px_24px_-10px_rgba(0,0,0,0.55)]"
                      : "shadow-[0_8px_18px_-12px_rgba(0,0,0,0.35)]",
                  ].join(" ")}
                  style={{
                    background: `linear-gradient(145deg, ${s.accent} 0%, #111 100%)`,
                  }}
                >
                  {s.initials}
                </span>
                <span className="relative z-10 max-w-[4.5rem] truncate text-[10px] font-bold tracking-tight sm:text-[11px]">
                  {s.name.split(" ")[0]}
                </span>
                <span
                  className={[
                    "relative z-10 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em]",
                    active ? "bg-white/15 text-white/80" : "bg-[rgba(17,17,17,0.06)] text-[var(--hos-ink-3)]",
                  ].join(" ")}
                >
                  {s.badge}
                </span>
              </motion.button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul
      className={
        mode === "grid"
          ? "m-0 grid list-none grid-cols-1 gap-1.5 p-0 sm:grid-cols-2"
          : "hos-scrollbar-slim m-0 flex min-h-0 list-none flex-col gap-1.5 overflow-y-auto p-0"
      }
      role="listbox"
      aria-label="Staff"
    >
      {staff.map((s) => {
        const active = s.id === selectedId;
        return (
          <li key={s.id}>
            <motion.button
              type="button"
              role="option"
              aria-selected={active}
              data-testid={`pin-staff-${s.id}`}
              data-active={active ? "true" : "false"}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              onClick={() => onSelect(s.id)}
              onMouseMove={(e) => setPointerVars(e.currentTarget, e)}
              className={[
                "hos-interactive relative flex w-full items-center gap-2.5 rounded-[14px] border border-transparent px-2.5 py-2.5 text-left",
                active ? "text-white" : "text-[var(--hos-ink)]",
              ].join(" ")}
              style={{ "--hos-hover-accent": s.accent } as CSSProperties}
            >
              {active ? (
                <motion.span
                  layoutId="pinStaffPill"
                  className="absolute inset-0 rounded-[14px] bg-[#111] shadow-[0_10px_28px_-12px_rgba(0,0,0,0.55)]"
                  transition={reduce ? { duration: 0 } : springLayout}
                />
              ) : null}
              <span
                className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-[12px] text-[12px] font-bold text-white"
                style={{
                  background: active
                    ? `linear-gradient(135deg, ${s.accent}, #111)`
                    : `linear-gradient(135deg, ${s.accent}cc, ${s.accent})`,
                }}
              >
                {s.initials}
              </span>
              <span className="relative z-10 min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold tracking-tight">
                  {s.name}
                </span>
                <span
                  className={[
                    "block truncate text-[11px]",
                    active ? "text-white/65" : "text-[var(--hos-ink-3)]",
                  ].join(" ")}
                >
                  {s.role}
                </span>
              </span>
              <Badge
                tone={active ? "muted" : "default"}
                className={[
                  "relative z-10 shrink-0",
                  active ? "!border-white/20 !bg-white/10 !text-white" : "",
                ].join(" ")}
              >
                {s.badge}
              </Badge>
            </motion.button>
          </li>
        );
      })}
    </ul>
  );
}

function Shell({
  children,
  accent,
  onMove,
  stageRef,
}: {
  children: ReactNode;
  accent: string;
  onMove: (e: ReactMouseEvent<HTMLDivElement>) => void;
  stageRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={stageRef}
      className="hos-spotlight-stage relative flex h-full min-h-0 w-full flex-1 overflow-hidden"
      style={{ "--hos-spot-accent": accent } as CSSProperties}
      onMouseMove={onMove}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-[background] duration-500 ease-[var(--hos-ease)]"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 70% 55% at 12% 20%, ${accent}28 0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 88% 10%, rgba(245,158,11,0.14) 0%, transparent 50%),
            radial-gradient(ellipse 60% 50% at 70% 100%, rgba(16,185,129,0.1) 0%, transparent 55%)
          `,
        }}
      />
      {children}
    </div>
  );
}

export function PinGateway() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const isPhone = useIsPhone();
  const isTablet = useIsTablet();
  const shortPhone = useMediaQuery("(max-height: 700px)");
  const compactIdentity = useMediaQuery("(max-height: 760px)");
  const hotelName = useSettingsStore((s) => s.hotelName);
  const updateProfile = useSettingsStore((s) => s.updateProfile);
  const dzongkhag = useSettingsStore((s) => s.dzongkhag);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [properties, setProperties] = useState<AuthProperty[]>([]);
  const [propertySlug, setPropertySlug] = useState<string>(
    () => localStorage.getItem("hos.v2.propertySlug") || "",
  );
  const [liveStaff, setLiveStaff] = useState<StaffPreset[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("karma");
  const [digits, setDigits] = useState("");
  const [shake, setShake] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [pendingNewPin, setPendingNewPin] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<PinWeatherSnapshot | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const STAFF = useMemo(() => {
    /* Exclusive: only API staff for the hotel-gated property — no field/demo presets. */
    return liveStaff;
  }, [liveStaff]);

  const selected = STAFF.find((s) => s.id === selectedId) ?? STAFF[0] ?? null;
  const greeting = useMemo(() => greetingForHour(now.getHours()), [now]);
  const pinHint = pendingNewPin
    ? "Confirm your new PIN"
    : selected?.live && selected.pinResetRequired
      ? "Choose a new 4-digit PIN"
      : "Enter PIN";

  const logoutHotel = useCallback(() => {
    clearDeskSession();
    clearPortalSession();
    clearHotelGate();
    try {
      localStorage.removeItem("hos.v2.propertyId");
      localStorage.removeItem("hos.v2.propertySlug");
    } catch {
      /* ignore */
    }
    toast.message("Signed out of hotel");
    navigate("/login/hotel", { replace: true });
  }, [navigate]);

  const onPropertyChange = useCallback(
    (slug: string) => {
      const row = properties.find((p) => p.slug === slug);
      if (!row) {
        setPropertySlug(slug);
        return;
      }
      const gated = readHotelProperty();
      if (gated?.id === row.id) {
        setPropertySlug(slug);
        return;
      }
      void switchHotelProperty({ propertyId: row.id, propertySlug: row.slug }).then((res) => {
        if (!res.ok) {
          toast.error(res.error || "Could not switch hotel");
          setPropertySlug(gated?.slug || "");
          return;
        }
        writeHotelGate(res.token, {
          id: res.property.id,
          slug: res.property.slug,
          name: res.property.name,
        });
        clearDeskSession();
        setSelectedId("");
        setDigits("");
        setPropertySlug(res.property.slug);
        toast.message(`Switched to ${res.property.name}`);
      });
    },
    [properties],
  );

  useEffect(() => {
    if (!readHotelToken()) {
      navigate("/login/hotel", { replace: true });
      return;
    }
    const gated = readHotelProperty();
    if (gated?.slug) {
      setPropertySlug(gated.slug);
      setProperties([
        {
          id: gated.id,
          slug: gated.slug,
          name: gated.name,
        },
      ]);
    }
    const ctrl = new AbortController();
    void fetchAuthProperties(ctrl.signal)
      .then((rows) => {
        if (ctrl.signal.aborted) return;
        setProperties(rows);
        setPropertySlug((prev) => prev || rows[0]?.slug || gated?.slug || "");
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        console.error("[pin-gateway] properties", err);
        if (!gated) setStaffError(err instanceof Error ? err.message : "Hotel unlock required");
      });
    return () => ctrl.abort();
  }, [navigate]);

  useEffect(() => {
    if (!propertySlug) {
      setStaffLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setStaffLoading(true);
    setStaffError(null);
    void fetchAuthStaff(propertySlug, ctrl.signal)
      .then(({ property, staff }) => {
        if (ctrl.signal.aborted) return;
        updateProfile({ hotelName: property.name });
        localStorage.setItem("hos.v2.propertySlug", property.slug);
        localStorage.setItem("hos.v2.propertyId", property.id);
        const mapped = staff.map(staffFromApi);
        setLiveStaff(mapped);
        if (mapped[0]) setSelectedId(mapped[0].id);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        console.error("[pin-gateway] staff", err);
        setStaffError(err instanceof Error ? err.message : "Could not load staff");
        setLiveStaff([]);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setStaffLoading(false);
      });
    return () => ctrl.abort();
  }, [propertySlug, updateProfile]);

  useEffect(() => {
    const ctrl = new AbortController();
    setWeatherLoading(true);
    void fetchPinWeather(dzongkhag, ctrl.signal)
      .then((snap) => {
        if (!ctrl.signal.aborted) setWeather(snap);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        console.error("[pin-gateway] weather", err);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setWeatherLoading(false);
      });
    return () => ctrl.abort();
  }, [dzongkhag]);
  const clock = useMemo(
    () =>
      now.toLocaleTimeString("en-BT", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [now],
  );
  const dateLabel = useMemo(
    () =>
      now.toLocaleDateString("en-BT", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    [now],
  );

  useEffect(() => {
    setDigits("");
    setShake(false);
    setPendingNewPin(null);
  }, [selectedId, propertySlug]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const onStageMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (reduce) return;
      if (window.matchMedia("(pointer: coarse)").matches) return;
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
      const y = ((e.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
      el.style.setProperty("--hos-spot-x", `${x.toFixed(1)}%`);
      el.style.setProperty("--hos-spot-y", `${y.toFixed(1)}%`);
    },
    [reduce],
  );

  const failPin = useCallback(
    (message: string) => {
      setShake(true);
      toast.error(message, {
        description: selected ? `Try again for ${selected.name}` : "Try again",
      });
      window.setTimeout(() => {
        setDigits("");
        setShake(false);
      }, 420);
    },
    [selected],
  );

  const tryUnlock = useCallback(
    (next: string) => {
      if (!selected) {
        setDigits("");
        return;
      }
      if (next.length < 4) {
        setDigits(next);
        return;
      }
      setDigits(next);

      /* Field portals stay local presets. */
      if (!selected.live) {
        if (next === selected.pin) {
          setUnlocking(true);
          const fieldRole: FieldPortalRole | null =
            selected.route === "/partner"
              ? "partner"
              : selected.route === "/guide"
                ? "guide"
                : selected.route === "/driver"
                  ? "driver"
                  : null;
          if (fieldRole) {
            const hint = FIELD_DEMO_HINTS[fieldRole];
            useFieldPortalAuth.getState().unlock(fieldRole, hint.code, hint.pin);
          }
          toast.success(`Welcome, ${selected.name.split(" ")[0]}`, {
            description: `${selected.role} · ${selected.route}`,
          });
          window.setTimeout(() => navigate(selected.route), reduce ? 0 : 280);
          return;
        }
        failPin("Incorrect PIN");
        return;
      }

      if (!propertySlug) {
        failPin("Select a hotel first");
        return;
      }

      /* First-login: collect PIN, then confirm. */
      if ((selected.pinResetRequired || pendingNewPin) && !pendingNewPin) {
        setPendingNewPin(next);
        setDigits("");
        toast.message("Confirm your new PIN", {
          description: "Enter the same 4 digits again",
        });
        return;
      }

      const confirmPin = pendingNewPin ? next : undefined;
      const pin = pendingNewPin ?? next;
      if (pendingNewPin && pendingNewPin !== next) {
        setPendingNewPin(null);
        failPin("PIN confirmation does not match");
        return;
      }

      setUnlocking(true);
      void verifyStaffPin({
        propertySlug,
        staffId: selected.id,
        pin,
        confirmPin,
      }).then((result) => {
        if (!result.ok) {
          setUnlocking(false);
          if (result.resetRequired) {
            setPendingNewPin(pin);
            setDigits("");
            toast.message("Confirm your new PIN", {
              description: "Enter the same 4 digits again",
            });
            return;
          }
          setPendingNewPin(null);
          failPin(result.error);
          return;
        }
        writeDeskSession(result.token, {
          id: result.staff.id,
          fullName: result.staff.fullName,
          deskRole: result.staff.deskRole,
          employeeCode: result.staff.employeeCode,
        }, {
          id: result.property.id,
          slug: result.property.slug,
          name: result.property.name,
        });
        setPendingNewPin(null);
        toast.success(`Welcome, ${result.staff.fullName.split(" ")[0]}`, {
          description: `${result.staff.deskRole ?? selected.role} · ${result.homeRoute}`,
        });
        window.setTimeout(() => navigate(result.homeRoute), reduce ? 0 : 280);
      }).catch((err) => {
        console.error("[pin-gateway] unlock", err);
        setUnlocking(false);
        setPendingNewPin(null);
        failPin(err instanceof Error ? err.message : "PIN verification failed");
      });
    },
    [failPin, navigate, pendingNewPin, propertySlug, reduce, selected],
  );

  const onKey = useCallback(
    (key: (typeof KEYS)[number]) => {
      if (unlocking) return;
      if (key === "C") {
        setDigits("");
        return;
      }
      if (key === "⌫") {
        setDigits((d) => d.slice(0, -1));
        return;
      }
      if (digits.length >= 4) return;
      tryUnlock(digits + key);
    },
    [digits, tryUnlock, unlocking],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        onKey(e.key as (typeof KEYS)[number]);
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        onKey("⌫");
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onKey("C");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKey]);

  /* Empty staff must not dereference selected — that blanked the whole SPA. */
  if (!selected) {
    return (
      <Shell accent="#2563eb" onMove={onStageMove} stageRef={stageRef}>
        <div className="relative z-[1] mx-auto flex h-full w-full max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="m-0 text-[15px] font-semibold text-[var(--hos-ink)]">
            {staffLoading
              ? "Loading staff PIN pad…"
              : staffError
                ? staffError
                : propertySlug
                  ? "No staff with desk login for this property."
                  : "Hotel unlock required before staff PIN."}
          </p>
          {!staffLoading ? (
            <Button type="button" variant="primary" onClick={logoutHotel}>
              <LogOut className="mr-1.5 size-3.5" strokeWidth={2} aria-hidden />
              Log out of hotel
            </Button>
          ) : null}
        </div>
      </Shell>
    );
  }

  /* —— Phone: immersive hero + premium vault —— */
  if (isPhone) {
    return (
      <Shell accent={selected.accent} onMove={onStageMove} stageRef={stageRef}>
        <div
          className="hos-pin-mobile relative z-[1] mx-auto flex h-full w-full max-w-md flex-col px-[var(--pin-pad-x)] pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]"
          data-density={shortPhone ? "short" : "comfort"}
        >
          <div className="hos-pin-mobile-mesh" aria-hidden />

          <header className="hos-pin-mobile-header relative z-[1] flex shrink-0 items-start justify-between gap-2.5">
            <div className="min-w-0">
              <div
                className={[
                  "flex items-center gap-2",
                  shortPhone ? "mb-1" : "mb-2",
                ].join(" ")}
              >
                <InnorahotelLogo size={shortPhone ? 34 : 38} variant="sovereign" showText={false} />
                <div className="min-w-0">
                  <strong className="block truncate text-[13px] font-black tracking-tight text-[var(--hos-ink)]">
                    {hotelName}
                  </strong>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--hos-ink-3)] font-mono">
                    innorahotel.com · {dzongkhag}
                  </span>
                </div>
              </div>
              <motion.h1
                key={greeting}
                className="hos-pin-mobile-greeting font-black text-[var(--hos-ink)]"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={easeVolary}
              >
                {greeting}
              </motion.h1>
              <p className="hos-pin-mobile-sub m-0 mt-1 text-[12px] font-medium text-[var(--hos-ink-3)]">
                Select your station · enter PIN
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <button
                type="button"
                className="hos-glass-card inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--hos-ink-2)]"
                onClick={logoutHotel}
                data-testid="pin-logout-hotel"
                aria-label="Log out of hotel"
              >
                <LogOut className="size-3" strokeWidth={2} aria-hidden />
                Log out
              </button>
              <div
                className={[
                  "hos-glass-card text-right shadow-[var(--hos-shadow-volaro)]",
                  shortPhone
                    ? "rounded-[12px] px-2 py-1.5"
                    : "rounded-[14px] px-2.5 py-1.5",
                ].join(" ")}
              >
                <span className="mb-0.5 flex items-center justify-end gap-1 text-[8px] font-bold uppercase tracking-[0.14em] text-[var(--hos-ink-3)]">
                  <span className="hos-live-dot" data-status="live" /> Live
                </span>
                <div
                  className={[
                    "font-mono font-black tabular-nums tracking-tight text-[var(--hos-ink)]",
                    shortPhone ? "text-[1rem]" : "text-[1.1rem]",
                  ].join(" ")}
                >
                  {clock}
                </div>
                <div className="text-[9px] font-semibold text-[var(--hos-ink-3)]">
                  {dateLabel}
                </div>
              </div>
            </div>
          </header>

          <div className="relative z-[1] mb-[calc(var(--pin-gap-y)*0.75)] shrink-0">
            <PinPlaceWeather
              compact={shortPhone}
              hotelName={hotelName}
              dzongkhag={dzongkhag}
              weather={weather}
              loading={weatherLoading}
            />
          </div>

          <div className="hos-pin-mobile-staff relative z-[1] shrink-0">
            <p className="mb-1.5 px-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-[var(--hos-ink-3)]">
              On duty
            </p>
            {properties.length > 1 ? (
              <label className="mb-2 block px-0.5">
                <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.16em] text-[var(--hos-ink-3)]">
                  Hotel
                </span>
                <select
                  className="hos-glass-card w-full rounded-[12px] border border-white/20 bg-white/40 px-2.5 py-2 text-[12px] font-semibold text-[var(--hos-ink)]"
                  value={propertySlug}
                  onChange={(e) => onPropertyChange(e.target.value)}
                  aria-label="Select hotel"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.slug}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {staffError ? (
              <p className="mb-1.5 px-0.5 text-[10px] font-semibold text-[var(--hos-danger,#ef4444)]">
                {staffError} · demo stations shown
              </p>
            ) : null}
            <StaffPicker
              staff={STAFF}
              selectedId={selectedId}
              onSelect={setSelectedId}
              mode="avatars"
              reduce={reduce}
            />
          </div>

          <motion.div
            className="hos-pin-vault relative z-[1] mt-auto"
            initial={reduce ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={easeVolary}
            style={
              {
                ["--hos-hover-accent" as string]: selected.accent,
              } as CSSProperties
            }
          >
            <div
              className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full opacity-35 blur-2xl sm:size-36"
              style={{ background: selected.accent }}
              aria-hidden
            />

            <div
              className="hos-pin-vault-identity relative"
              data-hero="true"
              data-compact={compactIdentity ? "true" : undefined}
            >
              {!shortPhone ? (
                <motion.div
                  key={selected.id}
                  initial={reduce ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={springSnappy}
                  className={
                    compactIdentity
                      ? "flex items-center gap-2.5"
                      : "flex flex-col items-center gap-1.5"
                  }
                >
                  <span
                    className="flex shrink-0 items-center justify-center font-black text-white shadow-[0_16px_36px_-14px_rgba(0,0,0,0.5)]"
                    style={{
                      width: "var(--pin-hero-avatar)",
                      height: "var(--pin-hero-avatar)",
                      borderRadius: "calc(var(--pin-hero-avatar) * 0.32)",
                      fontSize: "calc(var(--pin-hero-avatar) * 0.28)",
                      background: `linear-gradient(145deg, ${selected.accent}, #111)`,
                    }}
                  >
                    {selected.initials}
                  </span>
                  <div className="hos-pin-vault-meta text-center">
                    <div className="text-[15px] font-black tracking-tight text-[var(--hos-ink)] sm:text-[16px]">
                      {selected.name}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-[var(--hos-ink-3)]">
                      {selected.role} · {selected.badge}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="hos-pin-vault-meta text-center">
                  <div className="text-[14px] font-black tracking-tight text-[var(--hos-ink)]">
                    {selected.name.split(" ")[0]} · {selected.badge}
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--hos-ink-3)]">
                  <Fingerprint className="size-3" strokeWidth={2} />
                  {pinHint}
                </span>
                <PinDots digits={digits} shake={shake} reduce={reduce} premium />
              </div>
            </div>

            <Keypad
              unlocking={unlocking}
              accent={selected.accent}
              reduce={reduce}
              onKey={onKey}
              premium
            />

            <div className="relative shrink-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={unlocking ? "go" : digits.length === 4 ? "ready" : "idle"}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {unlocking ? (
                    <div className="hos-pin-unlock flex items-center justify-center gap-2 rounded-full bg-[#111] px-4 text-[13px] font-bold text-white shadow-[0_16px_36px_-16px_#111]">
                      <ShieldCheck className="size-4" strokeWidth={2} />
                      Opening cockpit…
                    </div>
                  ) : (
                    <Button
                      magnetic
                      disabled={digits.length < 4}
                      className="hos-btn-ink hos-btn-spring hos-pin-unlock w-full !rounded-full text-[14px] font-bold disabled:!bg-[var(--hos-ink-3)]"
                      onClick={() => digits.length === 4 && tryUnlock(digits)}
                    >
                      <Lock className="mr-1.5 size-3.5" strokeWidth={2} />
                      Unlock desk
                    </Button>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <p className="hos-pin-mobile-sub m-0 text-center text-[9px] font-semibold text-[var(--hos-ink-3)]">
              Demo training PIN ·{" "}
              <span className="font-mono tracking-wider">
                {selected.badge} {selected.pin}
              </span>
            </p>
          </motion.div>
        </div>
      </Shell>
    );
  }

  /* —— Tablet: left staff · right name stacked above keypad —— */
  if (isTablet) {
    return (
      <Shell accent={selected.accent} onMove={onStageMove} stageRef={stageRef}>
        <div className="relative z-[1] mx-auto grid h-full w-full max-w-[980px] grid-cols-[minmax(240px,0.9fr)_minmax(320px,1.1fr)] gap-4 overflow-hidden p-4">
          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <InnorahotelLogo size={38} variant="sovereign" showText={false} />
                  <div>
                    <strong className="block text-[14px] font-bold text-[var(--hos-ink)]">
                      {hotelName}
                    </strong>
                    <span className="text-[11px] text-[var(--hos-ink-3)] font-mono">
                      innorahotel.com · {dzongkhag}
                    </span>
                  </div>
                </div>
                <h1 className="m-0 text-[1.65rem] font-bold leading-tight tracking-tight text-[var(--hos-ink)]">
                  {greeting}
                </h1>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <button
                  type="button"
                  className="hos-glass-card inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--hos-ink-2)]"
                  onClick={logoutHotel}
                  data-testid="pin-logout-hotel"
                  aria-label="Log out of hotel"
                >
                  <LogOut className="size-3" strokeWidth={2} aria-hidden />
                  Log out
                </button>
                <div className="hos-glass-card rounded-[14px] px-3 py-2 text-right">
                  <span className="flex items-center justify-end gap-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--hos-ink-3)]">
                    <span className="hos-live-dot" /> Live
                  </span>
                  <div className="font-mono text-[17px] font-bold tabular-nums text-[var(--hos-ink)]">
                    {clock}
                  </div>
                  <div className="text-[10px] text-[var(--hos-ink-3)]">{dateLabel}</div>
                </div>
              </div>
            </div>

            <PinPlaceWeather
              hotelName={hotelName}
              dzongkhag={dzongkhag}
              weather={weather}
              loading={weatherLoading}
            />

            <div className="hos-surface-glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-[var(--hos-glass-border)] p-2 shadow-[var(--hos-shadow-volaro)] [backdrop-filter:blur(24px)]">
              {properties.length > 1 ? (
                <label className="px-2 pb-1 pt-1.5">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
                    Hotel
                  </span>
                  <select
                    className="w-full rounded-[12px] border border-[var(--hos-glass-border)] bg-white/50 px-2.5 py-2 text-[12px] font-semibold"
                    value={propertySlug}
                    onChange={(e) => onPropertyChange(e.target.value)}
                    aria-label="Select hotel"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.slug}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="px-2 pb-1.5 pt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
                On duty{staffLoading ? " · loading" : ""}
              </div>
              <StaffPicker
                staff={STAFF}
                selectedId={selectedId}
                onSelect={setSelectedId}
                mode="grid"
                reduce={reduce}
              />
            </div>
          </div>

          <motion.div
            className="hos-surface-glass flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-[var(--hos-glass-border)] shadow-[var(--hos-shadow-volaro-lg)] [backdrop-filter:blur(28px)]"
            initial={reduce ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={easeVolary}
          >
            {/* Name band — top of keypad column */}
            <div className="shrink-0 border-b border-[var(--hos-glass-border)] bg-[rgba(255,255,255,0.35)] px-5 py-4 dark:bg-[rgba(15,23,42,0.25)]">
              <div className="flex items-center justify-between gap-3">
                <IdentityHero staff={selected} align="left" />
                <span className="hos-glass-card inline-flex size-10 items-center justify-center rounded-full text-[var(--hos-ink-2)]">
                  <Lock className="size-4" strokeWidth={1.75} aria-hidden />
                </span>
              </div>
              <div className="mt-4">
                <PinDots digits={digits} shake={shake} reduce={reduce} />
              </div>
            </div>

            {/* Keypad — lower thumb-friendly pane */}
            <div className="flex min-h-0 flex-1 flex-col justify-center px-5 py-5">
              <div className="mx-auto w-full max-w-[340px]">
                <Keypad
                  unlocking={unlocking}
                  accent={selected.accent}
                  reduce={reduce}
                  onKey={onKey}
                />
                <div className="mt-4">
                  <UnlockBlock
                    unlocking={unlocking}
                    digits={digits}
                    onUnlock={() => digits.length === 4 && tryUnlock(digits)}
                  />
                </div>
                <p className="m-0 mt-3 text-center font-mono text-[10px] text-[var(--hos-ink-3)]">
                  Hint · {selected.badge} {selected.pin}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </Shell>
    );
  }

  /* —— Desktop: classic split —— */
  return (
    <Shell accent={selected.accent} onMove={onStageMove} stageRef={stageRef}>
      <div className="relative z-[1] mx-auto flex h-full w-full max-w-[1180px] gap-5 overflow-hidden p-5">
        <div className="flex w-[min(360px,36%)] shrink-0 flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2.5">
                <InnorahotelLogo size={42} variant="sovereign" showText={false} />
                <div>
                  <strong className="block text-[15px] font-bold text-[var(--hos-ink)]">
                    {hotelName}
                  </strong>
                  <span className="text-[11px] text-[var(--hos-ink-3)] font-mono">
                    innorahotel.com · {dzongkhag}
                  </span>
                </div>
              </div>
              <h1 className="m-0 text-[clamp(1.7rem,2.4vw,2.15rem)] font-bold leading-tight tracking-tight text-[var(--hos-ink)]">
                {greeting}
              </h1>
              <p className="m-0 mt-1.5 max-w-[28ch] text-[13px] text-[var(--hos-ink-3)]">
                Pick your hotel and station, {pinHint.toLowerCase()}, open your dashboard.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <button
                type="button"
                className="hos-glass-card inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--hos-ink-2)]"
                onClick={logoutHotel}
                data-testid="pin-logout-hotel"
                aria-label="Log out of hotel"
              >
                <LogOut className="size-3.5" strokeWidth={2} aria-hidden />
                Log out
              </button>
              <div className="hos-glass-card rounded-[14px] px-3 py-2 text-right">
                <span className="flex items-center justify-end gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--hos-ink-3)]">
                  <span className="hos-live-dot" /> Live
                </span>
                <div className="font-mono text-[18px] font-bold tabular-nums text-[var(--hos-ink)]">
                  {clock}
                </div>
                <div className="text-[10px] text-[var(--hos-ink-3)]">{dateLabel}</div>
              </div>
            </div>
          </div>

          <PinPlaceWeather
            hotelName={hotelName}
            dzongkhag={dzongkhag}
            weather={weather}
            loading={weatherLoading}
          />

          <div className="hos-surface-glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-[var(--hos-glass-border)] p-2 shadow-[var(--hos-shadow-volaro)] [backdrop-filter:blur(24px)]">
            {properties.length > 1 ? (
              <label className="px-2.5 pb-1 pt-2">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
                  Hotel
                </span>
                <select
                  className="w-full rounded-[12px] border border-[var(--hos-glass-border)] bg-white/50 px-2.5 py-2 text-[12px] font-semibold"
                  value={propertySlug}
                  onChange={(e) => onPropertyChange(e.target.value)}
                  aria-label="Select hotel"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.slug}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="px-2.5 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
              On duty{staffLoading ? " · loading" : ""}
            </div>
            <StaffPicker
              staff={STAFF}
              selectedId={selectedId}
              onSelect={setSelectedId}
              mode="list"
              reduce={reduce}
            />
          </div>
        </div>

        <motion.div
          className="hos-surface-glass flex min-h-0 flex-1 flex-col justify-center overflow-hidden rounded-[22px] border border-[var(--hos-glass-border)] p-8 shadow-[var(--hos-shadow-volaro-lg)] [backdrop-filter:blur(28px)]"
          initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={easeVolary}
        >
          <div className="mx-auto w-full max-w-[360px]">
            <div className="mb-6 flex items-center justify-between gap-3">
              <IdentityHero staff={selected} align="left" />
              <span className="hos-glass-card inline-flex size-10 items-center justify-center rounded-full text-[var(--hos-ink-2)]">
                <Lock className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
            </div>
            <div className="mb-6">
              <PinDots digits={digits} shake={shake} reduce={reduce} />
            </div>
            <Keypad
              unlocking={unlocking}
              accent={selected.accent}
              reduce={reduce}
              onKey={onKey}
            />
            <div className="mt-5">
              <UnlockBlock
                unlocking={unlocking}
                digits={digits}
                onUnlock={() => digits.length === 4 && tryUnlock(digits)}
              />
            </div>
            <p className="m-0 mt-4 text-center text-[11px] text-[var(--hos-ink-3)]">
              Demo PINs for training · production uses HR-assigned codes.
            </p>
            <p className="m-0 mt-1 text-center font-mono text-[10px] text-[var(--hos-ink-3)]">
              Hint · {selected.badge} {selected.pin}
            </p>
          </div>
        </motion.div>
      </div>
    </Shell>
  );
}
