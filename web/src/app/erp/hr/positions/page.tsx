import {
  PositionCreateForm,
  PositionEditForm,
  PositionTemplateUploadForm,
  PositionTemplatesList,
  type PositionRow,
  type TemplateRow,
} from "@/components/erp/PositionForms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { mergeDepartmentOptions } from "@/lib/hr/departments";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Positions & TOR | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpHrPositionsPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const [
    { data: positionRows },
    { data: templateRows },
    { data: staffDepartments },
  ] = await Promise.all([
    admin
      .from("hr_job_positions")
      .select(
        "id, title, department, employment_type_default, tor_summary, tor_body, publish_tor_public, is_active, updated_at",
      )
      .eq("property_id", propertyId)
      .order("department")
      .order("title")
      .limit(200),
    admin
      .from("hr_position_templates")
      .select(
        "id, position_id, template_kind, title, cloudinary_public_id, resource_type, is_public",
      )
      .eq("property_id", propertyId)
      .order("sort_order")
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("staff_members")
      .select("department")
      .eq("property_id", propertyId)
      .not("department", "is", null)
      .limit(500),
  ]);

  const templateCounts = new Map<string, number>();
  const templatesByPosition = new Map<string, TemplateRow[]>();
  for (const row of templateRows ?? []) {
    const positionId = row.position_id as string;
    templateCounts.set(positionId, (templateCounts.get(positionId) ?? 0) + 1);
    const list = templatesByPosition.get(positionId) ?? [];
    list.push({
      id: row.id as string,
      positionId,
      templateKind: row.template_kind as string,
      title: row.title as string,
      cloudinaryPublicId: row.cloudinary_public_id as string,
      resourceType: (row.resource_type as string) ?? "raw",
      isPublic: Boolean(row.is_public),
    });
    templatesByPosition.set(positionId, list);
  }

  const positions: PositionRow[] = (positionRows ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    department: row.department as string,
    employmentTypeDefault: row.employment_type_default as string,
    torSummary: (row.tor_summary as string | null) ?? null,
    torBody: (row.tor_body as string | null) ?? null,
    publishTorPublic: Boolean(row.publish_tor_public),
    isActive: Boolean(row.is_active),
    templateCount: templateCounts.get(row.id as string) ?? 0,
  }));

  const departments = mergeDepartmentOptions(
    (staffDepartments ?? [])
      .map((r) => r.department as string | null)
      .filter((d): d is string => Boolean(d?.trim())),
    positions.map((p) => p.department),
  );

  return (
    <div className="erp mx-auto w-full max-w-[1100px] space-y-8 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            HR · Positions
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Roles, TOR & templates
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Define each hotel role once: Terms of Reference and position-wise
            files (TOR PDF, forms, checklists). Vacancies pull from this catalog.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/erp/hr/vacancies">Vacancies →</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/erp/hr">← Staff</Link>
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>New position</CardTitle>
          <CardDescription>
            Title + department + TOR. Upload PDFs after creating the role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PositionCreateForm departments={departments} />
        </CardContent>
      </Card>

      <section className="space-y-4" aria-label="Position catalog">
        <h2 className="text-lg font-semibold">
          Catalog{" "}
          <span className="text-muted-foreground font-normal">
            ({positions.length})
          </span>
        </h2>
        {positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No positions yet. Create Waiter, Room attendant, Night auditor, etc.
          </p>
        ) : (
          <ul className="space-y-4">
            {positions.map((position) => (
              <li key={position.id}>
                <Card>
                  <CardHeader className="gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-xl">{position.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {position.department} ·{" "}
                          {position.employmentTypeDefault.replace(/_/g, " ")}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={position.isActive ? "default" : "secondary"}>
                          {position.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {position.publishTorPublic ? (
                          <Badge variant="outline">TOR public</Badge>
                        ) : null}
                        <Badge variant="outline">
                          {position.templateCount} file
                          {position.templateCount === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {position.torSummary || position.torBody ? (
                      <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          TOR preview
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                          {(position.torSummary || position.torBody || "").slice(
                            0,
                            400,
                          )}
                          {(position.torSummary || position.torBody || "").length >
                          400
                            ? "…"
                            : ""}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        No TOR text yet — edit below or upload a TOR PDF.
                      </p>
                    )}

                    <div>
                      <h3 className="mb-2 text-sm font-semibold">Edit position</h3>
                      <PositionEditForm
                        position={position}
                        departments={departments}
                      />
                    </div>

                    <div>
                      <h3 className="mb-2 text-sm font-semibold">
                        Position templates
                      </h3>
                      <PositionTemplatesList
                        positionId={position.id}
                        templates={templatesByPosition.get(position.id) ?? []}
                      />
                      <div className="mt-3">
                        <PositionTemplateUploadForm positionId={position.id} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
