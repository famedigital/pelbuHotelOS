"use client";

import { CloudinaryMedia } from "@/components/media/CloudinaryMedia";
import { PublicBuildingExplore } from "@/components/site/PublicBuildingExplore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RoomMapUnit } from "@/components/erp/room-map-shared";
import type {
  BuildingSpace,
  PropertyBuildingLayout,
} from "@/lib/building/types";
import {
  amenityKindToFilter,
  filterGalleryPhotos,
  galleryChipById,
  GALLERY_AMENITY_FILTER_IDS,
  normalizeGalleryFilter,
  selectedUnitIdsForFilter,
  type GalleryChip,
  type GalleryPhoto,
  type GalleryUnitRef,
} from "@/lib/gallery-showcase";
import { splitOlakhaFloorWings } from "@/lib/building/olakha-wings";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

export type GalleryBuildingProps = {
  units: RoomMapUnit[];
  layout: PropertyBuildingLayout;
  spaces: Array<BuildingSpace & { id: string }>;
  typeHrefByCode: Record<string, string>;
};

type Props = {
  chips: GalleryChip[];
  photos: GalleryPhoto[];
  units: GalleryUnitRef[];
  building: GalleryBuildingProps | null;
  initialFilter?: string;
};

export function GalleryShowcase({
  chips,
  photos,
  units,
  building,
  initialFilter = "all",
}: Props) {
  const allowed = useMemo(
    () => new Set(chips.map((c) => c.id)),
    [chips],
  );
  const [filter, setFilter] = useState(() =>
    normalizeGalleryFilter(initialFilter, allowed),
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [wingUnitIds, setWingUnitIds] = useState<string[] | null>(null);

  const visible = useMemo(() => {
    let list = filterGalleryPhotos(photos, filter);
    if (wingUnitIds?.length) {
      const codes = new Set(
        units
          .filter((u) => wingUnitIds.includes(u.id))
          .map((u) => u.room_type_code),
      );
      if (codes.size > 0) {
        list = list.filter((p) => p.filterIds.some((id) => codes.has(id)));
      }
    }
    return list;
  }, [photos, filter, wingUnitIds, units]);
  const selectedUnitIds = useMemo(
    () => wingUnitIds ?? selectedUnitIdsForFilter(units, filter),
    [units, filter, wingUnitIds],
  );
  const activeChip =
    galleryChipById(filter, chips) ?? chips[0];

  const applyFilter = useCallback(
    (id: string, scrollToPhotos: boolean) => {
      const raw = (id ?? "all").trim().toLowerCase();
      const next =
        raw === "all" || allowed.has(raw) || GALLERY_AMENITY_FILTER_IDS.has(raw)
          ? raw
          : normalizeGalleryFilter(raw, allowed);
      setFilter(next);
      setWingUnitIds(null);
      setLightboxIndex(null);
      if (scrollToPhotos) {
        document
          .getElementById("gallery-photos")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [allowed],
  );

  const onSelectRoom = useCallback(
    (unit: RoomMapUnit) => {
      const code = unit.room_type_code;
      if (code && allowed.has(code)) applyFilter(code, true);
      else if (unit.facade_side && allowed.has(unit.facade_side)) {
        applyFilter(unit.facade_side, true);
      }
    },
    [allowed, applyFilter],
  );

  const onSelectSpace = useCallback(
    (space: BuildingSpace & { id: string }) => {
      const id = amenityKindToFilter(space.kind);
      if (id) applyFilter(id, true);
    },
    [applyFilter],
  );

  const onSelectFloorWing = useCallback(
    (floorKey: string, nextWing: "front" | "back") => {
      if (!building) return;
      if (floorKey === "All") {
        setFilter("all");
        setWingUnitIds(null);
        setLightboxIndex(null);
        return;
      }
      const split = splitOlakhaFloorWings(building.units, floorKey);
      const group = nextWing === "front" ? split.front : split.back;
      setFilter("all");
      setWingUnitIds(group.map((u) => u.id));
      setLightboxIndex(null);
      document
        .getElementById("gallery-photos")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [building],
  );

  const openAt = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const step = useCallback(
    (delta: number) => {
      setLightboxIndex((current) => {
        if (current == null || visible.length === 0) return current;
        return (current + delta + visible.length) % visible.length;
      });
    },
    [visible.length],
  );

  useEffect(() => {
    if (lightboxIndex == null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, step]);

  const lightboxPhoto =
    lightboxIndex != null ? visible[lightboxIndex] ?? null : null;

  return (
    <div className="space-y-12">
      {building ? (
        <section className="space-y-4">
          <div className="max-w-2xl space-y-2">
            <h2 className="font-display text-2xl text-foreground">
              Walk the house in 3D
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              This is Pelbu Suites in Olakha — tap Ground for lobby, bistro, spa
              and steam; First for the restaurant and meeting room; floors 2–5
              for guest rooms (front or back). Photos below follow what you
              tap.
            </p>
          </div>
          <PublicBuildingExplore
            units={building.units}
            layout={building.layout}
            spaces={building.spaces}
            typeHrefByCode={building.typeHrefByCode}
            selectedUnitIds={selectedUnitIds}
            onSelectRoom={onSelectRoom}
            onSelectSpace={onSelectSpace}
            onSelectFloorWing={onSelectFloorWing}
            legendHint="Orbit the house — tap a floor band, then Ground spaces or Front/Back rooms."
          />
        </section>
      ) : null}

      <section id="gallery-photos" className="space-y-5 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl space-y-1">
            <h2 className="font-display text-2xl text-foreground">
              {activeChip?.kind === "all"
                ? "Photographs from Olakha"
                : activeChip?.label ?? "Photographs"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {visible.length}{" "}
              {visible.length === 1 ? "photograph" : "photographs"}
              {filter !== "all" ? " in this view" : " of the property"}.
            </p>
          </div>
          {activeChip?.href && filter !== "all" ? (
            <Button asChild variant="citrus">
              <Link href={activeChip.href}>
                {activeChip.ctaLabel ?? "Continue"}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/book">Check availability</Link>
            </Button>
          )}
        </div>

        <div className="sticky top-0 z-20 -mx-5 border-y border-border bg-background/95 px-5 py-3 backdrop-blur md:-mx-8 md:px-8">
          <div
            role="tablist"
            aria-label="Gallery sections"
            className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {chips.map((chip) => {
              const selected = chip.id === filter;
              return (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => applyFilter(chip.id, false)}
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center rounded-xl border px-4 text-sm font-medium transition-colors",
                    selected
                      ? "border-juniper bg-juniper text-white"
                      : "border-border bg-background text-foreground hover:bg-secondary",
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No photographs in this section yet — tap All, or ask the desk for a
            look around when you arrive.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            {visible.map((photo, index) => (
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => openAt(index)}
                  className="group w-full overflow-hidden rounded-xl bg-secondary text-left focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                  <CloudinaryMedia
                    publicId={photo.publicId}
                    alt={photo.alt}
                    resourceType={photo.resourceType}
                    posterPublicId={photo.posterPublicId}
                    ratio="4/3"
                    sizes="(max-width: 768px) 50vw, 33vw"
                    priority={index < 4}
                    cinematic={false}
                    controls={false}
                  />
                  {photo.caption || photo.alt ? (
                    <span className="mt-2 block px-1 pb-1 text-xs text-muted-foreground group-hover:text-foreground">
                      {photo.caption || photo.alt}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={lightboxPhoto != null}
        onOpenChange={(open) => {
          if (!open) setLightboxIndex(null);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto border-0 bg-background p-4 sm:p-6">
          <DialogTitle className="pr-8 text-left font-display text-xl">
            {lightboxPhoto?.caption || lightboxPhoto?.alt || "Photograph"}
          </DialogTitle>
          {lightboxPhoto ? (
            <div className="space-y-4">
              <CloudinaryMedia
                publicId={lightboxPhoto.publicId}
                alt={lightboxPhoto.alt}
                resourceType={lightboxPhoto.resourceType}
                posterPublicId={lightboxPhoto.posterPublicId}
                ratio="16/10"
                sizes="90vw"
                cinematic={lightboxPhoto.resourceType === "video"}
                controls={lightboxPhoto.resourceType === "video"}
                quality={90}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {(lightboxIndex ?? 0) + 1} of {visible.length}
                </p>
                {visible.length > 1 ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      aria-label="Previous photograph"
                      onClick={() => step(-1)}
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      aria-label="Next photograph"
                      onClick={() => step(1)}
                    >
                      <ChevronRightIcon />
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
