import { DeskListShell } from "@/components/erp/DeskListShell";
import { CmsMediaManager } from "@/components/erp/cms/CmsMediaManager";
import { TrustMediaHub } from "@/components/erp/cms/TrustMediaHub";
import { Button } from "@/components/ui/button";
import { loadCmsMediaGroups } from "@/lib/cms-media-admin";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { loadPropertyMediaForProperty } from "@/lib/property-media-loader";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ArrowLeftIcon, SmartphoneIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Media library | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Search = {
  tab?: string;
  scope?: string;
  id?: string;
  view?: string;
};

export default async function FrontPublicMediaPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const params = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [
    groups,
    media,
    roomTypesRes,
    unitsRes,
    menuRes,
    staffRes,
    propRes,
  ] = await Promise.all([
    loadCmsMediaGroups(admin, propertyId),
    loadPropertyMediaForProperty(admin, propertyId, { publishedOnly: false }),
    admin
      .from("room_types")
      .select("id, code, name, inventory_kind")
      .eq("property_id", propertyId)
      .eq("inventory_kind", "sellable_guest")
      .order("code"),
    admin
      .from("room_units")
      .select("id, label, room_type_id, room_types(name, code)")
      .eq("property_id", propertyId)
      .order("sort_order")
      .order("label"),
    admin
      .from("menu_items")
      .select("id, name, outlet")
      .eq("property_id", propertyId)
      .eq("is_available", true)
      .order("name")
      .limit(200),
    admin
      .from("staff_members")
      .select(
        "id, full_name, role_label, phone, show_on_team, team_role_label, team_sort_order, status",
      )
      .eq("property_id", propertyId)
      .in("status", ["active", "provisional"])
      .order("full_name"),
    admin.from("properties").select("slug, name").eq("id", propertyId).maybeSingle(),
  ]);

  const propCode =
    ((propRes.data?.slug as string | null) ?? "pelbu")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 40) || "pelbu";

  const view = params.view === "pages" ? "pages" : "trust";

  const tabMap = {
    room_type: "room_type",
    room_unit: "room_unit",
    property_area: "property_area",
    menu_item: "menu_item",
    staff: "staff",
    rooms: "room_type",
    units: "room_unit",
    property: "property_area",
    food: "menu_item",
    team: "staff",
  } as const;
  const initialTabKey = params.tab ?? params.scope ?? "room_type";
  const initialTab =
    tabMap[initialTabKey as keyof typeof tabMap] ?? "room_type";

  return (
    <DeskListShell
      eyebrow="Website CMS"
      heading="Media library"
      blurb="Trust media: real room, property, food, and team photos for the public site. Page heroes (home slider) stay under Page media."
      headerAside={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="citrus">
            <Link href="/erp/front-public/media/upload">
              <SmartphoneIcon className="size-4" />
              Phone upload
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/erp/front-public">
              <ArrowLeftIcon className="size-4" />
              Back to CMS
            </Link>
          </Button>
        </div>
      }
      filters={
        <>
          <Button
            asChild
            variant={view === "trust" ? "default" : "outline"}
            size="sm"
          >
            <Link href="/erp/front-public/media">Trust media</Link>
          </Button>
          <Button
            asChild
            variant={view === "pages" ? "default" : "outline"}
            size="sm"
          >
            <Link href="/erp/front-public/media?view=pages">Page media</Link>
          </Button>
        </>
      }
    >
      {view === "pages" ? (
        <CmsMediaManager groups={groups} />
      ) : (
        <TrustMediaHub
          propCode={propCode}
          initialTab={initialTab}
          initialScopeId={params.id ?? null}
          roomTypes={(roomTypesRes.data ?? []).map((r) => ({
            id: r.id as string,
            label: r.name as string,
            sublabel: r.code as string,
          }))}
          roomUnits={(unitsRes.data ?? []).map((r) => {
            const rt = Array.isArray(r.room_types)
              ? r.room_types[0]
              : r.room_types;
            return {
              id: r.id as string,
              label: r.label as string,
              sublabel: (rt as { name?: string } | null)?.name,
            };
          })}
          menuItems={(menuRes.data ?? []).map((m) => ({
            id: m.id as string,
            label: m.name as string,
            sublabel: (m.outlet as string | null) ?? undefined,
          }))}
          staff={(staffRes.data ?? []).map((s) => ({
            id: s.id as string,
            label: s.full_name as string,
            phone: (s.phone as string | null) ?? null,
            show_on_team: Boolean(s.show_on_team),
            team_role_label: (s.team_role_label as string | null) ?? null,
            team_sort_order: Number(s.team_sort_order ?? 0),
            role_label: (s.role_label as string) ?? "other",
          }))}
          media={media}
        />
      )}
    </DeskListShell>
  );
}
