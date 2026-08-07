import { MediaGallery } from "@/components/media/MediaGallery";
import { CmsContentSections } from "@/components/site/CmsContentSections";
import { EngineShell } from "@/components/site/EngineShell";
import { MediaCard } from "@/components/site/MediaCard";
import { PublicBuildingExplore } from "@/components/site/PublicBuildingExplore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
import { formatBtn } from "@/lib/pricing";
import { loadPublicBuildingMap } from "@/lib/public-building-map";
import { loadPublicRoomsWithRates } from "@/lib/public-room-rates";
import { safePublic } from "@/lib/public-safe";
import { PAGE_SEO, metadataFromCms } from "@/lib/seo";
import {
  breadcrumbJsonLd,
  hotelRoomJsonLd,
  itemListJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const page = await safePublic("rooms-seo", () => loadCmsPage("rooms"), null);
  return metadataFromCms(page, {
    title: PAGE_SEO.rooms.title,
    description: PAGE_SEO.rooms.description,
    path: "/rooms",
  });
}

export const dynamic = "force-dynamic";

async function loadCompBeds() {
  const propertyId = await resolvePublicPropertyId();
  if (!propertyId) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("room_types")
    .select("code, name, inventory_kind, blurb")
    .eq("property_id", propertyId)
    .in("inventory_kind", ["guide_comp", "driver_comp"])
    .order("code");
  return (data ?? []).map((row) => ({
    code: row.code as string,
    name: row.name as string,
    inventory_kind: row.inventory_kind as string,
    blurb: (row.blurb as string | null) ?? null,
  }));
}

export default async function RoomsPage() {
  const [page, gallery, rateCtx, compBeds, buildingMap] = await Promise.all([
    safePublic("rooms-cms", () => loadCmsPage("rooms"), null),
    safePublic("rooms-gallery", () => loadCmsGallery("rooms"), []),
    safePublic(
      "rooms-rates",
      () => loadPublicRoomsWithRates(),
      {
        rooms: [],
        lowestFromBtn: null,
        seasonKind: null,
        seasonName: null,
        taxInclusive: false,
      },
    ),
    safePublic("rooms-comp", () => loadCompBeds(), []),
    safePublic("rooms-building", () => loadPublicBuildingMap(), null),
  ]);

  const guestRooms = rateCtx.rooms;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Rooms", path: "/rooms" },
            ]),
            itemListJsonLd({
              name: "Rooms at Pelbu Suites",
              path: "/rooms",
              items: guestRooms.map((room) => ({
                name: room.name,
                path: `/rooms/${room.slug}`,
                image: room.imageSrc,
              })),
            }),
            ...guestRooms.map((room) =>
              hotelRoomJsonLd({
                name: room.name,
                image: room.imageSrc,
                path: `/rooms/${room.slug}`,
                priceBtn: room.fromPriceBtn,
                description: room.blurb,
              }),
            ),
          ]),
        }}
      />
      <EngineShell
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Rooms" },
        ]}
        eyebrow={page?.eyebrow ?? "Rooms"}
        title={page?.title ?? "Rest in Olakha."}
        description={
          page?.body ??
          "Quiet suites for guests travelling Thimphu. Book direct for live rates, or ask your agent to reserve with guide and driver beds."
        }
        actions={
          <>
            <Button asChild variant="citrus">
              <a href="/book">Check live availability</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/rates">Rate card</a>
            </Button>
          </>
        }
      >
        <div className="space-y-12">
          <CmsContentSections sections={page?.sections_json} />

          {buildingMap ? (
            <section className="space-y-4">
              <div className="max-w-2xl space-y-2">
                <h2 className="font-display text-2xl text-foreground">
                  The house in Olakha
                </h2>
                <p className="text-sm text-muted-foreground">
                  Sketch of how guest floors and common spaces sit together —
                  not a live availability board. Check dates to book.
                </p>
              </div>
              <PublicBuildingExplore
                units={buildingMap.units}
                layout={buildingMap.layout}
                spaces={buildingMap.spaces}
                typeHrefByCode={buildingMap.typeHrefByCode}
              />
            </section>
          ) : null}

          <section>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-2xl text-foreground">
                Guest rooms
              </h2>
              <p className="text-sm text-muted-foreground">
                {guestRooms.length} categories
                {rateCtx.seasonName
                  ? ` · ${rateCtx.seasonName} rates`
                  : ""}
                {rateCtx.lowestFromBtn != null
                  ? ` · from ${formatBtn(rateCtx.lowestFromBtn)}`
                  : ""}
              </p>
            </div>
            {guestRooms.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Room types loading — call the desk or try again shortly.
              </p>
            ) : (
              <ul className="mt-6 grid auto-rows-fr gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {guestRooms.map((room, index) => (
                  <li key={room.code} className="h-full">
                    <MediaCard
                      href={`/rooms/${room.slug}`}
                      title={room.name}
                      description={room.blurb ?? `Room type ${room.code}`}
                      publicId={room.imagePublicId}
                      src={room.imageSrc}
                      ratio="16/10"
                      priority={index < 2}
                      badge={<Badge variant="sky">Guest room</Badge>}
                      meta={
                        room.fromPriceBtn != null ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-semibold text-sky-800">
                              From {formatBtn(room.fromPriceBtn)}
                              <span className="font-medium text-muted-foreground">
                                {" "}
                                / night
                              </span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Room only
                              {rateCtx.taxInclusive ? " · inc. GST+SC" : ""}
                              {" · "}
                              Book →
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-sky-700">
                            Check dates →
                          </span>
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {compBeds.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                Guide &amp; driver beds
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Complimentary for licensed guides and drivers on agent groups.
              </p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {compBeds.map((room) => (
                  <li
                    key={room.code}
                    className="rounded-xl border border-border bg-secondary/40 px-4 py-3"
                  >
                    <p className="text-[15px] font-medium text-foreground">
                      {room.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {room.blurb ??
                        (room.inventory_kind === "guide_comp"
                          ? "Guide · complementary"
                          : "Driver · complementary")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <MediaGallery items={gallery} label="Rooms" />

          <Button asChild size="lg" variant="citrus">
            <a href="/book">Request a stay</a>
          </Button>
        </div>
      </EngineShell>
    </>
  );
}
