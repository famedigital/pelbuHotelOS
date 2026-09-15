import {
  AuditCountForm,
  StartAuditForm,
  type OpenAudit,
} from "@/components/erp/inventory/AuditSessionForm";
import type { InvLocationOption } from "@/components/erp/InventoryOpsForms";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Stock assessment",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InventoryAuditsPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [{ data: audits }, { data: openAudit }, { data: locations }] = await Promise.all([
    admin
      .from("inventory_audits")
      .select(
        `id, business_date, status, notes, posted_at, created_at,
         inventory_locations(name)`,
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("inventory_audits")
      .select(
        `id, business_date, location_id,
         inventory_locations(name),
         inventory_audit_lines(
           id, item_id, expected_qty, counted_qty,
           inventory_items(sku, name, unit)
         )`,
      )
      .eq("property_id", propertyId)
      .eq("status", "open")
      .maybeSingle(),
    admin
      .from("inventory_locations")
      .select("id, code, name, department")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const locationRows: InvLocationOption[] = (locations ?? []).map((l) => ({
    id: l.id as string,
    code: l.code as string,
    name: l.name as string,
    department: l.department as string,
  }));

  let openSession: OpenAudit | null = null;
  if (openAudit?.id) {
    const loc = openAudit.inventory_locations as { name?: string } | null;
    const lines = (openAudit.inventory_audit_lines as Array<{
      id: string;
      item_id: string;
      expected_qty: number;
      counted_qty: number | null;
      inventory_items: { sku?: string; name?: string; unit?: string } | null;
    }> | null) ?? [];
    openSession = {
      id: openAudit.id as string,
      business_date: openAudit.business_date as string,
      location_name: loc?.name ?? null,
      lines: lines.map((l) => ({
        id: l.id,
        item_id: l.item_id,
        sku: l.inventory_items?.sku ?? "—",
        name: l.inventory_items?.name ?? "",
        unit: l.inventory_items?.unit ?? "",
        expected_qty: Number(l.expected_qty),
        counted_qty: l.counted_qty != null ? Number(l.counted_qty) : null,
      })),
    };
  }

  return (
    <DeskListShell
      eyebrow="Inventory"
      heading="Assessment"
      blurb="Weekly stocktake / audit — start a count by location, enter variances with photos, post to adjust balances. History below."
    >
      {!openSession ? (
        <StartAuditForm locations={locationRows} />
      ) : (
        <AuditCountForm audit={openSession} />
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="min-w-[640px] w-full text-sm">
          <caption className="sr-only">Audit sessions</caption>
          <thead className="bg-muted/40">
            <tr>
              {["Date", "Location", "Status", "Notes", "Posted"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="h-10 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(audits ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-muted-foreground">
                  No audit history yet.
                </td>
              </tr>
            ) : (
              (audits ?? []).map((a) => {
                const loc = a.inventory_locations as { name?: string } | null;
                return (
                  <tr key={a.id as string} className="border-t">
                    <td className="px-3 py-2.5">{fmtDate(a.business_date as string)}</td>
                    <td className="px-3 py-2.5">{loc?.name ?? "All locations"}</td>
                    <td className="px-3 py-2.5 uppercase text-xs">{a.status as string}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {(a.notes as string) ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {a.posted_at
                        ? String(a.posted_at).slice(0, 16).replace("T", " ")
                        : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </DeskListShell>
  );
}
