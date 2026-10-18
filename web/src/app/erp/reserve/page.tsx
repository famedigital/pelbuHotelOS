import { Reserve20sForm } from "@/components/erp/Reserve20sForm";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Reserve",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    check_in?: string;
    check_out?: string;
    rooms?: string;
    rate_tier?: string;
    room_type?: string;
    contact_name?: string;
  }>;
};

/** 20s Reserve — Who · When · What · Rate · Hold / CI. */
export default async function ReservePage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [{ data: roomTypes }, { data: agents }] = await Promise.all([
    admin
      .from("room_types")
      .select("code, name, unit_count")
      .eq("property_id", propertyId)
      .eq("inventory_kind", "sellable_guest")
      .order("code"),
    admin
      .from("agents")
      .select("id, company_name, rate_tier")
      .in("status", ["approved", "demo", "directory"])
      .order("company_name")
      .limit(200),
  ]);

  const rooms = sp.rooms ? Number(sp.rooms) : undefined;

  return (
    <DeskListShell
      heading="Reserve"
      subtitle="20 seconds · assign later · sheet rate only."
      wide
    >
      <Reserve20sForm
        roomTypes={(roomTypes ?? []).map((r) => ({
          code: r.code as string,
          name: (r.name as string) || (r.code as string),
          unit_count: Number(r.unit_count ?? 0),
        }))}
        agents={(agents ?? []).map((a) => ({
          id: a.id as string,
          company_name: a.company_name as string,
          rate_tier: (a.rate_tier as string | null) ?? null,
        }))}
        defaults={{
          checkIn: sp.check_in,
          checkOut: sp.check_out,
          rooms: Number.isFinite(rooms) ? rooms : undefined,
          rateTier: sp.rate_tier,
          roomTypeCode: sp.room_type,
          contactName: sp.contact_name,
        }}
      />
    </DeskListShell>
  );
}
