"use client";

import { BrandLockup } from "@/components/site/BrandLockup";
import { MobileMegaNav } from "@/components/site/MobileMegaNav";
import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import { usePublicMenuChromeOptional } from "@/components/site/public-menu-chrome";
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
  parseHeroTheme,
  type HeroTheme,
} from "@/lib/hero-theme";
import { cn } from "@/lib/utils";
import { ArrowRightIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Variant = "hero" | "solid";
type Tone = "hero" | "solid";

const HERO_TRIGGER =
  "bg-transparent [text-shadow:0_1px_2px_rgb(0_0_0/0.35)] hover:bg-white/10 focus:bg-white/10 data-[state=open]:bg-white/12";

/** Liquid glass bar — logo stays visible on light pages. */
const BAR_SURFACE_SOLID =
  "border-b border-cedar-rule/50 bg-white/55 shadow-[0_8px_32px_-18px_rgba(18,26,23,0.28)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/40";

const PANEL_SURFACE_SOLID =
  "border-cedar-rule/50 bg-white/90 text-foreground shadow-[0_24px_60px_-40px_rgb(18_26_23/0.35)] backdrop-blur-xl";

const PANEL_CARD: Record<Tone, string> = {
  hero: "border-white/10 bg-white/[0.06] hover:border-white/30 hover:bg-white/[0.13] focus:bg-white/[0.16]",
  solid:
    "border-border/60 bg-white hover:border-juniper/30 hover:bg-mist-1 focus:bg-mist-1",
};

const PANEL_EDGE: Record<Tone, string> = {
  hero: "bg-gradient-to-r from-transparent via-ember/70 to-transparent",
  solid: "bg-ember",
};

const PANEL_TITLE: Record<Tone, string> = {
  hero: "text-white group-hover/link:text-ember-soft",
  solid: "text-foreground group-hover/link:text-juniper",
};

const PANEL_DESC: Record<Tone, string> = {
  hero: "text-white/70",
  solid: "text-muted-foreground",
};

const PANEL_CUE: Record<Tone, string> = {
  hero: "text-ember-soft",
  solid: "text-juniper",
};

const PANEL_HEADING: Record<Tone, string> = {
  hero: "text-white/55",
  solid: "text-muted-foreground",
};

const PANEL_TILE: Record<Tone, string> = {
  hero: "border-white/10 bg-white/[0.07]",
  solid: "border-border bg-mist-1/80",
};

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
        "mb-2 text-[11px] font-semibold uppercase tracking-[0.18em]",
        PANEL_HEADING[tone],
      )}
    >
      {children}
    </h3>
  );
}

