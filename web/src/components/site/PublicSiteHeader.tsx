import { SiteHeader } from "@/components/site/SiteHeader";
import { loadCmsPage } from "@/lib/cms";
import { buildMegaMenus } from "@/lib/mega-menu";
import { loadPublicLogoLayout } from "@/lib/public-logo";
import { loadPublicRooms } from "@/lib/public-content";
import { safePublic } from "@/lib/public-safe";
import type { HeroTheme } from "@/lib/hero-theme";

type Props = {
  /** Override; when omitted, uses Settings → Identity logo then local mark. */
  logoSrc?: string | null;
  variant?: "hero" | "solid";
  /** Homepage CMS hero glass/nav — omit to load home page when variant is hero. */
  heroTheme?: HeroTheme | null;
};

/**
 * Server wrapper: loads sellable room types and builds the public mega menus
 * so Stay showcases live categories on every conversion page.
 * On hero variant, loads home `hero_theme` for CMS-editable nav glass.
 */
export async function PublicSiteHeader({
  logoSrc,
  variant = "solid",
  heroTheme,
}: Props) {
  const [rooms, logoLayout, homeTheme] = await Promise.all([
    loadPublicRooms(),
    loadPublicLogoLayout(),
    variant === "hero" && heroTheme == null
      ? safePublic(
          "home-hero-theme",
          async () => (await loadCmsPage("home"))?.hero_theme ?? null,
          null,
        )
      : Promise.resolve(heroTheme ?? null),
  ]);
  return (
    <SiteHeader
      logoSrc={logoSrc != null && logoSrc !== "" ? logoSrc : logoLayout.src}
      logoSizeRem={logoLayout.sizeRem}
      logoOffsetPct={logoLayout.offsetPct}
      logoGapRem={logoLayout.gapRem}
      logoShiftXRem={logoLayout.shiftXRem}
      variant={variant}
      heroTheme={homeTheme}
      menus={buildMegaMenus(rooms)}
    />
  );
}
