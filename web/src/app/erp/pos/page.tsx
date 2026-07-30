import { GuestServiceForm } from "@/components/erp/GuestServiceForm";
import { PosLayout } from "@/components/erp/pos/PosLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { deskPinConfigured, isDeskAuthenticated } from "@/lib/desk-auth";
import { loadMenuByOutlets } from "@/lib/menu-loader";
import {
  loadDiningTables,
  loadModifierGroupsForItems,
  loadOpenPosTickets,
  loadPosStaff,
  POS_TENDER_METHODS,
  POS_VOID_REASON_CODES,
  voidManagerThresholdBtn,
} from "@/lib/pos";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "POS | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpPosPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const property = await loadProperty(admin, propertyId);

  const [items, { data: bookings }, tables, openTickets, staff] =
    await Promise.all([
      loadMenuByOutlets(["cafe", "pastry", "restaurant", "bar"]),
      property
        ? admin
            .from("bookings")
            .select("id, contact_name, check_in, check_out, status")
            .eq("property_id", property.id)
            .in("status", ["pending", "confirmed", "checked_in"])
            .order("check_in", { ascending: false })
            .limit(40)
        : Promise.resolve({ data: [] }),
      loadDiningTables(admin),
      loadOpenPosTickets(admin),
      loadPosStaff(admin),
    ]);

  const modifierGroups = await loadModifierGroupsForItems(
    items.map((i) => i.id),
    admin,
  );

  const bookingOptions = (bookings ?? []).map((b) => ({
    id: b.id as string,
    contact_name: (b.contact_name as string | null) ?? null,
    check_in: b.check_in as string,
    check_out: b.check_out as string,
    status: b.status as string,
  }));

  return (
    <div className="erp mx-auto w-full max-w-[1280px] space-y-6 p-4 md:p-6">
      {!deskPinConfigured() ? (
        <Alert variant="warning">
          <AlertTitle>Dev mode</AlertTitle>
          <AlertDescription>
            Desk PIN not set. Add <code className="font-mono">DESK_PIN</code>{" "}
            before production.
          </AlertDescription>
        </Alert>
      ) : null}

      <PosLayout
        items={items}
        modifierGroups={modifierGroups}
        tables={tables}
        staff={staff}
        openTickets={openTickets}
        bookings={bookingOptions}
        gstRate={property?.gst_rate ?? 0.07}
        serviceChargeRate={property?.service_charge_rate ?? 0}
        serviceChargeDefaultOn={property?.service_charge_default_on ?? false}
        runtimeConfig={{
          voidReasonCodes: POS_VOID_REASON_CODES,
          tenderMethods: POS_TENDER_METHODS,
          voidManagerThresholdBtn: voidManagerThresholdBtn(),
        }}
        guestServiceSlot={
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-4 space-y-0.5">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                Guest service
              </p>
              <p className="text-sm text-muted-foreground">
                Post taxi, shop, laundry, and other non-menu charges straight to
                a guest folio.
              </p>
            </div>
            <GuestServiceForm
              bookings={bookingOptions}
              gstRate={property?.gst_rate ?? 0.07}
              serviceChargeRate={property?.service_charge_rate ?? 0}
              serviceChargeDefaultOn={
                property?.service_charge_default_on ?? false
              }
            />
          </div>
        }
      />
    </div>
  );
}
