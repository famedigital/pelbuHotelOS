"use client";

import {
  resizeCalendarAssignment,
  splitCalendarAssignment,
  updateCalendarReservationDetails,
} from "@/app/actions/erp-calendar";
import type { CalendarAgent } from "@/components/erp/CalendarReservationDialog";
import { BookingDetailPanelLoader } from "@/components/erp/BookingDetailPanelLoader";
import { AgentPicker } from "@/components/erp/AgentPicker";
import { AgentVoucherEmailButton } from "@/components/erp/AgentVoucherEmailButton";
import {
  FastBookVoucher,
  type FastBookVoucherData,
} from "@/components/erp/FastBookVoucher";
import type { RackStay, RackUnit } from "@/components/erp/RoomRackGrid";
import { InhouseTaskQuickForm } from "@/components/erp/InhouseTasksPanel";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  FileTextIcon,
  LockIcon,
  UnlockIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

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

type StayStep = {
  id: string;
  label: string;
  done: boolean;
  current: boolean;
};

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildStaySteps(stay: RackStay): StayStep[] {
  const booked = true;
  const confirmed = ["confirmed", "checked_in"].includes(stay.status);
  const docsOk = stay.sdf_incomplete !== true;
  const checkedIn = stay.status === "checked_in";
  const folioReady = Boolean(stay.folio_id);
  const duesClear = Number(stay.folio_balance ?? 0) <= 0.5;

  const steps: Omit<StayStep, "current">[] = [
    { id: "booked", label: "Booked", done: booked },
    { id: "confirmed", label: "Confirmed", done: confirmed },
    { id: "docs", label: "Guest docs", done: docsOk && confirmed },
    { id: "checkin", label: "Checked in", done: checkedIn },
    { id: "folio", label: "Folio", done: folioReady },
    {
      id: "settle",
      label: "Settled",
      done: checkedIn && folioReady && duesClear,
    },
  ];

  let currentIdx = steps.findIndex((s) => !s.done);
  if (currentIdx < 0) currentIdx = steps.length - 1;

  return steps.map((s, i) => ({
    ...s,
    current: i === currentIdx,
  }));
}

function defaultTab(stay: RackStay): string {
  if (stay.status === "checked_in") return "money";
  if (stay.sdf_incomplete) return "guest";
  if (stay.status === "held" || stay.status === "pending") return "guest";
  return "stay";
}

function statusBadgeVariant(
  status: string,
): "secondary" | "sky" | "citrus" | "gold" | "maroon" {
  if (status === "checked_in") return "citrus";
  if (status === "confirmed") return "sky";
  if (status === "held" || status === "pending") return "gold";
  return "secondary";
}

