import { ServiceRequestForm } from "@/components/services/ServiceRequestForm";
import { CmsContentSections } from "@/components/site/CmsContentSections";
import { EngineShell } from "@/components/site/EngineShell";
import { Button } from "@/components/ui/button";
import { loadCmsPage } from "@/lib/cms";
import { loadServiceOfferings } from "@/lib/service-offerings";
import {
  breadcrumbJsonLd,
  serializeJsonLd,
  serviceJsonLd,
} from "@/lib/structured-data";

import { PAGE_SEO, buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  ...PAGE_SEO.spa,
  path: "/spa",
});

export const dynamic = "force-dynamic";

export default async function SpaPage() {
  const [offerings, page] = await Promise.all([
    loadServiceOfferings(["spa", "steam"]),
    loadCmsPage("spa"),
  ]);

  const title = page?.title ?? "Choose how you want to recover.";
  const description =
    page?.body ??
    "Select an experience and a preferred time. We confirm therapist and room availability before the slot is final.";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Spa & steam", path: "/spa" },
            ]),
            serviceJsonLd({
              name: "Spa & steam at Pelbu Suites",
              path: "/spa",
              description,
              serviceType: "Spa",
            }),
          ]),
        }}
      />
      <EngineShell
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Spa & steam" },
        ]}
        eyebrow={page?.eyebrow ?? "Spa & steam"}
        title={title}
        description={description}
        actions={
          <Button asChild variant="outline">
            <a href="/book">Add a stay</a>
          </Button>
        }
      >
        <div className="space-y-8">
          <CmsContentSections sections={page?.sections_json} />
          <ServiceRequestForm kind="spa" offerings={offerings} />
        </div>
      </EngineShell>
    </>
  );
}
