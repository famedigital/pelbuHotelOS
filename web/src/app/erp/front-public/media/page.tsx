import { DeskPageTitle } from "@/components/erp/DeskShell";
import { CmsMediaManager } from "@/components/erp/cms/CmsMediaManager";
import { Button } from "@/components/ui/button";
import { loadCmsMediaGroups } from "@/lib/cms-media-admin";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ArrowLeftIcon, SmartphoneIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Media library | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FrontPublicMediaPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const groups = await loadCmsMediaGroups(admin, propertyId);

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      <DeskPageTitle
        eyebrow="Website CMS"
        title="Media library"
        description="Photos and video for each public page. Hero media runs in the page banner, gallery items fill the strips, and the order here is the order guests see. Shoot from a phone, arrange on desktop."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="citrus">
              <Link href="/erp/front-public/media/upload">
                <SmartphoneIcon className="size-4" />
                Phone upload
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/erp/front-public">
                <ArrowLeftIcon className="size-4" />
                Back to CMS
              </Link>
            </Button>
          </div>
        }
      />

      <CmsMediaManager groups={groups} />
    </div>
  );
}
