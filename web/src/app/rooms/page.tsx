import { ConversionShell } from "@/components/site/ConversionShell";
import { MediaGallery } from "@/components/media/MediaGallery";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
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
        ? cloudinaryUrl(imagePublicId, { width: 720, crop: "fill" })
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
      eyebrow={page?.eyebrow ?? "Rooms"}
      title={page?.title ?? "Rest in Olakha."}
      body={
        page?.body ??
        "Quiet suites for guests traveling Bhutan. Book direct for the public rate, or ask your agent to reserve with guide and driver beds included."
      }
      aside={
        <div className="space-y-4 text-sm text-muted">
          <p className="text-xs tracking-[0.2em] text-gold uppercase">Rates</p>
          <p className="leading-relaxed text-espresso/80">
            Peak, lean, and off-season rates are confirmed by the desk. Friends,
            family, and MoU agent tiers are assigned in-house — public web shows
            the walk-in path.
          </p>
          <a
            href="/book"
            className="inline-flex min-h-11 items-center rounded-sm bg-gold px-5 text-sm font-medium text-espresso"
          >
            Check availability
          </a>
        </div>
      }
    >
      <div className="space-y-12">
        <section>
          <h2 className="text-sm font-medium tracking-[0.18em] text-gold uppercase">
            Guest rooms
          </h2>
          {guestRooms.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Room types loading — call the desk.</p>
          ) : (
            <ul className="mt-5 space-y-5">
              {guestRooms.map((room) => (
                <li
                  key={room.code}
                  className="overflow-hidden border border-espresso/10 bg-white"
                >
                  {room.image_src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={room.image_src}
                      alt={room.name}
                      className="aspect-[16/9] w-full object-cover"
                      loading="lazy"
                      width={720}
                      height={405}
                    />
                  ) : null}
                  <div className="px-5 py-4">
                    <p className="text-base text-espresso">{room.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      {room.blurb ??
                        `Code ${room.code} · sellable guest inventory`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-sm font-medium tracking-[0.18em] text-gold uppercase">
            Guide & driver beds
          </h2>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            Complimentary beds for licensed guides and drivers — first-class
            inventory so ADR stays clean. Arranged at check-in for agent groups.
          </p>
          {compBeds.length > 0 ? (
            <ul className="mt-4 divide-y divide-espresso/10 border-y border-espresso/10">
              {compBeds.map((room) => (
                <li key={room.code} className="py-4">
                  <p className="text-base text-espresso">{room.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {room.blurb ??
                      `${room.inventory_kind === "guide_comp" ? "Guide" : "Driver"} · rate 0 (comp)`}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <MediaGallery items={gallery} label="Rooms" />

        <a
          href="/book"
          className="inline-flex min-h-11 items-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory"
        >
          Request a stay
        </a>
      </div>
    </ConversionShell>
  );
}
