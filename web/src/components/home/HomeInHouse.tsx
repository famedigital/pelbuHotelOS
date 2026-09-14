import { HomeSectionHead } from "@/components/home/HomeSectionHead";
import { Reveal } from "@/components/home/Reveal";
import { BRAND_CLOUDINARY } from "@/lib/brand";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

const LINKS = [
  {
    href: "/restaurant",
    title: "Restaurant",
    body: "Indian, Bhutanese and multicuisine.",
    publicId: BRAND_CLOUDINARY.restaurantPlate,
    span: "lg:col-span-2 lg:row-span-2",
  },
  {
    href: "/cafe",
    title: "Cafe & pastry",
    body: "Coffee before the city wakes up.",
    publicId: BRAND_CLOUDINARY.cafePastry,
    span: "",
  },
  {
    href: "/spa",
    title: "Spa & steam",
    body: "Recover after the road or trek.",
    publicId: BRAND_CLOUDINARY.spaSteam,
    span: "",
  },
  {
    href: "/menu",
    title: "Order online",
    body: "Pickup or taxi across Thimphu.",
    publicId: BRAND_CLOUDINARY.diningRoom,
    span: "lg:col-span-2",
  },
] as const;

/** Editorial mosaic of in-house outlets — not icon tiles. */
export function HomeInHouse() {
  return (
    <section id="in-house" className="bg-mist-0 py-16 md:py-24">
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <Reveal>
          <HomeSectionHead
            eyebrow="Also under this roof"
            title="Dine, sip and recover without leaving."
            description="Cafe, restaurant, pastry, spa and meeting share one desk with your room. Book the stay first — the rest is here when you need it."
            accent="juniper"
            link={{ href: "/services", label: "All services" }}
          />
        </Reveal>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
          {LINKS.map((item, index) => {
            const src = cloudinaryUrl(item.publicId, {
              width: 900,
              crop: "fill",
            });
            const featured = item.span.includes("row-span");
            return (
              <li key={item.href} className={cn(item.span)}>
                <Reveal delay={Math.min(index, 3) * 0.05} className="h-full">
                  <Link
                    href={item.href}
                    className="group relative flex h-full min-h-[12rem] flex-col justify-end overflow-hidden bg-forest text-[#f2f4f3]"
                  >
                    {src ? (
                      <Image
                        src={src}
                        alt=""
                        fill
                        sizes={
                          featured
                            ? "(max-width: 1024px) 100vw, 50vw"
                            : "(max-width: 768px) 50vw, 25vw"
                        }
                        className="object-cover opacity-70 transition-transform duration-700 motion-safe:group-hover:scale-105"
                      />
                    ) : null}
                    <div className="relative z-10 bg-gradient-to-t from-forest via-forest/70 to-transparent p-5">
                      <p
                        className={cn(
                          "font-semibold text-white",
                          featured && "font-display text-2xl md:text-3xl",
                        )}
                      >
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-white/75">
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
