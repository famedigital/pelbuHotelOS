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
  ...PAGE_SEO.meeting,
  path: "/meeting",
});

export const dynamic = "force-dynamic";

export default async function MeetingPage() {
  const [offerings, page] = await Promise.all([
    loadServiceOfferings(["meeting"]),
    loadCmsPage("meeting"),
  ]);
  const maxCapacity = Math.max(
    0,
    ...offerings.map((offering) => offering.capacity ?? 0),
  );

  const title =
    page?.title ??
    (maxCapacity > 0
      ? `A focused room for up to ${maxCapacity}.`
      : "A focused room, set for your session.");
  const description =
    page?.body ??
    "Choose a layout, date, duration, and group size. Add catering or room requirements in one enquiry; the team confirms the complete setup.";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Meeting", path: "/meeting" },
            ]),
            serviceJsonLd({
              name: "Meeting hall at Pelbu Suites",
              path: "/meeting",
              description,
              serviceType: "Meeting room",
            }),
          ]),
        }}
      />
      <EngineShell
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Meeting" },
        ]}
        eyebrow={page?.eyebrow ?? "Meet at Pelbu"}
        title={title}
        description={description}
        actions={
          <Button asChild variant="outline">
            <a href="/book">Rooms for delegates</a>
          </Button>
        }
      >
        <div className="space-y-8">
          <CmsContentSections sections={page?.sections_json} />
          <ServiceRequestForm kind="meeting" offerings={offerings} />
        </div>
      </EngineShell>
    </>
  );
}

