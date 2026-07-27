/**
 * Desk + guest alerts for new bookings/orders.
 * Failures are logged only — never block a successful save.
 */

import { Resend } from "resend";

export type BookingNotifyPayload = {
  bookingId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms: number;
  guideNumber: string | null;
  notes: string | null;
};

export type OrderNotifyPayload = {
  orderId: string;
  customerName: string;
  phone: string;
  deliveryType: "pickup" | "taxi";
  deliveryAddress: string | null;
  outlet: string;
  totalBtn: number;
  itemSummary: string;
  notes: string | null;
};

function deskEmail(): string | null {
  return process.env.NOTIFY_DESK_EMAIL?.trim() || null;
}

function resendFrom(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Pelbu Suites <onboarding@resend.dev>"
  );
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://pelbusuites.bt";
}

async function sendDeskEmail(subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = deskEmail();
  if (!apiKey || !to) {
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: resendFrom(),
    to: [to],
    subject,
    text,
  });

  if (error) {
    console.error("Resend desk email failed", error);
  }
}

async function sendGuestEmail(
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: resendFrom(),
    to: [to],
    subject,
    text,
  });

  if (error) {
    console.error("Resend guest email failed", error);
  }
}

async function sendCallMeBot(text: string): Promise<void> {
  const apikey = process.env.CALLMEBOT_API_KEY?.trim();
  const phone = process.env.CALLMEBOT_PHONE?.trim();
  if (!apikey || !phone) {
    return;
  }

  const url = new URL("https://api.callmebot.com/whatsapp.php");
  url.searchParams.set("phone", phone);
  url.searchParams.set("text", text);
  url.searchParams.set("apikey", apikey);
  url.searchParams.set("source", "pelbu-os");

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("CallMeBot failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("CallMeBot request error", err);
  }
}

export async function notifyNewBooking(
  payload: BookingNotifyPayload,
): Promise<void> {
  const shortId = payload.bookingId.slice(0, 8);
  const lines = [
    `New booking request (${shortId})`,
    `Guest: ${payload.contactName}`,
    `Phone: ${payload.contactPhone}`,
    payload.contactEmail ? `Email: ${payload.contactEmail}` : null,
    `Stay: ${payload.checkIn} → ${payload.checkOut}`,
    `Adults: ${payload.adults} · Rooms: ${payload.rooms}`,
    payload.guideNumber ? `Guide #: ${payload.guideNumber}` : null,
    payload.notes ? `Notes: ${payload.notes}` : null,
    `Ref: ${payload.bookingId}`,
    siteUrl(),
  ].filter(Boolean) as string[];

  const text = lines.join("\n");

  await Promise.allSettled([
    sendCallMeBot(text),
    sendDeskEmail(`[Pelbu] New booking · ${payload.contactName}`, text),
    payload.contactEmail
      ? sendGuestEmail(
          payload.contactEmail,
          "Pelbu Suites — we received your booking request",
          [
            `Kuzuzangpo ${payload.contactName},`,
            "",
            "We received your stay request at Pelbu Suites, Olakha.",
            `Dates: ${payload.checkIn} → ${payload.checkOut}`,
            `Reference: ${payload.bookingId}`,
            "",
            "Our desk will confirm availability shortly.",
            "",
            "Pelbu Suites",
          ].join("\n"),
        )
      : Promise.resolve(),
  ]);
}

export async function notifyNewOrder(payload: OrderNotifyPayload): Promise<void> {
  const shortId = payload.orderId.slice(0, 8);
  const delivery =
    payload.deliveryType === "taxi"
      ? `Taxi · ${payload.deliveryAddress ?? "address TBD"}`
      : "Pickup at cafe";

  const lines = [
    `New ${payload.outlet} order (${shortId})`,
    `Guest: ${payload.customerName}`,
    `Phone: ${payload.phone}`,
    `Delivery: ${delivery}`,
    `Items: ${payload.itemSummary}`,
    `Total: Nu ${payload.totalBtn.toFixed(2)} (incl. GST where applicable)`,
    payload.notes ? `Notes: ${payload.notes}` : null,
    `Ref: ${payload.orderId}`,
    siteUrl(),
  ].filter(Boolean) as string[];

  const text = lines.join("\n");

  await Promise.allSettled([
    sendCallMeBot(text),
    sendDeskEmail(
      `[Pelbu] New order · Nu ${payload.totalBtn.toFixed(0)} · ${payload.customerName}`,
      text,
    ),
  ]);
}

