"use client";

import { Button } from "@/components/ui/button";
import { AgentVoucherEmailButton } from "@/components/erp/AgentVoucherEmailButton";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { bookingConfirmationLabel } from "@/lib/booking-ref";
import {
  defaultDocumentDesign,
  registrationLines,
  type PropertyDocumentDesign,
} from "@/lib/property-settings";
import { printDeskSheet } from "@/lib/desk-print";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

export type FastBookVoucherData = {
  bookingId: string;
  confirmationCode?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestName: string;
  guestPhone?: string;
  agentId?: string;
  agentLabel?: string;
  guideNumber?: string;
  lines: { name: string; code: string; qty: number }[];
};

type VoucherProperty = {
  name: string;
  legal_name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_id?: string | null;
  logo_public_id?: string | null;
};

function fmtIso(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Agent room voucher — present at check-in. No rates.
 * Design from Settings → Documents → Voucher.
 */
export function FastBookVoucher({
  data,
  property,
  design: designProp,
}: {
  data: FastBookVoucherData;
  property?: VoucherProperty;
  design?: PropertyDocumentDesign;
}) {
  const design = designProp ?? defaultDocumentDesign("voucher");
  const brandName = property?.name ?? "Hotel";
  const legalName = property?.legal_name?.trim() || brandName;
  const logoSrc =
    design.show_logo && property?.logo_public_id
      ? cloudinaryUrl(property.logo_public_id, { width: 180, crop: "fit" })
      : null;
  const notes = registrationLines(design.notes_text ?? "");
  const conf = bookingConfirmationLabel({
    confirmationCode: data.confirmationCode,
    bookingId: data.bookingId,
  });
  const style = {
    ["--doc-brand" as string]: design.brand_color,
    ["--doc-accent" as string]: design.accent_color,
  } as CSSProperties;

  return (
    <section
      id="print-agent-voucher"
      aria-label="Agent voucher"
      style={style}
      className={cn(
        "erp doc-print-sheet mx-auto max-w-[210mm] border bg-white text-foreground",
        "flex flex-col gap-0 px-5 py-4 text-[11px] leading-snug print:max-w-none print:rounded-none print:border-0 print:px-6 print:py-4 print:shadow-none",
        design.preset === "branded" &&
          "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--doc-accent)_10%,white)_0%,white_22%)]",
      )}
    >
      <header
        className="flex items-start justify-between gap-3 border-b-2 pb-2.5"
        style={{ borderColor: design.brand_color }}
      >
        <div className="min-w-0 flex-1">
          <p
            className="text-[9px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: design.brand_color }}
          >
            {legalName}
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
              {brandName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <p
            className="rounded px-1.5 py-0.5 text-[8px] font-semibold tracking-wider text-white uppercase"
            style={{ backgroundColor: design.accent_color }}
          >
            Agent · rooms only
          </p>
        </div>
      </header>

      {(design.intro_text ?? "").trim() ? (
        <p className="mt-2 text-[10px] leading-snug text-neutral-600">
          {design.intro_text}
        </p>
      ) : null}

      <div
        className="mt-2 grid grid-cols-4 gap-1 rounded border px-2 py-1.5 text-[9px]"
        style={{ borderColor: `${design.accent_color}55` }}
      >
        <Meta label="Confirmation" value={conf} />
        <Meta label="Check-in" value={fmtIso(data.checkIn)} />
        <Meta label="Check-out" value={fmtIso(data.checkOut)} />
        <Meta label="Nights" value={String(data.nights || "—")} />
      </div>

      <div className="mt-2.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <Field label="Guest" value={data.guestName || "—"} />
        {data.guestPhone ? (
          <Field label="Phone" value={data.guestPhone} />
        ) : null}
        {data.agentLabel ? (
          <Field label="Agent" value={data.agentLabel} />
        ) : null}
        {data.guideNumber ? (
          <Field label="Guide no." value={data.guideNumber} />
        ) : null}
      </div>

      <div className="mt-2.5 overflow-hidden rounded border-2 border-neutral-800">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr
              className="text-left text-[8px] tracking-[0.14em] text-white uppercase"
              style={{ backgroundColor: design.brand_color }}
            >
              <th className="px-2 py-1.5 font-semibold">Rooms allocated</th>
              <th className="px-2 py-1.5 text-right font-semibold">Qty</th>
            </tr>
          </thead>
          <tbody>
            {(data.lines ?? []).length === 0 ? (
              <tr>
                <td colSpan={2} className="px-2 py-2 text-neutral-500">
                  No room lines.
                </td>
              </tr>
            ) : (
              (data.lines ?? []).map((l) => (
                <tr
                  key={`${l.code}-${l.name}`}
                  className="border-t border-neutral-300"
                >
                  <td className="px-2 py-1.5 text-neutral-900">
                    <span className="font-semibold">{l.qty} × </span>
                    {l.name}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                    {l.qty}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {notes.length > 0 ? (
        <ul className="mt-2.5 space-y-0.5 text-[9px] text-neutral-600">
          {notes.map((line) => (
            <li key={line} className="flex gap-1.5">
              <span style={{ color: design.accent_color }}>•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {(design.terms_text ?? "").trim() ? (
        <p className="mt-2 rounded border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-[9px] leading-snug text-neutral-700">
          {design.terms_text}
        </p>
      ) : null}

      <footer className="mt-3 border-t border-neutral-200 pt-2 text-[9px] text-neutral-500">
        {design.footer_text}
      </footer>

      <div className="mt-3 flex flex-wrap gap-2 print:hidden">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => printDeskSheet("voucher")}
        >
          Print agent voucher
        </Button>
        {data.agentId ? (
          <AgentVoucherEmailButton bookingId={data.bookingId} />
        ) : null}
      </div>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[8px] font-semibold tracking-wide text-neutral-500 uppercase">
        {label}
      </p>
      <p className="font-medium text-neutral-900">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[8px] font-semibold tracking-wide text-neutral-500 uppercase">
        {label}
      </p>
      <p className="text-[11px] font-medium text-neutral-900">{value}</p>
    </div>
  );
}
