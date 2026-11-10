/**
 * Plain-text POS / folio receipt bodies for desk WhatsApp + email share.
 * Desk opens wa.me — not a WhatsApp Business API send.
 */

import { guestWaMeHref } from "@/lib/guest-wa-templates";
import { orderRef } from "@/lib/order-ref";
import { formatBtn } from "@/lib/pricing";

export type PosReceiptMessageLine = {
  name: string;
  qty: number;
  unitPriceBtn: number;
  lineTotalBtn: number;
};

export type PosReceiptMessageTender = {
  method: string;
  amountBtn: number;
  reference?: string | null;
};

export type PosReceiptMessageInput = {
  propertyName: string;
  orderId: string;
  customerName?: string | null;
  outlet?: string | null;
  createdAt?: string | null;
  settledAt?: string | null;
  subtotalBtn: number;
  serviceChargeBtn: number;
  gstBtn: number;
  totalBtn: number;
  lines: PosReceiptMessageLine[];
  tenders?: PosReceiptMessageTender[];
  unpaid?: boolean;
};

export type FolioReceiptMessageInput = {
  propertyName: string;
  folioLabel: string;
  docNo?: string | null;
  guestName?: string | null;
  lines: Array<{
    description: string;
    totalBtn: number;
    isPayment?: boolean;
  }>;
  chargesSum: number;
  paymentsSum: number;
};

const TENDER_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank transfer",
  card: "Card",
  agent_credit: "Charge agent",
  bank_qr: "Bank QR",
  pay_bt: "Pay.bt",
  deposit: "Deposit",
  room_charge: "Charge to room",
  nc: "Non-chargeable",
  comp: "Comp",
};

function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Digits-only phone usable for wa.me; blank for walk-in / placeholders. */
export function usableGuestPhone(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === "walk-in" || lower === "walkin" || lower === "n/a" || lower === "-") {
    return null;
  }
  const digits = raw.replace(/\D+/g, "");
  if (digits.length < 7) return null;
  return digits;
}

/**
 * Open WhatsApp with prefilled text. With a number → chat that contact;
 * without → generic compose (`wa.me/?text=`).
 */
export function receiptWaShareHref(
  phone: string | null | undefined,
  text: string,
): string {
  const withPhone = guestWaMeHref(phone, text);
  if (withPhone) return withPhone;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Short WhatsApp body pointing at the guest receipt URL (OG preview). */
export function buildPosReceiptWaLinkMessage(input: {
  propertyName: string;
  orderId: string;
  customerName?: string | null;
  totalBtn: number;
  unpaid?: boolean;
  shareUrl: string;
}): string {
  const hotel = input.propertyName.trim() || "Hotel";
  const ref = orderRef(input.orderId);
  const name = (input.customerName ?? "").trim();
  const greeting = name ? `Hi ${name},` : "Hi,";
  const kind = input.unpaid ? "order" : "receipt";
  return [
    greeting,
    "",
    `Here is your ${kind} from ${hotel} (${ref}) — ${formatBtn(input.totalBtn)}.`,
    "",
    "Open the link to view, print, or save as PDF:",
    input.shareUrl,
    "",
    `Thank you · ${hotel}`,
  ].join("\n");
}

export function buildPosReceiptMessage(input: PosReceiptMessageInput): string {
  const hotel = input.propertyName.trim() || "Hotel";
  const ref = orderRef(input.orderId);
  const when =
    shortDate(input.settledAt) ?? shortDate(input.createdAt) ?? null;
  const name = (input.customerName ?? "").trim() || "Guest";
  const unpaid = Boolean(input.unpaid);

  const lineRows = input.lines.map((line) => {
    const qty = Number(line.qty);
    const total = formatBtn(Number(line.lineTotalBtn));
    return `  ${qty} × ${line.name}  ${total}`;
  });

  const tenderRows = (input.tenders ?? []).map((t) => {
    const label = TENDER_LABELS[t.method] ?? t.method;
    const refNote = t.reference?.trim() ? ` (${t.reference.trim()})` : "";
    return `  ${label}${refNote}  ${formatBtn(Number(t.amountBtn))}`;
  });

  return [
    hotel,
    unpaid ? "ORDER / RECEIPT (unpaid)" : "RECEIPT",
    `Ref: ${ref}`,
    input.outlet ? `Outlet: ${input.outlet}` : null,
    `Guest: ${name}`,
    when ? `Date: ${when}` : null,
    "",
    "Items:",
    ...(lineRows.length ? lineRows : ["  (no lines)"]),
    "",
    `Subtotal: ${formatBtn(input.subtotalBtn)}`,
    input.serviceChargeBtn > 0
      ? `Service charge: ${formatBtn(input.serviceChargeBtn)}`
      : null,
    input.gstBtn > 0 ? `GST: ${formatBtn(input.gstBtn)}` : "GST: Nu 0",
    `Total: ${formatBtn(input.totalBtn)}`,
    tenderRows.length ? "" : null,
    tenderRows.length ? "Paid:" : null,
    ...tenderRows,
    unpaid ? "" : null,
    unpaid ? "Status: open — settle at the desk." : null,
    "",
    `Thank you · ${hotel}`,
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n");
}

export function buildFolioReceiptMessage(
  input: FolioReceiptMessageInput,
): string {
  const hotel = input.propertyName.trim() || "Hotel";
  const name = (input.guestName ?? "").trim() || "Guest";
  const chargeLines = input.lines.filter((l) => !l.isPayment);
  const paymentLines = input.lines.filter((l) => l.isPayment);
  const balance = Math.max(input.chargesSum - input.paymentsSum, 0);

  return [
    hotel,
    "GUEST FOLIO RECEIPT",
    input.docNo ? `Document: ${input.docNo}` : null,
    `Folio: ${input.folioLabel}`,
    `Guest: ${name}`,
    "",
    "Charges:",
    ...(chargeLines.length
      ? chargeLines.map(
          (l) => `  ${l.description}  ${formatBtn(Number(l.totalBtn))}`,
        )
      : ["  (none)"]),
    paymentLines.length ? "" : null,
    paymentLines.length ? "Payments:" : null,
    ...paymentLines.map(
      (l) => `  ${l.description}  ${formatBtn(Math.abs(Number(l.totalBtn)))}`,
    ),
    "",
    `Charges total: ${formatBtn(input.chargesSum)}`,
    input.paymentsSum > 0
      ? `Payments total: ${formatBtn(input.paymentsSum)}`
      : null,
    `Balance: ${formatBtn(balance)}`,
    "",
    `Thank you · ${hotel}`,
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n");
}
