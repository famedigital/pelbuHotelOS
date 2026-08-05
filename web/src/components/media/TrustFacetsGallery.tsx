"use client";

import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import { CloudinaryVideo } from "@/components/media/CloudinaryVideo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { facetLabel } from "@/lib/property-media";
import type { PropertyMediaRow } from "@/lib/property-media";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export type TrustSlide = {
  id: string;
  publicId: string;
  resourceType: "image" | "video";
  posterPublicId?: string | null;
  alt: string;
  caption?: string | null;
  facet: string;
};

export function mediaRowsToSlides(rows: PropertyMediaRow[]): TrustSlide[] {
  return rows.map((r) => ({
    id: r.id,
    publicId: r.public_id,
    resourceType: r.resource_type,
    posterPublicId: r.poster_public_id,
    alt: r.alt || facetLabel(r.facet),
    caption: r.caption,
    facet: r.facet,
  }));
}

/** Faceted trust gallery — honest labels for beds, linen, toilet, etc. */
export function TrustFacetsGallery({
  title,
  media,
  fallbackPublicIds = [],
}: {
  title: string;
  media: PropertyMediaRow[];
  /** Used only when no published trust media yet. */
  fallbackPublicIds?: string[];
}) {
  const slides: TrustSlide[] = useMemo(() => {
    if (media.length > 0) return mediaRowsToSlides(media);
    return fallbackPublicIds.filter(Boolean).map((publicId, i) => ({
      id: `fallback-${i}`,
      publicId,
      resourceType: "image" as const,
      alt: title,
      facet: "overview",
    }));
  }, [media, fallbackPublicIds, title]);

  const byFacet = useMemo(() => {
    const map = new Map<string, TrustSlide[]>();
    for (const s of slides) {
      const list = map.get(s.facet) ?? [];
      list.push(s);
      map.set(s.facet, list);
    }
    return [...map.entries()];
  }, [slides]);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [index, setIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (slides.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="md:hidden">
        <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
          <div className="flex">
            {slides.map((slide) => (
              <div key={slide.id} className="min-w-0 shrink-0 grow-0 basis-full">
                {slide.resourceType === "video" ? (
                  <CloudinaryVideo
                    publicId={slide.publicId}
                    posterPublicId={slide.posterPublicId}
                    alt={slide.alt}
                    className="aspect-[16/10] w-full object-cover"
                    controls
                    muted={false}
                  />
                ) : (
                  <CloudinaryImage
                    publicId={slide.publicId}
                    alt={slide.alt}
                    ratio="16/10"
                    sizes="100vw"
                    priority
                  />
                )}
                <p className="mt-2 px-1 text-xs font-medium text-foreground">
                  {facetLabel(slide.facet)}
                  {slide.caption ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      — {slide.caption}
                    </span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {index + 1} / {slides.length} · Real photos from the property
        </p>
      </div>

      <div className="hidden md:block space-y-8">
        <div className="grid gap-2 md:grid-cols-4 md:grid-rows-2 md:overflow-hidden md:rounded-2xl">
          <div className="relative col-span-2 row-span-2 min-h-[320px] overflow-hidden bg-muted">
            {slides[0].resourceType === "video" ? (
              <CloudinaryVideo
                publicId={slides[0].publicId}
                posterPublicId={slides[0].posterPublicId}
                alt={slides[0].alt}
                fill
                className="absolute inset-0 size-full"
                controls
                muted={false}
              />
            ) : (
              <CloudinaryImage
                publicId={slides[0].publicId}
                alt={slides[0].alt}
                fill
                priority
                sizes="60vw"
                imgClassName="object-cover"
              />
            )}
          </div>
          {slides.slice(1, 5).map((slide) => (
            <div
              key={slide.id}
              className="relative min-h-[156px] overflow-hidden bg-muted"
            >
              {slide.resourceType === "video" ? (
                <CloudinaryVideo
                  publicId={slide.publicId}
                  posterPublicId={slide.posterPublicId}
                  alt={slide.alt}
                  fill
                  className="absolute inset-0 size-full"
                  controls
                  muted={false}
                />
              ) : (
                <CloudinaryImage
                  publicId={slide.publicId}
                  alt={slide.alt}
                  fill
                  sizes="20vw"
                  imgClassName="object-cover"
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Photographed at Pelbu Suites — not stock imagery.
        </p>

        {byFacet.length > 1 ? (
          <div className="space-y-6">
            {byFacet.map(([facet, items]) => (
              <section key={facet}>
                <h3 className="text-sm font-semibold tracking-wide text-sky-800 uppercase">
                  {facetLabel(facet)}
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((slide) => (
                    <figure key={slide.id} className="overflow-hidden rounded-xl">
                      {slide.resourceType === "video" ? (
                        <CloudinaryVideo
                          publicId={slide.publicId}
                          posterPublicId={slide.posterPublicId}
                          alt={slide.alt}
                          className="aspect-[4/3] w-full object-cover"
                          controls
                          muted={false}
                        />
                      ) : (
                        <CloudinaryImage
                          publicId={slide.publicId}
                          alt={slide.alt}
                          ratio="4/3"
                          sizes="33vw"
                        />
                      )}
                      {slide.caption ? (
                        <figcaption className="mt-1.5 text-xs text-muted-foreground">
                          {slide.caption}
                        </figcaption>
                      ) : null}
                    </figure>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Show all photos</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{title} — full gallery</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              {slides.map((slide) => (
                <figure key={slide.id}>
                  {slide.resourceType === "video" ? (
                    <CloudinaryVideo
                      publicId={slide.publicId}
                      posterPublicId={slide.posterPublicId}
                      alt={slide.alt}
                      className="aspect-[4/3] w-full rounded-lg object-cover"
                      controls
                      muted={false}
                    />
                  ) : (
                    <CloudinaryImage
                      publicId={slide.publicId}
                      alt={slide.alt}
                      ratio="4/3"
                      sizes="50vw"
                    />
                  )}
                  <figcaption className="mt-1 text-xs text-muted-foreground">
                    {facetLabel(slide.facet)}
                    {slide.caption ? ` — ${slide.caption}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

/** Simple section grid for gallery/property pages. */
export function TrustMediaSection({
  heading,
  media,
}: {
  heading: string;
  media: PropertyMediaRow[];
}) {
  if (media.length === 0) return null;
  return (
    <section className="space-y-4">
      {heading ? (
        <h2 className="font-display text-2xl text-foreground">{heading}</h2>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {media.map((item) => (
          <figure key={item.id} className="overflow-hidden rounded-xl">
            {item.resource_type === "video" ? (
              <CloudinaryVideo
                publicId={item.public_id}
                posterPublicId={item.poster_public_id}
                alt={item.alt || facetLabel(item.facet)}
                className="aspect-[4/3] w-full object-cover"
                controls
                muted={false}
              />
            ) : (
              <CloudinaryImage
                publicId={item.public_id}
                alt={item.alt || facetLabel(item.facet)}
                ratio="4/3"
                sizes="33vw"
              />
            )}
            <figcaption className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {facetLabel(item.facet)}
              </span>
              {item.caption ? ` — ${item.caption}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
