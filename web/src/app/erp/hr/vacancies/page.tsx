import {
  ApplicationStatusForm,
  VacancyCreateForm,
  VacancyStatusButtons,
  type PositionOption,
} from "@/components/erp/VacancyForms";
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
import { fmtDate } from "@/lib/erp-lists";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Vacancies | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function moneyBand(
  min: number | null,
  max: number | null,
  note: string | null,
): string | null {
  if (min == null && max == null) return note;
  const fmt = (n: number) =>
    n.toLocaleString("en-BT", { maximumFractionDigits: 0 });
  let band: string;
  if (min != null && max != null) band = `Nu ${fmt(min)}–${fmt(max)}`;
  else if (min != null) band = `From Nu ${fmt(min)}`;
  else band = `Up to Nu ${fmt(max!)}`;
  return note ? `${band} (${note})` : band;
}

export default async function ErpHrVacanciesPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const [
    { data: positionRows },
    { data: vacancyRows },
    { data: applicationRows },
  ] = await Promise.all([
    admin
      .from("hr_job_positions")
      .select("id, title, department, is_active")
      .eq("property_id", propertyId)
      .order("title")
      .limit(200),
    admin
      .from("hr_job_vacancies")
      .select(
        "id, position_id, headcount, status, publish_public, salary_min_btn, salary_max_btn, salary_note, show_salary_public, posting_note, opens_on, closes_on, created_at, hr_job_positions(title, department, tor_summary)",
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("hr_vacancy_applications")
      .select(
        "id, vacancy_id, full_name, phone, email, message, status, created_at",
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const positions: PositionOption[] = (positionRows ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    department: row.department as string,
    isActive: Boolean(row.is_active),
  }));

  const appsByVacancy = new Map<
    string,
    {
      id: string;
      fullName: string;
      phone: string;
      email: string | null;
      message: string | null;
      status: string;
      createdAt: string;
    }[]
  >();
  for (const row of applicationRows ?? []) {
    const vacancyId = row.vacancy_id as string;
    const list = appsByVacancy.get(vacancyId) ?? [];
    list.push({
      id: row.id as string,
      fullName: row.full_name as string,
      phone: row.phone as string,
      email: (row.email as string | null) ?? null,
      message: (row.message as string | null) ?? null,
      status: row.status as string,
      createdAt: row.created_at as string,
    });
    appsByVacancy.set(vacancyId, list);
  }

  const openCount = (vacancyRows ?? []).filter((v) => v.status === "open").length;
  const newApps = (applicationRows ?? []).filter((a) => a.status === "new")
    .length;

  return (
    <div className="erp mx-auto w-full max-w-[1100px] space-y-8 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            HR · Vacancies
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Open roles & applications
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            How many heads you need for each position. Publish to the public
            careers page; interest forms land in the inbox below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/erp/hr/positions">Positions & TOR</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/careers" target="_blank">
              View /careers
            </Link>
          </Button>
        </div>
      </header>

      <section
        className="grid gap-4 sm:grid-cols-2"
        aria-label="Vacancy overview"
      >
        <Card className="gap-2 py-5">
          <CardContent>
            <p className="text-sm text-muted-foreground">Open vacancies</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{openCount}</p>
          </CardContent>
        </Card>
        <Card className="gap-2 py-5">
          <CardContent>
            <p className="text-sm text-muted-foreground">New applications</p>
            <p
              className={`mt-1 text-3xl font-semibold tabular-nums ${
                newApps > 0 ? "text-accent" : ""
              }`}
            >
              {newApps}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>New vacancy</CardTitle>
          <CardDescription>
            Pick a catalog position, heads needed, optional salary band.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VacancyCreateForm positions={positions} />
        </CardContent>
      </Card>

      <section className="space-y-4" aria-label="Vacancy list">
        <h2 className="text-lg font-semibold">
          All vacancies{" "}
          <span className="font-normal text-muted-foreground">
            ({(vacancyRows ?? []).length})
          </span>
        </h2>
        {(vacancyRows ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No vacancies yet. Open one after you have positions.
          </p>
        ) : (
          <ul className="space-y-4">
            {(vacancyRows ?? []).map((row) => {
              const pos = row.hr_job_positions as {
                title?: string;
                department?: string;
                tor_summary?: string | null;
              } | null;
              const title = pos?.title ?? "Position";
              const department = pos?.department ?? "—";
              const salary = moneyBand(
                row.salary_min_btn != null ? Number(row.salary_min_btn) : null,
                row.salary_max_btn != null ? Number(row.salary_max_btn) : null,
                (row.salary_note as string | null) ?? null,
              );
              const apps = appsByVacancy.get(row.id as string) ?? [];
              return (
                <li key={row.id as string}>
                  <Card>
                    <CardHeader className="gap-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-xl">
                            {title}{" "}
                            <span className="text-base font-normal text-muted-foreground">
                              ×{row.headcount as number}
                            </span>
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {department}
                            {salary ? ` · ${salary}` : ""}
                            {row.show_salary_public
                              ? " · salary public"
                              : salary
                                ? " · salary desk-only"
                                : ""}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge
                            variant={
                              row.status === "open" ? "default" : "secondary"
                            }
                          >
                            {row.status as string}
                          </Badge>
                          {row.publish_public ? (
                            <Badge variant="outline">On /careers</Badge>
                          ) : null}
                          <Badge variant="outline">
                            {apps.length} applicant
                            {apps.length === 1 ? "" : "s"}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(row.posting_note as string | null) ? (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {row.posting_note as string}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {row.opens_on
                          ? `Opens ${fmtDate(row.opens_on as string)}`
                          : "No open date"}
                        {" · "}
                        {row.closes_on
                          ? `Closes ${fmtDate(row.closes_on as string)}`
                          : "No close date"}
                      </p>
                      <VacancyStatusButtons
                        vacancyId={row.id as string}
                        current={row.status as string}
                      />

                      <div>
                        <h3 className="mb-2 text-sm font-semibold">
                          Applications
                        </h3>
                        {apps.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No interest yet.
                          </p>
                        ) : (
                          <ul className="divide-y rounded-lg border">
                            {apps.map((app) => (
                              <li
                                key={app.id}
                                className="space-y-2 px-3 py-3 text-sm"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <p className="font-medium">{app.fullName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      <a
                                        href={`tel:${app.phone}`}
                                        className="underline-offset-2 hover:underline"
                                      >
                                        {app.phone}
                                      </a>
                                      {app.email ? ` · ${app.email}` : ""}
                                      {" · "}
                                      {fmtDate(app.createdAt.slice(0, 10))}
                                    </p>
                                  </div>
                                  <Badge variant="outline">{app.status}</Badge>
                                </div>
                                {app.message ? (
                                  <p className="text-muted-foreground whitespace-pre-wrap">
                                    {app.message}
                                  </p>
                                ) : null}
                                <ApplicationStatusForm
                                  applicationId={app.id}
                                  current={app.status}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
