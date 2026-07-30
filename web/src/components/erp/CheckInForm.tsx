"use client";

import {
  confirmCheckIn,
  confirmCheckOut,
  type CheckInState,
  type CheckOutState,
} from "@/app/actions/erp-checkin";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
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
import { formatBtn } from "@/lib/pricing";
import type {
  CheckInAssignmentSlot,
  CheckInRoomUnit,
} from "@/lib/room-assignments";
import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

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
  roomUnitId: string;
};

export function CheckInForm({
  booking,
  guides = [],
  drivers = [],
  slots,
  units,
}: {
  booking: CheckInBooking;
  guides?: PartnerOption[];
  drivers?: PartnerOption[];
  slots: CheckInAssignmentSlot[];
  units: CheckInRoomUnit[];
}) {
  const [state, action, pending] = useActionState(confirmCheckIn, checkInInitial);
  useActionToast(state, { successMessage: "Guest checked in" });

  const origin = (booking.guest_origin ?? "international") as GuestOrigin;
  const driver = booking.booking_drivers[0];
  const hasDriverBeds = booking.booking_rooms.some(
    (r) => r.inventory_kind === "driver_comp" && r.qty > 0,
  );
  const guestCount = Math.max(1, booking.adults || booking.booking_guests.length || 1);

  const [guidePick, setGuidePick] = useState<PartnerOption | null>(
    booking.guide_id
      ? (guides.find((g) => g.id === booking.guide_id) ?? null)
      : null,
  );
  const [guideNumber, setGuideNumber] = useState(booking.guide_number ?? "");
  const [paymentMode, setPaymentMode] = useState(booking.payment_mode ?? "cash");
  const [allowDirty, setAllowDirty] = useState(false);

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
    for (let i = 0; i < guestCount; i++) {
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
        roomUnitId: guestSlot?.assignedUnitId ?? "",
      });
    }
    return rows;
  });

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
          {state.folioId ? (
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
      </div>
    );
  }

  return (
    <form action={action} className="erp space-y-8 rounded-lg border bg-card p-6">
      <input type="hidden" name="booking_id" value={booking.id} />
      <input type="hidden" name="payment_mode" value={paymentMode} />
      <input type="hidden" name="allow_dirty_rooms" value={allowDirty ? "on" : "off"} />
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
          · {booking.adults} adults · {booking.rooms} rooms
        </p>
        {booking.agent_name ? (
          <p className="mt-1 text-xs">
            Agent {booking.agent_name}
            {booking.credit_available_btn != null
              ? ` · credit available ${formatBtn(booking.credit_available_btn)}`
              : ""}
            {booking.stay_estimate_btn != null
              ? ` · stay est. ${formatBtn(booking.stay_estimate_btn)}`
              : ""}
          </p>
        ) : null}
      </div>

      <fieldset className="space-y-4">
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

      <fieldset className="space-y-4">
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
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Guest documents ({guests.length})
        </legend>
        {guests.map((guest, index) => (
          <div
            key={`guest-${index}`}
            className="space-y-3 rounded-md border border-border/70 p-4"
          >
            <p className="text-sm font-medium">Guest {index + 1}</p>
            <div className="space-y-1.5">
              <Label htmlFor={`guest_name_${index}`}>Full name</Label>
              <Input
                id={`guest_name_${index}`}
                name="guest_name"
                required
                value={guest.fullName}
                onChange={(e) => {
                  const next = [...guests];
                  next[index] = { ...guest, fullName: e.target.value };
                  setGuests(next);
                }}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`guest_nat_${index}`}>Nationality</Label>
                <Input
                  id={`guest_nat_${index}`}
                  name="guest_nationality"
                  value={guest.nationality}
                  onChange={(e) => {
                    const next = [...guests];
                    next[index] = { ...guest, nationality: e.target.value };
                    setGuests(next);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`guest_id_${index}`}>{idLabel(origin)}</Label>
                <Input
                  id={`guest_id_${index}`}
                  name="guest_passport_or_cid"
                  required
                  value={guest.passportOrCid}
                  onChange={(e) => {
                    const next = [...guests];
                    next[index] = { ...guest, passportOrCid: e.target.value };
                    setGuests(next);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`guest_sdf_${index}`}>SDF reference</Label>
                <Input
                  id={`guest_sdf_${index}`}
                  name="guest_sdf_ref"
                  required={sdfRequired(origin)}
                  value={guest.sdfRef}
                  onChange={(e) => {
                    const next = [...guests];
                    next[index] = { ...guest, sdfRef: e.target.value };
                    setGuests(next);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`guest_doc_${index}`}>SDF doc URL</Label>
                <Input
                  id={`guest_doc_${index}`}
                  name="guest_sdf_doc_url"
                  type="url"
                  value={guest.sdfDocUrl}
                  onChange={(e) => {
                    const next = [...guests];
                    next[index] = { ...guest, sdfDocUrl: e.target.value };
                    setGuests(next);
                  }}
                  placeholder="https://…"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`guest_room_${index}`}>Sleeps in room</Label>
              <select
                id={`guest_room_${index}`}
                name="guest_room_unit_id"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={guest.roomUnitId}
                onChange={(e) => {
                  const next = [...guests];
                  next[index] = { ...guest, roomUnitId: e.target.value };
                  setGuests(next);
                }}
              >
                <option value="">Auto / first guest room</option>
                {selectedUnitIds.map((id) => {
                  const unit = units.find((u) => u.id === id);
                  if (!unit || unit.inventoryKind !== "sellable_guest") return null;
                  return (
                    <option key={id} value={id}>
                      {unit.label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setGuests((prev) => [
              ...prev,
              {
                fullName: "",
                nationality: "",
                passportOrCid: "",
                sdfRef: "",
                sdfDocUrl: "",
                roomUnitId: "",
              },
            ])
          }
        >
          Add guest
        </Button>
      </fieldset>

      <fieldset className="space-y-4">
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

      <Button type="submit" variant="citrus" disabled={pending} className="h-11 px-6">
        {pending ? "Checking in…" : "Confirm check-in"}
      </Button>
    </form>
  );
}

export function CheckOutForm({
  bookingId,
  rooms = [],
  folioBalance = 0,
}: {
  bookingId: string;
  rooms?: string[];
  folioBalance?: number;
}) {
  const [state, action, pending] = useActionState(confirmCheckOut, checkOutInitial);
  useActionToast(state, { successMessage: "Guest checked out" });
  const [allowBalance, setAllowBalance] = useState(false);

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
      </p>
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
