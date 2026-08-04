import { SiteHeader } from "@/components/site/SiteHeader";
import { buildMegaMenus } from "@/lib/mega-menu";
import { loadPublicLogoSrc } from "@/lib/public-logo";
import { loadPublicRooms } from "@/lib/public-content";

type Props = {
  /** Override; when omitted, uses Settings → Identity logo then local mark. */
  logoSrc?: string | null;
  variant?: "hero" | "solid";
};

/**
 * Server wrapper: loads sellable room types and builds the public mega menus
 * so Stay showcases live categories on every conversion page.
 */
export async function PublicSiteHeader({
  logoSrc,
  variant = "solid",
}: Props) {
  const [rooms, propertyLogo] = await Promise.all([
    loadPublicRooms(),
    logoSrc != null && logoSrc !== ""
      ? Promise.resolve(logoSrc)
      : loadPublicLogoSrc(),
  ]);
  return (
    <SiteHeader
      logoSrc={propertyLogo}
      variant={variant}
      menus={buildMegaMenus(rooms)}
    />
  );
}
