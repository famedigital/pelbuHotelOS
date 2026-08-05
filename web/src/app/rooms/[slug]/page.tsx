import { TrustFacetsGallery } from "@/components/media/TrustFacetsGallery";
import { EngineShell } from "@/components/site/EngineShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveRoomImagePublicId, ROOM_GALLERY_BY_CODE } from "@/lib/brand";
import { loadPublicRoom } from "@/lib/public-content";
import { loadPublicRoomsWithRates } from "@/lib/public-room-rates";
import { loadPublicPropertyMedia } from "@/lib/property-media-loader";
import {
  breadcrumbJsonLd,
  hotelRoomJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const room = await loadPublicRoom(slug);
  if (!room) return {};
  const description =
    room.blurb ??
    `View ${room.name} at Pelbu Suites in Olakha, Thimphu and check live availability.`;
  return {
    title: `${room.name} | Pelbu Suites Thimphu`,
    description,
    alternates: { canonical: `/rooms/${room.slug}` },
    openGraph: {
      title: `${room.name} | Pelbu Suites`,
      description,
      url: `/rooms/${room.slug}`,
      images: room.imageSrc ? [{ url: room.imageSrc }] : undefined,
    },
  };
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [room, rateCtx] = await Promise.all([
    loadPublicRoom(slug),
    loadPublicRoomsWithRates(),
  ]);
  if (!room) notFound();
  const priced = rateCtx.rooms.find((r) => r.slug === room.slug);

  const lead = resolveRoomImagePublicId({
    code: room.code,
    name: room.name,
    imagePublicId: room.imagePublicId,
  });

  const trustMedia = await loadPublicPropertyMedia({
    scope: "room_type",
    scopeId: room.id,
  });

  const fallback =
    trustMedia.length === 0
      ? [
          lead,
          ...(ROOM_GALLERY_BY_CODE[room.code] ?? []).filter((id) => id !== lead),
        ]
      : [];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Rooms", path: "/rooms" },
              { name: room.name, path: `/rooms/${room.slug}` },
            ]),
            hotelRoomJsonLd({
              name: room.name,
              image: room.imageSrc,
              path: `/rooms/${room.slug}`,
              priceBtn: priced?.fromPriceBtn,
              description: room.blurb,
            }),
          ]),
        }}
      />
      <EngineShell
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Rooms", path: "/rooms" },
          { name: room.name },
        ]}
        eyebrow="Rooms at Pelbu"
        title={room.name}
        description={
          room.blurb ??
          "Choose dates in the booking engine to see live availability and the current public rate."
        }
        actions={
          <>
            <Button asChild variant="citrus">
              <a href={`/book?room=${encodeURIComponent(room.code)}`}>
                Check live availability
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/rooms">All rooms</Link>
            </Button>
          </>
        }
      >
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-8">
            <TrustFacetsGallery
              title={room.name}
              media={trustMedia}
              fallbackPublicIds={fallback}
            />
            <section className="space-y-4">
              <h2 className="font-display text-2xl text-foreground">
                What to expect
              </h2>
              <p className="max-w-2xl text-[15px] leading-7 text-muted-foreground">
                {room.blurb ??
                  "A quiet guest room at Pelbu Suites in Olakha. Live rate and availability are confirmed for your selected dates in the booking engine."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="sky">Olakha · Thimphu</Badge>
                <Badge variant="mint">Direct book</Badge>
                <Badge variant="secondary">Meal plans available</Badge>
              </div>
            </section>
            <section className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground">Booking notes</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                <li>Rates and stay length resolve for the dates you choose.</li>
                <li>Guide and driver beds can be arranged for agent groups.</li>
                <li>Nothing on this page replaces the live quote.</li>
              </ul>
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="rounded-2xl border-border shadow-lg">
              <CardHeader>
                <CardTitle className="font-display text-2xl">
                  Reserve {room.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  Open the booking engine with this room preselected, then choose
                  dates, nights, and a meal plan.
                </p>
                <Button asChild className="w-full" size="lg" variant="citrus">
                  <a href={`/book?room=${encodeURIComponent(room.code)}`}>
                    Check dates
                  </a>
                </Button>
                <Button asChild className="w-full" variant="outline">
                  <a href="/contact">Ask the desk</a>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </EngineShell>
    </>
  );
}
