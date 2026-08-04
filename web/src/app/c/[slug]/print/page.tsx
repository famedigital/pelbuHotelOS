import { notFound } from "next/navigation";
import { DocPrintControls } from "@/components/erp/DocPrintControls";
import { CatalogueView } from "@/components/marketing/CatalogueView";
import {
  loadPublishedCatalogueBySlug,
  resolveCatalogueContent,
} from "@/lib/marketing/catalogue";
import { catalogueShareUrl } from "@/lib/marketing/catalogue-share";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Catalogue print",
};

type Props = { params: Promise<{ slug: string }> };

export default async function CataloguePrintPage({ params }: Props) {
  const { slug } = await params;
  const admin = createSupabaseAdminClient();
  const row = await loadPublishedCatalogueBySlug(admin, slug);
  if (!row) notFound();
  const content = await resolveCatalogueContent(admin, row);
  const shareUrl = catalogueShareUrl(
    row.slug,
    row.audience === "agents" ? "agent" : "copy",
  );

  return (
    <div className="min-h-dvh bg-white text-zinc-900">
      <div className="print:hidden flex justify-end gap-2 p-4">
        <DocPrintControls defaultSize="a4" printLabel="Print / Save PDF" />
      </div>
      <CatalogueView content={content} shareUrl={shareUrl} mode="print" />
    </div>
  );
}
