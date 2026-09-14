import { CareersInterestForm } from "@/components/careers/CareersInterestForm";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PublicSiteHeader } from "@/components/site/PublicSiteHeader";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { Button } from "@/components/ui/button";
import { cloudinaryOriginalUrl, cloudinaryUrl } from "@/lib/cloudinary";
import { loadPublicPropertyProfile } from "@/lib/public-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";
import {
  breadcrumbJsonLd,
  jobPostingJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Careers | Pelbu Suites",
    description:
      "Join the team at Pelbu Suites, Olakha, Thimphu — hotel, cafe, restaurant and spa roles.",
    alternates: { canonical: "/careers" },
  };
}

function formatSalary(
  min: number | null,
  max: number | null,
  note: string | null,
  show: boolean,
): string | null {
  if (!show) return null;
  if (min == null && max == null) return note;
  const fmt = (n: number) =>
    `Nu ${n.toLocaleString("en-BT", { maximumFractionDigits: 0 })}`;
  let band: string;
  if (min != null && max != null) band = `${fmt(min)}–${fmt(max)} / month`;
  else if (min != null) band = `From ${fmt(min)} / month`;
  else band = `Up to ${fmt(max!)} / month`;
  return note ? `${band} · ${note}` : band;
}

function employmentLabel(type: string): string {
  return type.replace(/_/g, " ");
}

