"use client";

import {
  confirmCheckIn,
  confirmCheckOut,
  type CheckInState,
  type CheckOutState,
} from "@/app/actions/erp-checkin";
import { AgentNameLink } from "@/components/erp/AgentNameLink";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { CloudinaryDocField } from "@/components/erp/CloudinaryDocField";
import { CloudinaryPicker } from "@/components/erp/CloudinaryPicker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  idLabel,
  inventoryKindLabel,
  sdfRequired,
  type GuestOrigin,
} from "@/lib/checkin-rules";
import { countryComboboxOptions, nationalityRequired } from "@/lib/countries";
import { cloudinaryOriginalUrl, cloudinaryUrl } from "@/lib/cloudinary";
import { thimphuToday } from "@/lib/erp-lists";
import { formatBtn } from "@/lib/pricing";
import type {
  CheckInAssignmentSlot,
  CheckInRoomUnit,
} from "@/lib/room-assignments";
import { cn } from "@/lib/utils";
import { Trash2Icon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

/** Dense inputs inside the guest docs grid — must shrink, never force scroll. */
const CELL_INPUT =
  "h-9 w-full min-w-0 rounded-md border-border/70 bg-background px-2 text-sm shadow-none";

/**
 * Shared column template for the guest docs grid so the header and rows stay
 * in sync. Below `xl` rows stack into a compact labelled card; from `xl` they
 * read as table columns. One set of inputs either way — a CSS-hidden duplicate
 * layout would post every guest field twice.
 */
const GUEST_GRID =
  "xl:grid-cols-[2.25rem_minmax(8rem,1.4fr)_minmax(6.5rem,1fr)_minmax(7.5rem,1.1fr)_minmax(6.5rem,1fr)_minmax(9rem,1.3fr)_minmax(5.5rem,0.9fr)_2.25rem]";

/** Stacked label that collapses to the column header from `xl` up. */
const CELL_LABEL = "text-xs font-normal text-muted-foreground xl:sr-only";

/** Enter in a guest cell must not submit check-in mid-typing. */
function blockEnterSubmit(e: KeyboardEvent<HTMLElement>) {
  if (e.key === "Enter") e.preventDefault();
}

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00`).getTime();
  const b = new Date(`${checkOut}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

const ORIGIN_LABELS: Record<string, string> = {
  international: "International",
  regional: "Regional",
  official: "Official",
  local: "Local",
};

export type PartnerOption = {
  id: string;
  label: string;
  sublabel?: string;
  fill?: Record<string, string>;
};

export type CheckInBooking = {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  check_in: string;
  check_out: string;
  status: string;
  guest_origin: string | null;
  guide_number: string | null;
  guide_id: string | null;
  driver_id: string | null;
  payment_mode: string | null;
  adults: number;
  children?: number;
  extra_beds?: number;
  rooms: number;
  agent_id: string | null;
  agent_name: string | null;
  credit_available_btn: number | null;
  stay_estimate_btn: number | null;
  booking_rooms: {
    qty: number;
    inventory_kind: string;
    room_type_id: string;
    room_types?: { name: string; code: string } | null;
  }[];
  booking_guests: {
    full_name: string;
    nationality: string | null;
    passport_or_cid: string | null;
    sdf_ref: string | null;
    sdf_doc_url: string | null;
    id_photo_url?: string | null;
  }[];
  booking_drivers: {
    full_name: string | null;
    phone: string | null;
    vehicle_no: string | null;
    license_no: string | null;
  }[];
};

const checkInInitial: CheckInState = { ok: false };
const checkOutInitial: CheckOutState = { ok: false };

type PartnerKind = "guide" | "driver";

function PartnersPicker({
  kind,
  partners,
  selectedId,
  onPick,
}: {
  kind: PartnerKind;
  partners: PartnerOption[];
  selectedId: string | null;
  onPick: (p: PartnerOption | null) => void;
}) {
  if (partners.length === 0) return null;
  const label = kind === "guide" ? "Recent guides" : "Recent drivers";
  const options = partners.map((p) => ({
    value: p.id,
    label: p.label,
    hint: p.sublabel,
  }));

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Combobox
        options={options}
        value={selectedId}
        onValueChange={(value) => {
          const found = partners.find((p) => p.id === value) ?? null;
          onPick(found);
        }}
        placeholder="— New / type below —"
        searchPlaceholder={kind === "guide" ? "Search guides…" : "Search drivers…"}
        emptyText="No partner matches."
      />
    </div>
  );
}

type GuestDraft = {
  fullName: string;
  nationality: string;
  passportOrCid: string;
  sdfRef: string;
  sdfDocUrl: string;
  idPhotoUrl: string;
  roomUnitId: string;
};

