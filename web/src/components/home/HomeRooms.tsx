import { HomeSectionHead } from "@/components/home/HomeSectionHead";
import { Reveal } from "@/components/home/Reveal";
import { CloudinaryImage } from "@/components/media/CloudinaryImage";
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

/** Featured room + horizontal strip — not a uniform card grid. */
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
      <section id="rooms" className="bg-mist-0 py-16 md:py-24">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8">
          <HomeSectionHead
            eyebrow={eyebrow}
            title={title}
            description={description}
            accent="juniper"
            link={{ href: "/book", label: "Book dates" }}
          />
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/book"
              className="inline-flex h-12 items-center rounded-md bg-ember px-6 text-sm font-semibold text-white hover:bg-ember-deep"
            >
              Check availability
            </Link>
            <Link
              href="/rates"
              className="inline-flex h-12 items-center rounded-md border border-cedar-rule bg-white px-6 text-sm font-semibold text-foreground"
            >
              Rate card
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const [featured, ...rest] = rooms;

  return (
    <section id="rooms" className="bg-mist-0 py-16 md:py-24">
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <Reveal>
          <HomeSectionHead
            eyebrow={eyebrow}
            title={title}
            description={description}
            accent="juniper"
            link={{ href: "/rooms", label: "All rooms" }}
          />
        </Reveal>

        <Reveal className="mt-10">
          <Link
            href={`/rooms/${featured.slug}`}
            className="group grid overflow-hidden border border-cedar-rule bg-white lg:grid-cols-[1.35fr_1fr]"
          >
            <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[28rem]">
              <CloudinaryImage
                publicId={featured.imagePublicId}
                src={featured.imageSrc}
                alt=""
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 60vw"
                imgClassName="object-cover transition-transform duration-700 motion-safe:group-hover:scale-[1.03]"
              />
            </div>
            <div className="flex flex-col justify-center gap-4 p-6 md:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-juniper">
                Featured stay
              </p>
              <h3 className="font-display text-3xl leading-tight text-foreground md:text-4xl">
                {featured.name}
              </h3>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                {featured.blurb?.trim() ||
                  `${featured.name} at Pelbu Suites, Olakha — book direct at live rates.`}
              </p>
              {featured.fromPriceBtn != null ? (
                <p className="text-sm font-semibold text-cedar-ink">
                  From {formatBtn(featured.fromPriceBtn)}
                  <span className="font-medium text-muted-foreground">
                    {" "}
                    / night
                    {seasonName ? ` · ${seasonName}` : ""}
                    {taxInclusive ? " · inc. GST+SC" : ""}
                  </span>
                </p>
              ) : null}
              <span className="mt-2 inline-flex text-sm font-semibold text-ember group-hover:underline">
                View room →
              </span>
            </div>
          </Link>
        </Reveal>

        {rest.length > 0 ? (
          <ul className="mt-6 flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {rest.map((room) => (
              <li key={room.code} className="w-[min(78vw,280px)] shrink-0">
                <Link
                  href={`/rooms/${room.slug}`}
                  className="group flex h-full flex-col border border-cedar-rule bg-white"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <CloudinaryImage
                      publicId={room.imagePublicId}
                      src={room.imageSrc}
                      alt=""
                      fill
                      sizes="280px"
                      imgClassName="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <p className="font-semibold text-foreground group-hover:text-juniper">
                      {room.name}
                    </p>
                    {room.fromPriceBtn != null ? (
                      <p className="text-sm text-muted-foreground">
                        From {formatBtn(room.fromPriceBtn)} / night
                      </p>
                    ) : (
                      <p className="text-sm text-juniper">Check dates →</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/book"
            className="inline-flex h-12 items-center rounded-md bg-ember px-6 text-sm font-semibold text-white hover:bg-ember-deep"
          >
            Check live availability
          </Link>
          <Link
            href="/rates"
            className="inline-flex h-12 items-center rounded-md border border-cedar-rule bg-white px-6 text-sm font-semibold text-foreground hover:bg-mist-1"
          >
            Full rate card
          </Link>
        </div>
      </div>
    </section>
  );
}
