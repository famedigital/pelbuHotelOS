"use client";

import { PublicBuildingExplore } from "@/components/site/PublicBuildingExplore";
import { useStaySearchOptional } from "@/components/site/PublicStaySearch";
import type { PublicBuildingMap } from "@/lib/public-building-map";
import { FACADE_HERO_THEME, hexAlpha } from "@/lib/hero-theme";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";

type Props = {
  building: PublicBuildingMap;
  eyebrow: string;
  title: string;
  description: string;
  secondaryHref: string;
  secondaryLabel: string;
  fromPriceBtn?: number | null;
  taxInclusive?: boolean;
};

/**
 * Homepage first screen: the house fills the viewport and turns.
 * Copy stays a slim dock so drag/orbit hits the 3D, not a text overlay.
 */
export function HomeHeroFacade({
  building,
  eyebrow,
  title,
  description,
  secondaryHref,
  secondaryLabel,
  fromPriceBtn,
  taxInclusive,
}: Props) {
  const theme = FACADE_HERO_THEME;
  const staySearch = useStaySearchOptional();

  const priceHint =
    fromPriceBtn != null && fromPriceBtn > 0
      ? `From ${formatBtn(fromPriceBtn)}/nt`
      : "Live rates";

  function openBook() {
    staySearch?.openStaySearch({
      fromPriceBtn: fromPriceBtn ?? null,
      taxInclusive: Boolean(taxInclusive),
    });
  }

  return (
    <section
      className="relative isolate h-[100dvh] min-h-[100svh] w-full overflow-hidden"
      style={{ backgroundColor: "#dfe8df" }}
      aria-label="Pelbu Suites in 3D"
    >
      <div className="absolute inset-0 h-full w-full touch-none overscroll-none">
        <PublicBuildingExplore
          variant="hero"
          units={building.units}
          layout={building.layout}
          spaces={building.spaces}
          typeHrefByCode={building.typeHrefByCode}
          onSelectFloorWing={() => {
            /* Stay on the hero — amenities still route via space taps. */
          }}
          legendHint="Drag to turn the house"
        />
      </div>

      <p className="pointer-events-none absolute left-1/2 top-[max(4.5rem,calc(env(safe-area-inset-top,0px)+3.5rem))] z-10 -translate-x-1/2 rounded-full bg-background/70 px-3 py-1.5 text-[11px] font-medium text-foreground/80 shadow-sm backdrop-blur-md md:top-24">
        <span className="md:hidden">Swipe to turn · pinch to zoom</span>
        <span className="hidden md:inline">Drag to turn · scroll to move closer</span>
      </p>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[28%] md:h-[24%]"
        style={{
          background: `linear-gradient(to top, ${hexAlpha("#faf6ef", 0.92)} 0%, ${hexAlpha("#faf6ef", 0.4)} 55%, transparent 100%)`,
        }}
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-[1200px] flex-col gap-3 px-5 pb-[calc(4rem+env(safe-area-inset-bottom,0px)+0.75rem)] md:flex-row md:items-end md:justify-between md:px-8 md:pb-10">
        <div className="min-w-0">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: theme.eyebrow }}
          >
            {eyebrow}
          </p>
          <h1
            className="mt-1 max-w-[28ch] font-display text-xl leading-tight [text-wrap:balance] line-clamp-2 md:text-4xl"
            style={{ color: theme.title }}
          >
            {title}
          </h1>
          <p className="sr-only">{description}</p>
          <div className="pointer-events-auto mt-2 flex flex-wrap items-center gap-3">
            <Link
              href={secondaryHref}
              className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold backdrop-blur-md"
              style={{
                color: theme.button,
                borderColor: hexAlpha(theme.button, 0.45),
                backgroundColor: hexAlpha("#ffffff", 0.78),
              }}
            >
              {secondaryLabel}
            </Link>
            <Link
              href="/gallery"
              className="inline-flex min-h-11 items-center text-sm font-semibold underline-offset-4 hover:underline"
              style={{ color: theme.body }}
            >
              Open gallery
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={openBook}
          className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-xl border border-border bg-sky-ink/95 px-3.5 py-3 text-left text-ivory shadow-[0_10px_32px_-14px_rgba(8,47,73,0.7)] md:w-auto md:min-w-[280px]"
          aria-label="Open date search to book stay"
          aria-haspopup="dialog"
        >
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ivory/70">
              Book direct
            </span>
            <span className="mt-0.5 block truncate text-[13px] font-medium leading-snug">
              Check dates · {priceHint}
              {taxInclusive && fromPriceBtn != null && fromPriceBtn > 0
                ? " · inc. tax"
                : ""}
            </span>
          </span>
          <span className="inline-flex h-11 shrink-0 items-center rounded-lg bg-citrus px-4 text-sm font-semibold text-espresso">
            Book
          </span>
        </button>
      </div>
    </section>
  );
}
