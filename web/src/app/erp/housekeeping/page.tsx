import {
  HkAssignForm,
  HkStatusForm,
} from "@/components/erp/P9OpsForms";
import {
  DeskListShell,
  DeskTable,
  StatusPill,
} from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate, requireDeskPropertyId, thimphuToday } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Housekeeping | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function HousekeepingPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();

  const [{ data: units }, { data: staff }, { data: assignments }] =
    await Promise.all([
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
        .in("role_label", ["housekeeping", "manager", "front_desk"])
        .order("full_name")
        .limit(50),
      admin
        .from("hk_assignments")
        .select(
          "id, business_date, status, notes, due_at, room_units(label), staff_members(full_name)",
        )
        .eq("property_id", propertyId)
        .eq("business_date", today)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  return (
    <DeskListShell
      title="HK"
      eyebrow="Housekeeping"
      heading={`Assignments Â· ${fmtDate(today)}`}
      blurb="Assign dirty rooms to housekeeping staff. Room status board remains on Rooms."
    >
      <HkAssignForm
        today={today}
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
        caption="Today's assignments"
        headers={["Room", "Staff", "Status", "Notes", ""]}
      >
        {(assignments ?? []).length === 0 ? (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-muted-foreground">
              No assignments for today.
            </td>
          </tr>
        ) : (
          (assignments ?? []).map((a) => {
            const room = a.room_units as
              | { label?: string }
              | { label?: string }[]
              | null;
            const st = a.staff_members as
              | { full_name?: string }
              | { full_name?: string }[]
              | null;
            const roomLabel = Array.isArray(room) ? room[0]?.label : room?.label;
            const staffName = Array.isArray(st) ? st[0]?.full_name : st?.full_name;
            return (
              <tr key={a.id as string} className="border-t border-espresso/10">
                <td className="px-3 py-2.5 font-medium">{roomLabel ?? "—"}</td>
                <td className="px-3 py-2.5">{staffName ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <StatusPill value={a.status as string} />
                </td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground">
                  {(a.notes as string) ?? "—"}
                </td>
                <td className="px-3 py-2.5">
                  <HkStatusForm id={a.id as string} status={a.status as string} />
                </td>
              </tr>
            );
          })
        )}
      </DeskTable>
    </DeskListShell>
  );
}
