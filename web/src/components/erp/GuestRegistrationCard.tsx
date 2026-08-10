"use client";

import { cloudinaryUrl } from "@/lib/cloudinary";
import { bookingConfirmationLabel } from "@/lib/booking-ref";

export type GuestRegistrationCardData = {
  bookingId: string;
  confirmationCode?: string;
  guestName: string;
  guestPhone?: string;
  guestOrigin?: string;
  passportOrCid?: string;
  sdfRef?: string;
  guideNumber?: string;
  agentLabel?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults?: number;
  children?: number;
  extraBeds?: number;
  mealPlanCode?: string;
  roomLines: { name: string; qty: number }[];
  rateNightlyBtn?: number | null;
  stayTotalBtn?: number | null;
};

type PropertyBits = {
  name?: string;
  address?: string | null;
  phone?: string | null;
  logo_public_id?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
};

function fmtIso(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * A4 print arrival registration card for guest signature at desk / check-in.
 */
export function GuestRegistrationCard({
  data,
  property,
}: {
  data: GuestRegistrationCardData;
  property?: PropertyBits;
}) {
  const brand = property?.name ?? "Pelbu Suites";
  const logoSrc = property?.logo_public_id
    ? cloudinaryUrl(property.logo_public_id, { width: 160, crop: "fit" })
    : null;
  const rooms =
    data.roomLines.map((l) => `${l.qty}× ${l.name}`).join(" · ") || "—";
  const checkInPolicy = property?.check_in_time?.trim() || "14:00";
  const checkOutPolicy = property?.check_out_time?.trim() || "12:00";
  const paxParts: string[] = [];
  if (data.adults != null && data.adults > 0) {
    paxParts.push(`${data.adults} adult${data.adults === 1 ? "" : "s"}`);
  }
  if (data.children != null && data.children > 0) {
    paxParts.push(`${data.children} child${data.children === 1 ? "" : "ren"}`);
  }
  if (data.extraBeds != null && data.extraBeds > 0) {
    paxParts.push(`${data.extraBeds} extra bed${data.extraBeds === 1 ? "" : "s"}`);
  }
  const paxLabel = paxParts.length ? paxParts.join(" · ") : "—";

  return (
    <section
      id="print-reg-card"
      aria-label="Guest arrival registration card"
      className="erp doc-print-sheet mx-auto max-w-[210mm] rounded-xl border bg-card px-8 py-8 text-foreground print:max-w-none print:rounded-none print:border-0 print:px-10 print:py-8 print:shadow-none"
    >
      <header className="flex items-start justify-between gap-4 border-b border-foreground/15 pb-5">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.22em] text-accent uppercase">
            {brand}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Arrival registration
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Please verify details and sign on arrival.
          </p>
          {property?.address ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {property.address}
            </p>
          ) : null}
          {property?.phone ? (
            <p className="text-xs text-muted-foreground">{property.phone}</p>
          ) : null}
        </div>
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt=""
            className="h-14 w-auto object-contain"
          />
        ) : null}
      </header>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Guest
          </p>
          <Field label="Full name" value={data.guestName || "—"} />
          <Field label="Phone" value={data.guestPhone?.trim() || "—"} />
          <Field
            label="Origin"
            value={data.guestOrigin?.replace(/_/g, " ") || "—"}
          />
          <Field label="ID / passport" value={data.passportOrCid || "—"} />
          <Field label="SDF ref" value={data.sdfRef || "—"} />
          <Field label="Guide no." value={data.guideNumber || "—"} />
          <Field label="Agent" value={data.agentLabel || "Walk-in / direct"} />
        </div>
        <div className="space-y-3">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Stay
          </p>
          <Field label="Check-in" value={fmtIso(data.checkIn)} />
          <Field label="Check-out" value={fmtIso(data.checkOut)} />
          <Field
            label="Nights"
            value={String(data.nights || "—")}
          />
          <Field label="Room(s)" value={rooms} />
          <Field label="Pax" value={paxLabel} />
          <Field label="Meal plan" value={data.mealPlanCode || "EP"} />
          <Field
            label="Confirmation"
            value={bookingConfirmationLabel({
              confirmationCode: data.confirmationCode,
              bookingId: data.bookingId,
            })}
          />
        </div>
      </div>

      <div className="mt-8 rounded-lg bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">House notes</p>
        <p className="mt-1">
          Standard check-in {checkInPolicy} · check-out {checkOutPolicy}. Photo
          ID required. Damages and minibar settle on the guest folio. Smoking
          only in designated areas.
        </p>
      </div>

      <div className="mt-10 grid gap-10 sm:grid-cols-2">
        <SignBlock title="Guest signature" />
        <SignBlock title="Staff signature" />
      </div>

      <p className="mt-8 text-center text-[10px] tracking-wide text-muted-foreground">
        Pelbu Suites · Thimphu · Guest copy for house records
      </p>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-0.5 border-b border-dashed border-foreground/20 pb-1 text-sm font-medium">
        {value}
      </p>
    </div>
  );
}

function SignBlock({ title }: { title: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {title}
      </p>
      <div className="mt-8 h-12 border-b border-foreground/40" />
      <p className="mt-2 text-xs text-muted-foreground">Date _______________</p>
    </div>
  );
}
