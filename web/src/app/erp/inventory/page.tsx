import {
  InventoryItemForm,
  InventoryMoveForm,
  StockValueHint,
  type InvOption,
} from "@/components/erp/OpsForms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="erp mx-auto w-full max-w-[1200px] p-6">
        <p className="text-sm text-destructive">Property not configured.</p>
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
    <div className="erp mx-auto w-full max-w-[1200px] space-y-10 p-4 md:p-6">
      <section className="space-y-3">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Stock snapshot
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="SKUs" value={String((items ?? []).length)} />
          <Stat label="Below reorder" value={String(low.length)} />
          <Stat label="Est. stock value" value={formatBtn(stockValue)} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <InventoryItemForm />
        <InventoryMoveForm items={options} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            On hand
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No items.</p>
          ) : (
            <ul className="divide-y">
              {(items ?? []).map((i) => {
                const qty = Number(i.qty_on_hand);
                const warn = qty <= Number(i.reorder_level);
                return (
                  <li
                    key={i.id as string}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        <span className="font-mono text-xs text-muted-foreground">
                          {i.sku as string}
                        </span>{" "}
                        {i.name as string}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {i.category as string} · reorder {Number(i.reorder_level)}{" "}
                        {i.unit as string}
                        {warn ? <span className="text-destructive"> · low</span> : null}
                      </p>
                    </div>
                    <p className="tabular-nums text-foreground">
                      {qty} {i.unit as string}
                      <StockValueHint qty={qty} unitCost={Number(i.unit_cost_btn)} />
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Recent movements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(moves ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No movements yet.</p>
          ) : (
            <ul className="divide-y">
              {(moves ?? []).map((m) => {
                const item = m.inventory_items as {
                  sku?: string;
                  name?: string;
                } | null;
                return (
                  <li key={m.id as string} className="py-3 text-sm">
                    <p className="font-medium text-foreground">
                      {m.movement_kind as string} · {item?.sku ?? "—"}{" "}
                      <span className="tabular-nums">
                        {Number(m.qty_delta) > 0 ? "+" : ""}
                        {Number(m.qty_delta)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {String(m.created_at).slice(0, 16).replace("T", " ")}
                      {m.reference ? ` · ${m.reference as string}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-2 py-4">
      <CardContent>
        <p className="text-[10px] font-semibold tracking-[0.18em] text-accent uppercase">
          {label}
        </p>
        <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
