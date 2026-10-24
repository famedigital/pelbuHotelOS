import { PartyStatementSheet } from "@/components/erp/finance/PartyStatementSheet";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadGuestStatement } from "@/lib/finance/party-statement";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GuestStatementPrint({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string; from?: string; to?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  if (!sp.booking || !sp.from || !sp.to) notFound();
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const property = await loadProperty(admin, propertyId);
  const statement = await loadGuestStatement(admin, propertyId, sp.booking, sp.from, sp.to);
  if (!statement) notFound();
  return (
    <main className="bg-white p-6">
      <PartyStatementSheet hotel={property?.name ?? "Hotel"} statement={statement} />
    </main>
  );
}
