import { CatalogueSocialPack } from "@/components/marketing/CatalogueSocialPack";
import type { CatalogueResolvedContent } from "@/lib/marketing/catalogue";
import type { CatalogueSectionType } from "@/lib/marketing/catalogue-templates";
import { formatBtn } from "@/lib/pricing";
import { absoluteUrl } from "@/lib/site";
import Link from "next/link";

export { CatalogueSocialPack };

function sectionOrder(
  content: CatalogueResolvedContent,
): CatalogueSectionType[] {
  const fromDraft = [...content.catalogue.sections]
    .filter((s) => s.enabled !== false)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => s.type);
  if (fromDraft.length) return fromDraft;
  return content.template.defaultSections
    .filter((s) => s.enabled)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => s.type);
}

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
  const isFnb = catalogue.template_code === "fnb_taste";
  const order = sectionOrder(content);

  return (
    <article
      className={
        isPrint
          ? "catalogue-print mx-auto max-w-[210mm] space-y-10 bg-white px-8 py-10 text-zinc-900"
          : "mx-auto max-w-3xl space-y-12 px-4 py-8 pb-28 text-foreground"
      }
    >
      {isPrint && isTrade ? (
        <p className="rounded border border-dashed border-zinc-400 px-3 py-2 text-center text-[10px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
          Trade partners only · not for public social
        </p>
      ) : null}

      <header className="space-y-4">
        {content.coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={content.coverSrc}
            alt=""
            className={
              isPrint
                ? "h-64 w-full object-cover"
                : isFnb
                  ? "aspect-[4/5] w-full object-cover sm:aspect-[16/10]"
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
          {template.name}
          {isTrade ? " · for trade partners" : ""}
        </p>
      </header>

      {order.map((type) => {
        if (type === "cover" || type === "custom") return null;

        if (type === "rooms" && rooms.length > 0) {
          return (
            <section key="rooms" className="space-y-4">
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
          );
        }

        if (type === "fnb" && menuItems.length > 0) {
          return (
            <section key="fnb" className="space-y-4">
              <h2 className="text-xl font-semibold">
                {isFnb ? "Taste" : "Dine"}
              </h2>
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
          );
        }

        if (type === "spa" || type === "meeting") {
          // Render experiences once when either spa or meeting is on.
          if (type === "meeting" && order.includes("spa")) return null;
          if (type === "spa" && !order.includes("spa") && order.includes("meeting"))
            return null;
          if (!offerings.length) return null;
          const title =
            order.includes("spa") && order.includes("meeting")
              ? "Experiences"
              : type === "meeting"
                ? "Meetings"
                : "Spa & wellness";
          return (
            <section key="experiences" className="space-y-4">
              <h2 className="text-xl font-semibold">{title}</h2>
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
          );
        }

        if (type === "gallery" && gallery.length > 0) {
          return (
            <section key="gallery" className="space-y-4">
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
          );
        }

        if (type === "rates") {
          return (
            <section
              key="rates"
              className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-600"
            >
              {isTrade ? (
                <>
                  Trade rates available on request via the agent desk. Public
                  stay prices live on{" "}
                  <span className="font-medium text-zinc-900">
                    {absoluteUrl("/book")}
                  </span>
                  .
                </>
              ) : (
                <>
                  Public stay rates — book direct for current availability.{" "}
                  <Link
                    href="/book"
                    className="font-medium text-sky-700 underline-offset-2 hover:underline"
                  >
                    View dates & from-rates
                  </Link>
                  . Agent / contracted rates are never shown on this pack.
                </>
              )}
            </section>
          );
        }

        if (type === "contact") {
          return (
            <section
              key="contact"
              className="space-y-2 border-t border-zinc-200 pt-6 text-sm text-zinc-600"
            >
              <h2 className="text-lg font-semibold text-zinc-900">
                {property.name}
              </h2>
              {property.address ? <p>{property.address}</p> : null}
              {property.phone ? <p>{property.phone}</p> : null}
              {property.email ? <p>{property.email}</p> : null}
              {property.mapsUrl ? (
                <a
                  href={property.mapsUrl}
                  className="text-sky-700 underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Map
                </a>
              ) : null}
              <p className="break-all text-xs text-zinc-400">{shareUrl}</p>
            </section>
          );
        }

        return null;
      })}

      {!order.includes("contact") ? (
        <footer className="space-y-2 border-t border-zinc-200 pt-6 text-sm text-zinc-600">
          <p className="font-medium text-zinc-900">{property.name}</p>
          {property.address ? <p>{property.address}</p> : null}
          {property.phone ? <p>{property.phone}</p> : null}
          <p className="break-all text-xs text-zinc-400">{shareUrl}</p>
        </footer>
      ) : null}

      {!isPrint ? (
        <div className="print:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{catalogue.title}</p>
            <div className="flex gap-2">
              <Link
                href={content.ctaHref}
                className="inline-flex h-10 items-center rounded-md bg-sky-600 px-4 text-sm font-medium text-white"
              >
                {content.ctaLabel}
              </Link>
              {property.whatsapp ? (
                <a
                  href={`https://wa.me/${property.whatsapp.replace(/\D/g, "")}`}
                  className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
