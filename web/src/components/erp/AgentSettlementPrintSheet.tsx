"use client";

import type { SettlementPrintPack } from "@/app/actions/erp-settlement-pack";
import { bookingConfirmationLabel } from "@/lib/booking-ref";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { formatBtn, formatGuestBtn } from "@/lib/pricing";
import {
  defaultDocumentDesign,
  registrationLines,
  type PropertyDocumentDesign,
} from "@/lib/property-settings";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

/**
 * A4 guide-sign settlement / checkout card — FO prints, guide ink-signs at desk.
 * Design from Settings → Documents → Settlement.
 * Target for html[data-desk-print="settlement"] (see globals.css).
 */
export function AgentSettlementPrintSheet({
  pack,
  design: designProp,
  /** Lightweight fallback when live pack not loaded yet */
  fallback,
}: {
  pack?: SettlementPrintPack | null;
  design?: PropertyDocumentDesign | null;
  fallback?: {
    guestName: string;
    rooms: string[];
    checkIn: string;
    checkOut: string;
    guideNumber: string | null;
    agentName: string | null;
    confirmationCode?: string | null;
  };
}) {
  const data = pack ?? (fallback ? packFromFallback(fallback) : null);
  if (!data) return null;

  const design =
    designProp ?? pack?.design ?? defaultDocumentDesign("settlement");
  const brand = data.property.name || "Hotel";
  const legal = data.property.legalName?.trim() || brand;
  const logoSrc =
    design.show_logo && data.property.logoPublicId
      ? cloudinaryUrl(data.property.logoPublicId, { width: 200, crop: "fit" })
      : null;
  const conf = bookingConfirmationLabel({
    confirmationCode: data.confirmationCode,
    bookingId: data.bookingId,
  });
  const roomsLine =
    data.roomLabels.length > 0
      ? data.roomLabels.join(", ")
      : data.roomsBooked > 0
        ? `${data.roomsBooked} room${data.roomsBooked === 1 ? "" : "s"}`
        : "—";
  const paxParts: string[] = [];
  if (data.adults > 0)
    paxParts.push(`${data.adults} adult${data.adults === 1 ? "" : "s"}`);
  if (data.children > 0)
    paxParts.push(
      `${data.children} child${data.children === 1 ? "" : "ren"}`,
    );
  const paxLine = paxParts.length ? paxParts.join(" · ") : "—";
  const paymentLabel = paymentModeLabel(data.paymentMode);
  const asOf = fmtStamp(data.asOfIso);
  const notes = registrationLines(design.notes_text);
  const chargeLines = data.lines.filter(
    (l) =>
      l.sourceType !== "payment" &&
      l.sourceType !== "deposit" &&
      Math.abs(l.amountBtn) > 0.009,
  );
  const payLines = data.lines.filter(
    (l) =>
      (l.sourceType === "payment" || l.sourceType === "deposit") &&
      Math.abs(l.amountBtn) > 0.009,
  );
  const style = {
    ["--doc-brand" as string]: design.brand_color,
    ["--doc-accent" as string]: design.accent_color,
  } as CSSProperties;

  return (
    <article
      id="print-agent-settlement"
      aria-label="Agent settlement pack"
      style={style}
      className={cn(
        "doc-print-sheet mx-auto w-full max-w-[210mm] border bg-white px-5 py-4 text-[11px] leading-snug text-neutral-900",
        design.preset === "branded" &&
          "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--doc-accent)_10%,white)_0%,white_22%)]",
        design.preset === "compact" && "text-[10.5px]",
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
            {design.show_address && data.property.address ? (
              <span>{data.property.address}</span>
            ) : null}
            {design.show_phone && data.property.phone ? (
              <span>T {data.property.phone}</span>
            ) : null}
            {design.show_email && data.property.email ? (
              <span>{data.property.email}</span>
            ) : null}
            {design.show_tax_id && data.property.taxId ? (
              <span>Tax {data.property.taxId}</span>
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
              {brand
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")}
            </div>
          )}
          <p
            className="rounded px-1.5 py-0.5 text-[8px] font-semibold tracking-wider text-white uppercase"
            style={{ backgroundColor: design.accent_color }}
          >
            Guide sign · desk
          </p>
          <div className="mt-1 text-right">
            <p className="text-[8px] font-semibold tracking-wide text-neutral-500 uppercase">
              Conf
            </p>
            <p className="font-mono text-[11px] font-semibold text-neutral-900">
              {conf}
            </p>
            <p className="text-[8px] text-neutral-500">As of {asOf}</p>
          </div>
        </div>
      </header>

      {design.intro_text.trim() ? (
        <p className="mt-2 text-[10px] leading-snug text-neutral-600">
          {design.intro_text}
        </p>
      ) : null}

      <div className="mt-2.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <div className="space-y-1">
          <Field label="Guest" value={data.guestName || "—"} strong />
          {data.guestPhone ? (
            <Field label="Guest phone" value={data.guestPhone} />
          ) : null}
          <Field
            label="Agent (bill to)"
            value={data.agentName?.trim() || "—"}
            strong
          />
          {data.agentEmail ? (
            <Field label="Agent email" value={data.agentEmail} />
          ) : null}
          <Field
            label="Guide number"
            value={data.guideNumber?.trim() || "—"}
            strong
          />
        </div>
        <div className="space-y-1">
          <Field
            label="Stay"
            value={`${fmtIso(data.checkIn)} → ${fmtIso(data.checkOut)}`}
          />
          <Field
            label="Nights · rooms · pax"
            value={`${data.nights || "—"}n · ${roomsLine} · ${paxLine}`}
          />
          {data.mealPlanCode ? (
            <Field label="Meal plan" value={data.mealPlanCode} />
          ) : null}
          <Field label="Payment mode" value={paymentLabel} />
          <Field label="Assigned room(s)" value={roomsLine} />
        </div>
      </div>

      <section className="mt-3">
        <p
          className="text-[8px] font-semibold tracking-[0.16em] uppercase"
          style={{ color: design.brand_color }}
        >
          Folio amounts (Nu · live desk snapshot)
        </p>
        <div
          className="mt-1.5 grid grid-cols-3 gap-px border-2"
          style={{ borderColor: design.brand_color }}
        >
          <MoneyCell label="Charges" value={data.chargesBtn} />
          <MoneyCell label="Payments / deposits" value={data.paymentsBtn} />
          <MoneyCell label="Balance" value={data.balanceBtn} emphasize brand={design.brand_color} />
        </div>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          <div className="rounded border border-neutral-300 px-2.5 py-1.5">
            <p className="text-[8px] font-semibold tracking-wide text-neutral-500 uppercase">
              On agent AR / package
            </p>
            <p className="mt-0.5 text-base font-semibold tabular-nums">
              {formatGuestBtn(data.agentChargesBtn)}
            </p>
          </div>
          <div className="rounded border border-neutral-300 px-2.5 py-1.5">
            <p className="text-[8px] font-semibold tracking-wide text-neutral-500 uppercase">
              Guest-visible balance
            </p>
            <p className="mt-0.5 text-base font-semibold tabular-nums">
              {formatGuestBtn(data.guestBalanceBtn)}
            </p>
          </div>
        </div>
      </section>

      {(chargeLines.length > 0 || payLines.length > 0) && (
        <section className="mt-3">
          <p
            className="text-[8px] font-semibold tracking-[0.16em] uppercase"
            style={{ color: design.brand_color }}
          >
            Posted lines (summary)
          </p>
          <table className="mt-1 w-full border-collapse text-[9px]">
            <thead>
              <tr className="border-b border-neutral-400 text-left">
                <th className="py-1 pr-2 font-semibold">Description</th>
                <th className="py-1 pr-2 font-semibold">Bill to</th>
                <th className="py-1 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {[...chargeLines, ...payLines].slice(0, 16).map((l, i) => (
                <tr
                  key={`${l.description}-${i}`}
                  className="border-b border-neutral-200"
                >
                  <td className="py-1 pr-2 align-top">
                    {l.description || l.sourceType}
                  </td>
                  <td className="py-1 pr-2 align-top capitalize text-neutral-600">
                    {l.billTo || "guest"}
                  </td>
                  <td className="py-1 text-right align-top font-mono tabular-nums">
                    {formatBtn(l.amountBtn)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.lines.length > 16 ? (
            <p className="mt-0.5 text-[8px] text-neutral-500">
              +{data.lines.length - 16} more on full folio
            </p>
          ) : null}
        </section>
      )}

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

      <section
        className="mt-3 border px-3 py-2 text-[10px] leading-relaxed text-neutral-800"
        style={{ borderColor: `${design.brand_color}66` }}
      >
        <p className="font-semibold text-neutral-900">Guide acknowledgment</p>
        <p className="mt-1">
          {design.terms_text.trim() ||
            `I confirm that ${data.guestName || "the guest"} stayed at ${brand}${
              data.roomLabels.length
                ? ` (room ${data.roomLabels.join(", ")})`
                : ""
            } from ${fmtIso(data.checkIn)} to ${fmtIso(data.checkOut)} under agent ${
              data.agentName?.trim() || "—"
            }, and that the folio amounts shown (balance ${formatGuestBtn(
              data.balanceBtn,
            )}${
              data.agentChargesBtn > 0.009
                ? `; agent AR ${formatGuestBtn(data.agentChargesBtn)}`
                : ""
            }) are accepted for settlement.`}
        </p>
        <p className="mt-1.5 text-[9px] text-neutral-600">
          Guest: <strong>{data.guestName || "—"}</strong>
          {" · "}
          Agent: <strong>{data.agentName?.trim() || "—"}</strong>
          {" · "}
          Balance:{" "}
          <strong className="tabular-nums">
            {formatGuestBtn(data.balanceBtn)}
          </strong>
        </p>
      </section>

      <section className="mt-5 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="min-h-[3.25rem] border-b-2 border-neutral-900" />
          <p className="mt-1.5 text-[10px] font-semibold text-neutral-800">
            Guide signature (ink)
          </p>
          <p className="text-[8px] text-neutral-500">
            Print full name · Tour / licence # if different
          </p>
          <div className="mt-3 min-h-[1.75rem] border-b border-neutral-400" />
          <p className="mt-0.5 text-[8px] text-neutral-500">Name in print</p>
        </div>
        <div>
          <div className="min-h-[3.25rem] border-b-2 border-neutral-900" />
          <p className="mt-1.5 text-[10px] font-semibold text-neutral-800">
            Date &amp; hotel stamp
          </p>
          <p className="text-[8px] text-neutral-500">DD/MM/YYYY · stamp if any</p>
          <div className="mt-3 min-h-[1.75rem] border-b border-neutral-400" />
          <p className="mt-0.5 text-[8px] text-neutral-500">FO name (print)</p>
        </div>
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="min-h-[2rem] border-b border-neutral-400" />
          <p className="mt-0.5 text-[8px] text-neutral-500">FO signature</p>
        </div>
        <div>
          <div className="min-h-[2rem] border-b border-neutral-400" />
          <p className="mt-0.5 text-[8px] text-neutral-500">
            Manager (if amount disputed)
          </p>
        </div>
      </section>

      <footer className="mt-5 border-t border-neutral-200 pt-2 text-[9px] leading-relaxed text-neutral-500">
        <p>{design.footer_text}</p>
        <p className="mt-0.5 font-medium text-neutral-700">
          {brand}
          {data.property.address
            ? ` · ${data.property.address}`
            : " · Thimphu, Bhutan"}
          {data.property.phone ? ` · ${data.property.phone}` : null}
        </p>
      </footer>
    </article>
  );
}

function packFromFallback(f: {
  guestName: string;
  rooms: string[];
  checkIn: string;
  checkOut: string;
  guideNumber: string | null;
  agentName: string | null;
  confirmationCode?: string | null;
}): SettlementPrintPack {
  return {
    bookingId: "",
    property: {
      name: "Pelbu Suites",
      legalName: "Pelbu Suites Olakha",
      address: "Olakha, Thimphu, Bhutan",
      phone: null,
      email: null,
      taxId: null,
      logoPublicId: null,
    },
    design: defaultDocumentDesign("settlement"),
    guestName: f.guestName,
    guestPhone: null,
    confirmationCode: f.confirmationCode ?? null,
    checkIn: f.checkIn,
    checkOut: f.checkOut,
    nights: 0,
    adults: 0,
    children: 0,
    roomsBooked: f.rooms.length,
    roomLabels: f.rooms,
    mealPlanCode: null,
    agentName: f.agentName,
    agentEmail: null,
    guideNumber: f.guideNumber,
    paymentMode: null,
    chargesBtn: 0,
    paymentsBtn: 0,
    balanceBtn: 0,
    guestBalanceBtn: 0,
    agentChargesBtn: 0,
    lines: [],
    asOfIso: new Date().toISOString(),
  };
}

function paymentModeLabel(mode: string | null): string {
  if (!mode) return "—";
  const map: Record<string, string> = {
    cash: "Pay at checkout",
    prepaid: "Prepaid",
    partial: "Partial / deposit",
    on_credit: "Agent on credit (AR)",
    agent_credit: "Agent on credit (AR)",
  };
  return map[mode] ?? mode.replace(/_/g, " ");
}

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

function fmtStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Field({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-[8px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
        {label}
      </p>
      <p
        className={
          strong
            ? "text-[11px] font-semibold text-neutral-900"
            : "text-[11px] text-neutral-800"
        }
      >
        {value}
      </p>
    </div>
  );
}

function MoneyCell({
  label,
  value,
  emphasize,
  brand,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
  brand?: string;
}) {
  return (
    <div
      className={
        emphasize
          ? "bg-white px-2.5 py-2 text-neutral-900 ring-2 ring-inset"
          : "bg-white px-2.5 py-2 text-neutral-900"
      }
      style={
        emphasize && brand
          ? { boxShadow: `inset 0 0 0 2px ${brand}` }
          : undefined
      }
    >
      <p className="text-[8px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
        {label}
      </p>
      <p
        className={
          emphasize
            ? "mt-0.5 text-lg font-bold tabular-nums"
            : "mt-0.5 text-base font-semibold tabular-nums"
        }
      >
        {formatGuestBtn(value)}
      </p>
    </div>
  );
}

/** Shared print trigger used by guide evidence / pack pages. */
export function printAgentSettlementSheet() {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.setAttribute("data-desk-print", "settlement");
  html.setAttribute("data-doc-paper", "a4");
  const cleanup = () => {
    html.removeAttribute("data-desk-print");
    html.removeAttribute("data-doc-paper");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
  window.setTimeout(cleanup, 1500);
}
