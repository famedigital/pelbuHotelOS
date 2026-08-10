import {
  createDiningReservation,
  updateDiningReservationStatus,
} from "@/app/actions/erp-fnb-ops";
import { DiningReservationsPanel } from "@/components/erp/fnb/DiningReservationsPanel";
import { FnbSectionHeader } from "@/components/erp/fnb/FnbSectionHeader";
import { loadDiningTables } from "@/lib/pos";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DiningReservationsPage() {
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const tables = await loadDiningTables(admin);
  const { data: rows } = await admin
    .from("dining_reservations")
    .select(
      "id, guest_name, phone, party_size, reserved_for, status, notes, outlet, table_id",
    )
    .eq("property_id", propertyId)
    .gte("reserved_for", new Date(Date.now() - 86_400_000).toISOString())
    .order("reserved_for", { ascending: true })
    .limit(80);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <FnbSectionHeader
        title="Table reservations"
        description="Booked · waitlist · seat. Link QR menus with ?table=T12 on public /menu."
      />
      <Link href="/erp/pos" className="text-sm text-muted-foreground">
        ← POS
      </Link>
      <DiningReservationsPanel
        rows={(rows ?? []).map((r) => ({
          id: r.id as string,
          guest_name: r.guest_name as string,
          phone: (r.phone as string | null) ?? null,
          party_size: Number(r.party_size),
          reserved_for: r.reserved_for as string,
          status: r.status as string,
          notes: (r.notes as string | null) ?? null,
          outlet: (r.outlet as string | null) ?? null,
          table_id: (r.table_id as string | null) ?? null,
        }))}
        tables={tables.map((t) => ({ id: t.id, name: t.name }))}
        createAction={createDiningReservation}
        statusAction={updateDiningReservationStatus}
      />
    </div>
  );
}
