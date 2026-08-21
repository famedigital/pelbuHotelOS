"use client";

import { cloudinaryUrl } from "@/lib/cloudinary";
import {
  defaultRegistrationDesign,
  type PropertyRegistrationDesign,
} from "@/lib/property-settings";
import type { RoomingListPayload } from "@/app/actions/erp-reservations-party";
import type { GuestRegistrationPropertyBits } from "@/components/erp/GuestRegistrationCard";
import type { CSSProperties } from "react";

function fmtIso(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const t0 = new Date(`${checkIn.slice(0, 10)}T12:00:00`).getTime();
  const t1 = new Date(`${checkOut.slice(0, 10)}T12:00:00`).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return 1;
  return Math.round((t1 - t0) / 86_400_000);
}

function inRoomGuest(
  line: RoomingListPayload["lines"][number],
  groupName: string | null,
): string {
  const named = line.guests.find((g) => g.fullName.trim())?.fullName.trim();
  if (named) return named;
  const contact = line.contactName?.trim() || "";
  if (
    groupName &&
    contact.toLowerCase() === groupName.trim().toLowerCase()
  ) {
    return "—";
  }
  return contact || "—";
}

/**
 * Group arrival sheet — one page of party identity + rooming list.
 * Tour leader signs once; per-room cards stay on “Print this room”.
 */
