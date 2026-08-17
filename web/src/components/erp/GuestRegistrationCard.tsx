"use client";

import { cloudinaryUrl } from "@/lib/cloudinary";
import { bookingConfirmationLabel } from "@/lib/booking-ref";
import {
  defaultRegistrationDesign,
  registrationLines,
  type PropertyRegistrationDesign,
} from "@/lib/property-settings";
import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";

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

export type GuestRegistrationPropertyBits = {
  name?: string;
  legal_name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_id?: string | null;
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
 * Compact A4 arrival registration card for desk print + guest signature.
 * Content (policies / dos / don’ts) is driven by Settings → Documents → Registration.
 */
export function GuestRegistrationCard({
  data,
  property,
  design: designProp,
}: {
  data: GuestRegistrationCardData;
  property?: GuestRegistrationPropertyBits;
  design?: PropertyRegistrationDesign | null;
}) {
  const design = designProp ?? defaultRegistrationDesign();
  const brand = property?.name ?? "Pelbu Suites";
  const legal = property?.legal_name?.trim() || brand;
  const logoSrc =
    design.show_logo && property?.logo_public_id
      ? cloudinaryUrl(property.logo_public_id, { width: 180, crop: "fit" })
      : null;
  const rooms =
    (data.roomLines ?? [])
      .map((l) => `${l.qty}× ${l.name}`)
      .join(" · ") || "—";
  const checkInPolicy = property?.check_in_time?.trim() || "14:00";
  const checkOutPolicy = property?.check_out_time?.trim() || "12:00";
  const paxParts: string[] = [];
  if (data.adults != null && data.adults > 0) {
    paxParts.push(`${data.adults} adult${data.adults === 1 ? "" : "s"}`);
  }
  if (data.children != null && data.children > 0) {
    paxParts.push(
      `${data.children} child${data.children === 1 ? "" : "ren"}`,
    );
  }
  if (data.extraBeds != null && data.extraBeds > 0) {
    paxParts.push(
      `${data.extraBeds} extra bed${data.extraBeds === 1 ? "" : "s"}`,
    );
  }
  const paxLabel = paxParts.length ? paxParts.join(" · ") : "—";

  const policies = registrationLines(design.policies_text);
  const dos = registrationLines(design.dos_text);
  const donts = registrationLines(design.donts_text);
  const conf = bookingConfirmationLabel({
    confirmationCode: data.confirmationCode,
    bookingId: data.bookingId,
  });

  const style = {
    ["--reg-brand" as string]: design.brand_color,
    ["--reg-accent" as string]: design.accent_color,
  } as CSSProperties;

  return (
    <section
      id="print-reg-card"
      aria-label="Guest arrival registration card"
      style={style}
      className={cn(
        "erp doc-print-sheet mx-auto max-w-[210mm] border bg-white text-foreground",
        "px-5 py-4 text-[11px] leading-snug print:max-w-none print:rounded-none print:border-0 print:px-6 print:py-4 print:shadow-none",
        design.preset === "branded" &&
          "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--reg-accent)_10%,white)_0%,white_22%)]",
      )}
    >
      {/* Header */}
      <header
        className="flex items-start justify-between gap-3 border-b-2 pb-2.5"
        style={{ borderColor: design.brand_color }}
      >
        <div className="min-w-0 flex-1">
          <p
            className="text-[9px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: design.brand_color }}
          >
            {legal}
          </p>
          <h1
            className="mt-0.5 text-lg font-semibold tracking-tight"
            style={{ color: design.brand_color }}
          >
            {design.title}
          </h1>
          <p className="mt-0.5 text-[10px] text-neutral-600">
            {design.header_text}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-neutral-500">
            {design.show_address && property?.address ? (
              <span>{property.address}</span>
            ) : null}
            {design.show_phone && property?.phone ? (
              <span>T {property.phone}</span>
            ) : null}
            {design.show_email && property?.email ? (
              <span>{property.email}</span>
            ) : null}
            {design.show_tax_id && property?.tax_id ? (
              <span>Tax {property.tax_id}</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt=""
              className="h-12 w-auto max-w-[7rem] object-contain"
            />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-md text-[10px] font-bold tracking-wide text-white"
              style={{ backgroundColor: design.brand_color }}
              aria-hidden
            >
              {brand.slice(0, 2).toUpperCase()}
            </div>
          )}
          <p
            className="rounded px-1.5 py-0.5 text-[8px] font-semibold tracking-wider text-white uppercase"
            style={{ backgroundColor: design.accent_color }}
          >
            Hotel copy
          </p>
        </div>
      </header>

      {(design.intro_text ?? "").trim() ? (
        <p className="mt-2 text-[10px] leading-snug text-neutral-600">
          {design.intro_text}
        </p>
      ) : null}

      {/* Stay meta strip */}
      <div
        className="mt-2 grid grid-cols-4 gap-1 rounded border px-2 py-1.5 text-[9px]"
        style={{ borderColor: `${design.accent_color}55` }}
      >
        <Meta label="Confirmation" value={conf} />
        <Meta label="Arrives" value={fmtIso(data.checkIn)} />
        <Meta label="Departs" value={fmtIso(data.checkOut)} />
        <Meta
          label="Nights"
          value={`${data.nights || "—"} · CI ${checkInPolicy} / CO ${checkOutPolicy}`}
        />
      </div>

      {/* Guest + stay fields */}
      <div className="mt-2.5 grid gap-x-4 gap-y-0 sm:grid-cols-2">
        <div>
          <SectionLabel color={design.brand_color}>Guest</SectionLabel>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <Field
              className="col-span-2"
              label="Full name"
              value={data.guestName || "—"}
            />
            <Field label="Phone" value={data.guestPhone?.trim() || "—"} />
            <Field
              label="Origin"
              value={data.guestOrigin?.replace(/_/g, " ") || "—"}
            />
            <Field
              label="ID / passport"
              value={data.passportOrCid || "—"}
            />
            <Field label="SDF ref" value={data.sdfRef || "—"} />
            <Field label="Guide no." value={data.guideNumber || "—"} />
            <Field
              label="Agent"
              value={data.agentLabel || "Walk-in / direct"}
            />
          </div>
        </div>
        <div>
          <SectionLabel color={design.brand_color}>Stay</SectionLabel>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <Field className="col-span-2" label="Room(s)" value={rooms} />
            <Field label="Pax" value={paxLabel} />
            <Field label="Meal plan" value={data.mealPlanCode || "EP"} />
            <Field
              label="Rate / night"
              value={
                data.rateNightlyBtn != null
                  ? `Nu ${Math.round(data.rateNightlyBtn)}`
                  : "Sheet / agreed"
              }
            />
            <Field
              label="Stay total"
              value={
                data.stayTotalBtn != null
                  ? `Nu ${Math.round(data.stayTotalBtn)}`
                  : "On folio"
              }
            />
          </div>
          {/* Hand-fill blanks for FO if OCR missing */}
          <div className="mt-1.5 space-y-1 border border-dashed border-neutral-300 px-2 py-1.5">
            <p className="text-[8px] font-semibold tracking-wide text-neutral-500 uppercase">
              Desk notes (hand fill)
            </p>
            <BlankLine label="Vehicle / plate" />
            <BlankLine label="Special requests" />
          </div>
        </div>
      </div>

      {/* Policies + do / don't */}
      <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
        <PolicyBlock
          title="House policies"
          lines={policies}
          brand={design.brand_color}
          className="sm:col-span-1"
        />
        <PolicyBlock
          title="Please do"
          lines={dos}
          brand={design.accent_color}
          tone="do"
        />
        <PolicyBlock
          title="Please don’t"
          lines={donts}
          brand="#b45309"
          tone="dont"
        />
      </div>

      {/* Terms + signatures */}
      {(design.terms_text ?? "").trim() ? (
        <p className="mt-2 border-t border-neutral-200 pt-1.5 text-[9px] leading-snug text-neutral-700">
          <span className="font-semibold">Guest acknowledgment. </span>
          {design.terms_text}
        </p>
      ) : null}

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <SignBlock title="Guest signature" brand={design.brand_color} />
        <SignBlock title="Front desk / staff" brand={design.brand_color} />
      </div>

      <footer
        className="mt-2.5 flex items-center justify-between border-t pt-1.5 text-[8px] tracking-wide text-neutral-500"
        style={{ borderColor: `${design.brand_color}33` }}
      >
        <span>{design.footer_text}</span>
        <span className="tabular-nums">{conf}</span>
      </footer>
    </section>
  );
}

function SectionLabel({
  children,
  color,
}: {
  children: ReactNode;
  color: string;
}) {
  return (
    <p
      className="mb-1 text-[8px] font-semibold tracking-[0.16em] uppercase"
      style={{ color }}
    >
      {children}
    </p>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[7px] font-semibold tracking-wide text-neutral-500 uppercase">
        {label}
      </p>
      <p className="truncate font-medium text-foreground">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[7px] font-medium tracking-wide text-neutral-500 uppercase">
        {label}
      </p>
      <p className="border-b border-dashed border-neutral-300 pb-0.5 text-[11px] font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}

function BlankLine({ label }: { label: string }) {
  return (
    <div className="flex items-end gap-2">
      <span className="w-24 shrink-0 text-[8px] text-neutral-500">{label}</span>
      <span className="mb-0.5 h-px flex-1 border-b border-dashed border-neutral-400" />
    </div>
  );
}

function PolicyBlock({
  title,
  lines,
  brand,
  tone,
  className,
}: {
  title: string;
  lines: string[];
  brand: string;
  tone?: "do" | "dont";
  className?: string;
}) {
  if (!lines.length) return null;
  return (
    <div
      className={cn(
        "rounded border px-2 py-1.5",
        tone === "dont" && "bg-amber-50/80",
        tone === "do" && "bg-sky-50/60",
        className,
      )}
      style={{ borderColor: `${brand}44` }}
    >
      <p
        className="text-[8px] font-semibold tracking-[0.14em] uppercase"
        style={{ color: brand }}
      >
        {title}
      </p>
      <ul className="mt-1 space-y-0.5">
        {lines.map((line) => (
          <li
            key={line}
            className="flex gap-1 text-[8.5px] leading-snug text-neutral-700"
          >
            <span className="mt-0.5 shrink-0" style={{ color: brand }}>
              •
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignBlock({ title, brand }: { title: string; brand: string }) {
  return (
    <div>
      <p
        className="text-[8px] font-semibold tracking-[0.14em] uppercase"
        style={{ color: brand }}
      >
        {title}
      </p>
      <div className="mt-5 h-8 border-b border-neutral-500" />
      <p className="mt-1 text-[8px] text-neutral-500">
        Name ________________ · Date ____________
      </p>
    </div>
  );
}
