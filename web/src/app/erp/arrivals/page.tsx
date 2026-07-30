import { BookingBoardTable } from "@/components/erp/BookingBoardTable";
import { BoardTabs } from "@/components/erp/BoardTabs";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate, requireDeskPropertyId, thimphuDateOffset, thimphuToday } from "@/lib/erp-lists";
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
  // Rolling window: today's arrivals pinned first, then the next 7 days so the
  // board is useful on quiet days and gives the desk a forward view.
  const horizon = thimphuDateOffset(today, 7);

  const { data: rows } = await admin
    .from("bookings")
    .select(BOARD_SELECT)
    .eq("property_id", propertyId)
    .gte("check_in", today)
    .lte("check_in", horizon)
    .not("status", "in", '("cancelled","no_show","checked_out")')
    .order("check_in")
    .order("contact_name")
    .limit(150);

  return (
    <DeskListShell
      eyebrow="Arrivals"
      heading={`Arrivals · ${fmtDate(today)} → ${fmtDate(horizon)}`}
      blurb="Today's check-ins first, then the next 7 days. Assign physical rooms, confirm HK readiness, collect SDF/guide docs, then check in."
      filters={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BoardTabs />
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
      <p className="text-xs text-muted-foreground">{rows?.length ?? 0} shown</p>
      <BookingBoardTable rows={(rows as Record<string, unknown>[]) ?? []} />
    </DeskListShell>
  );
}
