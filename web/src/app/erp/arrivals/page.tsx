import { BookingBoardTable } from "@/components/erp/BookingBoardTable";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { Card, CardContent } from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate, requireDeskPropertyId, thimphuToday } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Arrivals | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const BOARD_SELECT = `
  id, contact_name, contact_phone, check_in, check_out, status, adults, rooms,
  source, guest_origin, guide_number, payment_mode,
  token_required_btn, token_received_btn,
  agents(company_name),
  room_assignments(
    room_units(label, hk_status, room_types(inventory_kind))
  )
`;

export default async function ArrivalsPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();

  const { data: rows } = await admin
    .from("bookings")
    .select(BOARD_SELECT)
    .eq("property_id", propertyId)
    .eq("check_in", today)
    .in("status", ["pending", "confirmed"])
    .order("check_in")
    .order("contact_name")
    .limit(150);

  const boardRows = (rows as Record<string, unknown>[]) ?? [];
  const summary = summarizeArrivals(boardRows);

  return (
    <DeskListShell
      title="Arrivals"
      eyebrow="Arrivals"
      heading={`Arrivals · ${fmtDate(today)}`}
      blurb="Today's pending and confirmed arrivals only. Assign physical rooms, confirm housekeeping readiness, collect guest documents, then check in."
      filters={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-3">
            <FrontDeskLiveRefresh />
            <Link
              href={`/erp/calendar/day-sheet?date=${today}`}
              className="text-sm text-accent underline-offset-4 hover:underline"
            >
              Day sheet
            </Link>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ArrivalStat label="Arrival bookings" value={summary.bookings} />
        <ArrivalStat label="Expected guests" value={summary.guests} />
        <ArrivalStat label="Rooms booked" value={summary.rooms} />
        <ArrivalStat
          label="Ready to check in"
          value={summary.ready}
          hint={
            summary.bookings > summary.ready
              ? `${summary.bookings - summary.ready} need room or HK action`
              : "All arrivals ready"
          }
        />
      </div>

      <div className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Arrival worklist
          </h2>
          <p className="text-xs text-muted-foreground">
            Use the table to review readiness; open Check in for the full guest
            document and room-assignment form.
          </p>
        </div>
        <BookingBoardTable rows={boardRows} />
      </div>
    </DeskListShell>
  );
}

function ArrivalStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
        {hint ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function summarizeArrivals(rows: Record<string, unknown>[]) {
  let guests = 0;
  let rooms = 0;
  let ready = 0;

  for (const row of rows) {
    guests += Number(row.adults ?? 0);
    const bookedRooms = Number(row.rooms ?? 0);
    rooms += bookedRooms;

    const assignments =
      (row.room_assignments as
        | Array<{
            room_units:
              | {
                  hk_status?: string;
                  room_types?:
                    | { inventory_kind?: string }
                    | { inventory_kind?: string }[]
                    | null;
                }
              | {
                  hk_status?: string;
                  room_types?:
                    | { inventory_kind?: string }
                    | { inventory_kind?: string }[]
                    | null;
                }[]
              | null;
          }>
        | null) ?? [];

    const guestRooms = assignments
      .map((assignment) =>
        Array.isArray(assignment.room_units)
          ? assignment.room_units[0]
          : assignment.room_units,
      )
      .filter((unit) => {
        const roomType = Array.isArray(unit?.room_types)
          ? unit.room_types[0]
          : unit?.room_types;
        return (
          unit &&
          (roomType?.inventory_kind ?? "sellable_guest") === "sellable_guest"
        );
      });

    if (
      bookedRooms > 0 &&
      guestRooms.length >= bookedRooms &&
      guestRooms.every((unit) =>
        ["clean", "inspect"].includes(unit?.hk_status ?? ""),
      )
    ) {
      ready += 1;
    }
  }

  return { bookings: rows.length, guests, rooms, ready };
}
