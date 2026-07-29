"use client";

import {
  confirmCheckIn,
  confirmCheckOut,
  type CheckInState,
  type CheckOutState,
} from "@/app/actions/erp-checkin";
import { useActionState, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import { useActionToast } from "@/hooks/use-action-toast";

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
  /** Free-text fields to autofill when this partner is picked. */
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
  booking_rooms: { qty: number; inventory_kind: string; room_types?: { name: string; code: string } | null }[];
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

function fieldClassName() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-gold";
}

const checkInInitial: CheckInState = { ok: false };
const checkOutInitial: CheckOutState = { ok: false };

type PartnerKind = "guide" | "driver";

/**
 * Compact partner picker built on the shadcn Combobox (Radix Popover + cmdk).
 * Renders a type-to-search list of saved partners and fires `onPick` whenever
 * staff pick an existing partner (autofill happens in the parent) or clear the
 * selection to type a new one. The hidden id input lives in the parent so the
 * server action contract is unchanged.
 */
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
    <div className="block text-sm text-espresso">
      <span className="mb-1.5 block font-medium">{label}</span>
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
      <span className="mt-1 block text-[11px] text-muted-foreground">
        Pick a returning partner to autofill, or leave on “New” and type below.
      </span>
    </div>
  );
}

export function CheckInForm({
  booking,
  guides = [],
  drivers = [],
}: {
  booking: CheckInBooking;
  guides?: PartnerOption[];
  drivers?: PartnerOption[];
}) {
  const [state, action, pending] = useActionState(confirmCheckIn, checkInInitial);
  useActionToast(state, { successMessage: "Guest checked in" });
  const guest = booking.booking_guests[0];
  const driver = booking.booking_drivers[0];
  const hasDriverBeds = booking.booking_rooms.some(
    (r) => r.inventory_kind === "driver_comp" && r.qty > 0,
  );

  // Partner-pick state. Tracks the chosen master id + autofill values for the
  // free-text fields below. Null = staff is typing a new partner.
  const [guidePick, setGuidePick] = useState<PartnerOption | null>(
    booking.guide_id
      ? guides.find((g) => g.id === booking.guide_id) ?? null
      : null,
  );
  const [guideNumber, setGuideNumber] = useState<string>(booking.guide_number ?? "");

  const [driverPick, setDriverPick] = useState<PartnerOption | null>(
    booking.driver_id
      ? drivers.find((d) => d.id === booking.driver_id) ?? null
      : null,
  );
  const [driverFields, setDriverFields] = useState({
    name: driver?.full_name ?? "",
    phone: driver?.phone ?? "",
    vehicle_no: driver?.vehicle_no ?? "",
    license_no: driver?.license_no ?? "",
  });

  if (state.ok && state.bookingId) {
    return (
      <div className="border border-espresso/10 bg-white px-6 py-8" role="status">
        <p className="text-xs tracking-[0.25em] text-gold uppercase">Checked in</p>
        <h2 className="mt-3 text-2xl text-espresso">Guest is in-house</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Folio opened
          {state.folioId ? (
            <>
              {" Â· "}
              <a
                href={`/erp/folios/${state.folioId}`}
                className="text-maroon underline-offset-4 hover:underline"
              >
                open folio
              </a>
            </>
          ) : null}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/erp/check-in"
            className="inline-flex min-h-11 items-center rounded-sm bg-gold px-5 text-sm font-medium text-espresso"
          >
            Next arrival
          </a>
          <a
            href="/erp/pos"
            className="inline-flex min-h-11 items-center rounded-sm border border-espresso/20 px-5 text-sm text-espresso"
          >
            POS
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-8 border border-espresso/10 bg-white px-6 py-8">
      <input type="hidden" name="booking_id" value={booking.id} />
      {state.error ? (
        <p className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="text-sm text-muted-foreground">
        <p className="font-medium text-espresso">
          {(booking.contact_name ?? "Guest")} Â· {booking.contact_phone ?? "—"}
        </p>
        <p>
          {booking.check_in} → {booking.check_out}{" "}
          <span className="ml-1 inline-flex items-center rounded-full border border-gold/40 bg-gold/5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-gold">
            {nightsBetween(booking.check_in, booking.check_out)} nights
          </span>{" "}
          <span className="ml-1 inline-flex items-center rounded-full border border-espresso/20 bg-espresso/[0.04] px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-espresso">
            {ORIGIN_LABELS[booking.guest_origin ?? "international"] ?? "International"}
          </span>{" "}
          Â· {booking.adults} adults Â· {booking.rooms} rooms Â· {booking.status}
        </p>
        <ul className="mt-2 space-y-1">
          {booking.booking_rooms.map((r, i) => (
            <li key={`${r.inventory_kind}-${i}`}>
              {r.qty}Ã— {r.room_types?.name ?? r.inventory_kind}
            </li>
          ))}
        </ul>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Guide & settlement
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
        <label className="block text-sm text-espresso">
          Guide number
          <input
            type="text"
            name="guide_number"
            value={guideNumber}
            onChange={(e) => {
              setGuideNumber(e.target.value);
              // Typing free-text means we are no longer on a saved partner.
              if (guidePick) setGuidePick(null);
            }}
            className={fieldClassName()}
            aria-required={(booking.guest_origin ?? "international") === "international"}
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {(booking.guest_origin ?? "international") === "international"
              ? "Required for international tourists."
              : "Optional — this guest origin does not require a guide."}
          </span>
        </label>
        <label className="block text-sm text-espresso">
          Payment mode
          <select
            name="payment_mode"
            required
            defaultValue={booking.payment_mode ?? "cash"}
            className={fieldClassName()}
          >
            <option value="cash">Cash</option>
            <option value="prepaid">Prepaid</option>
            <option value="partial">Partial</option>
            <option value="on_credit">On credit (agent)</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Guest SDF
        </legend>
        <label className="block text-sm text-espresso">
          Guest full name
          <input
            type="text"
            name="guest_name"
            required
            defaultValue={guest?.full_name ?? booking.contact_name ?? ""}
            className={fieldClassName()}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-espresso">
            Nationality
            <input
              type="text"
              name="nationality"
              defaultValue={guest?.nationality ?? ""}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            Passport / CID
            <input
              type="text"
              name="passport_or_cid"
              required
              defaultValue={guest?.passport_or_cid ?? ""}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            SDF reference
            <input
              type="text"
              name="sdf_ref"
              required
              defaultValue={guest?.sdf_ref ?? ""}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            SDF doc URL (optional)
            <input
              type="url"
              name="sdf_doc_url"
              defaultValue={guest?.sdf_doc_url ?? ""}
              placeholder="https://…"
              className={fieldClassName()}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
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
          <label className="block text-sm text-espresso">
            Driver name
            <input
              type="text"
              name="driver_name"
              required={hasDriverBeds}
              value={driverFields.name}
              onChange={(e) => {
                setDriverFields({ ...driverFields, name: e.target.value });
                if (driverPick) setDriverPick(null);
              }}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            Driver phone
            <input
              type="tel"
              name="driver_phone"
              value={driverFields.phone}
              onChange={(e) => {
                setDriverFields({ ...driverFields, phone: e.target.value });
                if (driverPick) setDriverPick(null);
              }}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            Vehicle no
            <input
              type="text"
              name="vehicle_no"
              value={driverFields.vehicle_no}
              onChange={(e) => {
                setDriverFields({ ...driverFields, vehicle_no: e.target.value });
                if (driverPick) setDriverPick(null);
              }}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            License no
            <input
              type="text"
              name="license_no"
              value={driverFields.license_no}
              onChange={(e) => {
                setDriverFields({ ...driverFields, license_no: e.target.value });
                if (driverPick) setDriverPick(null);
              }}
              className={fieldClassName()}
            />
          </label>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-sm bg-espresso px-6 text-sm font-medium text-ivory disabled:opacity-60"
      >
        {pending ? "Checking in…" : "Confirm check-in"}
      </button>
    </form>
  );
}

export function CheckOutForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(confirmCheckOut, checkOutInitial);
  useActionToast(state, { successMessage: "Guest checked out" });

  if (state.ok) {
    return (
      <p className="border border-espresso/10 bg-white px-4 py-3 text-sm text-espresso" role="status">
        Checked out.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white px-6 py-6">
      <input type="hidden" name="booking_id" value={bookingId} />
      {state.error ? (
        <p className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon" role="alert">
          {state.error}
        </p>
      ) : null}
      <p className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
        Check out
      </p>
      <label className="flex items-center gap-2 text-sm text-espresso">
        <input type="checkbox" name="allow_balance" className="h-4 w-4" />
        Allow checkout with folio balance
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-sm border border-espresso/20 px-5 text-sm text-espresso disabled:opacity-60"
      >
        {pending ? "Checking out…" : "Confirm check-out"}
      </button>
    </form>
  );
}
