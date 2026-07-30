import { FastBookForm } from "@/components/erp/FastBookForm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { deskPinConfigured, isDeskAuthenticated } from "@/lib/desk-auth";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Fast book | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    check_in?: string;
    check_out?: string;
    room_unit_id?: string;
  }>;
};

export default async function FastBookPage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const property = await loadProperty(admin, propertyId);

  const [{ data: roomTypes }, { data: agents }, preferredUnit] = await Promise.all([
    property
      ? admin
          .from("room_types")
          .select("id, code, name, inventory_kind, unit_count")
          .eq("property_id", property.id)
          .order("code")
      : Promise.resolve({ data: [] }),
    admin
      .from("agents")
      .select("id, company_name, market, status")
      .in("status", ["approved", "demo"])
      .order("company_name"),
    sp.room_unit_id && property
      ? admin
          .from("room_units")
          .select("id, room_type_id, room_types(code)")
          .eq("id", sp.room_unit_id)
          .eq("property_id", property.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const qtyByCode: Record<string, number> = {};
  const unit = preferredUnit.data;
  if (unit) {
    const rt = unit.room_types as { code?: string } | { code?: string }[] | null;
    const code = Array.isArray(rt) ? rt[0]?.code : rt?.code;
    if (code) qtyByCode[code] = 1;
  }

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      {!deskPinConfigured() ? (
        <Alert variant="warning">
          <AlertTitle>Dev mode</AlertTitle>
          <AlertDescription>
            Desk PIN not set. Add <code className="font-mono">DESK_PIN</code> before
            production.
          </AlertDescription>
        </Alert>
      ) : null}

      <p className="text-sm text-muted-foreground">
        One screen: dates → rooms → pax → agent → guide no → guest / guide /
        driver beds → save.
      </p>

      <FastBookForm
        roomTypes={(roomTypes ?? []).map((r) => ({
          id: r.id as string,
          code: r.code as string,
          name: r.name as string,
          inventory_kind: r.inventory_kind as string,
          unit_count: Number(r.unit_count ?? 0),
        }))}
        agents={(agents ?? []).map((a) => ({
          id: a.id as string,
          company_name: a.company_name as string,
          market: a.market as string,
          status: a.status as string,
        }))}
        property={
          property
            ? {
                name: property.name,
                legal_name: property.legal_name,
                address: property.address,
                phone: property.phone,
                email: property.email,
                tax_id: property.tax_id,
                logo_public_id: property.logo_public_id,
              }
            : undefined
        }
        invoiceDesign={property?.doc_invoice}
        voucherDesign={property?.doc_voucher}
        defaults={{
          checkIn: sp.check_in,
          checkOut: sp.check_out,
          roomUnitId: unit?.id as string | undefined,
          qtyByCode,
        }}
      />
    </div>
  );
}