export default async function CareersPage() {
  const [property, propertyId] = await Promise.all([
    loadPublicPropertyProfile(),
    resolvePublicPropertyId(),
  ]);

  const admin = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  let openings: {
    id: string;
    headcount: number;
    salaryLine: string | null;
    postingNote: string | null;
    closesOn: string | null;
    title: string;
    department: string;
    employmentType: string;
    torSummary: string | null;
    torBody: string | null;
    publishTor: boolean;
    publicFiles: { title: string; href: string }[];
  }[] = [];

  if (propertyId) {
    const { data: vacancies } = await admin
      .from("hr_job_vacancies")
      .select(
        `
        id,
        headcount,
        salary_min_btn,
        salary_max_btn,
        salary_note,
        show_salary_public,
        posting_note,
        closes_on,
        position_id,
        hr_job_positions (
          title,
          department,
          employment_type_default,
          tor_summary,
          tor_body,
          publish_tor_public
        )
      `,
      )
      .eq("property_id", propertyId)
      .eq("status", "open")
      .eq("publish_public", true)
      .order("created_at", { ascending: false })
      .limit(50);

    const positionIds = Array.from(
      new Set(
        (vacancies ?? [])
          .map((v) => v.position_id as string)
          .filter(Boolean),
      ),
    );

    const { data: publicTemplates } =
      positionIds.length > 0
        ? await admin
            .from("hr_position_templates")
            .select(
              "position_id, title, cloudinary_public_id, resource_type, template_kind, is_public",
            )
            .eq("property_id", propertyId)
            .eq("is_public", true)
            .in("position_id", positionIds)
            .limit(200)
        : { data: [] as const };

    const filesByPosition = new Map<string, { title: string; href: string }[]>();
    for (const t of publicTemplates ?? []) {
      // Never surface offer/contract even if flag wrong
      const kind = t.template_kind as string;
      if (kind === "offer_letter" || kind === "contract") continue;
      const publicId = t.cloudinary_public_id as string;
      const href =
        (t.resource_type as string) === "image"
          ? cloudinaryUrl(publicId, { width: 1600, crop: "limit" })
          : cloudinaryOriginalUrl(publicId, "pdf") ??
            cloudinaryUrl(publicId) ??
            "#";
      if (!href || href === "#") continue;
      const list = filesByPosition.get(t.position_id as string) ?? [];
      list.push({ title: t.title as string, href });
      filesByPosition.set(t.position_id as string, list);
    }

    openings = (vacancies ?? [])
      .filter((v) => {
        const closes = v.closes_on as string | null;
        return !closes || closes >= today;
      })
      .map((v) => {
        const pos = v.hr_job_positions as {
          title?: string;
          department?: string;
          employment_type_default?: string;
          tor_summary?: string | null;
          tor_body?: string | null;
          publish_tor_public?: boolean;
        } | null;
        return {
          id: v.id as string,
          headcount: v.headcount as number,
          salaryLine: formatSalary(
            v.salary_min_btn != null ? Number(v.salary_min_btn) : null,
            v.salary_max_btn != null ? Number(v.salary_max_btn) : null,
            (v.salary_note as string | null) ?? null,
            Boolean(v.show_salary_public),
          ),
          postingNote: (v.posting_note as string | null) ?? null,
          closesOn: (v.closes_on as string | null) ?? null,
          title: pos?.title ?? "Role",
          department: pos?.department ?? "Hotel",
          employmentType: pos?.employment_type_default ?? "full_time",
          torSummary: pos?.tor_summary ?? null,
          torBody: pos?.tor_body ?? null,
          publishTor: Boolean(pos?.publish_tor_public),
          publicFiles: filesByPosition.get(v.position_id as string) ?? [],
        };
      });
  }

  const byDept = new Map<string, typeof openings>();
  for (const o of openings) {
    const list = byDept.get(o.department) ?? [];
    list.push(o);
    byDept.set(o.department, list);
  }

  const jsonLd = serializeJsonLd([
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Careers", path: "/careers" },
    ]),
    ...openings.map((o) =>
      jobPostingJsonLd({
        id: o.id,
        title: o.title,
        description:
          o.torSummary?.trim() ||
          o.postingNote?.trim() ||
          `${o.title} at Pelbu Suites, Olakha, Thimphu.`,
        employmentType: o.employmentType,
        validThrough: o.closesOn,
        department: o.department,
      }),
    ),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <PublicSiteHeader />
      <main>
        <section className="border-b border-border/60 bg-gradient-to-b from-mist-0/80 to-background">
          <div className="mx-auto max-w-[900px] px-5 py-12 md:px-8 md:py-16">
            <SiteBreadcrumbs
              items={[
                { name: "Home", path: "/" },
                { name: "Careers" },
              ]}
              className="mb-4"
            />
            <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
              Careers
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-cedar-ink md:text-5xl">
              Work at Pelbu Suites
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              Olakha, Thimphu — rooms, cafe, restaurant, bar and spa under one
              roof. Browse open roles and send a short interest note; we will
              call if there is a fit.
            </p>
            {property?.phone ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Or call the desk:{" "}
                <a
                  href={`tel:${property.phone}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {property.phone}
                </a>
              </p>
            ) : null}
          </div>
        </section>

        <section className="mx-auto max-w-[900px] space-y-10 px-5 py-10 md:px-8 md:py-14">
          {openings.length === 0 ? (
            <div className="rounded-2xl border border-dashed px-6 py-12 text-center">
              <p className="text-lg font-medium">No open roles right now</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Check back later, or leave a message via contact for general
                interest.
              </p>
              <Button asChild variant="outline" className="mt-5 min-h-11">
                <Link href="/contact">Contact desk</Link>
              </Button>
            </div>
          ) : (
            Array.from(byDept.entries()).map(([dept, roles]) => (
              <div key={dept} className="space-y-4">
                <h2 className="text-sm font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                  {dept}
                </h2>
                <ul className="space-y-6">
                  {roles.map((role) => (
                    <li
                      key={role.id}
                      className="rounded-2xl border border-border/80 bg-card px-5 py-5 md:px-6"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-xl font-semibold tracking-tight">
                          {role.title}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {employmentLabel(role.employmentType)}
                          {role.headcount > 1 ? ` · ${role.headcount} seats` : ""}
                          {role.closesOn ? ` · closes ${role.closesOn}` : ""}
                        </p>
                      </div>
                      {role.salaryLine ? (
                        <p className="mt-2 text-sm font-medium text-cedar-ink">
                          {role.salaryLine}
                        </p>
                      ) : null}
                      {role.postingNote ? (
                        <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                          {role.postingNote}
                        </p>
                      ) : null}
                      {role.publishTor && (role.torSummary || role.torBody) ? (
                        <div className="mt-4 rounded-xl bg-muted/40 px-4 py-3 text-sm">
                          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            Terms of reference
                          </p>
                          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-muted-foreground">
                            {role.torSummary || role.torBody}
                          </p>
                          {role.torSummary && role.torBody ? (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-medium text-accent">
                                Full TOR
                              </summary>
                              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                                {role.torBody}
                              </p>
                            </details>
                          ) : null}
                        </div>
                      ) : null}
                      {role.publicFiles.length > 0 ? (
                        <ul className="mt-3 flex flex-wrap gap-2">
                          {role.publicFiles.map((f) => (
                            <li key={f.href + f.title}>
                              <a
                                href={f.href}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-medium underline-offset-4 hover:underline"
                              >
                                {f.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="mt-5 border-t pt-4">
                        <p className="mb-3 text-sm font-medium">Express interest</p>
                        <CareersInterestForm vacancyId={role.id} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      </main>
      <SiteFooter profile={property} />
    </div>
  );
}
