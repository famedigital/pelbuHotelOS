import Link from "next/link";
import { PublicMegaNav } from "@/components/site/PublicMegaNav";
import { buildMegaMenus } from "@/lib/mega-menu";
import { loadMegaMenuMedia } from "@/lib/nav-mega-menu";
import { loadPublicRooms } from "@/lib/public-content";
import { SITE_NAME } from "@/lib/site";

export async function PublicSiteHeader({
  propertyName,
}: {
  propertyName?: string | null;
}) {
  const [rooms, media] = await Promise.all([
    loadPublicRooms(),
    loadMegaMenuMedia(),
  ]);
  const menus = buildMegaMenus(rooms, media);
  const brand = propertyName?.trim() || SITE_NAME;

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="min-w-0 shrink-0">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">
            {brand}
          </p>
          <p className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Hotel site
          </p>
        </Link>
        <div className="flex flex-1 items-center justify-end gap-3">
          <PublicMegaNav menus={menus} />
          <Link
            href="/book"
            className="hidden rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground sm:inline-flex"
          >
            Book
          </Link>
        </div>
      </div>
    </header>
  );
}