export function CheckInForm({
  booking,
  guides = [],
  drivers = [],
  slots,
  units,
  embedded = false,
  onCheckedIn,
}: {
  booking: CheckInBooking;
  guides?: PartnerOption[];
  drivers?: PartnerOption[];
  slots: CheckInAssignmentSlot[];
  units: CheckInRoomUnit[];
  /** When true (StayHub modal), success UI advances hub — no Next arrival dead-end. */
  embedded?: boolean;
  onCheckedIn?: (payload: {
    bookingId: string;
    folioId?: string;
  }) => void;
}) {
  const [state, action, pending] = useActionState(confirmCheckIn, checkInInitial);
  useActionToast(state, {
    successMessage: booking.id
      ? `Checked in · ref ${booking.id.slice(0, 8).toUpperCase()}`
      : "Guest checked in",
  });
  const notifiedOkRef = useRef(false);

  useEffect(() => {
    if (!state.ok || !state.bookingId || notifiedOkRef.current) return;
    notifiedOkRef.current = true;
    onCheckedIn?.({
      bookingId: state.bookingId,
      folioId: state.folioId,
    });
  }, [state.ok, state.bookingId, state.folioId, onCheckedIn]);

  const origin = (booking.guest_origin ?? "international") as GuestOrigin;
  const driver = booking.booking_drivers[0];
  const hasDriverBeds = booking.booking_rooms.some(
    (r) => r.inventory_kind === "driver_comp" && r.qty > 0,
  );
  /** Lead guest only by default — additional IDs via expandable section. */
  const leadGuestCount = 1;
  const paxAdults = Math.max(1, booking.adults || 1);
  const paxChildren = Math.max(0, booking.children ?? 0);
  const paxExtraBeds = Math.max(0, booking.extra_beds ?? 0);

  const countryOptions = useMemo(() => countryComboboxOptions(), []);

  const [guidePick, setGuidePick] = useState<PartnerOption | null>(
    booking.guide_id
      ? (guides.find((g) => g.id === booking.guide_id) ?? null)
      : null,
  );
  const [guideNumber, setGuideNumber] = useState(booking.guide_number ?? "");
  const [paymentMode, setPaymentMode] = useState(booking.payment_mode ?? "cash");
  const [roomCapOverride, setRoomCapOverride] = useState(false);
  const [roomCapNote, setRoomCapNote] = useState("");
  const [allowDirty, setAllowDirty] = useState(false);
  /** GM/owner soft opt-in when check-in date is before today (or night-audit gate). */
  const [businessDateOverride, setBusinessDateOverride] = useState(false);

  const checkInDate = booking.check_in.slice(0, 10);
  const isPastCheckInDate = checkInDate < thimphuToday();

  const [driverPick, setDriverPick] = useState<PartnerOption | null>(
    booking.driver_id
      ? (drivers.find((d) => d.id === booking.driver_id) ?? null)
      : null,
  );
  const [driverFields, setDriverFields] = useState({
    name: driver?.full_name ?? "",
    phone: driver?.phone ?? "",
    vehicle_no: driver?.vehicle_no ?? "",
    license_no: driver?.license_no ?? "",
  });

  const [slotUnits, setSlotUnits] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const slot of slots) {
      if (slot.assignedUnitId) init[slot.key] = slot.assignedUnitId;
    }
    return init;
  });

  const [guests, setGuests] = useState<GuestDraft[]>(() => {
    const rows: GuestDraft[] = [];
    for (let i = 0; i < leadGuestCount; i++) {
      const existing = booking.booking_guests[i];
      const guestSlot = slots.find(
        (s) => s.inventoryKind === "sellable_guest" && s.index === Math.min(i, Math.max(0, slots.filter(x => x.inventoryKind === "sellable_guest").length - 1)),
      );
      rows.push({
        fullName:
          existing?.full_name ??
          (i === 0 ? (booking.contact_name ?? "") : ""),
        nationality: existing?.nationality ?? "",
        passportOrCid: existing?.passport_or_cid ?? "",
        sdfRef: existing?.sdf_ref ?? "",
        sdfDocUrl: existing?.sdf_doc_url ?? "",
        idPhotoUrl: existing?.id_photo_url ?? "",
        roomUnitId: guestSlot?.assignedUnitId ?? "",
      });
    }
    return rows;
  });
  const [showAllGuestIds, setShowAllGuestIds] = useState(
    () => booking.booking_guests.length > 1,
  );

  /** Which guest row the shared Cloudinary picker is currently editing. */
  const [docPickerIndex, setDocPickerIndex] = useState<number | null>(null);
  const [docPickerIntent, setDocPickerIntent] = useState<
    "camera" | "file" | null
  >(null);
  const [docPickerKind, setDocPickerKind] = useState<"sdf" | "id_photo">("sdf");

  function openDocPicker(
    index: number,
    intent: "camera" | "file",
    kind: "sdf" | "id_photo" = "sdf",
  ) {
    setDocPickerKind(kind);
    setDocPickerIntent(intent);
    setDocPickerIndex(index);
  }

  function updateGuest(index: number, patch: Partial<GuestDraft>) {
    setGuests((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  const selectedUnitIds = useMemo(
    () => Object.values(slotUnits).filter(Boolean),
    [slotUnits],
  );

  const unitsByType = useMemo(() => {
    const map = new Map<string, CheckInRoomUnit[]>();
    for (const unit of units) {
      const key = `${unit.roomTypeId}:${unit.inventoryKind}`;
      const list = map.get(key) ?? [];
      list.push(unit);
      map.set(key, list);
    }
    return map;
  }, [units]);

  if (state.ok && state.bookingId) {
    return (
      <div className="erp rounded-lg border bg-card p-6" role="status">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Checked in
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          Guest is in-house
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Rooms locked · folio opened
          {embedded
            ? " · continue to Stay / Money for charges and payment"
            : null}
          {!embedded && state.folioId ? (
            <>
              {" · "}
              <Link
                href={`/erp/folios/${state.folioId}`}
                className="text-accent underline-offset-4 hover:underline"
              >
                open folio
              </Link>
            </>
          ) : null}
        </p>
        {embedded ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="citrus"
              className="h-11 min-h-11"
              onClick={() =>
                onCheckedIn?.({
                  bookingId: state.bookingId!,
                  folioId: state.folioId,
                })
              }
            >
              Continue to Stay / Money
            </Button>
            {state.folioId ? (
              <Button asChild variant="outline" className="h-11 min-h-11">
                <Link href={`/erp/folios/${state.folioId}`}>Open folio</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild variant="citrus" className="h-11">
              <Link href="/erp/check-in">Next arrival</Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href="/erp/pos">POS</Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href="/erp/calendar">Room rack</Link>
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      action={action}
      className={cn(
        "erp space-y-8",
        embedded
          ? "space-y-6 rounded-none border-0 bg-transparent p-0"
          : "rounded-lg border bg-card p-4 sm:p-6",
      )}
      id={embedded ? "stay-hub-checkin-form" : undefined}
    >
      <input type="hidden" name="booking_id" value={booking.id} />
      <input type="hidden" name="payment_mode" value={paymentMode} />
      <input type="hidden" name="allow_dirty_rooms" value={allowDirty ? "on" : "off"} />
      <input
        type="hidden"
        name="override_agent_room_cap"
        value={roomCapOverride ? "on" : "off"}
      />
      <input type="hidden" name="agent_room_cap_note" value={roomCapNote} />
      {state.error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          {booking.contact_name ?? "Guest"} · {booking.contact_phone ?? "—"}
        </p>
        <p className="mt-1">
          {booking.check_in} → {booking.check_out}{" "}
          <span className="ml-1 inline-flex items-center rounded-full border border-citrus/40 bg-citrus-tint/60 px-2 py-0.5 text-[11px] font-medium tracking-[0.16em] text-citrus uppercase">
            {nightsBetween(booking.check_in, booking.check_out)} nights
          </span>{" "}
          <span className="ml-1 inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium tracking-[0.16em] text-foreground uppercase">
            {ORIGIN_LABELS[origin] ?? "International"}
          </span>{" "}
          · {paxAdults} adult{paxAdults === 1 ? "" : "s"}
          {paxChildren > 0
            ? ` · ${paxChildren} child${paxChildren === 1 ? "" : "ren"}`
            : ""}
          {paxExtraBeds > 0
            ? ` · ${paxExtraBeds} extra bed${paxExtraBeds === 1 ? "" : "s"}`
            : ""}
          · {booking.rooms} rooms
        </p>
        {booking.agent_name || booking.agent_id ? (
          <p className="mt-1 text-xs">
            Agent{" "}
            <AgentNameLink
              agentId={booking.agent_id}
              name={booking.agent_name}
              className="text-xs"
              tab="money"
            />
            {booking.credit_available_btn != null
              ? ` · credit available ${formatBtn(booking.credit_available_btn)}`
              : ""}
            {booking.stay_estimate_btn != null
              ? ` · stay est. ${formatBtn(booking.stay_estimate_btn)}`
              : ""}
          </p>
        ) : null}
      </div>

      <fieldset className="min-w-0 space-y-4">
        <legend className="flex flex-wrap items-center gap-3 text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Room allocation
          <Link
            href="/erp/calendar"
            className="text-[11px] font-medium normal-case tracking-normal text-muted-foreground underline-offset-4 hover:underline"
          >
            Open room rack
          </Link>
        </legend>
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No bookable room lines on this reservation.
          </p>
        ) : (
          <div className="space-y-3">
            {slots.map((slot) => {
              const typeKey = `${slot.roomTypeId}:${slot.inventoryKind}`;
              const options = (unitsByType.get(typeKey) ?? []).filter((u) => {
                const selectedElsewhere =
                  selectedUnitIds.includes(u.id) &&
                  slotUnits[slot.key] !== u.id;
                return u.available || slotUnits[slot.key] === u.id
                  ? !selectedElsewhere || slotUnits[slot.key] === u.id
                  : allowDirty && !u.blocked && !selectedElsewhere;
              });
              return (
                <div key={slot.key} className="grid gap-2 sm:grid-cols-[1fr_220px]">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {inventoryKindLabel(slot.inventoryKind)} ·{" "}
                      {slot.roomTypeName} #{slot.index + 1}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {slot.assignedLabel
                        ? `Pre-assigned ${slot.assignedLabel}`
                        : "Unassigned — pick a ready room"}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="sr-only" htmlFor={`slot-${slot.key}`}>
                      Room
                    </Label>
                    <select
                      id={`slot-${slot.key}`}
                      name="room_unit_id"
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={slotUnits[slot.key] ?? ""}
                      onChange={(e) =>
                        setSlotUnits((prev) => ({
                          ...prev,
                          [slot.key]: e.target.value,
                        }))
                      }
                    >
                      <option value="">Select room…</option>
                      {options.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                          {u.floorLabel ? ` · ${u.floorLabel}` : ""} ·{" "}
                          {u.hkStatus}
                          {u.reason && !u.available ? ` (${u.reason})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox
            checked={allowDirty}
            onCheckedChange={(v) => setAllowDirty(v === true)}
          />
          Allow dirty / inspect rooms (override readiness)
        </Label>
      </fieldset>

      <fieldset className="min-w-0 space-y-3">
        <legend className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Lead guest · ID for check-in
        </legend>
        <p className="text-xs text-muted-foreground">
          Capture the lead guest now. Additional passport / SDF rows can wait
          until after the guest is in-house.
        </p>
        <div className="min-w-0 overflow-x-auto rounded-md border border-border/70">
          <div
            className={cn(
              "hidden bg-muted/40 px-2 py-2 text-xs font-medium text-muted-foreground xl:grid xl:items-center xl:gap-2",
              GUEST_GRID,
            )}
            aria-hidden
          >
            <span className="text-center">#</span>
            <span>
              Full name <span className="text-destructive">*</span>
            </span>
            <span>Nationality</span>
            <span>
              {idLabel(origin)} <span className="text-destructive">*</span>
            </span>
            <span>
              SDF ref
              {sdfRequired(origin) ? (
                <span className="text-destructive"> *</span>
              ) : null}
            </span>
            <span>SDF document</span>
            <span>Sleeps in</span>
            <span />
          </div>

          <ul className="divide-y divide-border/70">
            {guests.map((guest, index) => (
              <li
                key={`guest-${index}`}
                className={cn(
                  "grid gap-3 p-3 sm:grid-cols-2 xl:items-center xl:gap-2 xl:p-2",
                  GUEST_GRID,
                )}
              >
                {/* Stacked view row header — the `#` and remove cells below
                    take over once the grid goes columnar. */}
                <div className="flex items-center justify-between gap-2 sm:col-span-2 xl:hidden">
                  <span className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    Guest {index + 1}
                  </span>
                  {guests.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-mr-1 h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setGuests((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2Icon className="size-3.5" />
                      Remove
                    </Button>
                  ) : null}
                </div>

                <span className="hidden text-center text-xs text-muted-foreground tabular-nums xl:block">
                  {index + 1}
                </span>

                <div className="min-w-0 space-y-1.5 xl:space-y-0">
                  <Label className={CELL_LABEL} htmlFor={`guest_name_${index}`}>
                    Full name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`guest_name_${index}`}
                    name="guest_name"
                    required
                    value={guest.fullName}
                    onKeyDown={blockEnterSubmit}
                    onChange={(e) =>
                      updateGuest(index, { fullName: e.target.value })
                    }
                    className={CELL_INPUT}
                  />
                </div>

                <div className="min-w-0 space-y-1.5 xl:space-y-0">
                  <Label className={CELL_LABEL} htmlFor={`guest_nat_${index}`}>
                    Nationality
                    {nationalityRequired(origin) ? (
                      <span className="text-destructive"> *</span>
                    ) : null}
                  </Label>
                  <Combobox
                    options={countryOptions}
                    value={guest.nationality || null}
                    onValueChange={(value) =>
                      updateGuest(index, { nationality: value })
                    }
                    placeholder="Select country…"
                    searchPlaceholder="Search countries…"
                    className={CELL_INPUT}
                  />
                  <input
                    type="hidden"
                    name="guest_nationality"
                    value={guest.nationality}
                  />
                </div>

                <div className="min-w-0 space-y-1.5 xl:space-y-0">
                  <Label className={CELL_LABEL} htmlFor={`guest_id_${index}`}>
                    {idLabel(origin)} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`guest_id_${index}`}
                    name="guest_passport_or_cid"
                    required
                    inputMode={origin === "local" ? "numeric" : undefined}
                    pattern={origin === "local" ? "[0-9]{11}" : undefined}
                    minLength={origin === "local" ? 11 : undefined}
                    maxLength={origin === "local" ? 11 : undefined}
                    value={guest.passportOrCid}
                    onKeyDown={blockEnterSubmit}
                    onChange={(e) => {
                      const value =
                        origin === "local"
                          ? e.target.value.replace(/\D/g, "").slice(0, 11)
                          : e.target.value;
                      updateGuest(index, { passportOrCid: value });
                    }}
                    className={CELL_INPUT}
                    title={
                      origin === "local"
                        ? "Bhutan CID must be exactly 11 digits"
                        : undefined
                    }
                  />
                </div>

                <div className="min-w-0 space-y-1.5 xl:space-y-0">
                  <Label className={CELL_LABEL} htmlFor={`guest_sdf_${index}`}>
                    SDF ref
                    {sdfRequired(origin) ? (
                      <span className="text-destructive"> *</span>
                    ) : null}
                  </Label>
                  <Input
                    id={`guest_sdf_${index}`}
                    name="guest_sdf_ref"
                    required={sdfRequired(origin)}
                    value={guest.sdfRef}
                    onKeyDown={blockEnterSubmit}
                    onChange={(e) =>
                      updateGuest(index, { sdfRef: e.target.value })
                    }
                    className={CELL_INPUT}
                  />
                </div>

                <div className="min-w-0 space-y-1.5 xl:space-y-0">
                  <span
                    id={`guest_id_photo_label_${index}`}
                    className={CELL_LABEL}
                  >
                    Passport / CID photo
                  </span>
                  <CloudinaryDocField
                    name="guest_id_photo_url"
                    value={guest.idPhotoUrl}
                    describedBy={`guest_id_photo_label_${index}`}
                    onPick={(intent) =>
                      openDocPicker(index, intent, "id_photo")
                    }
                    onClear={() => updateGuest(index, { idPhotoUrl: "" })}
                  />
                </div>

                <div className="min-w-0 space-y-1.5 xl:space-y-0">
                  <span
                    id={`guest_doc_label_${index}`}
                    className={CELL_LABEL}
                  >
                    SDF document
                  </span>
                  <CloudinaryDocField
                    name="guest_sdf_doc_url"
                    value={guest.sdfDocUrl}
                    describedBy={`guest_doc_label_${index}`}
                    onPick={(intent) => openDocPicker(index, intent, "sdf")}
                    onClear={() => updateGuest(index, { sdfDocUrl: "" })}
                  />
                </div>

                <div className="min-w-0 space-y-1.5 xl:space-y-0">
                  <Label className={CELL_LABEL} htmlFor={`guest_room_${index}`}>
                    Sleeps in
                  </Label>
                  <select
                    id={`guest_room_${index}`}
                    name="guest_room_unit_id"
                    value={guest.roomUnitId}
                    onKeyDown={blockEnterSubmit}
                    onChange={(e) =>
                      updateGuest(index, { roomUnitId: e.target.value })
                    }
                    className={cn(CELL_INPUT, "flex border border-input")}
                  >
                    <option value="">Auto</option>
                    {selectedUnitIds.map((id) => {
                      const unit = units.find((u) => u.id === id);
                      if (!unit || unit.inventoryKind !== "sellable_guest") {
                        return null;
                      }
                      return (
                        <option key={id} value={id}>
                          {unit.label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="hidden xl:block">
                  {guests.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove guest ${index + 1}`}
                      onClick={() =>
                        setGuests((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <details
          open={showAllGuestIds}
          onToggle={(e) => setShowAllGuestIds(e.currentTarget.open)}
          className="rounded-lg border bg-muted/15"
        >
          <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium">
            Add guest IDs later ({Math.max(0, paxAdults - 1)} more adult
            {paxAdults - 1 === 1 ? "" : "s"} on booking)
          </summary>
          <div className="space-y-3 border-t px-3 py-3">
            {guests.length > 1 ? (
              <div className="min-w-0 overflow-x-auto rounded-md border border-border/70">
                <ul className="divide-y divide-border/70">
                  {guests.slice(1).map((guest, offset) => {
                    const index = offset + 1;
                    return (
                      <li
                        key={`guest-extra-${index}`}
                        className="space-y-3 p-3"
                      >
                        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                          Guest {index + 1}
                        </p>
                        <Input
                          name="guest_name"
                          required={false}
                          value={guest.fullName}
                          onKeyDown={blockEnterSubmit}
                          onChange={(e) =>
                            updateGuest(index, { fullName: e.target.value })
                          }
                          placeholder="Full name"
                          className={CELL_INPUT}
                        />
                        <input
                          type="hidden"
                          name="guest_nationality"
                          value={guest.nationality}
                        />
                        <Input
                          name="guest_passport_or_cid"
                          value={guest.passportOrCid}
                          onKeyDown={blockEnterSubmit}
                          onChange={(e) =>
                            updateGuest(index, {
                              passportOrCid: e.target.value,
                            })
                          }
                          placeholder={idLabel(origin)}
                          className={CELL_INPUT}
                        />
                        <Input
                          name="guest_sdf_ref"
                          value={guest.sdfRef}
                          onKeyDown={blockEnterSubmit}
                          onChange={(e) =>
                            updateGuest(index, { sdfRef: e.target.value })
                          }
                          placeholder="SDF ref"
                          className={CELL_INPUT}
                        />
                        <input
                          type="hidden"
                          name="guest_sdf_doc_url"
                          value={guest.sdfDocUrl}
                        />
                        <input
                          type="hidden"
                          name="guest_id_photo_url"
                          value={guest.idPhotoUrl}
                        />
                        <input
                          type="hidden"
                          name="guest_room_unit_id"
                          value={guest.roomUnitId}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setGuests((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                        >
                          Remove
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No additional guest rows yet.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAllGuestIds(true);
                setGuests((prev) => [
                  ...prev,
                  {
                    fullName: "",
                    nationality: "",
                    passportOrCid: "",
                    sdfRef: "",
                    sdfDocUrl: "",
                    idPhotoUrl: "",
                    roomUnitId: "",
                  },
                ]);
              }}
            >
              Add another guest ID
            </Button>
          </div>
        </details>
      </fieldset>

      <fieldset className="min-w-0 space-y-4">
        <legend className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Guide &amp; settlement
        </legend>
        <PartnersPicker
          kind="guide"
          partners={guides}
          selectedId={guidePick?.id ?? null}
          onPick={(p) => {
            setGuidePick(p);
            if (p?.fill?.guide_number) setGuideNumber(p.fill.guide_number);
          }}
        />
        <input type="hidden" name="guide_id" value={guidePick?.id ?? ""} />
        <div className="space-y-1.5">
          <Label htmlFor="guide_number">Guide number</Label>
          <Input
            id="guide_number"
            type="text"
            name="guide_number"
            value={guideNumber}
            onChange={(e) => {
              setGuideNumber(e.target.value);
              if (guidePick) setGuidePick(null);
            }}
            aria-required={origin === "international"}
          />
          <p className="text-[11px] text-muted-foreground">
            {origin === "international"
              ? "Required for international tourists."
              : "Optional for this guest origin."}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payment_mode">Payment mode</Label>
          <Select value={paymentMode} onValueChange={setPaymentMode}>
            <SelectTrigger id="payment_mode">
              <SelectValue placeholder="Select payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="prepaid">Prepaid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="on_credit">On credit (agent)</SelectItem>
            </SelectContent>
          </Select>
          {paymentMode === "on_credit" && booking.stay_estimate_btn != null ? (
            <p className="text-[11px] text-muted-foreground">
              Estimated charge {formatBtn(booking.stay_estimate_btn)}
              {booking.credit_available_btn != null
                ? ` · available ${formatBtn(booking.credit_available_btn)}`
                : ""}
            </p>
          ) : null}
          {booking.agent_id ? (
            <div className="space-y-2 rounded-md border border-dashed px-3 py-2">
              <Label
                htmlFor="override_agent_room_cap_ui"
                className="flex items-center gap-2 text-xs font-normal"
              >
                <Checkbox
                  id="override_agent_room_cap_ui"
                  checked={roomCapOverride}
                  onCheckedChange={(v) => setRoomCapOverride(v === true)}
                />
                Override agent open-room cap (stack more rooms) — manager note
                required
              </Label>
              {roomCapOverride ? (
                <Input
                  value={roomCapNote}
                  onChange={(e) => setRoomCapNote(e.target.value)}
                  placeholder="Why exceed open room cap?"
                  className="h-9"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-4">
        <legend className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Driver {hasDriverBeds ? "(required)" : "(optional)"}
        </legend>
        <PartnersPicker
          kind="driver"
          partners={drivers}
          selectedId={driverPick?.id ?? null}
          onPick={(p) => {
            setDriverPick(p);
            if (p?.fill) {
              setDriverFields({
                name: p.fill.driver_name ?? driverFields.name,
                phone: p.fill.driver_phone ?? driverFields.phone,
                vehicle_no: p.fill.vehicle_no ?? driverFields.vehicle_no,
                license_no: p.fill.license_no ?? driverFields.license_no,
              });
            }
          }}
        />
        <input type="hidden" name="driver_id" value={driverPick?.id ?? ""} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="driver_name">Driver name</Label>
            <Input
              id="driver_name"
              name="driver_name"
              required={hasDriverBeds}
              value={driverFields.name}
              onChange={(e) => {
                setDriverFields({ ...driverFields, name: e.target.value });
                if (driverPick) setDriverPick(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="driver_phone">Driver phone</Label>
            <Input
              id="driver_phone"
              type="tel"
              name="driver_phone"
              value={driverFields.phone}
              onChange={(e) => {
                setDriverFields({ ...driverFields, phone: e.target.value });
                if (driverPick) setDriverPick(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle_no">Vehicle no</Label>
            <Input
              id="vehicle_no"
              name="vehicle_no"
              value={driverFields.vehicle_no}
              onChange={(e) => {
                setDriverFields({ ...driverFields, vehicle_no: e.target.value });
                if (driverPick) setDriverPick(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="license_no">License no</Label>
            <Input
              id="license_no"
              name="license_no"
              value={driverFields.license_no}
              onChange={(e) => {
                setDriverFields({ ...driverFields, license_no: e.target.value });
                if (driverPick) setDriverPick(null);
              }}
            />
          </div>
        </div>
      </fieldset>

      {isPastCheckInDate ? (
        <div
          className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3"
          role="status"
        >
          <p className="text-sm font-medium text-foreground">
            Check-in date {checkInDate} is before today ({thimphuToday()})
          </p>
          <p className="text-xs text-muted-foreground">
            Floor staff: enter a manager PIN. GM/owner: tick the override below
            (no PIN). Or open Book / Confirm → Details and move the stay dates
            first.
          </p>
          <Label className="flex items-start gap-2 text-sm font-normal">
            <Checkbox
              checked={businessDateOverride}
              onCheckedChange={(v) => setBusinessDateOverride(v === true)}
              className="mt-0.5"
            />
            <span>
              Allow past check-in / business date override (GM/owner session)
            </span>
          </Label>
          <input
            type="hidden"
            name="business_date_override"
            value={businessDateOverride ? "on" : "off"}
          />
          <div className="space-y-1.5">
            <Label htmlFor="ci_manager_pin">Manager PIN (floor staff)</Label>
            <Input
              id="ci_manager_pin"
              name="manager_pin"
              type="password"
              autoComplete="off"
              className="h-11 max-w-xs"
              placeholder="Owner/GM staff PIN or desk manager PIN"
            />
          </div>
        </div>
      ) : (
        <details className="rounded-lg border bg-muted/15">
          <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium">
            Manager override (night audit / business date)
          </summary>
          <div className="space-y-3 border-t px-3 py-3">
            <Label className="flex items-start gap-2 text-sm font-normal">
              <Checkbox
                checked={businessDateOverride}
                onCheckedChange={(v) => setBusinessDateOverride(v === true)}
                className="mt-0.5"
              />
              <span>
                Allow business date override (GM/owner — e.g. night audit not
                closed)
              </span>
            </Label>
            <input
              type="hidden"
              name="business_date_override"
              value={businessDateOverride ? "on" : "off"}
            />
            <div className="space-y-1.5">
              <Label htmlFor="ci_manager_pin">Manager PIN</Label>
              <Input
                id="ci_manager_pin"
                name="manager_pin"
                type="password"
                autoComplete="off"
                className="h-11 max-w-xs"
                placeholder="Floor staff when prior day not closed"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Floor staff need a manager PIN if night audit for the prior
              business day is not closed. GM/owner may tick the checkbox
              instead.
            </p>
          </div>
        </details>
      )}

      <Button
        type="submit"
        variant="citrus"
        disabled={pending}
        className={cn("h-11 px-6", embedded && "sr-only")}
        tabIndex={embedded ? -1 : undefined}
      >
        {pending ? "Checking in…" : "Confirm check-in"}
      </Button>

      <CloudinaryPicker
        open={docPickerIndex !== null}
        onOpenChange={(next) => {
          if (!next) {
            setDocPickerIndex(null);
            setDocPickerIntent(null);
          }
        }}
        onSelect={(publicId, meta) => {
          if (docPickerIndex === null) return;
          // Keep PDFs as PDFs; image transforms would flatten them to page 1.
          const url =
            meta?.format.toLowerCase() === "pdf"
              ? cloudinaryOriginalUrl(publicId, "pdf")
              : cloudinaryUrl(publicId, {
                  quality: "auto",
                  format: "auto",
                });
          if (url) {
            if (docPickerKind === "id_photo") {
              updateGuest(docPickerIndex, { idPhotoUrl: url });
            } else {
              updateGuest(docPickerIndex, { sdfDocUrl: url });
            }
          }
          setDocPickerIndex(null);
          setDocPickerIntent(null);
        }}
        uploadFolder={
          docPickerKind === "id_photo" ? "pelbu/guest-id" : "pelbu/sdf"
        }
        acceptVideo={false}
        acceptPdf={docPickerKind !== "id_photo"}
        initialTab="upload"
        uploadIntent={docPickerIntent}
        title={
          docPickerIndex === null
            ? docPickerKind === "id_photo"
              ? "Passport / CID photo"
              : "SDF document"
            : docPickerKind === "id_photo"
              ? `Passport / CID photo · guest ${docPickerIndex + 1}`
              : `SDF document · guest ${docPickerIndex + 1}`
        }
        description={
          docPickerKind === "id_photo"
            ? docPickerIntent === "camera"
              ? "Photograph the passport biometrics page or CID card."
              : "Upload a clear photo or scan of passport / CID."
            : docPickerIntent === "camera"
              ? "Take a photo of the SDF permit with the camera."
              : docPickerIntent === "file"
                ? "Attach a scanned PDF or a photo from files — you can scan later and upload here."
                : "Camera for a quick desk photo, or PDF / file for a scanned permit."
        }
      />
    </form>
  );
}

export function CheckOutForm({
  bookingId,
  rooms = [],
  folioBalance = 0,
  earlyFeeDefaultBtn = null,
  lateFeeDefaultBtn = null,
}: {
  bookingId: string;
  rooms?: string[];
  folioBalance?: number;
  /** Policy suggestions only — never pre-fill both fee fields */
  earlyFeeDefaultBtn?: number | null;
  lateFeeDefaultBtn?: number | null;
}) {
  const [state, action, pending] = useActionState(confirmCheckOut, checkOutInitial);
  useActionToast(state, { successMessage: "Guest checked out" });
  const [allowBalance, setAllowBalance] = useState(false);
  // Empty unless staff intentionally posts a fee — policy is a suggestion, not a charge.
  const [earlyFee, setEarlyFee] = useState("");
  const [lateFee, setLateFee] = useState("");

  if (state.ok) {
    return (
      <p
        className="erp rounded-lg border bg-card px-4 py-3 text-sm text-foreground"
        role="status"
      >
        Checked out. Rooms marked dirty for housekeeping.
      </p>
    );
  }

  const earlyPolicy =
    earlyFeeDefaultBtn != null && earlyFeeDefaultBtn > 0
      ? earlyFeeDefaultBtn
      : null;
  const latePolicy =
    lateFeeDefaultBtn != null && lateFeeDefaultBtn > 0
      ? lateFeeDefaultBtn
      : null;

  return (
    <form action={action} className="erp space-y-4 rounded-lg border bg-card p-6">
      <input type="hidden" name="booking_id" value={bookingId} />
      {state.error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Check out
      </p>
      {rooms.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Rooms: {rooms.join(", ")} → dirty on confirm
        </p>
      ) : null}
      <p className="text-sm">
        Folio balance{" "}
        <span className="font-semibold tabular-nums">
          {formatBtn(folioBalance)}
        </span>
        <span className="text-muted-foreground">
          {" "}
          (fees below post only if you enter an amount)
        </span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted-foreground">
            Early checkout fee (optional)
          </span>
          <Input
            type="number"
            name="early_checkout_fee_btn"
            min={0}
            step="0.01"
            placeholder="0"
            value={earlyFee}
            onChange={(e) => {
              setEarlyFee(e.target.value);
              if (e.target.value.trim()) setLateFee("");
            }}
            className="h-10"
          />
          {earlyPolicy != null ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>Policy {formatBtn(earlyPolicy)}</span>
              <button
                type="button"
                className="font-medium text-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setEarlyFee(String(earlyPolicy));
                  setLateFee("");
                }}
              >
                Apply early fee
              </button>
            </span>
          ) : null}
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted-foreground">
            Late checkout fee (optional)
          </span>
          <Input
            type="number"
            name="late_checkout_fee_btn"
            min={0}
            step="0.01"
            placeholder="0"
            value={lateFee}
            onChange={(e) => {
              setLateFee(e.target.value);
              if (e.target.value.trim()) setEarlyFee("");
            }}
            className="h-10"
          />
          {latePolicy != null ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>Policy {formatBtn(latePolicy)}</span>
              <button
                type="button"
                className="font-medium text-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setLateFee(String(latePolicy));
                  setEarlyFee("");
                }}
              >
                Apply late fee
              </button>
            </span>
          ) : null}
        </label>
      </div>
      <input
        type="hidden"
        name="allow_balance"
        value={allowBalance ? "on" : "off"}
      />
      <Label
        htmlFor="allow_balance"
        className="flex items-center gap-2 text-sm font-normal text-foreground"
      >
        <Checkbox
          id="allow_balance"
          checked={allowBalance}
          onCheckedChange={(v) => setAllowBalance(v === true)}
        />
        Allow checkout with folio balance
      </Label>
      <Button type="submit" variant="outline" disabled={pending} className="h-11">
        {pending ? "Checking out…" : "Confirm check-out"}
      </Button>
    </form>
  );
}
