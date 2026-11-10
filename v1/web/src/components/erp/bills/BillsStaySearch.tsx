import { BillsStayRegister } from "@/components/erp/bills/BillsStayRegister";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { loadOpenFolioRegister } from "@/lib/erp/cashier-desk";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** This stay — open folios on the property, not a jump to reservations. */
export async function BillsStaySearch() {
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const rows = await loadOpenFolioRegister(admin, propertyId);
  return <BillsStayRegister rows={rows} />;
}
