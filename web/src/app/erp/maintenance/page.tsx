import {
  MaintenanceCreateForm,
  MaintenanceStatusForm,
} from "@/components/erp/P9OpsForms";
import {
  DeskListShell,
  DeskTable,
  StatusPill,
} from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDateTime } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Maintenance",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [{ data: units }, { data: staff }, { data: orders }] = await Promise.all([
    admin
      .from("room_units")
      .select("id, label")
      .eq("property_id", propertyId)
      .order("label")
      .limit(100),
    admin
      .from("staff_members")
      .select("id, full_name")
      .eq("property_id", propertyId)
      .eq("status", "active")
      .in("role_label", ["maintenance", "manager", "housekeeping"])
      .order("full_name")
      .limit(50),
    admin
      .from("maintenance_orders")
      .select(
        "id, title, description, priority, status, created_at, room_units(label), staff_members:assigned_staff_id(full_name)",
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <DeskListShell
      title="Maintenance"
      eyebrow="Work orders"
      heading="Maintenance"
      blurb="Track AC, plumbing, and other room issues until done."
    >
      <MaintenanceCreateForm
        units={(units ?? []).map((u) => ({
          id: u.id as string,
          label: u.label as string,
        }))}
        staff={(staff ?? []).map((s) => ({
          id: s.id as string,
          full_name: s.full_name as string,
        }))}
      />

      <DeskTable
        caption="Work orders"
        headers={["Issue", "Room", "Priority", "Assigned", "Status", ""]}
      >
        {(orders ?? []).length === 0 ? (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-muted-foreground">
              No work orders yet.
            </td>
          </tr>
        ) : (
          (orders ?? []).map((o) => {
            const room = o.room_units as
              | { label?: string }
              | { label?: string }[]
              | null;
            const st = o.staff_members as
              | { full_name?: string }
              | { full_name?: string }[]
              | null;
            const roomLabel = Array.isArray(room) ? room[0]?.label : room?.label;
            const staffName = Array.isArray(st) ? st[0]?.full_name : st?.full_name;
            return (
              <tr key={o.id as string} className="border-t">
                <td className="px-3 py-2.5">
                  <p className="font-medium text-foreground">{o.title as string}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDateTime(o.created_at as string)}
                    {(o.description as string)
                      ? ` · ${(o.description as string).slice(0, 80)}`
                      : ""}
                  </p>
                </td>
                <td className="px-3 py-2.5">{roomLabel ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <StatusPill value={o.priority as string} />
                </td>
                <td className="px-3 py-2.5 text-sm">{staffName ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <StatusPill value={o.status as string} />
                </td>
                <td className="px-3 py-2.5">
                  <MaintenanceStatusForm
                    id={o.id as string}
                    status={o.status as string}
                  />
                </td>
              </tr>
            );
          })
        )}
      </DeskTable>
    </DeskListShell>
  );
}