export type AgentApplyNotifyPayload = {
  agentId: string;
  companyName: string;
  market: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  licenseUrl: string | null;
  wantsMou: boolean;
  notes: string | null;
};

export async function notifyNewAgentApplication(
  payload: AgentApplyNotifyPayload,
): Promise<void> {
  const shortId = payload.agentId.slice(0, 8);
  const lines = [
    `New agent application (${shortId})`,
    `Company: ${payload.companyName}`,
    `Market: ${payload.market}`,
    `Contact: ${payload.contactName}`,
    `Phone: ${payload.contactPhone}`,
    payload.contactEmail ? `Email: ${payload.contactEmail}` : null,
    payload.licenseUrl ? `License: ${payload.licenseUrl}` : null,
    `MoU interest: ${payload.wantsMou ? "yes" : "no"}`,
    payload.notes ? `Notes: ${payload.notes}` : null,
    `Ref: ${payload.agentId}`,
    siteUrl(),
  ].filter(Boolean) as string[];

  const text = lines.join("\n");

  await Promise.allSettled([
    sendCallMeBot(text),
    sendDeskEmail(`[Pelbu] Agent apply · ${payload.companyName}`, text),
    payload.contactEmail
      ? sendGuestEmail(
          payload.contactEmail,
          "Pelbu Suites — agent application received",
          [
            `Kuzuzangpo ${payload.contactName},`,
            "",
            `We received the partner application for ${payload.companyName}.`,
            `Reference: ${payload.agentId}`,
            "",
            "Our team reviews license details before approving agent rates and credit.",
            "",
            "Pelbu Suites",
          ].join("\n"),
        )
      : Promise.resolve(),
  ]);
}

export type ServiceRequestNotifyPayload = {
  requestId: string;
  kind: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  preferredOn: string;
  preferredTime: string | null;
  partySize: number;
  durationHours: number | null;
  packageName: string | null;
  chargeToRoom: boolean;
  roomOrBookingRef: string | null;
  notes: string | null;
};

export async function notifyNewServiceRequest(
  payload: ServiceRequestNotifyPayload,
): Promise<void> {
  const shortId = payload.requestId.slice(0, 8);
  const label =
    payload.kind === "meeting"
      ? "Meeting hall"
      : payload.kind === "steam"
        ? "Steam"
        : "Spa";

  const lines = [
    `New ${label.toLowerCase()} request (${shortId})`,
    `Guest: ${payload.contactName}`,
    `Phone: ${payload.contactPhone}`,
    payload.contactEmail ? `Email: ${payload.contactEmail}` : null,
    `When: ${payload.preferredOn}${payload.preferredTime ? ` · ${payload.preferredTime}` : ""}`,
    `Party: ${payload.partySize}`,
    payload.durationHours != null ? `Duration: ${payload.durationHours}h` : null,
    payload.packageName ? `Package: ${payload.packageName}` : null,
    payload.chargeToRoom
      ? `Charge to room/folio: ${payload.roomOrBookingRef ?? "yes"}`
      : null,
    payload.notes ? `Notes: ${payload.notes}` : null,
    `Ref: ${payload.requestId}`,
    siteUrl(),
  ].filter(Boolean) as string[];

  const text = lines.join("\n");

  await Promise.allSettled([
    sendCallMeBot(text),
    sendDeskEmail(`[Pelbu] ${label} request · ${payload.contactName}`, text),
    payload.contactEmail
      ? sendGuestEmail(
          payload.contactEmail,
          `Pelbu Suites — ${label.toLowerCase()} request received`,
          [
            `Kuzuzangpo ${payload.contactName},`,
            "",
            `We received your ${label.toLowerCase()} request.`,
            `Preferred: ${payload.preferredOn}${payload.preferredTime ? ` · ${payload.preferredTime}` : ""}`,
            `Reference: ${payload.requestId}`,
            "",
            "Our desk will confirm the slot shortly.",
            "",
            "Pelbu Suites",
          ].join("\n"),
        )
      : Promise.resolve(),
  ]);
}

