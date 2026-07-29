import Link from "next/link";
import { HOME_STREAM_IMAGES } from "@/lib/brand";
import { cloudinaryUrl } from "@/lib/cloudinary";

/** Simple outlet grid — image + title + one line. No Explore arrows, no brass. */
export function HomeStreams() {
  return (
    <section className="px-5 py-16 md:px-8 md:py-20">
      <div className="mx-auto max-w-[1120px]">
        <h2 className="font-display text-2xl text-ink md:text-3xl">
          Six ways in
        </h2>
        <p className="mt-2 max-w-md text-[15px] text-muted-foreground">
          Stay, eat, restore, or meet — without leaving the building.
        </p>

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {HOME_STREAM_IMAGES.map((s) => {
            const src = cloudinaryUrl(s.publicId, {
              width: 720,
              height: 480,
              crop: "fill",
            });
            return (
              <li key={s.href}>
                <Link href={s.href} className="group block">
                  {src ? (
                    <div className="aspect-[3/2] overflow-hidden bg-paper-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={s.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                        width={720}
                        height={480}
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  <p className="mt-3 text-[15px] font-medium text-ink group-hover:underline group-hover:underline-offset-4">
                    {s.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {s.blurb}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
