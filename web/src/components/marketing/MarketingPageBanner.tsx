import type { MarketingMedia } from "@/lib/marketing-assets";

type Props = {
  media: MarketingMedia;
  eyebrow?: string;
  title: string;
  description?: string;
};

/** Full-bleed photo banner for inner marketing pages — photo only, no UI chrome. */
export function MarketingPageBanner({
  media,
  eyebrow,
  title,
  description,
}: Props) {
  return (
    <section className="relative flex min-h-[42svh] flex-col justify-end overflow-hidden md:min-h-[48svh]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.src}
        alt={media.alt}
        className="absolute inset-0 h-full w-full object-cover"
        fetchPriority="high"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.22 0.03 260 / 0.15) 0%, oklch(0.16 0.03 260 / 0.72) 100%)",
        }}
      />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-12 pt-28 md:px-10 md:pb-16">
        {eyebrow ? (
          <p className="text-xs font-semibold tracking-[0.2em] text-white/70 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 max-w-2xl font-display text-3xl font-medium tracking-tight text-white md:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/80 md:text-lg">
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
}
