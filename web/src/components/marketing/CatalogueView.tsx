import { cloudinaryUrl } from "@/lib/cloudinary";
import { formatBtn } from "@/lib/pricing";
import type { CatalogueResolvedContent } from "@/lib/marketing/catalogue";
import { SOCIAL_CROP_PRESETS } from "@/lib/marketing/catalogue-templates";
import { absoluteUrl } from "@/lib/site";
import Link from "next/link";

export function CatalogueView({
  content,
  shareUrl,
  mode = "web",
}: {
  content: CatalogueResolvedContent;
  shareUrl: string;
  mode?: "web" | "print";
}) {
  const { catalogue, property, template, rooms, menuItems, offerings, gallery } =
    content;
  const isPrint = mode === "print";
  const isTrade = catalogue.template_code === "agent_trade";

  return (
    <article
      className={
        isPrint
          ? "catalogue-print mx-auto max-w-[210mm] space-y-10 bg-white px-8 py-10 text-zinc-900"
          : "mx-auto max-w-3xl space-y-12 px-4 py-8 pb-24 text-foreground"
      }
    >
      <header className="space-y-4">
        {content.coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={content.coverSrc}
            alt=""
            className={
              isPrint
                ? "h-64 w-full object-cover"
                : "aspect-[16/10] w-full object-cover"
            }
          />
        ) : null}
        <p className="text-[11px] font-semibold tracking-[0.2em] text-sky-600 uppercase">
          {property.name}
          {catalogue.season_label ? ` · ${catalogue.season_label}` : ""}
        </p>
        <h1
          className={
            isPrint
              ? "text-3xl font-semibold tracking-tight"
              : "text-3xl font-semibold tracking-tight md:text-4xl"
          }
        >
          {catalogue.title}
        </h1>
        {catalogue.intro_blurb ? (
          <p className="max-w-prose text-base text-zinc-600">
            {catalogue.intro_blurb}
          </p>
        ) : null}
        {content.promoCode ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Offer code{" "}
            <span className="font-mono font-semibold">{content.promoCode}</span>
          </p>
        ) : null}
        {!isPrint ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={content.ctaHref}
              className="inline-flex h-11 items-center rounded-md bg-sky-600 px-5 text-sm font-medium text-white"
            >
              {content.ctaLabel}
            </Link>
            {property.whatsapp ? (
              <a
                href={`https://wa.me/${property.whatsapp.replace(/\D/g, "")}`}
                className="inline-flex h-11 items-center rounded-md border px-5 text-sm font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        ) : null}
        <p className="text-xs text-zinc-500">
          Template {template.name}
          {isTrade ? " · for trade partners" : ""}
        </p>
      </header>

      {rooms.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Stay</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {rooms.map((room) => (
              <li key={room.code} className="space-y-2">
                {room.imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={room.imageSrc}
                    alt=""
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : null}
                <p className="font-medium">{room.name}</p>
                {room.blurb ? (
                  <p className="text-sm text-zinc-600">{room.blurb}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {menuItems.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Dine</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {menuItems.map((item) => (
              <li
                key={item.id}
                className="flex gap-3 border-b border-zinc-100 pb-3"
              >
                {item.imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageSrc}
                    alt=""
                    className="size-16 shrink-0 object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.name}</p>
                  {item.description ? (
                    <p className="line-clamp-2 text-xs text-zinc-600">
                      {item.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm tabular-nums text-zinc-800">
                    {formatBtn(item.priceBtn)}
                    <span className="ml-1 text-[10px] uppercase text-zinc-400">
                      {item.outlet}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {offerings.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Experiences</h2>
          <ul className="space-y-3">
            {offerings.map((o) => (
              <li key={o.id} className="flex gap-3">
                {o.imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={o.imageSrc}
                    alt=""
                    className="size-20 shrink-0 object-cover"
                  />
                ) : null}
                <div>
                  <p className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                    {o.kind}
                  </p>
                  <p className="font-medium">{o.name}</p>
                  {o.description ? (
                    <p className="text-sm text-zinc-600">{o.description}</p>
                  ) : null}
                  {o.priceBtn != null && catalogue.show_public_rates ? (
                    <p className="text-sm tabular-nums">
                      {formatBtn(o.priceBtn)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {gallery.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Gallery</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {gallery.slice(0, 9).map((g) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={g.publicId}
                src={g.src}
                alt={g.alt}
                className="aspect-square w-full object-cover"
              />
            ))}
          </div>
        </section>
      ) : null}

      {catalogue.show_public_rates && isTrade ? (
        <section className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-600">
          Trade rates available on request via the agent desk. Public stay
          prices live on{" "}
          <span className="font-medium text-zinc-900">
            {absoluteUrl("/book")}
          </span>
          .
        </section>
      ) : null}

      <footer className="space-y-2 border-t border-zinc-200 pt-6 text-sm text-zinc-600">
        <p className="font-medium text-zinc-900">{property.name}</p>
        {property.address ? <p>{property.address}</p> : null}
        {property.phone ? <p>{property.phone}</p> : null}
        {property.email ? <p>{property.email}</p> : null}
        <p className="break-all text-xs text-zinc-400">{shareUrl}</p>
      </footer>
    </article>
  );
}

export function CatalogueSocialPack({
  content,
}: {
  content: CatalogueResolvedContent;
}) {
  const publicId =
    content.coverPublicId ||
    content.rooms.find((r) => r.imagePublicId)?.imagePublicId ||
    content.menuItems.find((m) => m.imagePublicId)?.imagePublicId ||
    content.gallery[0]?.publicId ||
    null;

  if (!publicId) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a cover or media image to generate social crops.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Open full size, then save for Meta posts. Crops via Cloudinary.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SOCIAL_CROP_PRESETS.map((preset) => {
          const src = cloudinaryUrl(publicId, {
            width: preset.width,
            height: preset.height,
            crop: "fill",
          });
          if (!src) return null;
          return (
            <li key={preset.key} className="space-y-1.5 rounded-lg border p-2">
              <p className="text-[11px] font-medium text-muted-foreground">
                {preset.label} · {preset.width}×{preset.height}
              </p>
              <a href={src} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={preset.label}
                  className="mx-auto max-h-40 w-auto object-contain"
                />
              </a>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-sky-600 underline-offset-2 hover:underline"
              >
                Open full size
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
