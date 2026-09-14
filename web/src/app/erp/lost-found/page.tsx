import {
  LostFoundCreateForm,
  LostFoundStatusForm,
} from "@/components/erp/HkLostFoundForms";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Lost & found | Hotel OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function LostFoundPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [{ data: units }, { data: staff }, { data: items }] = await Promise.all([
    admin
      .from("room_units")
      .select("id, label")
      .eq("property_id", propertyId)
      .order("label")
      .limit(120),
    admin
      .from("staff_members")
      .select("id, full_name")
      .eq("property_id", propertyId)
      .eq("status", "active")
      .in("role_label", ["housekeeping", "manager", "front_desk"])
      .order("full_name")
      .limit(50),
    admin
      .from("lost_found_items")
      .select(
        "id, description, status, found_at, guest_name, guest_contact, room_units(label), staff_members(full_name)",
      )
      .eq("property_id", propertyId)
      .order("found_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <DeskListShell
      eyebrow="Housekeeping"
      heading="Lost & found"
      blurb="Log items found in rooms or public areas. Link to HK staff who discovered them."
    >
      <LostFoundCreateForm
        units={(units ?? []).map((u) => ({
          id: u.id as string,
          label: u.label as string,
        }))}
        staff={(staff ?? []).map((s) => ({
          id: s.id as string,
          full_name: s.full_name as string,
        }))}
      />

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="min-w-[640px] w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {["Found", "Item", "Room", "Staff", "Guest", "Status", ""].map((h) => (
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
            {(items ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-muted-foreground">
                  No items logged yet.
                </td>
              </tr>
            ) : (
              (items ?? []).map((row) => {
                const room = row.room_units as
                  | { label?: string }
                  | { label?: string }[]
                  | null;
                const st = row.staff_members as
                  | { full_name?: string }
                  | { full_name?: string }[]
                  | null;
                return (
                  <tr key={row.id as string} className="border-t">
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {fmtDate(String(row.found_at).slice(0, 10))}
                    </td>
                    <td className="px-3 py-2.5 font-medium">{row.description as string}</td>
                    <td className="px-3 py-2.5">
                      {(Array.isArray(room) ? room[0]?.label : room?.label) ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {(Array.isArray(st) ? st[0]?.full_name : st?.full_name) ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {[row.guest_name, row.guest_contact]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-2.5 uppercase text-xs">{row.status as string}</td>
                    <td className="px-3 py-2.5">
                      <LostFoundStatusForm
                        id={row.id as string}
                        status={row.status as string}
                      />
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
