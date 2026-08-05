import { HomeSectionHead } from "@/components/home/HomeSectionHead";
import { Reveal } from "@/components/home/Reveal";
import { BRAND_CLOUDINARY } from "@/lib/brand";
import { cloudinaryUrl } from "@/lib/cloudinary";
import Image from "next/image";
import Link from "next/link";

const LINKS = [
  {
    href: "/restaurant",
    title: "Restaurant",
    body: "Indian, Bhutanese and multicuisine.",
    publicId: BRAND_CLOUDINARY.restaurantPlate,
  },
  {
    href: "/cafe",
    title: "Cafe & pastry",
    body: "Coffee before the city wakes up.",
    publicId: BRAND_CLOUDINARY.cafePastry,
  },
  {
    href: "/spa",
    title: "Spa & steam",
    body: "Recover after the road or trek.",
    publicId: BRAND_CLOUDINARY.spaSteam,
  },
  {
    href: "/menu",
    title: "Order online",
    body: "Pickup or taxi across Thimphu.",
    publicId: BRAND_CLOUDINARY.diningRoom,
  },
] as const;

/**
 * One in-house services strip — replaces three outlet blocks + marketplace
 * so the homepage stays a stay conversion page, not a magazine.
 */
export function HomeInHouse() {
  return (
    <section
      id="in-house"
      className="bg-gradient-to-b from-background via-sky-50/40 to-background py-16 md:py-20"
    >
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <Reveal>
          <HomeSectionHead
            eyebrow="Also under this roof"
            title="Dine, sip and recover without leaving."
            description="Cafe, restaurant, pastry, spa and meeting share one desk with your room. Book the stay first — the rest is here when you need it."
            accent="mint"
            link={{ href: "/services", label: "All services" }}
          />
        </Reveal>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LINKS.map((item, index) => {
            const src = cloudinaryUrl(item.publicId, {
              width: 720,
              crop: "fill",
            });
            return (
              <li key={item.href}>
                <Reveal delay={Math.min(index, 3) * 0.05}>
                  <Link
                    href={item.href}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/60 transition-colors hover:border-sky-300/80 hover:bg-white"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-sky-100">
                      {src ? (
                        <Image
                          src={src}
                          alt=""
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-4">
                      <p className="font-semibold text-foreground group-hover:text-sky-700">
                        {item.title}
                      </p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {item.body}
                      </p>
                    </div>
                  </Link>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
