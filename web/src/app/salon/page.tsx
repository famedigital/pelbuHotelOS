import { CmsContentSections } from "@/components/site/CmsContentSections";
import { EngineShell } from "@/components/site/EngineShell";
import { Button } from "@/components/ui/button";
import { loadCmsPage } from "@/lib/cms";
import {
  breadcrumbJsonLd,
  serializeJsonLd,
  serviceJsonLd,
} from "@/lib/structured-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadCmsPage("salon");
  return {
    title: page?.seo_title ?? "Salon | Pelbu Suites",
    description:
      page?.meta_description ??
      "Ask about hair, nail, beauty, and personal-care appointments at Pelbu Suites in Thimphu.",
    alternates: { canonical: "/salon" },
  };
}

export default async function SalonPage() {
  const page = await loadCmsPage("salon");
  const description =
    page?.body ??
    "Ask the Pelbu Suites desk about currently available hair, nail, beauty, and personal-care appointments.";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Salon", path: "/salon" },
            ]),
            serviceJsonLd({
              name: "Salon at Pelbu Suites",
              path: "/salon",
              description,
              serviceType: "Beauty salon",
            }),
          ]),
        }}
      />
      <EngineShell
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Salon" },
        ]}
        eyebrow={page?.eyebrow ?? "Salon"}
        title={page?.title ?? "Personal care in a comfortable hotel setting."}
        description={description}
        actions={
          <>
            <Button asChild variant="citrus">
              <a href={page?.primary_cta_href ?? "/contact"}>
                {page?.primary_cta_label ?? "Ask about an appointment"}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={page?.secondary_cta_href ?? "/book"}>
                {page?.secondary_cta_label ?? "Add a stay"}
              </a>
            </Button>
          </>
        }
      >
        <CmsContentSections sections={page?.sections_json} />
      </EngineShell>
    </>
  );
}