export function PartyRegistrationSheet({
  rooming,
  agentLabel,
  guideNumber,
  confirmationCode,
  property,
  design: designProp,
}: {
  rooming: RoomingListPayload;
  agentLabel?: string | null;
  guideNumber?: string | null;
  confirmationCode?: string | null;
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
  const checkInPolicy = property?.check_in_time?.trim() || "14:00";
  const checkOutPolicy = property?.check_out_time?.trim() || "12:00";

  const checkIn = rooming.lines[0]?.checkIn ?? "";
  const checkOut = rooming.lines.reduce((latest, l) => {
    return l.checkOut > latest ? l.checkOut : latest;
  }, rooming.lines[0]?.checkOut ?? "");
  const nights = nightsBetween(checkIn, checkOut);
  const partyName =
    rooming.groupName?.trim() || rooming.leaderName?.trim() || "Party";
  const leader = rooming.leaderName?.trim() || partyName;
  const roomCount = rooming.lines.length;
  const pax = [
    rooming.totalAdults > 0
      ? `${rooming.totalAdults} adult${rooming.totalAdults === 1 ? "" : "s"}`
      : null,
    rooming.totalChildren > 0
      ? `${rooming.totalChildren} child${rooming.totalChildren === 1 ? "" : "ren"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const style = {
    ["--reg-brand" as string]: design.brand_color,
    ["--reg-accent" as string]: design.accent_color,
  } as CSSProperties;

  return (
    <section
      id="print-reg-party"
      aria-label="Group arrival registration"
      style={style}
      className="erp doc-print-sheet mx-auto max-w-[210mm] border bg-white px-5 py-4 text-[11px] leading-snug text-foreground print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none"
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
            {legal}
          </p>
          <h1
            className="mt-0.5 text-lg font-semibold tracking-tight"
            style={{ color: design.brand_color }}
          >
            Group registration
          </h1>
          <p className="mt-0.5 text-[10px] text-neutral-600">
            Party arrival sheet · rooming list · tour leader signs once
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
            Group copy
          </p>
        </div>
      </header>

      <div
        className="mt-2 grid grid-cols-4 gap-1 rounded border px-2 py-1.5 text-[9px]"
        style={{ borderColor: `${design.accent_color}55` }}
      >
        <div className="min-w-0">
          <p className="text-[7px] font-semibold tracking-wide text-neutral-500 uppercase">
            Party
          </p>
          <p className="truncate font-medium">{partyName}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[7px] font-semibold tracking-wide text-neutral-500 uppercase">
            Arrives
          </p>
          <p className="truncate font-medium">{fmtIso(checkIn)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[7px] font-semibold tracking-wide text-neutral-500 uppercase">
            Departs
          </p>
          <p className="truncate font-medium">{fmtIso(checkOut)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[7px] font-semibold tracking-wide text-neutral-500 uppercase">
            Stay
          </p>
          <p className="truncate font-medium">
            {nights}n · CI {checkInPolicy} / CO {checkOutPolicy}
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <Field label="Tour leader / booker" value={leader} />
        <Field label="Phone" value={rooming.leaderPhone?.trim() || "—"} />
        <Field label="Agent" value={agentLabel?.trim() || "—"} />
        <Field label="Guide no." value={guideNumber?.trim() || "—"} />
        <Field
          label="Rooms"
          value={`${roomCount} room${roomCount === 1 ? "" : "s"}`}
        />
        <Field label="Pax" value={pax || "—"} />
        <Field
          label="Confirmation"
          value={confirmationCode?.trim() || "Party"}
        />
        <Field label="Meal / notes" value="See rooming · folio" />
      </div>

      <p
        className="mt-2.5 text-[8px] font-semibold tracking-[0.16em] uppercase"
        style={{ color: design.brand_color }}
      >
        Rooming list
      </p>
      <table className="mt-1 w-full border-collapse text-left text-[9px]">
        <thead>
          <tr
            className="border-b text-[8px] font-semibold tracking-wide text-neutral-500 uppercase"
            style={{ borderColor: `${design.brand_color}33` }}
          >
            <th className="py-1 pr-1.5">#</th>
            <th className="py-1 pr-1.5">Room</th>
            <th className="py-1 pr-1.5">In-room guest</th>
            <th className="py-1 pr-1.5">Pax</th>
            <th className="py-1">Status</th>
          </tr>
        </thead>
        <tbody>
          {rooming.lines.map((line, i) => {
            const paxLine = [
              line.adults > 0 ? `${line.adults}A` : null,
              line.children > 0 ? `${line.children}C` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <tr
                key={`${line.bookingId}:${line.assignmentId ?? i}`}
                className="border-b border-dashed border-neutral-200"
              >
                <td className="py-0.5 pr-1.5 tabular-nums text-neutral-500">
                  {i + 1}
                </td>
                <td className="py-0.5 pr-1.5 font-semibold tabular-nums">
                  {line.roomLabel?.trim() ||
                    line.roomTypeName?.trim() ||
                    "—"}
                </td>
                <td className="py-0.5 pr-1.5">
                  {inRoomGuest(line, rooming.groupName)}
                </td>
                <td className="py-0.5 pr-1.5 tabular-nums">{paxLine || "—"}</td>
                <td className="py-0.5 text-neutral-600">
                  {line.status.replace(/_/g, " ")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-2 text-[9px] leading-snug text-neutral-700">
        <span className="font-semibold">Tour leader acknowledgment. </span>
        The leader confirms this rooming list, accepts house policies for all
        rooms, and remains the contact for charges billed to the agent or
        master folio.
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p
            className="text-[8px] font-semibold tracking-[0.14em] uppercase"
            style={{ color: design.brand_color }}
          >
            Tour leader signature
          </p>
          <div className="mt-5 h-8 border-b border-neutral-500" />
          <p className="mt-1 text-[8px] text-neutral-500">
            Name ________________ · Date ____________
          </p>
        </div>
        <div>
          <p
            className="text-[8px] font-semibold tracking-[0.14em] uppercase"
            style={{ color: design.brand_color }}
          >
            Front desk / staff
          </p>
          <div className="mt-5 h-8 border-b border-neutral-500" />
          <p className="mt-1 text-[8px] text-neutral-500">
            Name ________________ · Date ____________
          </p>
        </div>
      </div>

      <footer
        className="mt-2.5 flex items-center justify-between border-t pt-1.5 text-[8px] tracking-wide text-neutral-500"
        style={{ borderColor: `${design.brand_color}33` }}
      >
        <span>{design.footer_text || brand}</span>
        <span className="tabular-nums">
          {roomCount} rooms · {pax || "pax"}
        </span>
      </footer>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[7px] font-medium tracking-wide text-neutral-500 uppercase">
        {label}
      </p>
      <p className="border-b border-dashed border-neutral-300 pb-0.5 font-medium">
        {value}
      </p>
    </div>
  );
}
