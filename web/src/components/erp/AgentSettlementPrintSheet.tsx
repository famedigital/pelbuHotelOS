"use client";

import type { SettlementPrintPack } from "@/app/actions/erp-settlement-pack";
import { bookingConfirmationLabel } from "@/lib/booking-ref";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { formatBtn, formatGuestBtn } from "@/lib/pricing";

/**
 * A4 guide-sign settlement sheet — FO prints, guide ink-signs at desk.
 * Target for html[data-desk-print="settlement"] (see globals.css).
 */
export function AgentSettlementPrintSheet({
  pack,
  /** Lightweight fallback when live pack not loaded yet */
  fallback,
}: {
  pack?: SettlementPrintPack | null;
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

  const brand = data.property.name || "Pelbu Suites";
  const legal = data.property.legalName?.trim() || brand;
  const logoSrc = data.property.logoPublicId
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

  return (
    <article
      id="print-agent-settlement"
      aria-label="Agent settlement pack"
      className="doc-print-sheet mx-auto w-full max-w-[720px] bg-white px-7 py-6 text-neutral-900"
    >
      {/* —— Letterhead —— */}
      <header className="flex items-start justify-between gap-4 border-b-2 border-neutral-900 pb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-[#7b1e3a] uppercase">
            {brand}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">
            Agent settlement pack
          </h1>
          <p className="mt-1 max-w-md text-sm text-neutral-600">
            Guide signs in ink at desk. Front desk keeps scan; seal &amp; email
            agent after guests leave.
          </p>
          {legal !== brand ? (
            <p className="mt-2 text-xs text-neutral-600">{legal}</p>
          ) : null}
          {data.property.address ? (
            <p className="mt-0.5 text-xs text-neutral-600">
              {data.property.address}
            </p>
          ) : null}
          <p className="mt-0.5 text-xs text-neutral-600">
            {[data.property.phone, data.property.email]
              .filter(Boolean)
              .join(" · ") || "Olakha, Thimphu, Bhutan"}
          </p>
          {data.property.taxId ? (
            <p className="text-xs text-neutral-500">
              Tax / GST: {data.property.taxId}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt={`${brand} logo`}
              className="h-16 w-auto max-w-[140px] object-contain"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded border-2 border-neutral-900 text-center text-[9px] font-bold tracking-wide uppercase leading-tight">
              {brand
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")}
            </div>
          )}
          <div className="text-right">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-neutral-500 uppercase">
              Confirmation
            </p>
            <p className="font-mono text-sm font-semibold text-neutral-900">
              {conf}
            </p>
            <p className="mt-1 text-[10px] text-neutral-500">As of {asOf}</p>
          </div>
        </div>
      </header>

      {/* —— Parties & stay —— */}
      <section className="mt-5 grid gap-4 border-b border-neutral-300 pb-4 sm:grid-cols-2">
        <div className="space-y-3 text-sm">
          <Field label="Guest" value={data.guestName || "—"} strong />
          {data.guestPhone ? (
            <Field label="Guest phone" value={data.guestPhone} />
          ) : null}
          <Field label="Agent (bill to)" value={data.agentName?.trim() || "—"} strong />
          {data.agentEmail ? (
            <Field label="Agent email" value={data.agentEmail} />
          ) : null}
          <Field
            label="Guide number"
            value={data.guideNumber?.trim() || "—"}
            strong
          />
        </div>
        <div className="space-y-3 text-sm">
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
      </section>

      {/* —— Money summary —— */}
      <section className="mt-5">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-neutral-500 uppercase">
          Folio amounts (Nu · live desk snapshot)
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 border-2 border-neutral-900">
          <MoneyCell label="Charges" value={data.chargesBtn} />
          <MoneyCell label="Payments / deposits" value={data.paymentsBtn} />
          <MoneyCell label="Balance" value={data.balanceBtn} emphasize />
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded border border-neutral-300 px-3 py-2 text-sm">
            <p className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
              On agent AR / package
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {formatGuestBtn(data.agentChargesBtn)}
            </p>
          </div>
          <div className="rounded border border-neutral-300 px-3 py-2 text-sm">
            <p className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
              Guest-visible balance
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {formatGuestBtn(data.guestBalanceBtn)}
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-neutral-500">
          Not a fiscal tax invoice. GST INV is issued from the folio only.
          Amounts may change if desk posts further charges before seal.
        </p>
      </section>

      {/* —— Line preview —— */}
      {(chargeLines.length > 0 || payLines.length > 0) && (
        <section className="mt-5">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-neutral-500 uppercase">
            Posted lines (summary)
          </p>
          <table className="mt-2 w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-400 text-left">
                <th className="py-1.5 pr-2 font-semibold">Description</th>
                <th className="py-1.5 pr-2 font-semibold">Bill to</th>
                <th className="py-1.5 text-right font-semibold">Amount</th>
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
            <p className="mt-1 text-[10px] text-neutral-500">
              +{data.lines.length - 16} more on full folio
            </p>
          ) : null}
        </section>
      )}

      {/* —— Acknowledgment —— */}
      <section className="mt-5 border border-neutral-400 px-4 py-3 text-sm leading-relaxed text-neutral-800">
        <p className="font-semibold text-neutral-900">Guide acknowledgment</p>
        <p className="mt-1.5">
          I confirm that{" "}
          <strong>{data.guestName || "the guest"}</strong> stayed at {brand}
          {data.roomLabels.length
            ? ` (room ${data.roomLabels.join(", ")})`
            : ""}{" "}
          from {fmtIso(data.checkIn)} to {fmtIso(data.checkOut)} under agent{" "}
          <strong>{data.agentName?.trim() || "—"}</strong>, and that the folio
          amounts shown above (balance{" "}
          <strong>{formatGuestBtn(data.balanceBtn)}</strong>
          {data.agentChargesBtn > 0.009
            ? `; agent AR ${formatGuestBtn(data.agentChargesBtn)}`
            : ""}
          ) are accepted for settlement under our agreed commercial terms with
          Pelbu Suites.
        </p>
      </section>

      {/* —— Signatures —— */}
      <section className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <div className="min-h-[3.75rem] border-b-2 border-neutral-900" />
          <p className="mt-2 text-[11px] font-semibold text-neutral-800">
            Guide signature (ink)
          </p>
          <p className="text-[10px] text-neutral-500">
            Print full name · Tour / licence # if different
          </p>
          <div className="mt-4 min-h-[2rem] border-b border-neutral-400" />
          <p className="mt-1 text-[10px] text-neutral-500">Name in print</p>
        </div>
        <div>
          <div className="min-h-[3.75rem] border-b-2 border-neutral-900" />
          <p className="mt-2 text-[11px] font-semibold text-neutral-800">
            Date &amp; hotel stamp
          </p>
          <p className="text-[10px] text-neutral-500">DD/MM/YYYY · stamp if any</p>
          <div className="mt-4 min-h-[2rem] border-b border-neutral-400" />
          <p className="mt-1 text-[10px] text-neutral-500">FO name (print)</p>
        </div>
      </section>

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="min-h-[2.5rem] border-b border-neutral-400" />
          <p className="mt-1 text-[10px] text-neutral-500">FO signature</p>
        </div>
        <div>
          <div className="min-h-[2.5rem] border-b border-neutral-400" />
          <p className="mt-1 text-[10px] text-neutral-500">
            Manager (if amount disputed)
          </p>
        </div>
      </section>

      <footer className="mt-8 border-t border-neutral-300 pt-3 text-[10px] leading-relaxed text-neutral-500">
        <p>
          Desk evidence only · not a tax invoice · not a room voucher for
          check-in. After ink sign: camera / scan on StayHub Checkout, then seal
          &amp; email agent.
        </p>
        <p className="mt-1 font-medium text-neutral-700">
          {brand}
          {data.property.address ? ` · ${data.property.address}` : " · Thimphu, Bhutan"}
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
    cash: "Cash / walk-in",
    prepaid: "Prepaid",
    partial: "Partial",
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
      <p className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
        {label}
      </p>
      <p className={strong ? "font-semibold text-neutral-900" : "text-neutral-800"}>
        {value}
      </p>
    </div>
  );
}

function MoneyCell({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div
      className={
        emphasize
          ? "border-l-0 bg-white px-3 py-2.5 text-neutral-900 ring-2 ring-inset ring-neutral-900"
          : "bg-white px-3 py-2.5 text-neutral-900"
      }
    >
      <p className="text-[9px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
        {label}
      </p>
      <p
        className={
          emphasize
            ? "mt-0.5 text-xl font-bold tabular-nums"
            : "mt-0.5 text-lg font-semibold tabular-nums"
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
