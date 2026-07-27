import { ConversionShell } from "@/components/site/ConversionShell";
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
    .select("code, name, inventory_kind")
    .eq("property_id", property.id)
    .order("code");

  return data ?? [];
}

export default async function RoomsPage() {
  const rooms = await loadRooms();
  const guestRooms = rooms.filter((r) => r.inventory_kind === "sellable_guest");
  const compBeds = rooms.filter((r) =>
    ["guide_comp", "driver_comp"].includes(r.inventory_kind as string),
  );

  return (
    <ConversionShell
      eyebrow="Rooms"
      title="Rest in Olakha."
      body="Quiet suites for guests traveling Bhutan. Book direct for the public rate, or ask your agent to reserve with guide and driver beds included."
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
      <div className="space-y-10">
        <section>
          <h2 className="text-sm font-medium tracking-[0.18em] text-gold uppercase">
            Guest rooms
          </h2>
          {guestRooms.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Room types loading — call the desk.</p>
          ) : (
            <ul className="mt-4 divide-y divide-espresso/10 border-y border-espresso/10">
              {guestRooms.map((room) => (
                <li key={room.code as string} className="py-4">
                  <p className="text-base text-espresso">{room.name as string}</p>
                  <p className="mt-1 text-sm text-muted">
                    Code {room.code as string} · sellable guest inventory
                  </p>
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
                <li key={room.code as string} className="py-4">
                  <p className="text-base text-espresso">{room.name as string}</p>
                  <p className="mt-1 text-sm text-muted">
                    {room.inventory_kind === "guide_comp" ? "Guide" : "Driver"} · rate 0
                    (comp)
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

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
