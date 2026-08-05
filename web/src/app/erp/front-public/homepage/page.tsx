import { HomepageStoryEditor } from "@/components/erp/cms/HomepageStoryEditor";
import { DeskPageTitle } from "@/components/erp/DeskShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadHomepageStoryAdmin } from "@/lib/home-story";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Homepage story | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function HomepageStoryPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const propertyId = await requireDeskPropertyId();
  const adminStory = await loadHomepageStoryAdmin(propertyId);
  if (!adminStory) {
    return (
      <div className="erp p-6">
        <p className="text-destructive">Could not load homepage story.</p>
      </div>
    );
  }

  return (
    <div className="erp mx-auto w-full max-w-[960px] space-y-6 p-4 md:p-6">
      <DeskPageTitle
        eyebrow="Website CMS"
        title="Homepage story"
        description="Edit About, Rooms, Restaurant, lunch package, Cafe, and Spa bands on the public homepage. Save a draft, then publish when ready."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                adminStory.has_unpublished_changes ? "citrus" : "mint"
              }
            >
              {adminStory.has_unpublished_changes ? "Draft" : "Live"}
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link href="/erp/front-public">CMS hub</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/" target="_blank">
                View site
                <ExternalLinkIcon className="size-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <HomepageStoryEditor
        story={adminStory.draft}
        hasUnpublishedChanges={adminStory.has_unpublished_changes}
      />
    </div>
  );
}
