import { DeskListShell, DeskSearchForm } from "@/components/erp/DeskListShell";
import { GuestsTable, type GuestStay } from "@/components/erp/GuestsTable";
import { Button } from "@/components/ui/button";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { matchesQuery } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Guests | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const PAGE_SIZE = 75;

function ilikePattern(q: string): string {
  return `%${q.replace(/[%_\\]/g, "")}%`;
}

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  let bookingsQ = admin
    .from("bookings")
    .select(
      `id, contact_name, contact_phone, check_in, check_out, status, guest_origin,
       booking_guests(id, full_name, nationality, passport_or_cid, sdf_ref, sdf_doc_url, blacklisted, blacklist_reason)`,
      { count: query ? undefined : "exact" },
    )
    .eq("property_id", propertyId)
    .order("check_in", { ascending: false });

  if (query) {
    bookingsQ = bookingsQ.or(
      `contact_name.ilike.${ilikePattern(query)},contact_phone.ilike.${ilikePattern(query)}`,
    ).limit(250);
  } else {
    const from = (page - 1) * PAGE_SIZE;
    bookingsQ = bookingsQ.range(from, from + PAGE_SIZE - 1);
  }

  const { data: bookings, count: bookingCount } = await bookingsQ;

  const stays: GuestStay[] = [];
  for (const b of bookings ?? []) {
    const guests = (b.booking_guests as {
      id: string;
      full_name: string | null;
      nationality: string | null;
      passport_or_cid: string | null;
      sdf_ref: string | null;
      sdf_doc_url: string | null;
      blacklisted?: boolean;
      blacklist_reason?: string | null;
    }[] | null) ?? [];
    if (guests.length === 0) {
      stays.push({
        guestId: `contact-${b.id}`,
        full_name: (b.contact_name as string) || "Guest",
        nationality: null,
        passport_or_cid: null,
        sdf_ref: null,
        sdf_doc_url: null,
        booking_id: b.id as string,
        contact_phone: (b.contact_phone as string | null) ?? null,
        check_in: b.check_in as string,
        check_out: b.check_out as string,
        status: b.status as string,
        guest_origin: (b.guest_origin as string | null) ?? null,
        stay_count: 1,
        blacklisted: false,
        blacklist_reason: null,
      });
      continue;
    }
    for (const g of guests) {
      stays.push({
        guestId: g.id,
        full_name: g.full_name || (b.contact_name as string) || "Guest",
        nationality: g.nationality,
        passport_or_cid: g.passport_or_cid,
        sdf_ref: g.sdf_ref,
        sdf_doc_url: g.sdf_doc_url,
        booking_id: b.id as string,
        contact_phone: (b.contact_phone as string | null) ?? null,
        check_in: b.check_in as string,
        check_out: b.check_out as string,
        status: b.status as string,
        guest_origin: (b.guest_origin as string | null) ?? null,
        stay_count: 1,
        blacklisted: Boolean(g.blacklisted),
        blacklist_reason: g.blacklist_reason ?? null,
      });
    }
  }

  const filtered = query
    ? stays.filter((s) =>
        matchesQuery(
          [
            s.full_name,
            s.nationality,
            s.passport_or_cid,
            s.sdf_ref,
            s.contact_phone,
            s.booking_id,
          ],
          query,
        ),
      )
    : stays;

  const stayCount = new Map<string, number>();
  for (const s of filtered) {
    const key = (s.passport_or_cid || s.full_name).toLowerCase();
    stayCount.set(key, (stayCount.get(key) ?? 0) + 1);
  }
  for (const s of filtered) {
    const key = (s.passport_or_cid || s.full_name).toLowerCase();
    s.stay_count = stayCount.get(key) ?? 1;
  }

  const totalPages = query
    ? 1
    : Math.max(1, Math.ceil((bookingCount ?? filtered.length) / PAGE_SIZE));

  return (
    <DeskListShell
      eyebrow="Directory"
      heading="Guest list"
      blurb="Derived from booking guests and contacts. Search by name, passport/CID, SDF, or phone. Incomplete passport/SDF flagged for immigration."
      filters={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <DeskSearchForm
            action="/erp/guests"
            q={sp.q}
            placeholder="Name, passport/CID, SDF, phone…"
          />
          <div className="flex flex-wrap gap-2">
            <Link
              href="/api/erp/export?kind=immigration&scope=in_house"
              className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
            >
              SDF export (in-house)
            </Link>
            <Link
              href="/api/erp/export?kind=immigration&scope=arrivals"
              className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
            >
              Arrivals export
            </Link>
          </div>
        </div>
      }
    >
      <p className="text-xs text-muted-foreground">
        {filtered.length} shown
        {!query && totalPages > 1
          ? ` · page ${page} of ${totalPages}`
          : null}
      </p>
      <GuestsTable data={filtered} />
      {!query && totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/erp/guests?page=${page - 1}`}>Previous</Link>
            </Button>
          ) : null}
          {page < totalPages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/erp/guests?page=${page + 1}`}>Next</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </DeskListShell>
  );
}
