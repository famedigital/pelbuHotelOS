import { DeskPageTitle } from "@/components/erp/DeskShell";
import { ErpMediaPhoneUpload } from "@/components/erp/cms/ErpMediaPhoneUpload";
import { Button } from "@/components/ui/button";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ArrowLeftIcon, MonitorIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Phone media upload | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FrontPublicMediaUploadPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const params = (await searchParams) ?? {};
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const { data: pages, error } = await admin
    .from("cms_pages")
    .select("slug")
    .eq("property_id", propertyId)
    .order("slug");
  if (error) throw new Error(error.message);

  const pageSlugs = (pages ?? []).map((page) => page.slug as string);

  return (
    <div className="erp mx-auto w-full max-w-[720px] space-y-5 p-4 pb-16 md:p-6">
      <DeskPageTitle
        eyebrow="Website CMS"
        title="Phone upload"
        description="Shoot high-resolution photos or video on this phone. Files upload directly to Cloudinary, then attach to a public page. Use desktop Media library to browse and arrange."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/erp/front-public/media">
                <MonitorIcon className="size-4" />
                Desktop library
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/erp/front-public">
                <ArrowLeftIcon className="size-4" />
                CMS
              </Link>
            </Button>
          </div>
        }
      />

      <ErpMediaPhoneUpload
        pageSlugs={pageSlugs}
        defaultPageSlug={params.page ?? "home"}
      />
    </div>
  );
}
