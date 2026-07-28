import {
  StaffLeaveForm,
  StaffMemberForm,
  StaffShiftForm,
  type StaffOption,
} from "@/components/erp/OpsForms";
import { DeskHeader } from "@/components/erp/DeskHeader";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "HR | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpHrPage() {
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
        <DeskHeader title="HR" />
        <main className="mx-auto max-w-[1200px] px-6 py-10">
          <p className="text-sm text-maroon">Property not configured.</p>
        </main>
      </div>
    );
  }

  const [{ data: staffRows }, { data: shifts }, { data: leave }] = await Promise.all([
    admin
      .from("staff_members")
      .select("id, full_name, role_label, phone, status, hired_on")
      .eq("property_id", propertyId)
      .order("full_name")
      .limit(100),
    admin
      .from("staff_shifts")
      .select("id, shift_date, starts_at, ends_at, outlet, staff_id, staff_members(full_name)")
      .eq("property_id", propertyId)
      .order("shift_date", { ascending: false })
      .limit(30),
    admin
      .from("staff_leave")
      .select("id, leave_type, starts_on, ends_on, status, staff_id, staff_members(full_name)")
      .eq("property_id", propertyId)
      .order("starts_on", { ascending: false })
      .limit(30),
  ]);

  const staff: StaffOption[] = (staffRows ?? []).map((s) => ({
    id: s.id as string,
    full_name: s.full_name as string,
    role_label: s.role_label as string,
  }));

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title="HR" />
      <main className="mx-auto max-w-[1200px] space-y-12 px-6 py-10 md:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <StaffMemberForm />
          <StaffShiftForm staff={staff} />
          <StaffLeaveForm staff={staff} />
        </div>

        <section>
          <div className="border-b border-espresso/15 pb-2">
            <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
              Staff roster
            </h2>
          </div>
          {(staffRows ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-muted">No staff yet — add the first name above.</p>
          ) : (
            <ul className="mt-2">
              {(staffRows ?? []).map((s) => (
                <li
                  key={s.id as string}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-espresso/10 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-espresso">{s.full_name as string}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {s.role_label as string}
                      {s.phone ? ` · ${s.phone as string}` : ""}
                    </p>
                  </div>
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {s.status as string}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-10 lg:grid-cols-2">
          <section>
            <div className="border-b border-espresso/15 pb-2">
              <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
                Recent shifts
              </h2>
            </div>
            {(shifts ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-muted">No shifts scheduled.</p>
            ) : (
              <ul className="mt-2">
                {(shifts ?? []).map((row) => {
                  const name =
                    (row.staff_members as { full_name?: string } | null)?.full_name ?? "—";
                  return (
                    <li
                      key={row.id as string}
                      className="border-b border-espresso/10 py-3 text-sm"
                    >
                      <p className="font-medium text-espresso">
                        {row.shift_date as string} · {name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {String(row.starts_at).slice(0, 5)}–{String(row.ends_at).slice(0, 5)}
                        {row.outlet ? ` · ${row.outlet as string}` : ""}
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
                Leave
              </h2>
            </div>
            {(leave ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-muted">No leave recorded.</p>
            ) : (
              <ul className="mt-2">
                {(leave ?? []).map((row) => {
                  const name =
                    (row.staff_members as { full_name?: string } | null)?.full_name ?? "—";
                  return (
                    <li
                      key={row.id as string}
                      className="border-b border-espresso/10 py-3 text-sm"
                    >
                      <p className="font-medium text-espresso">
                        {name} · {row.leave_type as string}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {row.starts_on as string} → {row.ends_on as string} ·{" "}
                        {row.status as string}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