export function CalendarReservationEditDialog({
  stay,
  open,
  onOpenChange,
  agents,
  units,
  onToggleLock,
  parentPending = false,
}: {
  stay: RackStay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: CalendarAgent[];
  units: RackUnit[];
  onToggleLock: (stay: RackStay) => void;
  parentPending?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const busy = pending || parentPending;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [splitDate, setSplitDate] = useState("");
  const [splitUnitId, setSplitUnitId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [tab, setTab] = useState("guest");

  useEffect(() => {
    if (!stay) return;
    setDraft({
      contactName: stay.contact_name ?? "",
      contactPhone: stay.contact_phone ?? "",
      contactEmail: stay.contact_email ?? "",
      adults: String(stay.adults),
      guideNumber: stay.guide_number ?? "",
      guestOrigin: stay.guest_origin ?? "international",
      source: stay.booked_by_role || stay.source || "reservation",
      agentId: stay.agent_id ?? "",
      notes: stay.notes ?? "",
    });
    setCheckIn(stay.check_in);
    setCheckOut(stay.check_out);
    setSplitDate(addDays(stay.check_in, 1));
    setSplitUnitId("");
    setMessage(null);
    setVoucherOpen(false);
    setTab(defaultTab(stay));
  }, [stay]);

  const sameTypeUnits = useMemo(
    () =>
      units.filter(
        (unit) =>
          stay &&
          unit.room_type_id === stay.room_type_id &&
          unit.id !== stay.room_unit_id,
      ),
    [stay, units],
  );

  const steps = useMemo(
    () => (stay ? buildStaySteps(stay) : []),
    [stay],
  );

  if (!stay || !draft) return null;

  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  const saveGuest = () => {
    startTransition(async () => {
      const result = await updateCalendarReservationDetails({
        bookingId: stay.booking_id,
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
      if (result.ok) router.refresh();
    });
  };

  const dues = Number(stay.folio_balance ?? 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="erp flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 space-y-3 border-b bg-gradient-to-b from-muted/40 to-background px-5 py-4 pr-12 text-left">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={statusBadgeVariant(stay.status)}>
                {stay.status.replace(/_/g, " ")}
              </Badge>
              <Badge variant="outline">{stay.room_type_name}</Badge>
              {stay.group_name ? (
                <Badge variant="gold">{stay.group_name}</Badge>
              ) : null}
              {stay.is_locked ? (
                <Badge variant="maroon">Room locked</Badge>
              ) : null}
              {dues > 0.5 ? (
                <Badge variant="maroon">Dues open</Badge>
              ) : null}
              {stay.sdf_incomplete ? (
                <Badge variant="destructive">SDF incomplete</Badge>
              ) : null}
            </div>
            <div>
              <DialogTitle className="text-xl tracking-tight">
                {stay.contact_name ?? "Guest"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                {stay.room_label} · {stay.check_in} → {stay.check_out} ·{" "}
                <span className="font-mono text-[11px]">
                  {stay.booking_id.slice(0, 8)}
                </span>
              </DialogDescription>
            </div>

            <ol className="flex gap-1 overflow-x-auto pb-0.5">
              {steps.map((step, index) => (
                <li
                  key={step.id}
                  className="flex min-w-0 flex-1 items-center gap-1"
                >
                  <div
                    className={cn(
                      "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-1 py-1.5",
                      step.current && "bg-accent/10",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold",
                        step.done
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : step.current
                            ? "border-accent bg-background text-accent"
                            : "border-border bg-muted text-muted-foreground",
                      )}
                      aria-hidden
                    >
                      {step.done ? (
                        <CheckIcon className="size-3.5" strokeWidth={2.5} />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span
                      className={cn(
                        "truncate text-[10px] font-medium",
                        step.done
                          ? "text-emerald-700 dark:text-emerald-300"
                          : step.current
                            ? "text-accent"
                            : "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 ? (
                    <span
                      aria-hidden
                      className={cn(
                        "mb-4 hidden h-px w-2 shrink-0 sm:block",
                        step.done ? "bg-emerald-500" : "bg-border",
                      )}
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          </DialogHeader>

          <Tabs
            value={tab}
            onValueChange={setTab}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <div className="shrink-0 border-b px-5 py-2">
              <TabsList className="h-9 w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
                <TabsTrigger
                  value="guest"
                  className="rounded-md data-[state=active]:bg-muted"
                >
                  Guest
                </TabsTrigger>
                <TabsTrigger
                  value="stay"
                  className="rounded-md data-[state=active]:bg-muted"
                >
                  Stay
                </TabsTrigger>
                <TabsTrigger
                  value="money"
                  className="rounded-md data-[state=active]:bg-muted"
                >
                  Money & docs
                </TabsTrigger>
                <TabsTrigger
                  value="ops"
                  className="rounded-md data-[state=active]:bg-muted"
                >
                  Ops
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <TabsContent value="guest" className="mt-0 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Guest / lead name" id="edit_contact_name">
                    <Input
                      id="edit_contact_name"
                      value={draft.contactName}
                      onChange={(e) =>
                        updateDraft("contactName", e.target.value)
                      }
                      required
                    />
                  </Field>
                  <Field label="Phone" id="edit_contact_phone">
                    <Input
                      id="edit_contact_phone"
                      value={draft.contactPhone}
                      onChange={(e) =>
                        updateDraft("contactPhone", e.target.value)
                      }
                      required
                    />
                  </Field>
                  <Field label="Email" id="edit_contact_email">
                    <Input
                      id="edit_contact_email"
                      type="email"
                      value={draft.contactEmail}
                      onChange={(e) =>
                        updateDraft("contactEmail", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Adults" id="edit_adults">
                    <Input
                      id="edit_adults"
                      type="number"
                      min={1}
                      max={48}
                      value={draft.adults}
                      onChange={(e) => updateDraft("adults", e.target.value)}
                    />
                  </Field>
                  <Field label="Guide #" id="edit_guide_number">
                    <Input
                      id="edit_guide_number"
                      value={draft.guideNumber}
                      onChange={(e) =>
                        updateDraft("guideNumber", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Guest origin" id="edit_guest_origin">
                    <select
                      id="edit_guest_origin"
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
                  <Field label="Booked by" id="edit_source">
                    <select
                      id="edit_source"
                      value={draft.source}
                      onChange={(e) => updateDraft("source", e.target.value)}
                      className={selectClass}
                    >
                      <option value="reservation">Reservation desk</option>
                      <option value="owner">Owner</option>
                      <option value="agent">Agent</option>
                      <option value="mou_agent">MoU agent</option>
                    </select>
                  </Field>
                  <Field label="Agent" id="edit_agent">
                    <AgentPicker
                      agents={agents}
                      value={draft.agentId}
                      onValueChange={(next) => updateDraft("agentId", next)}
                      className="bg-background"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Notes" id="edit_notes">
                      <Textarea
                        id="edit_notes"
                        rows={3}
                        value={draft.notes}
                        onChange={(e) => updateDraft("notes", e.target.value)}
                        className="min-h-[4.5rem] resize-y"
                      />
                    </Field>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="stay" className="mt-0 space-y-5">
                <section className="rounded-lg border bg-card p-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    Stay dates
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Check-in" id="edit_check_in">
                      <Input
                        id="edit_check_in"
                        type="date"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                      />
                    </Field>
                    <Field label="Check-out" id="edit_check_out">
                      <Input
                        id="edit_check_out"
                        type="date"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    disabled={busy || stay.is_locked}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await resizeCalendarAssignment(
                          stay.id,
                          checkIn,
                          checkOut,
                        );
                        setMessage(result.message ?? result.error ?? null);
                        if (result.ok) router.refresh();
                      });
                    }}
                  >
                    Update dates
                  </Button>
                </section>

                <section className="rounded-lg border bg-card p-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    Split remaining nights
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Move nights from a split date into another same-category
                    room.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Split from date" id="edit_split_date">
                      <Input
                        id="edit_split_date"
                        type="date"
                        min={addDays(stay.check_in, 1)}
                        max={addDays(stay.check_out, -1)}
                        value={splitDate}
                        onChange={(e) => setSplitDate(e.target.value)}
                      />
                    </Field>
                    <Field label="Destination room" id="edit_split_unit">
                      <select
                        id="edit_split_unit"
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
                    className="mt-3"
                    disabled={busy || stay.is_locked || !splitUnitId}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await splitCalendarAssignment(
                          stay.id,
                          splitDate,
                          splitUnitId,
                        );
                        setMessage(result.message ?? result.error ?? null);
                        if (result.ok) router.refresh();
                      });
                    }}
                  >
                    Split stay
                  </Button>
                </section>

                <Button
                  type="button"
                  variant={stay.is_locked ? "outline" : "secondary"}
                  disabled={busy}
                  onClick={() => onToggleLock(stay)}
                  className="gap-2"
                >
                  {stay.is_locked ? (
                    <UnlockIcon className="size-4" />
                  ) : (
                    <LockIcon className="size-4" />
                  )}
                  {stay.is_locked ? "Unlock room" : "Lock room assignment"}
                </Button>
              </TabsContent>

              <TabsContent value="money" className="mt-0 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                      Payment mode
                    </p>
                    <p className="mt-2 text-sm capitalize">
                      {stay.payment_mode?.replace(/_/g, " ") ?? "Unset"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Change money on the folio — not in this form.
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                      Open balance
                    </p>
                    <p
                      className={cn(
                        "mt-2 text-lg font-semibold tabular-nums",
                        dues > 0.5 && "text-maroon",
                      )}
                    >
                      {dues > 0.5
                        ? `Nu ${Math.round(dues).toLocaleString()}`
                        : "Clear"}
                    </p>
                  </div>
                </div>

                {stay.folio_id ? (
                  <Button asChild variant="outline" className="justify-start">
                    <Link href={`/erp/folios/${stay.folio_id}/receipt`}>
                      Print receipt
                    </Link>
                  </Button>
                ) : null}

                <section className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center gap-2">
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">Agent voucher</h3>
                  </div>
                  {stay.agent_id ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <AgentVoucherEmailButton bookingId={stay.booking_id} />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setVoucherOpen(true)}
                      >
                        Print voucher
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Assign an agent on the Guest tab to email or print a
                      voucher.
                    </p>
                  )}
                </section>

                <section className="rounded-lg border bg-card p-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    Booking actions
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Check-in, cancel, no-show, and folio — same as reservations
                    desk.
                  </p>
                  <div className="mt-3">
                    <BookingDetailPanelLoader
                      bookingId={stay.booking_id}
                      compact
                      showDossierLink
                    />
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="ops" className="mt-0 space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button asChild variant="outline" className="justify-start">
                    <Link href={`/erp/reservations?q=${stay.booking_id}`}>
                      Reservation record
                    </Link>
                  </Button>
                  {stay.group_name ? (
                    <Button asChild variant="outline" className="justify-start">
                      <Link href="/erp/group">Group master</Link>
                    </Button>
                  ) : null}
                </div>
                {stay.status === "checked_in" ? (
                  <section className="rounded-lg border bg-card p-4">
                    <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                      In-house task
                    </h3>
                    <div className="mt-3">
                      <InhouseTaskQuickForm bookingId={stay.booking_id} />
                    </div>
                  </section>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    In-house tasks unlock after check-in.
                  </p>
                )}
              </TabsContent>

              {message ? (
                <p
                  role="status"
                  className="mt-4 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                >
                  {message}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background px-5 py-3">
              <p className="text-xs text-muted-foreground">
                {tab === "guest"
                  ? "Save guest details before leaving this tab."
                  : "Room moves and money live on Stay / Money tabs."}
              </p>
              {tab === "guest" ? (
                <Button
                  type="button"
                  variant="citrus"
                  disabled={busy}
                  onClick={saveGuest}
                >
                  {pending ? "Saving…" : "Save reservation"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              )}
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={voucherOpen} onOpenChange={setVoucherOpen}>
        <DialogContent className="erp max-h-[92vh] overflow-y-auto sm:max-w-xl print:max-w-none">
          <DialogHeader className="print:hidden">
            <DialogTitle>Agent voucher</DialogTitle>
            <DialogDescription>
              Print or email — rates stay on the folio.
            </DialogDescription>
          </DialogHeader>
          <FastBookVoucher data={voucherDataFromStay(stay)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function voucherDataFromStay(stay: RackStay): FastBookVoucherData {
  const nights = Math.max(
    0,
    Math.round(
      (new Date(`${stay.check_out}T12:00:00Z`).getTime() -
        new Date(`${stay.check_in}T12:00:00Z`).getTime()) /
        86_400_000,
    ),
  );
  return {
    bookingId: stay.booking_id,
    checkIn: stay.check_in,
    checkOut: stay.check_out,
    nights,
    guestName: stay.contact_name ?? "Guest",
    guestPhone: stay.contact_phone ?? undefined,
    agentId: stay.agent_id ?? undefined,
    agentLabel: stay.agent_name ?? undefined,
    guideNumber: stay.guide_number ?? undefined,
    lines: [
      {
        name: stay.room_type_name,
        code: stay.room_type_id.slice(0, 8),
        qty: Math.max(1, stay.rooms),
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
