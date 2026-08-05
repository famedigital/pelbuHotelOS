import { CmsPageEditor } from "@/components/erp/cms/CmsPageEditor";
import { DeskPageTitle } from "@/components/erp/DeskShell";
import { Button } from "@/components/ui/button";
import { loadCmsAdminPage } from "@/lib/cms-admin";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Edit public page | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FrontPublicPageEditor({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { slug } = await params;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const page = await loadCmsAdminPage(admin, propertyId, slug);
  if (!page) notFound();

  return (
    <div className="erp mx-auto w-full max-w-[1040px] space-y-6 p-4 md:p-6">
      <DeskPageTitle
        eyebrow="Front Public · Pages"
        title={page.draft.title}
        description={
          slug === "home"
            ? "Stay landing copy, CTAs, SEO — and Hero colours (photo scrim + type). Draft stays private until Publish."
            : `Edit /${slug}. Draft changes stay private until Publish is pressed.`
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/erp/front-public">
              <ArrowLeftIcon className="size-4" />
              All pages
            </Link>
          </Button>
        }
      />
      <CmsPageEditor page={page} />
    </div>
  );
}
