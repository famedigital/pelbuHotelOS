import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type EntityHit = {
  kind: "guest" | "room" | "booking" | "invoice";
  id: string;
  label: string;
  href: string;
  meta?: string;
};

function ilikePattern(q: string): string {
  return `%${q.replace(/[%_\\]/g, "")}%`;
}

/** Debounced entity lookup for Ctrl+K — guests, rooms, bookings, invoices. */
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
  const results: EntityHit[] = [];

  const guestOr = `full_name.ilike.${pattern},passport_or_cid.ilike.${pattern}`;
  const bookingOr = /^[0-9a-f-]{36}$/i.test(q)
    ? `contact_name.ilike.${pattern},contact_phone.ilike.${pattern},id.eq.${q}`
    : `contact_name.ilike.${pattern},contact_phone.ilike.${pattern}`;

  const [
    { data: guests },
    { data: rooms },
    { data: bookings },
    { data: invoices },
  ] = await Promise.all([
    admin
      .from("booking_guests")
      .select(
        "id, full_name, passport_or_cid, bookings!inner(id, property_id, contact_phone)",
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
      .select("id, contact_name, contact_phone, check_in, check_out, status")
      .eq("property_id", propertyId)
      .or(bookingOr)
      .order("check_in", { ascending: false })
      .limit(5),
    admin
      .from("fiscal_documents")
      .select("id, doc_no, folio_id, contact_name")
      .eq("property_id", propertyId)
      .eq("doc_kind", "invoice")
      .or(`doc_no.ilike.${pattern},contact_name.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  for (const g of guests ?? []) {
    const booking = (
      Array.isArray(g.bookings) ? g.bookings[0] : g.bookings
    ) as { id?: string; contact_phone?: string | null } | null;
    if (!booking?.id) continue;
    results.push({
      kind: "guest",
      id: g.id as string,
      label: (g.full_name as string) || "Guest",
      href: `/erp/guests/${g.id as string}`,
      meta:
        (g.passport_or_cid as string | null) ??
        booking.contact_phone ??
        undefined,
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

  for (const b of bookings ?? []) {
    results.push({
      kind: "booking",
      id: b.id as string,
      label: (b.contact_name as string) || "Booking",
      href: `/erp/reservations?booking=${b.id as string}`,
      meta: `${b.check_in as string} · ${(b.status as string).replace(/_/g, " ")}`,
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

  return NextResponse.json({ results: results.slice(0, 20) });
}
