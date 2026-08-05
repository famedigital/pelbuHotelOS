import { HomeSectionHead } from "@/components/home/HomeSectionHead";
import { Reveal } from "@/components/home/Reveal";
import { MediaCard } from "@/components/site/MediaCard";
import { Badge } from "@/components/ui/badge";
import type { PublicRoomWithRate } from "@/lib/public-room-rates";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";

type Props = {
  rooms: PublicRoomWithRate[];
  seasonName?: string | null;
  taxInclusive?: boolean;
  eyebrow?: string;
  title?: string;
  description?: string;
};

export function HomeRooms({
  rooms,
  seasonName,
  taxInclusive,
  eyebrow = "Rooms",
  title = "Suites built for the Thimphu road.",
  description = "Quiet rooms in Olakha with live availability and direct rack rates. Guide and driver beds are complimentary on agent groups.",
}: Props) {
  if (rooms.length === 0) {
    return (
      <section
        id="rooms"
        className="bg-gradient-to-b from-background via-sky-100/50 to-background py-16 md:py-24"
      >
        <div className="mx-auto max-w-[1200px] px-5 md:px-8">
          <HomeSectionHead
            eyebrow={eyebrow}
            title={title}
            description={description}
            accent="sky"
            link={{ href: "/book", label: "Book dates" }}
          />
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/book"
              className="inline-flex h-12 items-center rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-6 text-sm font-semibold text-white"
            >
              Check availability
            </Link>
            <Link
              href="/rates"
              className="inline-flex h-12 items-center rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground"
            >
              Rate card
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-12 items-center rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground"
            >
              Call the desk
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="rooms"
      className="bg-gradient-to-b from-background via-sky-100/50 to-background py-16 md:py-24"
    >
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <Reveal>
          <HomeSectionHead
            eyebrow={eyebrow}
            title={title}
            description={description}
            accent="sky"
            link={{ href: "/rooms", label: "All rooms" }}
          />
        </Reveal>

        <ul className="mt-10 grid auto-rows-fr gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {rooms.map((room, index) => (
            <li key={room.code} className="h-full">
              <Reveal delay={Math.min(index, 3) * 0.06} className="h-full">
                <MediaCard
                  href={`/rooms/${room.slug}`}
                  title={room.name}
                  description={
                    room.blurb?.trim() ||
                    `${room.name} at Pelbu Suites, Olakha — book direct at live rates.`
                  }
                  publicId={room.imagePublicId}
                  src={room.imageSrc}
                  ratio="4/3"
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
                          {seasonName ? `${seasonName} · ` : ""}
                          room only
                          {taxInclusive ? " · inc. GST+SC" : ""}
                          {" · "}
                          Book →
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-sky-700">
                        Check dates →
                      </span>
                    )
                  }
                />
              </Reveal>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/book"
            className="inline-flex h-12 items-center rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-6 text-sm font-semibold text-white shadow-[0_16px_40px_-18px_rgba(2,132,199,0.9)] transition-transform motion-safe:hover:-translate-y-0.5"
          >
            Check live availability
          </Link>
          <Link
            href="/rates"
            className="inline-flex h-12 items-center rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Full rate card
          </Link>
          <Link
            href="/rooms"
            className="inline-flex h-12 items-center rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Compare room types
          </Link>
        </div>
      </div>
    </section>
  );
}
