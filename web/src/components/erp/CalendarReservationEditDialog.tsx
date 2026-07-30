"use client";

import {
  resizeCalendarAssignment,
  splitCalendarAssignment,
  updateCalendarReservationDetails,
} from "@/app/actions/erp-calendar";
import type {
  CalendarAgent,
} from "@/components/erp/CalendarReservationDialog";
import { AgentPicker } from "@/components/erp/AgentPicker";
import type { RackStay, RackUnit } from "@/components/erp/RoomRackGrid";
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

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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

  if (!stay || !draft) return null;

  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="erp max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex flex-wrap gap-1.5 pr-8">
            <Badge variant="secondary">
              {stay.status.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline">{stay.room_type_name}</Badge>
            {stay.group_name ? (
              <Badge variant="gold">{stay.group_name}</Badge>
            ) : null}
            {stay.is_locked ? (
              <Badge variant="maroon">Room locked</Badge>
            ) : null}
          </div>
          <DialogTitle className="text-xl">Edit reservation</DialogTitle>
          <DialogDescription>
            {stay.room_label} · {stay.check_in} → {stay.check_out} · booking{" "}
            {stay.booking_id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Guest / lead name" id="edit_contact_name">
                <Input
                  id="edit_contact_name"
                  value={draft.contactName}
                  onChange={(event) =>
                    updateDraft("contactName", event.target.value)
                  }
                  required
                />
              </Field>
              <Field label="Phone" id="edit_contact_phone">
                <Input
                  id="edit_contact_phone"
                  value={draft.contactPhone}
                  onChange={(event) =>
                    updateDraft("contactPhone", event.target.value)
                  }
                  required
                />
              </Field>
              <Field label="Email" id="edit_contact_email">
                <Input
                  id="edit_contact_email"
                  type="email"
                  value={draft.contactEmail}
                  onChange={(event) =>
                    updateDraft("contactEmail", event.target.value)
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
                  onChange={(event) =>
                    updateDraft("adults", event.target.value)
                  }
                />
              </Field>
              <Field label="Guide #" id="edit_guide_number">
                <Input
                  id="edit_guide_number"
                  value={draft.guideNumber}
                  onChange={(event) =>
                    updateDraft("guideNumber", event.target.value)
                  }
                />
              </Field>
              <Field label="Guest origin" id="edit_guest_origin">
                <select
                  id="edit_guest_origin"
                  value={draft.guestOrigin}
                  onChange={(event) =>
                    updateDraft("guestOrigin", event.target.value)
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
                  onChange={(event) =>
                    updateDraft("source", event.target.value)
                  }
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
                  <Input
                    id="edit_notes"
                    value={draft.notes}
                    onChange={(event) =>
                      updateDraft("notes", event.target.value)
                    }
                  />
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <Button
                type="button"
                variant="citrus"
                disabled={busy}
                onClick={() => {
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
                }}
              >
                {pending ? "Saving…" : "Save reservation"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Payment remains {stay.payment_mode?.replace(/_/g, " ") ?? "unset"};
                use the folio for money changes.
              </span>
            </div>

            {message ? (
              <p
                role="status"
                className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                {message}
              </p>
            ) : null}
          </section>

          <aside className="space-y-4 rounded-lg border bg-muted/20 p-4">
            <div>
              <h3 className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Dates
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="Check-in" id="edit_check_in">
                  <Input
                    id="edit_check_in"
                    type="date"
                    value={checkIn}
                    onChange={(event) => setCheckIn(event.target.value)}
                  />
                </Field>
                <Field label="Check-out" id="edit_check_out">
                  <Input
                    id="edit_check_out"
                    type="date"
                    value={checkOut}
                    onChange={(event) => setCheckOut(event.target.value)}
                  />
                </Field>
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-2 w-full"
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
            </div>

            <div className="border-t pt-4">
              <h3 className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Split remaining nights
              </h3>
              <div className="mt-2 space-y-2">
                <Input
                  type="date"
                  min={addDays(stay.check_in, 1)}
                  max={addDays(stay.check_out, -1)}
                  value={splitDate}
                  onChange={(event) => setSplitDate(event.target.value)}
                  aria-label="Split date"
                />
                <select
                  value={splitUnitId}
                  onChange={(event) => setSplitUnitId(event.target.value)}
                  className={selectClass}
                  aria-label="Destination room"
                >
                  <option value="">Select same-category room</option>
                  {sameTypeUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
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
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Button
                type="button"
                variant={stay.is_locked ? "outline" : "secondary"}
                className="w-full"
                disabled={busy}
                onClick={() => onToggleLock(stay)}
              >
                {stay.is_locked ? "Unlock room" : "Lock room"}
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/erp/check-in?id=${stay.booking_id}`}>
                  Check-in / guest documents
                </Link>
              </Button>
              {stay.folio_id ? (
                <>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/erp/folios/${stay.folio_id}`}>
                      Folio &amp; invoice
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/erp/folios/${stay.folio_id}/receipt`}>
                      Print receipt
                    </Link>
                  </Button>
                </>
              ) : (
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/erp/invoices?q=${stay.booking_id}`}>
                    Find / generate invoice
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" className="w-full">
                <Link href={`/erp/reservations?q=${stay.booking_id}`}>
                  Reservation record
                </Link>
              </Button>
              {stay.group_name ? (
                <Button asChild variant="ghost" className="w-full">
                  <Link href="/erp/group">Group master</Link>
                </Button>
              ) : null}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
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
