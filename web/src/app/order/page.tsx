import { OrderForm } from "@/components/order/OrderForm";
import { ConversionShell } from "@/components/site/ConversionShell";
import type { MenuItem } from "@/lib/menu";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Order | Pelbu Suites",
  description:
    "Order cafe and pastry from Pelbu Suites for pickup or taxi delivery in Thimphu.",
};

export const dynamic = "force-dynamic";

async function loadMenu(): Promise<MenuItem[]> {
  const admin = createSupabaseAdminClient();

  const { data: property, error: propertyError } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();

  if (propertyError || !property) {
    console.error("loadMenu property", propertyError);
    return [];
  }

  const { data, error } = await admin
    .from("menu_items")
    .select(
      "id, outlet, category, name, description, price_btn, gst_applicable, sort_order",
    )
    .eq("property_id", property.id)
    .eq("is_available", true)
    .in("outlet", ["cafe", "pastry"])
    .order("sort_order", { ascending: true });

  if (error || !data) {
    console.error("loadMenu items", error);
    return [];
  }

  return data.map((row) => ({
    id: row.id as string,
    outlet: row.outlet as string,
    category: row.category as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    price_btn: Number(row.price_btn),
    gst_applicable: Boolean(row.gst_applicable),
    sort_order: Number(row.sort_order),
  }));
}

export default async function OrderPage() {
  const items = await loadMenu();

  return (
    <ConversionShell
      eyebrow="Order"
      title="Cafe & pastry to your door."
      body="Breakfast through dinner, plus pastry. Pickup at the cafe or taxi across Thimphu — GST shown clearly before you place the order."
      aside={
        <div className="space-y-5 text-sm text-muted-foreground">
          <div className="space-y-3">
            <p className="text-sm font-medium text-ink">Hours</p>
            <p className="leading-relaxed text-ink/80">
              Opens 6:30 AM in summer and 7:30 AM in winter. Orders after
              kitchen close are confirmed the next morning.
            </p>
          </div>
          <div className="space-y-2 border-t border-border pt-5">
            <p className="leading-relaxed">
              Prices in Ngultrum. GST applies to marked items. Taxi fare is paid
              to the driver separately.
            </p>
          </div>
        </div>
      }
    >
      {items.length === 0 ? (
        <p className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon">
          Menu is temporarily unavailable. Call the cafe or try again shortly.
        </p>
      ) : (
        <OrderForm items={items} />
      )}
    </ConversionShell>
  );
}
