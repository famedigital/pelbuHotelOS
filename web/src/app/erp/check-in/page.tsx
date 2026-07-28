import {
  CheckInForm,
  CheckOutForm,
  type CheckInBooking,
} from "@/components/erp/CheckInForm";
import { DeskHeader } from "@/components/erp/DeskHeader";
import { deskPinConfigured, isDeskAuthenticated } from "@/lib/desk-auth";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Check-in | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string; id?: string }>;
};

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export default async function CheckInPage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const { q, id } = await searchParams;
  const query = (q ?? "").trim();
  const admin = createSupabaseAdminClient();

  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();

  if (!property) {
    return (
      <div className="min-h-screen bg-ivory">
        <DeskHeader title="Check-in" />
        <main className="mx-auto max-w-[900px] px-6 py-10">
          <p className="text-sm text-maroon">Property not configured.</p>
        </main>
      </div>
    );
  }

  const selected = id
    ? await loadBooking(admin, property.id as string, id)
    : null;
  const arrivals = await loadArrivals(admin, property.id as string, query);

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title="Check-in" />
      <main className="mx-auto grid max-w-[1100px] gap-8 px-6 py-10 md:grid-cols-[320px_minmax(0,1fr)] md:px-8">
        {!deskPinConfigured() ? (
          <p className="border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-espresso md:col-span-2">
            Dev mode: desk PIN not set.
          </p>
        ) : null}

        <aside className="space-y-4">
          <form className="space-y-3 border border-espresso/10 bg-white px-4 py-4">
            <label className="block text-sm text-espresso">
              Find booking
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Phone, guide #, or name"
                className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <button
              type="submit"
              className="inline-flex min-h-10 w-full items-center justify-center rounded-sm bg-espresso px-4 text-sm font-medium text-ivory"
            >
              Search
            </button>
          </form>

          <section className="border border-espresso/10 bg-white">
            <h2 className="border-b border-espresso/10 px-4 py-3 text-xs font-semibold tracking-[0.22em] text-gold uppercase">
              Arrivals / in-house
            </h2>
            <ul className="divide-y divide-espresso/10">
              {arrivals.length === 0 ? (
                <li className="px-4 py-4 text-sm text-muted">No matches.</li>
              ) : (
                arrivals.map((row) => (
                  <li key={row.id as string}>
                    <Link
                      href={`/erp/check-in?id=${row.id as string}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                      className="block px-4 py-3 text-sm hover:bg-espresso/[0.02]"
                    >
                      <p className="font-medium text-espresso">
                        {(row.contact_name as string) ?? "Guest"} ·{" "}
                        {(row.contact_phone as string) ?? "—"}
                      </p>
                      <p className="text-muted">
                        {row.check_in as string} → {row.check_out as string} ·{" "}
                        <span className="uppercase tracking-wide">
                          {row.status as string}
                        </span>
                      </p>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </section>
        </aside>

        <div className="space-y-6">
          {!selected ? (
            <p className="text-sm text-muted">
              Select a booking to check in or check out.
            </p>
          ) : selected.status === "checked_in" ? (
            <div className="space-y-4">
              <div className="border border-espresso/10 bg-white px-6 py-6 text-sm">
                <p className="text-xs tracking-[0.22em] text-gold uppercase">In-house</p>
                <p className="mt-2 font-medium text-espresso">
                  {selected.contact_name ?? "Guest"}
                </p>
                <p className="text-muted">
                  Guide {selected.guide_number ?? "—"} · {selected.payment_mode ?? "—"}
                </p>
                {selected.open_folio_id ? (
                  <a
                    href={`/erp/folios/${selected.open_folio_id}`}
                    className="mt-3 inline-flex min-h-10 items-center text-sm text-maroon underline-offset-4 hover:underline"
                  >
                    Open folio
                  </a>
                ) : null}
              </div>
              <CheckOutForm bookingId={selected.id} />
            </div>
          ) : ["pending", "confirmed"].includes(selected.status) ? (
            <CheckInForm booking={selected} />
          ) : (
            <p className="text-sm text-muted">
              Booking status is {selected.status}. No check-in action.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

async function loadArrivals(admin: Admin, propertyId: string, query: string) {
  let q = admin
    .from("bookings")
    .select("id, contact_name, contact_phone, check_in, check_out, status")
    .eq("property_id", propertyId)
    .in("status", ["pending", "confirmed", "checked_in"])
    .order("check_in", { ascending: true })
    .limit(30);

  if (query) {
    const safe = query.replace(/[%(),]/g, "");
    q = q.or(
      `contact_phone.ilike.%${safe}%,contact_name.ilike.%${safe}%,guide_number.ilike.%${safe}%`,
    );
  }

  const { data } = await q;
  return data ?? [];
}

async function loadBooking(
  admin: Admin,
  propertyId: string,
  bookingId: string,
): Promise<(CheckInBooking & { open_folio_id: string | null }) | null> {
  const { data } = await admin
    .from("bookings")
    .select(
      `id, contact_name, contact_phone, check_in, check_out, status, guest_origin, guide_number, payment_mode, adults, rooms,
       booking_rooms(qty, inventory_kind, room_types(name, code)),
       booking_guests(full_name, nationality, passport_or_cid, sdf_ref, sdf_doc_url),
       booking_drivers(full_name, phone, vehicle_no, license_no),
       folios(id, status)`,
    )
    .eq("id", bookingId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (!data) return null;

  const openFolio = ((data.folios as { id: string; status: string }[] | null) ?? []).find(
    (f) => f.status === "open",
  );

  return {
    id: data.id as string,
    contact_name: (data.contact_name as string | null) ?? null,
    contact_phone: (data.contact_phone as string | null) ?? null,
    check_in: data.check_in as string,
    check_out: data.check_out as string,
    status: data.status as string,
    guest_origin: (data.guest_origin as string | null) ?? null,
    guide_number: (data.guide_number as string | null) ?? null,
    payment_mode: (data.payment_mode as string | null) ?? null,
    adults: Number(data.adults ?? 1),
    rooms: Number(data.rooms ?? 1),
    booking_rooms: (
      (data.booking_rooms as
        | {
            qty: number;
            inventory_kind: string;
            room_types:
              | { name: string; code: string }
              | { name: string; code: string }[]
              | null;
          }[]
        | null) ?? []
    ).map((r) => {
      const roomType = Array.isArray(r.room_types)
        ? (r.room_types[0] ?? null)
        : (r.room_types ?? null);
      return {
        qty: Number(r.qty),
        inventory_kind: r.inventory_kind,
        room_types: roomType,
      };
    }),
    booking_guests: (data.booking_guests as CheckInBooking["booking_guests"] | null) ?? [],
    booking_drivers: (data.booking_drivers as CheckInBooking["booking_drivers"] | null) ?? [],
    open_folio_id: openFolio?.id ?? null,
  };
}
