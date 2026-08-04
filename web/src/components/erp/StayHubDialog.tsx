"use client";

import {
  resizeCalendarAssignment,
  splitCalendarAssignment,
  updateCalendarReservationDetails,
  setCalendarAssignmentLock,
} from "@/app/actions/erp-calendar";
import {
  fetchStayHubCheckIn,
  fetchStayHubMoney,
  fetchStayHubSummary,
  type StayHubCheckInPayload,
  type StayHubMoneyPayload,
  type StayHubSummary,
} from "@/app/actions/stay-hub";
import type { CalendarAgent } from "@/components/erp/CalendarReservationDialog";
import { AgentPicker } from "@/components/erp/AgentPicker";
import { StaffPicker, type BookableStaff } from "@/components/erp/StaffPicker";
import { AgentVoucherEmailButton } from "@/components/erp/AgentVoucherEmailButton";
import { BookingLifecycleActions } from "@/components/erp/BookingLifecycleActions";
import { CheckInForm, CheckOutForm } from "@/components/erp/CheckInForm";
import {
  FastBookVoucher,
  type FastBookVoucherData,
} from "@/components/erp/FastBookVoucher";
import { FolioPaymentForm } from "@/components/erp/FolioPaymentForm";
import {
  IssueInvoiceButton,
  PostCheckInChargesForm,
  PostRoomNightForm,
} from "@/components/erp/FolioOpsForms";
import { InhouseTaskQuickForm } from "@/components/erp/InhouseTasksPanel";
import type { RackStay, RackUnit } from "@/components/erp/RoomRackGrid";
import { StayMoneyCycleLegend } from "@/components/erp/StayMoneyCycleLegend";
import {
  StayHubFooterBar,
  StayHubHeader,
  StayHubSummaryCard,
  StayHubWorkFrame,
} from "@/components/erp/stay-hub/StayHubChrome";
import { useDebouncedAutoSave } from "@/components/erp/stay-hub/use-debounced-auto-save";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildStayHubSteps,
  recommendStayHubStep,
  stayHubTerminal,
  type StayHubStepId,
} from "@/lib/folio/stay-hub-cycle";
import { panelDescription } from "@/lib/folio/stay-hub-format";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  ChevronDownIcon,
  FileTextIcon,
  LockIcon,
  UnlockIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";

const selectClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] sm:h-9";

/** Seed shape from room rack (assignment-centric). */
export type StayHubSeedStay = RackStay;

type Draft = {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  adults: string;
  guideNumber: string;
  guestOrigin: string;
  source: string;
  agentId: string;
  soldByStaffId: string;
  notes: string;
};

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Lifecycle rank — seed rehydrate must not downgrade past DB truth. */
function bookingStatusRank(status: string): number {
  switch ((status ?? "").toLowerCase()) {
    case "expired":
    case "cancelled":
    case "no_show":
      return 100;
    case "checked_out":
      return 50;
    case "checked_in":
      return 40;
    case "confirmed":
      return 30;
    case "pending":
    case "held":
      return 20;
    default:
      return 0;
  }
}

function mergeSeedStatus(prevStatus: string, seedStatus: string): string {
  if (bookingStatusRank(seedStatus) >= bookingStatusRank(prevStatus)) {
    return seedStatus;
  }
  return prevStatus;
}

function summaryFromSeed(stay: StayHubSeedStay): StayHubSummary {
  return {
    bookingId: stay.booking_id,
    contactName: stay.contact_name,
    contactPhone: stay.contact_phone,
    contactEmail: stay.contact_email,
    status: stay.status,
    checkIn: stay.check_in,
    checkOut: stay.check_out,
    adults: stay.adults,
    rooms: stay.rooms,
    guideNumber: stay.guide_number,
    guestOrigin: stay.guest_origin,
    source: stay.booked_by_role || stay.source,
    agentId: stay.agent_id,
    agentName: stay.agent_name,
    soldByStaffId: stay.sold_by_staff_id ?? null,
    soldByName: stay.sold_by_name ?? null,
    salesClaimStatus: stay.sales_claim_status ?? null,
    notes: stay.notes,
    paymentMode: stay.payment_mode,
    sdfIncomplete: stay.sdf_incomplete === true,
    hasRoomAssigned: Boolean(stay.room_unit_id),
    assignmentId: stay.id,
    roomUnitId: stay.room_unit_id,
    roomLabel: stay.room_label,
    roomTypeId: stay.room_type_id,
    roomTypeName: stay.room_type_name,
    folioId: stay.folio_id,
    folioBalance: Number(stay.folio_balance ?? 0),
    isLocked: stay.is_locked,
    earlyCheckoutFeeBtn: null,
    lateCheckoutFeeBtn: null,
  };
}

function draftFromSummary(s: StayHubSummary): Draft {
  return {
    contactName: s.contactName ?? "",
    contactPhone: s.contactPhone ?? "",
    contactEmail: s.contactEmail ?? "",
    adults: String(s.adults),
    guideNumber: s.guideNumber ?? "",
    guestOrigin: s.guestOrigin ?? "international",
    source: s.source || "reservation",
    agentId: s.agentId ?? "",
    soldByStaffId: s.soldByStaffId ?? "",
    notes: s.notes ?? "",
  };
}

/**
 * Open-panel resolve: domain recommendation first for in-house guests.
 * A stale preferredStep/seed must not dump a checked-in stay onto Reserve form.
 */
