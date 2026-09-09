import { MediaGallery } from "@/components/media/MediaGallery";
import { GalleryShowcase } from "@/components/media/GalleryShowcase";
import type { GalleryBuildingProps } from "@/components/media/GalleryShowcase";
import { CmsContentSections } from "@/components/site/CmsContentSections";
import { EngineShell } from "@/components/site/EngineShell";
import { Button } from "@/components/ui/button";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
import {
  buildGalleryChips,
  uniquePhotosByPublicId,
  type GalleryPhoto,
} from "@/lib/gallery-showcase";
import { loadPublicBuildingMap } from "@/lib/public-building-map";
import { loadPublicRooms } from "@/lib/public-content";
import {
  loadPublicFoodMedia,
  loadPublicPropertyAreaMedia,
  loadPublicMediaByRoomTypeIds,
} from "@/lib/property-media-loader";
import { facetLabel } from "@/lib/property-media";
import { safePublic } from "@/lib/public-safe";
import { PAGE_SEO, metadataFromCms } from "@/lib/seo";
import {
  breadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";
import type { Metadata } from "next";
import Link from "next/link";
import { publicMarketingCache } from "@/lib/public-marketing-cache";
const __pelbuPubCache = publicMarketingCache();
export const dynamic = __pelbuPubCache.dynamic;
export const revalidate = __pelbuPubCache.revalidate;


type PageProps = {
  searchParams: Promise<{ area?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const page = await safePublic("gallery-seo", () => loadCmsPage("gallery"), null);
  return metadataFromCms(page, {
    title: PAGE_SEO.gallery.title,
    description: PAGE_SEO.gallery.description,
    path: "/gallery",
  });
}

export default async function GalleryPage({ searchParams }: PageProps) {
  const { area } = await searchParams;
  const [page, gallery, propertyMedia, foodMedia, rooms, buildingMap] =
    await Promise.all([
      safePublic("gallery-cms", () => loadCmsPage("gallery"), null),
      safePublic("gallery-cms-media", () => loadCmsGallery("gallery", 1400), []),
      safePublic("gallery-areas", () => loadPublicPropertyAreaMedia(), []),
      safePublic("gallery-food", () => loadPublicFoodMedia(), []),
      safePublic("gallery-rooms", () => loadPublicRooms(), []),
      safePublic("gallery-building", () => loadPublicBuildingMap(), null),
    ]);

  const roomMediaMap = await safePublic(
    "gallery-room-media",
    () => loadPublicMediaByRoomTypeIds(rooms.map((r) => r.id)),
    new Map(),
  );

  const facadesByType = new Map<string, Set<string>>();
  for (const unit of buildingMap?.units ?? []) {
    const code = unit.room_type_code;
    if (!code) continue;
    const set = facadesByType.get(code) ?? new Set<string>();
    if (unit.facade_side) set.add(unit.facade_side);
    facadesByType.set(code, set);
  }

  const photos: GalleryPhoto[] = [];

  for (const room of rooms) {
    const extra = roomMediaMap.get(room.id) ?? [];
    const facades = [...(facadesByType.get(room.code) ?? [])];
    const seen = new Set<string>();
    for (const item of extra) {
      seen.add(item.public_id);
      photos.push({
        id: item.id,
        publicId: item.public_id,
        resourceType: item.resource_type,
        posterPublicId: item.poster_public_id,
        alt: item.alt || room.name,
        caption: item.caption,
        filterIds: [room.code, ...facades],
      });
    }
    if (room.imagePublicId && !seen.has(room.imagePublicId)) {
      photos.push({
        id: `room-hero-${room.id}`,
        publicId: room.imagePublicId,
        resourceType: "image",
        posterPublicId: null,
        alt: room.name,
        caption: room.blurb,
        filterIds: [room.code, ...facades],
      });
    }
  }

  for (const item of propertyMedia) {
    photos.push({
      id: item.id,
      publicId: item.public_id,
      resourceType: item.resource_type,
      posterPublicId: item.poster_public_id,
      alt: item.alt || facetLabel(item.facet),
      caption: item.caption,
      filterIds: [item.facet],
    });
  }

  for (const item of foodMedia) {
    photos.push({
      id: item.id,
      publicId: item.public_id,
      resourceType: item.resource_type,
      posterPublicId: item.poster_public_id,
      alt: item.alt || facetLabel(item.facet),
      caption: item.caption,
      filterIds: ["restaurant"],
    });
  }

  const usedIds = new Set(photos.map((p) => p.publicId));
  const leftoverCms = gallery.filter(
    (item) => item.public_id && !usedIds.has(item.public_id),
  );

  const uniquePhotos = uniquePhotosByPublicId(photos);
  const chips = buildGalleryChips({
    photos: uniquePhotos,
    rooms: rooms.map((r) => ({ code: r.code, name: r.name, slug: r.slug })),
  });

  const building: GalleryBuildingProps | null = buildingMap
    ? {
        units: buildingMap.units,
        layout: buildingMap.layout,
        spaces: buildingMap.spaces,
        typeHrefByCode: buildingMap.typeHrefByCode,
      }
    : null;

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
          "Real photographs from the house in Olakha — rooms, restaurant, lobby, the building outside, and the street you arrive on. Click the 3D model to jump to a wing."
        }
        actions={
          <>
            <Button asChild variant="citrus">
              <a href={page?.primary_cta_href ?? "/book"}>
                {page?.primary_cta_label ?? "Check availability"}
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href={page?.secondary_cta_href ?? "/rooms"}>
                {page?.secondary_cta_label ?? "Explore rooms"}
              </Link>
            </Button>
          </>
        }
      >
        <div className="space-y-12">
          <CmsContentSections sections={page?.sections_json} />

          {uniquePhotos.length > 0 || building ? (
            <GalleryShowcase
              chips={chips}
              photos={uniquePhotos}
              units={(buildingMap?.units ?? []).map((u) => ({
                id: u.id,
                label: u.label,
                room_type_code: u.room_type_code,
                facade_side: u.facade_side,
                floor_label: u.floor_label,
              }))}
              building={building}
              initialFilter={area}
            />
          ) : leftoverCms.length > 0 ? (
            <MediaGallery items={leftoverCms} label="Pelbu Suites" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Photographs are being prepared. Call the desk or browse{" "}
              <Link href="/rooms" className="underline underline-offset-4">
                rooms
              </Link>{" "}
              in the meantime.
            </p>
          )}

          {uniquePhotos.length > 0 && leftoverCms.length > 0 ? (
            <MediaGallery items={leftoverCms} label="More photography" />
          ) : null}
        </div>
      </EngineShell>
    </>
  );
}
