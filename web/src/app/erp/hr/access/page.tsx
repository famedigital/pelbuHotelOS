import { StaffModuleAccessMatrix } from "@/components/erp/StaffModuleAccessMatrix";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDeskRole, isDeskAuthenticated } from "@/lib/desk-auth";
import { canEditDeskModuleAccess } from "@/lib/erp/desk-modules";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Module access",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpHrAccessPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const deskRole = await getDeskRole();
  const canEdit = canEditDeskModuleAccess(deskRole);

  const { data: rows } = await admin
    .from("staff_members")
    .select(
      "id, employee_code, full_name, desk_role, access_level, can_access_desk, desk_module_keys, status",
    )
    .eq("property_id", propertyId)
    .eq("can_access_desk", true)
    .in("status", ["active", "on_leave", "provisional"])
    .order("full_name")
    .limit(300);

  const staff = (rows ?? []).map((r) => {
    const raw = r.desk_module_keys as string[] | null | undefined;
    return {
      id: r.id as string,
      employeeCode: r.employee_code as string,
      fullName: r.full_name as string,
      deskRole: (r.desk_role as string | null) ?? null,
      deskModuleKeys:
        Array.isArray(raw) && raw.length > 0 ? raw.map(String) : null,
      isOwner:
        (r.desk_role as string | null) === "owner" ||
        (r.access_level as string) === "owner",
    };
  });

  return (
    <div className="erp mx-auto w-full max-w-[1100px] space-y-8 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            HR · Access
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Module access
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Grant each desk staffer modules or individual screens. Example:
            full Money, but not Team › Payroll so salary stays private. Owner
            and GM always see every screen. Shared DESK_PIN sessions act as GM.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/erp/hr">← Staff directory</Link>
        </Button>
      </header>

      {!canEdit ? (
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
          role="status"
        >
          View only — only Owner or Manager (GM) can change module access.
          Ask a duty manager if you need a different path for a team member.
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          You can edit grants. Money mutations still follow desk role
          (`requireMoneyDesk`) even if Money is visible.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Desk-capable staff</CardTitle>
          <CardDescription>
            Only staff with hotel desk enabled appear here. Leave &quot;Role
            defaults&quot; on unless they need a custom mix of modules and
            screens (e.g. hide payroll).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StaffModuleAccessMatrix staff={staff} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
