import { BookingBoardTable } from "@/components/erp/BookingBoardTable";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate, requireDeskPropertyId, thimphuToday } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Departures | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function DeparturesPage() {
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
    .eq("check_out", today)
    .not("status", "in", '("cancelled","no_show")')
    .order("contact_name")
    .limit(150);

  return (
    <DeskListShell
      eyebrow="Today"
      heading={`Departures · ${fmtDate(today)}`}
      blurb="Due out today — review folio balance and assigned rooms, then check out (rooms go dirty for HK)."
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
      <p className="text-xs text-muted-foreground">{rows?.length ?? 0} shown</p>
      <BookingBoardTable
        rows={(rows as Record<string, unknown>[]) ?? []}
        board="departures"
      />
    </DeskListShell>
  );
}
