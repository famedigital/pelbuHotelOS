import { MegaMenuMediaEditor } from "@/components/erp/cms/MegaMenuMediaEditor";
import { DeskPageTitle } from "@/components/erp/DeskShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import {
  buildMegaMenus,
  collectMegaMediaSlots,
  EMPTY_MEGA_MENU_MEDIA,
} from "@/lib/mega-menu";
import { loadMegaMenuMediaAdmin } from "@/lib/nav-mega-menu";
import { loadPublicRooms } from "@/lib/public-content";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Navigation mega menu | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MegaMenuNavigationPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const propertyId = await requireDeskPropertyId();
  const [adminMedia, rooms] = await Promise.all([
    loadMegaMenuMediaAdmin(propertyId),
    loadPublicRooms(),
  ]);

  if (!adminMedia) {
    return (
      <div className="erp p-6">
        <p className="text-destructive">Could not load mega menu settings.</p>
      </div>
    );
  }

  // Slots use code defaults (no CMS) so "Default" can restore them.
  const defaultSlots = collectMegaMediaSlots(
    buildMegaMenus(rooms, EMPTY_MEGA_MENU_MEDIA),
  );

  const overrides: Record<string, string> = {};
  for (const [label, id] of Object.entries(adminMedia.draft.features)) {
    overrides[`feature::${label}`] = id;
  }
  for (const [key, id] of Object.entries(adminMedia.draft.items)) {
    overrides[key] = id;
  }

  return (
    <div className="erp mx-auto w-full max-w-[1100px] space-y-6 p-4 md:p-6">
      <DeskPageTitle
        eyebrow="Website CMS"
        title="Mega menu photos"
        description="Thumbnails on Stay / Menu / Wellness / Business / About dropdowns and the right-rail promo tiles. Stay room photos can also be set on each room type under Settings."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                adminMedia.has_unpublished_changes ? "citrus" : "mint"
              }
            >
              {adminMedia.has_unpublished_changes ? "Draft" : "Live"}
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link href="/erp/front-public">CMS hub</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/" target="_blank">
                View site
                <ExternalLinkIcon className="size-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <MegaMenuMediaEditor
        slots={defaultSlots}
        overrides={overrides}
        hasUnpublishedChanges={adminMedia.has_unpublished_changes}
      />
    </div>
  );
}
