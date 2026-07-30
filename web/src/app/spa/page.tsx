import { ServiceRequestForm } from "@/components/services/ServiceRequestForm";
import { CmsContentSections } from "@/components/site/CmsContentSections";
import { EngineShell } from "@/components/site/EngineShell";
import { Button } from "@/components/ui/button";
import { loadCmsPage } from "@/lib/cms";
import { loadServiceOfferings } from "@/lib/service-offerings";

export const metadata = {
  title: "Spa & Steam | Pelbu Suites",
  description:
    "Book a spa treatment or steam session at Pelbu Suites, Olakha Thimphu — open to hotel guests and day visitors.",
  alternates: { canonical: "/spa" },
};

export const dynamic = "force-dynamic";

export default async function SpaPage() {
  const [offerings, page] = await Promise.all([
    loadServiceOfferings(["spa", "steam"]),
    loadCmsPage("spa"),
  ]);

  return (
    <EngineShell
      eyebrow={page?.eyebrow ?? "Spa & steam"}
      title={page?.title ?? "Choose how you want to recover."}
      description={
        page?.body ??
        "Select an experience and a preferred time. We confirm therapist and room availability before the slot is final."
      }
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
  );
}
