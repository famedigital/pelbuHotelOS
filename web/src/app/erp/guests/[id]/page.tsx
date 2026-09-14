import { DeskListShell } from "@/components/erp/DeskListShell";
import { ErpDetailBack } from "@/components/erp/ErpDetailBack";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Guest profile | Hotel OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function GuestProfilePage({ params }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const { data: guest } = await admin
    .from("booking_guests")
    .select(
      `id, full_name, nationality, passport_or_cid, sdf_ref, sdf_doc_url,
       blacklisted, blacklist_reason, booking_id,
       bookings!inner(
         id, contact_name, contact_phone, contact_email, check_in, check_out, status,
         guest_origin, property_id, quoted_total_btn,
         room_assignments(room_units(label)),
         folios(id, status, folio_lines(total_btn, status))
       )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!guest) notFound();
  const booking = (
    Array.isArray(guest.bookings) ? guest.bookings[0] : guest.bookings
  ) as {
    id: string;
    contact_name?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
    check_in: string;
    check_out: string;
    status: string;
    guest_origin?: string | null;
    property_id: string;
    quoted_total_btn?: number | null;
    room_assignments?: {
      room_units?: { label?: string } | { label?: string }[];
    }[];
    folios?: {
      id: string;
      status: string;
      folio_lines?: { total_btn: number; status: string }[];
    }[];
  } | null;

  if (!booking || booking.property_id !== propertyId) notFound();

  const passport = (guest.passport_or_cid as string | null)?.trim() || null;
  const nameKey = String(guest.full_name ?? "").trim().toLowerCase();

  let historyQuery = admin
    .from("booking_guests")
    .select(
      `id, full_name, passport_or_cid, booking_id,
       bookings!inner(id, check_in, check_out, status, property_id, contact_name)`,
    )
    .eq("bookings.property_id", propertyId)
    .limit(40);

  if (passport) {
    historyQuery = historyQuery.eq("passport_or_cid", passport);
  } else if (nameKey) {
    historyQuery = historyQuery.ilike("full_name", guest.full_name as string);
  }

  const { data: historyRows } = await historyQuery;

  const stays = (historyRows ?? [])
    .map((row) => {
      const b = (
        Array.isArray(row.bookings) ? row.bookings[0] : row.bookings
      ) as {
        id: string;
        check_in: string;
        check_out: string;
        status: string;
        contact_name?: string | null;
      } | null;
      if (!b) return null;
      return {
        guestId: row.id as string,
        bookingId: b.id,
        checkIn: b.check_in,
        checkOut: b.check_out,
        status: b.status,
        name: (row.full_name as string) || b.contact_name || "Guest",
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b!.checkIn > a!.checkIn ? 1 : -1)) as {
    guestId: string;
    bookingId: string;
    checkIn: string;
    checkOut: string;
    status: string;
    name: string;
  }[];

  const rooms =
    (booking.room_assignments ?? [])
      .map((a) => {
        const u = Array.isArray(a.room_units) ? a.room_units[0] : a.room_units;
        return u?.label;
      })
      .filter(Boolean)
      .join(", ") || "—";

  const openFolio = (booking.folios ?? []).find((f) => f.status === "open");
  const balance = (openFolio?.folio_lines ?? [])
    .filter((l) => l.status === "posted")
    .reduce((s, l) => s + Number(l.total_btn), 0);

  const passportIncomplete =
    !passport || !String(guest.sdf_ref ?? "").trim();

  return (
    <DeskListShell
      eyebrow="Directory"
      heading={(guest.full_name as string) || "Guest"}
      blurb="Stay history matched by passport/CID when present, otherwise by name on this property."
      filters={
        <div className="flex flex-wrap gap-2">
          <ErpDetailBack href="/erp/guests" label="Guest list" />
          <Link
            href={`/erp/reservations?booking=${booking.id}`}
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
          >
            Open stay
          </Link>
        </div>
      }
    >
      <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-2">
        <div className="space-y-2 text-sm">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
            Identity
          </p>
          <p>
            <span className="text-muted-foreground">Nationality · </span>
            {(guest.nationality as string) || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Origin · </span>
            {booking.guest_origin || "—"}
          </p>
          <p className="font-mono text-xs">
            Passport/CID {passport || "—"}
            {passportIncomplete ? (
              <span className="ml-2 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 uppercase">
                Incomplete
              </span>
            ) : null}
          </p>
          <p className="font-mono text-xs">
            SDF {(guest.sdf_ref as string) || "—"}
          </p>
          {guest.blacklisted ? (
            <p className="text-sm text-destructive">
              Blacklisted
              {guest.blacklist_reason
                ? ` · ${guest.blacklist_reason as string}`
                : ""}
            </p>
          ) : null}
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
            Current / latest stay
          </p>
          <p>
            {booking.check_in} → {booking.check_out} · {booking.status}
          </p>
          <p>Rooms {rooms}</p>
          <p>
            Phone {booking.contact_phone || "—"} · Email{" "}
            {booking.contact_email || "—"}
          </p>
          {openFolio ? (
            <p>
              Folio balance{" "}
              <span className="font-semibold tabular-nums">
                {formatBtn(balance)}
              </span>
              {" · "}
              <Link
                href={`/erp/folios/${openFolio.id}`}
                className="text-accent underline-offset-4 hover:underline"
              >
                Open folio
              </Link>
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Stay history</h2>
        {stays.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matched past stays.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {stays.map((s) => (
              <li
                key={`${s.guestId}-${s.bookingId}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {s.checkIn} → {s.checkOut}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {s.status.replace(/_/g, " ")}
                  </p>
                </div>
                <Link
                  href={`/erp/reservations?booking=${s.bookingId}`}
                  className="text-sm text-accent underline-offset-4 hover:underline"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DeskListShell>
  );
}
