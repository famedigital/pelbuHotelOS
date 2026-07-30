import { BookingBoardTable } from "@/components/erp/BookingBoardTable";
import { BoardTabs } from "@/components/erp/BoardTabs";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate, requireDeskPropertyId, thimphuToday } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "In-house | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function InHousePage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();

  const { data: rows } = await admin
    .from("bookings")
    .select(
      `id, contact_name, contact_phone, check_in, check_out, status, adults, rooms,
       source, guest_origin, guide_number, payment_mode,
       token_required_btn, token_received_btn,
       agents(company_name),
       room_assignments(
         room_units(label, hk_status, room_types(inventory_kind))
       ),
       folios(status, folio_lines(total_btn, status))`,
    )
    .eq("property_id", propertyId)
    .lte("check_in", today)
    .gt("check_out", today)
    .in("status", ["checked_in", "confirmed"])
    .order("check_out")
    .limit(200);

  return (
    <DeskListShell
      eyebrow="Today"
      heading={`In-house · ${fmtDate(today)}`}
      blurb="Guests currently staying — room numbers, folio balance, and checkout handoff."
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
