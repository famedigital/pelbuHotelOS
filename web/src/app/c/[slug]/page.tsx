import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/erp/PrintButton";
import { CatalogueShareBar } from "@/components/marketing/CatalogueShareBar";
import {
  CatalogueSocialPack,
  CatalogueView,
} from "@/components/marketing/CatalogueView";
import {
  loadPublishedCatalogueBySlug,
  recordCatalogueView,
  resolveCatalogueContent,
} from "@/lib/marketing/catalogue";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const admin = createSupabaseAdminClient();
  const row = await loadPublishedCatalogueBySlug(admin, slug);
  if (!row) return { title: "Catalogue" };

  const content = await resolveCatalogueContent(admin, row);
  const ogImage =
    content.coverPublicId
      ? cloudinaryUrl(content.coverPublicId, {
          width: 1200,
          height: 630,
          crop: "fill",
        })
      : content.coverSrc;
  const indexable = row.audience === "public";
  const url = absoluteUrl(`/c/${row.slug}`);

  return {
    title: `${row.title} | ${SITE_NAME}`,
    description: row.intro_blurb ?? `Hotel pack from ${content.property.name}`,
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title: row.title,
      description: row.intro_blurb ?? content.property.name,
      url,
      type: "website",
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: row.title,
      description: row.intro_blurb ?? content.property.name,
      images: ogImage ? [ogImage] : undefined,
    },
    alternates: { canonical: url },
  };
}

export default async function PublicCataloguePage({ params }: Props) {
  const { slug } = await params;
  const admin = createSupabaseAdminClient();
  const row = await loadPublishedCatalogueBySlug(admin, slug);
  if (!row) notFound();

  const content = await resolveCatalogueContent(admin, row);
  await recordCatalogueView(admin, row.id).catch(() => undefined);

  const shareUrl = absoluteUrl(`/c/${row.slug}`);
  const caption =
    row.audience === "agents"
      ? row.caption_agent ?? row.caption_feed
      : row.caption_feed;

  return (
    <div className="min-h-dvh bg-background">
      <div className="print:hidden mx-auto max-w-3xl space-y-4 px-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            Catalogue
          </p>
          <div className="flex gap-2">
            <PrintButton label="Save PDF" />
            <a
              href={`/c/${row.slug}/print`}
              className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium"
            >
              Print layout
            </a>
          </div>
        </div>
        <CatalogueShareBar
          shareUrl={shareUrl}
          caption={caption}
          hashtags={row.hashtags}
          facebookUrl={content.property.facebook}
          instagramUrl={content.property.instagram}
        />
        <details className="rounded-xl border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Social image pack (IG/FB crops)
          </summary>
          <div className="mt-3">
            <CatalogueSocialPack content={content} />
          </div>
        </details>
      </div>
      <CatalogueView content={content} shareUrl={shareUrl} mode="web" />
    </div>
  );
}
