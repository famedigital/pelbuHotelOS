import { SiteHeader } from "@/components/site/SiteHeader";
import { buildMegaMenus } from "@/lib/mega-menu";
import { loadPublicRooms } from "@/lib/public-content";

type Props = {
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
  const rooms = await loadPublicRooms();
  return (
    <SiteHeader
      logoSrc={logoSrc}
      variant={variant}
      menus={buildMegaMenus(rooms)}
    />
  );
}