function MegaRow({ item, tone }: { item: MegaLink; tone: Tone }) {
  return (
    <li>
      <NavigationMenuLink
        asChild
        className={cn(
          "group/link flex flex-row items-center gap-3 rounded-md border p-2",
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
              className="size-12 shrink-0 rounded-md"
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

function MegaShortcut({ item, tone }: { item: MegaLink; tone: Tone }) {
  return (
    <li>
      <NavigationMenuLink
        asChild
        className={cn(
          "group/link flex flex-row items-center gap-2 rounded-md px-2 py-1.5",
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

function MegaPanel({ menu, tone }: { menu: MegaMenu; tone: Tone }) {
  if (menu.primary.length === 0) return null;

  return (
    <div className="relative w-full px-5 py-7 md:px-8 lg:px-10">
      <span
        className={cn("absolute inset-x-0 top-0 h-0.5", PANEL_EDGE[tone])}
        aria-hidden
      />

      <div className="mx-auto max-h-[min(70vh,36rem)] max-w-[1200px] overflow-y-auto overscroll-contain">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)_minmax(0,0.75fr)]">
        <div className={cn("overflow-hidden rounded-md border", PANEL_TILE[tone])}>
          {menu.feature.publicId ? (
            <CloudinaryImage
              publicId={menu.feature.publicId}
              alt=""
              ratio="4/3"
              sizes="(max-width: 1024px) 100vw, 380px"
              className="rounded-none"
              imgClassName="object-cover"
            />
          ) : null}
          <div className="p-4">
            <h3
              className={cn(
                "font-display text-xl font-semibold tracking-tight",
                tone === "hero" ? "text-white" : "text-foreground",
              )}
            >
              {menu.feature.title}
            </h3>
            <p className={cn("mt-2 text-sm leading-6", PANEL_DESC[tone])}>
              {menu.feature.description}
            </p>
            <NavigationMenuLink
              asChild
              className={cn(
                buttonVariants({ variant: "ember", size: "sm" }),
                CTA_RESET,
                "mt-4 w-full motion-safe:transition-transform motion-safe:hover:-translate-y-0.5",
              )}
            >
              <Link href={menu.feature.href}>
                {menu.feature.ctaLabel}
                <ArrowRightIcon aria-hidden />
              </Link>
            </NavigationMenuLink>
          </div>
        </div>

        <div className="space-y-5">
          {menu.primary.map((group) => (
            <div key={group.heading}>
              <GroupHeading tone={tone}>{group.heading}</GroupHeading>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <MegaRow key={item.href} item={item} tone={tone} />
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="space-y-5">
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

          <div className={cn("rounded-md border p-4", PANEL_TILE[tone])}>
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
    </div>
  );
}

function MenuTriggers({
  menus,
  tone,
  overHero,
  navText,
  triggerClass,
}: {
  menus: MegaMenu[];
  tone: Tone;
  overHero: boolean;
  navText: string;
  triggerClass?: string;
}) {
  return (
    <>
      {menus.map((menu) => (
        <NavigationMenuItem key={menu.label}>
          <NavigationMenuTrigger
            className={cn(
              "h-9 px-2.5 text-[13px]",
              overHero
                ? HERO_TRIGGER
                : "text-cedar-ink hover:bg-juniper/8 hover:text-juniper focus:bg-juniper/8 data-[state=open]:bg-juniper/10",
              triggerClass,
            )}
            style={overHero ? { color: navText } : undefined}
          >
            {menu.label}
          </NavigationMenuTrigger>
          <NavigationMenuContent className="w-full md:w-full">
            <MegaPanel menu={menu} tone={tone} />
          </NavigationMenuContent>
        </NavigationMenuItem>
      ))}
    </>
  );
}

/** Centered brand · menus split left/right · liquid glass bar. */
export function SiteHeader({
  logoSrc,
  logoSizeRem,
  logoOffsetPct,
  logoGapRem,
  logoShiftXRem,
  variant = "solid",
  menus,
  heroTheme,
}: {
  logoSrc?: string | null;
  logoSizeRem?: number;
  logoOffsetPct?: number;
  logoGapRem?: number;
  logoShiftXRem?: number;
  variant?: Variant;
  menus: MegaMenu[];
  heroTheme?: HeroTheme | null;
}) {
  const logo = logoSrc;
  const [scrolled, setScrolled] = useState(false);
  const [isLg, setIsLg] = useState(false);
  const chrome = parseHeroTheme(heroTheme ?? DEFAULT_HERO_THEME);
  const menuChrome = usePublicMenuChromeOptional();
  const hideForMenuMobile = Boolean(menuChrome?.hideChrome) && !isLg;

  const { leftMenus, rightMenus } = useMemo(() => {
    const mid = Math.ceil(menus.length / 2);
    return {
      leftMenus: menus.slice(0, mid),
      rightMenus: menus.slice(mid),
    };
  }, [menus]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsLg(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
        overHero ? undefined : "text-cedar-ink",
        hideForMenuMobile && "pointer-events-none border-0 shadow-none",
      )}
      style={overHero ? { color: navText } : undefined}
      aria-hidden={hideForMenuMobile || undefined}
    >
      <div
        className={cn(
          "relative w-full",
          hideForMenuMobile
            ? "h-0 max-h-0 overflow-hidden opacity-0"
            : "h-14 overflow-visible md:h-16",
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300",
            overHero ? "hidden md:block" : BAR_SURFACE_SOLID,
          )}
          style={overHero ? heroNavBarStyle(chrome) : undefined}
          aria-hidden
        />

        {/* Full-width nav root so mega panel aligns to the viewport */}
        <NavigationMenu
          className="relative z-10 mx-auto flex h-full w-full max-w-none justify-stretch"
          viewport
          viewportClassName={cn(
            "mt-0 w-full max-w-none rounded-none border-x-0 border-t-0",
            overHero
              ? "border bg-transparent text-inherit backdrop-blur-none"
              : PANEL_SURFACE_SOLID,
          )}
          viewportStyle={overHero ? heroNavPanelStyle(chrome) : undefined}
        >
          <div className="mx-auto grid h-full w-full max-w-[1200px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 md:px-8">
            <div className="flex min-w-0 items-center justify-start gap-1 lg:justify-end">
              <MobileMegaNav
                menus={menus}
                overHero={overHero}
                navText={navText}
              />
              <NavigationMenuList className="hidden justify-end gap-0 lg:flex">
                <MenuTriggers
                  menus={leftMenus}
                  tone={tone}
                  overHero={overHero}
                  navText={navText}
                />
              </NavigationMenuList>
            </div>

            <div className="flex justify-center px-2">
              <BrandLockup
                logoSrc={logo}
                tone={tone}
                sizeRem={
                  overHero ? Math.max(logoSizeRem ?? 6.5, 6.5) : logoSizeRem
                }
                offsetPct={
                  overHero ? Math.min(logoOffsetPct ?? 35, 32) : logoOffsetPct
                }
                gapRem={
                  overHero ? Math.max(logoGapRem ?? 0.55, 0.5) : logoGapRem
                }
                shiftXRem={
                  overHero ? Math.min(logoShiftXRem ?? 0, 0.25) : logoShiftXRem
                }
                color={overHero ? navText : undefined}
                className={cn(
                  "min-w-0",
                  overHero && "max-w-[min(78vw,22rem)] md:max-w-none",
                )}
                flushMobile={overHero}
              />
            </div>

            <div className="flex min-w-0 items-center justify-end gap-2 lg:justify-start">
              <NavigationMenuList className="hidden justify-start gap-0 lg:flex">
                <MenuTriggers
                  menus={rightMenus}
                  tone={tone}
                  overHero={overHero}
                  navText={navText}
                />
              </NavigationMenuList>

              <div className="flex shrink-0 items-center gap-2 lg:ml-2">
                <Link
                  href="/login"
                  className={cn(
                    "hidden min-h-11 items-center justify-center rounded-md px-3.5 text-[13px] font-semibold transition-colors sm:inline-flex md:h-9 md:min-h-0 md:px-3",
                    overHero
                      ? "border border-white/30 bg-white/10 text-inherit hover:bg-white/20"
                      : "border border-cedar-rule/80 bg-white/50 text-cedar-ink hover:bg-white/80",
                  )}
                >
                  Login
                </Link>
                <Link
                  href="/book"
                  className={cn(
                    "inline-flex h-9 items-center justify-center rounded-md bg-ember px-3.5 text-[13px] font-semibold text-white transition-all hover:bg-ember-deep motion-safe:hover:-translate-y-0.5",
                    overHero && "md:inline-flex",
                  )}
                >
                  Book
                </Link>
              </div>
            </div>
          </div>
        </NavigationMenu>
      </div>
    </header>
  );
}
