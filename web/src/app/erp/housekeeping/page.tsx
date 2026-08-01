import { HkAssignForm, HkStatusForm } from "@/components/erp/P9OpsForms";
import { HkChecklistForm } from "@/components/erp/HkLostFoundForms";
import { HkStaffAssignForm } from "@/components/erp/HkStaffAssignForm";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { DeskListShell } from "@/components/erp/DeskListShell";
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
          `id, business_date, status, notes, due_at, staff_id,
           checklist_clean_ok, checklist_linen_ok, checklist_amenities_ok,
           room_units(label), staff_members(full_name)`,
        )
        .eq("property_id", propertyId)
        .eq("business_date", today)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  return (
    <DeskListShell
      eyebrow="Housekeeping"
      heading={`Assignments · ${fmtDate(today)}`}
      blurb="Assign dirty rooms to housekeeping staff. Complete the turnover checklist before marking clean — amenities deduct from stock."
      headerAside={<FrontDeskLiveRefresh />}
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

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="min-w-[640px] w-full text-sm">
          <caption className="sr-only">Today&apos;s assignments</caption>
          <thead className="bg-muted/40">
            <tr className="hover:bg-transparent">
              {["Room", "Staff", "Status", "Notes", "Checklist", ""].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="h-10 px-3 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(assignments ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-muted-foreground">
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
                const statusValue = a.status as string;
                const tone =
                  statusValue === "done"
                    ? "border-citrus/40 bg-citrus-tint/60 text-citrus"
                    : statusValue === "open" || statusValue === "in_progress"
                      ? "border-destructive/30 bg-destructive/5 text-destructive"
                      : "border-border bg-muted text-muted-foreground";
                return (
                  <tr key={a.id as string} className="border-t align-top">
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      {roomLabel ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-foreground">
                      <HkStaffAssignForm
                        assignmentId={a.id as string}
                        staffId={(a.staff_id as string | null) ?? null}
                        staff={(staff ?? []).map((s) => ({
                          id: s.id as string,
                          full_name: s.full_name as string,
                        }))}
                        status={statusValue}
                      />
                      {staffName && statusValue === "done" ? (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {staffName}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap ${tone}`}
                      >
                        {statusValue}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">
                      {(a.notes as string) ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <HkChecklistForm
                        id={a.id as string}
                        cleanOk={Boolean(a.checklist_clean_ok)}
                        linenOk={Boolean(a.checklist_linen_ok)}
                        amenitiesOk={Boolean(a.checklist_amenities_ok)}
                        status={statusValue}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <HkStatusForm id={a.id as string} status={statusValue} />
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
