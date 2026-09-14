import { DeskListShell, DeskSearchForm } from "@/components/erp/DeskListShell";
import { GuestsTable, type GuestStay } from "@/components/erp/GuestsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { matchesQuery } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Guests | Hotel OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const PAGE_SIZE = 75;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function ilikePattern(q: string): string {
  return `%${q.replace(/[%_\\]/g, "")}%`;
}

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    origin?: string;
    status?: string;
    flagged?: string;
    from?: string;
    to?: string;
  }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const origin = (sp.origin ?? "").trim();
  const status = (sp.status ?? "").trim();
  const flagged = (sp.flagged ?? "").trim(); // dnr | incomplete
  const from = sp.from && ISO.test(sp.from) ? sp.from : "";
  const to = sp.to && ISO.test(sp.to) ? sp.to : "";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const advanced =
    Boolean(query || origin || status || flagged || from || to);

  let bookingsQ = admin
    .from("bookings")
    .select(
      `id, contact_name, contact_phone, check_in, check_out, status, guest_origin,
       booking_guests(id, full_name, nationality, passport_or_cid, sdf_ref, sdf_doc_url, blacklisted, blacklist_reason)`,
      { count: advanced ? undefined : "exact" },
    )
    .eq("property_id", propertyId)
    .order("check_in", { ascending: false });

  if (status) bookingsQ = bookingsQ.eq("status", status);
  if (origin) bookingsQ = bookingsQ.eq("guest_origin", origin);
  if (from) bookingsQ = bookingsQ.gte("check_in", from);
  if (to) bookingsQ = bookingsQ.lte("check_in", to);

  if (query) {
    bookingsQ = bookingsQ
      .or(
        `contact_name.ilike.${ilikePattern(query)},contact_phone.ilike.${ilikePattern(query)}`,
      )
      .limit(400);
  } else if (advanced) {
    bookingsQ = bookingsQ.limit(400);
  } else {
    const rangeFrom = (page - 1) * PAGE_SIZE;
    bookingsQ = bookingsQ.range(rangeFrom, rangeFrom + PAGE_SIZE - 1);
  }

  const { data: bookings, count: bookingCount } = await bookingsQ;

  const stays: GuestStay[] = [];
  for (const b of bookings ?? []) {
    const guests =
      (b.booking_guests as {
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

  let filtered = query
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

  if (flagged === "dnr") {
    filtered = filtered.filter((s) => s.blacklisted);
  } else if (flagged === "incomplete") {
    filtered = filtered.filter(
      (s) =>
        !String(s.passport_or_cid ?? "").trim() ||
        !String(s.nationality ?? "").trim() ||
        !String(s.sdf_ref ?? "").trim(),
    );
  }

  const stayCount = new Map<string, number>();
  for (const s of filtered) {
    const key = (s.passport_or_cid || s.full_name).toLowerCase();
    stayCount.set(key, (stayCount.get(key) ?? 0) + 1);
  }
  for (const s of filtered) {
    const key = (s.passport_or_cid || s.full_name).toLowerCase();
    s.stay_count = stayCount.get(key) ?? 1;
  }

  const totalPages =
    advanced
      ? 1
      : Math.max(1, Math.ceil((bookingCount ?? filtered.length) / PAGE_SIZE));

  return (
    <DeskListShell
      eyebrow="Directory"
      heading="Guest list"
      blurb="Booking guests and contacts. Filter by origin, status, arrival window, DNR, or incomplete docs. Export immigration sheets for in-house and arrivals."
      filters={
        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
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
          <form
            action="/erp/guests"
            method="get"
            className="flex flex-wrap items-end gap-2 rounded-md border border-border/60 bg-muted/20 p-2"
          >
            {query ? <input type="hidden" name="q" value={query} /> : null}
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground">Origin</Label>
              <select
                name="origin"
                defaultValue={origin}
                className="h-9 min-w-[8rem] rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All</option>
                <option value="local">Local</option>
                <option value="regional">Regional</option>
                <option value="international">International</option>
                <option value="official">Official</option>
              </select>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground">Status</Label>
              <select
                name="status"
                defaultValue={status}
                className="h-9 min-w-[8rem] rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked_in">In-house</option>
                <option value="checked_out">Checked out</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No-show</option>
              </select>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground">Flag</Label>
              <select
                name="flagged"
                defaultValue={flagged}
                className="h-9 min-w-[8rem] rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Any</option>
                <option value="dnr">DNR / blacklist</option>
                <option value="incomplete">Doc incomplete</option>
              </select>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground">
                Arrival from
              </Label>
              <Input
                type="date"
                name="from"
                defaultValue={from}
                className="h-9 w-[10.5rem]"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground">
                Arrival to
              </Label>
              <Input
                type="date"
                name="to"
                defaultValue={to}
                className="h-9 w-[10.5rem]"
              />
            </div>
            <Button type="submit" size="sm" className="h-9">
              Filter
            </Button>
            {advanced ? (
              <Button asChild variant="ghost" size="sm" className="h-9">
                <Link href="/erp/guests">Clear</Link>
              </Button>
            ) : null}
          </form>
        </div>
      }
    >
      <p className="text-xs text-muted-foreground">
        {filtered.length} shown
        {!advanced && totalPages > 1
          ? ` · page ${page} of ${totalPages}`
          : null}
      </p>
      <GuestsTable data={filtered} />
      {!advanced && totalPages > 1 ? (
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
