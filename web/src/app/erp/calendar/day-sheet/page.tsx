import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { PrintButton } from "@/components/erp/PrintButton";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId, thimphuToday } from "@/lib/erp-lists";
import { loadProperty } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Day sheet | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

type DayRow = {
  kind: "arrival" | "departure" | "stayover";
  room: string;
  inventoryKind: string;
  guest: string;
  occupants: string;
  phone: string;
  status: string;
  guide: string;
  driver: string;
  payment: string;
  source: string;
  agent: string;
  check_in: string;
  check_out: string;
  blockers: string[];
  bookingId: string;
};

export default async function CalendarDaySheetPage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const property = await loadProperty(admin, propertyId);
  const today = thimphuToday();
  const date =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  const [
    { data: assignments },
    { data: blocks },
    { data: dirtyRooms },
    { data: occupants },
    { data: arrivalsMissingRooms },
  ] = await Promise.all([
    admin
      .from("room_assignments")
      .select(
        `id, from_date, to_date,
         room_units(label, hk_status, room_types(inventory_kind, name)),
         bookings!inner(
           id, contact_name, contact_phone, status, check_in, check_out,
           guide_number, payment_mode, source, booked_by_role, guest_origin,
           rooms, adults,
           agents(company_name),
           booking_drivers(full_name),
           booking_guests(full_name, sdf_ref, sort_order)
         )`,
      )
      .eq("property_id", propertyId)
      .lte("from_date", date)
      .gt("to_date", date)
      .limit(400),
    admin
      .from("room_blocks")
      .select("block_kind, from_date, to_date, reason, room_units(label)")
      .eq("property_id", propertyId)
      .is("released_at", null)
      .lte("from_date", date)
      .gt("to_date", date)
      .limit(100),
    admin
      .from("room_units")
      .select("label, hk_status, room_types(name)")
      .eq("property_id", propertyId)
      .in("hk_status", ["dirty", "inspect", "ooo"])
      .order("label")
      .limit(120),
    admin
      .from("room_assignment_occupants")
      .select("assignment_id, occupant_kind, display_name")
      .eq("property_id", propertyId)
      .limit(800),
    admin
      .from("bookings")
      .select(
        `id, contact_name, contact_phone, status, check_in, check_out,
         guide_number, payment_mode, guest_origin, rooms, adults, source,
         agents(company_name),
         booking_drivers(full_name),
         booking_guests(full_name, sdf_ref),
         room_assignments(id)`,
      )
      .eq("property_id", propertyId)
      .eq("check_in", date)
      .in("status", ["pending", "confirmed"])
      .limit(150),
  ]);

  const occupantsByAssignment = new Map<string, string[]>();
  for (const row of occupants ?? []) {
    const list = occupantsByAssignment.get(row.assignment_id as string) ?? [];
    list.push(
      `${String(row.occupant_kind)}: ${String(row.display_name)}`,
    );
    occupantsByAssignment.set(row.assignment_id as string, list);
  }

  const rows: DayRow[] = (assignments ?? [])
    .map((row) => {
      const booking = (
        Array.isArray(row.bookings) ? row.bookings[0] : row.bookings
      ) as Record<string, unknown> | null;
      if (!booking) return null;
      if (
        !["held", "pending", "confirmed", "checked_in"].includes(
          booking.status as string,
        )
      ) {
        return null;
      }
      const unit = (
        Array.isArray(row.room_units) ? row.room_units[0] : row.room_units
      ) as {
        label?: string;
        hk_status?: string;
        room_types?:
          | { inventory_kind?: string; name?: string }
          | { inventory_kind?: string; name?: string }[]
          | null;
      } | null;
      const rt = Array.isArray(unit?.room_types)
        ? unit?.room_types[0]
        : unit?.room_types;
      const agent = booking.agents as
        | { company_name?: string }
        | { company_name?: string }[]
        | null;
      const agentObj = Array.isArray(agent) ? agent[0] : agent;
      const drivers =
        (booking.booking_drivers as { full_name?: string }[] | null) ?? [];
      const guests =
        (
          booking.booking_guests as
            | { full_name?: string; sdf_ref?: string | null; sort_order?: number }[]
            | null
        ) ?? [];
      const kind =
        booking.check_in === date
          ? "arrival"
          : booking.check_out === date
            ? "departure"
            : "stayover";
      const blockers: string[] = [];
      if (
        kind === "arrival" &&
        ["pending", "confirmed"].includes(booking.status as string)
      ) {
        if ((unit?.hk_status === "dirty" || unit?.hk_status === "ooo") &&
          (rt?.inventory_kind ?? "sellable_guest") === "sellable_guest") {
          blockers.push(`HK ${unit?.hk_status}`);
        }
        if (
          (booking.guest_origin === "international" ||
            !booking.guest_origin) &&
          !(booking.guide_number as string | null)?.trim()
        ) {
          blockers.push("Guide #");
        }
        if (
          (booking.guest_origin === "international" ||
            booking.guest_origin === "regional" ||
            !booking.guest_origin) &&
          guests.some((g) => !g.sdf_ref?.trim())
        ) {
          blockers.push("SDF");
        }
      }

      const occ =
        occupantsByAssignment.get(row.id as string) ??
        guests
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((g) => g.full_name)
          .filter(Boolean);

      return {
        kind,
        room: unit?.label ?? "—",
        inventoryKind: rt?.inventory_kind ?? "sellable_guest",
        guest: (booking.contact_name as string | null) ?? "Guest",
        occupants: occ.join(", ") || "—",
        phone: (booking.contact_phone as string | null) ?? "—",
        status: booking.status as string,
        guide: (booking.guide_number as string | null) ?? "—",
        driver: drivers[0]?.full_name ?? "—",
        payment: (booking.payment_mode as string | null) ?? "—",
        source:
          (booking.booked_by_role as string | null) ??
          (booking.source as string | null) ??
          "—",
        agent: agentObj?.company_name ?? "—",
        check_in: booking.check_in as string,
        check_out: booking.check_out as string,
        blockers,
        bookingId: booking.id as string,
      } satisfies DayRow;
    })
    .filter((row): row is DayRow => row != null)
    .sort((a, b) => a.room.localeCompare(b.room));

  const arrivals = rows.filter((row) => row.kind === "arrival");
  const departures = rows.filter((row) => row.kind === "departure");
  const stayovers = rows.filter((row) => row.kind === "stayover");

  const unassignedArrivals = (arrivalsMissingRooms ?? [])
    .filter((b) => {
      const assigns =
        (b.room_assignments as { id?: string }[] | null) ?? [];
      return assigns.length === 0;
    })
    .map((b) => {
      const agent = b.agents as
        | { company_name?: string }
        | { company_name?: string }[]
        | null;
      const agentObj = Array.isArray(agent) ? agent[0] : agent;
      return {
        id: b.id as string,
        guest: (b.contact_name as string | null) ?? "Guest",
        phone: (b.contact_phone as string | null) ?? "—",
        rooms: Number(b.rooms ?? 1),
        guide: (b.guide_number as string | null) ?? "—",
        payment: (b.payment_mode as string | null) ?? "—",
        agent: agentObj?.company_name ?? "—",
        status: b.status as string,
      };
    });

  return (
    <div className="erp mx-auto max-w-5xl space-y-6 p-4 md:p-6 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            Night audit handoff
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Day sheet · {date}
          </h1>
          <p className="text-sm text-muted-foreground">
            {property?.name ?? "Property"} · Thimphu business date
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FrontDeskLiveRefresh />
          <Link
            href={`/erp/calendar?start=${date}`}
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            Open calendar
          </Link>
          <Link
            href="/erp/arrivals"
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            Arrivals
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">
          {property?.name ?? "Pelbu Suites"} · Day sheet {date}
        </h1>
      </div>

      {unassignedArrivals.length > 0 ? (
        <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 print:break-inside-avoid">
          <h2 className="text-sm font-semibold text-destructive">
            Unassigned arrivals ({unassignedArrivals.length})
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {unassignedArrivals.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/erp/check-in?id=${row.id}`}
                  className="font-medium text-accent underline-offset-4 hover:underline print:no-underline print:text-foreground"
                >
                  {row.guest}
                </Link>
                {" · "}
                {row.phone} · {row.rooms} room(s) · {row.status} · pay{" "}
                {row.payment.replace(/_/g, " ")}
                {row.agent !== "—" ? ` · ${row.agent}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Section title={`Arrivals (${arrivals.length})`} rows={arrivals} />
      <Section
        title={`In-house stayovers (${stayovers.length})`}
        rows={stayovers}
      />
      <Section
        title={`Departures (${departures.length})`}
        rows={departures}
      />

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">
          Room blocks ({(blocks ?? []).length})
        </h2>
        {(blocks ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No active blocks.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {(blocks ?? []).map((block, index) => {
              const unit = (
                Array.isArray(block.room_units)
                  ? block.room_units[0]
                  : block.room_units
              ) as { label?: string } | null;
              return (
                <li key={`${block.block_kind}-${index}`}>
                  <span className="font-medium">{unit?.label ?? "Room"}</span>
                  {" · "}
                  {String(block.block_kind).toUpperCase()} · {block.from_date}→
                  {block.to_date} · {block.reason}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">
          Housekeeping attention ({(dirtyRooms ?? []).length})
        </h2>
        {(dirtyRooms ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No dirty / inspect / OOO rooms.
          </p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {(dirtyRooms ?? []).map((room) => {
              const type = (
                Array.isArray(room.room_types)
                  ? room.room_types[0]
                  : room.room_types
              ) as { name?: string } | null;
              return (
                <li key={room.label as string}>
                  <span className="font-medium">{room.label as string}</span>
                  {" · "}
                  {type?.name ?? "Room"} · {String(room.hk_status)}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function kindLabel(kind: string): string {
  if (kind === "guide_comp") return "Guide";
  if (kind === "driver_comp") return "Driver";
  return "Guest";
}

function Section({ title, rows }: { title: string; rows: DayRow[] }) {
  return (
    <section className="rounded-lg border bg-card p-4 print:break-inside-avoid">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">None.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                <th className="py-1.5 pr-2">Room</th>
                <th className="py-1.5 pr-2">Type</th>
                <th className="py-1.5 pr-2">Guest / occupants</th>
                <th className="py-1.5 pr-2">Guide / driver</th>
                <th className="py-1.5 pr-2">Pay</th>
                <th className="py-1.5 pr-2">Blockers</th>
                <th className="py-1.5">Stay</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.bookingId}-${row.room}-${row.inventoryKind}`}
                  className="border-b align-top"
                >
                  <td className="py-1.5 pr-2 font-medium">{row.room}</td>
                  <td className="py-1.5 pr-2 text-xs text-muted-foreground">
                    {kindLabel(row.inventoryKind)}
                  </td>
                  <td className="py-1.5 pr-2">
                    <Link
                      href={`/erp/check-in?id=${row.bookingId}`}
                      className="font-medium text-accent underline-offset-4 hover:underline print:no-underline print:text-foreground"
                    >
                      {row.guest}
                    </Link>
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({row.status.replace(/_/g, " ")})
                    </span>
                    <div className="text-xs text-muted-foreground">
                      {row.occupants}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.phone}
                    </div>
                  </td>
                  <td className="py-1.5 pr-2">
                    {row.guide}
                    {row.driver !== "—" ? (
                      <span className="block text-xs text-muted-foreground">
                        Driver {row.driver}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-2 capitalize">
                    {row.payment.replace(/_/g, " ")}
                    <span className="mt-0.5 block text-xs text-muted-foreground capitalize">
                      {row.source.replace(/_/g, " ")}
                      {row.agent !== "—" ? ` · ${row.agent}` : ""}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2">
                    {row.blockers.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="text-destructive">
                        {row.blockers.join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5">
                    {row.check_in} → {row.check_out}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
