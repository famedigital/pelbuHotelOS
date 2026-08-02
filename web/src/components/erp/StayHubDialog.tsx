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
import { StayMoneyProcessStrip } from "@/components/erp/StayMoneyProcessStrip";
import { StayProgressStrip } from "@/components/erp/StayProgressStrip";
import { Badge } from "@/components/ui/badge";
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
  buildStayMoneySubline,
  recommendStayHubStep,
  stayHubTerminal,
  type StayHubStepId,
} from "@/lib/folio/stay-hub-cycle";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
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
} from "react";

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
  notes: string;
};

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function statusBadgeVariant(
  status: string,
): "secondary" | "sky" | "citrus" | "gold" | "maroon" {
  if (status === "checked_in") return "citrus";
  if (status === "confirmed") return "sky";
  if (status === "held" || status === "pending") return "gold";
  return "secondary";
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
    notes: s.notes ?? "",
  };
}

export function StayHubDialog({
  open,
  onOpenChange,
  bookingId,
  assignmentId = null,
  preferredStep = null,
  seedStay = null,
  agents: agentsProp = [],
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

  const agents = agentsProp;
  const units = unitsProp;

  /** Bound to booking id only — never reset panel on summary rehydrate. */
  const sessionBookingIdRef = useRef<string | null>(null);
  const draftDirtyRef = useRef(false);

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
        const recommended =
          stepHint ??
          recommendStayHubStep({
            status: s.status,
            hasRoomAssigned: s.hasRoomAssigned,
            sdfIncomplete: s.sdfIncomplete,
            hasFolio: Boolean(s.folioId),
            balanceBtn: s.folioBalance,
            board: board ?? "auto",
          });
        setPanel(recommended);
        onPreferredStepConsumed?.();
      }
    },
    [board, onPreferredStepConsumed],
  );

  // Open / bookingId change
  useEffect(() => {
    if (!open || !bookingId) {
      sessionBookingIdRef.current = null;
      setSummary(null);
      setDraft(null);
      setLoadError(null);
      return;
    }

    const isNewOpen = sessionBookingIdRef.current !== bookingId;
    sessionBookingIdRef.current = bookingId;

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
      // Same id rehydrate: update summary for strip truth; keep panel/draft if dirty
      applySummary(result.data, isNewOpen, preferredStep);
    });

    return () => {
      cancelled = true;
    };
    // seedStay intentionally only seeds on new open id — not every rehydrate
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stay thrash fix: key by bookingId/open only
  }, [open, bookingId, assignmentId]);

  // When seedStay rehydrates from live rack for same open booking, refresh status only
  useEffect(() => {
    if (!open || !bookingId || !seedStay) return;
    if (seedStay.booking_id !== bookingId) return;
    if (sessionBookingIdRef.current !== bookingId) return;
    setSummary((prev) => {
      if (!prev) return summaryFromSeed(seedStay);
      return {
        ...prev,
        status: seedStay.status,
        sdfIncomplete: seedStay.sdf_incomplete === true,
        folioId: seedStay.folio_id,
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

  const moneySub = useMemo(() => {
    if (!summary) return [];
    return buildStayMoneySubline({
      status: summary.status,
      hasFolio: Boolean(summary.folioId || money?.folioId),
      hasCharges: Boolean(money?.hasCharges),
      hasInvoice: Boolean(money?.hasInvoice),
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

  const handleStepClick = (id: StayHubStepId, locked: boolean, reason?: string) => {
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

  if (!open || !bookingId) return null;

  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    draftDirtyRef.current = true;
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const saveGuest = () => {
    if (!draft || !summary) return;
    startTransition(async () => {
      const result = await updateCalendarReservationDetails({
        bookingId: summary.bookingId,
        contactName: draft.contactName,
        contactPhone: draft.contactPhone,
        contactEmail: draft.contactEmail,
        adults: Number(draft.adults),
        guideNumber: draft.guideNumber,
        guestOrigin: draft.guestOrigin,
        source: draft.source,
        agentId: draft.agentId,
        notes: draft.notes,
      });
      setMessage(result.message ?? result.error ?? null);
      if (result.ok) {
        draftDirtyRef.current = false;
        router.refresh();
      }
    });
  };

  const dues = Number(money?.balanceBtn ?? summary?.folioBalance ?? 0);
  const titleName = summary?.contactName ?? seedStay?.contact_name ?? "Stay";

  const primaryCta = (() => {
    if (!summary) return null;
    if (panel === "reserve") {
      return (
        <Button
          type="button"
          variant="citrus"
          className="min-h-11 flex-1 sm:flex-none"
          disabled={busy || !draft}
          onClick={saveGuest}
        >
          {pending ? "Saving…" : "Save reservation"}
        </Button>
      );
    }
    if (panel === "check_out" && summary.status === "checked_in") {
      return null; // form has own CTA
    }
    if (panel === "check_in" || panel === "arrival") {
      return null; // CheckInForm has confirm
    }
    return (
      <Button
        type="button"
        variant="outline"
        className="min-h-11 flex-1 sm:flex-none"
        onClick={() => onOpenChange(false)}
      >
        Close
      </Button>
    );
  })();

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
          <DialogHeader className="shrink-0 space-y-2 border-b bg-gradient-to-b from-muted/40 to-background px-4 py-3 pr-12 text-left md:space-y-3 md:px-5 md:py-4">
            {summary ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={statusBadgeVariant(summary.status)}>
                  {summary.status.replace(/_/g, " ")}
                </Badge>
                {summary.roomTypeName ? (
                  <Badge variant="outline">{summary.roomTypeName}</Badge>
                ) : null}
                {summary.isLocked ? (
                  <Badge variant="maroon">Room locked</Badge>
                ) : null}
                {dues > 0.5 ? (
                  <Badge variant="maroon">Dues open</Badge>
                ) : null}
                {summary.sdfIncomplete ? (
                  <Badge variant="destructive">SDF incomplete</Badge>
                ) : null}
              </div>
            ) : null}
            <div>
              <DialogTitle className="text-lg tracking-tight md:text-xl">
                {titleName}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                {summary ? (
                  <>
                    {summary.roomLabel ?? "Unassigned"} · {summary.checkIn} →{" "}
                    {summary.checkOut} ·{" "}
                    <span className="font-mono text-[11px]">
                      {summary.bookingId.slice(0, 8)}
                    </span>
                  </>
                ) : (
                  "Loading stay…"
                )}
              </DialogDescription>
            </div>

            <StayProgressStrip
              steps={steps}
              activePanel={panel}
              terminal={terminal}
              onStepClick={handleStepClick}
            />
            {panel === "stay_money" && moneySub.length > 0 ? (
              <StayMoneyProcessStrip steps={moneySub} className="opacity-90" />
            ) : null}
            {lockHint ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                {lockHint}
              </p>
            ) : null}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-5">
            {loadError ? (
              <p className="text-sm text-destructive">{loadError}</p>
            ) : !summary || !draft ? (
              <p className="text-sm text-muted-foreground">Loading stay…</p>
            ) : (
              <>
                {(panel === "reserve" || panel === "confirm") && (
                  <div className="space-y-4">
                    {panel === "confirm" &&
                    (summary.status === "held" ||
                      summary.status === "pending") ? (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 px-3 py-2.5 dark:bg-amber-950/20">
                        <p className="text-sm font-medium">
                          Hold / confirmation pending
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Confirm token via lifecycle actions below, then
                          continue to arrival docs.
                        </p>
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Guest / lead name" id="hub_contact_name">
                        <Input
                          id="hub_contact_name"
                          className="min-h-11 sm:min-h-9"
                          value={draft.contactName}
                          onChange={(e) =>
                            updateDraft("contactName", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Phone" id="hub_contact_phone">
                        <Input
                          id="hub_contact_phone"
                          className="min-h-11 sm:min-h-9"
                          value={draft.contactPhone}
                          onChange={(e) =>
                            updateDraft("contactPhone", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Email" id="hub_contact_email">
                        <Input
                          id="hub_contact_email"
                          type="email"
                          className="min-h-11 sm:min-h-9"
                          value={draft.contactEmail}
                          onChange={(e) =>
                            updateDraft("contactEmail", e.target.value)
                          }
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
                          onChange={(e) =>
                            updateDraft("adults", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Guide #" id="hub_guide">
                        <Input
                          id="hub_guide"
                          className="min-h-11 sm:min-h-9"
                          value={draft.guideNumber}
                          onChange={(e) =>
                            updateDraft("guideNumber", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Guest origin" id="hub_origin">
                        <select
                          id="hub_origin"
                          value={draft.guestOrigin}
                          onChange={(e) =>
                            updateDraft("guestOrigin", e.target.value)
                          }
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
                          onChange={(e) =>
                            updateDraft("source", e.target.value)
                          }
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
                          onValueChange={(next) =>
                            updateDraft("agentId", next)
                          }
                          className="bg-background min-h-11 sm:min-h-9"
                        />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Notes" id="hub_notes">
                          <Textarea
                            id="hub_notes"
                            rows={3}
                            value={draft.notes}
                            onChange={(e) =>
                              updateDraft("notes", e.target.value)
                            }
                            className="min-h-[4.5rem] resize-y"
                          />
                        </Field>
                      </div>
                    </div>

                    {summary.assignmentId ? (
                      <section className="rounded-lg border bg-card p-4">
                        <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                          Stay dates
                        </h3>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Field label="Check-in" id="hub_ci">
                            <Input
                              id="hub_ci"
                              type="date"
                              className="min-h-11 sm:min-h-9"
                              value={checkIn}
                              onChange={(e) => {
                                draftDirtyRef.current = true;
                                setCheckIn(e.target.value);
                              }}
                            />
                          </Field>
                          <Field label="Check-out" id="hub_co">
                            <Input
                              id="hub_co"
                              type="date"
                              className="min-h-11 sm:min-h-9"
                              value={checkOut}
                              onChange={(e) => {
                                draftDirtyRef.current = true;
                                setCheckOut(e.target.value);
                              }}
                            />
                          </Field>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-3 min-h-11"
                          disabled={busy || summary.isLocked}
                          onClick={() => {
                            if (!summary.assignmentId) return;
                            startTransition(async () => {
                              const result = await resizeCalendarAssignment(
                                summary.assignmentId!,
                                checkIn,
                                checkOut,
                              );
                              setMessage(
                                result.message ?? result.error ?? null,
                              );
                              if (result.ok) router.refresh();
                            });
                          }}
                        >
                          Update dates
                        </Button>

                        {sameTypeUnits.length > 0 ? (
                          <div className="mt-5 space-y-3 border-t pt-4">
                            <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                              Split remaining nights
                            </h3>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field label="Split from date" id="hub_split">
                                <Input
                                  id="hub_split"
                                  type="date"
                                  className="min-h-11 sm:min-h-9"
                                  min={addDays(summary.checkIn, 1)}
                                  max={addDays(summary.checkOut, -1)}
                                  value={splitDate}
                                  onChange={(e) =>
                                    setSplitDate(e.target.value)
                                  }
                                />
                              </Field>
                              <Field
                                label="Destination room"
                                id="hub_split_unit"
                              >
                                <select
                                  id="hub_split_unit"
                                  value={splitUnitId}
                                  onChange={(e) =>
                                    setSplitUnitId(e.target.value)
                                  }
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
                              disabled={
                                busy || summary.isLocked || !splitUnitId
                              }
                              onClick={() => {
                                if (!summary.assignmentId) return;
                                startTransition(async () => {
                                  const result =
                                    await splitCalendarAssignment(
                                      summary.assignmentId!,
                                      splitDate,
                                      splitUnitId,
                                    );
                                  setMessage(
                                    result.message ?? result.error ?? null,
                                  );
                                  if (result.ok) router.refresh();
                                });
                              }}
                            >
                              Split stay
                            </Button>
                          </div>
                        ) : null}

                        <Button
                          type="button"
                          variant={
                            summary.isLocked ? "outline" : "secondary"
                          }
                          disabled={busy}
                          className="mt-4 min-h-11 gap-2"
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
                              router.refresh();
                            });
                          }}
                        >
                          {summary.isLocked ? (
                            <UnlockIcon className="size-4" />
                          ) : (
                            <LockIcon className="size-4" />
                          )}
                          {summary.isLocked
                            ? "Unlock room"
                            : "Lock room assignment"}
                        </Button>
                      </section>
                    ) : null}

                    {!terminal ? (
                      <section className="rounded-lg border bg-card p-4">
                        <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                          Cancel / no-show
                        </h3>
                        <div className="mt-3">
                          <BookingLifecycleActions
                            bookingId={summary.bookingId}
                            status={summary.status}
                          />
                        </div>
                      </section>
                    ) : null}
                  </div>
                )}

                {(panel === "arrival" || panel === "check_in") && (
                  <div className="space-y-4">
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
                  </div>
                )}

                {panel === "stay_money" && (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      One folio for this stay. When an agent is on the
                      booking, room package typically bills to the agent
                      within credit policy; food and hotel services bill to
                      the guest.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border bg-card p-4">
                        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                          Agent (room)
                        </p>
                        <p className="mt-2 text-sm">
                          {money?.agentName || summary.agentName || "No agent"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Mode:{" "}
                          {(
                            money?.paymentMode ??
                            summary.paymentMode ??
                            "unset"
                          ).replace(/_/g, " ")}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Use agent credit only for the agent share. Payor
                          split landing with <code className="text-[10px]">bill_to</code>{" "}
                          on lines.
                        </p>
                      </div>
                      <div className="rounded-lg border bg-card p-4">
                        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                          Guest (extras)
                        </p>
                        <p
                          className={cn(
                            "mt-2 text-lg font-semibold tabular-nums",
                            dues > 0.5 && "text-maroon",
                          )}
                        >
                          Open total{" "}
                          {dues > 0.5
                            ? `Nu ${Math.round(dues).toLocaleString()}`
                            : "Clear"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Cash / card / QR for guest extras on this folio.
                        </p>
                      </div>
                    </div>

                    {(money?.folioId || summary.folioId) ? (
                      <>
                        {summary.status === "checked_in" &&
                        !money?.hasCharges ? (
                          <PostCheckInChargesForm
                            folioId={(money?.folioId || summary.folioId)!}
                            defaultDate={summary.checkIn}
                          />
                        ) : null}
                        {summary.status === "checked_in" ? (
                          <PostRoomNightForm
                            folioId={(money?.folioId || summary.folioId)!}
                            defaultDate={summary.checkIn}
                          />
                        ) : null}
                        <FolioPaymentForm
                          folioId={(money?.folioId || summary.folioId)!}
                          suggestedAmount={Math.max(0, dues)}
                        />
                        <IssueInvoiceButton
                          folioId={(money?.folioId || summary.folioId)!}
                          invoiceNo={money?.invoiceNo}
                          invoiceDocId={money?.invoiceDocId}
                        />
                        <StayMoneyCycleLegend compact />
                        <Button
                          asChild
                          variant="outline"
                          className="min-h-11 w-full justify-start sm:w-auto"
                        >
                          <Link
                            href={`/erp/folios/${money?.folioId || summary.folioId}/receipt`}
                          >
                            Print receipt
                          </Link>
                        </Button>
                        <Button
                          asChild
                          variant="ghost"
                          className="min-h-11 w-full justify-start sm:w-auto"
                        >
                          <Link
                            href={`/erp/folios/${money?.folioId || summary.folioId}`}
                          >
                            Open city ledger (tools)
                          </Link>
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Folio opens at check-in. Day-1 room may post then;
                        later nights at night audit. F&B posts when ordered.
                      </p>
                    )}

                    <section className="rounded-lg border bg-muted/20 p-4">
                      <div className="flex items-center gap-2">
                        <FileTextIcon className="size-4 text-muted-foreground" />
                        <h3 className="text-sm font-medium">
                          Agent voucher (quote)
                        </h3>
                      </div>
                      {summary.agentId ? (
                        <div className="mt-3 flex flex-wrap gap-2">
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
                        <p className="mt-2 text-xs text-muted-foreground">
                          Assign an agent on Reserve to email or print a
                          voucher (not a tax invoice).
                        </p>
                      )}
                    </section>
                  </div>
                )}

                {panel === "check_out" && (
                  <div className="space-y-4">
                    {summary.status === "checked_in" ? (
                      <>
                        {(money?.folioId || summary.folioId) && dues > 0.5 ? (
                          <div className="rounded-lg border border-amber-500/30 bg-amber-50/40 p-3 dark:bg-amber-950/20">
                            <p className="text-sm font-medium">
                              Balance still open (
                              {formatBtn(dues)})
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Collect on Stay / Money, or allow balance on
                              check-out with reason.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              className="mt-2 min-h-11"
                              onClick={() => setPanel("stay_money")}
                            >
                              Go to Stay / Money
                            </Button>
                          </div>
                        ) : null}
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
                        />
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
                    {summary.status === "checked_in" ? (
                      <section className="rounded-lg border bg-card p-4">
                        <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                          In-house task
                        </h3>
                        <div className="mt-3">
                          <InhouseTaskQuickForm
                            bookingId={summary.bookingId}
                          />
                        </div>
                      </section>
                    ) : null}
                  </div>
                )}

                {message ? (
                  <p
                    role="status"
                    className="mt-4 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                  >
                    {message}
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-5">
            <p className="text-xs text-muted-foreground">
              {steps.find((s) => s.id === panel)?.label ?? "Stay"} · one hub
              for desk ops
            </p>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 flex-1 sm:flex-none"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              {primaryCta}
            </div>
          </div>
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
