"use client";

import { BrandLockup } from "@/components/site/BrandLockup";
import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import { buttonVariants } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import type { MegaLink, MegaMenu } from "@/lib/mega-menu";
import {
  DEFAULT_HERO_THEME,
  heroNavBarStyle,
  heroNavPanelStyle,
  hexAlpha,
  parseHeroTheme,
  type HeroTheme,
} from "@/lib/hero-theme";
import { cn } from "@/lib/utils";
import { ArrowRightIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Variant = "hero" | "solid";

/**
 * Trigger shell while floating over the hero — colour comes from CMS
 * `navText` via inline style so editors can go light or dark.
 */
const HERO_TRIGGER =
  "bg-transparent [text-shadow:0_1px_2px_rgb(0_0_0/0.35)] hover:bg-white/10 focus:bg-white/10 data-[state=open]:bg-white/12";

type Tone = "hero" | "solid";

/** Solid-page chrome only. Hero bar/panel styles are CMS inline glass. */
const BAR_SURFACE_SOLID =
  "border-b border-border/70 bg-background/90 shadow-sm backdrop-blur-xl";

const PANEL_SURFACE_SOLID =
  "border-sky-100 bg-white/92 text-foreground backdrop-blur-3xl shadow-[0_30px_80px_-45px_rgb(8_47_73/0.45)]";

/**
 * Shared card surface for the feature tile and the list rows. The hover state
 * has to set a background *colour* — the primitive ships `hover:bg-secondary`,
 * and a gradient alone would let that light default bleed through on hero tone.
 */
const PANEL_CARD: Record<Tone, string> = {
  hero: "border-white/10 bg-white/[0.06] hover:border-white/30 hover:bg-white/[0.13] focus:bg-white/[0.16]",
  solid:
    "border-border/50 bg-white/60 hover:border-sky-100 hover:bg-white focus:bg-white",
};

/**
 * Brand hairline on the solid bar. Over the hero it softens to a light catch
 * on the glass edge — the full sky → citrus → mint ramp there draws a hard line
 * that reads as the top of a separate card.
 */
const PANEL_EDGE: Record<Tone, string> = {
  hero: "bg-gradient-to-r from-transparent via-white/30 to-transparent",
  solid: "bg-gradient-to-r from-sky-500 via-citrus to-mint-500",
};

const PANEL_TITLE: Record<Tone, string> = {
  hero: "text-white group-hover/link:text-citrus-soft",
  solid: "text-foreground group-hover/link:text-sky-700",
};

const PANEL_DESC: Record<Tone, string> = {
  hero: "text-white/70",
  solid: "text-muted-foreground",
};

const PANEL_CUE: Record<Tone, string> = {
  hero: "text-citrus-soft",
  solid: "text-sky-700",
};

const PANEL_HEADING: Record<Tone, string> = {
  hero: "text-white/55",
  solid: "text-muted-foreground",
};

/** Sidebar tiles. Flat surfaces — they are containers, not link targets. */
const PANEL_TILE: Record<Tone, string> = {
  hero: "border-white/10 bg-white/[0.07]",
  solid: "border-border/60 bg-sky-50/70",
};

/**
 * `NavigationMenuLink` ships `flex flex-col gap-1 p-3` for stacked nav items.
 * When it carries button styling instead, `flex-col` puts the arrow on a line
 * under the label and the vertical padding fights the fixed button height —
 * neither of which `buttonVariants` overrides, since it sets no flex-direction
 * and only a horizontal padding. Undo both explicitly.
 */
const CTA_RESET = "flex-row py-0";

const PANEL_CTA: Record<Tone, string> = {
  hero: "border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white",
  solid: "",
};

function GroupHeading({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: Tone;
}) {
  return (
    <h3
      className={cn(
        "mb-2 text-[11px] font-semibold uppercase tracking-[0.16em]",
        PANEL_HEADING[tone],
      )}
    >
      {children}
    </h3>
  );
}

/**
 * Wide-column row: thumbnail, then title over a full sentence. The sentence
 * names the entity and place, so the nav gives search and answer engines real
 * context instead of bare labels.
 */
function MegaRow({ item, tone }: { item: MegaLink; tone: Tone }) {
  return (
    <li>
      {/* Styling lives on the link primitive so `cn` can resolve the tone
          overrides — `asChild` only concatenates child classes. */}
      <NavigationMenuLink
        asChild
        className={cn(
          "group/link flex flex-row items-center gap-3 rounded-xl border p-2",
          PANEL_CARD[tone],
        )}
      >
        <Link href={item.href}>
          {item.publicId ? (
            <CloudinaryImage
              publicId={item.publicId}
              alt=""
              ratio="1/1"
              sizes="48px"
              className="size-12 shrink-0 rounded-lg"
              imgClassName="transition-transform duration-500 motion-safe:group-hover/link:scale-[1.06]"
            />
          ) : null}

          <span className="min-w-0 flex-1">
            <span
              className={cn("block text-sm font-semibold", PANEL_TITLE[tone])}
            >
              {item.title}
            </span>
            {item.description ? (
              <span
                className={cn(
                  "mt-0.5 block text-xs leading-5",
                  PANEL_DESC[tone],
                )}
              >
                {item.description}
              </span>
            ) : null}
          </span>

          <ChevronRightIcon
            className={cn(
              "mr-1 size-4 shrink-0 transition-all duration-300 motion-safe:-translate-x-1 motion-safe:opacity-0 motion-safe:group-hover/link:translate-x-0 motion-safe:group-hover/link:opacity-100",
              PANEL_CUE[tone],
            )}
            aria-hidden
          />
        </Link>
      </NavigationMenuLink>
    </li>
  );
}

/** Narrow-column shortcut: label only, no thumbnail or sentence. */
function MegaShortcut({ item, tone }: { item: MegaLink; tone: Tone }) {
  return (
    <li>
      <NavigationMenuLink
        asChild
        className={cn(
          "group/link flex flex-row items-center gap-2 rounded-lg px-2 py-1.5",
          PANEL_CARD[tone],
          "border-transparent bg-transparent",
        )}
      >
        <Link href={item.href}>
          <span
            className={cn("min-w-0 flex-1 text-sm font-medium", PANEL_TITLE[tone])}
          >
            {item.title}
          </span>
          <ChevronRightIcon
            className={cn(
              "size-3.5 shrink-0 transition-all duration-300 motion-safe:-translate-x-1 motion-safe:opacity-0 motion-safe:group-hover/link:translate-x-0 motion-safe:group-hover/link:opacity-100",
              PANEL_CUE[tone],
            )}
            aria-hidden
          />
        </Link>
      </NavigationMenuLink>
    </li>
  );
}

/**
 * Three columns: detailed offerings, quick shortcuts, then a promo rail. The
 * promo cards are plain containers with the CTA as the only focusable target —
 * wrapping the whole tile in a link would nest a button inside an anchor.
 */
function MegaPanel({ menu, tone }: { menu: MegaMenu; tone: Tone }) {
  if (menu.primary.length === 0) return null;

  return (
    <div className="relative w-[min(92vw,58rem)] p-5">
      <span
        className={cn("absolute inset-x-0 top-0 h-px", PANEL_EDGE[tone])}
        aria-hidden
      />

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,0.85fr)_minmax(0,1.1fr)] gap-6">
        <div className="space-y-4">
          {menu.primary.map((group) => (
            <div key={group.heading}>
              <GroupHeading tone={tone}>{group.heading}</GroupHeading>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <MegaRow key={item.href} item={item} tone={tone} />
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {menu.secondary.map((group) => (
            <div key={group.heading}>
              <GroupHeading tone={tone}>{group.heading}</GroupHeading>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <MegaShortcut key={item.href} item={item} tone={tone} />
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className={cn("rounded-xl border p-3", PANEL_TILE[tone])}>
            {menu.feature.publicId ? (
              <CloudinaryImage
                publicId={menu.feature.publicId}
                alt=""
                ratio="16/9"
                sizes="260px"
                className="rounded-lg"
              />
            ) : null}
            <h3
              className={cn(
                "mt-3 text-sm font-semibold",
                tone === "hero" ? "text-white" : "text-foreground",
              )}
            >
              {menu.feature.title}
            </h3>
            <p className={cn("mt-1 text-xs leading-5", PANEL_DESC[tone])}>
              {menu.feature.description}
            </p>
            <NavigationMenuLink
              asChild
              className={cn(
                buttonVariants({ variant: "citrus", size: "sm" }),
                CTA_RESET,
                "mt-3 w-full",
              )}
            >
              <Link href={menu.feature.href}>
                {menu.feature.ctaLabel}
                <ArrowRightIcon aria-hidden />
              </Link>
            </NavigationMenuLink>
          </div>

          <div className={cn("rounded-xl border p-3", PANEL_TILE[tone])}>
            <h3
              className={cn(
                "text-sm font-semibold",
                tone === "hero" ? "text-white" : "text-foreground",
              )}
            >
              {menu.contact.title}
            </h3>
            <p className={cn("mt-1 text-xs leading-5", PANEL_DESC[tone])}>
              {menu.contact.description}
            </p>
            <NavigationMenuLink
              asChild
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                CTA_RESET,
                "mt-3 w-full",
                PANEL_CTA[tone],
              )}
            >
              <Link href={menu.contact.href}>{menu.contact.ctaLabel}</Link>
            </NavigationMenuLink>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Sticky frosted mega menu. Glass over homepage hero is CMS-editable. */
export function SiteHeader({
  logoSrc,
  logoSizeRem,
  logoOffsetPct,
  logoGapRem,
  variant = "solid",
  menus,
  heroTheme,
}: {
  logoSrc?: string | null;
  logoSizeRem?: number;
  logoOffsetPct?: number;
  logoGapRem?: number;
  variant?: Variant;
  menus: MegaMenu[];
  /** From home CMS `hero_theme` — only used while variant is `hero`. */
  heroTheme?: HeroTheme | null;
}) {
  const logo = logoSrc;
  const [scrolled, setScrolled] = useState(false);
  const chrome = parseHeroTheme(heroTheme ?? DEFAULT_HERO_THEME);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const overHero = variant === "hero" && !scrolled;
  const tone: Tone = overHero ? "hero" : "solid";
  const navText = chrome.navText;

  return (
    <header
      className={cn(
        "z-40 overflow-visible",
        variant === "hero" ? "fixed inset-x-0 top-0" : "sticky top-0",
        overHero ? undefined : "text-foreground",
      )}
      style={overHero ? { color: navText } : undefined}
    >
      <div className="relative h-12 overflow-visible md:h-[3.25rem]">
        {/* Sibling layer so mega-menu backdrop-filter still samples the page. */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300",
            overHero ? undefined : BAR_SURFACE_SOLID,
          )}
          style={overHero ? heroNavBarStyle(chrome) : undefined}
          aria-hidden
        />
        <div className="relative mx-auto flex h-full max-w-[1200px] items-center justify-between gap-4 px-5 md:px-8">
          <BrandLockup
            logoSrc={logo}
            tone={tone}
            sizeRem={logoSizeRem}
            offsetPct={logoOffsetPct}
            gapRem={logoGapRem}
            color={overHero ? navText : undefined}
          />

          <NavigationMenu
            className="relative z-10 hidden lg:flex"
            viewport
            viewportClassName={
              overHero
                ? "border bg-transparent text-inherit backdrop-blur-none"
                : PANEL_SURFACE_SOLID
            }
            viewportStyle={overHero ? heroNavPanelStyle(chrome) : undefined}
          >
            <NavigationMenuList>
              {menus.map((menu) => (
                <NavigationMenuItem key={menu.label}>
                  <NavigationMenuTrigger
                    className={cn("h-9", overHero ? HERO_TRIGGER : undefined)}
                    style={overHero ? { color: navText } : undefined}
                  >
                    {menu.label}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <MegaPanel menu={menu} tone={tone} />
                  </NavigationMenuContent>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>

          <div className="relative z-10 flex shrink-0 items-center gap-2">
            <Link
              href="/login"
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-lg px-3 text-[13px] font-semibold transition-colors",
                overHero
                  ? "[text-shadow:0_1px_2px_rgb(0_0_0/0.3)] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.35)] backdrop-blur-md hover:opacity-90"
                  : "border border-border bg-background/80 text-foreground hover:bg-muted",
              )}
              style={
                overHero
                  ? {
                      color: navText,
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderColor: hexAlpha(navText, 0.4),
                      backgroundColor: hexAlpha(navText, 0.12),
                    }
                  : undefined
              }
            >
              Login
            </Link>
            <Link
              href="/book"
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-lg px-3.5 text-[13px] font-semibold transition-colors",
                overHero
                  ? "bg-citrus text-sky-ink hover:bg-citrus-soft"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              Book
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
