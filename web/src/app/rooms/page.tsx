import { MediaGallery } from "@/components/media/MediaGallery";
import { CmsContentSections } from "@/components/site/CmsContentSections";
import { EngineShell } from "@/components/site/EngineShell";
import { MediaCard } from "@/components/site/MediaCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { publicRoomSlug } from "@/lib/public-content";
import {
  breadcrumbJsonLd,
  hotelRoomJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Rooms | Pelbu Suites",
  description:
    "Book rooms at Pelbu Suites, Olakha Thimphu — guest suites plus complimentary guide and driver beds for agent groups.",
  alternates: { canonical: "/rooms" },
};

export const dynamic = "force-dynamic";

async function loadRooms() {
  const admin = createSupabaseAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  if (!property) return [];

  const { data } = await admin
    .from("room_types")
    .select("code, name, inventory_kind, image_public_id, blurb")
    .eq("property_id", property.id)
    .order("code");

  return (data ?? []).map((row) => {
    const imagePublicId = (row.image_public_id as string | null) ?? null;
    return {
      code: row.code as string,
      name: row.name as string,
      inventory_kind: row.inventory_kind as string,
      blurb: (row.blurb as string | null) ?? null,
      image_public_id: imagePublicId,
      image_src: imagePublicId
        ? cloudinaryUrl(imagePublicId, { width: 1400, crop: "fill" })
        : null,
    };
  });
}

export default async function RoomsPage() {
  const [page, gallery, rooms] = await Promise.all([
    loadCmsPage("rooms"),
    loadCmsGallery("rooms"),
    loadRooms(),
  ]);
  const guestRooms = rooms.filter((r) => r.inventory_kind === "sellable_guest");
  const compBeds = rooms.filter((r) =>
    ["guide_comp", "driver_comp"].includes(r.inventory_kind),
  );

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
            ...guestRooms.map((room) =>
              hotelRoomJsonLd({
                name: room.name,
                image: room.image_src,
                path: `/rooms/${publicRoomSlug(room.code)}`,
              }),
            ),
          ]),
        }}
      />
      <EngineShell
        eyebrow={page?.eyebrow ?? "Rooms"}
        title={page?.title ?? "Rest in Olakha."}
        description={
          page?.body ??
          "Quiet suites for guests traveling Bhutan. Book direct, or ask your agent to reserve with guide and driver beds."
        }
        actions={
          <Button asChild variant="citrus">
            <a href="/book">Check live availability</a>
          </Button>
        }
      >
        <div className="space-y-12">
          <CmsContentSections sections={page?.sections_json} />
          <section>
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl text-foreground">Guest rooms</h2>
              <p className="text-sm text-muted-foreground">
                {guestRooms.length} categories
              </p>
            </div>
            {guestRooms.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Room types loading — call the desk.
              </p>
            ) : (
              <ul className="mt-6 grid auto-rows-fr gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {guestRooms.map((room, index) => (
                  <li key={room.code} className="h-full">
                    <MediaCard
                      href={`/rooms/${publicRoomSlug(room.code)}`}
                      title={room.name}
                      description={room.blurb ?? `Room type ${room.code}`}
                      publicId={room.image_public_id}
                      ratio="16/10"
                      priority={index < 2}
                      badge={<Badge variant="sky">Guest room</Badge>}
                      meta={
                        <span className="text-sm font-medium text-sky-700">
                          Check dates →
                        </span>
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
