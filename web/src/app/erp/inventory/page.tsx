import {
  InventoryItemForm,
  InventoryMoveForm,
  StockValueHint,
  type InvOption,
} from "@/components/erp/OpsForms";
import { DeskHeader } from "@/components/erp/DeskHeader";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Inventory | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpInventoryPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  const propertyId = property?.id as string | undefined;
  if (!propertyId) {
    return (
      <div className="min-h-screen bg-ivory">
        <DeskHeader title="Inventory" />
        <main className="mx-auto max-w-[1200px] px-6 py-10">
          <p className="text-sm text-maroon">Property not configured.</p>
        </main>
      </div>
    );
  }

  const [{ data: items }, { data: moves }] = await Promise.all([
    admin
      .from("inventory_items")
      .select(
        "id, sku, name, category, unit, qty_on_hand, reorder_level, unit_cost_btn, is_active",
      )
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("sku")
      .limit(200),
    admin
      .from("inventory_movements")
      .select(
        "id, movement_kind, qty_delta, reference, created_at, inventory_items(sku, name)",
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const options: InvOption[] = (items ?? []).map((i) => ({
    id: i.id as string,
    sku: i.sku as string,
    name: i.name as string,
    qty_on_hand: Number(i.qty_on_hand),
    unit: i.unit as string,
  }));

  const low = (items ?? []).filter(
    (i) => Number(i.qty_on_hand) <= Number(i.reorder_level),
  );
  const stockValue = (items ?? []).reduce(
    (s, i) => s + Number(i.qty_on_hand) * Number(i.unit_cost_btn),
    0,
  );

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title="Inventory" />
      <main className="mx-auto max-w-[1200px] space-y-12 px-6 py-10 md:px-8">
        <section>
          <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
            Stock snapshot
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Stat label="SKUs" value={String((items ?? []).length)} />
            <Stat label="Below reorder" value={String(low.length)} />
            <Stat label="Est. stock value" value={formatBtn(stockValue)} />
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <InventoryItemForm />
          <InventoryMoveForm items={options} />
        </div>

        <section>
          <div className="border-b border-espresso/15 pb-2">
            <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
              On hand
            </h2>
          </div>
          {(items ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-muted">No items.</p>
          ) : (
            <ul className="mt-2">
              {(items ?? []).map((i) => {
                const qty = Number(i.qty_on_hand);
                const warn = qty <= Number(i.reorder_level);
                return (
                  <li
                    key={i.id as string}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-espresso/10 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-espresso">
                        <span className="font-mono text-xs text-espresso/50">
                          {i.sku as string}
                        </span>{" "}
                        {i.name as string}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {i.category as string} · reorder {Number(i.reorder_level)}{" "}
                        {i.unit as string}
                        {warn ? (
                          <span className="text-maroon"> · low</span>
                        ) : null}
                      </p>
                    </div>
                    <p className="tabular-nums text-espresso">
                      {qty} {i.unit as string}
                      <StockValueHint qty={qty} unitCost={Number(i.unit_cost_btn)} />
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <div className="border-b border-espresso/15 pb-2">
            <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
              Recent movements
            </h2>
          </div>
          {(moves ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-muted">No movements yet.</p>
          ) : (
            <ul className="mt-2">
              {(moves ?? []).map((m) => {
                const item = m.inventory_items as {
                  sku?: string;
                  name?: string;
                } | null;
                return (
                  <li
                    key={m.id as string}
                    className="border-b border-espresso/10 py-3 text-sm"
                  >
                    <p className="font-medium text-espresso">
                      {m.movement_kind as string} · {item?.sku ?? "—"}{" "}
                      <span className="tabular-nums">
                        {Number(m.qty_delta) > 0 ? "+" : ""}
                        {Number(m.qty_delta)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {String(m.created_at).slice(0, 16).replace("T", " ")}
                      {m.reference ? ` · ${m.reference as string}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-espresso/10 bg-white px-4 py-4">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-gold uppercase">
        {label}
      </p>
      <p className="mt-2 text-lg tabular-nums text-espresso">{value}</p>
    </div>
  );
}