function resolveOpenPanel(
  s: StayHubSummary,
  stepHint: StayHubStepId | null | undefined,
  board: "arrivals" | "in_house" | "departures" | "reservations" | "auto",
): StayHubStepId {
  let recommended =
    stepHint ??
    recommendStayHubStep({
      status: s.status,
      hasRoomAssigned: s.hasRoomAssigned,
      sdfIncomplete: s.sdfIncomplete,
      hasFolio: Boolean(s.folioId),
      balanceBtn: s.folioBalance,
      board: board ?? "auto",
    });

  const st = (s.status ?? "").toLowerCase();

  // Holds: never land past Confirm for edit surface.
  if (
    (st === "held" || st === "pending") &&
    recommended !== "reserve" &&
    recommended !== "confirm"
  ) {
    recommended = "confirm";
  }

  // In-house: ignore reserve/confirm/arrival/check_in seed/URL hints when
  // domain says Stay/Money or Check-out — fixes progress vs body mismatch.
  if (st === "checked_in") {
    const domain = recommendStayHubStep({
      status: s.status,
      hasRoomAssigned: s.hasRoomAssigned,
      sdfIncomplete: s.sdfIncomplete,
      hasFolio: Boolean(s.folioId),
      balanceBtn: s.folioBalance,
      board: board ?? "auto",
    });
    const early = (
      ["reserve", "confirm", "arrival", "check_in"] as StayHubStepId[]
    ).includes(recommended);
    if (early && (domain === "stay_money" || domain === "check_out")) {
      recommended = domain;
    }
  }

  return recommended;
}

