import { MediaGallery } from "@/components/media/MediaGallery";
import { TrustMediaSection } from "@/components/media/TrustFacetsGallery";
import { CmsContentSections } from "@/components/site/CmsContentSections";
import { EngineShell } from "@/components/site/EngineShell";
import { Button } from "@/components/ui/button";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
import { loadPublicRooms } from "@/lib/public-content";
import {
  loadPublicFoodMedia,
  loadPublicPropertyAreaMedia,
  loadPublicMediaByRoomTypeIds,
} from "@/lib/property-media-loader";
import { facetLabel } from "@/lib/property-media";
import {
  breadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";
import type { Metadata } from "next";
import Link from "next/link";

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
  const [page, gallery, propertyMedia, foodMedia, rooms] = await Promise.all([
    loadCmsPage("gallery"),
    loadCmsGallery("gallery", 1400),
    loadPublicPropertyAreaMedia(),
    loadPublicFoodMedia(),
    loadPublicRooms(),
  ]);

  const roomMediaMap = await loadPublicMediaByRoomTypeIds(rooms.map((r) => r.id));

  const byPropertyFacet = new Map<string, typeof propertyMedia>();
  for (const m of propertyMedia) {
    const list = byPropertyFacet.get(m.facet) ?? [];
    list.push(m);
    byPropertyFacet.set(m.facet, list);
  }

  const hasTrust =
    propertyMedia.length > 0 ||
    foodMedia.length > 0 ||
    [...roomMediaMap.values()].some((v) => v.length > 0);

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
          "Real photographs from the property — rooms, shared spaces, and meals. Not stock imagery."
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
        <div className="space-y-12">
          <CmsContentSections sections={page?.sections_json} />

          {hasTrust ? (
            <>
              {[...byPropertyFacet.entries()].map(([facet, items]) => (
                <TrustMediaSection
                  key={facet}
                  heading={facetLabel(facet)}
                  media={items}
                />
              ))}

              {rooms.map((room) => {
                const items = roomMediaMap.get(room.id) ?? [];
                if (items.length === 0) return null;
                return (
                  <section key={room.id} className="space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <h2 className="font-display text-2xl text-foreground">
                        {room.name}
                      </h2>
                      <Link
                        href={`/rooms/${room.slug}`}
                        className="text-sm font-medium text-sky-800 underline-offset-4 hover:underline"
                      >
                        Room details
                      </Link>
                    </div>
                    <TrustMediaSection heading="" media={items} />
                  </section>
                );
              })}

              <TrustMediaSection heading="Food from our kitchens" media={foodMedia} />
            </>
          ) : null}

          {!hasTrust || gallery.length > 0 ? (
            <div className="space-y-4">
              {hasTrust ? (
                <h2 className="font-display text-2xl text-foreground">
                  More photography
                </h2>
              ) : null}
              <MediaGallery items={gallery} label="Pelbu Suites" />
            </div>
          ) : null}
        </div>
      </EngineShell>
    </>
  );
}
