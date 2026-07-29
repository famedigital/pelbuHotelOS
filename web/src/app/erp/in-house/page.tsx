import { BookingBoardTable } from "@/components/erp/BookingBoardTable";
import { DeskListShell } from "@/components/erp/DeskListShell";
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
      "id, contact_name, contact_phone, check_in, check_out, status, adults, rooms, agents(company_name)",
    )
    .eq("property_id", propertyId)
    .lte("check_in", today)
    .gt("check_out", today)
    .in("status", ["checked_in", "confirmed"])
    .order("check_out")
    .limit(200);

  return (
    <DeskListShell
      title="In-house"
      eyebrow="Today"
      heading={`In-house · ${fmtDate(today)}`}
      blurb="Guests currently staying — for breakfast count, fire list, and folio charges."
      filters={
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/erp/arrivals"
            className="rounded-sm border border-espresso/20 px-3 py-2 text-espresso"
          >
            Arrivals
          </Link>
          <Link href="/erp/in-house" className="rounded-sm bg-espresso px-3 py-2 text-ivory">
            In-house
          </Link>
          <Link
            href="/erp/departures"
            className="rounded-sm border border-espresso/20 px-3 py-2 text-espresso"
          >
            Departures
          </Link>
        </nav>
      }
    >
      <BookingBoardTable rows={rows ?? []} />
    </DeskListShell>
  );
}