export function StayHubDialog({
  open,
  onOpenChange,
  bookingId,
  assignmentId = null,
  preferredStep = null,
  seedStay = null,
  agents: agentsProp = [],
  staff: staffProp = [],
  units: unitsProp = [],
  board = "auto",
  onToggleLock,
  parentPending = false,
  onPreferredStepConsumed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string | null;
  assignmentId?: string | null;
  preferredStep?: StayHubStepId | null;
  seedStay?: StayHubSeedStay | null;
  agents?: CalendarAgent[];
  staff?: BookableStaff[];
  units?: RackUnit[];
  board?: "arrivals" | "in_house" | "departures" | "reservations" | "auto";
  onToggleLock?: (stay: StayHubSeedStay) => void;
  parentPending?: boolean;
  onPreferredStepConsumed?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const busy = pending || parentPending;

  const [summary, setSummary] = useState<StayHubSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [splitDate, setSplitDate] = useState("");
  const [splitUnitId, setSplitUnitId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [panel, setPanel] = useState<StayHubStepId>("reserve");
  const [lockHint, setLockHint] = useState<string | null>(null);
  const [money, setMoney] = useState<StayHubMoneyPayload | null>(null);
  const [checkInPayload, setCheckInPayload] =
    useState<StayHubCheckInPayload | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error" | null
  >("idle");
  const collectPayRef = useRef<HTMLDivElement | null>(null);
  const postChargesRef = useRef<HTMLDivElement | null>(null);

  const agents = agentsProp;
  const staff = staffProp;
  const units = unitsProp;

  /** Bound to booking id only — never reset panel on summary rehydrate. */
  const sessionBookingIdRef = useRef<string | null>(null);
  const draftDirtyRef = useRef(false);
  /** After server fetch is trustworthy, seed must not overwrite lifecycle status. */
  const serverTruthRef = useRef(false);
  const prevStatusRef = useRef<string | null>(null);
  /** Once-per-open auto-land for checked_in vs stale reserve panel. */
  const openLandedRef = useRef(false);

  const applySummary = useCallback(
    (s: StayHubSummary, resetPanel: boolean, stepHint?: StayHubStepId | null) => {
      setSummary(s);
      if (!draftDirtyRef.current) {
        setDraft(draftFromSummary(s));
        setCheckIn(s.checkIn);
        setCheckOut(s.checkOut);
        setSplitDate(addDays(s.checkIn, 1));
      }
      if (resetPanel) {
        draftDirtyRef.current = false;
        setDraft(draftFromSummary(s));
        setCheckIn(s.checkIn);
        setCheckOut(s.checkOut);
        setSplitDate(addDays(s.checkIn, 1));
        setSplitUnitId("");
        setMessage(null);
        setVoucherOpen(false);
        setLockHint(null);
        setMoney(null);
        setCheckInPayload(null);
        setPanel(resolveOpenPanel(s, stepHint, board ?? "auto"));
        onPreferredStepConsumed?.();
      }
    },
    [board, onPreferredStepConsumed],
  );

  const handleCheckedIn = useCallback(
    (payload: { bookingId: string; folioId?: string }) => {
      const id = payload.bookingId;
      startTransition(async () => {
        const result = await fetchStayHubSummary(id, assignmentId);
        if (result.ok) {
          serverTruthRef.current = true;
          applySummary(result.data, false);
          setSummary((prev) =>
            prev
              ? {
                  ...prev,
                  status: result.data.status,
                  folioId: result.data.folioId ?? payload.folioId ?? prev.folioId,
                  folioBalance: result.data.folioBalance,
                  sdfIncomplete: result.data.sdfIncomplete,
                  hasRoomAssigned: result.data.hasRoomAssigned,
                }
              : result.data,
          );
        } else if (payload.folioId) {
          setSummary((prev) =>
            prev
              ? {
                  ...prev,
                  status: "checked_in",
                  folioId: payload.folioId ?? prev.folioId,
                }
              : prev,
          );
        }
        setPanel("stay_money");
        setLockHint(null);
        setMessage("Checked in — continue Stay / Money");
        const moneyResult = await fetchStayHubMoney(id);
        if (moneyResult.ok) setMoney(moneyResult.data);
        router.refresh();
      });
    },
    [applySummary, assignmentId, router],
  );

  // Open / bookingId change
  useEffect(() => {
    if (!open || !bookingId) {
      sessionBookingIdRef.current = null;
      serverTruthRef.current = false;
      prevStatusRef.current = null;
      openLandedRef.current = false;
      setSummary(null);
      setDraft(null);
      setLoadError(null);
      return;
    }

    const isNewOpen = sessionBookingIdRef.current !== bookingId;
    sessionBookingIdRef.current = bookingId;
    if (isNewOpen) {
      serverTruthRef.current = false;
      prevStatusRef.current = null;
      openLandedRef.current = false;
    }

    if (isNewOpen && seedStay && seedStay.booking_id === bookingId) {
      applySummary(summaryFromSeed(seedStay), true, preferredStep);
    } else if (isNewOpen) {
      setSummary(null);
      setDraft(null);
      setLoadError(null);
    }

    let cancelled = false;
    fetchStayHubSummary(bookingId, assignmentId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      serverTruthRef.current = true;
      // Same id rehydrate: update summary for strip truth; keep panel/draft if dirty
      applySummary(result.data, isNewOpen, preferredStep);
    });

    return () => {
      cancelled = true;
    };
    // seedStay intentionally only seeds on new open id — not every rehydrate
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stay thrash fix: key by bookingId/open only
  }, [open, bookingId, assignmentId]);

  // Seed rehydrate: room/label/lock only after server truth; never downgrade status
  useEffect(() => {
    if (!open || !bookingId || !seedStay) return;
    if (seedStay.booking_id !== bookingId) return;
    if (sessionBookingIdRef.current !== bookingId) return;
    setSummary((prev) => {
      if (!prev) return summaryFromSeed(seedStay);
      // Never downgrade lifecycle (stale arrivals/rack list after check-in)
      const status = mergeSeedStatus(prev.status, seedStay.status);
      return {
        ...prev,
        status,
        // After check-in, keep SDF badge from server truth when seed still stale
        sdfIncomplete:
          prev.status === "checked_in" || prev.status === "checked_out"
            ? prev.sdfIncomplete
            : seedStay.sdf_incomplete === true,
        folioId: seedStay.folio_id ?? prev.folioId,
        folioBalance: Number(seedStay.folio_balance ?? prev.folioBalance),
        isLocked: seedStay.is_locked,
        contactName: draftDirtyRef.current
          ? prev.contactName
          : seedStay.contact_name,
        roomLabel: seedStay.room_label,
        checkIn: draftDirtyRef.current ? prev.checkIn : seedStay.check_in,
        checkOut: draftDirtyRef.current ? prev.checkOut : seedStay.check_out,
      };
    });
  }, [open, bookingId, seedStay]);

  // When status transitions into checked_in, land on Stay / Money once
  useEffect(() => {
    if (!open || !summary) return;
    const prev = prevStatusRef.current;
    const cur = summary.status;
    prevStatusRef.current = cur;
    if (
      prev &&
      ["pending", "confirmed", "held"].includes(prev) &&
      cur === "checked_in" &&
      (panel === "arrival" || panel === "check_in" || panel === "reserve")
    ) {
      setPanel("stay_money");
      setLockHint(null);
    }
  }, [open, summary?.status, panel, summary]);

  /**
   * Once-per-open safety: if progress already treats Stay/Money as current
   * (checked_in) but panel is still Reserve (seed race / preferredStep), snap.
   * User may still click Reserve after landing — flag prevents re-snapping.
   */
  useEffect(() => {
    if (!open || !summary || !bookingId) return;
    if (openLandedRef.current) return;

    const st = (summary.status ?? "").toLowerCase();
    if (st !== "checked_in") {
      // Wait for checked_in truth (or mark landed after server confirmed non-house)
      if (serverTruthRef.current) openLandedRef.current = true;
      return;
    }

    openLandedRef.current = true;
    const domain = recommendStayHubStep({
      status: summary.status,
      hasRoomAssigned: summary.hasRoomAssigned,
      sdfIncomplete: summary.sdfIncomplete,
      hasFolio: Boolean(summary.folioId),
      balanceBtn: summary.folioBalance,
      board: board ?? "auto",
    });
    const early = (
      ["reserve", "confirm", "arrival", "check_in"] as StayHubStepId[]
    ).includes(panel);
    if (early && (domain === "stay_money" || domain === "check_out")) {
      setPanel(domain);
      setLockHint(null);
    }
  }, [open, bookingId, summary, panel, board]);

  // Lazy-load panels
  useEffect(() => {
    if (!open || !bookingId) return;
    if (panel === "stay_money" || panel === "check_out") {
      fetchStayHubMoney(bookingId).then((r) => {
        if (r.ok) setMoney(r.data);
      });
    }
    if (
      (panel === "arrival" || panel === "check_in") &&
      summary &&
      ["pending", "confirmed"].includes(summary.status)
    ) {
      setCheckInLoading(true);
      fetchStayHubCheckIn(bookingId)
        .then((r) => {
          if (r.ok) setCheckInPayload(r.data);
          else setCheckInPayload(null);
        })
        .finally(() => setCheckInLoading(false));
    }
  }, [open, bookingId, panel, summary?.status]);

  const steps = useMemo(() => {
    if (!summary) return [];
    return buildStayHubSteps({
      status: summary.status,
      hasRoomAssigned: summary.hasRoomAssigned,
      sdfIncomplete: summary.sdfIncomplete,
      hasFolio: Boolean(summary.folioId || money?.folioId),
      hasCharges: money?.hasCharges,
      hasInvoice: money?.hasInvoice,
      balanceBtn: money?.balanceBtn ?? summary.folioBalance,
    });
  }, [summary, money]);

  const terminal = summary ? stayHubTerminal(summary.status) : null;

  const sameTypeUnits = useMemo(
    () =>
      units.filter(
        (unit) =>
          summary?.roomTypeId &&
          unit.room_type_id === summary.roomTypeId &&
          unit.id !== summary.roomUnitId,
      ),
    [summary, units],
  );

  const handleStepClick = (
    id: StayHubStepId,
    locked: boolean,
    reason?: string,
  ) => {
    // Allow viewing done/current/previous and stay_money/check_out when in-house
    const step = steps.find((s) => s.id === id);
    const status = summary?.status ?? "";
    const allowAlways =
      status === "checked_in" &&
      (id === "stay_money" || id === "check_out" || id === "reserve");
    if (locked && !allowAlways && step && !step.done && !step.current) {
      setLockHint(reason ?? "Complete earlier steps first");
      return;
    }
    setLockHint(null);
    setPanel(id);
  };

  const serializeDraft = useCallback((d: Draft) => JSON.stringify(d), []);

  useDebouncedAutoSave({
    value: draft ?? {
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      adults: "1",
      guideNumber: "",
      guestOrigin: "international",
      source: "reservation",
      agentId: "",
      soldByStaffId: "",
      notes: "",
    },
    enabled: Boolean(open && bookingId && draft && summary && !terminal),
    serialize: serializeDraft,
    onStatus: setSaveStatus,
    successMessage: "Guest details saved",
    save: async (d) => {
      if (!summary || !bookingId) return { ok: false, error: "No booking" };
      const result = await updateCalendarReservationDetails({
        bookingId: summary.bookingId,
        contactName: d.contactName,
        contactPhone: d.contactPhone,
        contactEmail: d.contactEmail,
        adults: Number(d.adults) || 1,
        guideNumber: d.guideNumber,
        guestOrigin: d.guestOrigin,
        source: d.source,
        agentId: d.agentId,
        notes: d.notes,
        soldByStaffId: d.soldByStaffId,
      });
      if (result.ok) {
        draftDirtyRef.current = false;
        // Soft refresh lists without flicker storm
        router.refresh();
      }
      return {
        ok: Boolean(result.ok),
        error: result.error,
        message: result.message,
      };
    },
  });

  // Debounced date resize when assignment exists
  const dateKey = `${checkIn}|${checkOut}`;
  const lastDateKey = useRef<string | null>(null);
  useEffect(() => {
    lastDateKey.current = null;
  }, [bookingId]);
  useEffect(() => {
    if (!open || !summary?.assignmentId || summary.isLocked) return;
    if (!checkIn || !checkOut) return;
    if (lastDateKey.current === null) {
      lastDateKey.current = `${summary.checkIn}|${summary.checkOut}`;
      return;
    }
    if (dateKey === lastDateKey.current) return;
    if (dateKey === `${summary.checkIn}|${summary.checkOut}`) {
      lastDateKey.current = dateKey;
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        setSaveStatus("saving");
        const result = await resizeCalendarAssignment(
          summary.assignmentId!,
          checkIn,
          checkOut,
        );
        if (result.ok) {
          lastDateKey.current = dateKey;
          setSaveStatus("saved");
          toast.success(result.message ?? "Dates updated");
          router.refresh();
          window.setTimeout(() => setSaveStatus("idle"), 1800);
        } else {
          setSaveStatus("error");
          toast.error(result.error ?? "Could not update dates");
        }
      })();
    }, 800);
    return () => clearTimeout(t);
  }, [
    open,
    dateKey,
    checkIn,
    checkOut,
    summary?.assignmentId,
    summary?.checkIn,
    summary?.checkOut,
    summary?.isLocked,
    router,
  ]);

  if (!open || !bookingId) return null;

  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    draftDirtyRef.current = true;
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const dues = Number(money?.balanceBtn ?? summary?.folioBalance ?? 0);
  const titleName = summary?.contactName ?? seedStay?.contact_name ?? "Stay";
  const folioId = money?.folioId || summary?.folioId || null;
  const panelLabel = steps.find((s) => s.id === panel)?.label ?? "Stay";
  const isInHouse = summary?.status === "checked_in";
  const showContextRail =
    Boolean(summary) &&
    (isInHouse || panel === "stay_money" || panel === "check_out");

  const scrollToCollect = () => {
    collectPayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const scrollToPostCharges = () => {
    postChargesRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const primaryCta = (() => {
    if (!summary) return null;

    // Guest fields auto-save — no Save button on reserve/confirm
    if (panel === "reserve" || panel === "confirm") {
      return null;
    }

    if (panel === "check_in" || panel === "arrival") {
      return null;
    }

    if (panel === "stay_money" && isInHouse) {
      if (folioId && !money?.hasCharges) {
        return (
          <Button
            type="button"
            variant="citrus"
            className="min-h-11 flex-1 sm:flex-none"
            onClick={scrollToPostCharges}
          >
            Post charges
          </Button>
        );
      }
      if (dues > 0.5) {
        return (
          <Button
            type="button"
            variant="citrus"
            className="min-h-11 flex-1 sm:flex-none"
            onClick={scrollToCollect}
            disabled={!folioId}
          >
            Collect payment
          </Button>
        );
      }
      return (
        <Button
          type="button"
          variant="citrus"
          className="min-h-11 flex-1 sm:flex-none"
          onClick={() => setPanel("check_out")}
        >
          Check out
        </Button>
      );
    }

    if (panel === "check_out" && isInHouse && dues > 0.5) {
      return (
        <Button
          type="button"
          variant="citrus"
          className="min-h-11 flex-1 sm:flex-none"
          onClick={() => setPanel("stay_money")}
        >
          Collect payment
        </Button>
      );
    }

    return null;
  })();

  const headerAlerts: Array<{
    key: string;
    label: string;
    tone: "warn" | "danger" | "info";
  }> = [];
  if (summary) {
    if (!summary.hasRoomAssigned || !summary.roomLabel) {
      headerAlerts.push({
        key: "unassigned",
        label: "Unassigned",
        tone: "danger",
      });
    }
    if (summary.isLocked) {
      headerAlerts.push({ key: "lock", label: "Room locked", tone: "warn" });
    }
    if (dues > 0.5) {
      headerAlerts.push({
        key: "dues",
        label: `Dues ${formatBtn(dues)}`,
        tone: "warn",
      });
    }
    if (summary.sdfIncomplete) {
      headerAlerts.push({
        key: "sdf",
        label: "SDF incomplete",
        tone: "danger",
      });
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton
          className={cn(
            "erp flex flex-col gap-0 overflow-hidden p-0",
            // Phone: full viewport sheet
            "top-auto bottom-0 left-0 right-0 h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0",
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            // Tablet+
            "md:top-[50%] md:bottom-auto md:left-[50%] md:right-auto md:h-auto md:max-h-[90vh] md:w-full md:max-w-3xl md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-lg md:border",
            "lg:max-w-4xl",
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          )}
        >
          <DialogTitle className="sr-only">
            Stay hub · {titleName}
          </DialogTitle>
          {/* —— A. Sticky header chrome —— */}
          <div className="contents">
            <StayHubHeader
              guestName={titleName}
              status={summary?.status}
              roomLabel={summary?.roomLabel}
              roomTypeName={summary?.roomTypeName}
              checkIn={summary?.checkIn}
              checkOut={summary?.checkOut}
              bookingId={summary?.bookingId}
              alerts={headerAlerts}
              steps={steps}
              panel={panel}
              terminal={terminal}
              saveStatus={saveStatus}
              lockHint={lockHint}
              onStepClick={handleStepClick}
            />
          </div>

          {/* —— B. Scrollable work area —— */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 md:px-5 md:py-4">
            {loadError ? (
              <p className="text-sm text-destructive">{loadError}</p>
            ) : !summary || !draft ? (
              <p className="text-sm text-muted-foreground">Loading stay…</p>
            ) : (
              <div
                className={cn(
                  showContextRail &&
                    "md:grid md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] md:items-start md:gap-4 lg:grid-cols-[minmax(0,13.5rem)_minmax(0,1fr)]",
                )}
              >
                {showContextRail ? (
                  <StayHubSummaryCard
                    balanceDue={dues}
                    agentName={money?.agentName || summary.agentName}
                    paymentMode={money?.paymentMode ?? summary.paymentMode}
                    folioId={folioId}
                    roomLabel={summary.roomLabel}
                    roomTypeName={summary.roomTypeName}
                    nextAction={
                      panel === "check_out"
                        ? dues > 0.5
                          ? "Settle before check-out"
                          : "Complete departure"
                        : !folioId
                          ? "Folio opens at check-in"
                          : !money?.hasCharges
                            ? "Post room / day charges"
                            : dues > 0.5
                              ? "Collect open balance"
                              : "Ready for check-out"
                    }
                  />
                ) : null}

                <StayHubWorkFrame
                  title={panelLabel}
                  description={panelDescription(panel)}
                >
                <div className="min-w-0 space-y-4">
                  {(panel === "reserve" || panel === "confirm") && (
                    <div className="space-y-4">
                      {panel === "confirm" &&
                      (summary.status === "held" ||
                        summary.status === "pending") ? (
                        <Callout tone="amber" title="Hold / confirmation pending">
                          Confirm token via lifecycle actions below, then
                          continue to arrival docs.
                        </Callout>
                      ) : null}

                      <WorkSection title="Guest identity">
                        <GuestIdentityFields
                          draft={draft}
                          agents={agents}
                          staff={staff}
                          salesClaimStatus={summary.salesClaimStatus}
                          onUpdate={updateDraft}
                        />
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Changes save automatically as you type.
                        </p>
                      </WorkSection>

                      {summary.assignmentId ? (
                        <WorkSection title="Stay dates">
                          <StayDatesAndSplit
                            summary={summary}
                            checkIn={checkIn}
                            checkOut={checkOut}
                            setCheckIn={(v) => {
                              draftDirtyRef.current = true;
                              setCheckIn(v);
                            }}
                            setCheckOut={(v) => {
                              draftDirtyRef.current = true;
                              setCheckOut(v);
                            }}
                            splitDate={splitDate}
                            setSplitDate={setSplitDate}
                            splitUnitId={splitUnitId}
                            setSplitUnitId={setSplitUnitId}
                            sameTypeUnits={sameTypeUnits}
                            busy={busy}
                            seedStay={seedStay}
                            onToggleLock={onToggleLock}
                            onMessage={setMessage}
                            onRefresh={() => router.refresh()}
                            startTransition={startTransition}
                          />
                        </WorkSection>
                      ) : null}

                      {!terminal ? (
                        <WorkSection title="Cancel / no-show">
                          <BookingLifecycleActions
                            bookingId={summary.bookingId}
                            status={summary.status}
                          />
                        </WorkSection>
                      ) : null}
                    </div>
                  )}

                  {(panel === "arrival" || panel === "check_in") && (
                    <div className="space-y-4">
                      <WorkSection
                        title={
                          panel === "arrival" ? "Arrival readiness" : "Check-in"
                        }
                      >
                        {["pending", "confirmed"].includes(summary.status) ? (
                          checkInLoading ? (
                            <p className="text-sm text-muted-foreground">
                              Loading check-in form…
                            </p>
                          ) : checkInPayload ? (
                            <CheckInForm
                              booking={checkInPayload.booking}
                              guides={checkInPayload.guides}
                              drivers={checkInPayload.drivers}
                              slots={checkInPayload.slots}
                              units={checkInPayload.units}
                              embedded
                              onCheckedIn={handleCheckedIn}
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Could not load check-in form for this stay.
                            </p>
                          )
                        ) : summary.status === "checked_in" ? (
                          <p className="text-sm text-muted-foreground">
                            Already checked in. Continue on Stay / Money or
                            Check-out.
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Check-in not available for status{" "}
                            {summary.status.replace(/_/g, " ")}.
                          </p>
                        )}
                      </WorkSection>
                    </div>
                  )}

                  {panel === "stay_money" && (
                    <div className="space-y-4">
                      <WorkSection title="Balances">
                        <p className="mb-3 text-xs text-muted-foreground">
                          One folio for this stay. Agent room package vs guest
                          extras follow booking payment mode.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg border bg-card p-3 sm:p-4">
                            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                              Agent (room)
                            </p>
                            <p className="mt-1.5 text-sm font-medium">
                              {money?.agentName ||
                                summary.agentName ||
                                "No agent"}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Mode:{" "}
                              {(
                                money?.paymentMode ??
                                summary.paymentMode ??
                                "unset"
                              ).replace(/_/g, " ")}
                            </p>
                          </div>
                          <div className="rounded-lg border bg-card p-3 sm:p-4">
                            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                              Guest (extras)
                            </p>
                            <p
                              className={cn(
                                "mt-1.5 text-xl font-semibold tabular-nums",
                                dues > 0.5 && "text-maroon",
                              )}
                            >
                              {dues > 0.5
                                ? `Nu ${Math.round(dues).toLocaleString()}`
                                : "Clear"}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Open total on folio
                            </p>
                          </div>
                        </div>
                      </WorkSection>

                      {folioId ? (
                        <>
                          {isInHouse && !money?.hasCharges ? (
                            <div ref={postChargesRef}>
                              <WorkSection title="Post charges">
                                <PostCheckInChargesForm
                                  folioId={folioId}
                                  defaultDate={summary.checkIn}
                                />
                              </WorkSection>
                            </div>
                          ) : null}
                          {isInHouse ? (
                            <WorkSection title="Room night">
                              <PostRoomNightForm
                                folioId={folioId}
                                defaultDate={summary.checkIn}
                              />
                            </WorkSection>
                          ) : null}
                          <div ref={collectPayRef} id="hub-collect">
                            <WorkSection title="Collect payment">
                              <FolioPaymentForm
                                folioId={folioId}
                                suggestedAmount={Math.max(0, dues)}
                              />
                            </WorkSection>
                          </div>
                          <WorkSection title="Invoice">
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                              <IssueInvoiceButton
                                folioId={folioId}
                                invoiceNo={money?.invoiceNo}
                                invoiceDocId={money?.invoiceDocId}
                              />
                              <Button
                                asChild
                                variant="outline"
                                className="min-h-11 sm:w-auto"
                              >
                                <Link href={`/erp/folios/${folioId}/receipt`}>
                                  Print receipt
                                </Link>
                              </Button>
                              <Button
                                asChild
                                variant="ghost"
                                className="min-h-11 sm:w-auto"
                              >
                                <Link href={`/erp/folios/${folioId}`}>
                                  Open city ledger
                                </Link>
                              </Button>
                            </div>
                            <div className="mt-3">
                              <StayMoneyCycleLegend compact />
                            </div>
                          </WorkSection>
                        </>
                      ) : (
                        <Callout tone="muted" title="No folio yet">
                          Folio opens at check-in. Day-1 room may post then;
                          later nights at night audit. F&B posts when ordered.
                        </Callout>
                      )}

                      <WorkSection title="Agent voucher">
                        <div className="flex items-start gap-2">
                          <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            {summary.agentId ? (
                              <div className="flex flex-wrap gap-2">
                                <AgentVoucherEmailButton
                                  bookingId={summary.bookingId}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="min-h-11"
                                  onClick={() => setVoucherOpen(true)}
                                >
                                  Print voucher
                                </Button>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Assign an agent on Reserve to email or print a
                                voucher (not a tax invoice).
                              </p>
                            )}
                          </div>
                        </div>
                      </WorkSection>

                      {/* Guest edit secondary — collapsed by default for in-house */}
                      <details
                        className="group rounded-lg border bg-muted/15 open:bg-card"
                        open={!isInHouse}
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
                          <span>Guest details</span>
                          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="border-t px-3 py-3">
                          <GuestIdentityFields
                            draft={draft}
                            agents={agents}
                            staff={staff}
                            salesClaimStatus={summary.salesClaimStatus}
                            onUpdate={updateDraft}
                          />
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Edits save automatically.
                          </p>
                        </div>
                      </details>
                    </div>
                  )}

                  {panel === "check_out" && (
                    <div className="space-y-4">
                      {isInHouse ? (
                        <>
                          {folioId && dues > 0.5 ? (
                            <Callout
                              tone="amber"
                              title={`Balance still open (${formatBtn(dues)})`}
                            >
                              Collect on Stay / Money, or allow balance on
                              check-out with reason.
                              <Button
                                type="button"
                                variant="outline"
                                className="mt-2 min-h-11"
                                onClick={() => setPanel("stay_money")}
                              >
                                Go to Stay / Money
                              </Button>
                            </Callout>
                          ) : null}
                          <WorkSection title="Check-out">
                            <CheckOutForm
                              bookingId={summary.bookingId}
                              rooms={
                                money?.roomLabels?.length
                                  ? money.roomLabels
                                  : summary.roomLabel
                                    ? [summary.roomLabel]
                                    : []
                              }
                              folioBalance={dues}
                              earlyFeeDefaultBtn={summary.earlyCheckoutFeeBtn}
                              lateFeeDefaultBtn={summary.lateCheckoutFeeBtn}
                            />
                          </WorkSection>
                          <WorkSection title="In-house task">
                            <InhouseTaskQuickForm
                              bookingId={summary.bookingId}
                            />
                          </WorkSection>
                        </>
                      ) : summary.status === "checked_out" ? (
                        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm">
                          <CheckIcon className="size-4 text-emerald-600" />
                          Checked out.
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Check-out after the guest is in-house.
                        </p>
                      )}
                    </div>
                  )}

                  {message ? (
                    <p
                      role="status"
                      className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
                    >
                      {message}
                    </p>
                  ) : null}
                </div>
                </StayHubWorkFrame>
              </div>
            )}
          </div>

          {/* —— C. Sticky footer —— */}
          <StayHubFooterBar
            panelLabel={panelLabel}
            onClose={() => onOpenChange(false)}
            primaryCta={primaryCta}
          />
        </DialogContent>
      </Dialog>

      {summary ? (
        <Dialog open={voucherOpen} onOpenChange={setVoucherOpen}>
          <DialogContent className="erp max-h-[92vh] overflow-y-auto sm:max-w-xl print:max-w-none">
            <DialogHeader className="print:hidden">
              <DialogTitle>Agent voucher</DialogTitle>
              <DialogDescription>
                Quote / voucher print — not the tax invoice.
              </DialogDescription>
            </DialogHeader>
            <FastBookVoucher data={voucherFromSummary(summary)} />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

/* ─── Workspace subcomponents ─────────────────────────────────────────── */

function WorkSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card p-3.5 shadow-sm sm:p-4",
        className,
      )}
    >
      <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Callout({
  tone,
  title,
  children,
}: {
  tone: "amber" | "muted";
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        tone === "amber" &&
          "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20",
        tone === "muted" && "bg-muted/20",
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-1 text-xs text-muted-foreground">{children}</div>
    </div>
  );
}

function GuestIdentityFields({
  draft,
  agents,
  staff,
  salesClaimStatus,
  onUpdate,
}: {
  draft: Draft;
  agents: CalendarAgent[];
  staff: BookableStaff[];
  salesClaimStatus?: string | null;
  onUpdate: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Guest / lead name" id="hub_contact_name">
        <Input
          id="hub_contact_name"
          className="min-h-11 sm:min-h-9"
          value={draft.contactName}
          onChange={(e) => onUpdate("contactName", e.target.value)}
        />
      </Field>
      <Field label="Phone" id="hub_contact_phone">
        <Input
          id="hub_contact_phone"
          className="min-h-11 sm:min-h-9"
          value={draft.contactPhone}
          onChange={(e) => onUpdate("contactPhone", e.target.value)}
        />
      </Field>
      <Field label="Email" id="hub_contact_email">
        <Input
          id="hub_contact_email"
          type="email"
          className="min-h-11 sm:min-h-9"
          value={draft.contactEmail}
          onChange={(e) => onUpdate("contactEmail", e.target.value)}
        />
      </Field>
      <Field label="Adults" id="hub_adults">
        <Input
          id="hub_adults"
          type="number"
          min={1}
          max={48}
          className="min-h-11 sm:min-h-9"
          value={draft.adults}
          onChange={(e) => onUpdate("adults", e.target.value)}
        />
      </Field>
      <Field label="Guide #" id="hub_guide">
        <Input
          id="hub_guide"
          className="min-h-11 sm:min-h-9"
          value={draft.guideNumber}
          onChange={(e) => onUpdate("guideNumber", e.target.value)}
        />
      </Field>
      <Field label="Guest origin" id="hub_origin">
        <select
          id="hub_origin"
          value={draft.guestOrigin}
          onChange={(e) => onUpdate("guestOrigin", e.target.value)}
          className={selectClass}
        >
          <option value="international">International</option>
          <option value="regional">Regional</option>
          <option value="official">Official</option>
          <option value="local">Local</option>
        </select>
      </Field>
      <Field label="Booked by" id="hub_source">
        <select
          id="hub_source"
          value={draft.source}
          onChange={(e) => onUpdate("source", e.target.value)}
          className={selectClass}
        >
          <option value="reservation">Reservation desk</option>
          <option value="owner">Owner</option>
          <option value="agent">Agent</option>
          <option value="mou_agent">MoU agent</option>
        </select>
      </Field>
      <Field label="Agent" id="hub_agent">
        <AgentPicker
          agents={agents}
          value={draft.agentId}
          onValueChange={(next) => onUpdate("agentId", next)}
          className="bg-background min-h-11 sm:min-h-9"
        />
      </Field>
      <Field label="Sold by (staff)" id="hub_sold_by">
        <StaffPicker
          staff={staff}
          value={draft.soldByStaffId}
          onValueChange={(next) => onUpdate("soldByStaffId", next)}
          className="bg-background min-h-11 sm:min-h-9"
          disabled={salesClaimStatus === "approved"}
        />
        {salesClaimStatus ? (
          <p className="mt-1 text-[11px] text-muted-foreground capitalize">
            Claim: {salesClaimStatus}
            {salesClaimStatus === "approved"
              ? " · clear only via Owner/GM reject"
              : ""}
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Incentive credit — Owner/GM approves on Sales claims.
          </p>
        )}
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notes" id="hub_notes">
          <Textarea
            id="hub_notes"
            rows={3}
            value={draft.notes}
            onChange={(e) => onUpdate("notes", e.target.value)}
            className="min-h-[4.5rem] resize-y"
          />
        </Field>
      </div>
    </div>
  );
}

function StayDatesAndSplit({
  summary,
  checkIn,
  checkOut,
  setCheckIn,
  setCheckOut,
  splitDate,
  setSplitDate,
  splitUnitId,
  setSplitUnitId,
  sameTypeUnits,
  busy,
  seedStay,
  onToggleLock,
  onMessage,
  onRefresh,
  startTransition,
}: {
  summary: StayHubSummary;
  checkIn: string;
  checkOut: string;
  setCheckIn: (v: string) => void;
  setCheckOut: (v: string) => void;
  splitDate: string;
  setSplitDate: (v: string) => void;
  splitUnitId: string;
  setSplitUnitId: (v: string) => void;
  sameTypeUnits: RackUnit[];
  busy: boolean;
  seedStay: StayHubSeedStay | null;
  onToggleLock?: (stay: StayHubSeedStay) => void;
  onMessage: (m: string | null) => void;
  onRefresh: () => void;
  startTransition: (fn: () => void) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Check-in" id="hub_ci">
          <Input
            id="hub_ci"
            type="date"
            className="min-h-11 sm:min-h-9"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </Field>
        <Field label="Check-out" id="hub_co">
          <Input
            id="hub_co"
            type="date"
            className="min-h-11 sm:min-h-9"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </Field>
      </div>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={busy || summary.isLocked}
        onClick={() => {
          if (!summary.assignmentId) return;
          startTransition(async () => {
            const result = await resizeCalendarAssignment(
              summary.assignmentId!,
              checkIn,
              checkOut,
            );
            if (result.ok) {
              toast.success(result.message ?? "Dates updated");
              onRefresh();
            } else {
              toast.error(result.error ?? "Could not update dates");
              onMessage(result.error ?? null);
            }
          });
        }}
      >
        Apply dates now
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Dates also auto-save shortly after you change them.
      </p>

      {sameTypeUnits.length > 0 ? (
        <div className="space-y-3 border-t pt-3">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Split remaining nights
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Split from date" id="hub_split">
              <Input
                id="hub_split"
                type="date"
                className="min-h-11 sm:min-h-9"
                min={addDays(summary.checkIn, 1)}
                max={addDays(summary.checkOut, -1)}
                value={splitDate}
                onChange={(e) => setSplitDate(e.target.value)}
              />
            </Field>
            <Field label="Destination room" id="hub_split_unit">
              <select
                id="hub_split_unit"
                value={splitUnitId}
                onChange={(e) => setSplitUnitId(e.target.value)}
                className={selectClass}
              >
                <option value="">Select room</option>
                {sameTypeUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy || summary.isLocked || !splitUnitId}
            onClick={() => {
              if (!summary.assignmentId) return;
              startTransition(async () => {
                const result = await splitCalendarAssignment(
                  summary.assignmentId!,
                  splitDate,
                  splitUnitId,
                );
                onMessage(result.message ?? result.error ?? null);
                if (result.ok) onRefresh();
              });
            }}
          >
            Split stay
          </Button>
        </div>
      ) : null}

      <Button
        type="button"
        variant={summary.isLocked ? "outline" : "secondary"}
        disabled={busy}
        className="min-h-11 gap-2"
        onClick={() => {
          if (onToggleLock && seedStay) {
            onToggleLock(seedStay);
            return;
          }
          if (!summary.assignmentId) return;
          startTransition(async () => {
            await setCalendarAssignmentLock(
              summary.assignmentId!,
              !summary.isLocked,
            );
            onRefresh();
          });
        }}
      >
        {summary.isLocked ? (
          <UnlockIcon className="size-4" />
        ) : (
          <LockIcon className="size-4" />
        )}
        {summary.isLocked ? "Unlock room" : "Lock room assignment"}
      </Button>
    </div>
  );
}

function voucherFromSummary(s: StayHubSummary): FastBookVoucherData {
  const nights = Math.max(
    0,
    Math.round(
      (new Date(`${s.checkOut}T12:00:00Z`).getTime() -
        new Date(`${s.checkIn}T12:00:00Z`).getTime()) /
        86_400_000,
    ),
  );
  return {
    bookingId: s.bookingId,
    checkIn: s.checkIn,
    checkOut: s.checkOut,
    nights,
    guestName: s.contactName ?? "Guest",
    guestPhone: s.contactPhone ?? undefined,
    agentId: s.agentId ?? undefined,
    agentLabel: s.agentName ?? undefined,
    guideNumber: s.guideNumber ?? undefined,
    lines: [
      {
        name: s.roomTypeName ?? "Room",
        code: (s.roomTypeId ?? "room").slice(0, 8),
        qty: Math.max(1, s.rooms),
      },
    ],
  };
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
