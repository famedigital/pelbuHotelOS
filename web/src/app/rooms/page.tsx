import { ConversionShell } from "@/components/site/ConversionShell";
import { MediaGallery } from "@/components/media/MediaGallery";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { loadCmsGallery, loadCmsPage, pickHeroSrc } from "@/lib/cms";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Rooms | Pelbu Suites",
  description:
    "Book rooms at Pelbu Suites, Olakha Thimphu — guest suites plus complimentary guide and driver beds for agent groups.",
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
      image_src: imagePublicId
        ? cloudinaryUrl(imagePublicId, { width: 1000, crop: "fill" })
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
    <ConversionShell
      heroSrc={pickHeroSrc(gallery)}
      eyebrow={page?.eyebrow ?? "Rooms"}
      title={page?.title ?? "Rest in Olakha."}
      body={
        page?.body ??
        "Quiet suites for guests traveling Bhutan. Book direct, or ask your agent to reserve with guide and driver beds."
      }
      aside={
        <div className="space-y-4">
          <p className="font-medium text-ink">Rates</p>
          <p className="leading-relaxed">
            Peak and lean rates are confirmed by the desk. Public web shows the
            walk-in path.
          </p>
          <Button asChild className="w-full">
            <a href="/book">Check availability</a>
          </Button>
        </div>
      }
    >
      <div className="space-y-12">
        <section>
          <h2 className="text-sm font-medium text-ink">Guest rooms</h2>
          {guestRooms.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Room types loading — call the desk.
            </p>
          ) : (
            <ul className="mt-5 space-y-8">
              {guestRooms.map((room) => (
                <li key={room.code}>
                  {room.image_src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={room.image_src}
                      alt={room.name}
                      className="aspect-[16/10] w-full object-cover"
                      loading="lazy"
                      width={1000}
                      height={625}
                    />
                  ) : null}
                  <p className="mt-3 font-display text-xl text-ink">
                    {room.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {room.blurb ?? `Code ${room.code}`}
                  </p>
                  <Accordion type="single" collapsible className="mt-2">
                    <AccordionItem value="details" className="border-0">
                      <AccordionTrigger className="py-2 text-sm text-muted-foreground hover:no-underline">
                        Details
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">
                        Rate confirmed at booking. Guide and driver beds
                        arranged at check-in for agent groups.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </li>
              ))}
            </ul>
          )}
        </section>

        {compBeds.length > 0 ? (
          <section>
            <h2 className="text-sm font-medium text-ink">
              Guide &amp; driver beds
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Complimentary for licensed guides and drivers on agent groups.
            </p>
            <ul className="mt-4 space-y-3">
              {compBeds.map((room) => (
                <li key={room.code}>
                  <p className="text-[15px] text-ink">{room.name}</p>
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

        <Button asChild size="lg">
          <a href="/book">Request a stay</a>
        </Button>
      </div>
    </ConversionShell>
  );
}
