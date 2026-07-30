import { ServiceRequestForm } from "@/components/services/ServiceRequestForm";
import { CmsContentSections } from "@/components/site/CmsContentSections";
import { EngineShell } from "@/components/site/EngineShell";
import { Button } from "@/components/ui/button";
import { loadCmsPage } from "@/lib/cms";
import { loadServiceOfferings } from "@/lib/service-offerings";

export const metadata = {
  title: "Meeting Hall | Pelbu Suites",
  description:
    "A focused meeting hall for up to 25 people at Pelbu Suites, Olakha Thimphu — with cafe catering on request.",
  alternates: { canonical: "/meeting" },
};

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

  return (
    <EngineShell
      eyebrow={page?.eyebrow ?? "Meet at Pelbu"}
      title={
        page?.title ??
        (maxCapacity > 0
          ? `A focused room for up to ${maxCapacity}.`
          : "A focused room, set for your session.")
      }
      description={
        page?.body ??
        "Choose a layout, date, duration, and group size. Add catering or room requirements in one enquiry; the team confirms the complete setup."
      }
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
  );
}
