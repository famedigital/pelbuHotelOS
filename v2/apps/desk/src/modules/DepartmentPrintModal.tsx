import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChefHat,
  ClipboardList,
  History,
  Maximize2,
  Printer,
  Search,
  Sparkles,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { PERSONAL_CHECKOUT_GATE_BTN } from "@hos-v2/domain";
import { Badge, Button, Odometer, StatusLegend } from "@hos-v2/ui";
import {
  folioBalance,
  formatNu,
  useFrontOfficeStore,
  type GroupMeta,
  type Stay,
} from "../lib/front-office-store";
import { useFnbStore } from "../lib/fnb-store";
import { useFiscalStore } from "../lib/fiscal-store";
import { useOpsStore } from "../lib/ops-store";
import { useSettingsStore } from "../lib/settings-store";
import { useExtrasStore } from "../lib/extras-store";
import { stayPax } from "../lib/stay-pax";

type StayLogistics = {
  nationality: string;
  agency: string;
  agencyContact: string;
  guide: string;
  guideLicense: string;
  guidePhone: string;
  driver: string;
  vehicle: string;
  driverDorm: string;
  groupName: string;
};

function logisticsForStay(
  stay: Stay,
  groupMeta: Record<string, GroupMeta>,
): StayLogistics {
  const meta = stay.groupId ? groupMeta[stay.groupId] : undefined;
  return {
    nationality: stay.nationality?.trim() || "—",
    agency: (stay.agencyName ?? meta?.agencyName)?.trim() || "Direct / walk-in",
    agencyContact: meta?.agencyContact?.trim() || "",
    guide: meta?.guideName?.trim() || "—",
    guideLicense: meta?.guideLicense?.trim() || "",
    guidePhone: meta?.guidePhone?.trim() || "",
    driver: meta?.driverName?.trim() || "—",
    vehicle: meta?.vehicleNo?.trim() || "—",
    driverDorm: meta?.driverDormBed?.trim() || "",
    groupName: stay.groupName?.trim() || meta?.name?.trim() || "—",
  };
}

export type PassKind = "kitchen" | "fb" | "hk" | "fo";

type PrintFormat = "a4" | "thermal80";

/** Ops default: clipboards A4 · F&B guest slip 80mm. */
export const DEFAULT_FORMAT_BY_PASS: Record<PassKind, PrintFormat> = {
  kitchen: "a4",
  fb: "thermal80",
  hk: "a4",
  fo: "a4",
};

type DepartmentPrintModalProps = {
  open: boolean;
  onClose: () => void;
  initialPass?: PassKind;
  /** Prefill FO reg / guest search (Stay deep-link). */
  initialStayId?: string | null;
  /** Full-page studio vs floating modal. */
  variant?: "modal" | "page";
  /** Sync route when pass changes (page mode). */
  onPassChange?: (pass: PassKind) => void;
};

const PASSES: {
  id: PassKind;
  label: string;
  short: string;
  hint: string;
  Icon: typeof ChefHat;
}[] = [
  {
    id: "kitchen",
    label: "Kitchen Briefing",
    short: "Kitchen",
    hint: "Covers · groups · diets",
    Icon: ChefHat,
  },
  {
    id: "fb",
    label: "F&B Guest Check",
    short: "F&B",
    hint: "Roster · guest slip",
    Icon: Sparkles,
  },
  {
    id: "hk",
    label: "HK Floor Run",
    short: "HK",
    hint: "Linen · maid · VIP",
    Icon: ClipboardList,
  },
  {
    id: "fo",
    label: "FO Handover / Reg",
    short: "FO",
    hint: "Reg · immigration · till",
    Icon: Users,
  },
];

type DietRow = { room: string; guest: string; diet: string };

const PRINT_JOBS_KEY = "hos-v2-dept-print-jobs";
const LAST_PRINT_KEY = "hos-v2-dept-print-last";
const MAX_PRINT_JOBS = 24;

const DIET_FLAG_LABEL: Record<string, string> = {
  diet_veg_strict: "Strict Vegetarian",
  diet_gluten_free: "Gluten Allergy",
  diet_no_pork: "No Pork / Beef",
  diet_jain: "Jain · No root vegetables",
  diet_nut_free: "Nut-free / VIP plating",
};

type DeptPrintJob = {
  id: string;
  pass: PassKind;
  format: PrintFormat;
  businessDate: string;
  at: string;
  label: string;
};

