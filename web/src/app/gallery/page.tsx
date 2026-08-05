import { MediaGallery } from "@/components/media/MediaGallery";
import { CmsContentSections } from "@/components/site/CmsContentSections";
import { EngineShell } from "@/components/site/EngineShell";
import { Button } from "@/components/ui/button";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
import {
  breadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadCmsPage("gallery");
  return {
    title: page?.seo_title ?? "Photo Gallery | Pelbu Suites",
    description:
      page?.meta_description ??
      "View official photographs of rooms, suites, and shared spaces at Pelbu Suites in Olakha, Thimphu.",
    alternates: { canonical: "/gallery" },
  };
}

export default async function GalleryPage() {
  const [page, gallery] = await Promise.all([
    loadCmsPage("gallery"),
    loadCmsGallery("gallery", 1400),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Gallery", path: "/gallery" },
            ]),
          ),
        }}
      />
      <EngineShell
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Gallery" },
        ]}
        eyebrow={page?.eyebrow ?? "Photo gallery"}
        title={page?.title ?? "See Pelbu Suites before you arrive."}
        description={
          page?.body ??
          "Browse rooms, suites, interiors, and shared spaces from the hotel formerly known as Seven Suites."
        }
        actions={
          <>
            <Button asChild variant="citrus">
              <a href={page?.primary_cta_href ?? "/rooms"}>
                {page?.primary_cta_label ?? "Explore rooms"}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={page?.secondary_cta_href ?? "/book"}>
                {page?.secondary_cta_label ?? "Check availability"}
              </a>
            </Button>
          </>
        }
      >
        <div className="space-y-10">
          <CmsContentSections sections={page?.sections_json} />
          <MediaGallery items={gallery} label="Pelbu Suites" />
        </div>
      </EngineShell>
    </>
  );
}
