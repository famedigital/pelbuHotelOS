import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { bookingConfirmationLabel } from "@/lib/booking-ref";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type EntityHit = {
  kind: "guest" | "room" | "booking" | "invoice" | "agent";
  id: string;
  label: string;
  href: string;
  meta?: string;
};

function ilikePattern(q: string): string {
  return `%${q.replace(/[%_\\]/g, "")}%`;
}

function sanitizeOrToken(q: string): string {
  // PostgREST .or filter values — strip commas that break filter parsing
  return q.replace(/[%_,.\\]/g, " ").trim();
}

/** Debounced entity lookup for Ctrl+K — guests, rooms, bookings, folios, invoices, agents. */
export async function GET(request: Request) {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] satisfies EntityHit[] });
  }

  const propertyId = await requireDeskPropertyId();
  const admin = createSupabaseAdminClient();
  const pattern = ilikePattern(q);
  const safe = sanitizeOrToken(q);
  const safePattern = ilikePattern(safe);
  const results: EntityHit[] = [];

  const guestOr = `full_name.ilike.${safePattern},passport_or_cid.ilike.${safePattern}`;

  const bookingParts = [
    `contact_name.ilike.${safePattern}`,
    `contact_phone.ilike.${safePattern}`,
    `confirmation_code.ilike.${safePattern}`,
  ];
  if (/^[0-9a-f-]{36}$/i.test(q)) {
    bookingParts.push(`id.eq.${q}`);
  }
  // Also match bare numbers against sequence tail (00042)
  if (/^\d{3,6}$/.test(q)) {
    bookingParts.push(`confirmation_code.ilike.%${q}%`);
  }
  const bookingOr = bookingParts.join(",");

  const [
    { data: guests },
    { data: rooms },
    { data: bookings },
    { data: invoices },
    { data: agents },
    { data: agentBookings },
    { data: folios },
  ] = await Promise.all([
    admin
      .from("booking_guests")
      .select(
        "id, full_name, passport_or_cid, bookings!inner(id, property_id, contact_phone, confirmation_code)",
      )
      .eq("bookings.property_id", propertyId)
      .or(guestOr)
      .limit(5),
    admin
      .from("room_units")
      .select("id, label, floor_label")
      .eq("property_id", propertyId)
      .ilike("label", pattern)
      .order("label")
      .limit(5),
    admin
      .from("bookings")
      .select(
        "id, confirmation_code, contact_name, contact_phone, check_in, check_out, status, agents(company_name)",
      )
      .eq("property_id", propertyId)
      .or(bookingOr)
      .order("check_in", { ascending: false })
      .limit(8),
    admin
      .from("fiscal_documents")
      .select("id, doc_no, folio_id, contact_name")
      .eq("property_id", propertyId)
      .eq("doc_kind", "invoice")
      .or(`doc_no.ilike.${safePattern},contact_name.ilike.${safePattern}`)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("agents")
      .select("id, company_name, status, contact_phone, market")
      .or(
        `company_name.ilike.${safePattern},contact_phone.ilike.${safePattern},contact_email.ilike.${safePattern},contact_name.ilike.${safePattern}`,
      )
      .order("company_name")
      .limit(5),
    // Bookings where agent company matches (postgREST filter via nested)
    admin
      .from("bookings")
      .select(
        "id, confirmation_code, contact_name, contact_phone, check_in, status, agents!inner(company_name)",
      )
      .eq("property_id", propertyId)
      .ilike("agents.company_name", pattern)
      .order("check_in", { ascending: false })
      .limit(5),
    admin
      .from("folios")
      .select(
        "id, label, status, booking_id, bookings(contact_name, confirmation_code)",
      )
      .eq("property_id", propertyId)
      .or(
        /^[0-9a-f-]{36}$/i.test(q)
          ? `id.eq.${q},label.ilike.${safePattern}`
          : `label.ilike.${safePattern}`,
      )
      .limit(5),
  ]);

  for (const g of guests ?? []) {
    const booking = (
      Array.isArray(g.bookings) ? g.bookings[0] : g.bookings
    ) as {
      id?: string;
      contact_phone?: string | null;
      confirmation_code?: string | null;
    } | null;
    if (!booking?.id) continue;
    results.push({
      kind: "guest",
      id: g.id as string,
      label: (g.full_name as string) || "Guest",
      href: `/erp/guests/${g.id as string}`,
      meta:
        bookingConfirmationLabel({
          confirmationCode: booking.confirmation_code,
          bookingId: booking.id,
        }) +
        (booking.contact_phone ? ` · ${booking.contact_phone}` : ""),
    });
  }

  for (const r of rooms ?? []) {
    results.push({
      kind: "room",
      id: r.id as string,
      label: `Room ${r.label as string}`,
      href: `/erp/calendar?room=${encodeURIComponent(r.label as string)}`,
      meta: (r.floor_label as string | null) ?? undefined,
    });
  }

  const seenBooking = new Set<string>();
  function pushBooking(b: {
    id: string;
    confirmation_code?: string | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    check_in?: string | null;
    status?: string | null;
    agents?:
      | { company_name?: string | null }
      | { company_name?: string | null }[]
      | null;
  }) {
    if (seenBooking.has(b.id)) return;
    seenBooking.add(b.id);
    const agentRaw = b.agents;
    const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;
    const conf = bookingConfirmationLabel({
      confirmationCode: b.confirmation_code,
      bookingId: b.id,
    });
    results.push({
      kind: "booking",
      id: b.id,
      label: `${conf} · ${(b.contact_name as string) || "Booking"}`,
      href: `/erp/reservations?booking=${b.id}`,
      meta: [
        b.check_in as string | undefined,
        (b.status as string | undefined)?.replace(/_/g, " "),
        agent?.company_name ?? undefined,
        b.contact_phone ?? undefined,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  for (const b of bookings ?? []) {
    pushBooking(b as Parameters<typeof pushBooking>[0]);
  }
  for (const b of agentBookings ?? []) {
    pushBooking(b as Parameters<typeof pushBooking>[0]);
  }

  for (const f of folios ?? []) {
    const booking = (
      Array.isArray(f.bookings) ? f.bookings[0] : f.bookings
    ) as {
      contact_name?: string | null;
      confirmation_code?: string | null;
    } | null;
    const conf =
      booking?.confirmation_code != null || f.booking_id
        ? bookingConfirmationLabel({
            confirmationCode: booking?.confirmation_code,
            bookingId: f.booking_id as string | undefined,
          })
        : null;
    results.push({
      kind: "invoice",
      id: f.id as string,
      label: `Folio ${(f.label as string) || (f.id as string).slice(0, 8)}`,
      href: `/erp/folios/${f.id as string}`,
      meta: [conf, booking?.contact_name, f.status as string | undefined]
        .filter(Boolean)
        .join(" · "),
    });
  }

  for (const inv of invoices ?? []) {
    results.push({
      kind: "invoice",
      id: inv.id as string,
      label: `Invoice ${inv.doc_no as string}`,
      href: inv.folio_id
        ? `/erp/folios/${inv.folio_id as string}`
        : `/erp/invoices/${inv.id as string}/print`,
      meta: (inv.contact_name as string | null) ?? undefined,
    });
  }

  for (const a of agents ?? []) {
    results.push({
      kind: "agent",
      id: a.id as string,
      label: (a.company_name as string) || "Agent",
      href: `/erp/agents?q=${encodeURIComponent((a.company_name as string) || "")}`,
      meta: [(a.market as string | null), (a.status as string | null)]
        .filter(Boolean)
        .join(" · "),
    });
  }

  return NextResponse.json({ results: results.slice(0, 24) });
}
