import { BookingBoardTable } from "@/components/erp/BookingBoardTable";
import { DeskListShell } from "@/components/erp/DeskListShell";
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
      "id, contact_name, contact_phone, check_in, check_out, status, adults, rooms, agents(company_name)",
    )
    .eq("property_id", propertyId)
    .eq("check_out", today)
    .not("status", "in", '("cancelled","no_show")')
    .order("contact_name")
    .limit(150);

  return (
    <DeskListShell
      title="Departures"
      eyebrow="Today"
      heading={`Departures · ${fmtDate(today)}`}
      blurb="Due out today — settle folios before checkout."
      filters={
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/erp/arrivals"
            className="rounded-sm border border-espresso/20 px-3 py-2 text-espresso"
          >
            Arrivals
          </Link>
          <Link
            href="/erp/in-house"
            className="rounded-sm border border-espresso/20 px-3 py-2 text-espresso"
          >
            In-house
          </Link>
          <Link
            href="/erp/departures"
            className="rounded-sm bg-espresso px-3 py-2 text-ivory"
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
