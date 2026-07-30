"use client";

import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";

export function RoomGallery({
  title,
  images,
}: {
  title: string;
  images: string[];
}) {
  const slides = images.filter(Boolean).slice(0, 8);
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
    <div className="space-y-3">
      <div className="md:hidden">
        <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
          <div className="flex">
            {slides.map((publicId) => (
              <div key={publicId} className="min-w-0 shrink-0 grow-0 basis-full">
                <CloudinaryImage
                  publicId={publicId}
                  alt={title}
                  ratio="16/10"
                  sizes="100vw"
                  priority
                />
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {index + 1} / {slides.length}
        </p>
      </div>

      <div className="hidden gap-2 md:grid md:grid-cols-4 md:grid-rows-2 md:overflow-hidden md:rounded-2xl">
        <div className="relative col-span-2 row-span-2 min-h-[320px] overflow-hidden">
          <CloudinaryImage
            publicId={slides[0]}
            alt={title}
            fill
            priority
            sizes="60vw"
            imgClassName="object-cover"
          />
        </div>
        {slides.slice(1, 5).map((publicId) => (
          <div key={publicId} className="relative min-h-[156px] overflow-hidden">
            <CloudinaryImage
              publicId={publicId}
              alt=""
              fill
              sizes="20vw"
              imgClassName="object-cover"
            />
          </div>
        ))}
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="hidden md:inline-flex">
            Show all photos
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title} photos</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {slides.map((publicId) => (
              <CloudinaryImage
                key={publicId}
                publicId={publicId}
                alt={title}
                ratio="4/3"
                sizes="50vw"
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
