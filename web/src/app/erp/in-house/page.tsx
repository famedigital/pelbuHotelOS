import { BookingBoardTable } from "@/components/erp/BookingBoardTable";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import {
  InhouseTasksPanel,
  type InhouseTaskRow,
} from "@/components/erp/InhouseTasksPanel";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  dayOpsRowToBoardRaw,
  loadDayOpsBoard,
} from "@/lib/erp/day-ops-board";
import { fmtDate, thimphuToday } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "In-house",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function InHousePage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();

  const [dayOps, { data: taskRows }] = await Promise.all([
    loadDayOpsBoard(admin, propertyId, today, { slices: ["in_house"] }),
    admin
      .from("inhouse_tasks")
      .select(
        `id, due_at, kind, notes, booking_id, done_at,
         bookings(contact_name, room_assignments(room_units(label)))`,
      )
      .eq("property_id", propertyId)
      .is("done_at", null)
      .order("due_at", { ascending: true })
      .limit(40),
  ]);

  const boardRows = dayOps.inHouse.map(dayOpsRowToBoardRaw);

  const bookingOptions = dayOps.inHouse.map((b) => ({
    id: b.id,
    label: `${b.contact_name ?? "Guest"}${b.room_labels ? ` · ${b.room_labels}` : ""}`,
  }));

  const tasks: InhouseTaskRow[] = (taskRows ?? []).map((t) => {
    const booking = (
      Array.isArray(t.bookings) ? t.bookings[0] : t.bookings
    ) as {
      contact_name?: string;
      room_assignments?: {
        room_units?: { label?: string } | { label?: string }[];
      }[];
    } | null;
    const assigns = booking?.room_assignments ?? [];
    const room = assigns
      .map((a) => {
        const u = Array.isArray(a.room_units) ? a.room_units[0] : a.room_units;
        return u?.label;
      })
      .filter(Boolean)
      .join(", ");
    return {
      id: t.id as string,
      due_at: t.due_at as string,
      kind: t.kind as string,
      notes: (t.notes as string | null) ?? null,
      booking_id: (t.booking_id as string | null) ?? null,
      guest: booking?.contact_name ?? null,
      room: room || null,
    };
  });

  return (
    <DeskListShell
      eyebrow="Today"
      heading={`In-house · ${fmtDate(today)}`}
      blurb="Guests currently staying. Open StayHub at Stay / Money for charges, payments, invoice, tasks — then hand off to Check-out when settled. Meal plan and room numbers on every row."
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
      <InhouseTasksPanel tasks={tasks} bookingOptions={bookingOptions} />
      <p className="text-xs text-muted-foreground">
        {dayOps.inHouse.length} shown · {dayOps.inHouseMealPax} meal pax
      </p>
      <BookingBoardTable rows={boardRows} board="in_house" />
    </DeskListShell>
  );
}
