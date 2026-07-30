import {
  CheckInForm,
  CheckOutForm,
  type CheckInBooking,
  type PartnerOption,
} from "@/components/erp/CheckInForm";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deskPinConfigured, isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { roundBtn } from "@/lib/pricing";
import {
  agentRateTier,
  lookupRoomRateBtn,
  nightsBetween,
  resolveSeasonKind,
} from "@/lib/rates";
import { loadCheckInRoomOptions } from "@/lib/room-assignments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Check-in | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string; id?: string; booking?: string }>;
};

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export default async function CheckInPage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  // Accept legacy ?booking= deep links from older boards.
  const id = (sp.id ?? sp.booking ?? "").trim() || undefined;
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const loaded = id ? await loadBooking(admin, propertyId, id) : null;
  const selected = loaded?.booking ?? null;
  const loadError = loaded?.error ?? null;
  const arrivals = await loadArrivals(admin, propertyId, query);

  let guideOptions: PartnerOption[] = [];
  let driverOptions: PartnerOption[] = [];
  let roomSlots: Awaited<ReturnType<typeof loadCheckInRoomOptions>>["slots"] =
    [];
  let roomUnits: Awaited<ReturnType<typeof loadCheckInRoomOptions>>["units"] =
    [];
  let checkoutRooms: string[] = [];
  let folioBalance = 0;

  if (selected && ["pending", "confirmed"].includes(selected.status)) {
    const [{ data: guideRows }, { data: driverRows }, roomOpts] =
      await Promise.all([
        admin
          .from("guides")
          .select("id, guide_number, full_name, phone, visit_count, last_seen_at")
          .eq("property_id", propertyId)
          .order("visit_count", { ascending: false })
          .limit(50),
        admin
          .from("drivers")
          .select(
            "id, full_name, phone, vehicle_no, license_no, visit_count, last_seen_at",
          )
          .eq("property_id", propertyId)
          .order("visit_count", { ascending: false })
          .limit(50),
        loadCheckInRoomOptions(admin, {
          propertyId,
          bookingId: selected.id,
          checkIn: selected.check_in,
          checkOut: selected.check_out,
          lines: selected.booking_rooms.map((r) => ({
            room_type_id: r.room_type_id,
            qty: r.qty,
            inventory_kind: r.inventory_kind,
            room_types: r.room_types,
          })),
        }),
      ]);
    guideOptions = (guideRows ?? []).map((g) => ({
      id: g.id as string,
      label: g.full_name
        ? `${g.full_name} (#${g.guide_number})`
        : `#${g.guide_number}`,
      sublabel: g.phone ?? undefined,
      fill: { guide_number: g.guide_number as string },
    }));
    driverOptions = (driverRows ?? []).map((d) => ({
      id: d.id as string,
      label: d.full_name ?? d.phone ?? "Unknown driver",
      sublabel:
        [d.phone, d.vehicle_no].filter(Boolean).join(" · ") || undefined,
      fill: {
        driver_name: (d.full_name as string | null) ?? "",
        driver_phone: (d.phone as string | null) ?? "",
        vehicle_no: (d.vehicle_no as string | null) ?? "",
        license_no: (d.license_no as string | null) ?? "",
      },
    }));
    roomSlots = roomOpts.slots;
    roomUnits = roomOpts.units;
  }

  if (selected?.status === "checked_in") {
    const [{ data: assigns }, { data: folio }] = await Promise.all([
      admin
        .from("room_assignments")
        .select("room_units(label)")
        .eq("booking_id", selected.id),
      admin
        .from("folios")
        .select("id, folio_lines(total_btn, status)")
        .eq("booking_id", selected.id)
        .eq("status", "open")
        .order("created_at")
        .limit(1)
        .maybeSingle(),
    ]);
    checkoutRooms = (assigns ?? [])
      .map((row) => {
        const unit = Array.isArray(row.room_units)
          ? row.room_units[0]
          : row.room_units;
        return (unit as { label?: string } | null)?.label ?? null;
      })
      .filter((label): label is string => Boolean(label));
    folioBalance = (
      (folio?.folio_lines as { total_btn: number; status: string }[] | null) ??
      []
    )
      .filter((l) => l.status === "posted")
      .reduce((sum, l) => sum + Number(l.total_btn), 0);
  }

  return (
    <div className="erp mx-auto grid w-full max-w-[1100px] gap-6 p-4 md:grid-cols-[320px_minmax(0,1fr)] md:p-6">
      {!deskPinConfigured() ? (
        <Alert variant="warning" className="md:col-span-2">
          <AlertTitle>Dev mode: desk PIN not set.</AlertTitle>
        </Alert>
      ) : null}

      <aside className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            Check-in
          </p>
          <FrontDeskLiveRefresh />
        </div>
        <Card className="gap-3 p-4">
          <form className="space-y-3">
            <label className="block text-sm text-foreground">
              Find booking
              <Input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Phone, guide #, or name"
                className="mt-1.5"
              />
            </label>
            <Button type="submit" className="w-full">
              Search
            </Button>
          </form>
          <Button asChild variant="outline" className="w-full">
            <Link href="/erp/arrivals">Today&apos;s arrivals</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/erp/calendar">Open room rack</Link>
          </Button>
        </Card>

        <Card className="gap-0 overflow-hidden py-0">
          <h2 className="border-b px-4 py-3 text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            Arrivals / in-house
          </h2>
          <ul className="divide-y">
            {arrivals.length === 0 ? (
              <li className="px-4 py-4 text-sm text-muted-foreground">
                No matches.
              </li>
            ) : (
              arrivals.map((row) => (
                <li key={row.id as string}>
                  <Link
                    href={`/erp/check-in?id=${row.id as string}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                    className="block px-4 py-3 text-sm hover:bg-muted/50"
                  >
                    <p className="font-medium text-foreground">
                      {(row.contact_name as string) ?? "Guest"} ·{" "}
                      {(row.contact_phone as string) ?? "—"}
                    </p>
                    <p className="text-muted-foreground">
                      {row.check_in as string} → {row.check_out as string} ·{" "}
                      <span className="uppercase tracking-wide">
                        {row.status as string}
                      </span>
                      {row.room_labels ? ` · ${row.room_labels}` : ""}
                    </p>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </Card>
      </aside>

      <div className="space-y-6">
        {loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load this booking.</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : !selected ? (
          <p className="text-sm text-muted-foreground">
            {id
              ? "That booking is not at this property, or it no longer exists."
              : "Select a booking to check in or check out. Assign physical rooms — including guide and driver beds — before confirming."}
          </p>
        ) : selected.status === "checked_in" ? (
          <div className="space-y-4">
            <Card className="gap-0 p-6 text-sm">
              <p className="text-xs tracking-[0.2em] text-accent uppercase">
                In-house
              </p>
              <p className="mt-2 font-medium text-foreground">
                {selected.contact_name ?? "Guest"}
              </p>
              <p className="text-muted-foreground">
                Guide {selected.guide_number ?? "—"} ·{" "}
                {selected.payment_mode ?? "—"}
                {checkoutRooms.length
                  ? ` · ${checkoutRooms.join(", ")}`
                  : ""}
              </p>
              {selected.open_folio_id ? (
                <Link
                  href={`/erp/folios/${selected.open_folio_id}`}
                  className="mt-3 inline-flex min-h-10 items-center text-sm text-accent underline-offset-4 hover:underline"
                >
                  Open folio
                </Link>
              ) : null}
            </Card>
            <CheckOutForm
              bookingId={selected.id}
              rooms={checkoutRooms}
              folioBalance={folioBalance}
            />
          </div>
        ) : ["pending", "confirmed"].includes(selected.status) ? (
          <CheckInForm
            booking={selected}
            guides={guideOptions}
            drivers={driverOptions}
            slots={roomSlots}
            units={roomUnits}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Booking status is {selected.status}. No check-in action.
          </p>
        )}
      </div>
    </div>
  );
}

async function loadArrivals(admin: Admin, propertyId: string, query: string) {
  let q = admin
    .from("bookings")
    .select(
      "id, contact_name, contact_phone, check_in, check_out, status, room_assignments(room_units(label))",
    )
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
  return (data ?? []).map((row) => {
    const assigns =
      (row.room_assignments as
        | Array<{ room_units: { label?: string } | { label?: string }[] | null }>
        | null) ?? [];
    const labels = assigns
      .map((a) => {
        const unit = Array.isArray(a.room_units) ? a.room_units[0] : a.room_units;
        return unit?.label;
      })
      .filter(Boolean);
    return {
      ...row,
      room_labels: labels.length ? labels.join(", ") : null,
    };
  });
}

type LoadedBooking = CheckInBooking & { open_folio_id: string | null };

/**
 * `error` is returned rather than swallowed. A bad column or embed makes
 * PostgREST fail the whole select, and discarding that left the desk staring
 * at the "select a booking" placeholder with no clue the query had failed.
 */
async function loadBooking(
  admin: Admin,
  propertyId: string,
  bookingId: string,
): Promise<{ booking: LoadedBooking | null; error: string | null }> {
  const { data, error } = await admin
    .from("bookings")
    .select(
      `id, contact_name, contact_phone, check_in, check_out, status, guest_origin, guide_number, guide_id, driver_id, payment_mode, adults, rooms, agent_id,
       agents(company_name, credit_limit),
       booking_rooms(qty, inventory_kind, room_type_id, room_types(name, code)),
       booking_guests(full_name, nationality, passport_or_cid, sdf_ref, sdf_doc_url, sort_order),
       booking_drivers(full_name, phone, vehicle_no, license_no),
       folios(id, status)`,
    )
    .eq("id", bookingId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) return { booking: null, error: error.message };
  if (!data) return { booking: null, error: null };

  const openFolio = (
    (data.folios as { id: string; status: string }[] | null) ?? []
  ).find((f) => f.status === "open");

  const agentRaw = data.agents as
    | { company_name?: string; credit_limit?: number }
    | { company_name?: string; credit_limit?: number }[]
    | null;
  const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;

  let creditAvailable: number | null = null;
  let stayEstimate: number | null = null;
  const agentId = (data.agent_id as string | null) ?? null;
  if (agentId) {
    const { data: ledger } = await admin
      .from("agent_credit_ledger")
      .select("amount_btn, entry_type")
      .eq("agent_id", agentId);
    const balance = (ledger ?? []).reduce((sum, row) => {
      const amt = Number(row.amount_btn ?? 0);
      return row.entry_type === "charge" ? sum + amt : sum - amt;
    }, 0);
    const limit = Number(agent?.credit_limit ?? 0);
    creditAvailable = roundBtn(Math.max(0, limit - balance));

    const rooms =
      (data.booking_rooms as
        | { qty: number; inventory_kind: string; room_type_id: string }[]
        | null) ?? [];
    const nights = nightsBetween(
      data.check_in as string,
      data.check_out as string,
    );
    const season = await resolveSeasonKind(
      admin,
      propertyId,
      data.check_in as string,
    );
    const { data: agentRow } = await admin
      .from("agents")
      .select("rate_tier")
      .eq("id", agentId)
      .maybeSingle();
    const tier = agentRateTier(agentRow?.rate_tier as string | undefined);
    let estimate = 0;
    for (const line of rooms) {
      if (line.inventory_kind !== "sellable_guest") continue;
      const rate = await lookupRoomRateBtn(admin, {
        propertyId,
        roomTypeId: line.room_type_id,
        seasonKind: season,
        rateTier: tier,
      });
      if (rate != null) estimate += rate * Number(line.qty) * nights;
    }
    stayEstimate = roundBtn(estimate);
  }

  const guests = (
    (data.booking_guests as CheckInBooking["booking_guests"] | null) ?? []
  ).slice();
  guests.sort((a, b) => {
    const ao = (a as { sort_order?: number }).sort_order ?? 0;
    const bo = (b as { sort_order?: number }).sort_order ?? 0;
    return ao - bo;
  });

  const booking: LoadedBooking = {
    id: data.id as string,
    contact_name: (data.contact_name as string | null) ?? null,
    contact_phone: (data.contact_phone as string | null) ?? null,
    check_in: data.check_in as string,
    check_out: data.check_out as string,
    status: data.status as string,
    guest_origin: (data.guest_origin as string | null) ?? null,
    guide_number: (data.guide_number as string | null) ?? null,
    guide_id: (data.guide_id as string | null) ?? null,
    driver_id: (data.driver_id as string | null) ?? null,
    payment_mode: (data.payment_mode as string | null) ?? null,
    adults: Number(data.adults ?? 1),
    rooms: Number(data.rooms ?? 1),
    agent_id: agentId,
    agent_name: agent?.company_name ?? null,
    credit_available_btn: creditAvailable,
    stay_estimate_btn: stayEstimate,
    booking_rooms: (
      (data.booking_rooms as
        | {
            qty: number;
            inventory_kind: string;
            room_type_id: string;
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
        room_type_id: r.room_type_id,
        room_types: roomType,
      };
    }),
    booking_guests: guests,
    booking_drivers:
      (data.booking_drivers as CheckInBooking["booking_drivers"] | null) ?? [],
    open_folio_id: openFolio?.id ?? null,
  };

  return { booking, error: null };
}