function loadPrintJobs(): DeptPrintJob[] {
  try {
    const raw = localStorage.getItem(PRINT_JOBS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeptPrintJob[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("[print-studio] load jobs failed", err);
    return [];
  }
}

function dietForStay(stay: Stay): string | null {
  const flags = stay.stayFlags ?? [];
  const diets = flags
    .filter((f) => f.startsWith("diet_"))
    .map((f) => DIET_FLAG_LABEL[f] ?? f.replace(/^diet_/, "").replace(/_/g, " "));
  if (diets.length) return diets.join(" · ");
  if (stay.vip && flags.includes("vip_nut_free")) return DIET_FLAG_LABEL.diet_nut_free;
  return null;
}

function occupancyLabel(
  roomHk: string,
  stay: Stay | undefined,
  businessDate: string,
): string {
  if (roomHk === "ooo") return "OOO";
  if (!stay) {
    if (roomHk === "dirty") return "Vacant Dirty";
    if (roomHk === "clean" || roomHk === "inspected") return "Vacant Ready";
    return "Vacant";
  }
  if (stay.status === "checked_in" && stay.checkOut === businessDate) return "Departing";
  if (stay.status === "checked_in") return "Stayover";
  if (stay.checkIn === businessDate) return "Arriving";
  return "Assigned";
}

function relativePrintTime(iso: string | null): string {
  if (!iso) return "Never printed this shift";
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return new Date(iso).toLocaleString("en-GB");
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleString("en-GB");
}

function floorLabel(floor: number): string {
  if (floor === 0) return "Ground";
  if (floor === 1) return "1st";
  if (floor === 2) return "2nd";
  if (floor === 3) return "3rd";
  return `${floor}th`;
}

export function DepartmentPrintModal({
  open,
  onClose,
  initialPass = "kitchen",
  initialStayId = null,
  variant = "modal",
  onPassChange,
}: DepartmentPrintModalProps) {
  const reduce = useReducedMotion();
  const isPage = variant === "page";
  const [pass, setPass] = useState<PassKind>(initialPass);
  const [format, setFormat] = useState<PrintFormat>(
    DEFAULT_FORMAT_BY_PASS[initialPass],
  );
  const [formatManual, setFormatManual] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [printJobs, setPrintJobs] = useState<DeptPrintJob[]>(() => loadPrintJobs());
  const [fbOrderId, setFbOrderId] = useState<string>("");
  const [foGuestQuery, setFoGuestQuery] = useState("");
  const [foStayId, setFoStayId] = useState<string | null>(initialStayId);
  const [hkFloor, setHkFloor] = useState<number | "all">("all");
  const [hkDirtyOnly, setHkDirtyOnly] = useState(false);
  const [zoom, setZoom] = useState(1);
  /** When true, ResizeObserver must not override user ± until Fit / pass / format. */
  const [zoomManual, setZoomManual] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const sheetCssMm = format === "thermal80" ? 80 : 210;

  const fitZoomToStage = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const pad = 16;
    const usable = Math.max(120, el.clientWidth - pad);
    /* CSS mm ≈ 96dpi CSS pixels — screen zoom only; print CSS clears transform. */
    const nativePx = (sheetCssMm / 25.4) * 96;
    const next = Math.min(2, Math.max(0.7, (usable * 0.94) / nativePx));
    setZoom(Number(next.toFixed(2)));
    setZoomManual(false);
  }, [sheetCssMm]);

  useEffect(() => {
    if (!open) return;
    const nextPass: PassKind = initialStayId ? "fo" : initialPass;
    setPass(nextPass);
    setFormatManual(false);
    setFormat(DEFAULT_FORMAT_BY_PASS[nextPass]);
    setZoomManual(false);
    if (initialStayId) setFoStayId(initialStayId);
  }, [open, initialPass, initialStayId]);

  useEffect(() => {
    if (!open) return;
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      if (!zoomManual) fitZoomToStage();
      return;
    }
    const ro = new ResizeObserver(() => {
      if (!zoomManual) fitZoomToStage();
    });
    ro.observe(el);
    if (!zoomManual) fitZoomToStage();
    return () => ro.disconnect();
  }, [open, format, pass, zoomManual, fitZoomToStage, isPage]);

  useEffect(() => {
    if (!open) return;
    document.body.dataset.printFormat = format;
    return () => {
      delete document.body.dataset.printFormat;
    };
  }, [open, format]);

  const selectPass = useCallback(
    (next: PassKind) => {
      setPass(next);
      setFormatManual(false);
      setFormat(DEFAULT_FORMAT_BY_PASS[next]);
      setZoomManual(false);
      onPassChange?.(next);
    },
    [onPassChange],
  );

  const pickFormat = useCallback((next: PrintFormat) => {
    setFormatManual(true);
    setFormat(next);
    setZoomManual(false);
  }, []);

  const persistJob = useCallback((job: DeptPrintJob) => {
    setPrintJobs((prev) => {
      const next = [job, ...prev].slice(0, MAX_PRINT_JOBS);
      try {
        localStorage.setItem(PRINT_JOBS_KEY, JSON.stringify(next));
        localStorage.setItem(LAST_PRINT_KEY, job.at);
      } catch (err) {
        console.error("[print-studio] persist job failed", err);
      }
      return next;
    });
  }, []);

  const hotelName = useSettingsStore((s) => s.hotelName);
  const dzongkhag = useSettingsStore((s) => s.dzongkhag);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const stays = useFrontOfficeStore((s) => s.stays);
  const rooms = useFrontOfficeStore((s) => s.rooms);
  const groupMeta = useFrontOfficeStore((s) => s.groupMeta);
  const orders = useFnbStore((s) => s.orders);
  const tillBalance = useFiscalStore((s) => s.tillBalance);
  const purchases = useFiscalStore((s) => s.purchases);
  const maids = useOpsStore((s) => s.maids);
  const assignments = useOpsStore((s) => s.assignments);
  const tillShifts = useExtrasStore((s) => s.tillShifts);

  const inHouse = useMemo(
    () => stays.filter((s) => s.status === "checked_in"),
    [stays],
  );

  /** DOT / RBP style — foreign nationals with guide & vehicle. */
  const immigrationRows = useMemo(
    () =>
      inHouse
        .filter((s) => {
          const nat = s.nationality?.trim().toLowerCase() ?? "";
          return nat && nat !== "bhutanese";
        })
        .map((s) => ({ stay: s, log: logisticsForStay(s, groupMeta) })),
    [inHouse, groupMeta],
  );

  const covers = useMemo(() => {
    let pax = 0;
    let breakfast = 0;
    let lunch = 0;
    let dinner = 0;
    for (const s of inHouse) {
      const n = stayPax(s);
      pax += n;
      if (["CP", "MAP", "AP"].includes(s.mealPlan)) breakfast += n;
      if (["MAP", "AP"].includes(s.mealPlan)) {
        lunch += n;
        dinner += n;
      }
    }
    return { pax, breakfast, lunch, dinner };
  }, [inHouse]);

  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        pax: number;
        timing: string;
        rooms: string[];
        agency: string;
        guide: string;
        guidePhone: string;
        guideLicense: string;
        driver: string;
        vehicle: string;
        nationalities: string[];
      }
    >();
    for (const s of inHouse) {
      if (!s.groupName && !s.groupId) continue;
      const log = logisticsForStay(s, groupMeta);
      const key = s.groupId ?? s.groupName ?? s.id;
      const cur = map.get(key) ?? {
        name: log.groupName !== "—" ? log.groupName : (s.groupName ?? "Group"),
        pax: 0,
        timing: "Standard service",
        rooms: [],
        agency: log.agency,
        guide: log.guide,
        guidePhone: log.guidePhone,
        guideLicense: log.guideLicense,
        driver: log.driver,
        vehicle: log.vehicle,
        nationalities: [],
      };
      cur.pax += stayPax(s);
      if (s.roomNumber && !cur.rooms.includes(s.roomNumber)) {
        cur.rooms.push(s.roomNumber);
      }
      if (log.nationality !== "—" && !cur.nationalities.includes(log.nationality)) {
        cur.nationalities.push(log.nationality);
      }
      const note = s.notes?.trim();
      if (note && cur.timing === "Standard service") cur.timing = note;
      map.set(key, cur);
    }
    return [...map.values()];
  }, [inHouse, groupMeta]);

  const diets: DietRow[] = useMemo(
    () =>
      inHouse
        .map((s) => {
          const diet = dietForStay(s);
          if (!diet) return null;
          return {
            room: s.roomNumber ?? "—",
            guest: s.guestName,
            diet,
          };
        })
        .filter((r): r is DietRow => r != null),
    [inHouse],
  );

  const openShift = tillShifts.find((t) => !t.closedAt);
  const cashPurchases = purchases
    .filter((p) => p.paymentMode === "cash")
    .reduce((s, p) => s + p.grandTotalBtn, 0);
  const unresolved = inHouse.filter((s) => folioBalance(s) > PERSONAL_CHECKOUT_GATE_BTN);

  const fbOrder =
    orders.find((o) => o.id === fbOrderId) ?? orders[0] ?? null;

  const foCandidates = useMemo(() => {
    const q = foGuestQuery.trim().toLowerCase();
    return stays
      .filter((s) => s.status === "checked_in" || s.status === "confirmed")
      .filter(
        (s) =>
          !q ||
          s.guestName.toLowerCase().includes(q) ||
          (s.roomNumber?.toLowerCase().includes(q) ?? false) ||
          s.confirmationNo.toLowerCase().includes(q),
      );
  }, [stays, foGuestQuery]);

  const foRegStay =
    (foStayId ? stays.find((s) => s.id === foStayId) : null) ??
    foCandidates[0] ??
    inHouse[0] ??
    null;

  const lastPrintAt = useMemo(() => {
    try {
      return localStorage.getItem(LAST_PRINT_KEY);
    } catch (err) {
      console.error("[print-studio] read last print failed", err);
      return null;
    }
  }, [printJobs]);

  const sinceMs = lastPrintAt ? Date.parse(lastPrintAt) : 0;

  const handoverDeltas = useMemo(() => {
    const arrivals = stays.filter(
      (s) =>
        s.checkIn === businessDate &&
        (s.status === "confirmed" || s.status === "checked_in"),
    );
    const folioPosts = inHouse.flatMap((s) =>
      s.folioLines
        .filter(
          (l) =>
            !l.voided &&
            l.kind !== "payment" &&
            (sinceMs === 0 || Date.parse(l.postedAt) > sinceMs),
        )
        .map((l) => ({
          room: s.roomNumber ?? "—",
          guest: s.guestName,
          desc: l.description,
          amt: l.totalAmount,
        })),
    );
    return { arrivals, folioPosts };
  }, [stays, inHouse, businessDate, sinceMs]);

  const floors = useMemo(() => {
    const set = new Set(rooms.map((r) => r.floor));
    return [...set].sort((a, b) => a - b);
  }, [rooms]);

  const filteredHkRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (hkFloor !== "all" && r.floor !== hkFloor) return false;
      if (hkDirtyOnly && r.hkStatus !== "dirty") return false;
      return true;
    });
  }, [rooms, hkFloor, hkDirtyOnly]);

  const hkStats = useMemo(
    () => ({
      dirty: rooms.filter((r) => r.hkStatus === "dirty").length,
      ready: rooms.filter((r) => r.hkStatus === "clean" || r.hkStatus === "inspected")
        .length,
      ooo: rooms.filter((r) => r.hkStatus === "ooo").length,
    }),
    [rooms],
  );

  const passKpi = useMemo(() => {
    switch (pass) {
      case "kitchen":
        return [
          { label: "Pax", value: covers.pax },
          { label: "BF", value: covers.breakfast },
          { label: "Diets", value: diets.length },
          { label: "Groups", value: groups.length },
        ];
      case "fb":
        return [
          { label: "In-house", value: inHouse.length },
          { label: "Tickets", value: orders.length },
          {
            label: "Open total",
            value: Math.round(fbOrder?.total ?? 0),
            money: true,
          },
        ];
      case "hk":
        return [
          { label: "Dirty", value: hkStats.dirty },
          { label: "Ready", value: hkStats.ready },
          { label: "OOO", value: hkStats.ooo },
          { label: "Shown", value: filteredHkRooms.length },
        ];
      case "fo":
        return [
          { label: "Arrivals", value: handoverDeltas.arrivals.length },
          { label: "Foreign", value: immigrationRows.length },
          { label: "Open folios", value: unresolved.length },
          {
            label: "Till",
            value: Math.round(tillBalance - cashPurchases),
            money: true,
          },
        ];
    }
  }, [
    pass,
    covers,
    diets.length,
    groups.length,
    inHouse.length,
    orders.length,
    fbOrder?.total,
    hkStats,
    filteredHkRooms.length,
    handoverDeltas,
    immigrationRows.length,
    unresolved.length,
    tillBalance,
    cashPurchases,
  ]);

  const doPrint = useCallback(
    (reprintJob?: DeptPrintJob) => {
      const activePass = reprintJob?.pass ?? pass;
      const activeFormat = reprintJob?.format ?? format;
      const label = PASSES.find((p) => p.id === activePass)?.label ?? activePass;
      if (reprintJob) {
        setPass(reprintJob.pass);
        setFormat(reprintJob.format);
        onPassChange?.(reprintJob.pass);
      }
      const job: DeptPrintJob = {
        id: crypto.randomUUID(),
        pass: activePass,
        format: activeFormat,
        businessDate,
        at: new Date().toISOString(),
        label,
      };
      persistJob(job);
      toast.success(reprintJob ? "Reprint queued" : "Print queued", {
        description: `${label} · ${activeFormat.toUpperCase()} · ${businessDate}`,
      });
      window.setTimeout(() => window.print(), 80);
    },
    [pass, format, businessDate, persistJob, onPassChange],
  );

  const sendToInnoraBot = useCallback(async () => {
    const label = PASSES.find((p) => p.id === pass)?.label ?? pass;
    const root = document.getElementById("hos-print-root");
    const snippet =
      root?.innerText?.trim().slice(0, 3200) ||
      `${label} · business date ${businessDate}\n(Open Print Studio sheet for full clipboard.)`;
    const { hermesPostDepartmentPass } = await import("../lib/hermes-remote");
    const res = await hermesPostDepartmentPass({ pass, text: snippet });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Sent to Innora Bot", {
      description:
        res.data.delivery === "telegram"
          ? `Chat ${res.data.chatId}`
          : `Queued locally (${res.data.error ?? "bot offline"})`,
    });
  }, [pass, businessDate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        (e.target as HTMLElement | null)?.isContentEditable;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        doPrint();
        return;
      }
      if (typing) return;
      const idx = Number(e.key);
      if (idx >= 1 && idx <= 4) {
        e.preventDefault();
        selectPass(PASSES[idx - 1]!.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, doPrint, selectPass]);

  const studioBody = (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
        isPage
          ? "rounded-none border-0 bg-[var(--hos-cell)] md:rounded-none"
          : ""
      }`}
    >
      {/* Chrome header — glass elevated, not on sheet */}
      <header
        className={`hos-module-chrome no-print shrink-0 rounded-none border-x-0 border-t-0 px-2 sm:px-3 ${
          isPage ? "py-1.5" : "px-3 py-2.5 sm:px-4"
        }`}
      >
        <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-[15px] text-[var(--hos-ink)]">
                Print Studio
              </strong>
              <Badge tone="muted">{businessDate}</Badge>
              <span className="text-[11px] text-[var(--hos-ink-3)]">
                Last · {relativePrintTime(lastPrintAt)}
              </span>
            </div>
            <p className="m-0 mt-0.5 hidden text-[11px] text-[var(--hos-ink-3)] lg:block">
              Department passes · A4 clipboard / 80mm thermal · Esc close · ⌘P print · 1–4 pass
            </p>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-1.5 pb-[env(safe-area-inset-bottom,0px)] sm:pb-0">
            <StatusLegend
              dense
              className="hidden lg:flex"
              items={[
                { id: "kitchen", label: "Kitchen", swatch: "var(--hos-brass)" },
                { id: "fb", label: "F&B", swatch: "var(--hos-emerald)" },
                { id: "hk", label: "HK", swatch: "var(--hos-primary)" },
                { id: "fo", label: "FO", swatch: "var(--hos-ink-2)" },
              ]}
            />
            <Button
              size="sm"
              variant="secondary"
              className="!rounded-xl"
              onClick={() => setHistoryOpen((v) => !v)}
            >
              <History className="size-3.5" strokeWidth={2} />
              History
              {printJobs.length > 0 ? (
                <span className="ml-1 font-mono text-[10px] tabular-nums">
                  {printJobs.length}
                </span>
              ) : null}
            </Button>
            <Button
              size="sm"
              className="hos-btn-ink !rounded-xl"
              onClick={() => doPrint()}
            >
              <Printer className="size-3.5" strokeWidth={2} />
              Print
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="!rounded-xl"
              onClick={() => void sendToInnoraBot()}
            >
              Send to Innora Bot
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="!rounded-xl"
              onClick={onClose}
              aria-label="Close print studio"
            >
              <X className="size-4" strokeWidth={2} />
            </Button>
          </div>
        </div>

        {/* Pass rail — compact on page / phone so preview gets height */}
        <div
          className={
            isPage
              ? "mt-1.5 grid grid-cols-4 gap-1"
              : "mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4"
          }
        >
          {PASSES.map((p, i) => {
            const active = pass === p.id;
            const Icon = p.Icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPass(p.id)}
                className={`hos-btn-tactile flex items-center gap-1.5 rounded-xl border text-left transition ${
                  isPage ? "px-1.5 py-1.5 sm:px-2.5" : "items-start px-2.5 py-2"
                } ${
                  active
                    ? "border-[var(--hos-primary)] bg-[color-mix(in_srgb,var(--hos-primary)_12%,var(--hos-cell))] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                    : "border-[var(--hos-line)] bg-[var(--hos-cell)] hover:bg-[color-mix(in_srgb,var(--hos-ink)_3%,var(--hos-cell))]"
                }`}
              >
                <span
                  className={`flex shrink-0 items-center justify-center rounded-lg ${
                    isPage ? "size-6" : "mt-0.5 size-7"
                  } ${
                    active
                      ? "bg-[var(--hos-primary)] text-white"
                      : "bg-[color-mix(in_srgb,var(--hos-ink)_6%,transparent)] text-[var(--hos-ink-2)]"
                  }`}
                >
                  <Icon className="size-3.5" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`truncate font-bold ${
                        isPage ? "text-[11px] sm:text-[12px]" : "text-[12px]"
                      } ${
                        active ? "text-[var(--hos-primary)]" : "text-[var(--hos-ink)]"
                      }`}
                    >
                      {p.short}
                    </span>
                    <kbd className="hidden rounded border border-[var(--hos-line)] px-1 font-mono text-[9px] text-[var(--hos-ink-3)] lg:inline">
                      {i + 1}
                    </kbd>
                  </span>
                  {!isPage ? (
                    <span className="block truncate text-[10px] text-[var(--hos-ink-3)]">
                      {p.hint}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        {/* KPI strip */}
        <div
          className={
            isPage
              ? "mt-1 grid grid-cols-4 gap-1"
              : "mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4"
          }
        >
          {passKpi.map((k) => (
            <div
              key={k.label}
              className={`rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] ${
                isPage ? "px-1.5 py-1 sm:px-2.5 sm:py-1.5" : "px-2.5 py-1.5"
              }`}
            >
              <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
                {k.label}
              </div>
              {"money" in k && k.money ? (
                <Odometer
                  value={k.value}
                  prefix="Nu. "
                  className={`font-mono font-black tabular-nums text-[var(--hos-ink)] ${
                    isPage ? "text-[11px] sm:text-[13px]" : "text-[13px]"
                  }`}
                />
              ) : (
                <Odometer
                  value={k.value}
                  className={`font-mono font-black tabular-nums text-[var(--hos-ink)] ${
                    isPage ? "text-[13px] sm:text-[15px]" : "text-[15px]"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </header>

      {/* History drawer */}
      <AnimatePresence>
        {historyOpen ? (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            className="no-print shrink-0 overflow-hidden border-b border-[var(--hos-line)] bg-[var(--hos-surface)]"
          >
            <div className="max-h-44 overflow-auto px-3 py-2 sm:px-4">
              {printJobs.length === 0 ? (
                <p className="m-0 py-4 text-center text-[12px] text-[var(--hos-ink-3)]">
                  No print jobs yet — Print queues a job and opens the system dialog.
                </p>
              ) : (
                <ul className="m-0 list-none space-y-1 p-0">
                  {printJobs.map((j) => (
                    <li
                      key={j.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-transparent px-2 py-1.5 text-[11px] hover:border-[var(--hos-line)] hover:bg-[var(--hos-cell)]"
                    >
                      <div className="min-w-0">
                        <strong className="text-[var(--hos-ink)]">{j.label}</strong>
                        <span className="ml-2 text-[var(--hos-ink-3)]">
                          {j.businessDate} · {j.format.toUpperCase()} ·{" "}
                          {new Date(j.at).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="!rounded-lg"
                        onClick={() => doPrint(j)}
                      >
                        Reprint
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Filters + format + zoom */}
      <div
        className={`no-print shrink-0 space-y-1.5 border-b border-[var(--hos-line)] bg-[var(--hos-cell)] ${
          isPage ? "px-2 py-1.5 sm:px-3" : "space-y-2 px-3 py-2 sm:px-4"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-xl bg-[color-mix(in_srgb,var(--hos-ink)_4%,transparent)] p-0.5">
              {(["a4", "thermal80"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => pickFormat(f)}
                  className={`min-h-9 rounded-[10px] px-2.5 text-[11px] font-bold transition sm:px-3 ${
                    format === f
                      ? "bg-[#111] text-white shadow-sm"
                      : "text-[var(--hos-ink-2)]"
                  }`}
                >
                  {f === "a4" ? "A4" : "80mm"}
                  <span className="hidden sm:inline">
                    {f === "a4" ? " Clipboard" : " Thermal"}
                  </span>
                </button>
              ))}
            </div>
            <span className="hidden text-[10px] text-[var(--hos-ink-3)] sm:inline">
              {formatManual
                ? "Manual size"
                : pass === "fb"
                  ? "Default 80mm guest slip"
                  : "Default A4 clipboard"}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label="Zoom out"
              className="hos-btn-tactile inline-flex size-9 min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--hos-line)] bg-[var(--hos-surface)] sm:min-h-9 sm:min-w-9"
              onClick={() => {
                setZoomManual(true);
                setZoom((z) => Math.max(0.7, Number((z - 0.1).toFixed(1))));
              }}
            >
              <ZoomOut className="size-3.5" strokeWidth={2} />
            </button>
            <span className="min-w-[3rem] text-center font-mono text-[11px] tabular-nums text-[var(--hos-ink-3)]">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              className="hos-btn-tactile inline-flex size-9 min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--hos-line)] bg-[var(--hos-surface)] sm:min-h-9 sm:min-w-9"
              onClick={() => {
                setZoomManual(true);
                setZoom((z) => Math.min(2, Number((z + 0.1).toFixed(1))));
              }}
            >
              <ZoomIn className="size-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Fit to screen"
              title="Fit width"
              className="hos-btn-tactile inline-flex min-h-11 items-center gap-1 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-surface)] px-2.5 text-[11px] font-bold text-[var(--hos-ink-2)] sm:min-h-9"
              onClick={() => fitZoomToStage()}
            >
              <Maximize2 className="size-3.5" strokeWidth={2} aria-hidden />
              Fit
            </button>
          </div>
        </div>

        {pass === "fb" ? (
          <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
            F&B settled ticket
            <select
              value={fbOrder?.id ?? ""}
              onChange={(e) => setFbOrderId(e.target.value)}
              className="hos-input !rounded-xl !py-2 !text-xs"
            >
              {orders.length === 0 ? (
                <option value="">No settled tickets</option>
              ) : (
                orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.billNo || o.id.slice(0, 8)} · {o.tableLabel || "Walk-up"} ·{" "}
                    {formatNu(o.total)}
                  </option>
                ))
              )}
            </select>
          </label>
        ) : null}

        {pass === "fo" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
              Guest search
              <div className="hos-search-field relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--hos-ink-3)]"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <input
                  value={foGuestQuery}
                  onChange={(e) => setFoGuestQuery(e.target.value)}
                  placeholder="Name · room · conf"
                  className="hos-input w-full !rounded-xl !py-2 !pl-8 !text-xs"
                />
              </div>
            </label>
            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
              Reg card guest
              <select
                value={foRegStay?.id ?? ""}
                onChange={(e) => setFoStayId(e.target.value)}
                className="hos-input !rounded-xl !py-2 !text-xs"
              >
                {foCandidates.length === 0 ? (
                  <option value="">No matches</option>
                ) : (
                  foCandidates.map((s) => (
                    <option key={s.id} value={s.id}>
                      Rm {s.roomNumber ?? "—"} · {s.guestName}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>
        ) : null}

        {pass === "hk" ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
              Floor
              <select
                value={hkFloor === "all" ? "all" : String(hkFloor)}
                onChange={(e) =>
                  setHkFloor(
                    e.target.value === "all" ? "all" : Number(e.target.value),
                  )
                }
                className="hos-input !rounded-xl !py-2 !text-xs"
              >
                <option value="all">All floors</option>
                {floors.map((f) => (
                  <option key={f} value={f}>
                    {floorLabel(f)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={hkDirtyOnly}
              onClick={() => setHkDirtyOnly((v) => !v)}
              className={`mb-0.5 inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-[12px] font-semibold ${
                hkDirtyOnly
                  ? "border-[var(--hos-ruby,#ef4444)] bg-[color-mix(in_srgb,var(--hos-ruby,#ef4444)_12%,var(--hos-cell))] text-[var(--hos-ruby,#ef4444)]"
                  : "border-[var(--hos-line)] text-[var(--hos-ink-2)]"
              }`}
            >
              Dirty only
            </button>
          </div>
        ) : null}
      </div>

      {/* Opaque preview stage — no blur on sheet; zoom fills width (Fit) */}
      <div
        ref={stageRef}
        className="hos-print-stage hos-scroll-thin min-h-0 flex-1 overflow-auto bg-[#e8edf5] p-2 dark:bg-[#0b1220] sm:p-2"
      >
        <div
          className="hos-print-zoom mx-auto origin-top transition-transform duration-150"
          style={{
            transform: `scale(${zoom})`,
            width: format === "thermal80" ? "80mm" : "210mm",
            maxWidth: format === "thermal80" ? "80mm" : "210mm",
            marginBottom: `${Math.max(0, (zoom - 1) * (format === "thermal80" ? 200 : 900))}px`,
          }}
        >
          <div
            id="hos-print-root"
            className={`pass-sheet rounded-lg border border-black/10 bg-white p-6 text-[#0f172a] shadow-[0_12px_40px_-20px_rgba(15,23,42,0.45)] ${
              format === "thermal80"
                ? "pass-thermal mx-auto max-w-[80mm] p-3 text-[11px] shadow-none"
                : ""
            }`}
          >
            <header className="mb-4 flex items-start justify-between gap-3 border-b-2 border-black pb-3">
              <div>
                <h1 className="m-0 text-xl font-black uppercase tracking-tight">
                  {hotelName}
                </h1>
                <p className="m-0 mt-0.5 text-xs font-semibold">
                  {dzongkhag} Dzongkhag · Kingdom of Bhutan
                </p>
                <p className="m-0 mt-1 text-[11px] font-bold uppercase tracking-wide">
                  {PASSES.find((p) => p.id === pass)?.label}
                </p>
              </div>
              <div className="rounded border border-black px-2.5 py-2 text-right text-[11px]">
                <div className="font-bold">BUSINESS DATE</div>
                <div className="font-mono text-sm font-black">{businessDate}</div>
                <div className="mt-1 font-mono text-[10px]">
                  {format === "a4" ? "A4" : "80mm"} ·{" "}
                  {new Date().toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </header>

            {pass === "kitchen" ? (
              <section className="space-y-4">
                <div>
                  <h3 className="mb-2 border-b border-black pb-1 text-[11px] font-black uppercase">
                    1. Meal covers summary
                  </h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Total in-house pax</td>
                        <td className="font-mono font-bold">{covers.pax}</td>
                      </tr>
                      <tr>
                        <td>Breakfast (CP / MAP / AP)</td>
                        <td className="font-mono font-bold">{covers.breakfast}</td>
                      </tr>
                      <tr>
                        <td>Lunch (MAP / AP)</td>
                        <td className="font-mono font-bold">{covers.lunch}</td>
                      </tr>
                      <tr>
                        <td>Dinner (MAP / AP)</td>
                        <td className="font-mono font-bold">{covers.dinner}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 className="mb-2 border-b border-black pb-1 text-[11px] font-black uppercase">
                    2. Group schedules · agent · guide · vehicle
                  </h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Tour group</th>
                        <th>Pax</th>
                        <th>Nationality</th>
                        <th>Agent</th>
                        <th>Guide / TCR</th>
                        <th>Driver / vehicle</th>
                        <th>Timing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g) => (
                        <tr key={g.name}>
                          <td className="font-semibold">
                            {g.name}
                            <div className="font-mono text-[9px] font-normal">
                              Rm {g.rooms.sort().join(", ") || "—"}
                            </div>
                          </td>
                          <td className="font-mono">{g.pax}</td>
                          <td>{g.nationalities.join(", ") || "—"}</td>
                          <td>{g.agency}</td>
                          <td>
                            {g.guide}
                            {g.guideLicense ? (
                              <div className="text-[9px]">{g.guideLicense}</div>
                            ) : null}
                            {g.guidePhone ? (
                              <div className="font-mono text-[9px]">{g.guidePhone}</div>
                            ) : null}
                          </td>
                          <td>
                            {g.driver}
                            <div className="font-mono text-[9px]">{g.vehicle}</div>
                          </td>
                          <td>{g.timing}</td>
                        </tr>
                      ))}
                      {groups.length === 0 ? (
                        <tr>
                          <td colSpan={7}>No active tour groups</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 className="mb-2 border-b border-black pb-1 text-[11px] font-black uppercase">
                    2b. In-house guest logistics
                  </h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Rm</th>
                        <th>Guest</th>
                        <th>Nat.</th>
                        <th>Pax</th>
                        <th>Meal</th>
                        <th>Agent</th>
                        <th>Guide</th>
                        <th>Vehicle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inHouse.map((s) => {
                        const log = logisticsForStay(s, groupMeta);
                        return (
                          <tr key={s.id}>
                            <td className="font-mono font-bold">
                              {s.roomNumber ?? "—"}
                            </td>
                            <td>{s.guestName}</td>
                            <td>{log.nationality}</td>
                            <td className="font-mono">{stayPax(s)}</td>
                            <td>{s.mealPlan}</td>
                            <td>{log.agency}</td>
                            <td>
                              {log.guide}
                              {log.guidePhone ? (
                                <div className="font-mono text-[9px]">
                                  {log.guidePhone}
                                </div>
                              ) : null}
                            </td>
                            <td className="font-mono text-[10px]">{log.vehicle}</td>
                          </tr>
                        );
                      })}
                      {inHouse.length === 0 ? (
                        <tr>
                          <td colSpan={8}>No in-house guests</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 className="mb-2 border-b border-black pb-1 text-[11px] font-black uppercase">
                    3. Strict dietary alerts
                  </h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Room</th>
                        <th>Guest</th>
                        <th>Diet / Allergy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diets.map((d) => (
                        <tr key={`${d.room}-${d.guest}`}>
                          <td className="font-mono font-bold">{d.room}</td>
                          <td>{d.guest}</td>
                          <td className="font-semibold">{d.diet}</td>
                        </tr>
                      ))}
                      {diets.length === 0 ? (
                        <tr>
                          <td colSpan={3}>
                            No flagged dietary restrictions (set stayFlags diet_*)
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-6 text-[11px]">
                  <div>
                    <div className="border-b border-black pb-8">Head Chef signature</div>
                    <div className="mt-1 text-[10px]">Name / Time</div>
                  </div>
                  <div>
                    <div className="border-b border-black pb-8">
                      F&B Manager signature
                    </div>
                    <div className="mt-1 text-[10px]">Name / Time</div>
                  </div>
                </div>
              </section>
            ) : null}

            {pass === "fb" ? (
              <section className="space-y-4">
                {/* 80mm = guest slip first; A4 also prints day roster for service board */}
                <div
                  className={
                    format === "thermal80"
                      ? "border border-black p-2"
                      : "border border-black p-3"
                  }
                >
                  <h3 className="m-0 text-[11px] font-black uppercase">
                    Guest check slip · 10% SC · 10% BST
                  </h3>
                  {fbOrder ? (
                    <>
                      <p className="m-0 mt-2 text-[11px]">
                        {fbOrder.billNo || fbOrder.id.slice(0, 8)} ·{" "}
                        {fbOrder.tableLabel || "Walk-up"}
                        {fbOrder.roomNumber ? ` · Rm ${fbOrder.roomNumber}` : ""}
                        {fbOrder.guestName ? ` · ${fbOrder.guestName}` : ""}
                      </p>
                      {fbOrder.lines.length > 0 ? (
                        <table className="mt-2">
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th>Qty</th>
                              <th>Amt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fbOrder.lines.map((line, i) => (
                              <tr key={`${line.name}-${i}`}>
                                <td>{line.name}</td>
                                <td className="font-mono">{line.qty}</td>
                                <td className="font-mono">
                                  {formatNu(line.netUnit * line.qty)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : null}
                      <table className="mt-2">
                        <thead>
                          <tr>
                            <th>Tax stack</th>
                            <th>Amt</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Settled F&B net</td>
                            <td className="font-mono">{formatNu(fbOrder.net)}</td>
                          </tr>
                          <tr>
                            <td>10% Service Charge</td>
                            <td className="font-mono">{formatNu(fbOrder.sc)}</td>
                          </tr>
                          <tr>
                            <td>10% BST on (Base+SC)</td>
                            <td className="font-mono">{formatNu(fbOrder.bst)}</td>
                          </tr>
                          <tr>
                            <td className="font-bold">Total</td>
                            <td className="font-mono font-bold">
                              {formatNu(fbOrder.total)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p className="m-0 mt-2 text-[11px]">
                      No settled POS ticket — settle a check in F&B to print a guest slip.
                    </p>
                  )}
                  <div className="mt-4 border-b border-black pb-8 text-[11px]">
                    Guest signature
                  </div>
                </div>

                {format === "a4" ? (
                  <div>
                    <h3 className="mb-2 border-b border-black pb-1 text-[11px] font-black uppercase">
                      Dining reservation roster (clipboard)
                    </h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Room</th>
                          <th>Guest</th>
                          <th>Nat.</th>
                          <th>Covers</th>
                          <th>Meal</th>
                          <th>Agent</th>
                          <th>Guide</th>
                          <th>Vehicle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inHouse.map((s) => {
                          const log = logisticsForStay(s, groupMeta);
                          return (
                            <tr key={s.id}>
                              <td className="font-mono font-bold">
                                {s.roomNumber}
                              </td>
                              <td>{s.guestName}</td>
                              <td>{log.nationality}</td>
                              <td className="font-mono">{stayPax(s)}</td>
                              <td>{s.mealPlan}</td>
                              <td>{log.agency}</td>
                              <td>{log.guide}</td>
                              <td className="font-mono text-[10px]">
                                {log.vehicle}
                              </td>
                            </tr>
                          );
                        })}
                        {inHouse.length === 0 ? (
                          <tr>
                            <td colSpan={8}>No in-house guests</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            ) : null}

            {pass === "hk" ? (
              <section className="space-y-3">
                <div className="flex flex-wrap gap-3 text-[11px] font-bold">
                  <span>Dirty: {hkStats.dirty}</span>
                  <span>Vacant ready: {hkStats.ready}</span>
                  <span>OOO: {hkStats.ooo}</span>
                  <span>Listed: {filteredHkRooms.length}</span>
                </div>
                <div>
                  <h3 className="mb-1 text-[11px] font-black uppercase">
                    Ground · Public areas
                  </h3>
                  <p className="m-0 text-[11px]">
                    Lobby · Restaurant · Bar · Spa · Lift · Stairs — amenity check ☐
                  </p>
                </div>
                {floors
                  .filter((f) => f > 0)
                  .map((floor) => {
                    const floorRooms = filteredHkRooms.filter((r) => r.floor === floor);
                    if (floorRooms.length === 0) return null;
                    return (
                      <div key={floor}>
                        <h3 className="mb-1 text-[11px] font-black uppercase">
                          {floorLabel(floor)} Floor
                        </h3>
                        <table>
                          <thead>
                            <tr>
                              <th>Room</th>
                              <th>Type</th>
                              <th>Occupancy</th>
                              <th>Linen ☐</th>
                              <th>VIP Amen.</th>
                              <th>Maid</th>
                              <th>Sup. ☐</th>
                            </tr>
                          </thead>
                          <tbody>
                            {floorRooms.map((r) => {
                              const stay = inHouse.find((s) => s.roomId === r.id);
                              const maidId = assignments[r.id];
                              const maid = maids.find((m) => m.id === maidId);
                              return (
                                <tr key={r.id}>
                                  <td className="font-mono font-bold">{r.number}</td>
                                  <td>{r.typeCode}</td>
                                  <td>
                                    {occupancyLabel(r.hkStatus, stay, businessDate)}
                                  </td>
                                  <td className="text-center">☐</td>
                                  <td>{stay?.vip ? "VIP tray" : "—"}</td>
                                  <td>{maid?.name ?? "—"}</td>
                                  <td className="text-center">☐</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                {filteredHkRooms.filter((r) => r.floor > 0).length === 0 ? (
                  <p className="m-0 text-[11px]">No rooms match floor / dirty filters.</p>
                ) : null}
              </section>
            ) : null}

            {pass === "fo" ? (
              <section className="space-y-5">
                <div>
                  <h3 className="mb-2 border-b border-black pb-1 text-[11px] font-black uppercase">
                    Bhutan TCB / Immigration registration card
                  </h3>
                  {foRegStay ? (
                    (() => {
                      const log = logisticsForStay(foRegStay, groupMeta);
                      return (
                        <table>
                          <tbody>
                            <tr>
                              <th>Full name</th>
                              <td>{foRegStay.guestName}</td>
                            </tr>
                            <tr>
                              <th>Passport / CID</th>
                              <td>
                                {foRegStay.passportOrCid || "________________"}
                              </td>
                            </tr>
                            <tr>
                              <th>Nationality</th>
                              <td>{log.nationality}</td>
                            </tr>
                            <tr>
                              <th>Pax / meal plan</th>
                              <td>
                                {stayPax(foRegStay)} · {foRegStay.mealPlan}
                              </td>
                            </tr>
                            <tr>
                              <th>Visa number</th>
                              <td>________________</td>
                            </tr>
                            <tr>
                              <th>Arrival / Departure</th>
                              <td>
                                {foRegStay.checkIn} → {foRegStay.checkOut}
                              </td>
                            </tr>
                            <tr>
                              <th>Room #</th>
                              <td className="font-mono font-bold">
                                {foRegStay.roomNumber ?? "—"}
                              </td>
                            </tr>
                            <tr>
                              <th>Conf / phone</th>
                              <td>
                                {foRegStay.confirmationNo}
                                {foRegStay.guestPhone
                                  ? ` · ${foRegStay.guestPhone}`
                                  : ""}
                              </td>
                            </tr>
                            <tr>
                              <th>Tour / group</th>
                              <td>{log.groupName}</td>
                            </tr>
                            <tr>
                              <th>Agent / tour operator</th>
                              <td>
                                {log.agency}
                                {log.agencyContact ? (
                                  <div className="text-[10px]">{log.agencyContact}</div>
                                ) : null}
                              </td>
                            </tr>
                            <tr>
                              <th>Guide · TCR · phone</th>
                              <td>
                                {log.guide}
                                {log.guideLicense ? ` · ${log.guideLicense}` : ""}
                                {log.guidePhone ? ` · ${log.guidePhone}` : ""}
                              </td>
                            </tr>
                            <tr>
                              <th>Driver / vehicle</th>
                              <td>
                                {log.driver}
                                {log.vehicle !== "—" ? ` · ${log.vehicle}` : ""}
                                {log.driverDorm ? (
                                  <div className="text-[10px]">
                                    Dorm: {log.driverDorm}
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                            <tr>
                              <th>Declaration</th>
                              <td>
                                I declare the above particulars are true. Signature:
                                ________________
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      );
                    })()
                  ) : (
                    <p className="text-[11px]">No guest selected for reg card.</p>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 border-b border-black pb-1 text-[11px] font-black uppercase">
                    In-house · nationality · agent · guide · car
                  </h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Rm</th>
                        <th>Guest</th>
                        <th>Nat.</th>
                        <th>Agent</th>
                        <th>Guide</th>
                        <th>Driver / vehicle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inHouse.map((s) => {
                        const log = logisticsForStay(s, groupMeta);
                        return (
                          <tr key={`log-${s.id}`}>
                            <td className="font-mono font-bold">
                              {s.roomNumber ?? "—"}
                            </td>
                            <td>{s.guestName}</td>
                            <td>{log.nationality}</td>
                            <td>{log.agency}</td>
                            <td>
                              {log.guide}
                              {log.guidePhone ? (
                                <div className="font-mono text-[9px]">
                                  {log.guidePhone}
                                </div>
                              ) : null}
                            </td>
                            <td>
                              {log.driver}
                              <div className="font-mono text-[9px]">{log.vehicle}</div>
                            </td>
                          </tr>
                        );
                      })}
                      {inHouse.length === 0 ? (
                        <tr>
                          <td colSpan={6}>No in-house guests</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 className="mb-2 border-b border-black pb-1 text-[11px] font-black uppercase">
                    Tourist police / immigration manifest · {businessDate}
                  </h3>
                  <p className="m-0 mb-2 text-[10px]">
                    Foreign nationals in-house · passport · nationality · agent ·
                    guide · vehicle (DOT / RBP clipboard)
                  </p>
                  <table>
                    <thead>
                      <tr>
                        <th>Guest</th>
                        <th>Passport / CID</th>
                        <th>Nat.</th>
                        <th>Rm</th>
                        <th>In → Out</th>
                        <th>Agent</th>
                        <th>Guide · TCR</th>
                        <th>Vehicle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {immigrationRows.map(({ stay: s, log }) => (
                        <tr key={`imm-${s.id}`}>
                          <td className="font-semibold">{s.guestName}</td>
                          <td className="font-mono text-[10px]">
                            {s.passportOrCid || "—"}
                          </td>
                          <td>{log.nationality}</td>
                          <td className="font-mono font-bold">
                            {s.roomNumber ?? "—"}
                          </td>
                          <td className="font-mono text-[10px]">
                            {s.checkIn} → {s.checkOut}
                          </td>
                          <td>{log.agency}</td>
                          <td>
                            {log.guide}
                            {log.guideLicense ? (
                              <div className="text-[9px]">{log.guideLicense}</div>
                            ) : null}
                          </td>
                          <td className="font-mono text-[10px]">{log.vehicle}</td>
                        </tr>
                      ))}
                      {immigrationRows.length === 0 ? (
                        <tr>
                          <td colSpan={8}>
                            No foreign nationals in-house (Bhutanese-only house)
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 className="mb-2 border-b border-black pb-1 text-[11px] font-black uppercase">
                    Since last print
                    {lastPrintAt
                      ? ` · ${new Date(lastPrintAt).toLocaleString("en-GB")}`
                      : " · (full shift)"}
                  </h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Arrivals today</th>
                        <th>Room</th>
                        <th>Guest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {handoverDeltas.arrivals.map((s) => (
                        <tr key={s.id}>
                          <td className="font-mono">{s.checkIn}</td>
                          <td className="font-mono">{s.roomNumber ?? "TBA"}</td>
                          <td>{s.guestName}</td>
                        </tr>
                      ))}
                      {handoverDeltas.arrivals.length === 0 ? (
                        <tr>
                          <td colSpan={3}>No new arrivals on business date</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                  <h4 className="mb-1 mt-3 text-[11px] font-bold uppercase">
                    Folio posts since last print
                  </h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Rm</th>
                        <th>Guest</th>
                        <th>Line</th>
                        <th>Amt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {handoverDeltas.folioPosts.slice(0, 16).map((row, i) => (
                        <tr key={`${row.room}-${i}`}>
                          <td className="font-mono">{row.room}</td>
                          <td>{row.guest}</td>
                          <td>{row.desc}</td>
                          <td className="font-mono">{formatNu(row.amt)}</td>
                        </tr>
                      ))}
                      {handoverDeltas.folioPosts.length === 0 ? (
                        <tr>
                          <td colSpan={4}>No new folio charges</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                  <p className="m-0 mt-2 text-[11px]">
                    Till live {formatNu(tillBalance)} · cash purchases deducted{" "}
                    {formatNu(cashPurchases)}.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 border-b border-black pb-1 text-[11px] font-black uppercase">
                    Shift handover slip
                  </h3>
                  <table>
                    <tbody>
                      <tr>
                        <th>Opening till cash</th>
                        <td className="font-mono">
                          {formatNu(openShift?.openingFloat ?? 10000)}
                        </td>
                      </tr>
                      <tr>
                        <th>Total cash inflows (live till)</th>
                        <td className="font-mono">{formatNu(tillBalance)}</td>
                      </tr>
                      <tr>
                        <th>Cash purchase bills deducted</th>
                        <td className="font-mono">{formatNu(cashPurchases)}</td>
                      </tr>
                      <tr>
                        <th>Net closing drawer cash</th>
                        <td className="font-mono font-bold">
                          {formatNu(tillBalance - cashPurchases)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <h4 className="mb-1 mt-3 text-[11px] font-bold uppercase">
                    Unresolved guest folios
                  </h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Room</th>
                        <th>Guest</th>
                        <th>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unresolved.map((s) => (
                        <tr key={s.id}>
                          <td className="font-mono">{s.roomNumber}</td>
                          <td>{s.guestName}</td>
                          <td className="font-mono">{formatNu(folioBalance(s))}</td>
                        </tr>
                      ))}
                      {unresolved.length === 0 ? (
                        <tr>
                          <td colSpan={3}>All in-house folios clear</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-[11px]">
                    <div className="border-b border-black pb-8">Outgoing cashier</div>
                    <div className="border-b border-black pb-8">Incoming cashier</div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile sticky print dock */}
      <div className="no-print shrink-0 border-t border-[var(--hos-line)] bg-[color-mix(in_srgb,var(--hos-surface)_94%,transparent)] px-3 py-2 backdrop-blur-md sm:hidden">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="!min-h-11 flex-1 !rounded-xl"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            History
          </Button>
          <Button
            size="sm"
            className="hos-btn-ink !min-h-11 flex-[1.4] !rounded-xl"
            onClick={() => doPrint()}
          >
            <Printer className="size-3.5" strokeWidth={2} />
            Print {PASSES.find((p) => p.id === pass)?.short}
          </Button>
        </div>
      </div>
    </div>
  );

  if (isPage) {
    if (!open) return null;
    return (
      <div className="flex h-full min-h-0 w-full flex-1 flex-col">
        {studioBody}
      </div>
    );
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="no-print fixed inset-0 z-[95] flex items-end justify-center bg-[rgba(15,23,42,0.72)] p-0 sm:items-center sm:p-4"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-label="Department print studio"
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-[min(96dvh,100%)] max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-[var(--hos-line)] bg-[var(--hos-cell)] shadow-[0_24px_64px_-16px_rgba(15,23,42,0.55)] sm:h-auto sm:max-h-[94vh] sm:rounded-2xl"
          >
            {studioBody}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
