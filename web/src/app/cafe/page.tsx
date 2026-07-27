import { ConversionShell } from "@/components/site/ConversionShell";
import type { MenuItem } from "@/lib/menu";
import { formatBtn } from "@/lib/pricing";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Cafe & Pastry | Pelbu Suites",
  description:
    "Cafe and pastry at Pelbu Suites — opens 6:30 summer / 7:30 winter. Order for taxi delivery in Thimphu.",
};

export const dynamic = "force-dynamic";

async function loadMenu(): Promise<MenuItem[]> {
  const admin = createSupabaseAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  if (!property) return [];

  const { data } = await admin
    .from("menu_items")
    .select(
      "id, outlet, category, name, description, price_btn, gst_applicable, sort_order",
    )
    .eq("property_id", property.id)
    .eq("is_available", true)
    .in("outlet", ["cafe", "pastry"])
    .order("sort_order");

  return (data ?? []).map((row) => ({
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

export default async function CafePage() {
  const items = await loadMenu();
  const byCategory = new Map<string, MenuItem[]>();
  for (const item of items) {
    const key = `${item.outlet} · ${item.category}`;
    const list = byCategory.get(key) ?? [];
    list.push(item);
    byCategory.set(key, list);
  }

  return (
    <ConversionShell
      eyebrow="Cafe & Pastry"
      title="Morning light, warm pastry."
      body="Opens 6:30 AM in summer and 7:30 AM in winter. Breakfast through dinner — order for pickup or taxi delivery across Thimphu."
      aside={
        <div className="space-y-4 text-sm text-muted">
          <p className="text-xs tracking-[0.2em] text-gold uppercase">Order</p>
          <p className="leading-relaxed text-espresso/80">
            GST shown clearly on the bill. Taxi fare is paid to the driver
            separately.
          </p>
          <a
            href="/order"
            className="inline-flex min-h-11 items-center rounded-sm bg-gold px-5 text-sm font-medium text-espresso"
          >
            Order now
          </a>
        </div>
      }
    >
      <div className="space-y-10">
        {[...byCategory.entries()].map(([category, categoryItems]) => (
          <section key={category}>
            <h2 className="text-sm font-medium tracking-[0.18em] text-gold uppercase">
              {category}
            </h2>
            <ul className="mt-4 divide-y divide-espresso/10 border-y border-espresso/10">
              {categoryItems.map((item) => (
                <li key={item.id} className="py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-base text-espresso">{item.name}</p>
                    <p className="text-sm text-espresso">{formatBtn(item.price_btn)}</p>
                  </div>
                  {item.description ? (
                    <p className="mt-1 text-sm text-muted">{item.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {items.length === 0 ? (
          <p className="text-sm text-maroon">Menu temporarily unavailable.</p>
        ) : (
          <a
            href="/order"
            className="inline-flex min-h-11 items-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory"
          >
            Build your order
          </a>
        )}
      </div>
    </ConversionShell>
  );
}
